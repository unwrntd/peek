import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  ProwlarrConfig,
  ProwlarrSystemStatus,
  ProwlarrIndexer,
  ProwlarrIndexerStats,
  ProwlarrApplication,
  ProwlarrHealth,
  ProwlarrHistoryRecord,
} from '../types';
import { logger } from '../services/logger';

export class ProwlarrIntegration extends BaseIntegration {
  readonly type = 'prowlarr';
  readonly name = 'Prowlarr';

  private createClient(config: ProwlarrConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 9696}/api/v1`;

    return axios.create({
      baseURL,
      headers: {
        'X-Api-Key': config.apiKey,
        'Accept': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const prowlarrConfig = config as ProwlarrConfig;

    if (!prowlarrConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!prowlarrConfig.apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const client = this.createClient(prowlarrConfig);
      const [statusResponse, indexersResponse] = await Promise.all([
        client.get('/system/status'),
        client.get('/indexer'),
      ]);

      const status = statusResponse.data;
      const indexers = indexersResponse.data;

      return {
        success: true,
        message: `Connected to Prowlarr v${status.version}`,
        details: {
          version: status.version,
          branch: status.branch,
          indexerCount: indexers.length,
          osName: status.osName,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('prowlarr', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Authentication failed: Invalid API key',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused: Cannot reach ${prowlarrConfig.host}:${prowlarrConfig.port || 9696}`,
          };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          return {
            success: false,
            message: 'Connection timed out',
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
    const prowlarrConfig = config as ProwlarrConfig;
    const client = this.createClient(prowlarrConfig);

    switch (metric) {
      case 'system-status':
        return this.getSystemStatus(client);
      case 'indexers':
        return this.getIndexers(client);
      case 'indexer-stats':
        return this.getIndexerStats(client);
      case 'applications':
        return this.getApplications(client);
      case 'history':
        return this.getHistory(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getSystemStatus(client: AxiosInstance): Promise<{
    systemStatus: ProwlarrSystemStatus;
    health: ProwlarrHealth[];
  }> {
    try {
      const [statusResponse, healthResponse] = await Promise.all([
        client.get('/system/status'),
        client.get('/health'),
      ]);

      const status = statusResponse.data;
      const systemStatus: ProwlarrSystemStatus = {
        version: status.version || 'Unknown',
        buildTime: status.buildTime || '',
        startTime: status.startTime || new Date().toISOString(),
        osName: status.osName || 'Unknown',
        osVersion: status.osVersion || '',
        branch: status.branch || 'main',
      };

      return {
        systemStatus,
        health: healthResponse.data || [],
      };
    } catch (error) {
      logger.error('prowlarr', 'Failed to get system status', { error });
      throw error;
    }
  }

  private async getIndexers(client: AxiosInstance): Promise<{
    indexers: ProwlarrIndexer[];
    totalCount: number;
    enabledCount: number;
  }> {
    try {
      const response = await client.get('/indexer');
      const indexers: ProwlarrIndexer[] = (response.data || []).map((item: Record<string, unknown>) => ({
        id: item.id as number,
        name: (item.name as string) || 'Unknown',
        protocol: (item.protocol as string)?.toLowerCase() === 'usenet' ? 'usenet' : 'torrent',
        privacy: this.mapPrivacy(item.privacy as string),
        enable: (item.enable as boolean) ?? true,
        appProfileId: (item.appProfileId as number) || 0,
        priority: (item.priority as number) || 25,
        added: (item.added as string) || new Date().toISOString(),
      }));

      const enabledCount = indexers.filter(i => i.enable).length;

      return {
        indexers,
        totalCount: indexers.length,
        enabledCount,
      };
    } catch (error) {
      logger.error('prowlarr', 'Failed to get indexers', { error });
      throw error;
    }
  }

  private mapPrivacy(privacy: string | undefined): 'public' | 'private' | 'semiPrivate' {
    switch (privacy?.toLowerCase()) {
      case 'private':
        return 'private';
      case 'semiprivate':
      case 'semi-private':
        return 'semiPrivate';
      default:
        return 'public';
    }
  }

  private async getIndexerStats(client: AxiosInstance): Promise<{
    stats: ProwlarrIndexerStats[];
    totals: {
      totalQueries: number;
      totalGrabs: number;
      totalFailedQueries: number;
      totalFailedGrabs: number;
    };
  }> {
    try {
      // Get stats for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await client.get('/indexerstats', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      const indexerStats = response.data?.indexers || [];
      const stats: ProwlarrIndexerStats[] = indexerStats.map((item: Record<string, unknown>) => ({
        indexerId: (item.indexerId as number) || 0,
        indexerName: (item.indexerName as string) || 'Unknown',
        averageResponseTime: (item.averageResponseTime as number) || 0,
        numberOfQueries: (item.numberOfQueries as number) || 0,
        numberOfGrabs: (item.numberOfGrabs as number) || 0,
        numberOfRssQueries: (item.numberOfRssQueries as number) || 0,
        numberOfAuthQueries: (item.numberOfAuthQueries as number) || 0,
        numberOfFailedQueries: (item.numberOfFailedQueries as number) || 0,
        numberOfFailedGrabs: (item.numberOfFailedGrabs as number) || 0,
        numberOfFailedRssQueries: (item.numberOfFailedRssQueries as number) || 0,
        numberOfFailedAuthQueries: (item.numberOfFailedAuthQueries as number) || 0,
      }));

      // Calculate totals
      const totals = stats.reduce(
        (acc, stat) => ({
          totalQueries: acc.totalQueries + stat.numberOfQueries,
          totalGrabs: acc.totalGrabs + stat.numberOfGrabs,
          totalFailedQueries: acc.totalFailedQueries + stat.numberOfFailedQueries,
          totalFailedGrabs: acc.totalFailedGrabs + stat.numberOfFailedGrabs,
        }),
        { totalQueries: 0, totalGrabs: 0, totalFailedQueries: 0, totalFailedGrabs: 0 }
      );

      return { stats, totals };
    } catch (error) {
      logger.error('prowlarr', 'Failed to get indexer stats', { error });
      throw error;
    }
  }

  private async getApplications(client: AxiosInstance): Promise<{
    applications: ProwlarrApplication[];
    totalCount: number;
  }> {
    try {
      const response = await client.get('/applications');
      const applications: ProwlarrApplication[] = (response.data || []).map((item: Record<string, unknown>) => ({
        id: item.id as number,
        name: (item.name as string) || 'Unknown',
        syncLevel: this.mapSyncLevel(item.syncLevel as string),
        implementationName: (item.implementationName as string) || 'Unknown',
        tags: (item.tags as number[]) || [],
      }));

      return {
        applications,
        totalCount: applications.length,
      };
    } catch (error) {
      logger.error('prowlarr', 'Failed to get applications', { error });
      throw error;
    }
  }

  private mapSyncLevel(syncLevel: string | undefined): 'disabled' | 'addOnly' | 'fullSync' {
    switch (syncLevel?.toLowerCase()) {
      case 'disabled':
        return 'disabled';
      case 'addonly':
        return 'addOnly';
      case 'fullsync':
      default:
        return 'fullSync';
    }
  }

  private async getHistory(client: AxiosInstance): Promise<{
    history: ProwlarrHistoryRecord[];
    totalRecords: number;
  }> {
    try {
      const response = await client.get('/history', {
        params: {
          page: 1,
          pageSize: 50,
          sortKey: 'date',
          sortDirection: 'descending',
        },
      });

      const records = response.data?.records || [];
      const history: ProwlarrHistoryRecord[] = records.map((item: Record<string, unknown>) => {
        const indexerObj = item.indexer as Record<string, unknown> | undefined;
        return {
          id: item.id as number,
          indexerId: (item.indexerId as number) || 0,
          indexer: (indexerObj?.name as string) || 'Unknown',
          eventType: (item.eventType as string) || 'unknown',
          successful: (item.successful as boolean) ?? true,
          date: (item.date as string) || new Date().toISOString(),
          data: item.data as { query?: string; source?: string; title?: string } | undefined,
        };
      });

      return {
        history,
        totalRecords: response.data?.totalRecords || history.length,
      };
    } catch (error) {
      logger.error('prowlarr', 'Failed to get history', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'system-status',
        name: 'System Status',
        description: 'Prowlarr version, uptime, and health',
        widgetTypes: ['prowlarr-status'],
      },
      {
        id: 'indexers',
        name: 'Indexers',
        description: 'All configured indexers with status',
        widgetTypes: ['prowlarr-indexers'],
      },
      {
        id: 'indexer-stats',
        name: 'Indexer Stats',
        description: 'Query and grab statistics per indexer',
        widgetTypes: ['prowlarr-stats'],
      },
      {
        id: 'applications',
        name: 'Applications',
        description: 'Connected *arr applications',
        widgetTypes: ['prowlarr-apps'],
      },
      {
        id: 'history',
        name: 'History',
        description: 'Recent search and grab activity',
        widgetTypes: ['prowlarr-history'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // System - Implemented
      {
        id: 'system-status',
        name: 'Get System Status',
        description: 'Retrieve system status information including version and OS',
        method: 'GET',
        endpoint: '/system/status',
        implemented: true,
        category: 'System',
        documentationUrl: 'https://prowlarr.com/docs/api/',
      },
      {
        id: 'health',
        name: 'Get Health',
        description: 'Get system health check results',
        method: 'GET',
        endpoint: '/health',
        implemented: true,
        category: 'System',
      },
      {
        id: 'system-routes',
        name: 'List API Routes',
        description: 'List all available API routes',
        method: 'GET',
        endpoint: '/system/routes',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-restart',
        name: 'Restart Prowlarr',
        description: 'Restart the Prowlarr application',
        method: 'POST',
        endpoint: '/system/restart',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-shutdown',
        name: 'Shutdown Prowlarr',
        description: 'Shutdown the Prowlarr application',
        method: 'POST',
        endpoint: '/system/shutdown',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-tasks-list',
        name: 'List Scheduled Tasks',
        description: 'List all scheduled tasks',
        method: 'GET',
        endpoint: '/system/task',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-task-get',
        name: 'Get Task',
        description: 'Retrieve specific task by ID',
        method: 'GET',
        endpoint: '/system/task/{id}',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Task ID' },
        ],
      },
      {
        id: 'ping',
        name: 'Ping',
        description: 'Health check endpoint',
        method: 'GET',
        endpoint: '/ping',
        implemented: false,
        category: 'System',
      },

      // Backup
      {
        id: 'backup-list',
        name: 'List Backups',
        description: 'List available backups',
        method: 'GET',
        endpoint: '/system/backup',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'backup-delete',
        name: 'Delete Backup',
        description: 'Remove backup by ID',
        method: 'DELETE',
        endpoint: '/system/backup/{id}',
        implemented: false,
        category: 'Backup',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Backup ID' },
        ],
      },
      {
        id: 'backup-restore',
        name: 'Restore Backup',
        description: 'Restore from backup ID',
        method: 'POST',
        endpoint: '/system/backup/restore/{id}',
        implemented: false,
        category: 'Backup',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Backup ID' },
        ],
      },
      {
        id: 'backup-restore-upload',
        name: 'Restore from Upload',
        description: 'Restore from uploaded backup file',
        method: 'POST',
        endpoint: '/system/backup/restore/upload',
        implemented: false,
        category: 'Backup',
      },

      // Indexers - Implemented
      {
        id: 'indexers-list',
        name: 'List Indexers',
        description: 'List all indexers',
        method: 'GET',
        endpoint: '/indexer',
        implemented: true,
        category: 'Indexers',
      },
      {
        id: 'indexer-get',
        name: 'Get Indexer',
        description: 'Retrieve indexer by ID',
        method: 'GET',
        endpoint: '/indexer/{id}',
        implemented: false,
        category: 'Indexers',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Indexer ID' },
        ],
      },
      {
        id: 'indexer-create',
        name: 'Create Indexer',
        description: 'Create a new indexer',
        method: 'POST',
        endpoint: '/indexer',
        implemented: false,
        category: 'Indexers',
      },
      {
        id: 'indexer-update',
        name: 'Update Indexer',
        description: 'Update an existing indexer',
        method: 'PUT',
        endpoint: '/indexer/{id}',
        implemented: false,
        category: 'Indexers',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Indexer ID' },
          { name: 'forceSave', type: 'boolean', required: false, description: 'Force save changes' },
        ],
      },
      {
        id: 'indexer-delete',
        name: 'Delete Indexer',
        description: 'Remove an indexer',
        method: 'DELETE',
        endpoint: '/indexer/{id}',
        implemented: false,
        category: 'Indexers',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Indexer ID' },
        ],
      },
      {
        id: 'indexer-schema',
        name: 'Get Indexer Schema',
        description: 'Get indexer schema definitions',
        method: 'GET',
        endpoint: '/indexer/schema',
        implemented: false,
        category: 'Indexers',
      },
      {
        id: 'indexer-test',
        name: 'Test Indexer',
        description: 'Test indexer configuration',
        method: 'POST',
        endpoint: '/indexer/test',
        implemented: false,
        category: 'Indexers',
      },
      {
        id: 'indexer-testall',
        name: 'Test All Indexers',
        description: 'Test all indexers',
        method: 'POST',
        endpoint: '/indexer/testall',
        implemented: false,
        category: 'Indexers',
      },
      {
        id: 'indexer-bulk-update',
        name: 'Bulk Update Indexers',
        description: 'Bulk update multiple indexers',
        method: 'PUT',
        endpoint: '/indexer/bulk',
        implemented: false,
        category: 'Indexers',
      },
      {
        id: 'indexer-bulk-delete',
        name: 'Bulk Delete Indexers',
        description: 'Bulk delete multiple indexers',
        method: 'DELETE',
        endpoint: '/indexer/bulk',
        implemented: false,
        category: 'Indexers',
      },
      {
        id: 'indexer-action',
        name: 'Execute Indexer Action',
        description: 'Execute a specific indexer action',
        method: 'POST',
        endpoint: '/indexer/action/{name}',
        implemented: false,
        category: 'Indexers',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Action name' },
        ],
      },
      {
        id: 'indexer-categories',
        name: 'List Indexer Categories',
        description: 'List default indexer categories',
        method: 'GET',
        endpoint: '/indexer/categories',
        implemented: false,
        category: 'Indexers',
      },

      // Indexer Stats - Implemented
      {
        id: 'indexer-stats',
        name: 'Get Indexer Statistics',
        description: 'Get indexer statistics with optional date range',
        method: 'GET',
        endpoint: '/indexerstats',
        implemented: true,
        category: 'Indexers',
        parameters: [
          { name: 'startDate', type: 'string', required: false, description: 'Start date (ISO 8601)' },
          { name: 'endDate', type: 'string', required: false, description: 'End date (ISO 8601)' },
          { name: 'indexers', type: 'number[]', required: false, description: 'Filter by indexer IDs' },
          { name: 'protocols', type: 'string[]', required: false, description: 'Filter by protocols' },
          { name: 'tags', type: 'number[]', required: false, description: 'Filter by tags' },
        ],
      },
      {
        id: 'indexer-status',
        name: 'Get Indexer Status',
        description: 'Retrieve indexer status',
        method: 'GET',
        endpoint: '/indexerstatus',
        implemented: false,
        category: 'Indexers',
      },

      // Indexer Proxy
      {
        id: 'indexer-proxy-list',
        name: 'List Indexer Proxies',
        description: 'List proxy configurations',
        method: 'GET',
        endpoint: '/indexerproxy',
        implemented: false,
        category: 'Indexer Proxy',
      },
      {
        id: 'indexer-proxy-get',
        name: 'Get Indexer Proxy',
        description: 'Retrieve proxy by ID',
        method: 'GET',
        endpoint: '/indexerproxy/{id}',
        implemented: false,
        category: 'Indexer Proxy',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Proxy ID' },
        ],
      },
      {
        id: 'indexer-proxy-create',
        name: 'Create Indexer Proxy',
        description: 'Add a new proxy configuration',
        method: 'POST',
        endpoint: '/indexerproxy',
        implemented: false,
        category: 'Indexer Proxy',
      },
      {
        id: 'indexer-proxy-update',
        name: 'Update Indexer Proxy',
        description: 'Update an existing proxy',
        method: 'PUT',
        endpoint: '/indexerproxy/{id}',
        implemented: false,
        category: 'Indexer Proxy',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Proxy ID' },
        ],
      },
      {
        id: 'indexer-proxy-delete',
        name: 'Delete Indexer Proxy',
        description: 'Remove a proxy',
        method: 'DELETE',
        endpoint: '/indexerproxy/{id}',
        implemented: false,
        category: 'Indexer Proxy',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Proxy ID' },
        ],
      },
      {
        id: 'indexer-proxy-schema',
        name: 'Get Proxy Schema',
        description: 'Get proxy schema definitions',
        method: 'GET',
        endpoint: '/indexerproxy/schema',
        implemented: false,
        category: 'Indexer Proxy',
      },
      {
        id: 'indexer-proxy-test',
        name: 'Test Proxy',
        description: 'Test proxy configuration',
        method: 'POST',
        endpoint: '/indexerproxy/test',
        implemented: false,
        category: 'Indexer Proxy',
      },

      // Search
      {
        id: 'search',
        name: 'Search Releases',
        description: 'Search for releases across indexers',
        method: 'GET',
        endpoint: '/search',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: false, description: 'Search query' },
          { name: 'type', type: 'string', required: false, description: 'Search type' },
          { name: 'indexerIds', type: 'number[]', required: false, description: 'Indexer IDs to search' },
          { name: 'categories', type: 'number[]', required: false, description: 'Category IDs' },
          { name: 'limit', type: 'number', required: false, description: 'Result limit' },
          { name: 'offset', type: 'number', required: false, description: 'Result offset' },
        ],
      },
      {
        id: 'search-post',
        name: 'Submit Search Request',
        description: 'Submit search request via body',
        method: 'POST',
        endpoint: '/search',
        implemented: false,
        category: 'Search',
      },
      {
        id: 'search-bulk',
        name: 'Bulk Search',
        description: 'Perform bulk searches',
        method: 'POST',
        endpoint: '/search/bulk',
        implemented: false,
        category: 'Search',
      },

      // Applications - Implemented
      {
        id: 'applications-list',
        name: 'List Applications',
        description: 'List connected *arr applications',
        method: 'GET',
        endpoint: '/applications',
        implemented: true,
        category: 'Applications',
      },
      {
        id: 'application-get',
        name: 'Get Application',
        description: 'Retrieve application by ID',
        method: 'GET',
        endpoint: '/applications/{id}',
        implemented: false,
        category: 'Applications',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Application ID' },
        ],
      },
      {
        id: 'application-create',
        name: 'Create Application',
        description: 'Add a new application',
        method: 'POST',
        endpoint: '/applications',
        implemented: false,
        category: 'Applications',
      },
      {
        id: 'application-update',
        name: 'Update Application',
        description: 'Update an existing application',
        method: 'PUT',
        endpoint: '/applications/{id}',
        implemented: false,
        category: 'Applications',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Application ID' },
        ],
      },
      {
        id: 'application-delete',
        name: 'Delete Application',
        description: 'Remove an application',
        method: 'DELETE',
        endpoint: '/applications/{id}',
        implemented: false,
        category: 'Applications',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Application ID' },
        ],
      },
      {
        id: 'application-schema',
        name: 'Get Application Schema',
        description: 'Get application schema definitions',
        method: 'GET',
        endpoint: '/applications/schema',
        implemented: false,
        category: 'Applications',
      },
      {
        id: 'application-test',
        name: 'Test Application',
        description: 'Test application connection',
        method: 'POST',
        endpoint: '/applications/test',
        implemented: false,
        category: 'Applications',
      },
      {
        id: 'application-testall',
        name: 'Test All Applications',
        description: 'Test all application connections',
        method: 'POST',
        endpoint: '/applications/testall',
        implemented: false,
        category: 'Applications',
      },
      {
        id: 'application-bulk-update',
        name: 'Bulk Update Applications',
        description: 'Bulk update multiple applications',
        method: 'PUT',
        endpoint: '/applications/bulk',
        implemented: false,
        category: 'Applications',
      },
      {
        id: 'application-bulk-delete',
        name: 'Bulk Delete Applications',
        description: 'Bulk delete multiple applications',
        method: 'DELETE',
        endpoint: '/applications/bulk',
        implemented: false,
        category: 'Applications',
      },

      // Download Clients
      {
        id: 'downloadclient-list',
        name: 'List Download Clients',
        description: 'List download clients',
        method: 'GET',
        endpoint: '/downloadclient',
        implemented: false,
        category: 'Download Clients',
      },
      {
        id: 'downloadclient-get',
        name: 'Get Download Client',
        description: 'Get download client details',
        method: 'GET',
        endpoint: '/downloadclient/{id}',
        implemented: false,
        category: 'Download Clients',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Download client ID' },
        ],
      },
      {
        id: 'downloadclient-create',
        name: 'Create Download Client',
        description: 'Create a new download client',
        method: 'POST',
        endpoint: '/downloadclient',
        implemented: false,
        category: 'Download Clients',
      },
      {
        id: 'downloadclient-update',
        name: 'Update Download Client',
        description: 'Update a download client',
        method: 'PUT',
        endpoint: '/downloadclient/{id}',
        implemented: false,
        category: 'Download Clients',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Download client ID' },
        ],
      },
      {
        id: 'downloadclient-delete',
        name: 'Delete Download Client',
        description: 'Remove a download client',
        method: 'DELETE',
        endpoint: '/downloadclient/{id}',
        implemented: false,
        category: 'Download Clients',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Download client ID' },
        ],
      },
      {
        id: 'downloadclient-schema',
        name: 'Get Download Client Schema',
        description: 'Get download client schema definitions',
        method: 'GET',
        endpoint: '/downloadclient/schema',
        implemented: false,
        category: 'Download Clients',
      },
      {
        id: 'downloadclient-test',
        name: 'Test Download Client',
        description: 'Test download client connection',
        method: 'POST',
        endpoint: '/downloadclient/test',
        implemented: false,
        category: 'Download Clients',
      },

      // History - Implemented
      {
        id: 'history-list',
        name: 'Get History',
        description: 'Query history with pagination and filtering',
        method: 'GET',
        endpoint: '/history',
        implemented: true,
        category: 'History',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'pageSize', type: 'number', required: false, description: 'Page size' },
          { name: 'sortKey', type: 'string', required: false, description: 'Sort field' },
          { name: 'sortDirection', type: 'string', required: false, description: 'Sort direction' },
          { name: 'eventType', type: 'string', required: false, description: 'Event type filter' },
          { name: 'successful', type: 'boolean', required: false, description: 'Success filter' },
          { name: 'downloadId', type: 'string', required: false, description: 'Download ID filter' },
          { name: 'indexerIds', type: 'number[]', required: false, description: 'Indexer IDs filter' },
        ],
      },
      {
        id: 'history-since',
        name: 'Get History Since',
        description: 'Get history since specific date',
        method: 'GET',
        endpoint: '/history/since',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'date', type: 'string', required: true, description: 'Date (ISO 8601)' },
        ],
      },
      {
        id: 'history-indexer',
        name: 'Get Indexer History',
        description: 'Get indexer-specific history',
        method: 'GET',
        endpoint: '/history/indexer',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'indexerId', type: 'number', required: true, description: 'Indexer ID' },
        ],
      },

      // Notifications
      {
        id: 'notification-list',
        name: 'List Notifications',
        description: 'List notification configurations',
        method: 'GET',
        endpoint: '/notification',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notification-get',
        name: 'Get Notification',
        description: 'Get notification by ID',
        method: 'GET',
        endpoint: '/notification/{id}',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Notification ID' },
        ],
      },
      {
        id: 'notification-create',
        name: 'Create Notification',
        description: 'Create a new notification',
        method: 'POST',
        endpoint: '/notification',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notification-update',
        name: 'Update Notification',
        description: 'Update a notification',
        method: 'PUT',
        endpoint: '/notification/{id}',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Notification ID' },
        ],
      },
      {
        id: 'notification-delete',
        name: 'Delete Notification',
        description: 'Remove a notification',
        method: 'DELETE',
        endpoint: '/notification/{id}',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Notification ID' },
        ],
      },
      {
        id: 'notification-schema',
        name: 'Get Notification Schema',
        description: 'Get notification schema definitions',
        method: 'GET',
        endpoint: '/notification/schema',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notification-test',
        name: 'Test Notification',
        description: 'Test notification configuration',
        method: 'POST',
        endpoint: '/notification/test',
        implemented: false,
        category: 'Notifications',
      },

      // Tags
      {
        id: 'tags-list',
        name: 'List Tags',
        description: 'List all tags',
        method: 'GET',
        endpoint: '/tag',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tag-get',
        name: 'Get Tag',
        description: 'Retrieve tag by ID',
        method: 'GET',
        endpoint: '/tag/{id}',
        implemented: false,
        category: 'Tags',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Tag ID' },
        ],
      },
      {
        id: 'tag-create',
        name: 'Create Tag',
        description: 'Create a new tag',
        method: 'POST',
        endpoint: '/tag',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tag-update',
        name: 'Update Tag',
        description: 'Update a tag',
        method: 'PUT',
        endpoint: '/tag/{id}',
        implemented: false,
        category: 'Tags',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Tag ID' },
        ],
      },
      {
        id: 'tag-delete',
        name: 'Delete Tag',
        description: 'Remove a tag',
        method: 'DELETE',
        endpoint: '/tag/{id}',
        implemented: false,
        category: 'Tags',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Tag ID' },
        ],
      },
      {
        id: 'tag-detail',
        name: 'Get Tag Details',
        description: 'Get detailed tag information',
        method: 'GET',
        endpoint: '/tag/detail',
        implemented: false,
        category: 'Tags',
      },

      // App Profiles
      {
        id: 'appprofile-list',
        name: 'List App Profiles',
        description: 'List application profiles',
        method: 'GET',
        endpoint: '/appprofile',
        implemented: false,
        category: 'Profiles',
      },
      {
        id: 'appprofile-get',
        name: 'Get App Profile',
        description: 'Retrieve profile by ID',
        method: 'GET',
        endpoint: '/appprofile/{id}',
        implemented: false,
        category: 'Profiles',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Profile ID' },
        ],
      },
      {
        id: 'appprofile-create',
        name: 'Create App Profile',
        description: 'Create a new profile',
        method: 'POST',
        endpoint: '/appprofile',
        implemented: false,
        category: 'Profiles',
      },
      {
        id: 'appprofile-update',
        name: 'Update App Profile',
        description: 'Update a profile',
        method: 'PUT',
        endpoint: '/appprofile/{id}',
        implemented: false,
        category: 'Profiles',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Profile ID' },
        ],
      },
      {
        id: 'appprofile-delete',
        name: 'Delete App Profile',
        description: 'Remove a profile',
        method: 'DELETE',
        endpoint: '/appprofile/{id}',
        implemented: false,
        category: 'Profiles',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Profile ID' },
        ],
      },

      // Commands
      {
        id: 'command-list',
        name: 'List Commands',
        description: 'List all commands',
        method: 'GET',
        endpoint: '/command',
        implemented: false,
        category: 'Commands',
      },
      {
        id: 'command-get',
        name: 'Get Command',
        description: 'Get command status',
        method: 'GET',
        endpoint: '/command/{id}',
        implemented: false,
        category: 'Commands',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Command ID' },
        ],
      },
      {
        id: 'command-run',
        name: 'Run Command',
        description: 'Execute a command',
        method: 'POST',
        endpoint: '/command',
        implemented: false,
        category: 'Commands',
      },
      {
        id: 'command-cancel',
        name: 'Cancel Command',
        description: 'Cancel a running command',
        method: 'DELETE',
        endpoint: '/command/{id}',
        implemented: false,
        category: 'Commands',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Command ID' },
        ],
      },

      // Configuration
      {
        id: 'config-host',
        name: 'Get Host Config',
        description: 'Get host configuration',
        method: 'GET',
        endpoint: '/config/host',
        implemented: false,
        category: 'Configuration',
      },
      {
        id: 'config-host-update',
        name: 'Update Host Config',
        description: 'Update host configuration',
        method: 'PUT',
        endpoint: '/config/host/{id}',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Config ID' },
        ],
      },
      {
        id: 'config-ui',
        name: 'Get UI Config',
        description: 'Get UI configuration',
        method: 'GET',
        endpoint: '/config/ui',
        implemented: false,
        category: 'Configuration',
      },
      {
        id: 'config-ui-update',
        name: 'Update UI Config',
        description: 'Update UI configuration',
        method: 'PUT',
        endpoint: '/config/ui/{id}',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Config ID' },
        ],
      },
      {
        id: 'config-downloadclient',
        name: 'Get Download Client Config',
        description: 'Get download client configuration',
        method: 'GET',
        endpoint: '/config/downloadclient',
        implemented: false,
        category: 'Configuration',
      },

      // Custom Filters
      {
        id: 'customfilter-list',
        name: 'List Custom Filters',
        description: 'List custom filters',
        method: 'GET',
        endpoint: '/customfilter',
        implemented: false,
        category: 'Custom Filters',
      },
      {
        id: 'customfilter-get',
        name: 'Get Custom Filter',
        description: 'Retrieve filter by ID',
        method: 'GET',
        endpoint: '/customfilter/{id}',
        implemented: false,
        category: 'Custom Filters',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Filter ID' },
        ],
      },
      {
        id: 'customfilter-create',
        name: 'Create Custom Filter',
        description: 'Create a new filter',
        method: 'POST',
        endpoint: '/customfilter',
        implemented: false,
        category: 'Custom Filters',
      },
      {
        id: 'customfilter-update',
        name: 'Update Custom Filter',
        description: 'Update a filter',
        method: 'PUT',
        endpoint: '/customfilter/{id}',
        implemented: false,
        category: 'Custom Filters',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Filter ID' },
        ],
      },
      {
        id: 'customfilter-delete',
        name: 'Delete Custom Filter',
        description: 'Remove a filter',
        method: 'DELETE',
        endpoint: '/customfilter/{id}',
        implemented: false,
        category: 'Custom Filters',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Filter ID' },
        ],
      },

      // Logs
      {
        id: 'logs-list',
        name: 'Get Logs',
        description: 'View application logs with pagination',
        method: 'GET',
        endpoint: '/log',
        implemented: false,
        category: 'Logs',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'pageSize', type: 'number', required: false, description: 'Page size' },
          { name: 'sortKey', type: 'string', required: false, description: 'Sort field' },
          { name: 'sortDirection', type: 'string', required: false, description: 'Sort direction' },
        ],
      },
      {
        id: 'logs-files',
        name: 'List Log Files',
        description: 'List available log files',
        method: 'GET',
        endpoint: '/log/file',
        implemented: false,
        category: 'Logs',
      },
      {
        id: 'logs-file-download',
        name: 'Download Log File',
        description: 'Download specific log file',
        method: 'GET',
        endpoint: '/log/file/{filename}',
        implemented: false,
        category: 'Logs',
        parameters: [
          { name: 'filename', type: 'string', required: true, description: 'Log filename' },
        ],
      },
      {
        id: 'logs-update-files',
        name: 'List Update Log Files',
        description: 'List update log files',
        method: 'GET',
        endpoint: '/log/file/update',
        implemented: false,
        category: 'Logs',
      },

      // Newznab/Torznab (Indexer API)
      {
        id: 'newznab-api',
        name: 'Newznab/Torznab API',
        description: 'Access Newznab-compatible search API',
        method: 'GET',
        endpoint: '/indexer/{id}/newznab',
        implemented: false,
        category: 'Newznab',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Indexer ID' },
          { name: 't', type: 'string', required: false, description: 'Function (search, tvsearch, movie, etc.)' },
          { name: 'q', type: 'string', required: false, description: 'Search query' },
          { name: 'cat', type: 'string', required: false, description: 'Categories' },
        ],
      },
      {
        id: 'indexer-download',
        name: 'Download from Indexer',
        description: 'Download release from indexer',
        method: 'GET',
        endpoint: '/indexer/{id}/download',
        implemented: false,
        category: 'Newznab',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Indexer ID' },
          { name: 'link', type: 'string', required: false, description: 'Download link' },
          { name: 'file', type: 'string', required: false, description: 'Filename' },
        ],
      },

      // File System
      {
        id: 'filesystem-browse',
        name: 'Browse Filesystem',
        description: 'Browse filesystem paths',
        method: 'GET',
        endpoint: '/filesystem',
        implemented: false,
        category: 'Filesystem',
        parameters: [
          { name: 'path', type: 'string', required: false, description: 'Path to browse' },
          { name: 'includeFiles', type: 'boolean', required: false, description: 'Include files' },
        ],
      },
      {
        id: 'filesystem-type',
        name: 'Get Filesystem Type',
        description: 'Determine filesystem item type',
        method: 'GET',
        endpoint: '/filesystem/type',
        implemented: false,
        category: 'Filesystem',
        parameters: [
          { name: 'path', type: 'string', required: true, description: 'Path to check' },
        ],
      },

      // Updates
      {
        id: 'updates-list',
        name: 'List Updates',
        description: 'Get available updates',
        method: 'GET',
        endpoint: '/update',
        implemented: false,
        category: 'Updates',
      },

      // Localization
      {
        id: 'localization',
        name: 'Get Localization',
        description: 'Get localization data',
        method: 'GET',
        endpoint: '/localization',
        implemented: false,
        category: 'Localization',
      },
      {
        id: 'localization-options',
        name: 'Get Language Options',
        description: 'Get available language options',
        method: 'GET',
        endpoint: '/localization/options',
        implemented: false,
        category: 'Localization',
      },
    ];
  }
}
