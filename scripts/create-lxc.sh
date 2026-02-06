#!/bin/bash
#
# Peek LXC Creation Script for Proxmox
# Run this script on a Proxmox host to create and configure an LXC container
#

set -e

# Configuration defaults
CTID="${CTID:-200}"
CT_HOSTNAME="${CT_HOSTNAME:-Peek}"
MEMORY="${MEMORY:-2048}"
SWAP="${SWAP:-512}"
DISK="${DISK:-8}"
CORES="${CORES:-2}"
STORAGE="${STORAGE:-local-lvm}"
IP="${IP:-dhcp}"
GATEWAY="${GATEWAY:-}"
APP_PORT="${APP_PORT:-8080}"

# These can be set via env vars to skip prompts
BRIDGE="${BRIDGE:-}"
VLAN="${VLAN:-}"
ROOT_PASSWORD="${ROOT_PASSWORD:-}"
INTERACTIVE="${INTERACTIVE:-true}"

# Repository configuration
# Override REPO_URL to use your own fork or private repository
# For private repos, include credentials: https://user:token@github.com/user/repo.git
REPO_URL="${REPO_URL:-https://github.com/unwrntd/peek.git}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get available network bridges
get_bridges() {
    # Get bridges from /etc/network/interfaces and active bridges
    (grep -E "^iface vmbr[0-9]+" /etc/network/interfaces 2>/dev/null | awk '{print $2}' ; \
     ip link show type bridge 2>/dev/null | grep -oE "vmbr[0-9]+") | sort -u
}

# Function to prompt for bridge selection
prompt_bridge() {
    local bridges=($(get_bridges))

    if [ ${#bridges[@]} -eq 0 ]; then
        log_error "No network bridges found on this system"
        exit 1
    fi

    echo ""
    echo -e "${BOLD}${CYAN}Available Network Bridges:${NC}"
    echo "─────────────────────────────────────────"

    local i=1
    for bridge in "${bridges[@]}"; do
        # Try to get bridge info
        local info=""
        local ip_addr=$(ip -4 addr show "$bridge" 2>/dev/null | grep -oP 'inet \K[\d.]+/[\d]+' | head -1)
        local ports=$(bridge link show 2>/dev/null | grep "master $bridge" | wc -l)

        if [ -n "$ip_addr" ]; then
            info=" (IP: $ip_addr"
        fi
        if [ "$ports" -gt 0 ]; then
            [ -n "$info" ] && info="$info, " || info=" ("
            info="${info}${ports} ports"
        fi
        [ -n "$info" ] && info="$info)"

        echo -e "  ${BOLD}$i)${NC} $bridge$info"
        ((i++))
    done

    echo ""
    while true; do
        read -p "Select bridge [1-${#bridges[@]}]: " selection < /dev/tty
        if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#bridges[@]} ]; then
            BRIDGE="${bridges[$((selection-1))]}"
            break
        else
            echo "Invalid selection. Please enter a number between 1 and ${#bridges[@]}"
        fi
    done

    echo -e "${GREEN}✓${NC} Selected bridge: $BRIDGE"
}

# Function to prompt for VLAN tag
prompt_vlan() {
    echo ""
    echo -e "${BOLD}${CYAN}VLAN Configuration:${NC}"
    echo "─────────────────────────────────────────"
    echo "  Enter a VLAN tag (1-4094) or leave empty for untagged traffic."
    echo ""

    while true; do
        read -p "VLAN tag [none]: " vlan_input < /dev/tty

        if [ -z "$vlan_input" ]; then
            VLAN=""
            echo -e "${GREEN}✓${NC} No VLAN tag (untagged)"
            break
        elif [[ "$vlan_input" =~ ^[0-9]+$ ]] && [ "$vlan_input" -ge 1 ] && [ "$vlan_input" -le 4094 ]; then
            VLAN="$vlan_input"
            echo -e "${GREEN}✓${NC} VLAN tag: $VLAN"
            break
        else
            echo "Invalid VLAN tag. Please enter a number between 1 and 4094, or press Enter for none."
        fi
    done
}

# Function to get next available CTID
get_next_ctid() {
    local next=100
    while pct status "$next" &> /dev/null || qm status "$next" &> /dev/null 2>&1; do
        ((next++))
    done
    echo "$next"
}

# Function to prompt for container ID
prompt_ctid() {
    local suggested=$(get_next_ctid)

    echo ""
    echo -e "${BOLD}${CYAN}Container ID:${NC}"
    echo "─────────────────────────────────────────"
    echo "  Enter a container ID (100-999999999) or press Enter for suggested."
    echo ""

    while true; do
        read -p "Container ID [$suggested]: " ctid_input < /dev/tty

        if [ -z "$ctid_input" ]; then
            CTID="$suggested"
            echo -e "${GREEN}✓${NC} Container ID: $CTID"
            break
        elif [[ "$ctid_input" =~ ^[0-9]+$ ]] && [ "$ctid_input" -ge 100 ]; then
            if pct status "$ctid_input" &> /dev/null || qm status "$ctid_input" &> /dev/null 2>&1; then
                echo "ID $ctid_input is already in use. Please choose another."
            else
                CTID="$ctid_input"
                echo -e "${GREEN}✓${NC} Container ID: $CTID"
                break
            fi
        else
            echo "Invalid ID. Please enter a number >= 100."
        fi
    done
}

# Function to prompt for container name
prompt_hostname() {
    echo ""
    echo -e "${BOLD}${CYAN}Container Name:${NC}"
    echo "─────────────────────────────────────────"
    echo "  Enter a name for the container (used as hostname)."
    echo ""

    read -p "Container name [Peek]: " hostname_input < /dev/tty

    if [ -z "$hostname_input" ]; then
        CT_HOSTNAME="Peek"
    else
        # Sanitize: lowercase, replace spaces with dashes, remove invalid chars
        CT_HOSTNAME=$(echo "$hostname_input" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')
    fi
    echo -e "${GREEN}✓${NC} Container name: $CT_HOSTNAME"
}

# Function to prompt for root password
prompt_password() {
    echo ""
    echo -e "${BOLD}${CYAN}Root Password:${NC}"
    echo "─────────────────────────────────────────"
    echo "  Enter a root password for the container."
    echo "  Leave empty to generate a random password."
    echo ""

    while true; do
        read -s -p "Root password: " pass1 < /dev/tty
        echo ""

        if [ -z "$pass1" ]; then
            # Generate random password
            ROOT_PASSWORD=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)
            echo -e "${GREEN}✓${NC} Generated random password: ${BOLD}$ROOT_PASSWORD${NC}"
            echo -e "${YELLOW}  (Save this password - it won't be shown again)${NC}"
            break
        fi

        read -s -p "Confirm password: " pass2 < /dev/tty
        echo ""

        if [ "$pass1" = "$pass2" ]; then
            ROOT_PASSWORD="$pass1"
            echo -e "${GREEN}✓${NC} Password set"
            break
        else
            echo -e "${RED}Passwords do not match. Please try again.${NC}"
        fi
    done
}

# Check if running on Proxmox
if ! command -v pct &> /dev/null; then
    log_error "This script must be run on a Proxmox host"
    exit 1
fi

# Interactive prompts for configuration
if [ "$INTERACTIVE" = "true" ]; then
    echo ""
    echo -e "${BOLD}${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║      Peek LXC Setup Wizard         ║${NC}"
    echo -e "${BOLD}${CYAN}╚════════════════════════════════════════╝${NC}"

    # Prompt for CTID if not set via env var
    if [ "$CTID" = "200" ]; then
        prompt_ctid
    else
        # Check if provided CTID is in use
        if pct status "$CTID" &> /dev/null || qm status "$CTID" &> /dev/null 2>&1; then
            log_error "Container ID $CTID is already in use"
            prompt_ctid
        else
            echo ""
            echo -e "${GREEN}✓${NC} Using container ID from environment: $CTID"
        fi
    fi

    # Prompt for hostname if not set via env var
    if [ "$CT_HOSTNAME" = "Peek" ]; then
        prompt_hostname
    else
        echo ""
        echo -e "${GREEN}✓${NC} Using hostname from environment: $CT_HOSTNAME"
    fi

    # Prompt for bridge if not set via env var
    if [ -z "$BRIDGE" ]; then
        prompt_bridge
    else
        echo ""
        echo -e "${GREEN}✓${NC} Using bridge from environment: $BRIDGE"
    fi

    # Prompt for VLAN if not set via env var
    if [ -z "$VLAN" ]; then
        prompt_vlan
    else
        echo ""
        echo -e "${GREEN}✓${NC} Using VLAN from environment: $VLAN"
    fi

    # Prompt for root password if not set via env var
    if [ -z "$ROOT_PASSWORD" ]; then
        prompt_password
    else
        echo ""
        echo -e "${GREEN}✓${NC} Using password from environment"
    fi

    # Confirm before proceeding
    echo ""
    echo -e "${BOLD}${CYAN}Configuration Summary:${NC}"
    echo "─────────────────────────────────────────"
    echo -e "  Container ID: ${BOLD}$CTID${NC}"
    echo -e "  Hostname:     ${BOLD}$CT_HOSTNAME${NC}"
    echo -e "  Memory:       ${BOLD}${MEMORY}MB${NC}"
    echo -e "  Cores:        ${BOLD}$CORES${NC}"
    echo -e "  Disk:         ${BOLD}${DISK}GB${NC}"
    echo -e "  Bridge:       ${BOLD}$BRIDGE${NC}"
    if [ -n "$VLAN" ]; then
        echo -e "  VLAN:         ${BOLD}$VLAN${NC}"
    else
        echo -e "  VLAN:         ${BOLD}(untagged)${NC}"
    fi
    echo -e "  IP:           ${BOLD}$IP${NC}"
    echo ""

    read -p "Proceed with container creation? [Y/n]: " confirm < /dev/tty
    if [[ "$confirm" =~ ^[Nn] ]]; then
        echo "Aborted."
        exit 0
    fi
else
    # Non-interactive mode - check CTID and use defaults
    if pct status "$CTID" &> /dev/null || qm status "$CTID" &> /dev/null 2>&1; then
        log_error "Container ID $CTID is already in use"
        echo "Use a different CTID: CTID=201 $0"
        exit 1
    fi
    [ -z "$BRIDGE" ] && BRIDGE="vmbr0"
fi

# Check if template exists and download if needed
log_info "Checking for Debian 12 template..."
TEMPLATE=""

# First check if we already have a debian-12 template
TEMPLATE=$(pveam list local 2>/dev/null | grep -oE "local:vztmpl/debian-12[^ ]+" | head -1)

if [ -z "$TEMPLATE" ]; then
    log_warn "Debian 12 template not found. Updating template list..."
    pveam update

    # Find available debian-12 template
    AVAILABLE=$(pveam available --section system 2>/dev/null | grep -oE "debian-12-standard[^ ]+" | head -1)

    if [ -z "$AVAILABLE" ]; then
        log_error "No Debian 12 template available. Please check your Proxmox configuration."
        exit 1
    fi

    log_info "Downloading $AVAILABLE..."
    pveam download local "$AVAILABLE" || {
        log_error "Failed to download template."
        exit 1
    }

    # Get the template path after download
    TEMPLATE=$(pveam list local 2>/dev/null | grep -oE "local:vztmpl/debian-12[^ ]+" | head -1)
fi

if [ -z "$TEMPLATE" ]; then
    log_error "Failed to locate template after download."
    exit 1
fi

log_info "Using template: $TEMPLATE"

echo ""
log_info "Creating LXC container $CTID ($CT_HOSTNAME)..."

# Build network config
if [ "$IP" = "dhcp" ]; then
    NET_CONFIG="name=eth0,bridge=$BRIDGE,ip=dhcp"
else
    NET_CONFIG="name=eth0,bridge=$BRIDGE,ip=$IP"
    [ -n "$GATEWAY" ] && NET_CONFIG="$NET_CONFIG,gw=$GATEWAY"
fi

# Add VLAN tag if specified
if [ -n "$VLAN" ]; then
    NET_CONFIG="$NET_CONFIG,tag=$VLAN"
fi

# Create the container
pct create "$CTID" "$TEMPLATE" \
    --hostname "$CT_HOSTNAME" \
    --memory "$MEMORY" \
    --swap "$SWAP" \
    --cores "$CORES" \
    --rootfs "$STORAGE:$DISK" \
    --net0 "$NET_CONFIG" \
    --unprivileged 1 \
    --features nesting=1 \
    --onboot 1 \
    --start 0

log_info "Container created. Starting container..."
pct start "$CTID"

# Wait for container to be ready
sleep 5

# Set root password
if [ -n "$ROOT_PASSWORD" ]; then
    log_info "Setting root password..."
    echo "root:$ROOT_PASSWORD" | pct exec "$CTID" -- chpasswd
fi

log_info "Configuring container..."

# Create setup script to run inside the container
SETUP_SCRIPT=$(cat <<'INNERSCRIPT'
#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

echo "[1/7] Updating system..."
apt-get update && apt-get upgrade -y

echo "[2/7] Installing dependencies..."
apt-get install -y \
    curl \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    gnupg

echo "[3/7] Installing Node.js 20..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs

echo "[4/7] Installing Python packages..."
pip3 install --break-system-packages python-kasa

echo "[5/7] Cloning repository..."
INNERSCRIPT
)

# Add git clone command
SETUP_SCRIPT+="
cd /opt
git clone ${REPO_URL} peek
cd peek
"

SETUP_SCRIPT+=$(cat <<'INNERSCRIPT'

echo "[6/7] Building application..."
cd /opt/peek/backend
npm install
npm run build

# Copy Python helper script
cp /opt/peek/backend/src/integrations/kasa_helper.py /opt/peek/backend/dist/integrations/ 2>/dev/null || true

cd /opt/peek/frontend
npm install
npm run build

# Create data directory
mkdir -p /opt/peek/data

echo "[7/7] Creating systemd service..."
cat > /etc/systemd/system/peek.service <<EOF
[Unit]
Description=Peek Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/peek/backend
Environment=NODE_ENV=production
Environment=DATA_DIR=/opt/peek/data
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable peek
systemctl start peek

# Create updatepeek command
cat > /usr/local/bin/updatepeek <<'UPDATEEOF'
#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║         Updating Peek Dashboard        ║${NC}"
echo -e "${CYAN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""

cd /opt/peek

echo -e "${YELLOW}[1/5]${NC} Stopping Peek service..."
systemctl stop peek

echo -e "${YELLOW}[2/5]${NC} Pulling latest changes..."
git fetch origin
git reset --hard origin/main

echo -e "${YELLOW}[3/5]${NC} Rebuilding backend..."
cd /opt/peek/backend
npm install
npm run build
cp /opt/peek/backend/src/integrations/kasa_helper.py /opt/peek/backend/dist/integrations/ 2>/dev/null || true

echo -e "${YELLOW}[4/5]${NC} Rebuilding frontend..."
cd /opt/peek/frontend
npm install
npm run build

echo -e "${YELLOW}[5/5]${NC} Starting Peek service..."
systemctl start peek

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║       Peek updated successfully!       ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  View logs: ${BOLD}journalctl -u peek -f${NC}"
echo ""
UPDATEEOF

chmod +x /usr/local/bin/updatepeek

echo ""
echo "=========================================="
echo "  Peek installation complete!"
echo "=========================================="
echo ""
INNERSCRIPT
)

# Run setup script inside container
echo "$SETUP_SCRIPT" | pct exec "$CTID" -- bash -s

# Get container IP
sleep 2
CONTAINER_IP=$(pct exec "$CTID" -- hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   LXC Container Created Successfully!  ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Container ID: ${BOLD}$CTID${NC}"
echo -e "  Hostname:     ${BOLD}$CT_HOSTNAME${NC}"
echo -e "  Bridge:       ${BOLD}$BRIDGE${NC}"
[ -n "$VLAN" ] && echo -e "  VLAN:         ${BOLD}$VLAN${NC}"
echo -e "  IP Address:   ${BOLD}$CONTAINER_IP${NC}"
echo ""
echo -e "  ${CYAN}Dashboard:${NC}    ${BOLD}http://$CONTAINER_IP:3001${NC}"
echo ""
echo "  Manage container:"
echo "    pct enter $CTID     # Enter container shell"
echo "    pct stop $CTID      # Stop container"
echo "    pct start $CTID     # Start container"
echo ""
echo "  View logs:"
echo "    pct exec $CTID -- journalctl -u peek -f"
echo ""
echo "  Update Peek (inside container):"
echo "    updatepeek"
echo ""
echo "  Non-interactive usage:"
echo "    INTERACTIVE=false BRIDGE=vmbr0 VLAN=100 $0"
echo ""
