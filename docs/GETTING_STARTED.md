# Getting Started with Peek

A quick guide to get Peek up and running in your home lab.

## Installation Options

### Docker (Recommended)

The easiest way to run Peek is with Docker Compose:

```bash
# Clone the repository
git clone https://github.com/unwrntd/peek.git
cd peek

# Start with Docker Compose
docker compose -f docker/docker-compose.yml up -d

# Access at http://localhost:8080
```

### Proxmox LXC Container

A script is provided to automatically create and configure an LXC container on Proxmox:

```bash
curl -fsSL "https://raw.githubusercontent.com/unwrntd/peek/main/scripts/create-lxc.sh" | bash
```

### Manual Installation

If you prefer to run Peek directly:

```bash
# Clone the repository
git clone https://github.com/unwrntd/peek.git
cd peek

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Build frontend
npm run build

# Start the backend (serves both API and frontend)
cd ../backend && npm run build && npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `DATA_DIR` | Data directory path | `./data` |
| `NODE_ENV` | Environment mode | `development` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `*` (all) |

## First Steps

### 1. Create a Dashboard

When you first open Peek, you'll see an empty dashboard. Click the **+** button in the dashboard selector to create your first dashboard.

### 2. Add an Integration

Go to **Admin Settings > Integrations** and click **Add Integration** to connect your first service. Each integration requires:

- A name (for your reference)
- Host/URL of the service
- Authentication credentials (API key, username/password, etc.)

Click **Test** to verify the connection before saving.

### 3. Add Widgets

Once you have integrations configured:

1. Click the **Edit Mode** button (pencil icon) in the top navigation
2. Click **Add Widget** on your dashboard
3. Select an integration and choose from available widget types
4. Configure the widget settings and click **Add**
5. Drag widgets to arrange them on your dashboard
6. Click the **View Mode** button (eye icon) to exit edit mode

### 4. Organize with Widget Groups

You can group related widgets together:

1. In edit mode, click **Add Group**
2. Give the group a name
3. Drag widgets into the group
4. Groups can be collapsed/expanded to save space

## Tips

- **Multiple Dashboards**: Create separate dashboards for different purposes (e.g., "Network", "Media", "Smart Home")
- **Kiosk Mode**: Access `/k/{dashboard-id}` for a fullscreen view perfect for wall-mounted displays
- **Dark Mode**: Use the theme toggle in the top navigation to switch between light, dark, and system themes
- **Refresh All**: Click the refresh button in the navigation to update all widgets at once
- **Import/Export**: Backup your configuration in **Admin Settings > System > Export**

## Troubleshooting

### Widget shows "Failed to load data"

- Check that the integration is connected (green status in Admin > Integrations)
- Click **Test** on the integration to verify credentials
- Check the browser console for detailed error messages

### Integration won't connect

- Verify the host/URL is accessible from where Peek is running
- Check that API keys or credentials are correct
- Some integrations require specific API permissions or settings enabled

### Dashboard is empty after restart

- Ensure the `DATA_DIR` is persisted (especially important in Docker)
- Check that the SQLite database file exists in the data directory

## Next Steps

- [Adding Integrations](./ADDING_INTEGRATIONS.md) - Detailed guide for each integration type
- [Widget Configuration](./WIDGETS.md) - Customize widget appearance and filters
- [API Reference](./API.md) - Backend API documentation
- [Security Guide](./SECURITY.md) - Security features and recommendations
