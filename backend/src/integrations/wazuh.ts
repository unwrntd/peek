import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationConfig, IntegrationData } from '../types';
import { logger } from '../services/logger';

interface WazuhConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL?: boolean;
}

interface TokenCache {
  token: string;
  expiry: number;
}

const tokenCache = new Map<string, TokenCache>();

export class WazuhIntegration extends BaseIntegration {
  readonly type = 'wazuh';
  readonly name = 'Wazuh';

  private getConfigKey(config: WazuhConfig): string {
    return `wazuh_${config.host}_${config.port}_${config.username}`;
  }

  private getBaseUrl(config: WazuhConfig): string {
    return `https://${config.host}:${config.port}`;
  }

  private async getAccessToken(config: WazuhConfig): Promise<string> {
    const cacheKey = this.getConfigKey(config);
    const cached = tokenCache.get(cacheKey);

    // JWT tokens typically expire after 15 minutes
    if (cached && cached.expiry > Date.now()) {
      return cached.token;
    }

    const authString = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    try {
      const response = await axios.post(
        `${this.getBaseUrl(config)}/security/user/authenticate?raw=true`,
        {},
        {
          headers: {
            'Authorization': `Basic ${authString}`,
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: config.verifySSL ?? false,
          }),
          timeout: 15000,
        }
      );

      const token = response.data;
      tokenCache.set(cacheKey, {
        token,
        expiry: Date.now() + 14 * 60 * 1000, // 14 minutes (1 min buffer)
      });

      return token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('wazuh', 'Failed to get access token', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  private async createClient(config: WazuhConfig): Promise<AxiosInstance> {
    const token = await this.getAccessToken(config);

    return axios.create({
      baseURL: this.getBaseUrl(config),
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const wazuhConfig = config as unknown as WazuhConfig;

    if (!wazuhConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!wazuhConfig.port) {
      return { success: false, message: 'Port is required' };
    }
    if (!wazuhConfig.username || !wazuhConfig.password) {
      return { success: false, message: 'Username and password are required' };
    }

    try {
      const client = await this.createClient(wazuhConfig);

      const [infoRes, agentSummaryRes] = await Promise.all([
        client.get('/'),
        client.get('/agents/summary/status'),
      ]);

      const version = infoRes.data.data?.api_version || 'unknown';
      const agents = agentSummaryRes.data.data?.connection?.total || 0;

      return {
        success: true,
        message: `Connected to Wazuh API v${version} (${agents} agents)`,
        details: { version, agents },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('wazuh', 'Connection test failed', { error: errorMsg });

      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        return { success: false, message: 'Invalid credentials' };
      }
      if (errorMsg.includes('ECONNREFUSED')) {
        return { success: false, message: `Connection refused at ${wazuhConfig.host}:${wazuhConfig.port}` };
      }
      if (errorMsg.includes('ENOTFOUND')) {
        return { success: false, message: `Host not found: ${wazuhConfig.host}` };
      }
      if (errorMsg.includes('certificate')) {
        return { success: false, message: 'SSL certificate error. Try disabling SSL verification.' };
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const wazuhConfig = config as unknown as WazuhConfig;
    const client = await this.createClient(wazuhConfig);

    switch (metric) {
      case 'status':
        return this.getStatus(client);
      case 'agent-summary':
        return this.getAgentSummary(client);
      case 'agents':
        return this.getAgents(client);
      case 'vulnerabilities':
        return this.getVulnerabilities(client);
      case 'cluster':
        return this.getClusterStatus(client);
      case 'stats':
        return this.getStats(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatus(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [infoRes, statusRes] = await Promise.all([
        client.get('/'),
        client.get('/manager/status'),
      ]);

      const services = statusRes.data.data?.affected_items?.[0] || {};
      const runningCount = Object.values(services).filter(s => s === 'running').length;
      const totalCount = Object.keys(services).length;

      return {
        status: {
          version: infoRes.data.data?.api_version,
          title: infoRes.data.data?.title,
          hostname: infoRes.data.data?.hostname,
          services,
          runningServices: runningCount,
          totalServices: totalCount,
          healthy: runningCount === totalCount,
        },
      };
    } catch (error) {
      logger.error('wazuh', 'Failed to get status', { error });
      throw error;
    }
  }

  private async getAgentSummary(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/agents/summary/status');
      const data = response.data.data;

      return {
        summary: {
          active: data.connection?.active || 0,
          disconnected: data.connection?.disconnected || 0,
          neverConnected: data.connection?.never_connected || 0,
          pending: data.connection?.pending || 0,
          total: data.connection?.total || 0,
        },
      };
    } catch (error) {
      logger.error('wazuh', 'Failed to get agent summary', { error });
      throw error;
    }
  }

  private async getAgents(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/agents', {
        params: {
          limit: 500,
          select: 'id,name,ip,status,os,version,lastKeepAlive,group,node_name',
        },
      });

      const agents = response.data.data?.affected_items || [];

      return {
        agents: agents.map((agent: Record<string, unknown>) => ({
          id: agent.id,
          name: agent.name,
          ip: agent.ip,
          status: agent.status,
          os: agent.os,
          version: agent.version,
          lastKeepAlive: agent.lastKeepAlive,
          group: agent.group,
          nodeName: agent.node_name,
        })),
        total: response.data.data?.total_affected_items || 0,
      };
    } catch (error) {
      logger.error('wazuh', 'Failed to get agents', { error });
      throw error;
    }
  }

  private async getVulnerabilities(client: AxiosInstance): Promise<IntegrationData> {
    try {
      // Get active agents first
      const agentsRes = await client.get('/agents', {
        params: { limit: 100, status: 'active', select: 'id,name' },
      });

      const agents = agentsRes.data.data?.affected_items || [];

      // Fetch vulnerabilities for up to 10 agents (to avoid overwhelming the API)
      const vulnPromises = agents.slice(0, 10).map((agent: { id: string; name: string }) =>
        client.get(`/vulnerability/${agent.id}`, { params: { limit: 100 } })
          .then(res => ({
            agentId: agent.id,
            agentName: agent.name,
            vulns: res.data.data?.affected_items || [],
          }))
          .catch(() => ({
            agentId: agent.id,
            agentName: agent.name,
            vulns: [],
          }))
      );

      const results = await Promise.all(vulnPromises);

      // Aggregate vulnerabilities
      const allVulns = results.flatMap(r =>
        r.vulns.map((v: Record<string, unknown>) => ({
          ...v,
          agentId: r.agentId,
          agentName: r.agentName,
        }))
      );

      const bySeverity = {
        critical: allVulns.filter((v: { severity?: string }) =>
          v.severity?.toLowerCase() === 'critical'
        ).length,
        high: allVulns.filter((v: { severity?: string }) =>
          v.severity?.toLowerCase() === 'high'
        ).length,
        medium: allVulns.filter((v: { severity?: string }) =>
          v.severity?.toLowerCase() === 'medium'
        ).length,
        low: allVulns.filter((v: { severity?: string }) =>
          v.severity?.toLowerCase() === 'low'
        ).length,
      };

      // Get top vulnerabilities (by CVSS score)
      const sortedVulns = [...allVulns].sort((a: { cvss3_score?: number }, b: { cvss3_score?: number }) =>
        (b.cvss3_score || 0) - (a.cvss3_score || 0)
      );

      return {
        vulnerabilities: {
          total: allVulns.length,
          bySeverity,
          agentsScanned: results.length,
          items: sortedVulns.slice(0, 50),
        },
      };
    } catch (error) {
      logger.error('wazuh', 'Failed to get vulnerabilities', { error });
      throw error;
    }
  }

  private async getClusterStatus(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [statusRes, nodesRes] = await Promise.all([
        client.get('/cluster/status'),
        client.get('/cluster/nodes').catch(() => ({ data: { data: { affected_items: [] } } })),
      ]);

      return {
        cluster: {
          enabled: statusRes.data.data?.enabled || false,
          running: statusRes.data.data?.running || false,
          nodes: nodesRes.data.data?.affected_items || [],
        },
      };
    } catch (error) {
      // Cluster might not be configured
      logger.debug('wazuh', 'Cluster status not available', { error });
      return {
        cluster: {
          enabled: false,
          running: false,
          nodes: [],
        },
      };
    }
  }

  private async getStats(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [statsRes, hourlyRes] = await Promise.all([
        client.get('/manager/stats'),
        client.get('/manager/stats/hourly').catch(() => ({ data: { data: { affected_items: [] } } })),
      ]);

      const stats = statsRes.data.data?.affected_items || [];
      const hourly = hourlyRes.data.data?.affected_items || [];

      // Calculate totals from stats
      let totalEvents = 0;
      let totalAlerts = 0;
      let totalFirewallEvents = 0;
      let totalSyscheck = 0;

      for (const stat of stats) {
        totalEvents += stat.total_events || 0;
        totalAlerts += stat.alerts || 0;
        totalFirewallEvents += stat.firewall || 0;
        totalSyscheck += stat.syscheck || 0;
      }

      return {
        stats: {
          totalEvents,
          totalAlerts,
          totalFirewallEvents,
          totalSyscheck,
          hourly: hourly.slice(-24), // Last 24 hours
          raw: stats.slice(-12), // Last 12 entries
        },
      };
    } catch (error) {
      logger.error('wazuh', 'Failed to get stats', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Manager status and services',
        widgetTypes: ['wazuh-status'],
      },
      {
        id: 'agent-summary',
        name: 'Agent Summary',
        description: 'Agent connection summary',
        widgetTypes: ['wazuh-agent-overview'],
      },
      {
        id: 'agents',
        name: 'Agents',
        description: 'List of all agents',
        widgetTypes: ['wazuh-agents'],
      },
      {
        id: 'vulnerabilities',
        name: 'Vulnerabilities',
        description: 'Vulnerability data',
        widgetTypes: ['wazuh-vulnerabilities'],
      },
      {
        id: 'cluster',
        name: 'Cluster',
        description: 'Cluster status',
        widgetTypes: ['wazuh-cluster'],
      },
      {
        id: 'stats',
        name: 'Statistics',
        description: 'Manager statistics',
        widgetTypes: ['wazuh-stats'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'authenticate',
        name: 'Authenticate',
        description: 'Authenticate with username and password to obtain a JWT token',
        method: 'POST',
        endpoint: '/security/user/authenticate',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'raw', type: 'boolean', required: false, description: 'Return raw token string instead of JSON' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/getting-started.html',
      },
      {
        id: 'authenticate-run-as',
        name: 'Authenticate (Run As)',
        description: 'Authenticate with run_as capability to impersonate another user',
        method: 'POST',
        endpoint: '/security/user/authenticate/run_as',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'logout',
        name: 'Logout',
        description: 'Revoke the current JWT token',
        method: 'DELETE',
        endpoint: '/security/user/authenticate',
        implemented: false,
        category: 'Authentication',
      },

      // Manager - Partially Implemented
      {
        id: 'manager-info',
        name: 'Get Manager Info',
        description: 'Get Wazuh manager information including version and hostname',
        method: 'GET',
        endpoint: '/',
        implemented: true,
        category: 'Manager',
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'manager-status',
        name: 'Get Manager Status',
        description: 'Get status of Wazuh manager services (running/stopped)',
        method: 'GET',
        endpoint: '/manager/status',
        implemented: true,
        category: 'Manager',
      },
      {
        id: 'manager-info-detailed',
        name: 'Get Manager Detailed Info',
        description: 'Get detailed manager information',
        method: 'GET',
        endpoint: '/manager/info',
        implemented: false,
        category: 'Manager',
      },
      {
        id: 'manager-configuration',
        name: 'Get Manager Configuration',
        description: 'Get Wazuh manager configuration (ossec.conf)',
        method: 'GET',
        endpoint: '/manager/configuration',
        implemented: false,
        category: 'Manager',
        parameters: [
          { name: 'section', type: 'string', required: false, description: 'Configuration section to retrieve' },
          { name: 'field', type: 'string', required: false, description: 'Configuration field to retrieve' },
        ],
      },
      {
        id: 'manager-configuration-update',
        name: 'Update Manager Configuration',
        description: 'Update Wazuh manager configuration',
        method: 'PUT',
        endpoint: '/manager/configuration',
        implemented: false,
        category: 'Manager',
      },
      {
        id: 'manager-stats',
        name: 'Get Manager Stats',
        description: 'Get Wazuh manager statistical information',
        method: 'GET',
        endpoint: '/manager/stats',
        implemented: true,
        category: 'Manager',
      },
      {
        id: 'manager-stats-hourly',
        name: 'Get Manager Hourly Stats',
        description: 'Get Wazuh manager hourly statistical information',
        method: 'GET',
        endpoint: '/manager/stats/hourly',
        implemented: true,
        category: 'Manager',
      },
      {
        id: 'manager-stats-weekly',
        name: 'Get Manager Weekly Stats',
        description: 'Get Wazuh manager weekly statistical information',
        method: 'GET',
        endpoint: '/manager/stats/weekly',
        implemented: false,
        category: 'Manager',
      },
      {
        id: 'manager-stats-analysisd',
        name: 'Get Analysisd Stats',
        description: 'Get Wazuh analysisd statistical information',
        method: 'GET',
        endpoint: '/manager/stats/analysisd',
        implemented: false,
        category: 'Manager',
      },
      {
        id: 'manager-stats-remoted',
        name: 'Get Remoted Stats',
        description: 'Get Wazuh remoted statistical information',
        method: 'GET',
        endpoint: '/manager/stats/remoted',
        implemented: false,
        category: 'Manager',
      },
      {
        id: 'manager-logs',
        name: 'Get Manager Logs',
        description: 'Get last 2000 Wazuh manager logs',
        method: 'GET',
        endpoint: '/manager/logs',
        implemented: false,
        category: 'Manager',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum number of elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in log messages' },
          { name: 'tag', type: 'string', required: false, description: 'Filter by log tag' },
          { name: 'level', type: 'string', required: false, description: 'Filter by log level' },
        ],
      },
      {
        id: 'manager-logs-summary',
        name: 'Get Manager Logs Summary',
        description: 'Get summary of Wazuh manager logs',
        method: 'GET',
        endpoint: '/manager/logs/summary',
        implemented: false,
        category: 'Manager',
      },
      {
        id: 'manager-restart',
        name: 'Restart Manager',
        description: 'Restart Wazuh manager',
        method: 'PUT',
        endpoint: '/manager/restart',
        implemented: false,
        category: 'Manager',
      },
      {
        id: 'manager-api-config',
        name: 'Get API Configuration',
        description: 'Get current API configuration',
        method: 'GET',
        endpoint: '/manager/api/config',
        implemented: false,
        category: 'Manager',
      },
      {
        id: 'manager-daemons-stats',
        name: 'Get Daemons Stats',
        description: 'Get statistical information of manager daemons',
        method: 'GET',
        endpoint: '/manager/daemons/stats',
        implemented: false,
        category: 'Manager',
      },

      // Agents - Partially Implemented
      {
        id: 'agents-list',
        name: 'List Agents',
        description: 'Get all agents with optional filtering',
        method: 'GET',
        endpoint: '/agents',
        implemented: true,
        category: 'Agents',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return (max 100000)' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return (comma-separated)' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in agent name and IP' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status: active, disconnected, pending, never_connected' },
          { name: 'q', type: 'string', required: false, description: 'Query in Wazuh Query Language' },
          { name: 'older_than', type: 'string', required: false, description: 'Filter agents older than time (e.g. 1d, 1w)' },
          { name: 'os.platform', type: 'string', required: false, description: 'Filter by OS platform' },
          { name: 'os.version', type: 'string', required: false, description: 'Filter by OS version' },
          { name: 'manager', type: 'string', required: false, description: 'Filter by manager hostname' },
          { name: 'version', type: 'string', required: false, description: 'Filter by Wazuh version' },
          { name: 'group', type: 'string', required: false, description: 'Filter by group name' },
          { name: 'node_name', type: 'string', required: false, description: 'Filter by node name' },
          { name: 'name', type: 'string', required: false, description: 'Filter by agent name' },
          { name: 'ip', type: 'string', required: false, description: 'Filter by agent IP' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'agents-summary-status',
        name: 'Get Agent Status Summary',
        description: 'Get summary of agent connection statuses',
        method: 'GET',
        endpoint: '/agents/summary/status',
        implemented: true,
        category: 'Agents',
      },
      {
        id: 'agents-summary-os',
        name: 'Get Agent OS Summary',
        description: 'Get summary of agent operating systems',
        method: 'GET',
        endpoint: '/agents/summary/os',
        implemented: false,
        category: 'Agents',
      },
      {
        id: 'agents-get',
        name: 'Get Agent',
        description: 'Get information about a specific agent',
        method: 'GET',
        endpoint: '/agents/{agent_id}',
        implemented: false,
        category: 'Agents',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
        ],
      },
      {
        id: 'agents-create',
        name: 'Add Agent',
        description: 'Add a new agent to the manager',
        method: 'POST',
        endpoint: '/agents',
        implemented: false,
        category: 'Agents',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Agent name' },
          { name: 'ip', type: 'string', required: false, description: 'Agent IP (default: any)' },
          { name: 'force_time', type: 'number', required: false, description: 'Remove old agent with same name/IP after X seconds' },
        ],
      },
      {
        id: 'agents-delete',
        name: 'Delete Agents',
        description: 'Delete one or more agents',
        method: 'DELETE',
        endpoint: '/agents',
        implemented: false,
        category: 'Agents',
        parameters: [
          { name: 'agents_list', type: 'string', required: true, description: 'List of agent IDs (comma-separated)' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status' },
          { name: 'older_than', type: 'string', required: false, description: 'Delete agents older than' },
        ],
      },
      {
        id: 'agents-restart',
        name: 'Restart Agents',
        description: 'Restart one or more agents',
        method: 'PUT',
        endpoint: '/agents/restart',
        implemented: false,
        category: 'Agents',
        parameters: [
          { name: 'agents_list', type: 'string', required: false, description: 'List of agent IDs (comma-separated)' },
        ],
      },
      {
        id: 'agents-key',
        name: 'Get Agent Key',
        description: 'Get the key of an agent',
        method: 'GET',
        endpoint: '/agents/{agent_id}/key',
        implemented: false,
        category: 'Agents',
      },
      {
        id: 'agents-upgrade',
        name: 'Upgrade Agents',
        description: 'Upgrade agents to the latest version',
        method: 'PUT',
        endpoint: '/agents/upgrade',
        implemented: false,
        category: 'Agents',
        parameters: [
          { name: 'agents_list', type: 'string', required: true, description: 'List of agent IDs' },
        ],
      },
      {
        id: 'agents-upgrade-result',
        name: 'Get Upgrade Result',
        description: 'Get the result of an agent upgrade task',
        method: 'GET',
        endpoint: '/agents/upgrade_result',
        implemented: false,
        category: 'Agents',
      },
      {
        id: 'agents-outdated',
        name: 'Get Outdated Agents',
        description: 'Get list of outdated agents',
        method: 'GET',
        endpoint: '/agents/outdated',
        implemented: false,
        category: 'Agents',
      },
      {
        id: 'agents-no-group',
        name: 'Get Agents Without Group',
        description: 'Get list of agents without an assigned group',
        method: 'GET',
        endpoint: '/agents/no_group',
        implemented: false,
        category: 'Agents',
      },
      {
        id: 'agents-stats-distinct',
        name: 'Get Agent Stats Distinct',
        description: 'Get distinct values for agent fields',
        method: 'GET',
        endpoint: '/agents/stats/distinct',
        implemented: false,
        category: 'Agents',
      },
      {
        id: 'agents-configuration',
        name: 'Get Agent Configuration',
        description: 'Get active configuration of an agent',
        method: 'GET',
        endpoint: '/agents/{agent_id}/config/{component}/{configuration}',
        implemented: false,
        category: 'Agents',
      },

      // Groups
      {
        id: 'groups-list',
        name: 'List Groups',
        description: 'Get all agent groups',
        method: 'GET',
        endpoint: '/groups',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in group name' },
        ],
      },
      {
        id: 'groups-get',
        name: 'Get Group',
        description: 'Get information about a specific group',
        method: 'GET',
        endpoint: '/groups/{group_id}',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'groups-create',
        name: 'Create Group',
        description: 'Create a new agent group',
        method: 'POST',
        endpoint: '/groups',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'group_id', type: 'string', required: true, description: 'Group name' },
        ],
      },
      {
        id: 'groups-delete',
        name: 'Delete Groups',
        description: 'Delete one or more groups',
        method: 'DELETE',
        endpoint: '/groups',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'groups_list', type: 'string', required: true, description: 'List of group IDs' },
        ],
      },
      {
        id: 'groups-agents',
        name: 'Get Group Agents',
        description: 'Get agents belonging to a group',
        method: 'GET',
        endpoint: '/groups/{group_id}/agents',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'groups-configuration',
        name: 'Get Group Configuration',
        description: 'Get group configuration',
        method: 'GET',
        endpoint: '/groups/{group_id}/configuration',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'groups-configuration-update',
        name: 'Update Group Configuration',
        description: 'Update group configuration',
        method: 'PUT',
        endpoint: '/groups/{group_id}/configuration',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'groups-files',
        name: 'Get Group Files',
        description: 'Get files in a group',
        method: 'GET',
        endpoint: '/groups/{group_id}/files',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'groups-files-get',
        name: 'Get Group File Content',
        description: 'Get content of a group file',
        method: 'GET',
        endpoint: '/groups/{group_id}/files/{file_name}',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'agents-group-assign',
        name: 'Assign Agents to Group',
        description: 'Assign agents to a group',
        method: 'PUT',
        endpoint: '/agents/group/{group_id}',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'agents_list', type: 'string', required: true, description: 'List of agent IDs' },
        ],
      },
      {
        id: 'agents-group-remove',
        name: 'Remove Agents from Group',
        description: 'Remove agents from a group',
        method: 'DELETE',
        endpoint: '/agents/group/{group_id}',
        implemented: false,
        category: 'Groups',
      },

      // Cluster - Partially Implemented
      {
        id: 'cluster-status',
        name: 'Get Cluster Status',
        description: 'Get cluster status (enabled/disabled, running/stopped)',
        method: 'GET',
        endpoint: '/cluster/status',
        implemented: true,
        category: 'Cluster',
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'cluster-nodes',
        name: 'Get Cluster Nodes',
        description: 'Get information about cluster nodes',
        method: 'GET',
        endpoint: '/cluster/nodes',
        implemented: true,
        category: 'Cluster',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in node name' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'type', type: 'string', required: false, description: 'Filter by node type (master/worker)' },
        ],
      },
      {
        id: 'cluster-healthcheck',
        name: 'Get Cluster Health',
        description: 'Get cluster health information',
        method: 'GET',
        endpoint: '/cluster/healthcheck',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-local-info',
        name: 'Get Local Node Info',
        description: 'Get information about the local node',
        method: 'GET',
        endpoint: '/cluster/local/info',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-local-config',
        name: 'Get Local Node Config',
        description: 'Get local node cluster configuration',
        method: 'GET',
        endpoint: '/cluster/local/config',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-api-config',
        name: 'Get Cluster API Config',
        description: 'Get API configuration for all cluster nodes',
        method: 'GET',
        endpoint: '/cluster/api/config',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-configuration',
        name: 'Get Cluster Configuration',
        description: 'Get cluster configuration for a node',
        method: 'GET',
        endpoint: '/cluster/{node_id}/configuration',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-stats',
        name: 'Get Cluster Stats',
        description: 'Get cluster statistics for a node',
        method: 'GET',
        endpoint: '/cluster/{node_id}/stats',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-stats-hourly',
        name: 'Get Cluster Hourly Stats',
        description: 'Get cluster hourly statistics for a node',
        method: 'GET',
        endpoint: '/cluster/{node_id}/stats/hourly',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-stats-weekly',
        name: 'Get Cluster Weekly Stats',
        description: 'Get cluster weekly statistics for a node',
        method: 'GET',
        endpoint: '/cluster/{node_id}/stats/weekly',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-logs',
        name: 'Get Cluster Node Logs',
        description: 'Get logs from a cluster node',
        method: 'GET',
        endpoint: '/cluster/{node_id}/logs',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-restart',
        name: 'Restart Cluster Nodes',
        description: 'Restart cluster nodes',
        method: 'PUT',
        endpoint: '/cluster/restart',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-daemons-stats',
        name: 'Get Cluster Daemons Stats',
        description: 'Get cluster daemon statistics for a node',
        method: 'GET',
        endpoint: '/cluster/{node_id}/daemons/stats',
        implemented: false,
        category: 'Cluster',
      },

      // Vulnerability - Partially Implemented
      {
        id: 'vulnerability-agent',
        name: 'Get Agent Vulnerabilities',
        description: 'Get vulnerability information for a specific agent',
        method: 'GET',
        endpoint: '/vulnerability/{agent_id}',
        implemented: true,
        category: 'Vulnerability',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in vulnerability fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'q', type: 'string', required: false, description: 'Query in Wazuh Query Language' },
          { name: 'severity', type: 'string', required: false, description: 'Filter by severity: Critical, High, Medium, Low' },
          { name: 'cve', type: 'string', required: false, description: 'Filter by CVE ID' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'vulnerability-agent-last-scan',
        name: 'Get Last Vulnerability Scan',
        description: 'Get information about the last vulnerability scan for an agent',
        method: 'GET',
        endpoint: '/vulnerability/{agent_id}/last_scan',
        implemented: false,
        category: 'Vulnerability',
      },
      {
        id: 'vulnerability-agent-summary',
        name: 'Get Agent Vulnerability Summary',
        description: 'Get vulnerability summary for an agent',
        method: 'GET',
        endpoint: '/vulnerability/{agent_id}/summary/{field}',
        implemented: false,
        category: 'Vulnerability',
      },

      // Syscheck (File Integrity Monitoring)
      {
        id: 'syscheck-agent',
        name: 'Get Syscheck Data',
        description: 'Get file integrity monitoring data for an agent',
        method: 'GET',
        endpoint: '/syscheck/{agent_id}',
        implemented: false,
        category: 'Syscheck',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in file paths' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'q', type: 'string', required: false, description: 'Query in Wazuh Query Language' },
          { name: 'file', type: 'string', required: false, description: 'Filter by file path' },
          { name: 'type', type: 'string', required: false, description: 'Filter by entry type (file/registry)' },
          { name: 'summary', type: 'boolean', required: false, description: 'Return summary instead of full data' },
          { name: 'md5', type: 'string', required: false, description: 'Filter by MD5 hash' },
          { name: 'sha1', type: 'string', required: false, description: 'Filter by SHA1 hash' },
          { name: 'sha256', type: 'string', required: false, description: 'Filter by SHA256 hash' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'syscheck-agent-last-scan',
        name: 'Get Syscheck Last Scan',
        description: 'Get information about the last syscheck scan',
        method: 'GET',
        endpoint: '/syscheck/{agent_id}/last_scan',
        implemented: false,
        category: 'Syscheck',
      },
      {
        id: 'syscheck-run',
        name: 'Run Syscheck Scan',
        description: 'Run a syscheck scan on agents',
        method: 'PUT',
        endpoint: '/syscheck',
        implemented: false,
        category: 'Syscheck',
        parameters: [
          { name: 'agents_list', type: 'string', required: false, description: 'List of agent IDs' },
        ],
      },
      {
        id: 'syscheck-clear',
        name: 'Clear Syscheck Database',
        description: 'Clear syscheck database for an agent',
        method: 'DELETE',
        endpoint: '/syscheck/{agent_id}',
        implemented: false,
        category: 'Syscheck',
      },

      // Rootcheck
      {
        id: 'rootcheck-agent',
        name: 'Get Rootcheck Data',
        description: 'Get rootcheck database for an agent',
        method: 'GET',
        endpoint: '/rootcheck/{agent_id}',
        implemented: false,
        category: 'Rootcheck',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in event fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'q', type: 'string', required: false, description: 'Query in Wazuh Query Language' },
          { name: 'pci', type: 'string', required: false, description: 'Filter by PCI DSS requirement' },
          { name: 'cis', type: 'string', required: false, description: 'Filter by CIS benchmark' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'rootcheck-agent-last-scan',
        name: 'Get Rootcheck Last Scan',
        description: 'Get information about the last rootcheck scan',
        method: 'GET',
        endpoint: '/rootcheck/{agent_id}/last_scan',
        implemented: false,
        category: 'Rootcheck',
      },
      {
        id: 'rootcheck-run',
        name: 'Run Rootcheck Scan',
        description: 'Run a rootcheck scan on agents',
        method: 'PUT',
        endpoint: '/rootcheck',
        implemented: false,
        category: 'Rootcheck',
        parameters: [
          { name: 'agents_list', type: 'string', required: false, description: 'List of agent IDs' },
        ],
      },
      {
        id: 'rootcheck-clear',
        name: 'Clear Rootcheck Database',
        description: 'Clear rootcheck database for an agent',
        method: 'DELETE',
        endpoint: '/experimental/rootcheck/{agent_id}',
        implemented: false,
        category: 'Rootcheck',
      },

      // Security Configuration Assessment (SCA)
      {
        id: 'sca-agent',
        name: 'Get SCA Policies',
        description: 'Get SCA policies run on an agent',
        method: 'GET',
        endpoint: '/sca/{agent_id}',
        implemented: false,
        category: 'SCA',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in policy fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'q', type: 'string', required: false, description: 'Query in Wazuh Query Language' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'sca-agent-policy',
        name: 'Get SCA Policy Checks',
        description: 'Get SCA checks for a specific policy',
        method: 'GET',
        endpoint: '/sca/{agent_id}/checks/{policy_id}',
        implemented: false,
        category: 'SCA',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'policy_id', type: 'string', required: true, description: 'Policy ID' },
          { name: 'result', type: 'string', required: false, description: 'Filter by result: passed, failed, not applicable' },
        ],
      },

      // CIS-CAT
      {
        id: 'ciscat-agent',
        name: 'Get CIS-CAT Results',
        description: 'Get CIS-CAT scan results for an agent',
        method: 'GET',
        endpoint: '/ciscat/{agent_id}/results',
        implemented: false,
        category: 'CIS-CAT',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in result fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'benchmark', type: 'string', required: false, description: 'Filter by benchmark name' },
          { name: 'profile', type: 'string', required: false, description: 'Filter by profile' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },

      // Syscollector (System Inventory)
      {
        id: 'syscollector-hardware',
        name: 'Get Hardware Info',
        description: 'Get hardware information for an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/hardware',
        implemented: false,
        category: 'Syscollector',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
        ],
      },
      {
        id: 'syscollector-os',
        name: 'Get OS Info',
        description: 'Get operating system information for an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/os',
        implemented: false,
        category: 'Syscollector',
      },
      {
        id: 'syscollector-packages',
        name: 'Get Installed Packages',
        description: 'Get list of installed packages on an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/packages',
        implemented: false,
        category: 'Syscollector',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in package fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'vendor', type: 'string', required: false, description: 'Filter by vendor' },
          { name: 'name', type: 'string', required: false, description: 'Filter by package name' },
          { name: 'version', type: 'string', required: false, description: 'Filter by version' },
        ],
      },
      {
        id: 'syscollector-hotfixes',
        name: 'Get Hotfixes',
        description: 'Get list of Windows hotfixes on an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/hotfixes',
        implemented: false,
        category: 'Syscollector',
      },
      {
        id: 'syscollector-processes',
        name: 'Get Processes',
        description: 'Get list of running processes on an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/processes',
        implemented: false,
        category: 'Syscollector',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in process fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'pid', type: 'number', required: false, description: 'Filter by process ID' },
          { name: 'name', type: 'string', required: false, description: 'Filter by process name' },
        ],
      },
      {
        id: 'syscollector-ports',
        name: 'Get Open Ports',
        description: 'Get list of open ports on an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/ports',
        implemented: false,
        category: 'Syscollector',
        parameters: [
          { name: 'agent_id', type: 'string', required: true, description: 'Agent ID' },
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in port fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'protocol', type: 'string', required: false, description: 'Filter by protocol (tcp/udp)' },
          { name: 'local_ip', type: 'string', required: false, description: 'Filter by local IP' },
          { name: 'local_port', type: 'number', required: false, description: 'Filter by local port' },
        ],
      },
      {
        id: 'syscollector-netaddr',
        name: 'Get Network Addresses',
        description: 'Get network address information for an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/netaddr',
        implemented: false,
        category: 'Syscollector',
      },
      {
        id: 'syscollector-netiface',
        name: 'Get Network Interfaces',
        description: 'Get network interface information for an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/netiface',
        implemented: false,
        category: 'Syscollector',
      },
      {
        id: 'syscollector-netproto',
        name: 'Get Network Protocols',
        description: 'Get network protocol information for an agent',
        method: 'GET',
        endpoint: '/syscollector/{agent_id}/netproto',
        implemented: false,
        category: 'Syscollector',
      },

      // Rules
      {
        id: 'rules-list',
        name: 'List Rules',
        description: 'Get all Wazuh rules',
        method: 'GET',
        endpoint: '/rules',
        implemented: false,
        category: 'Rules',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in rule fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'q', type: 'string', required: false, description: 'Query in Wazuh Query Language' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status: enabled, disabled' },
          { name: 'group', type: 'string', required: false, description: 'Filter by rule group' },
          { name: 'level', type: 'string', required: false, description: 'Filter by rule level' },
          { name: 'filename', type: 'string', required: false, description: 'Filter by filename' },
          { name: 'relative_dirname', type: 'string', required: false, description: 'Filter by directory' },
          { name: 'pci_dss', type: 'string', required: false, description: 'Filter by PCI DSS requirement' },
          { name: 'gdpr', type: 'string', required: false, description: 'Filter by GDPR requirement' },
          { name: 'hipaa', type: 'string', required: false, description: 'Filter by HIPAA requirement' },
          { name: 'nist_800_53', type: 'string', required: false, description: 'Filter by NIST 800-53 requirement' },
          { name: 'gpg13', type: 'string', required: false, description: 'Filter by GPG13 requirement' },
          { name: 'tsc', type: 'string', required: false, description: 'Filter by TSC requirement' },
          { name: 'mitre', type: 'string', required: false, description: 'Filter by MITRE ATT&CK technique' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'rules-get',
        name: 'Get Rule',
        description: 'Get a specific rule by ID',
        method: 'GET',
        endpoint: '/rules/{rule_id}',
        implemented: false,
        category: 'Rules',
      },
      {
        id: 'rules-files',
        name: 'Get Rule Files',
        description: 'Get list of rule files',
        method: 'GET',
        endpoint: '/rules/files',
        implemented: false,
        category: 'Rules',
      },
      {
        id: 'rules-files-get',
        name: 'Get Rule File Content',
        description: 'Get content of a rule file',
        method: 'GET',
        endpoint: '/rules/files/{filename}',
        implemented: false,
        category: 'Rules',
      },
      {
        id: 'rules-files-update',
        name: 'Update Rule File',
        description: 'Update or create a custom rule file',
        method: 'PUT',
        endpoint: '/rules/files/{filename}',
        implemented: false,
        category: 'Rules',
      },
      {
        id: 'rules-files-delete',
        name: 'Delete Rule File',
        description: 'Delete a custom rule file',
        method: 'DELETE',
        endpoint: '/rules/files/{filename}',
        implemented: false,
        category: 'Rules',
      },
      {
        id: 'rules-groups',
        name: 'Get Rule Groups',
        description: 'Get list of rule groups',
        method: 'GET',
        endpoint: '/rules/groups',
        implemented: false,
        category: 'Rules',
      },
      {
        id: 'rules-requirement',
        name: 'Get Rules by Requirement',
        description: 'Get list of rules filtered by compliance requirement',
        method: 'GET',
        endpoint: '/rules/requirement/{requirement}',
        implemented: false,
        category: 'Rules',
      },

      // Decoders
      {
        id: 'decoders-list',
        name: 'List Decoders',
        description: 'Get all Wazuh decoders',
        method: 'GET',
        endpoint: '/decoders',
        implemented: false,
        category: 'Decoders',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in decoder fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'q', type: 'string', required: false, description: 'Query in Wazuh Query Language' },
          { name: 'filename', type: 'string', required: false, description: 'Filter by filename' },
          { name: 'relative_dirname', type: 'string', required: false, description: 'Filter by directory' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status: enabled, disabled' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'decoders-get',
        name: 'Get Decoder',
        description: 'Get a specific decoder by name',
        method: 'GET',
        endpoint: '/decoders/{decoder_name}',
        implemented: false,
        category: 'Decoders',
      },
      {
        id: 'decoders-files',
        name: 'Get Decoder Files',
        description: 'Get list of decoder files',
        method: 'GET',
        endpoint: '/decoders/files',
        implemented: false,
        category: 'Decoders',
      },
      {
        id: 'decoders-files-get',
        name: 'Get Decoder File Content',
        description: 'Get content of a decoder file',
        method: 'GET',
        endpoint: '/decoders/files/{filename}',
        implemented: false,
        category: 'Decoders',
      },
      {
        id: 'decoders-files-update',
        name: 'Update Decoder File',
        description: 'Update or create a custom decoder file',
        method: 'PUT',
        endpoint: '/decoders/files/{filename}',
        implemented: false,
        category: 'Decoders',
      },
      {
        id: 'decoders-files-delete',
        name: 'Delete Decoder File',
        description: 'Delete a custom decoder file',
        method: 'DELETE',
        endpoint: '/decoders/files/{filename}',
        implemented: false,
        category: 'Decoders',
      },
      {
        id: 'decoders-parents',
        name: 'Get Parent Decoders',
        description: 'Get list of parent decoders',
        method: 'GET',
        endpoint: '/decoders/parents',
        implemented: false,
        category: 'Decoders',
      },

      // Lists (CDB Lists)
      {
        id: 'lists-list',
        name: 'List CDB Lists',
        description: 'Get all CDB lists',
        method: 'GET',
        endpoint: '/lists',
        implemented: false,
        category: 'Lists',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in list fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'filename', type: 'string', required: false, description: 'Filter by filename' },
          { name: 'relative_dirname', type: 'string', required: false, description: 'Filter by directory' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'lists-files',
        name: 'Get List Files',
        description: 'Get CDB list files',
        method: 'GET',
        endpoint: '/lists/files',
        implemented: false,
        category: 'Lists',
      },
      {
        id: 'lists-files-get',
        name: 'Get List File Content',
        description: 'Get content of a CDB list file',
        method: 'GET',
        endpoint: '/lists/files/{filename}',
        implemented: false,
        category: 'Lists',
      },
      {
        id: 'lists-files-update',
        name: 'Update List File',
        description: 'Update or create a CDB list file',
        method: 'PUT',
        endpoint: '/lists/files/{filename}',
        implemented: false,
        category: 'Lists',
      },
      {
        id: 'lists-files-delete',
        name: 'Delete List File',
        description: 'Delete a CDB list file',
        method: 'DELETE',
        endpoint: '/lists/files/{filename}',
        implemented: false,
        category: 'Lists',
      },

      // Active Response
      {
        id: 'active-response-run',
        name: 'Run Active Response',
        description: 'Run an active response command on agents',
        method: 'PUT',
        endpoint: '/active-response',
        implemented: false,
        category: 'Active Response',
        parameters: [
          { name: 'agents_list', type: 'string', required: true, description: 'List of agent IDs' },
          { name: 'command', type: 'string', required: true, description: 'Command to execute' },
          { name: 'arguments', type: 'array', required: false, description: 'Command arguments' },
          { name: 'alert', type: 'object', required: false, description: 'Alert information' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },

      // Security (RBAC)
      {
        id: 'security-users-list',
        name: 'List Users',
        description: 'Get all API users',
        method: 'GET',
        endpoint: '/security/users',
        implemented: false,
        category: 'Security',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in user fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'security-users-get',
        name: 'Get User',
        description: 'Get information about a specific user',
        method: 'GET',
        endpoint: '/security/users/{user_id}',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-users-create',
        name: 'Create User',
        description: 'Create a new API user',
        method: 'POST',
        endpoint: '/security/users',
        implemented: false,
        category: 'Security',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
        ],
      },
      {
        id: 'security-users-update',
        name: 'Update User',
        description: 'Update an API user',
        method: 'PUT',
        endpoint: '/security/users/{user_id}',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-users-delete',
        name: 'Delete Users',
        description: 'Delete API users',
        method: 'DELETE',
        endpoint: '/security/users',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-users-me',
        name: 'Get Current User',
        description: 'Get information about the current authenticated user',
        method: 'GET',
        endpoint: '/security/users/me',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-roles-list',
        name: 'List Roles',
        description: 'Get all security roles',
        method: 'GET',
        endpoint: '/security/roles',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-roles-get',
        name: 'Get Role',
        description: 'Get information about a specific role',
        method: 'GET',
        endpoint: '/security/roles/{role_id}',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-roles-create',
        name: 'Create Role',
        description: 'Create a new security role',
        method: 'POST',
        endpoint: '/security/roles',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-roles-update',
        name: 'Update Role',
        description: 'Update a security role',
        method: 'PUT',
        endpoint: '/security/roles/{role_id}',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-roles-delete',
        name: 'Delete Roles',
        description: 'Delete security roles',
        method: 'DELETE',
        endpoint: '/security/roles',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-policies-list',
        name: 'List Policies',
        description: 'Get all security policies',
        method: 'GET',
        endpoint: '/security/policies',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-policies-get',
        name: 'Get Policy',
        description: 'Get information about a specific policy',
        method: 'GET',
        endpoint: '/security/policies/{policy_id}',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-policies-create',
        name: 'Create Policy',
        description: 'Create a new security policy',
        method: 'POST',
        endpoint: '/security/policies',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-policies-update',
        name: 'Update Policy',
        description: 'Update a security policy',
        method: 'PUT',
        endpoint: '/security/policies/{policy_id}',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-policies-delete',
        name: 'Delete Policies',
        description: 'Delete security policies',
        method: 'DELETE',
        endpoint: '/security/policies',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-rules-list',
        name: 'List Security Rules',
        description: 'Get all security rules',
        method: 'GET',
        endpoint: '/security/rules',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-rules-get',
        name: 'Get Security Rule',
        description: 'Get information about a specific security rule',
        method: 'GET',
        endpoint: '/security/rules/{rule_id}',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-rules-create',
        name: 'Create Security Rule',
        description: 'Create a new security rule',
        method: 'POST',
        endpoint: '/security/rules',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-rules-update',
        name: 'Update Security Rule',
        description: 'Update a security rule',
        method: 'PUT',
        endpoint: '/security/rules/{rule_id}',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-rules-delete',
        name: 'Delete Security Rules',
        description: 'Delete security rules',
        method: 'DELETE',
        endpoint: '/security/rules',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-config',
        name: 'Get Security Config',
        description: 'Get current security configuration',
        method: 'GET',
        endpoint: '/security/config',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-config-update',
        name: 'Update Security Config',
        description: 'Update security configuration',
        method: 'PUT',
        endpoint: '/security/config',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-config-delete',
        name: 'Reset Security Config',
        description: 'Reset security configuration to defaults',
        method: 'DELETE',
        endpoint: '/security/config',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-user-roles',
        name: 'Assign Roles to User',
        description: 'Assign roles to a user',
        method: 'POST',
        endpoint: '/security/users/{user_id}/roles',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-user-roles-remove',
        name: 'Remove Roles from User',
        description: 'Remove roles from a user',
        method: 'DELETE',
        endpoint: '/security/users/{user_id}/roles',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-role-policies',
        name: 'Assign Policies to Role',
        description: 'Assign policies to a role',
        method: 'POST',
        endpoint: '/security/roles/{role_id}/policies',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-role-policies-remove',
        name: 'Remove Policies from Role',
        description: 'Remove policies from a role',
        method: 'DELETE',
        endpoint: '/security/roles/{role_id}/policies',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-role-rules',
        name: 'Assign Rules to Role',
        description: 'Assign security rules to a role',
        method: 'POST',
        endpoint: '/security/roles/{role_id}/rules',
        implemented: false,
        category: 'Security',
      },
      {
        id: 'security-role-rules-remove',
        name: 'Remove Rules from Role',
        description: 'Remove security rules from a role',
        method: 'DELETE',
        endpoint: '/security/roles/{role_id}/rules',
        implemented: false,
        category: 'Security',
      },

      // Logtest
      {
        id: 'logtest-run',
        name: 'Run Logtest',
        description: 'Test rules and decoders against a log message',
        method: 'PUT',
        endpoint: '/logtest',
        implemented: false,
        category: 'Logtest',
        parameters: [
          { name: 'token', type: 'string', required: false, description: 'Session token for reusing session' },
          { name: 'log_format', type: 'string', required: true, description: 'Log format (e.g. syslog)' },
          { name: 'location', type: 'string', required: true, description: 'Log location' },
          { name: 'event', type: 'string', required: true, description: 'Log event to test' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'logtest-sessions',
        name: 'Get Logtest Sessions',
        description: 'Get active logtest sessions',
        method: 'GET',
        endpoint: '/logtest/sessions',
        implemented: false,
        category: 'Logtest',
      },
      {
        id: 'logtest-session-delete',
        name: 'Delete Logtest Session',
        description: 'Delete a logtest session',
        method: 'DELETE',
        endpoint: '/logtest/sessions/{token}',
        implemented: false,
        category: 'Logtest',
      },

      // MITRE ATT&CK
      {
        id: 'mitre-list',
        name: 'Get MITRE Techniques',
        description: 'Get all MITRE ATT&CK techniques',
        method: 'GET',
        endpoint: '/mitre',
        implemented: false,
        category: 'MITRE',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in MITRE fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'id', type: 'string', required: false, description: 'Filter by technique ID' },
          { name: 'phase_name', type: 'string', required: false, description: 'Filter by phase/tactic name' },
          { name: 'platform_name', type: 'string', required: false, description: 'Filter by platform' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },
      {
        id: 'mitre-groups',
        name: 'Get MITRE Groups',
        description: 'Get MITRE ATT&CK groups',
        method: 'GET',
        endpoint: '/mitre/groups',
        implemented: false,
        category: 'MITRE',
      },
      {
        id: 'mitre-mitigations',
        name: 'Get MITRE Mitigations',
        description: 'Get MITRE ATT&CK mitigations',
        method: 'GET',
        endpoint: '/mitre/mitigations',
        implemented: false,
        category: 'MITRE',
      },
      {
        id: 'mitre-software',
        name: 'Get MITRE Software',
        description: 'Get MITRE ATT&CK software',
        method: 'GET',
        endpoint: '/mitre/software',
        implemented: false,
        category: 'MITRE',
      },
      {
        id: 'mitre-tactics',
        name: 'Get MITRE Tactics',
        description: 'Get MITRE ATT&CK tactics',
        method: 'GET',
        endpoint: '/mitre/tactics',
        implemented: false,
        category: 'MITRE',
      },
      {
        id: 'mitre-references',
        name: 'Get MITRE References',
        description: 'Get MITRE ATT&CK references',
        method: 'GET',
        endpoint: '/mitre/references',
        implemented: false,
        category: 'MITRE',
      },

      // Tasks
      {
        id: 'tasks-status',
        name: 'Get Task Status',
        description: 'Get status of running tasks',
        method: 'GET',
        endpoint: '/tasks/status',
        implemented: false,
        category: 'Tasks',
        parameters: [
          { name: 'offset', type: 'number', required: false, description: 'First element to return' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum elements to return' },
          { name: 'sort', type: 'string', required: false, description: 'Sort by field' },
          { name: 'search', type: 'string', required: false, description: 'Search in task fields' },
          { name: 'select', type: 'string', required: false, description: 'Fields to return' },
          { name: 'q', type: 'string', required: false, description: 'Query in Wazuh Query Language' },
          { name: 'agents_list', type: 'string', required: false, description: 'Filter by agent IDs' },
          { name: 'task_list', type: 'string', required: false, description: 'Filter by task IDs' },
          { name: 'command', type: 'string', required: false, description: 'Filter by command' },
          { name: 'node', type: 'string', required: false, description: 'Filter by node name' },
          { name: 'module', type: 'string', required: false, description: 'Filter by module' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status' },
        ],
        documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
      },

      // Experimental
      {
        id: 'experimental-ciscat',
        name: 'Get All CIS-CAT Results',
        description: 'Get CIS-CAT results for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/ciscat/results',
        implemented: false,
        category: 'Experimental',
      },
      {
        id: 'experimental-syscollector-hardware',
        name: 'Get All Hardware Info',
        description: 'Get hardware information for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/syscollector/hardware',
        implemented: false,
        category: 'Experimental',
      },
      {
        id: 'experimental-syscollector-os',
        name: 'Get All OS Info',
        description: 'Get OS information for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/syscollector/os',
        implemented: false,
        category: 'Experimental',
      },
      {
        id: 'experimental-syscollector-packages',
        name: 'Get All Packages',
        description: 'Get installed packages for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/syscollector/packages',
        implemented: false,
        category: 'Experimental',
      },
      {
        id: 'experimental-syscollector-processes',
        name: 'Get All Processes',
        description: 'Get running processes for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/syscollector/processes',
        implemented: false,
        category: 'Experimental',
      },
      {
        id: 'experimental-syscollector-ports',
        name: 'Get All Ports',
        description: 'Get open ports for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/syscollector/ports',
        implemented: false,
        category: 'Experimental',
      },
      {
        id: 'experimental-syscollector-netaddr',
        name: 'Get All Network Addresses',
        description: 'Get network addresses for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/syscollector/netaddr',
        implemented: false,
        category: 'Experimental',
      },
      {
        id: 'experimental-syscollector-netiface',
        name: 'Get All Network Interfaces',
        description: 'Get network interfaces for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/syscollector/netiface',
        implemented: false,
        category: 'Experimental',
      },
      {
        id: 'experimental-syscollector-hotfixes',
        name: 'Get All Hotfixes',
        description: 'Get Windows hotfixes for all agents (experimental)',
        method: 'GET',
        endpoint: '/experimental/syscollector/hotfixes',
        implemented: false,
        category: 'Experimental',
      },
    ];
  }
}
