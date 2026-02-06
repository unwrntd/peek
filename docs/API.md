# API Reference

Complete reference documentation for the Peek REST API.

## Base URL

```
http://localhost:3001/api
```

In production, use your configured domain with HTTPS.

## Authentication

The API does not currently require authentication. For production deployments, use CORS restrictions and network-level security.

## Rate Limiting

All endpoints are rate-limited. Limits are returned in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706745600
```

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Auth endpoints | 10 requests | 1 minute |
| Data endpoints | 200 requests | 1 minute |

## Request Headers

### Required Headers

```
Content-Type: application/json
```

### Response Headers

All responses include:

```
X-Request-ID: <uuid>          # Unique request identifier
X-RateLimit-Limit: <number>
X-RateLimit-Remaining: <number>
X-RateLimit-Reset: <timestamp>
```

---

## Dashboards

### List Dashboards

```http
GET /api/dashboards
```

**Response:**

```json
{
  "dashboards": [
    {
      "id": "uuid-string",
      "name": "Main Dashboard",
      "isDefault": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:22:00Z"
    }
  ]
}
```

### Create Dashboard

```http
POST /api/dashboards
```

**Request Body:**

```json
{
  "name": "My Dashboard",
  "isDefault": false
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid-string",
  "name": "My Dashboard",
  "isDefault": false
}
```

### Update Dashboard

```http
PUT /api/dashboards/:id
```

**Request Body:**

```json
{
  "name": "Renamed Dashboard",
  "isDefault": true
}
```

### Delete Dashboard

```http
DELETE /api/dashboards/:id
```

**Response:** `204 No Content`

---

## Dashboard Layout

### Get Dashboard Layout

```http
GET /api/dashboard?dashboardId=<uuid>
```

**Response:**

```json
{
  "dashboard": {
    "id": "uuid",
    "name": "Dashboard Name"
  },
  "widgets": [
    {
      "id": "widget-uuid",
      "integrationId": "integration-uuid",
      "widgetType": "vm-list",
      "title": "Virtual Machines",
      "config": {
        "refreshInterval": 30000,
        "visualization": "list"
      },
      "x": 0,
      "y": 0,
      "w": 4,
      "h": 3
    }
  ],
  "groups": [
    {
      "id": "group-uuid",
      "name": "Infrastructure",
      "collapsed": false,
      "order": 0
    }
  ]
}
```

### Save Widget Layouts

```http
PUT /api/dashboard/layouts
```

**Request Body:**

```json
{
  "dashboardId": "uuid",
  "layouts": {
    "lg": [
      { "i": "widget-uuid", "x": 0, "y": 0, "w": 4, "h": 3 }
    ]
  }
}
```

---

## Integrations

### List Integrations

```http
GET /api/integrations
```

**Response:**

```json
{
  "integrations": [
    {
      "id": "uuid",
      "name": "Proxmox Server",
      "type": "proxmox",
      "host": "192.168.1.100",
      "port": 8006,
      "enabled": true,
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ]
}
```

### Create Integration

```http
POST /api/integrations
```

**Request Body:**

```json
{
  "name": "My Proxmox",
  "type": "proxmox",
  "host": "192.168.1.100",
  "port": 8006,
  "config": {
    "apiToken": "user@pam!token=secret",
    "verifySSL": false
  }
}
```

**Response:** `201 Created`

### Update Integration

```http
PUT /api/integrations/:id
```

**Request Body:**

```json
{
  "name": "Updated Name",
  "enabled": true,
  "config": {
    "refreshInterval": 60000
  }
}
```

### Delete Integration

```http
DELETE /api/integrations/:id
```

**Response:** `204 No Content`

### Test Integration Connection

```http
POST /api/integrations/:id/test
```

**Response:**

```json
{
  "success": true,
  "message": "Connected to Proxmox VE 8.1"
}
```

Or on failure:

```json
{
  "success": false,
  "message": "Connection refused"
}
```

### Get Available Integration Types

```http
GET /api/integration-types
```

**Response:**

```json
[
  {
    "type": "proxmox",
    "name": "Proxmox VE",
    "description": "Virtual machine and container monitoring"
  },
  {
    "type": "unifi",
    "name": "UniFi Controller",
    "description": "Network device monitoring"
  }
]
```

---

## Widgets

### Create Widget

```http
POST /api/widgets
```

**Request Body:**

```json
{
  "dashboardId": "dashboard-uuid",
  "integrationId": "integration-uuid",
  "widgetType": "vm-list",
  "title": "Virtual Machines",
  "config": {
    "refreshInterval": 30000,
    "visualization": "list",
    "showCpu": true,
    "showMemory": true
  },
  "x": 0,
  "y": 0,
  "w": 4,
  "h": 3
}
```

### Update Widget

```http
PUT /api/widgets/:id
```

**Request Body:**

```json
{
  "title": "Updated Title",
  "config": {
    "visualization": "cards"
  }
}
```

### Delete Widget

```http
DELETE /api/widgets/:id
```

**Response:** `204 No Content`

---

## Widget Data

### Get Integration Data

```http
GET /api/data/:integrationId/:metric
```

**Parameters:**

- `integrationId` - Integration UUID
- `metric` - Metric name (e.g., `vms`, `status`, `statistics`)

**Response:** Varies by integration and metric. Example for Proxmox VMs:

```json
{
  "nodes": [
    {
      "node": "pve",
      "status": "online",
      "cpu": 0.15,
      "memory": { "used": 8589934592, "total": 17179869184 }
    }
  ],
  "vms": [
    {
      "vmid": 100,
      "name": "ubuntu-server",
      "status": "running",
      "cpu": 0.05,
      "mem": 2147483648,
      "maxmem": 4294967296
    }
  ]
}
```

---

## Groups

### List Groups

```http
GET /api/groups?dashboardId=<uuid>
```

### Create Group

```http
POST /api/groups
```

**Request Body:**

```json
{
  "dashboardId": "dashboard-uuid",
  "name": "Infrastructure",
  "order": 0
}
```

### Update Group

```http
PUT /api/groups/:id
```

### Delete Group

```http
DELETE /api/groups/:id
```

---

## Settings

### Get Branding Settings

```http
GET /api/settings/branding
```

**Response:**

```json
{
  "appName": "Peek",
  "logoUrl": "/uploads/logo.png",
  "faviconUrl": "/uploads/favicon.ico",
  "primaryColor": "#3B82F6"
}
```

### Update Branding Settings

```http
PUT /api/settings/branding
```

**Request Body:**

```json
{
  "appName": "My Dashboard",
  "primaryColor": "#10B981"
}
```

### Export Configuration

```http
GET /api/settings/export
```

**Response:** JSON file download containing:

- Dashboards
- Widgets
- Integrations (credentials redacted)
- Groups
- Branding settings

### Import Configuration

```http
POST /api/settings/import
```

**Request Body:** JSON configuration file

**Query Parameters:**

- `merge=true` - Merge with existing (default)
- `replace=true` - Replace all existing

### Get System Status

```http
GET /api/settings/system-status
```

**Response:**

```json
{
  "cpu": {
    "model": "Apple M1",
    "cores": 8,
    "usage": 15
  },
  "memory": {
    "total": 17179869184,
    "used": 8589934592,
    "free": 8590336992,
    "usagePercent": 50
  },
  "disk": {
    "total": 499963174912,
    "used": 234567890123,
    "free": 265395284789,
    "usagePercent": 47
  },
  "system": {
    "hostname": "server",
    "platform": "darwin",
    "arch": "arm64",
    "uptime": 86400,
    "nodeVersion": "v20.10.0"
  },
  "storage": {
    "databaseSize": 1048576,
    "uploadsSize": 52428800,
    "totalAppSize": 53477376
  }
}
```

### Factory Reset

```http
POST /api/settings/reset
```

**Response:** `204 No Content`

Deletes all data including:

- Dashboards and widgets
- Integrations
- Groups
- Uploaded media
- Branding settings

---

## Media

### List Media Files

```http
GET /api/media
```

**Query Parameters:**

- `libraryId` - Filter by library
- `type` - Filter by type (`image`, `icon`)

**Response:**

```json
{
  "files": [
    {
      "id": "uuid",
      "filename": "logo.png",
      "originalName": "my-logo.png",
      "mimeType": "image/png",
      "size": 12345,
      "url": "/uploads/logo.png",
      "libraryId": "library-uuid"
    }
  ]
}
```

### Upload Media

```http
POST /api/media/upload
```

**Content-Type:** `multipart/form-data`

**Form Fields:**

- `files` - One or more files
- `libraryId` - Target library UUID (optional)

**Limits:**

- Max file size: 10 MB
- Max files per upload: 100
- Allowed types: PNG, JPEG, GIF, SVG, WebP, ICO

### Delete Media

```http
DELETE /api/media/:id
```

---

## Logs

### Get Logs

```http
GET /api/logs
```

**Query Parameters:**

- `level` - Filter by level (`debug`, `info`, `warn`, `error`)
- `source` - Filter by source
- `limit` - Maximum entries (default 100)
- `offset` - Skip entries for pagination

**Response:**

```json
{
  "logs": [
    {
      "timestamp": "2024-01-20T14:30:00Z",
      "level": "info",
      "source": "proxmox",
      "message": "Connected to server",
      "requestId": "uuid"
    }
  ],
  "total": 1234
}
```

### Clear Logs

```http
DELETE /api/logs
```

**Query Parameters:**

- `olderThanDays` - Delete logs older than N days (optional)

---

## Weather

### Get Weather Data

```http
GET /api/weather
```

**Query Parameters:**

- `lat` - Latitude
- `lon` - Longitude
- `units` - `metric` or `imperial`

**Response:**

```json
{
  "current": {
    "temp": 22,
    "feels_like": 21,
    "humidity": 65,
    "condition": "Partly Cloudy",
    "icon": "02d"
  },
  "forecast": [
    {
      "date": "2024-01-21",
      "high": 25,
      "low": 18,
      "condition": "Sunny"
    }
  ]
}
```

---

## Network Tools

### Ping Host

```http
POST /api/network/ping
```

**Request Body:**

```json
{
  "host": "192.168.1.1"
}
```

**Response:**

```json
{
  "host": "192.168.1.1",
  "alive": true,
  "time": 1.234
}
```

### Wake-on-LAN

```http
POST /api/network/wol
```

**Request Body:**

```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "broadcast": "192.168.1.255"
}
```

---

## Package Export/Import

### Export Full Package

```http
GET /api/package/export
```

**Response:** ZIP file containing:

- Configuration JSON
- Uploaded media files
- Database backup

### Import Full Package

```http
POST /api/package/import
```

**Content-Type:** `multipart/form-data`

**Form Fields:**

- `package` - ZIP file from export

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Invalid request body or parameters |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Rate Limit Error

```json
{
  "error": "Too many API requests, please try again later",
  "retryAfter": 300
}
```

---

## Cross-Integration Data

### Get Combined Data

```http
GET /api/cross-integration/:queryType
```

**Query Types:**

- `storage-overview` - Combined storage from all integrations
- `media-overview` - Combined media server statistics

**Response:** Aggregated data from multiple integrations.

---

## Documentation

### List Documentation Files

```http
GET /api/docs
```

**Response:**

```json
{
  "files": [
    { "name": "README.md", "path": "/api/docs/README.md" },
    { "name": "ADDING_INTEGRATIONS.md", "path": "/api/docs/ADDING_INTEGRATIONS.md" }
  ]
}
```

### Get Documentation File

```http
GET /api/docs/:filename
```

**Response:** Markdown content

```
Content-Type: text/markdown
```
