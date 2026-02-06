import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  BazarrConfig,
  BazarrStatus,
  BazarrWanted,
  BazarrHistoryItem,
  BazarrSeriesItem,
  BazarrMovieItem,
} from '../types';
import { logger } from '../services/logger';

export class BazarrIntegration extends BaseIntegration {
  readonly type = 'bazarr';
  readonly name = 'Bazarr';

  private createClient(config: BazarrConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 6767}/api`;

    return axios.create({
      baseURL,
      params: {
        apikey: config.apiKey,
      },
      headers: {
        'Accept': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const bazarrConfig = config as BazarrConfig;

    if (!bazarrConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!bazarrConfig.apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const client = this.createClient(bazarrConfig);
      const statusResponse = await client.get('/system/status');
      const status = statusResponse.data;

      return {
        success: true,
        message: `Connected to Bazarr v${status.data?.bazarr_version || 'unknown'}`,
        details: {
          version: status.data?.bazarr_version,
          pythonVersion: status.data?.python_version,
          sonarr: status.data?.sonarr_version ? `v${status.data.sonarr_version}` : 'Not configured',
          radarr: status.data?.radarr_version ? `v${status.data.radarr_version}` : 'Not configured',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('bazarr', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            message: 'Authentication failed: Invalid API key',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused: Cannot reach ${bazarrConfig.host}:${bazarrConfig.port || 6767}`,
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
    const bazarrConfig = config as BazarrConfig;
    const client = this.createClient(bazarrConfig);
    const baseUrl = this.getBaseUrl(bazarrConfig);

    switch (metric) {
      case 'status':
        return this.getStatus(client);
      case 'wanted':
        return this.getWanted(client);
      case 'history':
        return this.getHistory(client);
      case 'series':
        return this.getSeries(client, baseUrl, bazarrConfig.apiKey);
      case 'movies':
        return this.getMovies(client, baseUrl, bazarrConfig.apiKey);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private getBaseUrl(config: BazarrConfig): string {
    const protocol = config.verifySSL ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port || 6767}`;
  }

  private async getStatus(client: AxiosInstance): Promise<{ status: BazarrStatus }> {
    try {
      const response = await client.get('/system/status');
      const data = response.data.data || {};

      // Convert start_time - Bazarr returns Unix timestamp in seconds
      let startTime = new Date().toISOString();
      const rawStartTime = data.start_time;
      if (rawStartTime) {
        if (typeof rawStartTime === 'number') {
          // Unix timestamp - check if seconds or milliseconds
          if (rawStartTime > 1000000000000) {
            startTime = new Date(rawStartTime).toISOString();
          } else {
            startTime = new Date(rawStartTime * 1000).toISOString();
          }
        } else if (typeof rawStartTime === 'string') {
          // Check if it's a numeric string (Unix timestamp)
          const numericValue = Number(rawStartTime);
          if (!isNaN(numericValue) && numericValue > 1000000000000) {
            startTime = new Date(numericValue).toISOString();
          } else if (!isNaN(numericValue) && numericValue > 1000000000) {
            startTime = new Date(numericValue * 1000).toISOString();
          } else {
            // Assume it's already a date string
            startTime = rawStartTime;
          }
        }
      }

      const status: BazarrStatus = {
        version: data.bazarr_version || 'Unknown',
        pythonVersion: data.python_version || 'Unknown',
        startTime,
        timezone: data.timezone || 'UTC',
      };

      return { status };
    } catch (error) {
      logger.error('bazarr', 'Failed to get status', { error });
      throw error;
    }
  }

  private async getWanted(client: AxiosInstance): Promise<{ wanted: BazarrWanted }> {
    try {
      // Get all series and movies to calculate totals properly
      // /episodes/wanted returns EPISODE count, not series count
      // /movies/wanted returns movies missing subtitles
      const [seriesResponse, moviesResponse, moviesWantedResponse] = await Promise.all([
        client.get('/series', { params: { start: 0, length: -1 } }), // Get all series
        client.get('/movies', { params: { start: 0, length: -1 } }), // Get all movies
        client.get('/movies/wanted', { params: { length: 1 } }),
      ]);

      const seriesData = seriesResponse.data.data || [];
      const moviesData = moviesResponse.data.data || [];

      // Calculate episode totals from series data
      let totalEpisodes = 0;
      let missingEpisodes = 0;
      for (const series of seriesData) {
        totalEpisodes += (series.episodeFileCount as number) || 0;
        missingEpisodes += (series.episodeMissingCount as number) || 0;
      }

      // For movies, count those with missing_subtitles
      const moviesMissing = moviesData.filter((m: Record<string, unknown>) => {
        const missing = m.missing_subtitles as string[] | undefined;
        return missing && missing.length > 0;
      }).length;

      const wanted: BazarrWanted = {
        seriesTotal: totalEpisodes,
        seriesMissing: missingEpisodes,
        moviesTotal: moviesData.length,
        moviesMissing: moviesWantedResponse.data.total ?? moviesMissing,
      };

      logger.debug('bazarr', 'Wanted data', { wanted });

      return { wanted };
    } catch (error) {
      logger.error('bazarr', 'Failed to get wanted', { error });
      throw error;
    }
  }

  private async getHistory(client: AxiosInstance): Promise<{
    history: BazarrHistoryItem[];
    totalRecords: number;
  }> {
    try {
      // Get history for both series and movies
      const [seriesHistoryResponse, moviesHistoryResponse] = await Promise.all([
        client.get('/history/series', { params: { start: 0, length: 25 } }),
        client.get('/history/movies', { params: { start: 0, length: 25 } }),
      ]);

      const seriesHistory = (seriesHistoryResponse.data.data || []).map((item: Record<string, unknown>) => ({
        id: item.id as number,
        action: this.mapAction(item.action as number),
        title: `${item.seriesTitle || ''} - S${String(item.season || 0).padStart(2, '0')}E${String(item.episode || 0).padStart(2, '0')} - ${item.episodeTitle || ''}`,
        season: item.season as number,
        episode: item.episode as number,
        language: (item.language as { name?: string })?.name || String(item.language) || 'Unknown',
        provider: (item.provider as string) || 'Unknown',
        timestamp: (item.timestamp as string) || new Date().toISOString(),
        type: 'series' as const,
        score: item.score as number,
      }));

      const moviesHistory = (moviesHistoryResponse.data.data || []).map((item: Record<string, unknown>) => ({
        id: item.id as number,
        action: this.mapAction(item.action as number),
        title: (item.title as string) || 'Unknown',
        language: (item.language as { name?: string })?.name || String(item.language) || 'Unknown',
        provider: (item.provider as string) || 'Unknown',
        timestamp: (item.timestamp as string) || new Date().toISOString(),
        type: 'movie' as const,
        score: item.score as number,
      }));

      // Combine and sort by timestamp
      const allHistory = [...seriesHistory, ...moviesHistory].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const totalRecords =
        (seriesHistoryResponse.data.data?.total || seriesHistory.length) +
        (moviesHistoryResponse.data.data?.total || moviesHistory.length);

      return {
        history: allHistory.slice(0, 50),
        totalRecords,
      };
    } catch (error) {
      logger.error('bazarr', 'Failed to get history', { error });
      throw error;
    }
  }

  private mapAction(action: number): BazarrHistoryItem['action'] {
    switch (action) {
      case 1:
        return 'downloaded';
      case 2:
        return 'upgraded';
      case 3:
        return 'manual';
      case 4:
        return 'deleted';
      case 5:
        return 'synced';
      default:
        return 'downloaded';
    }
  }

  private async getSeries(client: AxiosInstance, baseUrl: string, apiKey: string): Promise<{
    series: BazarrSeriesItem[];
    totalRecords: number;
  }> {
    try {
      const response = await client.get('/series', { params: { start: 0, length: 100 } });
      const data = response.data.data || [];

      const series: BazarrSeriesItem[] = data.map((item: Record<string, unknown>) => {
        // Construct poster URL - Bazarr provides poster path that needs auth
        let posterUrl: string | undefined;
        if (item.poster) {
          // Bazarr poster paths are typically like /images/series/{id}.jpg
          posterUrl = `${baseUrl}${item.poster}?apikey=${apiKey}`;
        }

        return {
          sonarrSeriesId: item.sonarrSeriesId as number,
          title: (item.title as string) || 'Unknown',
          year: (item.year as number) || 0,
          poster: posterUrl,
          episodeCount: (item.episodeFileCount as number) || 0,
          missingSubtitles: (item.episodeMissingCount as number) || 0,
          monitored: (item.monitored as boolean) || false,
          profileId: item.profileId as number,
        };
      });

      return {
        series,
        totalRecords: response.data.total || series.length,
      };
    } catch (error) {
      logger.error('bazarr', 'Failed to get series', { error });
      throw error;
    }
  }

  private async getMovies(client: AxiosInstance, baseUrl: string, apiKey: string): Promise<{
    movies: BazarrMovieItem[];
    totalRecords: number;
  }> {
    try {
      const response = await client.get('/movies', { params: { start: 0, length: 100 } });
      const data = response.data.data || [];

      const movies: BazarrMovieItem[] = data.map((item: Record<string, unknown>) => {
        // Construct poster URL - Bazarr provides poster path that needs auth
        let posterUrl: string | undefined;
        if (item.poster) {
          // Bazarr poster paths are typically like /images/movies/{id}.jpg
          posterUrl = `${baseUrl}${item.poster}?apikey=${apiKey}`;
        }

        return {
          radarrId: item.radarrId as number,
          title: (item.title as string) || 'Unknown',
          year: (item.year as number) || 0,
          poster: posterUrl,
          missingSubtitles: (item.missing_subtitles as string[]) || [],
          monitored: (item.monitored as boolean) || false,
          profileId: item.profileId as number,
        };
      });

      return {
        movies,
        totalRecords: response.data.total || movies.length,
      };
    } catch (error) {
      logger.error('bazarr', 'Failed to get movies', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'System Status',
        description: 'Bazarr version and system info',
        widgetTypes: ['bazarr-status'],
      },
      {
        id: 'wanted',
        name: 'Wanted Overview',
        description: 'Missing subtitle counts',
        widgetTypes: ['bazarr-wanted'],
      },
      {
        id: 'history',
        name: 'Recent Activity',
        description: 'Recent subtitle downloads and upgrades',
        widgetTypes: ['bazarr-history'],
      },
      {
        id: 'series',
        name: 'Series Status',
        description: 'Series with missing subtitles',
        widgetTypes: ['bazarr-series'],
      },
      {
        id: 'movies',
        name: 'Movies Status',
        description: 'Movies with missing subtitles',
        widgetTypes: ['bazarr-movies'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // System - Implemented
      {
        id: 'system-status',
        name: 'Get System Status',
        description: 'Return environment information and versions',
        method: 'GET',
        endpoint: '/system/status',
        implemented: true,
        category: 'System',
        documentationUrl: 'https://wiki.bazarr.media/',
      },
      {
        id: 'system-health',
        name: 'Get Health Issues',
        description: 'List health issues',
        method: 'GET',
        endpoint: '/system/health',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-restart-shutdown',
        name: 'Restart/Shutdown',
        description: 'Shutdown or restart Bazarr',
        method: 'POST',
        endpoint: '/system',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'action', type: 'string', required: true, description: 'Action: "shutdown" or "restart"' },
        ],
      },
      {
        id: 'system-settings-get',
        name: 'Get Settings',
        description: 'Get system settings including languages and notification providers',
        method: 'GET',
        endpoint: '/system/settings',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-settings-update',
        name: 'Update Settings',
        description: 'Update system settings including languages and profiles',
        method: 'POST',
        endpoint: '/system/settings',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-languages',
        name: 'List Languages',
        description: 'List languages for history filter or language filter menu',
        method: 'GET',
        endpoint: '/system/languages',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'history', type: 'string', required: false, description: 'Language name for history stats' },
        ],
      },
      {
        id: 'system-webhooks-test',
        name: 'Test Webhook',
        description: 'Test external webhook connection',
        method: 'POST',
        endpoint: '/system/webhooks/test',
        implemented: false,
        category: 'System',
      },

      // Series - Implemented
      {
        id: 'series-list',
        name: 'List Series',
        description: 'List series metadata for specific series',
        method: 'GET',
        endpoint: '/series',
        implemented: true,
        category: 'Series',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Paging start position' },
          { name: 'length', type: 'number', required: false, description: 'Paging length' },
          { name: 'seriesid[]', type: 'number[]', required: false, description: 'Series IDs to retrieve' },
        ],
      },
      {
        id: 'series-update-profile',
        name: 'Update Series Profile',
        description: 'Update specific series languages profile',
        method: 'POST',
        endpoint: '/series',
        implemented: false,
        category: 'Series',
        parameters: [
          { name: 'seriesid', type: 'number[]', required: false, description: 'Sonarr series IDs' },
          { name: 'profileid', type: 'string[]', required: false, description: 'Languages profile IDs or none' },
        ],
      },
      {
        id: 'series-action',
        name: 'Run Series Action',
        description: 'Run actions on specific series (scan-disk, search-missing, search-wanted, sync)',
        method: 'PATCH',
        endpoint: '/series',
        implemented: false,
        category: 'Series',
        parameters: [
          { name: 'seriesid', type: 'number', required: false, description: 'Sonarr series ID' },
          { name: 'action', type: 'string', required: false, description: 'Action: scan-disk, search-missing, search-wanted, sync' },
        ],
      },

      // Episodes - Implemented (via history)
      {
        id: 'episodes-list',
        name: 'List Episodes',
        description: 'List episodes metadata for specific series or episodes',
        method: 'GET',
        endpoint: '/episodes',
        implemented: false,
        category: 'Episodes',
        parameters: [
          { name: 'seriesid[]', type: 'number[]', required: false, description: 'Series IDs' },
          { name: 'episodeid[]', type: 'number[]', required: false, description: 'Episode IDs' },
        ],
      },
      {
        id: 'episodes-wanted',
        name: 'List Wanted Episodes',
        description: 'List episodes wanting subtitles',
        method: 'GET',
        endpoint: '/episodes/wanted',
        implemented: false,
        category: 'Episodes',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Paging start position' },
          { name: 'length', type: 'number', required: false, description: 'Paging length' },
          { name: 'episodeid[]', type: 'number[]', required: false, description: 'Episode IDs' },
        ],
      },
      {
        id: 'episodes-history',
        name: 'List Episodes History',
        description: 'List episodes history events',
        method: 'GET',
        endpoint: '/history/series',
        implemented: true,
        category: 'Episodes',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Paging start position' },
          { name: 'length', type: 'number', required: false, description: 'Paging length' },
          { name: 'episodeid', type: 'number', required: false, description: 'Episode ID filter' },
        ],
      },
      {
        id: 'episodes-blacklist-list',
        name: 'List Episodes Blacklist',
        description: 'List blacklisted episode subtitles',
        method: 'GET',
        endpoint: '/episodes/blacklist',
        implemented: false,
        category: 'Episodes',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Paging start position' },
          { name: 'length', type: 'number', required: false, description: 'Paging length' },
        ],
      },
      {
        id: 'episodes-blacklist-add',
        name: 'Add to Episodes Blacklist',
        description: 'Add an episode subtitle to blacklist',
        method: 'POST',
        endpoint: '/episodes/blacklist',
        implemented: false,
        category: 'Episodes',
        parameters: [
          { name: 'seriesid', type: 'number', required: true, description: 'Series ID' },
          { name: 'episodeid', type: 'number', required: true, description: 'Episode ID' },
          { name: 'provider', type: 'string', required: true, description: 'Provider name' },
          { name: 'subs_id', type: 'string', required: true, description: 'Subtitle ID' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
          { name: 'subtitles_path', type: 'string', required: true, description: 'Subtitle file path' },
        ],
      },
      {
        id: 'episodes-blacklist-delete',
        name: 'Remove from Episodes Blacklist',
        description: 'Delete an episode subtitle from blacklist',
        method: 'DELETE',
        endpoint: '/episodes/blacklist',
        implemented: false,
        category: 'Episodes',
        parameters: [
          { name: 'provider', type: 'string', required: false, description: 'Provider name' },
          { name: 'subs_id', type: 'string', required: false, description: 'Subtitle ID' },
          { name: 'all', type: 'boolean', required: false, description: 'Clear entire blacklist' },
        ],
      },

      // Movies - Implemented
      {
        id: 'movies-list',
        name: 'List Movies',
        description: 'List movies metadata for specific movies',
        method: 'GET',
        endpoint: '/movies',
        implemented: true,
        category: 'Movies',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Paging start position' },
          { name: 'length', type: 'number', required: false, description: 'Paging length' },
          { name: 'radarrid[]', type: 'number[]', required: false, description: 'Radarr movie IDs' },
        ],
      },
      {
        id: 'movies-update-profile',
        name: 'Update Movies Profile',
        description: 'Update specific movies languages profile',
        method: 'POST',
        endpoint: '/movies',
        implemented: false,
        category: 'Movies',
        parameters: [
          { name: 'radarrid', type: 'number[]', required: false, description: 'Radarr movie IDs' },
          { name: 'profileid', type: 'string[]', required: false, description: 'Languages profile IDs or none' },
        ],
      },
      {
        id: 'movies-action',
        name: 'Run Movies Action',
        description: 'Run actions on specific movies (scan-disk, search-missing, search-wanted, sync)',
        method: 'PATCH',
        endpoint: '/movies',
        implemented: false,
        category: 'Movies',
        parameters: [
          { name: 'radarrid', type: 'number', required: false, description: 'Radarr movie ID' },
          { name: 'action', type: 'string', required: false, description: 'Action: scan-disk, search-missing, search-wanted, sync' },
        ],
      },
      {
        id: 'movies-wanted',
        name: 'List Wanted Movies',
        description: 'List movies wanting subtitles',
        method: 'GET',
        endpoint: '/movies/wanted',
        implemented: true,
        category: 'Movies',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Paging start position' },
          { name: 'length', type: 'number', required: false, description: 'Paging length' },
          { name: 'radarrid[]', type: 'number[]', required: false, description: 'Radarr movie IDs' },
        ],
      },
      {
        id: 'movies-history',
        name: 'List Movies History',
        description: 'List movies history events',
        method: 'GET',
        endpoint: '/history/movies',
        implemented: true,
        category: 'Movies',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Paging start position' },
          { name: 'length', type: 'number', required: false, description: 'Paging length' },
          { name: 'radarrid', type: 'number', required: false, description: 'Radarr movie ID filter' },
        ],
      },
      {
        id: 'movies-blacklist-list',
        name: 'List Movies Blacklist',
        description: 'List blacklisted movie subtitles',
        method: 'GET',
        endpoint: '/movies/blacklist',
        implemented: false,
        category: 'Movies',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Paging start position' },
          { name: 'length', type: 'number', required: false, description: 'Paging length' },
        ],
      },
      {
        id: 'movies-blacklist-add',
        name: 'Add to Movies Blacklist',
        description: 'Add a movie subtitle to blacklist',
        method: 'POST',
        endpoint: '/movies/blacklist',
        implemented: false,
        category: 'Movies',
        parameters: [
          { name: 'radarrid', type: 'number', required: true, description: 'Radarr movie ID' },
          { name: 'provider', type: 'string', required: true, description: 'Provider name' },
          { name: 'subs_id', type: 'string', required: true, description: 'Subtitle ID' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
          { name: 'subtitles_path', type: 'string', required: true, description: 'Subtitle file path' },
        ],
      },
      {
        id: 'movies-blacklist-delete',
        name: 'Remove from Movies Blacklist',
        description: 'Delete a movie subtitle from blacklist',
        method: 'DELETE',
        endpoint: '/movies/blacklist',
        implemented: false,
        category: 'Movies',
        parameters: [
          { name: 'provider', type: 'string', required: false, description: 'Provider name' },
          { name: 'subs_id', type: 'string', required: false, description: 'Subtitle ID' },
          { name: 'all', type: 'boolean', required: false, description: 'Clear entire blacklist' },
        ],
      },

      // History & Statistics
      {
        id: 'history-stats',
        name: 'Get History Statistics',
        description: 'Get history statistics aggregated by date',
        method: 'GET',
        endpoint: '/history/stats',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'timeFrame', type: 'string', required: false, description: 'Time frame: week, month, trimester, year' },
          { name: 'action', type: 'string', required: false, description: 'Filter by action type' },
          { name: 'provider', type: 'string', required: false, description: 'Filter by provider name' },
          { name: 'language', type: 'string', required: false, description: 'Filter by language' },
        ],
      },

      // Providers
      {
        id: 'providers-list',
        name: 'Get Providers Status',
        description: 'Get subtitle providers status',
        method: 'GET',
        endpoint: '/providers',
        implemented: false,
        category: 'Providers',
        parameters: [
          { name: 'history', type: 'string', required: false, description: 'Provider name for history stats' },
        ],
      },
      {
        id: 'providers-reset',
        name: 'Reset Providers',
        description: 'Reset providers status',
        method: 'POST',
        endpoint: '/providers',
        implemented: false,
        category: 'Providers',
        parameters: [
          { name: 'action', type: 'string', required: true, description: 'Action: reset' },
        ],
      },

      // Subtitles
      {
        id: 'subtitles-info',
        name: 'Get Subtitle Info',
        description: 'Return available audio and embedded subtitles tracks with external subtitles',
        method: 'GET',
        endpoint: '/subtitles',
        implemented: false,
        category: 'Subtitles',
        parameters: [
          { name: 'subtitlesPath', type: 'string', required: true, description: 'External subtitles file path' },
          { name: 'sonarrEpisodeId', type: 'number', required: false, description: 'Sonarr Episode ID' },
          { name: 'radarrMovieId', type: 'number', required: false, description: 'Radarr Movie ID' },
        ],
      },
      {
        id: 'subtitles-modify',
        name: 'Modify Subtitles',
        description: 'Apply mods/tools on external subtitles (sync, translate, etc.)',
        method: 'PATCH',
        endpoint: '/subtitles',
        implemented: false,
        category: 'Subtitles',
        parameters: [
          { name: 'action', type: 'string', required: true, description: 'Action: sync, translate, or mod name' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
          { name: 'path', type: 'string', required: true, description: 'Subtitles file path' },
          { name: 'type', type: 'string', required: true, description: 'Media type: episode or movie' },
          { name: 'id', type: 'number', required: true, description: 'Media ID' },
        ],
      },

      // Episodes Subtitles
      {
        id: 'episodes-subtitles-download',
        name: 'Download Episode Subtitles',
        description: 'Download subtitles for an episode',
        method: 'PATCH',
        endpoint: '/episodes/subtitles',
        implemented: false,
        category: 'Subtitles',
        parameters: [
          { name: 'seriesid', type: 'number', required: true, description: 'Series ID' },
          { name: 'episodeid', type: 'number', required: true, description: 'Episode ID' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
        ],
      },
      {
        id: 'episodes-subtitles-upload',
        name: 'Upload Episode Subtitles',
        description: 'Upload subtitles for an episode',
        method: 'POST',
        endpoint: '/episodes/subtitles',
        implemented: false,
        category: 'Subtitles',
        parameters: [
          { name: 'seriesid', type: 'number', required: true, description: 'Series ID' },
          { name: 'episodeid', type: 'number', required: true, description: 'Episode ID' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
        ],
      },
      {
        id: 'episodes-subtitles-delete',
        name: 'Delete Episode Subtitles',
        description: 'Delete subtitles for an episode',
        method: 'DELETE',
        endpoint: '/episodes/subtitles',
        implemented: false,
        category: 'Subtitles',
        parameters: [
          { name: 'seriesid', type: 'number', required: true, description: 'Series ID' },
          { name: 'episodeid', type: 'number', required: true, description: 'Episode ID' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
          { name: 'path', type: 'string', required: true, description: 'Subtitle file path' },
        ],
      },

      // Movies Subtitles
      {
        id: 'movies-subtitles-download',
        name: 'Download Movie Subtitles',
        description: 'Download subtitles for a movie',
        method: 'PATCH',
        endpoint: '/movies/subtitles',
        implemented: false,
        category: 'Subtitles',
        parameters: [
          { name: 'radarrid', type: 'number', required: true, description: 'Radarr movie ID' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
        ],
      },
      {
        id: 'movies-subtitles-upload',
        name: 'Upload Movie Subtitles',
        description: 'Upload subtitles for a movie',
        method: 'POST',
        endpoint: '/movies/subtitles',
        implemented: false,
        category: 'Subtitles',
        parameters: [
          { name: 'radarrid', type: 'number', required: true, description: 'Radarr movie ID' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
        ],
      },
      {
        id: 'movies-subtitles-delete',
        name: 'Delete Movie Subtitles',
        description: 'Delete subtitles for a movie',
        method: 'DELETE',
        endpoint: '/movies/subtitles',
        implemented: false,
        category: 'Subtitles',
        parameters: [
          { name: 'radarrid', type: 'number', required: true, description: 'Radarr movie ID' },
          { name: 'language', type: 'string', required: true, description: 'Language code' },
          { name: 'path', type: 'string', required: true, description: 'Subtitle file path' },
        ],
      },

      // Badges (for UI)
      {
        id: 'badges',
        name: 'Get Badges',
        description: 'Get badge counts for UI',
        method: 'GET',
        endpoint: '/badges',
        implemented: false,
        category: 'UI',
      },
    ];
  }
}
