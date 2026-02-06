FROM node:20-alpine

# Install Python for python-kasa (KLAP protocol support for newer Kasa devices)
# Install build tools for native dependencies (hap-controller BLE support)
# Install linux-headers and bluetooth libs for noble (BLE)
RUN apk add --no-cache python3 py3-pip make g++ linux-headers eudev-dev
RUN pip3 install --break-system-packages python-kasa

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
WORKDIR /app/backend
RUN npm install

WORKDIR /app/frontend
RUN npm install

# Copy source code
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend
COPY docs ./docs
COPY README.md ./docs/README.md

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app/backend
RUN npm run build

# Copy Python helper script to dist folder
RUN cp /app/backend/src/integrations/kasa_helper.py /app/backend/dist/integrations/

# Create data directory
RUN mkdir -p /app/data

WORKDIR /app/backend

EXPOSE 3001

CMD ["npm", "start"]
