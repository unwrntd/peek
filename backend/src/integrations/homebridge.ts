import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  HomebridgeConfig,
  HomebridgeStatus,
  HomebridgeServerInfo,
  HomebridgeCpuInfo,
  HomebridgeRamInfo,
  HomebridgeAccessory,
  HomebridgePlugin,
  HomebridgeCombinedStatus,
} from '../types';
import { logger } from '../services/logger';

// Token cache for JWT tokens
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}
const tokenCache = new Map<string, TokenCache>();

export class HomebridgeIntegration extends BaseIntegration {
  readonly type = 'homebridge';
  readonly name = 'Homebridge';

  private getBaseUrl(config: HomebridgeConfig): string {
    const protocol = config.verifySSL === false ? 'http' : 'https';
    // Default to http if no SSL preference specified (most common for local Homebridge)
    const useProtocol = config.verifySSL === true ? 'https' : 'http';
    return `${useProtocol}://${config.host}:${config.port}`;
  }

  private getCacheKey(config: HomebridgeConfig): string {
    return `hb_${config.host}_${config.port}_${config.username}`;
  }

  private async getAccessToken(config: HomebridgeConfig): Promise<string> {
    const cacheKey = this.getCacheKey(config);
    const cached = tokenCache.get(cacheKey);

    // Return cached token if valid (5 min buffer)
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.accessToken;
    }

    // Login to get new token
    try {
      const response = await axios.post(
        `${this.getBaseUrl(config)}/api/auth/login`,
        {
          username: config.username,
          password: config.password,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          httpsAgent: new https.Agent({
            rejectUnauthorized: config.verifySSL ?? false,
          }),
          timeout: 30000,
        }
      );

      const { access_token, expires_in } = response.data;

      tokenCache.set(cacheKey, {
        accessToken: access_token,
        expiresAt: Date.now() + (expires_in || 28800) * 1000,
      });

      logger.debug('homebridge', 'Obtained new access token');
      return access_token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('homebridge', 'Failed to get access token', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  private async createClient(config: HomebridgeConfig): Promise<AxiosInstance> {
    const token = await this.getAccessToken(config);
    return axios.create({
      baseURL: this.getBaseUrl(config),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const hbConfig = config as HomebridgeConfig;

    if (!hbConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!hbConfig.username) {
      return { success: false, message: 'Username is required' };
    }
    if (!hbConfig.password) {
      return { success: false, message: 'Password is required' };
    }

    try {
      const client = await this.createClient(hbConfig);

      // Get server status - endpoints are under /api prefix
      const [statusRes, serverInfoRes] = await Promise.all([
        client.get('/api/status/homebridge'),
        client.get('/api/status/server-information'),
      ]);

      const status = statusRes.data as HomebridgeStatus;
      const serverInfo = serverInfoRes.data as HomebridgeServerInfo;

      return {
        success: true,
        message: `Connected to ${status.name || 'Homebridge'} v${status.packageVersion}`,
        details: {
          name: status.name,
          version: status.packageVersion,
          nodeVersion: serverInfo.nodeVersion,
          insecureMode: serverInfo.homebridgeInsecureMode,
          status: status.status,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('homebridge', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return { success: false, message: 'Authentication failed: Invalid username or password' };
        }
        if (error.code === 'ECONNREFUSED') {
          return { success: false, message: `Connection refused. Is Homebridge running on ${hbConfig.host}:${hbConfig.port}?` };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
          return { success: false, message: `Cannot reach ${hbConfig.host}:${hbConfig.port}` };
        }
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const hbConfig = config as HomebridgeConfig;
    const client = await this.createClient(hbConfig);

    switch (metric) {
      case 'status':
        return this.getStatus(client);
      case 'accessories':
        return this.getAccessories(client);
      case 'plugins':
        return this.getPlugins(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatus(client: AxiosInstance): Promise<{ status: HomebridgeCombinedStatus }> {
    try {
      const [statusRes, serverInfoRes, versionRes, cpuRes, ramRes] = await Promise.all([
        client.get('/api/status/homebridge'),
        client.get('/api/status/server-information'),
        client.get('/api/status/homebridge-version').catch(() => ({ data: { installedVersion: 'unknown' } })),
        client.get('/api/status/cpu').catch(() => ({ data: { currentLoad: 0 } })),
        client.get('/api/status/ram').catch(() => ({ data: { mem: { total: 0, used: 0, free: 0 } } })),
      ]);

      const serverInfo = serverInfoRes.data as HomebridgeServerInfo;
      const versionInfo = versionRes.data;

      // Merge status data with version info
      const status: HomebridgeStatus = {
        ...statusRes.data,
        packageVersion: versionInfo.installedVersion || 'unknown',
        name: serverInfo.os?.hostname || 'Homebridge',
      };

      return {
        status: {
          status,
          serverInfo,
          cpu: cpuRes.data as HomebridgeCpuInfo,
          ram: ramRes.data as HomebridgeRamInfo,
          insecureMode: serverInfo.homebridgeInsecureMode,
        },
      };
    } catch (error) {
      logger.error('homebridge', 'Failed to get status', { error });
      throw error;
    }
  }

  private async getAccessories(client: AxiosInstance): Promise<{ accessories: HomebridgeAccessory[]; insecureMode: boolean }> {
    try {
      // First check if insecure mode is enabled
      const serverInfoRes = await client.get('/api/status/server-information');
      const serverInfo = serverInfoRes.data as HomebridgeServerInfo;

      if (!serverInfo.homebridgeInsecureMode) {
        logger.debug('homebridge', 'Insecure mode not enabled, accessories not available');
        return { accessories: [], insecureMode: false };
      }

      const accessoriesRes = await client.get('/api/accessories');
      const accessories = accessoriesRes.data as HomebridgeAccessory[];

      return { accessories, insecureMode: true };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        logger.debug('homebridge', 'Accessories endpoint forbidden - insecure mode may be disabled');
        return { accessories: [], insecureMode: false };
      }
      logger.error('homebridge', 'Failed to get accessories', { error });
      throw error;
    }
  }

  private async getPlugins(client: AxiosInstance): Promise<{ plugins: HomebridgePlugin[] }> {
    try {
      const response = await client.get('/api/plugins');
      const plugins = response.data as HomebridgePlugin[];

      return { plugins };
    } catch (error) {
      logger.error('homebridge', 'Failed to get plugins', { error });
      throw error;
    }
  }

  // Control an accessory characteristic
  async setAccessoryCharacteristic(
    config: IntegrationConfig,
    uniqueId: string,
    characteristicType: string,
    value: string | number | boolean
  ): Promise<void> {
    const hbConfig = config as HomebridgeConfig;
    const client = await this.createClient(hbConfig);

    try {
      await client.put(`/api/accessories/${uniqueId}`, {
        characteristicType,
        value,
      });
      logger.debug('homebridge', `Set ${characteristicType} to ${value} for ${uniqueId}`);
    } catch (error) {
      logger.error('homebridge', 'Failed to set accessory characteristic', { error, uniqueId, characteristicType });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Homebridge server status, versions, CPU, and RAM',
        widgetTypes: ['homebridge-status'],
      },
      {
        id: 'accessories',
        name: 'Accessories',
        description: 'All HomeKit accessories (requires insecure mode)',
        widgetTypes: ['homebridge-accessories', 'homebridge-accessory-control'],
      },
      {
        id: 'plugins',
        name: 'Plugins',
        description: 'Installed Homebridge plugins',
        widgetTypes: ['homebridge-plugins'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-login',
        name: 'Login',
        description: 'Authenticate and obtain JWT access token',
        method: 'POST',
        endpoint: '/api/auth/login',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
          { name: 'otp', type: 'string', required: false, description: 'One-time password for 2FA' },
        ],
        documentationUrl: 'https://github.com/homebridge/homebridge-config-ui-x/wiki/API-Reference',
      },
      {
        id: 'auth-logout',
        name: 'Logout',
        description: 'Invalidate the current access token',
        method: 'POST',
        endpoint: '/api/auth/logout',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-token-refresh',
        name: 'Refresh Token',
        description: 'Refresh the JWT access token',
        method: 'POST',
        endpoint: '/api/auth/token/refresh',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-check',
        name: 'Check Auth',
        description: 'Check if authentication is required',
        method: 'GET',
        endpoint: '/api/auth/check',
        implemented: false,
        category: 'Authentication',
      },

      // Server Status - Implemented
      {
        id: 'status-homebridge',
        name: 'Get Homebridge Status',
        description: 'Get Homebridge service status and basic info',
        method: 'GET',
        endpoint: '/api/status/homebridge',
        implemented: true,
        category: 'Status',
        documentationUrl: 'https://github.com/homebridge/homebridge-config-ui-x/wiki/API-Reference',
      },
      {
        id: 'status-server-info',
        name: 'Get Server Information',
        description: 'Get server hardware, OS, and configuration details',
        method: 'GET',
        endpoint: '/api/status/server-information',
        implemented: true,
        category: 'Status',
      },
      {
        id: 'status-homebridge-version',
        name: 'Get Homebridge Version',
        description: 'Get installed Homebridge version information',
        method: 'GET',
        endpoint: '/api/status/homebridge-version',
        implemented: true,
        category: 'Status',
      },
      {
        id: 'status-cpu',
        name: 'Get CPU Usage',
        description: 'Get current CPU load and usage statistics',
        method: 'GET',
        endpoint: '/api/status/cpu',
        implemented: true,
        category: 'Status',
      },
      {
        id: 'status-ram',
        name: 'Get RAM Usage',
        description: 'Get current memory usage statistics',
        method: 'GET',
        endpoint: '/api/status/ram',
        implemented: true,
        category: 'Status',
      },
      {
        id: 'status-network',
        name: 'Get Network Info',
        description: 'Get network interfaces and statistics',
        method: 'GET',
        endpoint: '/api/status/network',
        implemented: false,
        category: 'Status',
      },
      {
        id: 'status-uptime',
        name: 'Get System Uptime',
        description: 'Get system and Homebridge uptime',
        method: 'GET',
        endpoint: '/api/status/uptime',
        implemented: false,
        category: 'Status',
      },
      {
        id: 'status-node-version',
        name: 'Get Node.js Version',
        description: 'Get Node.js version information',
        method: 'GET',
        endpoint: '/api/status/node-version',
        implemented: false,
        category: 'Status',
      },

      // Accessories - Implemented
      {
        id: 'accessories-list',
        name: 'List Accessories',
        description: 'Get all HomeKit accessories (requires insecure mode)',
        method: 'GET',
        endpoint: '/api/accessories',
        implemented: true,
        category: 'Accessories',
        documentationUrl: 'https://github.com/homebridge/homebridge-config-ui-x/wiki/API-Reference',
      },
      {
        id: 'accessories-get',
        name: 'Get Accessory',
        description: 'Get a specific accessory by unique ID',
        method: 'GET',
        endpoint: '/api/accessories/{uniqueId}',
        implemented: false,
        category: 'Accessories',
        parameters: [
          { name: 'uniqueId', type: 'string', required: true, description: 'Unique accessory identifier' },
        ],
      },
      {
        id: 'accessories-set-characteristic',
        name: 'Set Accessory Characteristic',
        description: 'Control an accessory by setting a characteristic value',
        method: 'PUT',
        endpoint: '/api/accessories/{uniqueId}',
        implemented: true,
        category: 'Accessories',
        parameters: [
          { name: 'uniqueId', type: 'string', required: true, description: 'Unique accessory identifier' },
          { name: 'characteristicType', type: 'string', required: true, description: 'Characteristic type (On, Brightness, etc.)' },
          { name: 'value', type: 'string|number|boolean', required: true, description: 'Value to set' },
        ],
      },
      {
        id: 'accessories-layout',
        name: 'Get Accessory Layout',
        description: 'Get the accessory room layout configuration',
        method: 'GET',
        endpoint: '/api/accessories/layout',
        implemented: false,
        category: 'Accessories',
      },
      {
        id: 'accessories-layout-set',
        name: 'Set Accessory Layout',
        description: 'Update the accessory room layout configuration',
        method: 'POST',
        endpoint: '/api/accessories/layout',
        implemented: false,
        category: 'Accessories',
      },

      // Plugins - Implemented
      {
        id: 'plugins-list',
        name: 'List Plugins',
        description: 'Get all installed Homebridge plugins',
        method: 'GET',
        endpoint: '/api/plugins',
        implemented: true,
        category: 'Plugins',
        documentationUrl: 'https://github.com/homebridge/homebridge-config-ui-x/wiki/API-Reference',
      },
      {
        id: 'plugins-search',
        name: 'Search Plugins',
        description: 'Search for plugins on NPM',
        method: 'GET',
        endpoint: '/api/plugins/search/{query}',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
        ],
      },
      {
        id: 'plugins-lookup',
        name: 'Lookup Plugin',
        description: 'Get details for a specific plugin from NPM',
        method: 'GET',
        endpoint: '/api/plugins/lookup/{pluginName}',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin package name' },
        ],
      },
      {
        id: 'plugins-config-schema',
        name: 'Get Plugin Config Schema',
        description: 'Get the configuration schema for a plugin',
        method: 'GET',
        endpoint: '/api/plugins/config-schema/{pluginName}',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin package name' },
        ],
      },
      {
        id: 'plugins-changelog',
        name: 'Get Plugin Changelog',
        description: 'Get the changelog for a plugin',
        method: 'GET',
        endpoint: '/api/plugins/changelog/{pluginName}',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin package name' },
        ],
      },
      {
        id: 'plugins-install',
        name: 'Install Plugin',
        description: 'Install a plugin from NPM',
        method: 'POST',
        endpoint: '/api/plugins/install/{pluginName}',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin package name' },
          { name: 'version', type: 'string', required: false, description: 'Specific version to install' },
        ],
      },
      {
        id: 'plugins-uninstall',
        name: 'Uninstall Plugin',
        description: 'Uninstall a plugin',
        method: 'DELETE',
        endpoint: '/api/plugins/uninstall/{pluginName}',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin package name' },
        ],
      },
      {
        id: 'plugins-update',
        name: 'Update Plugin',
        description: 'Update a plugin to the latest version',
        method: 'PUT',
        endpoint: '/api/plugins/update/{pluginName}',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin package name' },
        ],
      },

      // Configuration
      {
        id: 'config-get',
        name: 'Get Configuration',
        description: 'Get the Homebridge config.json',
        method: 'GET',
        endpoint: '/api/config-editor',
        implemented: false,
        category: 'Configuration',
      },
      {
        id: 'config-update',
        name: 'Update Configuration',
        description: 'Update the Homebridge config.json',
        method: 'POST',
        endpoint: '/api/config-editor',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'config', type: 'object', required: true, description: 'Full config.json content' },
        ],
      },
      {
        id: 'config-plugin-get',
        name: 'Get Plugin Config',
        description: 'Get configuration for a specific plugin',
        method: 'GET',
        endpoint: '/api/config-editor/plugin/{pluginName}',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin package name' },
        ],
      },
      {
        id: 'config-plugin-update',
        name: 'Update Plugin Config',
        description: 'Update configuration for a specific plugin',
        method: 'POST',
        endpoint: '/api/config-editor/plugin/{pluginName}',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin package name' },
          { name: 'config', type: 'array', required: true, description: 'Plugin configuration blocks' },
        ],
      },

      // Server Control
      {
        id: 'server-restart',
        name: 'Restart Homebridge',
        description: 'Restart the Homebridge service',
        method: 'PUT',
        endpoint: '/api/server/restart',
        implemented: false,
        category: 'Server Control',
      },
      {
        id: 'server-qrcode',
        name: 'Get Pairing QR Code',
        description: 'Get the HomeKit pairing QR code',
        method: 'GET',
        endpoint: '/api/server/qrcode.svg',
        implemented: false,
        category: 'Server Control',
      },
      {
        id: 'server-pairing',
        name: 'Get Pairing Info',
        description: 'Get the HomeKit pairing code and setup ID',
        method: 'GET',
        endpoint: '/api/server/pairing',
        implemented: false,
        category: 'Server Control',
      },
      {
        id: 'server-reset-homebridge',
        name: 'Reset Homebridge Accessory',
        description: 'Reset the Homebridge accessory (unpair from HomeKit)',
        method: 'PUT',
        endpoint: '/api/server/reset-homebridge-accessory',
        implemented: false,
        category: 'Server Control',
      },
      {
        id: 'server-reset-cache',
        name: 'Reset Cached Accessories',
        description: 'Clear the cached accessories file',
        method: 'PUT',
        endpoint: '/api/server/reset-cached-accessories',
        implemented: false,
        category: 'Server Control',
      },
      {
        id: 'server-cached-accessories',
        name: 'Get Cached Accessories',
        description: 'Get list of cached accessories',
        method: 'GET',
        endpoint: '/api/server/cached-accessories',
        implemented: false,
        category: 'Server Control',
      },
      {
        id: 'server-cached-accessories-delete',
        name: 'Delete Cached Accessory',
        description: 'Remove a specific accessory from cache',
        method: 'DELETE',
        endpoint: '/api/server/cached-accessories/{uuid}',
        implemented: false,
        category: 'Server Control',
        parameters: [
          { name: 'uuid', type: 'string', required: true, description: 'Accessory UUID' },
        ],
      },

      // Child Bridges
      {
        id: 'child-bridges-list',
        name: 'List Child Bridges',
        description: 'Get all child bridge instances',
        method: 'GET',
        endpoint: '/api/status/homebridge/child-bridges',
        implemented: false,
        category: 'Child Bridges',
      },
      {
        id: 'child-bridges-restart',
        name: 'Restart Child Bridge',
        description: 'Restart a specific child bridge',
        method: 'PUT',
        endpoint: '/api/server/restart/{deviceId}',
        implemented: false,
        category: 'Child Bridges',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Child bridge device ID' },
        ],
      },
      {
        id: 'child-bridges-stop',
        name: 'Stop Child Bridge',
        description: 'Stop a specific child bridge',
        method: 'PUT',
        endpoint: '/api/server/stop/{deviceId}',
        implemented: false,
        category: 'Child Bridges',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Child bridge device ID' },
        ],
      },
      {
        id: 'child-bridges-start',
        name: 'Start Child Bridge',
        description: 'Start a specific child bridge',
        method: 'PUT',
        endpoint: '/api/server/start/{deviceId}',
        implemented: false,
        category: 'Child Bridges',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Child bridge device ID' },
        ],
      },

      // Backup
      {
        id: 'backup-download',
        name: 'Download Backup',
        description: 'Download a full Homebridge backup archive',
        method: 'GET',
        endpoint: '/api/backup/download',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'backup-restore',
        name: 'Restore Backup',
        description: 'Restore Homebridge from a backup archive',
        method: 'POST',
        endpoint: '/api/backup/restore',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'backup-scheduled-list',
        name: 'List Scheduled Backups',
        description: 'Get list of automated backup archives',
        method: 'GET',
        endpoint: '/api/backup/scheduled-backups',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'backup-scheduled-download',
        name: 'Download Scheduled Backup',
        description: 'Download a specific scheduled backup',
        method: 'GET',
        endpoint: '/api/backup/scheduled-backups/{backupId}',
        implemented: false,
        category: 'Backup',
        parameters: [
          { name: 'backupId', type: 'string', required: true, description: 'Backup archive ID' },
        ],
      },
      {
        id: 'backup-hbfx',
        name: 'Get HBFX Export',
        description: 'Get Homebridge configuration export in HBFX format',
        method: 'GET',
        endpoint: '/api/backup/hbfx/download',
        implemented: false,
        category: 'Backup',
      },

      // Users
      {
        id: 'users-list',
        name: 'List Users',
        description: 'Get all UI user accounts',
        method: 'GET',
        endpoint: '/api/users',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'users-create',
        name: 'Create User',
        description: 'Create a new UI user account',
        method: 'POST',
        endpoint: '/api/users',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
          { name: 'name', type: 'string', required: false, description: 'Display name' },
          { name: 'admin', type: 'boolean', required: false, description: 'Admin privileges' },
        ],
      },
      {
        id: 'users-update',
        name: 'Update User',
        description: 'Update a UI user account',
        method: 'PATCH',
        endpoint: '/api/users/{userId}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'integer', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'users-delete',
        name: 'Delete User',
        description: 'Delete a UI user account',
        method: 'DELETE',
        endpoint: '/api/users/{userId}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'integer', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'users-2fa-setup',
        name: 'Setup 2FA',
        description: 'Enable two-factor authentication for a user',
        method: 'POST',
        endpoint: '/api/users/{userId}/otp/setup',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'integer', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'users-2fa-activate',
        name: 'Activate 2FA',
        description: 'Activate two-factor authentication with verification code',
        method: 'POST',
        endpoint: '/api/users/{userId}/otp/activate',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'integer', required: true, description: 'User ID' },
          { name: 'code', type: 'string', required: true, description: 'Verification code' },
        ],
      },
      {
        id: 'users-2fa-deactivate',
        name: 'Deactivate 2FA',
        description: 'Disable two-factor authentication for a user',
        method: 'POST',
        endpoint: '/api/users/{userId}/otp/deactivate',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'integer', required: true, description: 'User ID' },
        ],
      },

      // Logs
      {
        id: 'logs-download',
        name: 'Download Logs',
        description: 'Download the Homebridge log file',
        method: 'GET',
        endpoint: '/api/platform-tools/hb-service/log/download',
        implemented: false,
        category: 'Logs',
      },
      {
        id: 'logs-truncate',
        name: 'Truncate Logs',
        description: 'Clear the Homebridge log file',
        method: 'PUT',
        endpoint: '/api/platform-tools/hb-service/log/truncate',
        implemented: false,
        category: 'Logs',
      },

      // Platform Tools
      {
        id: 'platform-linux-startup',
        name: 'Get Startup Script (Linux)',
        description: 'Get the Linux startup configuration',
        method: 'GET',
        endpoint: '/api/platform-tools/linux/startup-script',
        implemented: false,
        category: 'Platform Tools',
      },
      {
        id: 'platform-docker-startup',
        name: 'Get Startup Script (Docker)',
        description: 'Get the Docker startup configuration',
        method: 'GET',
        endpoint: '/api/platform-tools/docker/startup-script',
        implemented: false,
        category: 'Platform Tools',
      },
      {
        id: 'platform-terminal',
        name: 'Terminal Access',
        description: 'WebSocket endpoint for terminal access',
        method: 'GET',
        endpoint: '/api/platform-tools/terminal',
        implemented: false,
        category: 'Platform Tools',
      },
    ];
  }
}
