import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  AdGuardConfig,
  AdGuardStats,
  AdGuardStatus,
  AdGuardQueryLogEntry,
  AdGuardFilterStatus,
} from '../types';
import { logger } from '../services/logger';

export class AdGuardIntegration extends BaseIntegration {
  readonly type = 'adguard';
  readonly name = 'AdGuard Home';

  private createClient(config: AdGuardConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 80}`;

    return axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      auth: {
        username: config.username,
        password: config.password,
      },
      timeout: 10000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const adguardConfig = config as AdGuardConfig;

    try {
      const client = this.createClient(adguardConfig);
      const response = await client.get('/control/status');
      const status = response.data as AdGuardStatus;

      return {
        success: true,
        message: `Connected to AdGuard Home v${status.version} (Protection: ${status.protection_enabled ? 'On' : 'Off'})`,
        details: {
          version: status.version,
          protection_enabled: status.protection_enabled,
          dns_port: status.dns_port,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('adguard', 'Connection test failed', { error: errorMsg });

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const adguardConfig = config as AdGuardConfig;
    const client = this.createClient(adguardConfig);

    switch (metric) {
      case 'stats':
        return this.getStats(client);
      case 'status':
        return this.getStatus(client);
      case 'query-log':
        return this.getQueryLog(client);
      case 'filtering-status':
        return this.getFilteringStatus(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStats(client: AxiosInstance): Promise<{ stats: AdGuardStats }> {
    try {
      const response = await client.get('/control/stats');
      const stats = response.data as AdGuardStats;
      logger.debug('adguard', 'Fetched stats', { queries: stats.num_dns_queries });
      return { stats };
    } catch (error) {
      logger.error('adguard', 'Failed to fetch stats', { error: String(error) });
      throw error;
    }
  }

  private async getStatus(client: AxiosInstance): Promise<{ status: AdGuardStatus; filterStatus: AdGuardFilterStatus }> {
    try {
      const [statusResponse, filterResponse] = await Promise.all([
        client.get('/control/status'),
        client.get('/control/filtering/status'),
      ]);

      const status = statusResponse.data as AdGuardStatus;
      const filterStatus = filterResponse.data as AdGuardFilterStatus;

      logger.debug('adguard', 'Fetched status', { version: status.version });
      return { status, filterStatus };
    } catch (error) {
      logger.error('adguard', 'Failed to fetch status', { error: String(error) });
      throw error;
    }
  }

  private async getQueryLog(client: AxiosInstance): Promise<{ entries: AdGuardQueryLogEntry[]; oldest: string }> {
    try {
      const response = await client.get('/control/querylog', {
        params: {
          limit: 100,
        },
      });

      const data = response.data;
      const entries = (data.data || []) as AdGuardQueryLogEntry[];
      const oldest = data.oldest || '';

      logger.debug('adguard', `Fetched ${entries.length} query log entries`);
      return { entries, oldest };
    } catch (error) {
      logger.error('adguard', 'Failed to fetch query log', { error: String(error) });
      throw error;
    }
  }

  private async getFilteringStatus(client: AxiosInstance): Promise<{ filterStatus: AdGuardFilterStatus }> {
    try {
      const response = await client.get('/control/filtering/status');
      const filterStatus = response.data as AdGuardFilterStatus;
      logger.debug('adguard', 'Fetched filtering status', { filters: filterStatus.filters?.length });
      return { filterStatus };
    } catch (error) {
      logger.error('adguard', 'Failed to fetch filtering status', { error: String(error) });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'stats',
        name: 'Statistics',
        description: 'DNS query statistics, blocked queries, and top domains/clients',
        widgetTypes: ['adguard-stats', 'adguard-top-clients', 'adguard-top-domains'],
      },
      {
        id: 'status',
        name: 'Status',
        description: 'AdGuard Home server status and protection state',
        widgetTypes: ['adguard-status'],
      },
      {
        id: 'query-log',
        name: 'Query Log',
        description: 'Recent DNS query log entries',
        widgetTypes: ['adguard-query-log'],
      },
      {
        id: 'filtering-status',
        name: 'Filtering Status',
        description: 'Filter lists and their status',
        widgetTypes: ['adguard-filtering'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Status & Stats - Implemented
      {
        id: 'status',
        name: 'Get Status',
        description: 'Get AdGuard Home server status including version, protection state, and DNS port',
        method: 'GET',
        endpoint: '/control/status',
        implemented: true,
        category: 'Status',
        documentationUrl: 'https://github.com/AdguardTeam/AdGuardHome/wiki/Configuration#status',
      },
      {
        id: 'stats',
        name: 'Get Statistics',
        description: 'Get DNS query statistics including total queries, blocked queries, and top domains/clients',
        method: 'GET',
        endpoint: '/control/stats',
        implemented: true,
        category: 'Statistics',
      },
      {
        id: 'stats-reset',
        name: 'Reset Statistics',
        description: 'Reset all DNS query statistics to zero',
        method: 'POST',
        endpoint: '/control/stats/reset',
        implemented: false,
        category: 'Statistics',
      },
      {
        id: 'stats-config',
        name: 'Get Statistics Config',
        description: 'Get statistics retention configuration',
        method: 'GET',
        endpoint: '/control/stats/config',
        implemented: false,
        category: 'Statistics',
      },

      // Query Log - Implemented
      {
        id: 'querylog',
        name: 'Get Query Log',
        description: 'Get recent DNS query log entries with filtering options',
        method: 'GET',
        endpoint: '/control/querylog',
        implemented: true,
        category: 'Query Log',
        parameters: [
          { name: 'limit', type: 'number', required: false, description: 'Maximum entries to return' },
          { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
          { name: 'search', type: 'string', required: false, description: 'Search filter' },
        ],
      },
      {
        id: 'querylog-config',
        name: 'Get Query Log Config',
        description: 'Get query log configuration (enabled, retention, anonymization)',
        method: 'GET',
        endpoint: '/control/querylog/config',
        implemented: false,
        category: 'Query Log',
      },
      {
        id: 'querylog-clear',
        name: 'Clear Query Log',
        description: 'Clear all query log entries',
        method: 'POST',
        endpoint: '/control/querylog/clear',
        implemented: false,
        category: 'Query Log',
      },

      // Filtering - Partially Implemented
      {
        id: 'filtering-status',
        name: 'Get Filtering Status',
        description: 'Get filter lists and their current status',
        method: 'GET',
        endpoint: '/control/filtering/status',
        implemented: true,
        category: 'Filtering',
      },
      {
        id: 'filtering-add',
        name: 'Add Filter',
        description: 'Add a new filter list by URL',
        method: 'POST',
        endpoint: '/control/filtering/add_url',
        implemented: false,
        category: 'Filtering',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Filter name' },
          { name: 'url', type: 'string', required: true, description: 'Filter list URL' },
        ],
      },
      {
        id: 'filtering-remove',
        name: 'Remove Filter',
        description: 'Remove a filter list',
        method: 'POST',
        endpoint: '/control/filtering/remove_url',
        implemented: false,
        category: 'Filtering',
        parameters: [
          { name: 'url', type: 'string', required: true, description: 'Filter list URL to remove' },
        ],
      },
      {
        id: 'filtering-refresh',
        name: 'Refresh Filters',
        description: 'Force refresh all filter lists',
        method: 'POST',
        endpoint: '/control/filtering/refresh',
        implemented: false,
        category: 'Filtering',
      },
      {
        id: 'filtering-check',
        name: 'Check Host',
        description: 'Check if a host would be blocked by current filters',
        method: 'POST',
        endpoint: '/control/filtering/check_host',
        implemented: false,
        category: 'Filtering',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Hostname to check' },
        ],
      },

      // Protection Control
      {
        id: 'protection',
        name: 'Set Protection',
        description: 'Enable or disable DNS protection',
        method: 'POST',
        endpoint: '/control/protection',
        implemented: false,
        category: 'Protection',
        parameters: [
          { name: 'protection_enabled', type: 'boolean', required: true, description: 'Enable/disable protection' },
        ],
      },

      // Safe Browsing, Parental, Safe Search
      {
        id: 'safebrowsing-status',
        name: 'Get Safe Browsing Status',
        description: 'Get safe browsing protection status',
        method: 'GET',
        endpoint: '/control/safebrowsing/status',
        implemented: false,
        category: 'Protection',
      },
      {
        id: 'parental-status',
        name: 'Get Parental Control Status',
        description: 'Get parental control status',
        method: 'GET',
        endpoint: '/control/parental/status',
        implemented: false,
        category: 'Protection',
      },
      {
        id: 'safesearch-status',
        name: 'Get Safe Search Status',
        description: 'Get safe search enforcement status',
        method: 'GET',
        endpoint: '/control/safesearch/status',
        implemented: false,
        category: 'Protection',
      },

      // Blocked Services
      {
        id: 'blocked-services-list',
        name: 'Get Blocked Services',
        description: 'Get list of blocked services (social media, gaming, etc.)',
        method: 'GET',
        endpoint: '/control/blocked_services/list',
        implemented: false,
        category: 'Services',
      },
      {
        id: 'blocked-services-set',
        name: 'Set Blocked Services',
        description: 'Set which services to block',
        method: 'POST',
        endpoint: '/control/blocked_services/set',
        implemented: false,
        category: 'Services',
      },

      // DNS Configuration
      {
        id: 'dns-info',
        name: 'Get DNS Info',
        description: 'Get DNS server configuration',
        method: 'GET',
        endpoint: '/control/dns_info',
        implemented: false,
        category: 'DNS',
      },
      {
        id: 'dns-config',
        name: 'Set DNS Config',
        description: 'Update DNS server configuration',
        method: 'POST',
        endpoint: '/control/dns_config',
        implemented: false,
        category: 'DNS',
      },

      // Clients
      {
        id: 'clients',
        name: 'Get Clients',
        description: 'Get all configured clients and runtime client info',
        method: 'GET',
        endpoint: '/control/clients',
        implemented: false,
        category: 'Clients',
      },
      {
        id: 'clients-add',
        name: 'Add Client',
        description: 'Add a new persistent client',
        method: 'POST',
        endpoint: '/control/clients/add',
        implemented: false,
        category: 'Clients',
      },
      {
        id: 'clients-delete',
        name: 'Delete Client',
        description: 'Delete a persistent client',
        method: 'POST',
        endpoint: '/control/clients/delete',
        implemented: false,
        category: 'Clients',
      },

      // Access Control
      {
        id: 'access-list',
        name: 'Get Access Lists',
        description: 'Get allowed/blocked client access lists',
        method: 'GET',
        endpoint: '/control/access/list',
        implemented: false,
        category: 'Access',
      },
      {
        id: 'access-set',
        name: 'Set Access Lists',
        description: 'Update allowed/blocked client access lists',
        method: 'POST',
        endpoint: '/control/access/set',
        implemented: false,
        category: 'Access',
      },

      // DNS Rewrites
      {
        id: 'rewrite-list',
        name: 'Get DNS Rewrites',
        description: 'Get custom DNS rewrite rules',
        method: 'GET',
        endpoint: '/control/rewrite/list',
        implemented: false,
        category: 'DNS Rewrites',
      },
      {
        id: 'rewrite-add',
        name: 'Add DNS Rewrite',
        description: 'Add a custom DNS rewrite rule',
        method: 'POST',
        endpoint: '/control/rewrite/add',
        implemented: false,
        category: 'DNS Rewrites',
        parameters: [
          { name: 'domain', type: 'string', required: true, description: 'Domain to rewrite' },
          { name: 'answer', type: 'string', required: true, description: 'Answer (IP or domain)' },
        ],
      },
      {
        id: 'rewrite-delete',
        name: 'Delete DNS Rewrite',
        description: 'Delete a custom DNS rewrite rule',
        method: 'POST',
        endpoint: '/control/rewrite/delete',
        implemented: false,
        category: 'DNS Rewrites',
      },

      // DHCP
      {
        id: 'dhcp-status',
        name: 'Get DHCP Status',
        description: 'Get DHCP server status and leases',
        method: 'GET',
        endpoint: '/control/dhcp/status',
        implemented: false,
        category: 'DHCP',
      },
      {
        id: 'dhcp-set-config',
        name: 'Set DHCP Config',
        description: 'Configure DHCP server settings',
        method: 'POST',
        endpoint: '/control/dhcp/set_config',
        implemented: false,
        category: 'DHCP',
      },

      // TLS/Encryption
      {
        id: 'tls-status',
        name: 'Get TLS Status',
        description: 'Get TLS/HTTPS encryption configuration',
        method: 'GET',
        endpoint: '/control/tls/status',
        implemented: false,
        category: 'Security',
      },
    ];
  }
}
