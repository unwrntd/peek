import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  TailscaleConfig,
  TailscaleDevice,
  TailscaleUser,
  TailscaleDNSNameservers,
  TailscaleDNSPreferences,
  TailscaleDNSSearchPaths,
  TailscaleAuthKey,
  TailscaleACL,
  TailscaleWebhook,
  TailscaleOverview,
  TailscaleRoute,
  TailscaleDNS,
} from '../types';
import { logger } from '../services/logger';

// OAuth token cache
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

const tokenCache: Map<string, TokenCache> = new Map();

export class TailscaleIntegration extends BaseIntegration {
  readonly type = 'tailscale';
  readonly name = 'Tailscale';

  private async getAccessToken(config: TailscaleConfig): Promise<string> {
    // Detect auth method based on provided fields
    const hasApiKey = !!config.apiKey;
    const hasOAuth = !!(config.clientId && config.clientSecret);

    if (hasApiKey) {
      // API key is used directly as HTTP Basic Auth
      return config.apiKey!;
    }

    if (hasOAuth) {
      // Check cache
      const cacheKey = `${config.clientId}:${config.clientSecret}`;
      const cached = tokenCache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now() + 60000) {
        // Return cached token if still valid (with 1 minute buffer)
        return cached.accessToken;
      }

      // Request new OAuth token
      const response = await axios.post(
        'https://api.tailscale.com/api/v2/oauth/token',
        new URLSearchParams({
          client_id: config.clientId!,
          client_secret: config.clientSecret!,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600; // Default 1 hour

      // Cache the token
      tokenCache.set(cacheKey, {
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      return accessToken;
    }

    throw new Error('Invalid authentication configuration');
  }

  private async createClient(config: TailscaleConfig): Promise<AxiosInstance> {
    const token = await this.getAccessToken(config);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Detect auth method based on provided fields
    const hasApiKey = !!config.apiKey;

    if (hasApiKey) {
      // API key uses HTTP Basic Auth (key as username, empty password)
      const basicAuth = Buffer.from(`${token}:`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    } else {
      // OAuth uses Bearer token
      headers['Authorization'] = `Bearer ${token}`;
    }

    return axios.create({
      baseURL: 'https://api.tailscale.com/api/v2',
      headers,
      timeout: 15000,
    });
  }

  private getTailnet(config: TailscaleConfig): string {
    // Use provided tailnet or default to "-" for personal tailnets
    return config.tailnet || '-';
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const tsConfig = config as TailscaleConfig;

    try {
      const client = await this.createClient(tsConfig);
      const tailnet = this.getTailnet(tsConfig);

      // Get devices to verify connection
      const devicesResponse = await client.get(`/tailnet/${tailnet}/devices`);
      const devices = devicesResponse.data.devices || [];

      // Count online devices
      const onlineCount = devices.filter((d: TailscaleDevice) => !d.lastSeen).length;

      return {
        success: true,
        message: `Connected to tailnet. ${devices.length} devices (${onlineCount} online)`,
        details: {
          totalDevices: devices.length,
          onlineDevices: onlineCount,
          tailnet: tailnet === '-' ? 'Personal' : tailnet,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('tailscale', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Invalid credentials. Please check your API key or OAuth client settings.',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Access forbidden. Token may lack required scopes.',
          };
        }
        if (error.response?.status === 404) {
          return {
            success: false,
            message: 'Tailnet not found. Check your tailnet name.',
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
    const tsConfig = config as TailscaleConfig;
    const client = await this.createClient(tsConfig);
    const tailnet = this.getTailnet(tsConfig);

    switch (metric) {
      case 'overview':
        return this.getOverview(client, tailnet);
      case 'devices':
        return this.getDevices(client, tailnet);
      case 'users':
        return this.getUsers(client, tailnet);
      case 'dns':
        return this.getDNS(client, tailnet);
      case 'acl':
        return this.getACL(client, tailnet);
      case 'auth-keys':
        return this.getAuthKeys(client, tailnet);
      case 'routes':
        return this.getRoutes(client, tailnet);
      case 'webhooks':
        return this.getWebhooks(client, tailnet);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getOverview(client: AxiosInstance, tailnet: string): Promise<{ overview: TailscaleOverview; [key: string]: unknown }> {
    try {
      // Fetch devices
      const devicesResponse = await client.get(`/tailnet/${tailnet}/devices`);
      const devices: TailscaleDevice[] = devicesResponse.data.devices || [];

      // Count online/offline devices
      const onlineDevices = devices.filter(d => !d.lastSeen).length;
      const offlineDevices = devices.length - onlineDevices;

      // Count subnet routers and exit nodes
      let subnetRouters = 0;
      let exitNodes = 0;
      for (const device of devices) {
        const routes = device.enabledRoutes || [];
        if (routes.some(r => r === '0.0.0.0/0' || r === '::/0')) {
          exitNodes++;
        } else if (routes.length > 0) {
          subnetRouters++;
        }
      }

      // Fetch users
      let totalUsers = 0;
      try {
        const usersResponse = await client.get(`/tailnet/${tailnet}/users`);
        totalUsers = (usersResponse.data.users || []).length;
      } catch {
        // Users endpoint may not be available with all scopes
        logger.debug('tailscale', 'Could not fetch users count');
      }

      // Fetch DNS preferences for MagicDNS status
      let magicDNSEnabled = false;
      try {
        const dnsPrefsResponse = await client.get(`/tailnet/${tailnet}/dns/preferences`);
        magicDNSEnabled = dnsPrefsResponse.data.magicDNS || false;
      } catch {
        logger.debug('tailscale', 'Could not fetch DNS preferences');
      }

      // Fetch auth keys for expiring keys count
      let expiringKeys = 0;
      try {
        const keysResponse = await client.get(`/tailnet/${tailnet}/keys`);
        const keys: TailscaleAuthKey[] = keysResponse.data.keys || [];
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        expiringKeys = keys.filter(k => {
          const expires = new Date(k.expires).getTime();
          return expires > now && expires < now + oneDay && !k.revoked;
        }).length;
      } catch {
        logger.debug('tailscale', 'Could not fetch auth keys');
      }

      // Count pending approvals (unauthorized devices)
      const pendingApprovals = devices.filter(d => !d.authorized).length;

      const overview: TailscaleOverview = {
        tailnetName: tailnet === '-' ? 'Personal' : tailnet,
        totalDevices: devices.length,
        onlineDevices,
        offlineDevices,
        totalUsers,
        pendingApprovals,
        expiringKeys,
        subnetRouters,
        exitNodes,
        magicDNSEnabled,
      };

      logger.debug('tailscale', 'Fetched overview', { devices: devices.length, users: totalUsers });
      return { overview };
    } catch (error) {
      logger.error('tailscale', 'Failed to fetch overview', { error: String(error) });
      throw error;
    }
  }

  private async getDevices(client: AxiosInstance, tailnet: string): Promise<{ devices: TailscaleDevice[]; [key: string]: unknown }> {
    try {
      const response = await client.get(`/tailnet/${tailnet}/devices`);
      const devices: TailscaleDevice[] = response.data.devices || [];

      logger.debug('tailscale', `Fetched ${devices.length} devices`);
      return { devices };
    } catch (error) {
      logger.error('tailscale', 'Failed to fetch devices', { error: String(error) });
      return { devices: [] };
    }
  }

  private async getUsers(client: AxiosInstance, tailnet: string): Promise<{ users: TailscaleUser[]; [key: string]: unknown }> {
    try {
      const response = await client.get(`/tailnet/${tailnet}/users`);
      const users: TailscaleUser[] = response.data.users || [];

      // Enrich with device counts (already included in API response for some users)
      logger.debug('tailscale', `Fetched ${users.length} users`);
      return { users };
    } catch (error) {
      logger.error('tailscale', 'Failed to fetch users', { error: String(error) });
      return { users: [] };
    }
  }

  private async getDNS(client: AxiosInstance, tailnet: string): Promise<{ dns: TailscaleDNS; [key: string]: unknown }> {
    try {
      // Fetch all DNS settings in parallel
      const [nameserversRes, preferencesRes, searchPathsRes] = await Promise.all([
        client.get(`/tailnet/${tailnet}/dns/nameservers`).catch(() => ({ data: { dns: [] } })),
        client.get(`/tailnet/${tailnet}/dns/preferences`).catch(() => ({ data: { magicDNS: false } })),
        client.get(`/tailnet/${tailnet}/dns/searchpaths`).catch(() => ({ data: { searchPaths: [] } })),
      ]);

      const dns: TailscaleDNS = {
        nameservers: (nameserversRes.data as TailscaleDNSNameservers).dns || [],
        magicDNS: (preferencesRes.data as TailscaleDNSPreferences).magicDNS || false,
        searchPaths: (searchPathsRes.data as TailscaleDNSSearchPaths).searchPaths || [],
      };

      logger.debug('tailscale', 'Fetched DNS settings', {
        nameservers: dns.nameservers.length,
        magicDNS: dns.magicDNS,
      });
      return { dns };
    } catch (error) {
      logger.error('tailscale', 'Failed to fetch DNS settings', { error: String(error) });
      return { dns: { nameservers: [], magicDNS: false, searchPaths: [] } };
    }
  }

  private async getACL(client: AxiosInstance, tailnet: string): Promise<{ acl: TailscaleACL | null; summary: Record<string, unknown>; [key: string]: unknown }> {
    try {
      const response = await client.get(`/tailnet/${tailnet}/acl`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      const acl = response.data as TailscaleACL;

      // Create summary for widget display
      const summary = {
        aclRules: acl.acls?.length || 0,
        groups: Object.keys(acl.groups || {}).length,
        tagOwners: Object.keys(acl.tagOwners || {}).length,
        sshRules: acl.ssh?.length || 0,
        tests: acl.tests?.length || 0,
        hasAutoApprovers: !!(acl.autoApprovers?.routes || acl.autoApprovers?.exitNode),
      };

      logger.debug('tailscale', 'Fetched ACL', { rules: summary.aclRules, groups: summary.groups });
      return { acl, summary };
    } catch (error) {
      logger.error('tailscale', 'Failed to fetch ACL', { error: String(error) });
      return { acl: null, summary: {} };
    }
  }

  private async getAuthKeys(client: AxiosInstance, tailnet: string): Promise<{ keys: TailscaleAuthKey[]; [key: string]: unknown }> {
    try {
      const response = await client.get(`/tailnet/${tailnet}/keys`);
      const keys: TailscaleAuthKey[] = response.data.keys || [];

      logger.debug('tailscale', `Fetched ${keys.length} auth keys`);
      return { keys };
    } catch (error) {
      logger.error('tailscale', 'Failed to fetch auth keys', { error: String(error) });
      return { keys: [] };
    }
  }

  private async getRoutes(client: AxiosInstance, tailnet: string): Promise<{ routes: TailscaleRoute[]; [key: string]: unknown }> {
    try {
      // Get all devices and extract their routes
      const devicesResponse = await client.get(`/tailnet/${tailnet}/devices`);
      const devices: TailscaleDevice[] = devicesResponse.data.devices || [];

      const routes: TailscaleRoute[] = [];
      let routeId = 0;

      for (const device of devices) {
        // Process advertised routes
        const advertised = device.advertisedRoutes || [];
        const enabled = device.enabledRoutes || [];

        for (const route of advertised) {
          const isExitNode = route === '0.0.0.0/0' || route === '::/0';
          routes.push({
            id: `route-${routeId++}`,
            deviceId: device.id,
            deviceName: device.name || device.hostname,
            route,
            type: isExitNode ? 'exit' : 'subnet',
            enabled: enabled.includes(route),
            approved: enabled.includes(route),
          });
        }
      }

      logger.debug('tailscale', `Fetched ${routes.length} routes from ${devices.length} devices`);
      return { routes };
    } catch (error) {
      logger.error('tailscale', 'Failed to fetch routes', { error: String(error) });
      return { routes: [] };
    }
  }

  private async getWebhooks(client: AxiosInstance, tailnet: string): Promise<{ webhooks: TailscaleWebhook[]; [key: string]: unknown }> {
    try {
      const response = await client.get(`/tailnet/${tailnet}/webhooks`);
      const webhooks: TailscaleWebhook[] = response.data.webhooks || [];

      logger.debug('tailscale', `Fetched ${webhooks.length} webhooks`);
      return { webhooks };
    } catch (error) {
      logger.error('tailscale', 'Failed to fetch webhooks', { error: String(error) });
      return { webhooks: [] };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'overview',
        name: 'Network Overview',
        description: 'Tailnet summary with device and user counts',
        widgetTypes: ['tailscale-overview'],
      },
      {
        id: 'devices',
        name: 'Devices',
        description: 'All devices with status, addresses, and routes',
        widgetTypes: ['tailscale-devices'],
      },
      {
        id: 'users',
        name: 'Users',
        description: 'Users in the tailnet with roles and status',
        widgetTypes: ['tailscale-users'],
      },
      {
        id: 'dns',
        name: 'DNS Settings',
        description: 'DNS configuration including MagicDNS and nameservers',
        widgetTypes: ['tailscale-dns'],
      },
      {
        id: 'acl',
        name: 'Access Control',
        description: 'ACL policy summary with rules and groups',
        widgetTypes: ['tailscale-acl'],
      },
      {
        id: 'auth-keys',
        name: 'Auth Keys',
        description: 'Authentication keys with expiry and settings',
        widgetTypes: ['tailscale-keys'],
      },
      {
        id: 'routes',
        name: 'Routes & Exit Nodes',
        description: 'Subnet routes and exit node configuration',
        widgetTypes: ['tailscale-routes'],
      },
      {
        id: 'webhooks',
        name: 'Webhooks',
        description: 'Configured webhooks and subscriptions',
        widgetTypes: ['tailscale-webhooks'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Device endpoints
      {
        id: 'devices-list',
        name: 'List Devices',
        description: 'List all devices in the tailnet',
        method: 'GET',
        endpoint: '/tailnet/{tailnet}/devices',
        implemented: true,
        category: 'Devices',
      },
      {
        id: 'device-get',
        name: 'Get Device',
        description: 'Get device details',
        method: 'GET',
        endpoint: '/device/{deviceId}',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
        ],
      },
      {
        id: 'device-delete',
        name: 'Delete Device',
        description: 'Remove device from tailnet',
        method: 'DELETE',
        endpoint: '/device/{deviceId}',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
        ],
      },
      {
        id: 'device-routes-get',
        name: 'Get Device Routes',
        description: 'Get device advertised routes',
        method: 'GET',
        endpoint: '/device/{deviceId}/routes',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
        ],
      },
      {
        id: 'device-routes-set',
        name: 'Set Device Routes',
        description: 'Enable or disable device routes',
        method: 'POST',
        endpoint: '/device/{deviceId}/routes',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
          { name: 'routes', type: 'array', required: true, description: 'Routes to enable' },
        ],
      },
      {
        id: 'device-authorize',
        name: 'Authorize Device',
        description: 'Authorize or deauthorize device',
        method: 'POST',
        endpoint: '/device/{deviceId}/authorized',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
          { name: 'authorized', type: 'boolean', required: true, description: 'Authorization status' },
        ],
      },
      {
        id: 'device-tags-set',
        name: 'Set Device Tags',
        description: 'Set device tags',
        method: 'POST',
        endpoint: '/device/{deviceId}/tags',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
          { name: 'tags', type: 'array', required: true, description: 'Tags to set' },
        ],
      },

      // User endpoints
      {
        id: 'users-list',
        name: 'List Users',
        description: 'List users in the tailnet',
        method: 'GET',
        endpoint: '/tailnet/{tailnet}/users',
        implemented: true,
        category: 'Users',
      },
      {
        id: 'user-get',
        name: 'Get User',
        description: 'Get user details',
        method: 'GET',
        endpoint: '/user/{userId}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'string', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'user-update',
        name: 'Update User',
        description: 'Update user role or approval',
        method: 'PATCH',
        endpoint: '/user/{userId}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'string', required: true, description: 'User ID' },
          { name: 'role', type: 'string', required: false, description: 'New role' },
        ],
      },

      // DNS endpoints
      {
        id: 'dns-nameservers-get',
        name: 'Get Nameservers',
        description: 'Get DNS nameservers',
        method: 'GET',
        endpoint: '/tailnet/{tailnet}/dns/nameservers',
        implemented: true,
        category: 'DNS',
      },
      {
        id: 'dns-nameservers-set',
        name: 'Set Nameservers',
        description: 'Set DNS nameservers',
        method: 'POST',
        endpoint: '/tailnet/{tailnet}/dns/nameservers',
        implemented: false,
        category: 'DNS',
        parameters: [
          { name: 'dns', type: 'array', required: true, description: 'Nameserver addresses' },
        ],
      },
      {
        id: 'dns-preferences-get',
        name: 'Get DNS Preferences',
        description: 'Get DNS preferences (MagicDNS)',
        method: 'GET',
        endpoint: '/tailnet/{tailnet}/dns/preferences',
        implemented: true,
        category: 'DNS',
      },
      {
        id: 'dns-preferences-set',
        name: 'Set DNS Preferences',
        description: 'Set DNS preferences',
        method: 'POST',
        endpoint: '/tailnet/{tailnet}/dns/preferences',
        implemented: false,
        category: 'DNS',
        parameters: [
          { name: 'magicDNS', type: 'boolean', required: true, description: 'Enable MagicDNS' },
        ],
      },
      {
        id: 'dns-searchpaths-get',
        name: 'Get Search Paths',
        description: 'Get DNS search paths',
        method: 'GET',
        endpoint: '/tailnet/{tailnet}/dns/searchpaths',
        implemented: true,
        category: 'DNS',
      },

      // ACL endpoints
      {
        id: 'acl-get',
        name: 'Get ACL',
        description: 'Get current ACL policy',
        method: 'GET',
        endpoint: '/tailnet/{tailnet}/acl',
        implemented: true,
        category: 'ACL Policy',
      },
      {
        id: 'acl-update',
        name: 'Update ACL',
        description: 'Update ACL policy',
        method: 'POST',
        endpoint: '/tailnet/{tailnet}/acl',
        implemented: false,
        category: 'ACL Policy',
        parameters: [
          { name: 'acl', type: 'object', required: true, description: 'ACL policy object' },
        ],
      },
      {
        id: 'acl-validate',
        name: 'Validate ACL',
        description: 'Validate ACL syntax',
        method: 'POST',
        endpoint: '/tailnet/{tailnet}/acl/validate',
        implemented: false,
        category: 'ACL Policy',
        parameters: [
          { name: 'acl', type: 'object', required: true, description: 'ACL policy to validate' },
        ],
      },

      // Auth Keys endpoints
      {
        id: 'keys-list',
        name: 'List Auth Keys',
        description: 'List authentication keys',
        method: 'GET',
        endpoint: '/tailnet/{tailnet}/keys',
        implemented: true,
        category: 'Auth Keys',
      },
      {
        id: 'keys-create',
        name: 'Create Auth Key',
        description: 'Create a new authentication key',
        method: 'POST',
        endpoint: '/tailnet/{tailnet}/keys',
        implemented: false,
        category: 'Auth Keys',
        parameters: [
          { name: 'reusable', type: 'boolean', required: false, description: 'Key can be used multiple times' },
          { name: 'ephemeral', type: 'boolean', required: false, description: 'Devices are ephemeral' },
          { name: 'preauthorized', type: 'boolean', required: false, description: 'Devices are pre-authorized' },
          { name: 'tags', type: 'array', required: false, description: 'Tags for devices' },
        ],
      },
      {
        id: 'keys-delete',
        name: 'Delete Auth Key',
        description: 'Revoke an authentication key',
        method: 'DELETE',
        endpoint: '/tailnet/{tailnet}/keys/{keyId}',
        implemented: false,
        category: 'Auth Keys',
        parameters: [
          { name: 'keyId', type: 'string', required: true, description: 'Key ID' },
        ],
      },

      // Webhook endpoints
      {
        id: 'webhooks-list',
        name: 'List Webhooks',
        description: 'List configured webhooks',
        method: 'GET',
        endpoint: '/tailnet/{tailnet}/webhooks',
        implemented: true,
        category: 'Webhooks',
      },
      {
        id: 'webhooks-create',
        name: 'Create Webhook',
        description: 'Create a new webhook',
        method: 'POST',
        endpoint: '/tailnet/{tailnet}/webhooks',
        implemented: false,
        category: 'Webhooks',
        parameters: [
          { name: 'endpointUrl', type: 'string', required: true, description: 'Webhook URL' },
          { name: 'subscriptions', type: 'array', required: true, description: 'Event subscriptions' },
        ],
      },
      {
        id: 'webhooks-test',
        name: 'Test Webhook',
        description: 'Send test event to webhook',
        method: 'POST',
        endpoint: '/tailnet/{tailnet}/webhooks/{webhookId}/test',
        implemented: false,
        category: 'Webhooks',
        parameters: [
          { name: 'webhookId', type: 'string', required: true, description: 'Webhook ID' },
        ],
      },
    ];
  }
}
