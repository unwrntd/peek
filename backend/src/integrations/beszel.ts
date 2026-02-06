import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  BeszelConfig,
  BeszelSystem,
  BeszelSystemStats,
  BeszelContainerStats,
  BeszelAlert,
} from '../types';
import { logger } from '../services/logger';

export class BeszelIntegration extends BaseIntegration {
  readonly type = 'beszel';
  readonly name = 'Beszel';

  private authToken: string | null = null;

  private createClient(config: BeszelConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 8090}`;

    return axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 10000,
    });
  }

  private async authenticate(client: AxiosInstance, config: BeszelConfig): Promise<string> {
    if (this.authToken) {
      // Check if token is still valid
      try {
        client.defaults.headers.common['Authorization'] = this.authToken;
        await client.get('/api/collections/users/auth-refresh');
        return this.authToken;
      } catch {
        this.authToken = null;
      }
    }

    logger.debug('beszel', 'Authenticating with username/password');

    try {
      const response = await client.post('/api/collections/users/auth-with-password', {
        identity: config.username,
        password: config.password,
      });

      const token = response.data.token;
      this.authToken = token;
      client.defaults.headers.common['Authorization'] = token;
      logger.debug('beszel', 'Authentication successful');
      return token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('beszel', 'Authentication failed', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const beszelConfig = config as BeszelConfig;

    try {
      const client = this.createClient(beszelConfig);
      await this.authenticate(client, beszelConfig);

      // Try to fetch systems to verify connection
      const response = await client.get('/api/collections/systems/records', {
        params: { perPage: 1 },
      });

      const totalSystems = response.data.totalItems || 0;

      return {
        success: true,
        message: `Connected to Beszel (${totalSystems} system${totalSystems !== 1 ? 's' : ''} monitored)`,
        details: {
          totalSystems,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('beszel', 'Connection test failed', { error: errorMsg });

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const beszelConfig = config as BeszelConfig;
    const client = this.createClient(beszelConfig);
    await this.authenticate(client, beszelConfig);

    switch (metric) {
      case 'systems':
        return this.getSystems(client);
      case 'system-stats':
        return this.getSystemStats(client);
      case 'container-stats':
        return this.getContainerStats(client);
      case 'alerts':
        return this.getAlerts(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getSystems(client: AxiosInstance): Promise<{ systems: BeszelSystem[] }> {
    try {
      const response = await client.get('/api/collections/systems/records', {
        params: {
          perPage: 500,
          sort: '-updated',
        },
      });

      const systems: BeszelSystem[] = (response.data.items || []).map((item: Record<string, unknown>) => {
        // Parse info object - Beszel uses abbreviated field names
        const rawInfo = item.info as Record<string, unknown> | undefined;
        let info: BeszelSystem['info'] | undefined;

        if (rawInfo) {
          // Map OS number to string (0=unknown, based on Beszel internals)
          const osMap: Record<number, string> = {
            0: '', // unknown/not set
            1: 'Linux',
            2: 'Windows',
            3: 'macOS',
          };
          const osNum = rawInfo.os as number;
          const osStr = typeof osNum === 'number' ? (osMap[osNum] || '') : (rawInfo.os as string || '');

          info = {
            hostname: (rawInfo.h as string) || undefined,
            os: osStr || undefined,
            cpu_model: (rawInfo.m as string) || undefined,
            cores: (rawInfo.c as number) || undefined,
            agent_version: (rawInfo.v as string) || undefined,
            uptime: (rawInfo.u as number) || undefined,
          };
        }

        return {
          id: item.id as string,
          name: item.name as string,
          host: item.host as string,
          port: parseInt(item.port as string, 10) || 45876,
          status: item.status as 'up' | 'down' | 'paused' | 'pending',
          created: item.created as string,
          updated: item.updated as string,
          info,
        };
      });

      logger.debug('beszel', `Fetched ${systems.length} systems`);
      return { systems };
    } catch (error) {
      logger.error('beszel', 'Failed to fetch systems', { error: String(error) });
      return { systems: [] };
    }
  }

  private async getSystemStats(client: AxiosInstance): Promise<{ stats: BeszelSystemStats[] }> {
    try {
      // First get systems
      const systemsResponse = await client.get('/api/collections/systems/records', {
        params: { perPage: 500 },
      });

      const systems = systemsResponse.data.items || [];

      // Filter to only systems that are "up" - others have stale stats
      const upSystems = systems.filter((system: Record<string, unknown>) => system.status === 'up');

      // Log system structure for debugging
      if (upSystems.length > 0) {
        const sampleSystem = upSystems[0] as Record<string, unknown>;
        logger.debug('beszel', 'Sample system structure', {
          keys: Object.keys(sampleSystem),
          name: sampleSystem.name,
          info: sampleSystem.info,
        });
      }

      // Get latest stats for all systems in parallel
      const statsPromises = upSystems.map(async (system: Record<string, unknown>) => {
        try {
          const statsResponse = await client.get('/api/collections/system_stats/records', {
            params: {
              filter: `system="${system.id}"`,
              sort: '-created',
              perPage: 1,
            },
          });

          const latestStat = statsResponse.data.items?.[0];
          if (latestStat) {
            // Stats are nested inside a 'stats' object in Beszel
            const s = latestStat.stats || {};

            // Convert temperatures from object to array
            const temps: { name: string; temp: number }[] = [];
            if (s.t && typeof s.t === 'object') {
              for (const [name, temp] of Object.entries(s.t)) {
                temps.push({ name, temp: temp as number });
              }
            }

            // Extract system info for cores
            // Info can be a direct field on system, or might be in the stats
            const rawInfo = system.info as Record<string, unknown> | undefined;
            // Beszel uses: c = cores, t = threads
            // Only use cores when it's actually reported (c > 0)
            // Don't fall back to threads as it's misleading to label threads as "cores"
            const cores = (rawInfo?.c as number) || undefined;

            return {
              id: latestStat.id,
              system: system.name || system.id,
              created: latestStat.created,
              cpu: s.cpu || 0,
              mem: s.mp || 0, // mem percent
              memUsed: (s.mu || 0) * 1024 * 1024 * 1024, // convert GB to bytes
              memTotal: (s.m || 0) * 1024 * 1024 * 1024, // convert GB to bytes
              memBuffCache: (s.mb || 0) * 1024 * 1024 * 1024, // convert GB to bytes
              disk: s.dp || 0, // disk percent
              diskUsed: (s.du || 0) * 1024 * 1024 * 1024, // convert GB to bytes
              diskTotal: (s.d || 0) * 1024 * 1024 * 1024, // convert GB to bytes
              netIn: (s.nr || 0) * 1024, // convert KB/s to B/s
              netOut: (s.ns || 0) * 1024, // convert KB/s to B/s
              temps,
              cores,
            };
          }
          return null;
        } catch (error) {
          logger.warn('beszel', `Failed to fetch stats for system ${system.id}`, { error: String(error) });
          return null;
        }
      });

      const results = await Promise.all(statsPromises);
      const stats: BeszelSystemStats[] = results.filter((s): s is BeszelSystemStats => s !== null);

      logger.debug('beszel', `Fetched stats for ${stats.length} systems`);
      return { stats };
    } catch (error) {
      logger.error('beszel', 'Failed to fetch system stats', { error: String(error) });
      return { stats: [] };
    }
  }

  private async getContainerStats(client: AxiosInstance): Promise<{ containers: BeszelContainerStats[] }> {
    try {
      // First get systems
      const systemsResponse = await client.get('/api/collections/systems/records', {
        params: { perPage: 500 },
      });

      const systems = systemsResponse.data.items || [];
      const systemNames: Record<string, string> = {};
      systems.forEach((s: { id: string; name: string }) => {
        systemNames[s.id] = s.name;
      });

      // Get latest container stats
      const response = await client.get('/api/collections/container_stats/records', {
        params: {
          perPage: 500,
          sort: '-created',
        },
      });

      // Group by container name and get latest for each
      const containerMap = new Map<string, BeszelContainerStats>();

      for (const item of response.data.items || []) {
        const key = `${item.system}-${item.n}`; // system + container name
        if (!containerMap.has(key)) {
          containerMap.set(key, {
            id: item.id,
            system: systemNames[item.system] || item.system,
            created: item.created,
            name: item.n || 'unknown',
            cpu: item.c || 0, // cpu
            mem: item.m || 0, // mem used
            memUsed: item.m || 0,
            netIn: item.nr || 0, // net receive
            netOut: item.ns || 0, // net send
          });
        }
      }

      const containers = Array.from(containerMap.values());
      logger.debug('beszel', `Fetched ${containers.length} container stats`);
      return { containers };
    } catch (error) {
      logger.error('beszel', 'Failed to fetch container stats', { error: String(error) });
      return { containers: [] };
    }
  }

  private async getAlerts(client: AxiosInstance): Promise<{ alerts: BeszelAlert[] }> {
    try {
      // First get systems for names
      const systemsResponse = await client.get('/api/collections/systems/records', {
        params: { perPage: 500 },
      });

      const systems = systemsResponse.data.items || [];
      const systemNames: Record<string, string> = {};
      systems.forEach((s: { id: string; name: string }) => {
        systemNames[s.id] = s.name;
      });

      const response = await client.get('/api/collections/alerts/records', {
        params: {
          perPage: 500,
          sort: '-updated',
        },
      });

      const alerts: BeszelAlert[] = (response.data.items || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        system: systemNames[item.system as string] || (item.system as string),
        name: item.name as string,
        triggered: item.triggered as boolean,
        count: (item.count as number) || 0,
        value: (item.value as number) || 0,
        updated: item.updated as string,
      }));

      logger.debug('beszel', `Fetched ${alerts.length} alerts`);
      return { alerts };
    } catch (error) {
      logger.error('beszel', 'Failed to fetch alerts', { error: String(error) });
      return { alerts: [] };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'systems',
        name: 'Systems',
        description: 'List of monitored systems with status',
        widgetTypes: ['system-list'],
      },
      {
        id: 'system-stats',
        name: 'System Stats',
        description: 'CPU, memory, disk, and network stats for all systems',
        widgetTypes: ['system-stats', 'system-overview'],
      },
      {
        id: 'container-stats',
        name: 'Container Stats',
        description: 'Docker/Podman container statistics',
        widgetTypes: ['container-stats'],
      },
      {
        id: 'alerts',
        name: 'Alerts',
        description: 'Active alerts and their status',
        widgetTypes: ['alerts-list'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication - Implemented
      {
        id: 'auth-with-password',
        name: 'Authenticate with Password',
        description: 'Authenticate user with email/username and password',
        method: 'POST',
        endpoint: '/api/collections/users/auth-with-password',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'identity', type: 'string', required: true, description: 'Email or username' },
          { name: 'password', type: 'string', required: true, description: 'User password' },
        ],
        documentationUrl: 'https://beszel.dev/guide/rest-api',
      },
      {
        id: 'auth-refresh',
        name: 'Refresh Auth Token',
        description: 'Refresh the authentication token',
        method: 'GET',
        endpoint: '/api/collections/users/auth-refresh',
        implemented: true,
        category: 'Authentication',
      },
      {
        id: 'auth-request-verification',
        name: 'Request Email Verification',
        description: 'Request a verification email for the user',
        method: 'POST',
        endpoint: '/api/collections/users/request-verification',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'User email' },
        ],
      },
      {
        id: 'auth-confirm-verification',
        name: 'Confirm Email Verification',
        description: 'Confirm email verification with token',
        method: 'POST',
        endpoint: '/api/collections/users/confirm-verification',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'token', type: 'string', required: true, description: 'Verification token' },
        ],
      },
      {
        id: 'auth-request-password-reset',
        name: 'Request Password Reset',
        description: 'Request a password reset email',
        method: 'POST',
        endpoint: '/api/collections/users/request-password-reset',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'User email' },
        ],
      },
      {
        id: 'auth-confirm-password-reset',
        name: 'Confirm Password Reset',
        description: 'Confirm password reset with token',
        method: 'POST',
        endpoint: '/api/collections/users/confirm-password-reset',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'token', type: 'string', required: true, description: 'Reset token' },
          { name: 'password', type: 'string', required: true, description: 'New password' },
          { name: 'passwordConfirm', type: 'string', required: true, description: 'Confirm new password' },
        ],
      },

      // Systems Collection - Implemented
      {
        id: 'systems-list',
        name: 'List Systems',
        description: 'Get list of monitored systems with pagination and filtering',
        method: 'GET',
        endpoint: '/api/collections/systems/records',
        implemented: true,
        category: 'Systems',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'perPage', type: 'number', required: false, description: 'Records per page (max 500)' },
          { name: 'sort', type: 'string', required: false, description: 'Sort field (prefix with - for desc)' },
          { name: 'filter', type: 'string', required: false, description: 'Filter expression' },
          { name: 'fields', type: 'string', required: false, description: 'Comma-separated fields to return' },
        ],
      },
      {
        id: 'systems-get',
        name: 'Get System',
        description: 'Get a specific system by ID',
        method: 'GET',
        endpoint: '/api/collections/systems/records/{id}',
        implemented: false,
        category: 'Systems',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'System record ID' },
        ],
      },
      {
        id: 'systems-create',
        name: 'Create System',
        description: 'Add a new system to monitor',
        method: 'POST',
        endpoint: '/api/collections/systems/records',
        implemented: false,
        category: 'Systems',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'System name' },
          { name: 'host', type: 'string', required: true, description: 'System hostname or IP' },
          { name: 'port', type: 'number', required: false, description: 'Agent port (default: 45876)' },
        ],
      },
      {
        id: 'systems-update',
        name: 'Update System',
        description: 'Update an existing system',
        method: 'PATCH',
        endpoint: '/api/collections/systems/records/{id}',
        implemented: false,
        category: 'Systems',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'System record ID' },
          { name: 'name', type: 'string', required: false, description: 'System name' },
          { name: 'host', type: 'string', required: false, description: 'System hostname or IP' },
          { name: 'port', type: 'number', required: false, description: 'Agent port' },
          { name: 'users', type: 'string[]', required: false, description: 'User IDs with access' },
        ],
      },
      {
        id: 'systems-delete',
        name: 'Delete System',
        description: 'Remove a system from monitoring',
        method: 'DELETE',
        endpoint: '/api/collections/systems/records/{id}',
        implemented: false,
        category: 'Systems',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'System record ID' },
        ],
      },

      // System Stats Collection - Implemented
      {
        id: 'system-stats-list',
        name: 'List System Stats',
        description: 'Get system statistics records with pagination and filtering',
        method: 'GET',
        endpoint: '/api/collections/system_stats/records',
        implemented: true,
        category: 'System Stats',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'perPage', type: 'number', required: false, description: 'Records per page' },
          { name: 'sort', type: 'string', required: false, description: 'Sort field (e.g., -created)' },
          { name: 'filter', type: 'string', required: false, description: 'Filter expression (e.g., system="id")' },
        ],
      },
      {
        id: 'system-stats-get',
        name: 'Get System Stats Record',
        description: 'Get a specific system stats record by ID',
        method: 'GET',
        endpoint: '/api/collections/system_stats/records/{id}',
        implemented: false,
        category: 'System Stats',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Stats record ID' },
        ],
      },

      // Container Stats Collection - Implemented
      {
        id: 'container-stats-list',
        name: 'List Container Stats',
        description: 'Get container statistics records with pagination and filtering',
        method: 'GET',
        endpoint: '/api/collections/container_stats/records',
        implemented: true,
        category: 'Container Stats',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'perPage', type: 'number', required: false, description: 'Records per page' },
          { name: 'sort', type: 'string', required: false, description: 'Sort field' },
          { name: 'filter', type: 'string', required: false, description: 'Filter expression' },
        ],
      },
      {
        id: 'container-stats-get',
        name: 'Get Container Stats Record',
        description: 'Get a specific container stats record by ID',
        method: 'GET',
        endpoint: '/api/collections/container_stats/records/{id}',
        implemented: false,
        category: 'Container Stats',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Container stats record ID' },
        ],
      },

      // Alerts Collection - Implemented
      {
        id: 'alerts-list',
        name: 'List Alerts',
        description: 'Get alerts with pagination and filtering',
        method: 'GET',
        endpoint: '/api/collections/alerts/records',
        implemented: true,
        category: 'Alerts',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'perPage', type: 'number', required: false, description: 'Records per page' },
          { name: 'sort', type: 'string', required: false, description: 'Sort field' },
          { name: 'filter', type: 'string', required: false, description: 'Filter expression' },
        ],
      },
      {
        id: 'alerts-get',
        name: 'Get Alert',
        description: 'Get a specific alert by ID',
        method: 'GET',
        endpoint: '/api/collections/alerts/records/{id}',
        implemented: false,
        category: 'Alerts',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Alert record ID' },
        ],
      },
      {
        id: 'alerts-create',
        name: 'Create Alert',
        description: 'Create a new alert configuration',
        method: 'POST',
        endpoint: '/api/collections/alerts/records',
        implemented: false,
        category: 'Alerts',
        parameters: [
          { name: 'system', type: 'string', required: true, description: 'System ID' },
          { name: 'name', type: 'string', required: true, description: 'Alert name' },
          { name: 'value', type: 'number', required: true, description: 'Threshold value' },
        ],
      },
      {
        id: 'alerts-update',
        name: 'Update Alert',
        description: 'Update an existing alert',
        method: 'PATCH',
        endpoint: '/api/collections/alerts/records/{id}',
        implemented: false,
        category: 'Alerts',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Alert record ID' },
          { name: 'name', type: 'string', required: false, description: 'Alert name' },
          { name: 'value', type: 'number', required: false, description: 'Threshold value' },
        ],
      },
      {
        id: 'alerts-delete',
        name: 'Delete Alert',
        description: 'Delete an alert',
        method: 'DELETE',
        endpoint: '/api/collections/alerts/records/{id}',
        implemented: false,
        category: 'Alerts',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Alert record ID' },
        ],
      },

      // Users Collection
      {
        id: 'users-list',
        name: 'List Users',
        description: 'Get list of users (admin only)',
        method: 'GET',
        endpoint: '/api/collections/users/records',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'perPage', type: 'number', required: false, description: 'Records per page' },
          { name: 'filter', type: 'string', required: false, description: 'Filter expression' },
        ],
      },
      {
        id: 'users-get',
        name: 'Get User',
        description: 'Get a specific user by ID',
        method: 'GET',
        endpoint: '/api/collections/users/records/{id}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'User record ID' },
        ],
      },
      {
        id: 'users-create',
        name: 'Create User',
        description: 'Create a new user account',
        method: 'POST',
        endpoint: '/api/collections/users/records',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'User email' },
          { name: 'password', type: 'string', required: true, description: 'User password' },
          { name: 'passwordConfirm', type: 'string', required: true, description: 'Confirm password' },
        ],
      },
      {
        id: 'users-update',
        name: 'Update User',
        description: 'Update user details',
        method: 'PATCH',
        endpoint: '/api/collections/users/records/{id}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'User record ID' },
          { name: 'email', type: 'string', required: false, description: 'User email' },
        ],
      },
      {
        id: 'users-delete',
        name: 'Delete User',
        description: 'Delete a user account',
        method: 'DELETE',
        endpoint: '/api/collections/users/records/{id}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'User record ID' },
        ],
      },

      // Settings
      {
        id: 'settings-list',
        name: 'List Settings',
        description: 'Get application settings',
        method: 'GET',
        endpoint: '/api/settings',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-update',
        name: 'Update Settings',
        description: 'Update application settings',
        method: 'PATCH',
        endpoint: '/api/settings',
        implemented: false,
        category: 'Settings',
      },

      // Realtime Subscriptions
      {
        id: 'realtime-subscribe',
        name: 'Subscribe to Realtime',
        description: 'Subscribe to realtime updates via SSE',
        method: 'GET',
        endpoint: '/api/realtime',
        implemented: false,
        category: 'Realtime',
        parameters: [
          { name: 'clientId', type: 'string', required: false, description: 'Client identifier' },
        ],
      },
      {
        id: 'realtime-set-subscriptions',
        name: 'Set Subscriptions',
        description: 'Set the collections/records to subscribe to',
        method: 'POST',
        endpoint: '/api/realtime',
        implemented: false,
        category: 'Realtime',
        parameters: [
          { name: 'clientId', type: 'string', required: true, description: 'Client identifier' },
          { name: 'subscriptions', type: 'string[]', required: true, description: 'Collection names to subscribe' },
        ],
      },

      // Health Check
      {
        id: 'health-check',
        name: 'Health Check',
        description: 'Check API health status',
        method: 'GET',
        endpoint: '/api/health',
        implemented: false,
        category: 'System',
      },

      // Backups (Admin)
      {
        id: 'backups-list',
        name: 'List Backups',
        description: 'List available backups (admin only)',
        method: 'GET',
        endpoint: '/api/backups',
        implemented: false,
        category: 'Backups',
      },
      {
        id: 'backups-create',
        name: 'Create Backup',
        description: 'Create a new backup (admin only)',
        method: 'POST',
        endpoint: '/api/backups',
        implemented: false,
        category: 'Backups',
        parameters: [
          { name: 'name', type: 'string', required: false, description: 'Backup name' },
        ],
      },
      {
        id: 'backups-download',
        name: 'Download Backup',
        description: 'Download a backup file (admin only)',
        method: 'GET',
        endpoint: '/api/backups/{key}',
        implemented: false,
        category: 'Backups',
        parameters: [
          { name: 'key', type: 'string', required: true, description: 'Backup key/filename' },
        ],
      },
      {
        id: 'backups-delete',
        name: 'Delete Backup',
        description: 'Delete a backup file (admin only)',
        method: 'DELETE',
        endpoint: '/api/backups/{key}',
        implemented: false,
        category: 'Backups',
        parameters: [
          { name: 'key', type: 'string', required: true, description: 'Backup key/filename' },
        ],
      },

      // Logs (Admin)
      {
        id: 'logs-list',
        name: 'List Logs',
        description: 'Get request logs (admin only)',
        method: 'GET',
        endpoint: '/api/logs',
        implemented: false,
        category: 'Logs',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'perPage', type: 'number', required: false, description: 'Records per page' },
          { name: 'filter', type: 'string', required: false, description: 'Filter expression' },
        ],
      },
      {
        id: 'logs-get',
        name: 'Get Log Entry',
        description: 'Get a specific log entry (admin only)',
        method: 'GET',
        endpoint: '/api/logs/{id}',
        implemented: false,
        category: 'Logs',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Log entry ID' },
        ],
      },
      {
        id: 'logs-stats',
        name: 'Get Log Stats',
        description: 'Get log statistics (admin only)',
        method: 'GET',
        endpoint: '/api/logs/stats',
        implemented: false,
        category: 'Logs',
      },
    ];
  }
}
