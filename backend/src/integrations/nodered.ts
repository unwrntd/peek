import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationConfig, IntegrationData } from '../types';
import { logger } from '../services/logger';

interface NodeRedConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  accessToken?: string;
  verifySSL?: boolean;
}

interface TokenCache {
  token: string;
  expiry: number;
}

const tokenCache = new Map<string, TokenCache>();

export class NodeRedIntegration extends BaseIntegration {
  readonly type = 'nodered';
  readonly name = 'Node-RED';

  private getConfigKey(config: NodeRedConfig): string {
    return `nodered_${config.host}_${config.port}`;
  }

  private getBaseUrl(config: NodeRedConfig): string {
    const protocol = config.verifySSL ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  private createClient(config: NodeRedConfig, token?: string): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return axios.create({
      baseURL: this.getBaseUrl(config),
      headers,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
    });
  }

  private async getAccessToken(config: NodeRedConfig): Promise<string | null> {
    // Check if we have a direct access token
    if (config.accessToken) {
      return config.accessToken;
    }

    // Check cache
    const cacheKey = this.getConfigKey(config);
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.token;
    }

    // Need username/password to get token
    if (!config.username || !config.password) {
      return null;
    }

    try {
      const client = this.createClient(config);
      const response = await client.post('/auth/token', {
        client_id: 'node-red-admin',
        grant_type: 'password',
        scope: '*',
        username: config.username,
        password: config.password,
      });

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in || 604800; // Default 7 days

      tokenCache.set(cacheKey, {
        token,
        expiry: Date.now() + (expiresIn * 1000) - 60000, // Subtract 1 min buffer
      });

      return token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('nodered', 'Failed to get access token', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  private async getAuthScheme(config: NodeRedConfig): Promise<{ type: string; prompts?: unknown[] }> {
    try {
      const client = this.createClient(config);
      const response = await client.get('/auth/login');
      return response.data;
    } catch (error) {
      // If /auth/login fails, assume no auth
      return { type: 'none' };
    }
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const nrConfig = config as unknown as NodeRedConfig;

    if (!nrConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!nrConfig.port) {
      return { success: false, message: 'Port is required' };
    }

    try {
      // Check auth scheme
      const authScheme = await this.getAuthScheme(nrConfig);
      logger.debug('nodered', 'Auth scheme detected', { type: authScheme.type });

      let token: string | null = null;

      if (authScheme.type !== 'none' && authScheme.type) {
        // Auth is required
        if (!nrConfig.accessToken && (!nrConfig.username || !nrConfig.password)) {
          return {
            success: false,
            message: 'Authentication required. Provide username/password or access token.',
          };
        }

        token = await this.getAccessToken(nrConfig);
        if (!token) {
          return { success: false, message: 'Failed to obtain access token' };
        }
      }

      // Test with authenticated client
      const client = this.createClient(nrConfig, token || undefined);
      const settingsResponse = await client.get('/settings');
      const settings = settingsResponse.data;

      // Try to get flow count
      let flowCount = 0;
      try {
        const flowsResponse = await client.get('/flows');
        const flows = flowsResponse.data;
        flowCount = Array.isArray(flows) ? flows.filter((f: { type?: string }) => f.type === 'tab').length : 0;
      } catch {
        // Flows endpoint might not be accessible
      }

      return {
        success: true,
        message: `Connected to Node-RED v${settings.version || 'unknown'}${flowCount > 0 ? ` (${flowCount} flows)` : ''}`,
        details: {
          version: settings.version,
          httpNodeRoot: settings.httpNodeRoot,
          flowCount,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('nodered', 'Connection test failed', { error: errorMsg });

      if (errorMsg.includes('ECONNREFUSED')) {
        return { success: false, message: `Cannot connect to ${nrConfig.host}:${nrConfig.port}` };
      }
      if (errorMsg.includes('ENOTFOUND')) {
        return { success: false, message: `Host not found: ${nrConfig.host}` };
      }
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        return { success: false, message: 'Invalid credentials' };
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const nrConfig = config as unknown as NodeRedConfig;

    // Get auth if needed
    const authScheme = await this.getAuthScheme(nrConfig);
    let token: string | null = null;
    if (authScheme.type !== 'none' && authScheme.type) {
      token = await this.getAccessToken(nrConfig);
    }

    const client = this.createClient(nrConfig, token || undefined);

    switch (metric) {
      case 'status':
        return this.getStatus(client);
      case 'flows':
        return this.getFlows(client);
      case 'flows-state':
        return this.getFlowsState(client);
      case 'nodes':
        return this.getNodes(client);
      case 'settings':
        return this.getSettings(client);
      case 'diagnostics':
        return this.getDiagnostics(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatus(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const settingsResponse = await client.get('/settings');
      const settings = settingsResponse.data;

      // Try to get flow state
      let flowState = 'unknown';
      try {
        const stateResponse = await client.get('/flows/state');
        flowState = stateResponse.data?.state || 'unknown';
      } catch {
        // Flow state endpoint might not exist
      }

      // Try to get flow count
      let flowCount = 0;
      let nodeCount = 0;
      try {
        const flowsResponse = await client.get('/flows');
        const flows = flowsResponse.data;
        if (Array.isArray(flows)) {
          flowCount = flows.filter((f: { type?: string }) => f.type === 'tab').length;
          nodeCount = flows.filter((f: { type?: string }) => f.type && f.type !== 'tab' && f.type !== 'subflow').length;
        }
      } catch {
        // Flows endpoint might not be accessible
      }

      return {
        status: {
          version: settings.version,
          httpNodeRoot: settings.httpNodeRoot || '/',
          state: flowState,
          flowCount,
          nodeCount,
          contextStores: settings.context?.stores || [],
          functionExternalModules: settings.functionExternalModules || false,
        },
      };
    } catch (error) {
      logger.error('nodered', 'Failed to get status', { error });
      throw error;
    }
  }

  private async getFlows(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/flows');
      const allItems = response.data;

      // Extract tabs (flows) and their info
      const flows = allItems
        .filter((item: { type?: string }) => item.type === 'tab')
        .map((flow: { id: string; label?: string; disabled?: boolean; info?: string; env?: unknown[] }) => ({
          id: flow.id,
          label: flow.label || 'Unnamed Flow',
          disabled: flow.disabled || false,
          info: flow.info || '',
          env: flow.env || [],
        }));

      // Count nodes per flow
      const flowNodeCounts: Record<string, number> = {};
      for (const item of allItems) {
        if (item.z && item.type !== 'tab') {
          flowNodeCounts[item.z] = (flowNodeCounts[item.z] || 0) + 1;
        }
      }

      // Add node counts to flows
      const flowsWithCounts = flows.map((flow: { id: string; label: string; disabled: boolean; info: string }) => ({
        ...flow,
        nodeCount: flowNodeCounts[flow.id] || 0,
      }));

      return { flows: flowsWithCounts };
    } catch (error) {
      logger.error('nodered', 'Failed to get flows', { error });
      throw error;
    }
  }

  private async getFlowsState(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/flows/state');
      return { state: response.data };
    } catch (error) {
      // Flow state endpoint might not exist in older versions
      logger.debug('nodered', 'Flow state endpoint not available');
      return { state: { state: 'unknown' } };
    }
  }

  private async getNodes(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/nodes');
      const nodes = response.data;

      // Group by module
      const modules: Record<string, {
        module: string;
        version: string;
        local: boolean;
        types: string[];
        enabled: boolean;
      }> = {};

      for (const node of nodes) {
        const moduleName = node.module || node.name || node.id || 'unknown';
        if (!modules[moduleName]) {
          // Version can be at node.version or sometimes node.pkg?.version
          const version = node.version || node.pkg?.version || '';
          modules[moduleName] = {
            module: moduleName,
            version: version,
            local: node.local || false,
            types: [],
            enabled: node.enabled !== false,
          };
        } else if (!modules[moduleName].version && node.version) {
          // Update version if we find it on a subsequent node entry
          modules[moduleName].version = node.version;
        }
        if (node.types) {
          modules[moduleName].types.push(...node.types);
        }
      }

      return {
        nodes: Object.values(modules).sort((a, b) => a.module.localeCompare(b.module)),
      };
    } catch (error) {
      logger.error('nodered', 'Failed to get nodes', { error });
      throw error;
    }
  }

  private async getSettings(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/settings');
      return { settings: response.data };
    } catch (error) {
      logger.error('nodered', 'Failed to get settings', { error });
      throw error;
    }
  }

  private async getDiagnostics(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/diagnostics');
      const diag = response.data;

      // Node-RED diagnostics structure varies by version/config
      // Handle multiple possible field locations
      const cpuCount = diag.os?.cpus
        ? (Array.isArray(diag.os.cpus) ? diag.os.cpus.length : diag.os.cpus)
        : null;

      // Load average is an array [1min, 5min, 15min]
      const loadAvg = diag.os?.loadavg;

      const heapTotal = diag.runtime?.heapTotal ?? diag.runtime?.heap?.total ?? null;
      const heapUsed = diag.runtime?.heapUsed ?? diag.runtime?.heap?.used ?? null;

      return {
        diagnostics: {
          report: diag.report,
          os: diag.os ? {
            arch: diag.os.arch,
            platform: diag.os.platform,
            type: diag.os.type,
            release: diag.os.release,
            cpus: cpuCount,
            loadavg: loadAvg,
            uptime: diag.os.uptime,
            mem: {
              total: diag.os.totalmem ?? diag.os.mem?.total ?? 0,
              free: diag.os.freemem ?? diag.os.mem?.free ?? 0,
            },
          } : null,
          runtime: diag.runtime ? {
            version: diag.runtime.nodejs || diag.runtime.version || null,
            isStarted: diag.runtime.isStarted,
            flows: diag.runtime.flows,
            heap: (heapTotal !== null || heapUsed !== null) ? {
              total: heapTotal ?? 0,
              used: heapUsed ?? 0,
            } : null,
          } : null,
          settings: {
            version: diag.settings?.version,
            flowFile: diag.settings?.flowFile,
            contextStorageDefault: diag.settings?.contextStorage?.default,
          },
        },
      };
    } catch (error) {
      logger.error('nodered', 'Failed to get diagnostics', { error });
      // Diagnostics might not be enabled
      return {
        diagnostics: {
          error: 'Diagnostics not available. Enable diagnostics in Node-RED settings.',
        },
      };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Node-RED server version and state',
        widgetTypes: ['nodered-status'],
      },
      {
        id: 'flows',
        name: 'Flows',
        description: 'List of all flows',
        widgetTypes: ['nodered-flow-list'],
      },
      {
        id: 'flows-state',
        name: 'Flow State',
        description: 'Runtime state of flows',
        widgetTypes: ['nodered-flow-status'],
      },
      {
        id: 'nodes',
        name: 'Installed Nodes',
        description: 'List of installed node modules',
        widgetTypes: ['nodered-nodes'],
      },
      {
        id: 'diagnostics',
        name: 'Diagnostics',
        description: 'System diagnostics and resource usage',
        widgetTypes: ['nodered-diagnostics'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication Endpoints
      {
        id: 'auth-login',
        name: 'Get Auth Scheme',
        description: 'Returns the active authentication scheme',
        method: 'GET',
        endpoint: '/auth/login',
        implemented: true,
        category: 'Authentication',
        documentationUrl: 'https://nodered.org/docs/api/admin/methods/',
      },
      {
        id: 'auth-token',
        name: 'Get Access Token',
        description: 'Exchange user credentials for an access token',
        method: 'POST',
        endpoint: '/auth/token',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'client_id', type: 'string', required: true, description: 'Client identifier (node-red-admin)' },
          { name: 'grant_type', type: 'string', required: true, description: 'Grant type (password)' },
          { name: 'scope', type: 'string', required: true, description: 'Access scope' },
          { name: 'username', type: 'string', required: true, description: 'User username' },
          { name: 'password', type: 'string', required: true, description: 'User password' },
        ],
      },
      {
        id: 'auth-revoke',
        name: 'Revoke Token',
        description: 'Revoke an access token when no longer required',
        method: 'POST',
        endpoint: '/auth/revoke',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'token', type: 'string', required: true, description: 'Token to revoke' },
        ],
      },

      // Settings Endpoints - Implemented
      {
        id: 'settings',
        name: 'Get Settings',
        description: 'Get runtime settings including version, httpNodeRoot, and feature flags',
        method: 'GET',
        endpoint: '/settings',
        implemented: true,
        category: 'Settings',
        documentationUrl: 'https://nodered.org/docs/api/admin/methods/',
      },

      // Diagnostics - Implemented
      {
        id: 'diagnostics',
        name: 'Get Diagnostics',
        description: 'Get runtime diagnostics including OS, memory, and Node.js info. Requires diagnostics.enabled in settings.',
        method: 'GET',
        endpoint: '/diagnostics',
        implemented: true,
        category: 'Diagnostics',
        documentationUrl: 'https://nodered.org/docs/api/admin/methods/get/diagnostics/',
      },

      // Flow Endpoints - Implemented
      {
        id: 'flows-get',
        name: 'Get All Flows',
        description: 'Get the active flow configuration including all tabs, nodes, and subflows',
        method: 'GET',
        endpoint: '/flows',
        implemented: true,
        category: 'Flows',
        documentationUrl: 'https://nodered.org/docs/api/admin/methods/get/flows/',
      },
      {
        id: 'flows-set',
        name: 'Set Flows',
        description: 'Set the active flow configuration. Supports different deployment types.',
        method: 'POST',
        endpoint: '/flows',
        implemented: false,
        category: 'Flows',
        parameters: [
          { name: 'flows', type: 'array', required: true, description: 'Array of flow/node objects' },
          { name: 'Node-RED-Deployment-Type', type: 'header', required: false, description: 'Deployment type: full, nodes, flows, or reload' },
        ],
        documentationUrl: 'https://nodered.org/docs/api/admin/methods/post/flows/',
      },
      {
        id: 'flows-state-get',
        name: 'Get Flows State',
        description: 'Get the current runtime state of flows. Requires runtimeState.enabled in settings.',
        method: 'GET',
        endpoint: '/flows/state',
        implemented: true,
        category: 'Flows',
        documentationUrl: 'https://nodered.org/docs/api/admin/methods/get/flows/state/',
      },
      {
        id: 'flows-state-set',
        name: 'Set Flows State',
        description: 'Set the runtime state of flows (start/stop)',
        method: 'POST',
        endpoint: '/flows/state',
        implemented: false,
        category: 'Flows',
        parameters: [
          { name: 'state', type: 'string', required: true, description: 'State: start or stop' },
        ],
      },

      // Individual Flow Endpoints
      {
        id: 'flow-get',
        name: 'Get Flow',
        description: 'Get an individual flow configuration by ID. Use "global" for global config nodes.',
        method: 'GET',
        endpoint: '/flow/:id',
        implemented: false,
        category: 'Flows',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Flow ID or "global"' },
        ],
        documentationUrl: 'https://nodered.org/docs/api/admin/methods/get/flow/',
      },
      {
        id: 'flow-add',
        name: 'Add Flow',
        description: 'Add a new flow to the active configuration',
        method: 'POST',
        endpoint: '/flow',
        implemented: false,
        category: 'Flows',
        parameters: [
          { name: 'label', type: 'string', required: false, description: 'Flow label/name' },
          { name: 'nodes', type: 'array', required: false, description: 'Nodes in the flow' },
        ],
      },
      {
        id: 'flow-update',
        name: 'Update Flow',
        description: 'Update an individual flow',
        method: 'PUT',
        endpoint: '/flow/:id',
        implemented: false,
        category: 'Flows',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Flow ID' },
        ],
      },
      {
        id: 'flow-delete',
        name: 'Delete Flow',
        description: 'Delete an individual flow',
        method: 'DELETE',
        endpoint: '/flow/:id',
        implemented: false,
        category: 'Flows',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Flow ID' },
        ],
      },

      // Node Endpoints - Implemented
      {
        id: 'nodes-get',
        name: 'Get All Nodes',
        description: 'Get a list of all installed node modules and their types',
        method: 'GET',
        endpoint: '/nodes',
        implemented: true,
        category: 'Nodes',
        documentationUrl: 'https://nodered.org/docs/api/admin/methods/',
      },
      {
        id: 'nodes-install',
        name: 'Install Node Module',
        description: 'Install a new node module from npm',
        method: 'POST',
        endpoint: '/nodes',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'module', type: 'string', required: true, description: 'npm module name' },
          { name: 'version', type: 'string', required: false, description: 'Specific version to install' },
        ],
      },
      {
        id: 'node-get',
        name: 'Get Node Info',
        description: 'Get information about a specific node module',
        method: 'GET',
        endpoint: '/nodes/:module',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'module', type: 'string', required: true, description: 'Module name' },
        ],
      },
      {
        id: 'node-enable',
        name: 'Enable/Disable Node',
        description: 'Enable or disable a node module',
        method: 'PUT',
        endpoint: '/nodes/:module',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'module', type: 'string', required: true, description: 'Module name' },
          { name: 'enabled', type: 'boolean', required: true, description: 'Enable or disable' },
        ],
      },
      {
        id: 'node-delete',
        name: 'Uninstall Node Module',
        description: 'Uninstall a node module',
        method: 'DELETE',
        endpoint: '/nodes/:module',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'module', type: 'string', required: true, description: 'Module name to uninstall' },
        ],
      },
      {
        id: 'node-set-get',
        name: 'Get Node Set',
        description: 'Get a specific node set within a module',
        method: 'GET',
        endpoint: '/nodes/:module/:set',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'module', type: 'string', required: true, description: 'Module name' },
          { name: 'set', type: 'string', required: true, description: 'Node set name' },
        ],
      },
      {
        id: 'node-set-enable',
        name: 'Enable/Disable Node Set',
        description: 'Enable or disable a specific node set within a module',
        method: 'PUT',
        endpoint: '/nodes/:module/:set',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'module', type: 'string', required: true, description: 'Module name' },
          { name: 'set', type: 'string', required: true, description: 'Node set name' },
          { name: 'enabled', type: 'boolean', required: true, description: 'Enable or disable' },
        ],
      },

      // Context Store Endpoints
      {
        id: 'context-get',
        name: 'Get Context Keys',
        description: 'Get the keys of a context scope (global, flow, or node)',
        method: 'GET',
        endpoint: '/context/:scope/:id',
        implemented: false,
        category: 'Context',
        parameters: [
          { name: 'scope', type: 'string', required: true, description: 'Context scope: global, flow, or node' },
          { name: 'id', type: 'string', required: true, description: 'Scope ID (flow or node ID)' },
        ],
      },
      {
        id: 'context-get-key',
        name: 'Get Context Value',
        description: 'Get a specific context value',
        method: 'GET',
        endpoint: '/context/:scope/:id/:key',
        implemented: false,
        category: 'Context',
        parameters: [
          { name: 'scope', type: 'string', required: true, description: 'Context scope' },
          { name: 'id', type: 'string', required: true, description: 'Scope ID' },
          { name: 'key', type: 'string', required: true, description: 'Context key' },
        ],
      },
      {
        id: 'context-delete',
        name: 'Delete Context',
        description: 'Delete context data for a scope',
        method: 'DELETE',
        endpoint: '/context/:scope/:id',
        implemented: false,
        category: 'Context',
        parameters: [
          { name: 'scope', type: 'string', required: true, description: 'Context scope' },
          { name: 'id', type: 'string', required: true, description: 'Scope ID' },
        ],
      },

      // Library Endpoints
      {
        id: 'library-get',
        name: 'Get Library Entry',
        description: 'Get a library entry (flow templates, functions, etc.)',
        method: 'GET',
        endpoint: '/library/:type/:path',
        implemented: false,
        category: 'Library',
        parameters: [
          { name: 'type', type: 'string', required: true, description: 'Library type (flows, functions, etc.)' },
          { name: 'path', type: 'string', required: true, description: 'Path to the entry' },
        ],
      },
      {
        id: 'library-save',
        name: 'Save Library Entry',
        description: 'Save a new library entry',
        method: 'POST',
        endpoint: '/library/:type/:path',
        implemented: false,
        category: 'Library',
        parameters: [
          { name: 'type', type: 'string', required: true, description: 'Library type' },
          { name: 'path', type: 'string', required: true, description: 'Path to save' },
        ],
      },

      // Credentials
      {
        id: 'credentials-get',
        name: 'Get Credentials',
        description: 'Get credentials for a node (returns obfuscated values)',
        method: 'GET',
        endpoint: '/credentials/:type/:id',
        implemented: false,
        category: 'Credentials',
        parameters: [
          { name: 'type', type: 'string', required: true, description: 'Node type' },
          { name: 'id', type: 'string', required: true, description: 'Node ID' },
        ],
      },

      // Debug Endpoints
      {
        id: 'debug-subscribe',
        name: 'Subscribe to Debug',
        description: 'WebSocket endpoint for debug message streaming',
        method: 'GET',
        endpoint: '/comms',
        implemented: false,
        category: 'Debug',
      },

      // Inject Trigger
      {
        id: 'inject-trigger',
        name: 'Trigger Inject Node',
        description: 'Trigger an inject node to fire',
        method: 'POST',
        endpoint: '/inject/:id',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Inject node ID' },
        ],
      },

      // Project Endpoints (if projects enabled)
      {
        id: 'projects-list',
        name: 'List Projects',
        description: 'Get list of all projects (requires projects feature)',
        method: 'GET',
        endpoint: '/projects',
        implemented: false,
        category: 'Projects',
      },
      {
        id: 'project-get',
        name: 'Get Project',
        description: 'Get details of a specific project',
        method: 'GET',
        endpoint: '/projects/:id',
        implemented: false,
        category: 'Projects',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
        ],
      },
      {
        id: 'project-create',
        name: 'Create Project',
        description: 'Create a new project',
        method: 'POST',
        endpoint: '/projects',
        implemented: false,
        category: 'Projects',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Project name' },
        ],
      },
      {
        id: 'project-update',
        name: 'Update Project',
        description: 'Update project settings',
        method: 'PUT',
        endpoint: '/projects/:id',
        implemented: false,
        category: 'Projects',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
        ],
      },
      {
        id: 'project-delete',
        name: 'Delete Project',
        description: 'Delete a project',
        method: 'DELETE',
        endpoint: '/projects/:id',
        implemented: false,
        category: 'Projects',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
        ],
      },
      {
        id: 'project-status',
        name: 'Get Project Status',
        description: 'Get git status for a project',
        method: 'GET',
        endpoint: '/projects/:id/status',
        implemented: false,
        category: 'Projects',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
        ],
      },
      {
        id: 'project-commit',
        name: 'Commit Project Changes',
        description: 'Commit changes to the project repository',
        method: 'POST',
        endpoint: '/projects/:id/commit',
        implemented: false,
        category: 'Projects',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
          { name: 'message', type: 'string', required: true, description: 'Commit message' },
        ],
      },
      {
        id: 'project-push',
        name: 'Push Project',
        description: 'Push project changes to remote',
        method: 'POST',
        endpoint: '/projects/:id/push',
        implemented: false,
        category: 'Projects',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
        ],
      },
      {
        id: 'project-pull',
        name: 'Pull Project',
        description: 'Pull project changes from remote',
        method: 'POST',
        endpoint: '/projects/:id/pull',
        implemented: false,
        category: 'Projects',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
        ],
      },

      // Subflow Endpoints
      {
        id: 'subflow-get',
        name: 'Get Subflow',
        description: 'Get a subflow definition',
        method: 'GET',
        endpoint: '/subflows/:id',
        implemented: false,
        category: 'Subflows',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Subflow ID' },
        ],
      },
      {
        id: 'subflow-create',
        name: 'Create Subflow',
        description: 'Create a new subflow',
        method: 'POST',
        endpoint: '/subflows',
        implemented: false,
        category: 'Subflows',
      },
      {
        id: 'subflow-update',
        name: 'Update Subflow',
        description: 'Update a subflow definition',
        method: 'PUT',
        endpoint: '/subflows/:id',
        implemented: false,
        category: 'Subflows',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Subflow ID' },
        ],
      },
      {
        id: 'subflow-delete',
        name: 'Delete Subflow',
        description: 'Delete a subflow',
        method: 'DELETE',
        endpoint: '/subflows/:id',
        implemented: false,
        category: 'Subflows',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Subflow ID' },
        ],
      },
    ];
  }
}
