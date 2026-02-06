import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  OnePasswordConfig,
  OnePasswordVault,
  OnePasswordItem,
  OnePasswordActivity,
  OnePasswordHealth,
  OnePasswordCategory,
} from '../types';
import { logger } from '../services/logger';

export class OnePasswordIntegration extends BaseIntegration {
  readonly type = 'onepassword';
  readonly name = '1Password';

  private getBaseUrl(config: OnePasswordConfig): string {
    if (config.useServiceAccount) {
      return 'https://api.1password.com/v2';
    }
    const protocol = config.verifySSL === false ? 'http' : 'https';
    return `${protocol}://${config.host}:${config.port || 8080}/v1`;
  }

  private createClient(config: OnePasswordConfig): AxiosInstance {
    const baseURL = this.getBaseUrl(config);

    return axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? true,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const opConfig = config as OnePasswordConfig;

    if (!opConfig.token) {
      return { success: false, message: 'Token is required' };
    }

    if (!opConfig.useServiceAccount && !opConfig.host) {
      return { success: false, message: 'Host is required for Connect Server mode' };
    }

    try {
      const client = this.createClient(opConfig);

      if (opConfig.useServiceAccount) {
        // Service Account mode - just try to list vaults
        const vaultsResponse = await client.get('/vaults');
        const vaults = vaultsResponse.data || [];

        return {
          success: true,
          message: `Connected to 1Password (${vaults.length} vaults accessible)`,
          details: {
            mode: 'Service Account',
            vaultCount: vaults.length,
          },
        };
      } else {
        // Connect Server mode - check health and heartbeat
        const [healthResponse, heartbeatResponse] = await Promise.all([
          client.get('/health'),
          client.get('/heartbeat').catch(() => ({ data: null })),
        ]);

        const health: OnePasswordHealth = healthResponse.data;
        const allHealthy = health.dependencies?.every(d => d.status === 'ACTIVE') ?? true;

        return {
          success: true,
          message: `Connected to ${health.name} v${health.version}`,
          details: {
            mode: 'Connect Server',
            name: health.name,
            version: health.version,
            healthy: allHealthy,
            dependencies: health.dependencies,
          },
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('onepassword', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Authentication failed: Invalid token',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Access denied: Token lacks required permissions',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused: Cannot reach ${opConfig.host}:${opConfig.port || 8080}`,
          };
        }
      }

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const opConfig = config as OnePasswordConfig;
    const client = this.createClient(opConfig);

    switch (metric) {
      case 'status':
        return this.getStatus(client, opConfig);
      case 'vaults':
        return this.getVaults(client);
      case 'vault-summary':
        return this.getVaultSummary(client);
      case 'recent-activity':
        return this.getActivity(client, opConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatus(client: AxiosInstance, config: OnePasswordConfig): Promise<{
    health: OnePasswordHealth | null;
    mode: string;
    vaultCount: number;
    healthy: boolean;
  }> {
    try {
      let health: OnePasswordHealth | null = null;
      let healthy = true;

      if (!config.useServiceAccount) {
        const healthResponse = await client.get('/health');
        health = healthResponse.data;
        healthy = health?.dependencies?.every(d => d.status === 'ACTIVE') ?? true;
      }

      const vaultsResponse = await client.get('/vaults');
      const vaults = vaultsResponse.data || [];

      return {
        health,
        mode: config.useServiceAccount ? 'Service Account' : 'Connect Server',
        vaultCount: vaults.length,
        healthy,
      };
    } catch (error) {
      logger.error('onepassword', 'Failed to get status', { error });
      throw error;
    }
  }

  private async getVaults(client: AxiosInstance): Promise<{
    vaults: OnePasswordVault[];
    totalItems: number;
  }> {
    try {
      const response = await client.get('/vaults');
      const vaults: OnePasswordVault[] = response.data || [];

      const totalItems = vaults.reduce((sum, vault) => sum + (vault.items || 0), 0);

      return { vaults, totalItems };
    } catch (error) {
      logger.error('onepassword', 'Failed to get vaults', { error });
      throw error;
    }
  }

  private async getVaultSummary(client: AxiosInstance): Promise<{
    vaults: Array<{
      vault: OnePasswordVault;
      itemsByCategory: Record<string, number>;
    }>;
  }> {
    try {
      const vaultsResponse = await client.get('/vaults');
      const vaults: OnePasswordVault[] = vaultsResponse.data || [];

      const vaultSummaries = await Promise.all(
        vaults.slice(0, 5).map(async (vault) => {
          try {
            const itemsResponse = await client.get(`/vaults/${vault.id}/items`);
            const items: OnePasswordItem[] = itemsResponse.data || [];

            const itemsByCategory: Record<string, number> = {};
            items.forEach((item) => {
              const category = item.category || 'OTHER';
              itemsByCategory[category] = (itemsByCategory[category] || 0) + 1;
            });

            return { vault, itemsByCategory };
          } catch {
            return { vault, itemsByCategory: {} };
          }
        })
      );

      return { vaults: vaultSummaries };
    } catch (error) {
      logger.error('onepassword', 'Failed to get vault summary', { error });
      throw error;
    }
  }

  private async getActivity(client: AxiosInstance, config: OnePasswordConfig): Promise<{
    activities: OnePasswordActivity[];
    available: boolean;
  }> {
    // Activity endpoint is only available on Connect Server
    if (config.useServiceAccount) {
      return { activities: [], available: false };
    }

    try {
      const response = await client.get('/activity', {
        params: { limit: 50 },
      });
      const activities: OnePasswordActivity[] = response.data || [];

      return { activities, available: true };
    } catch (error) {
      // Activity endpoint might not be available in all versions
      logger.warn('onepassword', 'Activity endpoint not available', { error });
      return { activities: [], available: false };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Health and version information',
        widgetTypes: ['onepassword-status'],
      },
      {
        id: 'vaults',
        name: 'Vaults',
        description: 'List of accessible vaults',
        widgetTypes: ['onepassword-vaults'],
      },
      {
        id: 'vault-summary',
        name: 'Vault Summary',
        description: 'Items by category across vaults',
        widgetTypes: ['onepassword-vault-summary'],
      },
      {
        id: 'recent-activity',
        name: 'Recent Activity',
        description: 'Recent vault and item activity (Connect Server only)',
        widgetTypes: ['onepassword-activity'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Health & Status (Connect Server only)
      {
        id: 'health',
        name: 'Get Health',
        description: 'Get Connect server health status and dependencies',
        method: 'GET',
        endpoint: '/health',
        implemented: true,
        category: 'Health',
        documentationUrl: 'https://developer.1password.com/docs/connect/connect-api-reference/#get-health',
      },
      {
        id: 'heartbeat',
        name: 'Heartbeat',
        description: 'Simple heartbeat check for the Connect server',
        method: 'GET',
        endpoint: '/heartbeat',
        implemented: true,
        category: 'Health',
      },

      // Vaults
      {
        id: 'list-vaults',
        name: 'List Vaults',
        description: 'Get all vaults accessible with the current token',
        method: 'GET',
        endpoint: '/vaults',
        implemented: true,
        category: 'Vaults',
        documentationUrl: 'https://developer.1password.com/docs/connect/connect-api-reference/#list-vaults',
      },
      {
        id: 'get-vault',
        name: 'Get Vault',
        description: 'Get details of a specific vault',
        method: 'GET',
        endpoint: '/vaults/{vaultId}',
        implemented: false,
        category: 'Vaults',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
        ],
      },

      // Items
      {
        id: 'list-items',
        name: 'List Items',
        description: 'List items in a vault (metadata only)',
        method: 'GET',
        endpoint: '/vaults/{vaultId}/items',
        implemented: true,
        category: 'Items',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
          { name: 'filter', type: 'string', required: false, description: 'Filter by title or tag (e.g., title eq "GitHub")' },
        ],
        documentationUrl: 'https://developer.1password.com/docs/connect/connect-api-reference/#list-items',
      },
      {
        id: 'get-item',
        name: 'Get Item',
        description: 'Get full item details including fields (excludes concealed values by default)',
        method: 'GET',
        endpoint: '/vaults/{vaultId}/items/{itemId}',
        implemented: false,
        category: 'Items',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
          { name: 'itemId', type: 'string', required: true, description: 'Item UUID' },
        ],
      },
      {
        id: 'create-item',
        name: 'Create Item',
        description: 'Create a new item in a vault',
        method: 'POST',
        endpoint: '/vaults/{vaultId}/items',
        implemented: false,
        category: 'Items',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
          { name: 'title', type: 'string', required: true, description: 'Item title' },
          { name: 'category', type: 'string', required: true, description: 'Item category (LOGIN, SECURE_NOTE, etc.)' },
          { name: 'tags', type: 'array', required: false, description: 'Tags for the item' },
        ],
      },
      {
        id: 'update-item',
        name: 'Update Item',
        description: 'Update an existing item',
        method: 'PUT',
        endpoint: '/vaults/{vaultId}/items/{itemId}',
        implemented: false,
        category: 'Items',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
          { name: 'itemId', type: 'string', required: true, description: 'Item UUID' },
        ],
      },
      {
        id: 'patch-item',
        name: 'Patch Item',
        description: 'Partially update an item',
        method: 'PATCH',
        endpoint: '/vaults/{vaultId}/items/{itemId}',
        implemented: false,
        category: 'Items',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
          { name: 'itemId', type: 'string', required: true, description: 'Item UUID' },
        ],
      },
      {
        id: 'delete-item',
        name: 'Delete Item',
        description: 'Move an item to the trash',
        method: 'DELETE',
        endpoint: '/vaults/{vaultId}/items/{itemId}',
        implemented: false,
        category: 'Items',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
          { name: 'itemId', type: 'string', required: true, description: 'Item UUID' },
        ],
      },

      // Files (Connect Server)
      {
        id: 'list-files',
        name: 'List Files',
        description: 'List files attached to an item',
        method: 'GET',
        endpoint: '/vaults/{vaultId}/items/{itemId}/files',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
          { name: 'itemId', type: 'string', required: true, description: 'Item UUID' },
        ],
      },
      {
        id: 'get-file',
        name: 'Get File Content',
        description: 'Download file content from an item',
        method: 'GET',
        endpoint: '/vaults/{vaultId}/items/{itemId}/files/{fileId}/content',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'vaultId', type: 'string', required: true, description: 'Vault UUID' },
          { name: 'itemId', type: 'string', required: true, description: 'Item UUID' },
          { name: 'fileId', type: 'string', required: true, description: 'File UUID' },
        ],
      },

      // Activity (Connect Server only)
      {
        id: 'get-activity',
        name: 'Get Activity',
        description: 'Get recent vault activity (Connect Server only)',
        method: 'GET',
        endpoint: '/activity',
        implemented: true,
        category: 'Activity',
        parameters: [
          { name: 'limit', type: 'number', required: false, description: 'Maximum number of activities to return' },
          { name: 'startTime', type: 'string', required: false, description: 'Start time for activity filter (ISO 8601)' },
        ],
      },

      // API Requests (Connect Server)
      {
        id: 'get-api-requests',
        name: 'Get API Requests',
        description: 'Get recent API request logs (Connect Server only)',
        method: 'GET',
        endpoint: '/api-requests',
        implemented: false,
        category: 'Activity',
      },

      // Metrics (Connect Server)
      {
        id: 'get-metrics',
        name: 'Get Metrics',
        description: 'Get Prometheus metrics (Connect Server only)',
        method: 'GET',
        endpoint: '/metrics',
        implemented: false,
        category: 'Metrics',
      },
    ];
  }
}
