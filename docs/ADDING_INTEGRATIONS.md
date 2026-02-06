# Adding New Integrations

This guide explains how to add new integrations and widgets to the dashboard application using the centralized configuration registry system.

## Overview

The configuration system uses a centralized registry pattern where all integration and widget configurations are defined in TypeScript files under `frontend/src/config/integrations/`. This ensures:

- **Type Safety**: All configurations are strongly typed
- **Consistency**: Widget filters, visualizations, and auth fields are always correct
- **Maintainability**: Single source of truth for each integration
- **Scalability**: Easy to add new integrations following the same pattern

## Directory Structure

```
frontend/src/config/integrations/
├── types.ts        # TypeScript interfaces for all configs
├── index.ts        # Registry that exports all configs
├── proxmox.ts      # Proxmox VE integration config
├── unifi.ts        # UniFi Controller integration config
├── beszel.ts       # Beszel server monitoring config
├── adguard.ts      # AdGuard Home config
└── static.ts       # Static widgets (no integration required)
```

## Step-by-Step: Adding a New Integration

### 1. Create the Integration Config File

Create a new file `frontend/src/config/integrations/your-integration.ts`:

```typescript
import { IntegrationConfig } from './types';

export const yourIntegrationConfig: IntegrationConfig = {
  // Unique identifier (lowercase, used in URLs and API)
  type: 'your-integration',

  // Display name shown in the UI
  displayName: 'Your Integration Name',

  // Placeholder shown in the "Name" field when adding integration
  sampleName: 'My Your Integration Server',

  // Default port for the service
  defaultPort: 8080,

  // Placeholder shown in the "Host" field
  sampleHost: '192.168.1.100',

  // Authentication configuration
  auth: {
    // Default auth method when form opens
    defaultMethod: 'api', // or 'basic'

    // Fields shown regardless of auth method (e.g., custom settings)
    commonFields: [],

    // Available authentication methods
    methods: [
      {
        method: 'api',
        label: 'API Token',
        fields: [
          {
            key: 'apiToken',
            label: 'API Token',
            type: 'password',
            placeholder: 'Your API token',
            required: true,
            helpText: 'Generate from Settings > API',
          },
        ],
      },
      {
        method: 'basic',
        label: 'Username/Password',
        fields: [
          {
            key: 'username',
            label: 'Username',
            type: 'text',
            placeholder: 'admin',
            required: true,
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true,
          },
        ],
      },
    ],
  },

  // Widget definitions
  widgets: [
    // See "Adding Widgets" section below
  ],
};
```

### 2. Register the Integration

Update `frontend/src/config/integrations/index.ts`:

```typescript
// Add import
import { yourIntegrationConfig } from './your-integration';

// Add to integrationConfigs array
export const integrationConfigs: IntegrationConfig[] = [
  proxmoxConfig,
  unifiConfig,
  beszelConfig,
  adguardConfig,
  yourIntegrationConfig, // Add here
];
```

### 3. Add Backend Support

Create the backend handler in `backend/src/integrations/`:

```typescript
// backend/src/integrations/your-integration.ts
import axios from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, IntegrationData } from './base';
import { withRetry, isRetryableError } from '../utils/retry';
import { circuitBreakerRegistry } from '../utils/circuitBreaker';

interface YourIntegrationConfig {
  host: string;
  port: number;
  apiToken?: string;
  username?: string;
  password?: string;
  verifySSL?: boolean;
}

export class YourIntegration extends BaseIntegration {
  type = 'your-integration';
  name = 'Your Integration';

  private createClient(config: YourIntegrationConfig) {
    const baseURL = `https://${config.host}:${config.port}`;
    return axios.create({
      baseURL,
      timeout: 15000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL !== false,
      }),
      headers: config.apiToken
        ? { Authorization: `Bearer ${config.apiToken}` }
        : undefined,
      auth: config.username
        ? { username: config.username, password: config.password || '' }
        : undefined,
    });
  }

  async testConnection(config: YourIntegrationConfig): Promise<ConnectionTestResult> {
    try {
      const client = this.createClient(config);
      const response = await client.get('/api/status');
      return {
        success: true,
        message: `Connected to ${response.data.name || 'server'}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async getData(config: YourIntegrationConfig, metric: string): Promise<IntegrationData> {
    const client = this.createClient(config);
    const circuitBreaker = circuitBreakerRegistry.get(`your-integration:${config.host}`);

    // Use circuit breaker and retry for resilience
    return circuitBreaker.execute(async () => {
      return withRetry(
        async () => {
          switch (metric) {
            case 'status':
              const response = await client.get('/api/status');
              return response.data;
            default:
              throw new Error(`Unknown metric: ${metric}`);
          }
        },
        {
          maxAttempts: 3,
          shouldRetry: isRetryableError,
        }
      );
    });
  }

  getAvailableMetrics() {
    return [
      { metric: 'status', name: 'Status', description: 'System status' },
    ];
  }

  // REQUIRED: Define API capabilities for the API Explorer
  getApiCapabilities(): ApiCapability[] {
    return [
      // Implemented endpoints (ones you've built getData handlers for)
      {
        id: 'status',
        name: 'Get Status',
        description: 'Get current system status',
        method: 'GET',
        endpoint: '/api/status',
        implemented: true,
        category: 'Status',
      },
      // Unimplemented endpoints (available in the API but not yet integrated)
      {
        id: 'users-list',
        name: 'List Users',
        description: 'Get all users in the system',
        method: 'GET',
        endpoint: '/api/users',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-create',
        name: 'Create User',
        description: 'Create a new user',
        method: 'POST',
        endpoint: '/api/users',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Username' },
          { name: 'email', type: 'string', required: true, description: 'Email address' },
        ],
      },
    ];
  }
}
```

**Important**: Don't forget to import `ApiCapability` from `./base`:

```typescript
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
```

Register the integration type in `backend/src/integrations/registry.ts`:

```typescript
import { YourIntegration } from './your-integration';

// In the constructor:
this.register(new YourIntegration());
```

#### Backend Utilities

The backend provides utilities for building resilient integrations:

**Retry with Exponential Backoff** (`backend/src/utils/retry.ts`):
```typescript
import { withRetry, isRetryableError } from '../utils/retry';

// Automatic retry with exponential backoff
const result = await withRetry(
  () => axios.get(url),
  {
    maxAttempts: 3,
    baseDelay: 1000,
    shouldRetry: isRetryableError,
  }
);
```

**Circuit Breaker** (`backend/src/utils/circuitBreaker.ts`):
```typescript
import { circuitBreakerRegistry } from '../utils/circuitBreaker';

// Get or create a circuit breaker for this service
const breaker = circuitBreakerRegistry.get('service-name', {
  failureThreshold: 5,    // Open after 5 failures
  successThreshold: 2,    // Close after 2 successes
  timeout: 30000,         // Try again after 30s
});

// Execute through the breaker
const result = await breaker.execute(() => fetchData());
```

## API Capabilities (Required)

Every integration **must** implement `getApiCapabilities()` to document its API surface. This enables the API Explorer in the Dev tab to show all available endpoints and allows users to test them directly.

### Why API Capabilities Matter

- **Discovery**: Shows users what the integration can do beyond current widgets
- **Testing**: Allows direct API testing from the UI for debugging
- **Documentation**: Self-documenting API reference within the app
- **Future Development**: Makes it easy to see what endpoints could be implemented next

### ApiCapability Interface

```typescript
interface ApiCapability {
  id: string;              // Unique identifier (e.g., 'get-status', 'list-users')
  name: string;            // Human-readable name (e.g., 'Get Status')
  description: string;     // What the endpoint does
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;        // API path (e.g., '/api/v1/status')
  implemented: boolean;    // true if you've built a handler for this
  category?: string;       // Group endpoints (e.g., 'Status', 'Users', 'Settings')
  parameters?: {           // Required/optional parameters
    name: string;
    type: string;          // 'string', 'number', 'boolean', 'object', 'array'
    required: boolean;
    description?: string;
  }[];
  documentationUrl?: string;  // Link to official API docs
}
```

### Best Practices

1. **Be Comprehensive**: Document ALL endpoints from the service's API, not just the ones you've implemented
2. **Use Categories**: Group related endpoints (Status, Users, Settings, etc.)
3. **Mark Implementation Status**: Set `implemented: true` only for endpoints with actual handlers
4. **Include Parameters**: Document parameters for POST/PUT/DELETE endpoints
5. **Add Documentation URLs**: Link to official API docs when available

### Example: Complete API Capabilities

```typescript
getApiCapabilities(): ApiCapability[] {
  return [
    // === Status (Implemented) ===
    {
      id: 'status',
      name: 'Get Status',
      description: 'Get server status including version and uptime',
      method: 'GET',
      endpoint: '/api/status',
      implemented: true,
      category: 'Status',
      documentationUrl: 'https://example.com/docs/api#status',
    },

    // === Users (Not Implemented) ===
    {
      id: 'users-list',
      name: 'List Users',
      description: 'Get all users with optional filters',
      method: 'GET',
      endpoint: '/api/users',
      implemented: false,
      category: 'Users',
      parameters: [
        { name: 'limit', type: 'number', required: false, description: 'Max results' },
        { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
      ],
    },
    {
      id: 'user-get',
      name: 'Get User',
      description: 'Get a specific user by ID',
      method: 'GET',
      endpoint: '/api/users/{id}',
      implemented: false,
      category: 'Users',
      parameters: [
        { name: 'id', type: 'string', required: true, description: 'User ID' },
      ],
    },
    {
      id: 'user-create',
      name: 'Create User',
      description: 'Create a new user account',
      method: 'POST',
      endpoint: '/api/users',
      implemented: false,
      category: 'Users',
      parameters: [
        { name: 'username', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'role', type: 'string', required: false, description: 'User role' },
      ],
    },
    {
      id: 'user-delete',
      name: 'Delete User',
      description: 'Delete a user account',
      method: 'DELETE',
      endpoint: '/api/users/{id}',
      implemented: false,
      category: 'Users',
      parameters: [
        { name: 'id', type: 'string', required: true, description: 'User ID' },
      ],
    },

    // === Settings (Not Implemented) ===
    {
      id: 'settings-get',
      name: 'Get Settings',
      description: 'Get current server settings',
      method: 'GET',
      endpoint: '/api/settings',
      implemented: false,
      category: 'Settings',
    },
    {
      id: 'settings-update',
      name: 'Update Settings',
      description: 'Update server settings',
      method: 'PUT',
      endpoint: '/api/settings',
      implemented: false,
      category: 'Settings',
      parameters: [
        { name: 'settings', type: 'object', required: true, description: 'Settings object' },
      ],
    },
  ];
}
```

## Adding Widgets

Each widget is defined in the `widgets` array of your integration config:

```typescript
widgets: [
  {
    // Unique widget type identifier
    type: 'status-overview',

    // Display name in widget picker
    name: 'Status Overview',

    // Description shown in widget picker
    description: 'Shows current system status',

    // API endpoint to fetch data from
    metric: 'status',

    // Default grid size when added
    defaultSize: { w: 4, h: 3 },

    // Minimum allowed size
    minSize: { w: 2, h: 2 },

    // Enable "Hide Labels" toggle in settings
    supportsHideLabels: true,

    // Enable "Metric Size" selector in settings
    supportsMetricSize: true,

    // Visualization options (shown in Appearance tab)
    visualizations: [
      { value: 'bars', label: 'Horizontal Bars (Default)' },
      { value: 'gauges', label: 'Circular Gauges' },
      { value: 'donut', label: 'Donut Chart' },
    ],

    // Filter configurations (shown in Filters tab)
    filters: [
      // Select dropdown
      {
        label: 'Status Filter',
        key: 'statusFilter',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'online', label: 'Online Only' },
          { value: 'offline', label: 'Offline Only' },
        ],
      },

      // Text input
      {
        label: 'Search',
        key: 'search',
        type: 'text',
        placeholder: 'e.g. server*, host1,host2',
      },

      // Number input
      {
        label: 'Max Items',
        key: 'maxItems',
        type: 'number',
        placeholder: '20',
      },

      // Single checkbox
      {
        label: 'Compact View',
        key: 'compactView',
        type: 'checkbox',
      },

      // Checkbox group
      {
        label: 'Columns to Display',
        key: 'columns',
        type: 'checkbox-group',
        defaultEnabled: true, // All items checked by default
        items: [
          { label: 'Status', key: 'showStatus' },
          { label: 'CPU', key: 'showCpu' },
          { label: 'Memory', key: 'showMemory' },
        ],
      },
    ],
  },
],
```

## Creating the Widget Component

Create the React component in `frontend/src/components/Widgets/your-integration/`:

```typescript
// frontend/src/components/Widgets/your-integration/StatusOverview.tsx
import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface StatusOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
}

export function StatusOverview({ integrationId, config }: StatusOverviewProps) {
  const { data, loading, error } = useWidgetData({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 30000,
  });

  // Read config options
  const showStatus = config.showStatus !== false;
  const showCpu = config.showCpu !== false;
  const compactView = config.compactView === true;
  const visualizationType = (config.visualizationType as string) || 'bars';

  return (
    <BaseWidget loading={loading} error={error}>
      {/* Widget content */}
    </BaseWidget>
  );
}
```

## Widget Type Naming Convention

Widget types follow these naming conventions:

- **Integration widgets**: Use descriptive names like `vm-list`, `client-count`, `network-health`
- **Beszel widgets**: Prefix with `beszel-` (e.g., `beszel-system-stats`)
- **AdGuard widgets**: Prefix with `adguard-` (e.g., `adguard-stats`)
- **Static widgets**: Use simple names like `text`, `image`, `network-tools`

## Authentication Field Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | Standard text input | Username, Host |
| `password` | Masked password field | Password, API Key, Token |
| `number` | Numeric input | Port number |

## Filter Types

| Type | Description | Use Case |
|------|-------------|----------|
| `select` | Dropdown with options | Status filter, Type filter |
| `text` | Free-form text input | Search, Node filter |
| `number` | Numeric input | Max items, Threshold |
| `checkbox` | Single toggle | Compact view, Show disabled |
| `checkbox-group` | Multiple toggles | Column visibility, Display elements |
| `switch-select` | Dynamic switch selector | UniFi switch selection |

### Collapsible Filter Groups

For widgets with many filter options, you can organize them into collapsible sections to improve UX:

```typescript
filters: [
  // Ungrouped filters appear at the top (always visible)
  {
    label: 'Systems',
    key: 'selectedHosts',
    type: 'beszel-host-select',
  },

  // Grouped filters appear in collapsible sections
  {
    label: 'Temperature Sensors',
    key: 'selectedTemps',
    type: 'beszel-temp-select',
    group: 'Temperature Settings',        // Group name (creates collapsible section)
    groupCollapsedByDefault: true,        // Start collapsed (only on first filter in group)
  },
  {
    label: 'Warning (°C)',
    key: 'tempWarningThreshold',
    type: 'number',
    group: 'Temperature Settings',        // Same group name
  },
  {
    label: 'Critical (°C)',
    key: 'tempCriticalThreshold',
    type: 'number',
    group: 'Temperature Settings',        // Same group name
  },

  // Another group
  {
    label: 'Show Totals',
    key: 'totals',
    type: 'checkbox-group',
    group: 'Appearance',
    groupCollapsedByDefault: true,
  },
],
```

**Group Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `group` | `string` | Group name displayed as the collapsible section header |
| `groupCollapsedByDefault` | `boolean` | If `true`, the group starts collapsed. Only set on the first filter in each group. |

**Best Practices:**
- Keep essential/frequently-used filters ungrouped (always visible)
- Group advanced or rarely-changed settings together
- Use descriptive group names (e.g., "Temperature Settings", "Appearance", "Thresholds")
- Consider collapsing groups with many options by default

## Testing Your Integration

1. **Build and run**:
   ```bash
   docker compose up -d --build
   ```

2. **Add the integration**:
   - Go to Settings > Integrations
   - Click "Add Integration"
   - Select your integration type
   - Fill in the connection details

3. **Add widgets**:
   - Click "Add Widget" on a dashboard
   - Select your integration
   - Choose a widget type
   - Verify filters and visualizations work

4. **Test all configurations**:
   - Verify sample names appear correctly
   - Test all auth methods
   - Test all widget filters
   - Test visualization options

## Common Issues

### Missing Auth Fields
- Ensure `auth.methods` array includes all authentication methods
- Verify `fields` array has all required inputs

### Wrong Sample Name
- Check `sampleName` in your integration config
- Ensure it's descriptive but concise

### Widget Not Appearing
- Verify widget type is unique
- Check that integration is registered in `index.ts`
- Ensure widget is in the correct `widgets` array

### Filters Not Working
- Verify filter `key` matches the config key used in widget component
- Check that `type` is correct for the input type needed

## Reference: Integration Config Interface

```typescript
interface IntegrationConfig {
  type: string;
  displayName: string;
  sampleName: string;
  defaultPort: number;
  sampleHost: string;
  auth: {
    defaultMethod: 'api' | 'basic';
    commonFields: AuthFieldConfig[];
    methods: AuthMethodConfig[];
    helpText?: string;
  };
  widgets: WidgetConfig[];
}

interface WidgetConfig {
  type: string;
  name: string;
  description: string;
  metric: string;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  visualizations?: { value: string; label: string }[];
  filters?: FilterConfig[];
  supportsHideLabels?: boolean;
  supportsMetricSize?: boolean;
}

interface FilterConfig {
  label: string;
  key: string;
  type: 'select' | 'text' | 'number' | 'checkbox' | 'checkbox-group' | 'button-group' | ...;
  options?: { value: string; label: string }[];
  placeholder?: string;
  items?: { label: string; key: string }[];  // For checkbox-group
  defaultEnabled?: boolean;                   // For checkbox-group
  min?: number;                               // For number
  max?: number;                               // For number
  defaultValue?: string | number | boolean;
  dependsOn?: { key: string; value: unknown }; // Conditional display
  group?: string;                             // Collapsible group name
  groupCollapsedByDefault?: boolean;          // Start group collapsed
}
```

See `frontend/src/config/integrations/types.ts` for the complete type definitions.

## Related Documentation

- [Widget Configuration Guide](WIDGETS.md) - Detailed widget visualization and filter configuration
- [API Reference](API.md) - Backend API documentation
- [Security Guide](SECURITY.md) - Security features and deployment recommendations
