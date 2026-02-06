import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationData } from '../types';
import { logger } from '../services/logger';

interface KasmConfig {
  host: string;
  port: number;
  apiKey: string;
  apiKeySecret: string;
  verifySSL?: boolean;
}

interface KasmSession {
  kasm_id: string;
  user_id: string;
  username: string;
  image_id: string;
  image_friendly_name: string;
  operational_status: string;
  start_date: string;
  keepalive_date: string;
  cores: number;
  memory: number;
  hostname: string;
}

interface KasmUser {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  locked: boolean;
  disabled: boolean;
  last_session: string;
  groups: Array<{ name: string }>;
}

interface KasmImage {
  image_id: string;
  friendly_name: string;
  image_src: string;
  cores: number;
  memory: number;
  enabled: boolean;
  description: string;
}

interface KasmZone {
  zone_id: string;
  zone_name: string;
  auto_scaling_enabled: boolean;
  provider: string;
  load_strategy: string;
}

export class KasmIntegration extends BaseIntegration {
  readonly type = 'kasm';
  readonly name = 'Kasm Workspaces';

  private getBaseUrl(config: KasmConfig): string {
    const protocol = config.verifySSL !== false ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  private createClient(config: KasmConfig): AxiosInstance {
    return axios.create({
      baseURL: this.getBaseUrl(config),
      headers: { 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? true,
      }),
      timeout: 30000,
    });
  }

  private getAuthBody(config: KasmConfig): Record<string, string> {
    return {
      api_key: config.apiKey,
      api_key_secret: config.apiKeySecret,
    };
  }

  async testConnection(config: KasmConfig): Promise<ConnectionTestResult> {
    try {
      logger.debug('kasm', 'Testing connection', { host: config.host, port: config.port });

      const client = this.createClient(config);
      const response = await client.post('/api/public/get_kasms', this.getAuthBody(config));

      if (response.data.error_message) {
        return {
          success: false,
          message: `API error: ${response.data.error_message}`,
        };
      }

      const sessionCount = response.data.kasms?.length || 0;

      logger.info('kasm', 'Connection successful', { sessionCount });

      return {
        success: true,
        message: `Connected to Kasm Workspaces (${sessionCount} active sessions)`,
        details: { sessionCount },
      };
    } catch (error) {
      logger.error('kasm', 'Connection test failed', { error });

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          return { success: false, message: `Connection refused at ${config.host}:${config.port}` };
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
          return { success: false, message: 'Invalid API credentials' };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          return { success: false, message: `Connection timed out. Check if ${config.host}:${config.port} is accessible.` };
        }
        return { success: false, message: `Connection failed: ${error.message}` };
      }

      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getData(config: KasmConfig, metric: string): Promise<IntegrationData> {
    const client = this.createClient(config);
    const authBody = this.getAuthBody(config);

    switch (metric) {
      case 'status':
        return this.getStatus(client, authBody);
      case 'sessions':
        return this.getSessions(client, authBody);
      case 'users':
        return this.getUsers(client, authBody);
      case 'images':
        return this.getImages(client, authBody);
      case 'zones':
        return this.getZones(client, authBody);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatus(client: AxiosInstance, authBody: Record<string, string>): Promise<{
    status: { sessionCount: number; userCount: number; imageCount: number; zoneCount: number };
  }> {
    logger.debug('kasm', 'Fetching status');

    const [sessionsRes, usersRes, imagesRes, zonesRes] = await Promise.all([
      client.post('/api/public/get_kasms', authBody),
      client.post('/api/public/get_users', authBody),
      client.post('/api/public/get_images', authBody),
      client.post('/api/public/get_zones', authBody),
    ]);

    const status = {
      sessionCount: sessionsRes.data.kasms?.length || 0,
      userCount: usersRes.data.users?.length || 0,
      imageCount: imagesRes.data.images?.filter((i: KasmImage) => i.enabled).length || 0,
      zoneCount: zonesRes.data.zones?.length || 0,
    };

    logger.debug('kasm', 'Status fetched', status);

    return { status };
  }

  private async getSessions(client: AxiosInstance, authBody: Record<string, string>): Promise<{
    sessions: KasmSession[];
  }> {
    logger.debug('kasm', 'Fetching sessions');
    const response = await client.post('/api/public/get_kasms', authBody);
    const sessions = response.data.kasms || [];
    logger.debug('kasm', 'Sessions fetched', { count: sessions.length });
    return { sessions };
  }

  private async getUsers(client: AxiosInstance, authBody: Record<string, string>): Promise<{
    users: KasmUser[];
  }> {
    logger.debug('kasm', 'Fetching users');
    const response = await client.post('/api/public/get_users', authBody);
    const users = response.data.users || [];
    logger.debug('kasm', 'Users fetched', { count: users.length });
    return { users };
  }

  private async getImages(client: AxiosInstance, authBody: Record<string, string>): Promise<{
    images: KasmImage[];
  }> {
    logger.debug('kasm', 'Fetching images');
    const response = await client.post('/api/public/get_images', authBody);
    const images = response.data.images || [];
    logger.debug('kasm', 'Images fetched', { count: images.length });
    return { images };
  }

  private async getZones(client: AxiosInstance, authBody: Record<string, string>): Promise<{
    zones: KasmZone[];
  }> {
    logger.debug('kasm', 'Fetching zones');
    const response = await client.post('/api/public/get_zones', authBody);
    const zones = response.data.zones || [];
    logger.debug('kasm', 'Zones fetched', { count: zones.length });
    return { zones };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Kasm server overview with counts',
        widgetTypes: ['kasm-status'],
      },
      {
        id: 'sessions',
        name: 'Active Sessions',
        description: 'List of active Kasm sessions',
        widgetTypes: ['kasm-sessions', 'kasm-session-count'],
      },
      {
        id: 'users',
        name: 'Users',
        description: 'List of Kasm users',
        widgetTypes: ['kasm-users'],
      },
      {
        id: 'images',
        name: 'Images',
        description: 'Available workspace images',
        widgetTypes: ['kasm-images'],
      },
      {
        id: 'zones',
        name: 'Zones',
        description: 'Deployment zones',
        widgetTypes: ['kasm-zones'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Sessions (Kasms) - Implemented
      {
        id: 'get-kasms',
        name: 'Get Kasms',
        description: 'Retrieve a list of all live Kasm sessions',
        method: 'POST',
        endpoint: '/api/public/get_kasms',
        implemented: true,
        category: 'Sessions',
        documentationUrl: 'https://www.kasmweb.com/docs/latest/developers/developer_api.html',
      },
      {
        id: 'request-kasm',
        name: 'Request Kasm',
        description: 'Create and start a new Kasm session for a user',
        method: 'POST',
        endpoint: '/api/public/request_kasm',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'User ID to assign the session to' },
          { name: 'image_id', type: 'string', required: true, description: 'ID of the workspace image' },
          { name: 'enable_sharing', type: 'boolean', required: false, description: 'Enable session sharing' },
        ],
      },
      {
        id: 'get-kasm-status',
        name: 'Get Kasm Status',
        description: 'Get the operational status of a specific Kasm session',
        method: 'POST',
        endpoint: '/api/public/get_kasm_status',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID associated with the session' },
        ],
      },
      {
        id: 'destroy-kasm',
        name: 'Destroy Kasm',
        description: 'Destroy a Kasm session',
        method: 'POST',
        endpoint: '/api/public/destroy_kasm',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session to destroy' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID associated with the session' },
        ],
      },
      {
        id: 'join-kasm',
        name: 'Join Kasm',
        description: 'Get a join URL for a shared Kasm session',
        method: 'POST',
        endpoint: '/api/public/join_kasm',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID to join the session' },
        ],
      },
      {
        id: 'keepalive',
        name: 'Keepalive',
        description: 'Reset the expiration time of a Kasm session',
        method: 'POST',
        endpoint: '/api/public/keepalive',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID associated with the session' },
        ],
      },
      {
        id: 'get-kasm-frame-stats',
        name: 'Get Frame Stats',
        description: 'Get timing statistics for frame processing in a Kasm session',
        method: 'POST',
        endpoint: '/api/public/get_kasm_frame_stats',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID associated with the session' },
        ],
      },
      {
        id: 'get-kasm-bottleneck-stats',
        name: 'Get Bottleneck Stats',
        description: 'Get bottleneck statistics for a Kasm session',
        method: 'POST',
        endpoint: '/api/public/get_kasm_bottleneck_stats',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID associated with the session' },
        ],
      },
      {
        id: 'get-kasm-screenshot',
        name: 'Get Screenshot',
        description: 'Get a screenshot of a Kasm session',
        method: 'POST',
        endpoint: '/api/public/get_kasm_screenshot',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID associated with the session' },
        ],
      },
      {
        id: 'exec-kasm-command',
        name: 'Execute Command',
        description: 'Execute a command in a Kasm session',
        method: 'POST',
        endpoint: '/api/public/exec_kasm_command',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID associated with the session' },
          { name: 'command', type: 'string', required: true, description: 'Command to execute' },
        ],
      },
      {
        id: 'get-rdp-client-conn-info',
        name: 'Get RDP Connection Info',
        description: 'Get RDP client connection information for a session',
        method: 'POST',
        endpoint: '/api/public/get_rdp_client_conn_info',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'kasm_id', type: 'string', required: true, description: 'ID of the Kasm session' },
          { name: 'user_id', type: 'string', required: true, description: 'User ID associated with the session' },
        ],
      },

      // Users - Implemented
      {
        id: 'get-users',
        name: 'Get Users',
        description: 'Retrieve a list of all users',
        method: 'POST',
        endpoint: '/api/public/get_users',
        implemented: true,
        category: 'Users',
      },
      {
        id: 'get-user',
        name: 'Get User',
        description: 'Get details for a specific user',
        method: 'POST',
        endpoint: '/api/public/get_user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'ID of the user to retrieve' },
        ],
      },
      {
        id: 'create-user',
        name: 'Create User',
        description: 'Create a new user',
        method: 'POST',
        endpoint: '/api/public/create_user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'target_user', type: 'object', required: true, description: 'User object with username, password, etc.' },
        ],
      },
      {
        id: 'update-user',
        name: 'Update User',
        description: 'Update an existing user',
        method: 'POST',
        endpoint: '/api/public/update_user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'target_user', type: 'object', required: true, description: 'User object with updated fields' },
        ],
      },
      {
        id: 'delete-user',
        name: 'Delete User',
        description: 'Delete an existing user',
        method: 'POST',
        endpoint: '/api/public/delete_user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'ID of the user to delete' },
          { name: 'force', type: 'boolean', required: false, description: 'Force delete user and their sessions' },
        ],
      },
      {
        id: 'logout-user',
        name: 'Logout User',
        description: 'Log out a user from all sessions',
        method: 'POST',
        endpoint: '/api/public/logout_user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'ID of the user to logout' },
        ],
      },
      {
        id: 'get-user-attributes',
        name: 'Get User Attributes',
        description: 'Get custom attributes for a user',
        method: 'POST',
        endpoint: '/api/public/get_user_attributes',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'ID of the user' },
        ],
      },
      {
        id: 'update-user-attributes',
        name: 'Update User Attributes',
        description: 'Update custom attributes for a user',
        method: 'POST',
        endpoint: '/api/public/update_user_attributes',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'ID of the user' },
          { name: 'attributes', type: 'object', required: true, description: 'Key-value pairs of attributes' },
        ],
      },

      // Images - Implemented
      {
        id: 'get-images',
        name: 'Get Images',
        description: 'Retrieve a list of available workspace images',
        method: 'POST',
        endpoint: '/api/public/get_images',
        implemented: true,
        category: 'Images',
      },
      {
        id: 'get-image',
        name: 'Get Image',
        description: 'Get details for a specific image',
        method: 'POST',
        endpoint: '/api/public/get_image',
        implemented: false,
        category: 'Images',
        parameters: [
          { name: 'image_id', type: 'string', required: true, description: 'ID of the image to retrieve' },
        ],
      },
      {
        id: 'create-image',
        name: 'Create Image',
        description: 'Create a new workspace image',
        method: 'POST',
        endpoint: '/api/public/create_image',
        implemented: false,
        category: 'Images',
        parameters: [
          { name: 'target_image', type: 'object', required: true, description: 'Image configuration object' },
        ],
      },
      {
        id: 'update-image',
        name: 'Update Image',
        description: 'Update an existing workspace image',
        method: 'POST',
        endpoint: '/api/public/update_image',
        implemented: false,
        category: 'Images',
        parameters: [
          { name: 'target_image', type: 'object', required: true, description: 'Image object with updated fields' },
        ],
      },
      {
        id: 'delete-image',
        name: 'Delete Image',
        description: 'Delete a workspace image',
        method: 'POST',
        endpoint: '/api/public/delete_image',
        implemented: false,
        category: 'Images',
        parameters: [
          { name: 'image_id', type: 'string', required: true, description: 'ID of the image to delete' },
        ],
      },

      // Zones - Implemented
      {
        id: 'get-zones',
        name: 'Get Zones',
        description: 'Retrieve a list of deployment zones',
        method: 'POST',
        endpoint: '/api/public/get_zones',
        implemented: true,
        category: 'Zones',
      },
      {
        id: 'get-zone',
        name: 'Get Zone',
        description: 'Get details for a specific deployment zone',
        method: 'POST',
        endpoint: '/api/public/get_zone',
        implemented: false,
        category: 'Zones',
        parameters: [
          { name: 'zone_id', type: 'string', required: true, description: 'ID of the zone to retrieve' },
        ],
      },
      {
        id: 'create-zone',
        name: 'Create Zone',
        description: 'Create a new deployment zone',
        method: 'POST',
        endpoint: '/api/public/create_zone',
        implemented: false,
        category: 'Zones',
        parameters: [
          { name: 'target_zone', type: 'object', required: true, description: 'Zone configuration object' },
        ],
      },
      {
        id: 'update-zone',
        name: 'Update Zone',
        description: 'Update an existing deployment zone',
        method: 'POST',
        endpoint: '/api/public/update_zone',
        implemented: false,
        category: 'Zones',
        parameters: [
          { name: 'target_zone', type: 'object', required: true, description: 'Zone object with updated fields' },
        ],
      },
      {
        id: 'delete-zone',
        name: 'Delete Zone',
        description: 'Delete a deployment zone',
        method: 'POST',
        endpoint: '/api/public/delete_zone',
        implemented: false,
        category: 'Zones',
        parameters: [
          { name: 'zone_id', type: 'string', required: true, description: 'ID of the zone to delete' },
        ],
      },

      // Groups
      {
        id: 'get-groups',
        name: 'Get Groups',
        description: 'Retrieve a list of all groups',
        method: 'POST',
        endpoint: '/api/public/get_groups',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'get-group',
        name: 'Get Group',
        description: 'Get details for a specific group',
        method: 'POST',
        endpoint: '/api/public/get_group',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'group_id', type: 'string', required: true, description: 'ID of the group to retrieve' },
        ],
      },
      {
        id: 'create-group',
        name: 'Create Group',
        description: 'Create a new group',
        method: 'POST',
        endpoint: '/api/public/create_group',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'target_group', type: 'object', required: true, description: 'Group configuration object' },
        ],
      },
      {
        id: 'update-group',
        name: 'Update Group',
        description: 'Update an existing group',
        method: 'POST',
        endpoint: '/api/public/update_group',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'target_group', type: 'object', required: true, description: 'Group object with updated fields' },
        ],
      },
      {
        id: 'delete-group',
        name: 'Delete Group',
        description: 'Delete a group',
        method: 'POST',
        endpoint: '/api/public/delete_group',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'group_id', type: 'string', required: true, description: 'ID of the group to delete' },
        ],
      },
      {
        id: 'add-user-group',
        name: 'Add User to Group',
        description: 'Add a user to a group',
        method: 'POST',
        endpoint: '/api/public/add_user_group',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'ID of the user' },
          { name: 'group_id', type: 'string', required: true, description: 'ID of the group' },
        ],
      },
      {
        id: 'remove-user-group',
        name: 'Remove User from Group',
        description: 'Remove a user from a group',
        method: 'POST',
        endpoint: '/api/public/remove_user_group',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'ID of the user' },
          { name: 'group_id', type: 'string', required: true, description: 'ID of the group' },
        ],
      },

      // Servers
      {
        id: 'get-servers',
        name: 'Get Servers',
        description: 'Retrieve a list of all servers/agents',
        method: 'POST',
        endpoint: '/api/public/get_servers',
        implemented: false,
        category: 'Servers',
      },
      {
        id: 'get-server',
        name: 'Get Server',
        description: 'Get details for a specific server',
        method: 'POST',
        endpoint: '/api/public/get_server',
        implemented: false,
        category: 'Servers',
        parameters: [
          { name: 'server_id', type: 'string', required: true, description: 'ID of the server to retrieve' },
        ],
      },
      {
        id: 'create-server',
        name: 'Create Server',
        description: 'Register a new server',
        method: 'POST',
        endpoint: '/api/public/create_server',
        implemented: false,
        category: 'Servers',
        parameters: [
          { name: 'target_server', type: 'object', required: true, description: 'Server configuration object' },
        ],
      },
      {
        id: 'update-server',
        name: 'Update Server',
        description: 'Update server configuration',
        method: 'POST',
        endpoint: '/api/public/update_server',
        implemented: false,
        category: 'Servers',
        parameters: [
          { name: 'target_server', type: 'object', required: true, description: 'Server object with updated fields' },
        ],
      },
      {
        id: 'delete-server',
        name: 'Delete Server',
        description: 'Remove a server',
        method: 'POST',
        endpoint: '/api/public/delete_server',
        implemented: false,
        category: 'Servers',
        parameters: [
          { name: 'server_id', type: 'string', required: true, description: 'ID of the server to delete' },
        ],
      },

      // Staging
      {
        id: 'get-staging-configs',
        name: 'Get Staging Configs',
        description: 'Retrieve a list of session staging configurations',
        method: 'POST',
        endpoint: '/api/public/get_staging_configs',
        implemented: false,
        category: 'Staging',
      },
      {
        id: 'get-staging-config',
        name: 'Get Staging Config',
        description: 'Get details for a specific staging configuration',
        method: 'POST',
        endpoint: '/api/public/get_staging_config',
        implemented: false,
        category: 'Staging',
        parameters: [
          { name: 'staging_config_id', type: 'string', required: true, description: 'ID of the staging config' },
        ],
      },
      {
        id: 'create-staging-config',
        name: 'Create Staging Config',
        description: 'Create a new session staging configuration',
        method: 'POST',
        endpoint: '/api/public/create_staging_config',
        implemented: false,
        category: 'Staging',
        parameters: [
          { name: 'target_staging_config', type: 'object', required: true, description: 'Staging config object' },
        ],
      },
      {
        id: 'update-staging-config',
        name: 'Update Staging Config',
        description: 'Update a staging configuration',
        method: 'POST',
        endpoint: '/api/public/update_staging_config',
        implemented: false,
        category: 'Staging',
        parameters: [
          { name: 'target_staging_config', type: 'object', required: true, description: 'Staging config with updates' },
        ],
      },
      {
        id: 'delete-staging-config',
        name: 'Delete Staging Config',
        description: 'Delete a staging configuration',
        method: 'POST',
        endpoint: '/api/public/delete_staging_config',
        implemented: false,
        category: 'Staging',
        parameters: [
          { name: 'staging_config_id', type: 'string', required: true, description: 'ID of the staging config' },
        ],
      },

      // Licensing
      {
        id: 'get-license',
        name: 'Get License',
        description: 'Get current license information',
        method: 'POST',
        endpoint: '/api/public/get_license',
        implemented: false,
        category: 'Licensing',
      },
      {
        id: 'activate-license',
        name: 'Activate License',
        description: 'Activate a license key',
        method: 'POST',
        endpoint: '/api/public/activate_license',
        implemented: false,
        category: 'Licensing',
        parameters: [
          { name: 'license_key', type: 'string', required: true, description: 'License key to activate' },
        ],
      },

      // System
      {
        id: 'get-system-info',
        name: 'Get System Info',
        description: 'Get system information and health status',
        method: 'POST',
        endpoint: '/api/public/get_system_info',
        implemented: false,
        category: 'System',
      },
      {
        id: 'get-settings',
        name: 'Get Settings',
        description: 'Get system settings',
        method: 'POST',
        endpoint: '/api/public/get_settings',
        implemented: false,
        category: 'System',
      },
      {
        id: 'update-settings',
        name: 'Update Settings',
        description: 'Update system settings',
        method: 'POST',
        endpoint: '/api/public/update_settings',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'target_settings', type: 'object', required: true, description: 'Settings object with updates' },
        ],
      },

      // Cast Sessions
      {
        id: 'get-cast-configs',
        name: 'Get Cast Configs',
        description: 'Get casting/sharing configurations',
        method: 'POST',
        endpoint: '/api/public/get_cast_configs',
        implemented: false,
        category: 'Casting',
      },
      {
        id: 'create-cast-config',
        name: 'Create Cast Config',
        description: 'Create a new casting configuration',
        method: 'POST',
        endpoint: '/api/public/create_cast_config',
        implemented: false,
        category: 'Casting',
        parameters: [
          { name: 'target_cast_config', type: 'object', required: true, description: 'Cast config object' },
        ],
      },

      // Session Permissions/Recording
      {
        id: 'get-session-recordings',
        name: 'Get Session Recordings',
        description: 'Get list of session recordings',
        method: 'POST',
        endpoint: '/api/public/get_session_recordings',
        implemented: false,
        category: 'Recordings',
      },
      {
        id: 'delete-session-recording',
        name: 'Delete Session Recording',
        description: 'Delete a session recording',
        method: 'POST',
        endpoint: '/api/public/delete_session_recording',
        implemented: false,
        category: 'Recordings',
        parameters: [
          { name: 'recording_id', type: 'string', required: true, description: 'ID of the recording to delete' },
        ],
      },
    ];
  }
}
