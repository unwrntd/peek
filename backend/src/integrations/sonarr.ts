import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  SonarrConfig,
  SonarrSystemStatus,
  SonarrDiskSpace,
  SonarrSeries,
  SonarrEpisode,
  SonarrQueueRecord,
  SonarrHistoryRecord,
  SonarrHealth,
} from '../types';
import { logger } from '../services/logger';

export class SonarrIntegration extends BaseIntegration {
  readonly type = 'sonarr';
  readonly name = 'Sonarr';

  private createClient(config: SonarrConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 8989}/api/v3`;

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
    const sonarrConfig = config as SonarrConfig;

    if (!sonarrConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!sonarrConfig.apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const client = this.createClient(sonarrConfig);
      const [statusResponse, seriesResponse] = await Promise.all([
        client.get('/system/status'),
        client.get('/series'),
      ]);

      const status = statusResponse.data;
      const series = seriesResponse.data;

      return {
        success: true,
        message: `Connected to Sonarr v${status.version}`,
        details: {
          version: status.version,
          branch: status.branch,
          seriesCount: series.length,
          osName: status.osName,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('sonarr', 'Connection test failed', { error: errorMsg });

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
            message: `Connection refused: Cannot reach ${sonarrConfig.host}:${sonarrConfig.port || 8989}`,
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
    const sonarrConfig = config as SonarrConfig;
    const client = this.createClient(sonarrConfig);

    switch (metric) {
      case 'system-status':
        return this.getSystemStatus(client);
      case 'series':
        return this.getSeries(client);
      case 'calendar':
        return this.getCalendar(client);
      case 'queue':
        return this.getQueue(client);
      case 'wanted':
        return this.getWantedMissing(client);
      case 'history':
        return this.getHistory(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getSystemStatus(client: AxiosInstance): Promise<{
    systemStatus: SonarrSystemStatus;
    diskSpace: SonarrDiskSpace[];
    health: SonarrHealth[];
  }> {
    try {
      const [statusResponse, diskResponse, healthResponse] = await Promise.all([
        client.get('/system/status'),
        client.get('/diskspace'),
        client.get('/health'),
      ]);

      return {
        systemStatus: statusResponse.data,
        diskSpace: diskResponse.data,
        health: healthResponse.data,
      };
    } catch (error) {
      logger.error('sonarr', 'Failed to get system status', { error });
      throw error;
    }
  }

  private async getSeries(client: AxiosInstance): Promise<{ series: SonarrSeries[] }> {
    try {
      const response = await client.get('/series');
      return { series: response.data };
    } catch (error) {
      logger.error('sonarr', 'Failed to get series', { error });
      throw error;
    }
  }

  private async getCalendar(client: AxiosInstance): Promise<{ episodes: SonarrEpisode[] }> {
    try {
      // Get episodes for past 7 days and next 14 days
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);

      const response = await client.get('/calendar', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
          includeSeries: true,
          includeEpisodeFile: false,
        },
      });

      return { episodes: response.data };
    } catch (error) {
      logger.error('sonarr', 'Failed to get calendar', { error });
      throw error;
    }
  }

  private async getQueue(client: AxiosInstance): Promise<{
    queue: SonarrQueueRecord[];
    totalRecords: number;
  }> {
    try {
      const response = await client.get('/queue', {
        params: {
          page: 1,
          pageSize: 50,
          includeSeries: true,
          includeEpisode: true,
        },
      });

      return {
        queue: response.data.records || [],
        totalRecords: response.data.totalRecords || 0,
      };
    } catch (error) {
      logger.error('sonarr', 'Failed to get queue', { error });
      throw error;
    }
  }

  private async getWantedMissing(client: AxiosInstance): Promise<{
    missing: SonarrEpisode[];
    totalRecords: number;
  }> {
    try {
      const response = await client.get('/wanted/missing', {
        params: {
          page: 1,
          pageSize: 50,
          sortKey: 'airDateUtc',
          sortDirection: 'descending',
          includeSeries: true,
        },
      });

      return {
        missing: response.data.records || [],
        totalRecords: response.data.totalRecords || 0,
      };
    } catch (error) {
      logger.error('sonarr', 'Failed to get wanted/missing', { error });
      throw error;
    }
  }

  private async getHistory(client: AxiosInstance): Promise<{
    history: SonarrHistoryRecord[];
    totalRecords: number;
  }> {
    try {
      const response = await client.get('/history', {
        params: {
          page: 1,
          pageSize: 50,
          sortKey: 'date',
          sortDirection: 'descending',
          includeSeries: true,
          includeEpisode: true,
        },
      });

      return {
        history: response.data.records || [],
        totalRecords: response.data.totalRecords || 0,
      };
    } catch (error) {
      logger.error('sonarr', 'Failed to get history', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'system-status',
        name: 'System Status',
        description: 'Server info, disk space, and health',
        widgetTypes: ['sonarr-status'],
      },
      {
        id: 'series',
        name: 'Series Library',
        description: 'All TV series with episode statistics',
        widgetTypes: ['sonarr-series'],
      },
      {
        id: 'calendar',
        name: 'Calendar',
        description: 'Upcoming and recent episodes',
        widgetTypes: ['sonarr-calendar'],
      },
      {
        id: 'queue',
        name: 'Download Queue',
        description: 'Active downloads with progress',
        widgetTypes: ['sonarr-queue'],
      },
      {
        id: 'wanted',
        name: 'Wanted/Missing',
        description: 'Missing episodes',
        widgetTypes: ['sonarr-wanted'],
      },
      {
        id: 'history',
        name: 'History',
        description: 'Recent activity and downloads',
        widgetTypes: ['sonarr-history'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // System - Implemented
      {
        id: 'system-status',
        name: 'Get System Status',
        description: 'Get Sonarr system status and version info',
        method: 'GET',
        endpoint: '/system/status',
        implemented: true,
        category: 'System',
        documentationUrl: 'https://sonarr.tv/docs/api/',
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
        id: 'disk-space',
        name: 'Get Disk Space',
        description: 'Get disk space for root folders',
        method: 'GET',
        endpoint: '/diskspace',
        implemented: true,
        category: 'System',
      },
      {
        id: 'system-backup',
        name: 'List Backups',
        description: 'Get list of available backups',
        method: 'GET',
        endpoint: '/system/backup',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-restart',
        name: 'Restart Sonarr',
        description: 'Restart the Sonarr service',
        method: 'POST',
        endpoint: '/system/restart',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-shutdown',
        name: 'Shutdown Sonarr',
        description: 'Shutdown the Sonarr service',
        method: 'POST',
        endpoint: '/system/shutdown',
        implemented: false,
        category: 'System',
      },

      // Series - Implemented
      {
        id: 'series-list',
        name: 'List Series',
        description: 'Get all TV series',
        method: 'GET',
        endpoint: '/series',
        implemented: true,
        category: 'Series',
      },
      {
        id: 'series-get',
        name: 'Get Series',
        description: 'Get a specific TV series by ID',
        method: 'GET',
        endpoint: '/series/{id}',
        implemented: false,
        category: 'Series',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Series ID' },
        ],
      },
      {
        id: 'series-add',
        name: 'Add Series',
        description: 'Add a new TV series',
        method: 'POST',
        endpoint: '/series',
        implemented: false,
        category: 'Series',
      },
      {
        id: 'series-update',
        name: 'Update Series',
        description: 'Update an existing series',
        method: 'PUT',
        endpoint: '/series/{id}',
        implemented: false,
        category: 'Series',
      },
      {
        id: 'series-delete',
        name: 'Delete Series',
        description: 'Delete a series and optionally files',
        method: 'DELETE',
        endpoint: '/series/{id}',
        implemented: false,
        category: 'Series',
        parameters: [
          { name: 'deleteFiles', type: 'boolean', required: false, description: 'Also delete files' },
        ],
      },
      {
        id: 'series-lookup',
        name: 'Search Series',
        description: 'Search for series to add',
        method: 'GET',
        endpoint: '/series/lookup',
        implemented: false,
        category: 'Series',
        parameters: [
          { name: 'term', type: 'string', required: true, description: 'Search term' },
        ],
      },

      // Episodes
      {
        id: 'episode-list',
        name: 'List Episodes',
        description: 'Get episodes for a series',
        method: 'GET',
        endpoint: '/episode',
        implemented: false,
        category: 'Episodes',
        parameters: [
          { name: 'seriesId', type: 'number', required: true, description: 'Series ID' },
        ],
      },
      {
        id: 'episode-get',
        name: 'Get Episode',
        description: 'Get a specific episode',
        method: 'GET',
        endpoint: '/episode/{id}',
        implemented: false,
        category: 'Episodes',
      },
      {
        id: 'episode-file-list',
        name: 'List Episode Files',
        description: 'Get episode files for a series',
        method: 'GET',
        endpoint: '/episodefile',
        implemented: false,
        category: 'Episodes',
      },
      {
        id: 'episode-file-delete',
        name: 'Delete Episode File',
        description: 'Delete an episode file',
        method: 'DELETE',
        endpoint: '/episodefile/{id}',
        implemented: false,
        category: 'Episodes',
      },

      // Calendar - Implemented
      {
        id: 'calendar',
        name: 'Get Calendar',
        description: 'Get upcoming and recent episodes',
        method: 'GET',
        endpoint: '/calendar',
        implemented: true,
        category: 'Calendar',
        parameters: [
          { name: 'start', type: 'string', required: false, description: 'Start date (ISO 8601)' },
          { name: 'end', type: 'string', required: false, description: 'End date (ISO 8601)' },
        ],
      },

      // Queue - Implemented
      {
        id: 'queue-list',
        name: 'Get Queue',
        description: 'Get download queue',
        method: 'GET',
        endpoint: '/queue',
        implemented: true,
        category: 'Queue',
      },
      {
        id: 'queue-details',
        name: 'Get Queue Details',
        description: 'Get detailed queue with pagination',
        method: 'GET',
        endpoint: '/queue/details',
        implemented: false,
        category: 'Queue',
      },
      {
        id: 'queue-delete',
        name: 'Remove from Queue',
        description: 'Remove item from download queue',
        method: 'DELETE',
        endpoint: '/queue/{id}',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'blocklist', type: 'boolean', required: false, description: 'Add to blocklist' },
        ],
      },

      // Wanted - Implemented
      {
        id: 'wanted-missing',
        name: 'Get Missing Episodes',
        description: 'Get missing episodes (wanted)',
        method: 'GET',
        endpoint: '/wanted/missing',
        implemented: true,
        category: 'Wanted',
      },
      {
        id: 'wanted-cutoff',
        name: 'Get Cutoff Unmet',
        description: 'Get episodes not meeting quality cutoff',
        method: 'GET',
        endpoint: '/wanted/cutoff',
        implemented: false,
        category: 'Wanted',
      },

      // History - Implemented
      {
        id: 'history-list',
        name: 'Get History',
        description: 'Get activity history',
        method: 'GET',
        endpoint: '/history',
        implemented: true,
        category: 'History',
      },
      {
        id: 'history-since',
        name: 'Get History Since',
        description: 'Get history since a date',
        method: 'GET',
        endpoint: '/history/since',
        implemented: false,
        category: 'History',
      },

      // Commands
      {
        id: 'command-list',
        name: 'List Commands',
        description: 'Get running/queued commands',
        method: 'GET',
        endpoint: '/command',
        implemented: false,
        category: 'Commands',
      },
      {
        id: 'command-run',
        name: 'Run Command',
        description: 'Execute a command (scan, search, etc.)',
        method: 'POST',
        endpoint: '/command',
        implemented: false,
        category: 'Commands',
      },
      {
        id: 'rescan-series',
        name: 'Rescan Series',
        description: 'Scan disk for series files',
        method: 'POST',
        endpoint: '/command',
        implemented: false,
        category: 'Commands',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'RescanSeries' },
          { name: 'seriesId', type: 'number', required: false, description: 'Series ID (all if omitted)' },
        ],
      },
      {
        id: 'search-series',
        name: 'Search Series',
        description: 'Search indexers for series',
        method: 'POST',
        endpoint: '/command',
        implemented: false,
        category: 'Commands',
      },
      {
        id: 'refresh-series',
        name: 'Refresh Series',
        description: 'Refresh series metadata from TVDB',
        method: 'POST',
        endpoint: '/command',
        implemented: false,
        category: 'Commands',
      },
      {
        id: 'rss-sync',
        name: 'RSS Sync',
        description: 'Sync with RSS feeds',
        method: 'POST',
        endpoint: '/command',
        implemented: false,
        category: 'Commands',
      },

      // Profiles
      {
        id: 'quality-profiles',
        name: 'List Quality Profiles',
        description: 'Get quality profiles',
        method: 'GET',
        endpoint: '/qualityprofile',
        implemented: false,
        category: 'Profiles',
      },
      {
        id: 'language-profiles',
        name: 'List Language Profiles',
        description: 'Get language profiles',
        method: 'GET',
        endpoint: '/languageprofile',
        implemented: false,
        category: 'Profiles',
      },
      {
        id: 'delay-profiles',
        name: 'List Delay Profiles',
        description: 'Get delay profiles',
        method: 'GET',
        endpoint: '/delayprofile',
        implemented: false,
        category: 'Profiles',
      },
      {
        id: 'release-profiles',
        name: 'List Release Profiles',
        description: 'Get release profiles (preferred words)',
        method: 'GET',
        endpoint: '/releaseprofile',
        implemented: false,
        category: 'Profiles',
      },

      // Root Folders
      {
        id: 'root-folders',
        name: 'List Root Folders',
        description: 'Get configured root folders',
        method: 'GET',
        endpoint: '/rootfolder',
        implemented: false,
        category: 'Configuration',
      },

      // Tags
      {
        id: 'tags',
        name: 'List Tags',
        description: 'Get all tags',
        method: 'GET',
        endpoint: '/tag',
        implemented: false,
        category: 'Configuration',
      },

      // Indexers
      {
        id: 'indexers',
        name: 'List Indexers',
        description: 'Get configured indexers',
        method: 'GET',
        endpoint: '/indexer',
        implemented: false,
        category: 'Indexers',
      },
      {
        id: 'indexer-test',
        name: 'Test Indexer',
        description: 'Test an indexer connection',
        method: 'POST',
        endpoint: '/indexer/test',
        implemented: false,
        category: 'Indexers',
      },

      // Download Clients
      {
        id: 'download-clients',
        name: 'List Download Clients',
        description: 'Get configured download clients',
        method: 'GET',
        endpoint: '/downloadclient',
        implemented: false,
        category: 'Download Clients',
      },

      // Notifications
      {
        id: 'notifications',
        name: 'List Notifications',
        description: 'Get configured notifications',
        method: 'GET',
        endpoint: '/notification',
        implemented: false,
        category: 'Notifications',
      },

      // Manual Import
      {
        id: 'manual-import',
        name: 'Manual Import',
        description: 'Get files for manual import',
        method: 'GET',
        endpoint: '/manualimport',
        implemented: false,
        category: 'Import',
        parameters: [
          { name: 'folder', type: 'string', required: true, description: 'Folder path' },
        ],
      },

      // Parse
      {
        id: 'parse',
        name: 'Parse Title',
        description: 'Parse a release title',
        method: 'GET',
        endpoint: '/parse',
        implemented: false,
        category: 'Utilities',
        parameters: [
          { name: 'title', type: 'string', required: true, description: 'Release title to parse' },
        ],
      },

      // Rename
      {
        id: 'rename',
        name: 'Preview Rename',
        description: 'Preview episode file renaming',
        method: 'GET',
        endpoint: '/rename',
        implemented: false,
        category: 'Utilities',
        parameters: [
          { name: 'seriesId', type: 'number', required: true, description: 'Series ID' },
        ],
      },

      // Logs
      {
        id: 'logs',
        name: 'Get Logs',
        description: 'Get log entries',
        method: 'GET',
        endpoint: '/log',
        implemented: false,
        category: 'System',
      },
      {
        id: 'log-files',
        name: 'List Log Files',
        description: 'Get available log files',
        method: 'GET',
        endpoint: '/log/file',
        implemented: false,
        category: 'System',
      },
    ];
  }
}
