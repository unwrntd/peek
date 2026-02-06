import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  TautulliConfig,
  TautulliServerInfo,
  TautulliActivity,
  TautulliSession,
  TautulliHomeStat,
  TautulliRecentlyAddedItem,
  TautulliHistoryItem,
  TautulliLibrary,
  TautulliPlaysByDate,
} from '../types';
import { logger } from '../services/logger';

export class TautulliIntegration extends BaseIntegration {
  readonly type = 'tautulli';
  readonly name = 'Tautulli';

  private createClient(config: TautulliConfig): AxiosInstance {
    // Default to http for Tautulli (typical setup on port 8181)
    // Only use https if verifySSL is explicitly set to true
    const protocol = config.verifySSL === true ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 8181}`;

    return axios.create({
      baseURL,
      params: {
        apikey: config.apiKey,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const tautulliConfig = config as TautulliConfig;

    if (!tautulliConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!tautulliConfig.apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const client = this.createClient(tautulliConfig);
      const response = await client.get('/api/v2', {
        params: {
          apikey: tautulliConfig.apiKey,
          cmd: 'get_server_info',
        },
      });

      const data = response.data?.response?.data;

      if (!data) {
        return {
          success: false,
          message: 'Invalid response from Tautulli server',
        };
      }

      return {
        success: true,
        message: `Connected to Tautulli (monitoring ${data.pms_name || 'Plex Server'})`,
        details: {
          tautulliVersion: data.tautulli_version,
          plexServerName: data.pms_name,
          plexVersion: data.pms_version,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('tautulli', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        // Check for invalid API key error in response
        const responseMsg = error.response?.data?.response?.message;
        if (responseMsg === 'Invalid apikey' || error.response?.status === 401) {
          return {
            success: false,
            message: 'Authentication failed: Invalid API key',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused: Cannot reach ${tautulliConfig.host}:${tautulliConfig.port || 8181}`,
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
    const tautulliConfig = config as TautulliConfig;
    const client = this.createClient(tautulliConfig);

    switch (metric) {
      case 'server-info':
        return this.getServerInfo(client, tautulliConfig.apiKey);
      case 'activity':
        return this.getActivity(client, tautulliConfig.apiKey);
      case 'home-stats':
        return this.getHomeStats(client, tautulliConfig.apiKey);
      case 'recently-added':
        return this.getRecentlyAdded(client, tautulliConfig.apiKey);
      case 'history':
        return this.getHistory(client, tautulliConfig.apiKey);
      case 'libraries':
        return this.getLibraries(client, tautulliConfig.apiKey);
      case 'plays-by-date':
        return this.getPlaysByDate(client, tautulliConfig.apiKey);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getServerInfo(client: AxiosInstance, apiKey: string): Promise<{ serverInfo: TautulliServerInfo }> {
    try {
      const response = await client.get('/api/v2', {
        params: { apikey: apiKey, cmd: 'get_server_info' },
      });

      const data = response.data?.response?.data;
      if (!data) {
        throw new Error('Invalid response from Tautulli');
      }

      const serverInfo: TautulliServerInfo = {
        tautulliVersion: data.tautulli_version || '',
        tautulliInstallType: data.tautulli_install_type || '',
        tautulliUpdateAvailable: data.tautulli_update_available === 1,
        pmsName: data.pms_name || '',
        pmsVersion: data.pms_version || '',
        pmsPlatform: data.pms_platform || '',
        pmsIp: data.pms_ip || '',
        pmsPort: data.pms_port || 32400,
        pmsIsRemote: data.pms_is_remote === 1,
        pmsUrl: data.pms_url || '',
        pmsIdentifier: data.pms_identifier || '',
      };

      return { serverInfo };
    } catch (error) {
      logger.error('tautulli', 'Failed to get server info', { error });
      throw error;
    }
  }

  private async getActivity(client: AxiosInstance, apiKey: string): Promise<{ activity: TautulliActivity }> {
    try {
      const response = await client.get('/api/v2', {
        params: { apikey: apiKey, cmd: 'get_activity' },
      });

      const data = response.data?.response?.data;
      if (!data) {
        throw new Error('Invalid response from Tautulli');
      }

      const sessions: TautulliSession[] = (data.sessions || []).map((s: Record<string, unknown>) => ({
        sessionKey: String(s.session_key || ''),
        sessionId: String(s.session_id || ''),
        mediaType: s.media_type as TautulliSession['mediaType'],
        title: String(s.title || ''),
        parentTitle: s.parent_title ? String(s.parent_title) : undefined,
        grandparentTitle: s.grandparent_title ? String(s.grandparent_title) : undefined,
        thumb: s.thumb ? String(s.thumb) : undefined,
        parentThumb: s.parent_thumb ? String(s.parent_thumb) : undefined,
        grandparentThumb: s.grandparent_thumb ? String(s.grandparent_thumb) : undefined,
        year: s.year ? Number(s.year) : undefined,
        ratingKey: String(s.rating_key || ''),
        parentRatingKey: s.parent_rating_key ? String(s.parent_rating_key) : undefined,
        grandparentRatingKey: s.grandparent_rating_key ? String(s.grandparent_rating_key) : undefined,
        viewOffset: Number(s.view_offset) || 0,
        duration: Number(s.duration) || 0,
        progressPercent: Number(s.progress_percent) || 0,
        state: (s.state as TautulliSession['state']) || 'playing',
        transcodeDecision: (s.transcode_decision as TautulliSession['transcodeDecision']) || 'direct play',
        videoDecision: s.video_decision ? (s.video_decision as TautulliSession['videoDecision']) : undefined,
        audioDecision: s.audio_decision ? (s.audio_decision as TautulliSession['audioDecision']) : undefined,
        subtitleDecision: s.subtitle_decision ? (s.subtitle_decision as TautulliSession['subtitleDecision']) : undefined,
        transcodeHwRequested: s.transcode_hw_requested === 1 || s.transcode_hw_requested === '1',
        transcodeHwFullPipeline: s.transcode_hw_full_pipeline === 1 || s.transcode_hw_full_pipeline === '1',
        streamBitrate: Number(s.stream_bitrate) || 0,
        bandwidth: Number(s.bandwidth) || 0,
        quality: String(s.quality_profile || s.stream_video_full_resolution || ''),
        qualityProfile: String(s.quality_profile || ''),
        optimizedVersion: s.optimized_version === 1 || s.optimized_version === '1',
        optimizedVersionProfile: String(s.optimized_version_profile || ''),
        optimizedVersionTitle: String(s.optimized_version_title || ''),
        streamContainerDecision: String(s.stream_container_decision || ''),
        streamContainer: String(s.stream_container || ''),
        streamVideoDecision: s.stream_video_decision ? String(s.stream_video_decision) : undefined,
        streamVideoCodec: s.stream_video_codec ? String(s.stream_video_codec) : undefined,
        streamVideoBitrate: s.stream_video_bitrate ? Number(s.stream_video_bitrate) : undefined,
        streamVideoWidth: s.stream_video_width ? Number(s.stream_video_width) : undefined,
        streamVideoHeight: s.stream_video_height ? Number(s.stream_video_height) : undefined,
        streamAudioDecision: s.stream_audio_decision ? String(s.stream_audio_decision) : undefined,
        streamAudioCodec: s.stream_audio_codec ? String(s.stream_audio_codec) : undefined,
        streamAudioBitrate: s.stream_audio_bitrate ? Number(s.stream_audio_bitrate) : undefined,
        streamAudioChannels: s.stream_audio_channels ? Number(s.stream_audio_channels) : undefined,
        user: String(s.user || ''),
        userId: String(s.user_id || ''),
        userThumb: s.user_thumb ? String(s.user_thumb) : undefined,
        friendlyName: String(s.friendly_name || s.user || ''),
        platform: String(s.platform || ''),
        product: String(s.product || ''),
        player: String(s.player || ''),
        device: String(s.device || ''),
        ipAddress: String(s.ip_address || ''),
        ipAddressPublic: s.ip_address_public ? String(s.ip_address_public) : undefined,
        location: s.location ? String(s.location) : undefined,
        relayed: s.relayed === 1 || s.relayed === '1',
        secure: s.secure === 1 || s.secure === '1',
        local: s.local === 1 || s.local === '1',
      }));

      const activity: TautulliActivity = {
        streamCount: Number(data.stream_count) || 0,
        streamCountDirectPlay: Number(data.stream_count_direct_play) || 0,
        streamCountDirectStream: Number(data.stream_count_direct_stream) || 0,
        streamCountTranscode: Number(data.stream_count_transcode) || 0,
        totalBandwidth: Number(data.total_bandwidth) || 0,
        lanBandwidth: Number(data.lan_bandwidth) || 0,
        wanBandwidth: Number(data.wan_bandwidth) || 0,
        sessions,
      };

      return { activity };
    } catch (error) {
      logger.error('tautulli', 'Failed to get activity', { error });
      throw error;
    }
  }

  private async getHomeStats(client: AxiosInstance, apiKey: string): Promise<{ homeStats: TautulliHomeStat[] }> {
    try {
      const response = await client.get('/api/v2', {
        params: {
          apikey: apiKey,
          cmd: 'get_home_stats',
          time_range: 30,
          stats_count: 10,
        },
      });

      const data = response.data?.response?.data;
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid response from Tautulli');
      }

      const homeStats: TautulliHomeStat[] = data.map((stat: Record<string, unknown>) => ({
        stat_id: String(stat.stat_id || ''),
        stat_title: String(stat.stat_title || ''),
        stat_type: (stat.stat_type as TautulliHomeStat['stat_type']) || 'plays',
        rows: Array.isArray(stat.rows) ? stat.rows.map((row: Record<string, unknown>) => ({
          rowId: Number(row.row_id) || 0,
          title: String(row.title || ''),
          thumb: row.thumb ? String(row.thumb) : undefined,
          year: row.year ? Number(row.year) : undefined,
          users: row.users_watched ? Number(row.users_watched) : undefined,
          rating_key: row.rating_key ? Number(row.rating_key) : undefined,
          grandparent_rating_key: row.grandparent_rating_key ? Number(row.grandparent_rating_key) : undefined,
          total_plays: Number(row.total_plays) || 0,
          total_duration: Number(row.total_duration) || 0,
          user: row.user ? String(row.user) : undefined,
          user_id: row.user_id ? Number(row.user_id) : undefined,
          user_thumb: row.user_thumb ? String(row.user_thumb) : undefined,
          friendly_name: row.friendly_name ? String(row.friendly_name) : undefined,
          platform: row.platform ? String(row.platform) : undefined,
          last_play: row.last_play ? Number(row.last_play) : undefined,
        })) : [],
      }));

      return { homeStats };
    } catch (error) {
      logger.error('tautulli', 'Failed to get home stats', { error });
      throw error;
    }
  }

  private async getRecentlyAdded(client: AxiosInstance, apiKey: string): Promise<{ recentlyAdded: TautulliRecentlyAddedItem[] }> {
    try {
      const response = await client.get('/api/v2', {
        params: {
          apikey: apiKey,
          cmd: 'get_recently_added',
          count: 50,
        },
      });

      const data = response.data?.response?.data?.recently_added;
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid response from Tautulli');
      }

      const recentlyAdded: TautulliRecentlyAddedItem[] = data.map((item: Record<string, unknown>) => ({
        addedAt: Number(item.added_at) || 0,
        mediaType: item.media_type as TautulliRecentlyAddedItem['mediaType'],
        ratingKey: String(item.rating_key || ''),
        parentRatingKey: item.parent_rating_key ? String(item.parent_rating_key) : undefined,
        grandparentRatingKey: item.grandparent_rating_key ? String(item.grandparent_rating_key) : undefined,
        title: String(item.title || ''),
        parentTitle: item.parent_title ? String(item.parent_title) : undefined,
        grandparentTitle: item.grandparent_title ? String(item.grandparent_title) : undefined,
        thumb: item.thumb ? String(item.thumb) : undefined,
        parentThumb: item.parent_thumb ? String(item.parent_thumb) : undefined,
        grandparentThumb: item.grandparent_thumb ? String(item.grandparent_thumb) : undefined,
        year: item.year ? Number(item.year) : undefined,
        duration: item.duration ? Number(item.duration) : undefined,
        contentRating: item.content_rating ? String(item.content_rating) : undefined,
        libraryName: String(item.library_name || ''),
        sectionId: Number(item.section_id) || 0,
      }));

      return { recentlyAdded };
    } catch (error) {
      logger.error('tautulli', 'Failed to get recently added', { error });
      throw error;
    }
  }

  private async getHistory(client: AxiosInstance, apiKey: string): Promise<{ history: TautulliHistoryItem[], totalCount: number }> {
    try {
      const response = await client.get('/api/v2', {
        params: {
          apikey: apiKey,
          cmd: 'get_history',
          length: 50,
        },
      });

      const data = response.data?.response?.data;
      if (!data) {
        throw new Error('Invalid response from Tautulli');
      }

      const historyData = data.data || [];
      const history: TautulliHistoryItem[] = historyData.map((item: Record<string, unknown>) => ({
        referenceId: Number(item.reference_id) || 0,
        rowId: Number(item.row_id) || 0,
        id: Number(item.id) || 0,
        date: Number(item.date) || 0,
        started: Number(item.started) || 0,
        stopped: Number(item.stopped) || 0,
        duration: Number(item.duration) || 0,
        pausedCounter: Number(item.paused_counter) || 0,
        user: String(item.user || ''),
        userId: Number(item.user_id) || 0,
        userThumb: item.user_thumb ? String(item.user_thumb) : undefined,
        friendlyName: String(item.friendly_name || item.user || ''),
        platform: String(item.platform || ''),
        product: String(item.product || ''),
        player: String(item.player || ''),
        ipAddress: String(item.ip_address || ''),
        live: item.live === 1 || item.live === '1',
        machineId: String(item.machine_id || ''),
        mediaType: item.media_type as TautulliHistoryItem['mediaType'],
        ratingKey: String(item.rating_key || ''),
        parentRatingKey: item.parent_rating_key ? String(item.parent_rating_key) : undefined,
        grandparentRatingKey: item.grandparent_rating_key ? String(item.grandparent_rating_key) : undefined,
        title: String(item.title || ''),
        parentTitle: item.parent_title ? String(item.parent_title) : undefined,
        grandparentTitle: item.grandparent_title ? String(item.grandparent_title) : undefined,
        originalTitle: item.original_title ? String(item.original_title) : undefined,
        year: item.year ? Number(item.year) : undefined,
        thumb: item.thumb ? String(item.thumb) : undefined,
        parentThumb: item.parent_thumb ? String(item.parent_thumb) : undefined,
        grandparentThumb: item.grandparent_thumb ? String(item.grandparent_thumb) : undefined,
        watchedStatus: Number(item.watched_status) || 0,
        percentComplete: Number(item.percent_complete) || 0,
        transcodeDecision: String(item.transcode_decision || 'direct play'),
      }));

      return {
        history,
        totalCount: Number(data.recordsFiltered) || history.length,
      };
    } catch (error) {
      logger.error('tautulli', 'Failed to get history', { error });
      throw error;
    }
  }

  private async getLibraries(client: AxiosInstance, apiKey: string): Promise<{ libraries: TautulliLibrary[] }> {
    try {
      const response = await client.get('/api/v2', {
        params: { apikey: apiKey, cmd: 'get_libraries' },
      });

      const data = response.data?.response?.data;
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid response from Tautulli');
      }

      const libraries: TautulliLibrary[] = data.map((lib: Record<string, unknown>) => ({
        sectionId: Number(lib.section_id) || 0,
        sectionName: String(lib.section_name || ''),
        sectionType: lib.section_type as TautulliLibrary['sectionType'],
        count: Number(lib.count) || 0,
        parentCount: lib.parent_count ? Number(lib.parent_count) : undefined,
        childCount: lib.child_count ? Number(lib.child_count) : undefined,
        lastAccessed: lib.last_accessed ? Number(lib.last_accessed) : undefined,
        historyRowId: lib.history_row_id ? Number(lib.history_row_id) : undefined,
        isActive: lib.is_active === 1 || lib.is_active === '1',
      }));

      return { libraries };
    } catch (error) {
      logger.error('tautulli', 'Failed to get libraries', { error });
      throw error;
    }
  }

  private async getPlaysByDate(client: AxiosInstance, apiKey: string): Promise<{ playsByDate: TautulliPlaysByDate }> {
    try {
      const response = await client.get('/api/v2', {
        params: {
          apikey: apiKey,
          cmd: 'get_plays_by_date',
          time_range: 30,
        },
      });

      const data = response.data?.response?.data;
      if (!data) {
        throw new Error('Invalid response from Tautulli');
      }

      const playsByDate: TautulliPlaysByDate = {
        categories: data.categories || [],
        series: (data.series || []).map((s: Record<string, unknown>) => ({
          name: String(s.name || ''),
          data: Array.isArray(s.data) ? s.data.map(Number) : [],
        })),
      };

      return { playsByDate };
    } catch (error) {
      logger.error('tautulli', 'Failed to get plays by date', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'server-info',
        name: 'Server Information',
        description: 'Tautulli and Plex server status',
        widgetTypes: ['tautulli-server-status'],
      },
      {
        id: 'activity',
        name: 'Current Activity',
        description: 'Active streaming sessions',
        widgetTypes: ['tautulli-activity', 'tautulli-stream-count'],
      },
      {
        id: 'home-stats',
        name: 'Watch Statistics',
        description: 'Top movies, shows, and users',
        widgetTypes: ['tautulli-watch-stats'],
      },
      {
        id: 'recently-added',
        name: 'Recently Added',
        description: 'Recently added media',
        widgetTypes: ['tautulli-recently-added'],
      },
      {
        id: 'history',
        name: 'Watch History',
        description: 'Recent viewing history',
        widgetTypes: ['tautulli-history'],
      },
      {
        id: 'libraries',
        name: 'Libraries',
        description: 'Plex library information',
        widgetTypes: ['tautulli-libraries'],
      },
      {
        id: 'plays-by-date',
        name: 'Plays Over Time',
        description: 'Plays chart by date',
        widgetTypes: ['tautulli-plays-chart'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Server Info - Implemented
      {
        id: 'get_server_info',
        name: 'Get Server Info',
        description: 'Get PMS server information including Tautulli version',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_server_info',
        implemented: true,
        category: 'Server',
        documentationUrl: 'https://github.com/Tautulli/Tautulli/wiki/Tautulli-API-Reference',
      },
      {
        id: 'get_servers_info',
        name: 'Get Servers Info',
        description: 'Get PMS details for all servers',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_servers_info',
        implemented: false,
        category: 'Server',
      },
      {
        id: 'get_server_friendly_name',
        name: 'Get Server Friendly Name',
        description: 'Get the PMS server friendly name',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_server_friendly_name',
        implemented: false,
        category: 'Server',
      },
      {
        id: 'get_server_id',
        name: 'Get Server ID',
        description: 'Get the PMS server identifier',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_server_id',
        implemented: false,
        category: 'Server',
        parameters: [
          { name: 'hostname', type: 'string', required: true, description: 'Hostname of the PMS' },
          { name: 'port', type: 'number', required: true, description: 'Port of the PMS' },
          { name: 'ssl', type: 'number', required: false, description: '0 or 1 for SSL' },
          { name: 'remote', type: 'number', required: false, description: '0 or 1 for remote' },
        ],
      },
      {
        id: 'get_server_identity',
        name: 'Get Server Identity',
        description: 'Get local server info',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_server_identity',
        implemented: false,
        category: 'Server',
      },
      {
        id: 'get_server_list',
        name: 'Get Server List',
        description: 'Get all published servers',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_server_list',
        implemented: false,
        category: 'Server',
      },
      {
        id: 'get_server_pref',
        name: 'Get Server Preference',
        description: 'Get a PMS preference setting',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_server_pref',
        implemented: false,
        category: 'Server',
        parameters: [
          { name: 'pref', type: 'string', required: true, description: 'Preference name' },
        ],
      },
      {
        id: 'get_pms_update',
        name: 'Check PMS Update',
        description: 'Check for PMS updates',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_pms_update',
        implemented: false,
        category: 'Server',
      },

      // Activity - Implemented
      {
        id: 'get_activity',
        name: 'Get Activity',
        description: 'Get current activity on the PMS',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_activity',
        implemented: true,
        category: 'Activity',
        parameters: [
          { name: 'session_key', type: 'string', required: false, description: 'Session key for specific session' },
          { name: 'session_id', type: 'string', required: false, description: 'Session ID for specific session' },
        ],
      },
      {
        id: 'terminate_session',
        name: 'Terminate Session',
        description: 'Stop a streaming session',
        method: 'GET',
        endpoint: '/api/v2?cmd=terminate_session',
        implemented: false,
        category: 'Activity',
        parameters: [
          { name: 'session_key', type: 'string', required: false, description: 'Session key' },
          { name: 'session_id', type: 'string', required: false, description: 'Session ID' },
          { name: 'message', type: 'string', required: false, description: 'Message to display' },
        ],
      },
      {
        id: 'get_stream_data',
        name: 'Get Stream Data',
        description: 'Get stream details',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_stream_data',
        implemented: false,
        category: 'Activity',
        parameters: [
          { name: 'row_id', type: 'number', required: false, description: 'History row ID' },
          { name: 'session_key', type: 'string', required: false, description: 'Session key' },
        ],
      },

      // History - Implemented
      {
        id: 'get_history',
        name: 'Get History',
        description: 'Retrieve Tautulli history',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_history',
        implemented: true,
        category: 'History',
        parameters: [
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
          { name: 'include_activity', type: 'number', required: false, description: '0 or 1' },
          { name: 'user', type: 'string', required: false, description: 'Username' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'rating_key', type: 'number', required: false, description: 'Media rating key' },
          { name: 'parent_rating_key', type: 'number', required: false, description: 'Parent rating key' },
          { name: 'grandparent_rating_key', type: 'number', required: false, description: 'Grandparent rating key' },
          { name: 'start_date', type: 'string', required: false, description: 'Start date (YYYY-MM-DD)' },
          { name: 'section_id', type: 'number', required: false, description: 'Library section ID' },
          { name: 'media_type', type: 'string', required: false, description: 'movie, episode, track, live' },
          { name: 'transcode_decision', type: 'string', required: false, description: 'direct play, copy, transcode' },
          { name: 'order_column', type: 'string', required: false, description: 'Column to sort by' },
          { name: 'order_dir', type: 'string', required: false, description: 'asc or desc' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'length', type: 'number', required: false, description: 'Number of records' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
        ],
      },
      {
        id: 'delete_history',
        name: 'Delete History',
        description: 'Remove history rows',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_history',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'row_ids', type: 'string', required: true, description: 'Comma-separated row IDs' },
        ],
      },
      {
        id: 'delete_all_user_history',
        name: 'Delete All User History',
        description: 'Delete all history for specific user',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_all_user_history',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'user_id', type: 'number', required: true, description: 'User ID' },
          { name: 'row_ids', type: 'string', required: false, description: 'Comma-separated row IDs' },
        ],
      },
      {
        id: 'delete_all_library_history',
        name: 'Delete All Library History',
        description: 'Delete library history',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_all_library_history',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'server_id', type: 'string', required: true, description: 'Server ID' },
          { name: 'section_id', type: 'number', required: true, description: 'Section ID' },
          { name: 'row_ids', type: 'string', required: false, description: 'Comma-separated row IDs' },
        ],
      },

      // Statistics - Implemented
      {
        id: 'get_home_stats',
        name: 'Get Home Stats',
        description: 'Get homepage statistics (top movies, shows, users)',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_home_stats',
        implemented: true,
        category: 'Statistics',
        parameters: [
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'stats_type', type: 'string', required: false, description: 'plays or duration' },
          { name: 'stats_start', type: 'number', required: false, description: 'Start position' },
          { name: 'stats_count', type: 'number', required: false, description: 'Number of items' },
          { name: 'stat_id', type: 'string', required: false, description: 'Specific stat ID' },
          { name: 'section_id', type: 'number', required: false, description: 'Library section ID' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
        ],
      },
      {
        id: 'get_plays_by_date',
        name: 'Get Plays by Date',
        description: 'Get plays by date graph data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_by_date',
        implemented: true,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_plays_by_dayofweek',
        name: 'Get Plays by Day of Week',
        description: 'Get plays by day-of-week data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_by_dayofweek',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_plays_by_hourofday',
        name: 'Get Plays by Hour of Day',
        description: 'Get plays by hour-of-day data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_by_hourofday',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_plays_by_source_resolution',
        name: 'Get Plays by Source Resolution',
        description: 'Get source resolution data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_by_source_resolution',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_plays_by_stream_resolution',
        name: 'Get Plays by Stream Resolution',
        description: 'Get stream resolution data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_by_stream_resolution',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_plays_by_stream_type',
        name: 'Get Plays by Stream Type',
        description: 'Get stream type data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_by_stream_type',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_plays_by_top_10_platforms',
        name: 'Get Plays by Top 10 Platforms',
        description: 'Get top platforms data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_by_top_10_platforms',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_plays_by_top_10_users',
        name: 'Get Plays by Top 10 Users',
        description: 'Get top users data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_by_top_10_users',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_plays_per_month',
        name: 'Get Plays per Month',
        description: 'Get monthly play data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plays_per_month',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of months' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_concurrent_streams_by_stream_type',
        name: 'Get Concurrent Streams by Type',
        description: 'Get concurrent streams by type',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_concurrent_streams_by_stream_type',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
        ],
      },
      {
        id: 'get_stream_type_by_top_10_platforms',
        name: 'Get Stream Type by Top 10 Platforms',
        description: 'Get stream type by platforms',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_stream_type_by_top_10_platforms',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_stream_type_by_top_10_users',
        name: 'Get Stream Type by Top 10 Users',
        description: 'Get stream type by users',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_stream_type_by_top_10_users',
        implemented: false,
        category: 'Statistics',
        parameters: [
          { name: 'time_range', type: 'number', required: false, description: 'Number of days' },
          { name: 'y_axis', type: 'string', required: false, description: 'plays or duration' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },

      // Libraries - Implemented
      {
        id: 'get_libraries',
        name: 'Get Libraries',
        description: 'List all server libraries',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_libraries',
        implemented: true,
        category: 'Libraries',
      },
      {
        id: 'get_library_names',
        name: 'Get Library Names',
        description: 'Get library sections and identifiers',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_library_names',
        implemented: false,
        category: 'Libraries',
      },
      {
        id: 'get_library',
        name: 'Get Library',
        description: 'Retrieve library details',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_library',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'section_id', type: 'number', required: true, description: 'Library section ID' },
          { name: 'include_last_accessed', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_libraries_table',
        name: 'Get Libraries Table',
        description: 'Get library table data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_libraries_table',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
          { name: 'order_column', type: 'string', required: false, description: 'Column to sort by' },
          { name: 'order_dir', type: 'string', required: false, description: 'asc or desc' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'length', type: 'number', required: false, description: 'Number of records' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
        ],
      },
      {
        id: 'get_library_user_stats',
        name: 'Get Library User Stats',
        description: 'Get user statistics for library',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_library_user_stats',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'section_id', type: 'number', required: true, description: 'Library section ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_library_watch_time_stats',
        name: 'Get Library Watch Time Stats',
        description: 'Get watch time statistics',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_library_watch_time_stats',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'section_id', type: 'number', required: true, description: 'Library section ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
          { name: 'query_days', type: 'number', required: false, description: 'Number of days' },
        ],
      },
      {
        id: 'get_library_media_info',
        name: 'Get Library Media Info',
        description: 'Get media info table data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_library_media_info',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'section_id', type: 'number', required: false, description: 'Library section ID' },
          { name: 'rating_key', type: 'number', required: false, description: 'Media rating key' },
          { name: 'section_type', type: 'string', required: false, description: 'movie, show, artist, photo' },
          { name: 'order_column', type: 'string', required: false, description: 'Column to sort by' },
          { name: 'order_dir', type: 'string', required: false, description: 'asc or desc' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'length', type: 'number', required: false, description: 'Number of records' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
          { name: 'refresh', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'delete_library',
        name: 'Delete Library',
        description: 'Remove library and erase history',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_library',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'server_id', type: 'string', required: true, description: 'Server ID' },
          { name: 'section_id', type: 'number', required: true, description: 'Section ID' },
          { name: 'row_ids', type: 'string', required: false, description: 'Comma-separated row IDs' },
        ],
      },
      {
        id: 'edit_library',
        name: 'Edit Library',
        description: 'Update library settings',
        method: 'GET',
        endpoint: '/api/v2?cmd=edit_library',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'section_id', type: 'number', required: true, description: 'Library section ID' },
          { name: 'custom_thumb', type: 'string', required: false, description: 'Custom thumbnail URL' },
          { name: 'custom_art', type: 'string', required: false, description: 'Custom art URL' },
          { name: 'keep_history', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'refresh_libraries_list',
        name: 'Refresh Libraries List',
        description: 'Refresh the libraries list',
        method: 'GET',
        endpoint: '/api/v2?cmd=refresh_libraries_list',
        implemented: false,
        category: 'Libraries',
      },

      // Recently Added - Implemented
      {
        id: 'get_recently_added',
        name: 'Get Recently Added',
        description: 'Get recent additions',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_recently_added',
        implemented: true,
        category: 'Recently Added',
        parameters: [
          { name: 'count', type: 'number', required: true, description: 'Number of items' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'media_type', type: 'string', required: false, description: 'movie, show, artist' },
          { name: 'section_id', type: 'number', required: false, description: 'Library section ID' },
        ],
      },
      {
        id: 'delete_recently_added',
        name: 'Delete Recently Added',
        description: 'Flush recently added items',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_recently_added',
        implemented: false,
        category: 'Recently Added',
      },

      // Metadata
      {
        id: 'get_metadata',
        name: 'Get Metadata',
        description: 'Retrieve item metadata',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_metadata',
        implemented: false,
        category: 'Metadata',
        parameters: [
          { name: 'rating_key', type: 'number', required: false, description: 'Media rating key' },
          { name: 'sync_id', type: 'string', required: false, description: 'Sync ID' },
        ],
      },
      {
        id: 'get_children_metadata',
        name: 'Get Children Metadata',
        description: 'Get metadata for item children',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_children_metadata',
        implemented: false,
        category: 'Metadata',
        parameters: [
          { name: 'rating_key', type: 'number', required: true, description: 'Media rating key' },
          { name: 'media_type', type: 'string', required: true, description: 'movie, show, season, etc.' },
        ],
      },
      {
        id: 'get_item_user_stats',
        name: 'Get Item User Stats',
        description: 'Get user statistics for media item',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_item_user_stats',
        implemented: false,
        category: 'Metadata',
        parameters: [
          { name: 'rating_key', type: 'number', required: true, description: 'Media rating key' },
          { name: 'media_type', type: 'string', required: false, description: 'movie, show, etc.' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_item_watch_time_stats',
        name: 'Get Item Watch Time Stats',
        description: 'Get watch time stats',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_item_watch_time_stats',
        implemented: false,
        category: 'Metadata',
        parameters: [
          { name: 'rating_key', type: 'number', required: true, description: 'Media rating key' },
          { name: 'media_type', type: 'string', required: false, description: 'movie, show, etc.' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
          { name: 'query_days', type: 'number', required: false, description: 'Number of days' },
        ],
      },
      {
        id: 'get_new_rating_keys',
        name: 'Get New Rating Keys',
        description: 'Get updated rating keys',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_new_rating_keys',
        implemented: false,
        category: 'Metadata',
        parameters: [
          { name: 'rating_key', type: 'number', required: true, description: 'Media rating key' },
          { name: 'media_type', type: 'string', required: true, description: 'movie, show, etc.' },
        ],
      },
      {
        id: 'get_old_rating_keys',
        name: 'Get Old Rating Keys',
        description: 'Get previous rating keys',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_old_rating_keys',
        implemented: false,
        category: 'Metadata',
        parameters: [
          { name: 'rating_key', type: 'number', required: true, description: 'Media rating key' },
          { name: 'media_type', type: 'string', required: true, description: 'movie, show, etc.' },
        ],
      },

      // Users
      {
        id: 'get_user',
        name: 'Get User',
        description: 'Get user details',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'number', required: true, description: 'User ID' },
          { name: 'include_last_seen', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_user_names',
        name: 'Get User Names',
        description: 'Get list of user names',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_user_names',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'get_users',
        name: 'Get Users',
        description: 'Get list of all users',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_users',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'get_users_table',
        name: 'Get Users Table',
        description: 'Get users table data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_users_table',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
          { name: 'order_column', type: 'string', required: false, description: 'Column to sort by' },
          { name: 'order_dir', type: 'string', required: false, description: 'asc or desc' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'length', type: 'number', required: false, description: 'Number of records' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
        ],
      },
      {
        id: 'get_user_player_stats',
        name: 'Get User Player Stats',
        description: 'Get player statistics for user',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_user_player_stats',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'number', required: true, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'get_user_watch_time_stats',
        name: 'Get User Watch Time Stats',
        description: 'Get watch time stats for user',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_user_watch_time_stats',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'number', required: true, description: 'User ID' },
          { name: 'grouping', type: 'number', required: false, description: '0 or 1' },
          { name: 'query_days', type: 'number', required: false, description: 'Number of days' },
        ],
      },
      {
        id: 'get_user_ips',
        name: 'Get User IPs',
        description: 'Get unique IP addresses for user',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_user_ips',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'number', required: true, description: 'User ID' },
          { name: 'order_column', type: 'string', required: false, description: 'Column to sort by' },
          { name: 'order_dir', type: 'string', required: false, description: 'asc or desc' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'length', type: 'number', required: false, description: 'Number of records' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
        ],
      },
      {
        id: 'get_user_logins',
        name: 'Get User Logins',
        description: 'Get user login history',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_user_logins',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'number', required: true, description: 'User ID' },
          { name: 'order_column', type: 'string', required: false, description: 'Column to sort by' },
          { name: 'order_dir', type: 'string', required: false, description: 'asc or desc' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'length', type: 'number', required: false, description: 'Number of records' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
        ],
      },
      {
        id: 'edit_user',
        name: 'Edit User',
        description: 'Update user settings',
        method: 'GET',
        endpoint: '/api/v2?cmd=edit_user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'number', required: true, description: 'User ID' },
          { name: 'friendly_name', type: 'string', required: false, description: 'Friendly name' },
          { name: 'custom_thumb', type: 'string', required: false, description: 'Custom thumb URL' },
          { name: 'keep_history', type: 'number', required: false, description: '0 or 1' },
          { name: 'allow_guest', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'delete_user',
        name: 'Delete User',
        description: 'Remove user and erase history',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'user_id', type: 'number', required: true, description: 'User ID' },
          { name: 'row_ids', type: 'string', required: false, description: 'Comma-separated row IDs' },
        ],
      },
      {
        id: 'refresh_users_list',
        name: 'Refresh Users List',
        description: 'Refresh the users list',
        method: 'GET',
        endpoint: '/api/v2?cmd=refresh_users_list',
        implemented: false,
        category: 'Users',
      },

      // Notifications
      {
        id: 'get_notifiers',
        name: 'Get Notifiers',
        description: 'List configured notifiers',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_notifiers',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'notify_action', type: 'string', required: false, description: 'Notification action' },
        ],
      },
      {
        id: 'get_notifier_config',
        name: 'Get Notifier Config',
        description: 'Get notifier settings',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_notifier_config',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'notifier_id', type: 'number', required: true, description: 'Notifier ID' },
        ],
      },
      {
        id: 'add_notifier_config',
        name: 'Add Notifier Config',
        description: 'Add notification agent',
        method: 'GET',
        endpoint: '/api/v2?cmd=add_notifier_config',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'agent_id', type: 'number', required: true, description: 'Agent ID' },
        ],
      },
      {
        id: 'set_notifier_config',
        name: 'Set Notifier Config',
        description: 'Update notifier settings',
        method: 'GET',
        endpoint: '/api/v2?cmd=set_notifier_config',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'notifier_id', type: 'number', required: true, description: 'Notifier ID' },
        ],
      },
      {
        id: 'delete_notifier',
        name: 'Delete Notifier',
        description: 'Remove notifier',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_notifier',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'notifier_id', type: 'number', required: true, description: 'Notifier ID' },
        ],
      },
      {
        id: 'notify',
        name: 'Send Notification',
        description: 'Send a notification',
        method: 'GET',
        endpoint: '/api/v2?cmd=notify',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'notifier_id', type: 'number', required: true, description: 'Notifier ID' },
          { name: 'subject', type: 'string', required: true, description: 'Notification subject' },
          { name: 'body', type: 'string', required: true, description: 'Notification body' },
        ],
      },
      {
        id: 'notify_recently_added',
        name: 'Notify Recently Added',
        description: 'Send recently added notification',
        method: 'GET',
        endpoint: '/api/v2?cmd=notify_recently_added',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'rating_key', type: 'number', required: true, description: 'Media rating key' },
          { name: 'notifier_id', type: 'number', required: false, description: 'Notifier ID' },
        ],
      },
      {
        id: 'get_notification_log',
        name: 'Get Notification Log',
        description: 'Get notification logs',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_notification_log',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'order_column', type: 'string', required: false, description: 'Column to sort by' },
          { name: 'order_dir', type: 'string', required: false, description: 'asc or desc' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'length', type: 'number', required: false, description: 'Number of records' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
        ],
      },
      {
        id: 'delete_notification_log',
        name: 'Delete Notification Log',
        description: 'Clear notification logs',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_notification_log',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'get_notifier_parameters',
        name: 'Get Notifier Parameters',
        description: 'Get available notification parameters',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_notifier_parameters',
        implemented: false,
        category: 'Notifications',
      },

      // Collections
      {
        id: 'get_collections_table',
        name: 'Get Collections Table',
        description: 'Get collection table data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_collections_table',
        implemented: false,
        category: 'Collections',
        parameters: [
          { name: 'section_id', type: 'number', required: true, description: 'Library section ID' },
        ],
      },

      // Playlists
      {
        id: 'get_playlists_table',
        name: 'Get Playlists Table',
        description: 'Get playlist data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_playlists_table',
        implemented: false,
        category: 'Playlists',
        parameters: [
          { name: 'section_id', type: 'number', required: false, description: 'Library section ID' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
        ],
      },

      // Export
      {
        id: 'export_metadata',
        name: 'Export Metadata',
        description: 'Export library or media metadata',
        method: 'GET',
        endpoint: '/api/v2?cmd=export_metadata',
        implemented: false,
        category: 'Export',
        parameters: [
          { name: 'section_id', type: 'number', required: false, description: 'Library section ID' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'rating_key', type: 'number', required: false, description: 'Media rating key' },
          { name: 'file_format', type: 'string', required: false, description: 'json, csv, xml, m3u8' },
          { name: 'metadata_level', type: 'number', required: false, description: '0-3' },
          { name: 'media_info_level', type: 'number', required: false, description: '0-3' },
        ],
      },
      {
        id: 'get_exports_table',
        name: 'Get Exports Table',
        description: 'Get export table data',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_exports_table',
        implemented: false,
        category: 'Export',
        parameters: [
          { name: 'section_id', type: 'number', required: false, description: 'Library section ID' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
          { name: 'rating_key', type: 'number', required: false, description: 'Media rating key' },
        ],
      },
      {
        id: 'delete_export',
        name: 'Delete Export',
        description: 'Remove exported files',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_export',
        implemented: false,
        category: 'Export',
        parameters: [
          { name: 'export_id', type: 'number', required: false, description: 'Export ID' },
          { name: 'delete_all', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'download_export',
        name: 'Download Export',
        description: 'Download exported file',
        method: 'GET',
        endpoint: '/api/v2?cmd=download_export',
        implemented: false,
        category: 'Export',
        parameters: [
          { name: 'export_id', type: 'number', required: true, description: 'Export ID' },
        ],
      },
      {
        id: 'get_export_fields',
        name: 'Get Export Fields',
        description: 'Get available export fields',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_export_fields',
        implemented: false,
        category: 'Export',
        parameters: [
          { name: 'media_type', type: 'string', required: true, description: 'movie, show, etc.' },
          { name: 'sub_media_type', type: 'string', required: false, description: 'episode, track, etc.' },
        ],
      },

      // Synced Items
      {
        id: 'get_synced_items',
        name: 'Get Synced Items',
        description: 'List synced items',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_synced_items',
        implemented: false,
        category: 'Sync',
        parameters: [
          { name: 'machine_id', type: 'string', required: false, description: 'Machine ID' },
          { name: 'user_id', type: 'number', required: false, description: 'User ID' },
        ],
      },
      {
        id: 'delete_synced_item',
        name: 'Delete Synced Item',
        description: 'Remove synced item',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_synced_item',
        implemented: false,
        category: 'Sync',
        parameters: [
          { name: 'client_id', type: 'string', required: true, description: 'Client ID' },
          { name: 'sync_id', type: 'string', required: true, description: 'Sync ID' },
        ],
      },

      // Configuration & Backup
      {
        id: 'get_settings',
        name: 'Get Settings',
        description: 'Get all configuration settings',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_settings',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'key', type: 'string', required: false, description: 'Specific setting key' },
        ],
      },
      {
        id: 'get_date_formats',
        name: 'Get Date Formats',
        description: 'Get date/time format settings',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_date_formats',
        implemented: false,
        category: 'Configuration',
      },
      {
        id: 'backup_config',
        name: 'Backup Config',
        description: 'Create manual backup of configuration file',
        method: 'GET',
        endpoint: '/api/v2?cmd=backup_config',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'backup_db',
        name: 'Backup Database',
        description: 'Create manual backup of database file',
        method: 'GET',
        endpoint: '/api/v2?cmd=backup_db',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'download_config',
        name: 'Download Config',
        description: 'Download Tautulli configuration file',
        method: 'GET',
        endpoint: '/api/v2?cmd=download_config',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'download_database',
        name: 'Download Database',
        description: 'Download Tautulli database file',
        method: 'GET',
        endpoint: '/api/v2?cmd=download_database',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'download_log',
        name: 'Download Log',
        description: 'Download Tautulli log file',
        method: 'GET',
        endpoint: '/api/v2?cmd=download_log',
        implemented: false,
        category: 'Backup',
        parameters: [
          { name: 'logfile', type: 'string', required: false, description: 'tautulli, tautulli_api, plex_websocket' },
        ],
      },
      {
        id: 'download_plex_log',
        name: 'Download Plex Log',
        description: 'Download Plex log file',
        method: 'GET',
        endpoint: '/api/v2?cmd=download_plex_log',
        implemented: false,
        category: 'Backup',
        parameters: [
          { name: 'logfile', type: 'string', required: false, description: 'Log file name' },
        ],
      },

      // Cache Management
      {
        id: 'delete_cache',
        name: 'Delete Cache',
        description: 'Delete and recreate cache directory',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_cache',
        implemented: false,
        category: 'Cache',
      },
      {
        id: 'delete_image_cache',
        name: 'Delete Image Cache',
        description: 'Delete and recreate image cache directory',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_image_cache',
        implemented: false,
        category: 'Cache',
      },
      {
        id: 'delete_hosted_images',
        name: 'Delete Hosted Images',
        description: 'Remove images from hosting services',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_hosted_images',
        implemented: false,
        category: 'Cache',
        parameters: [
          { name: 'rating_key', type: 'number', required: false, description: 'Media rating key' },
          { name: 'service', type: 'string', required: false, description: 'Hosting service' },
          { name: 'delete_all', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'delete_lookup_info',
        name: 'Delete Lookup Info',
        description: 'Remove third-party API lookup data',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_lookup_info',
        implemented: false,
        category: 'Cache',
        parameters: [
          { name: 'rating_key', type: 'number', required: false, description: 'Media rating key' },
          { name: 'service', type: 'string', required: false, description: 'API service' },
          { name: 'delete_all', type: 'number', required: false, description: '0 or 1' },
        ],
      },
      {
        id: 'delete_media_info_cache',
        name: 'Delete Media Info Cache',
        description: 'Clear media info table cache',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_media_info_cache',
        implemented: false,
        category: 'Cache',
        parameters: [
          { name: 'section_id', type: 'number', required: true, description: 'Library section ID' },
        ],
      },

      // Logging
      {
        id: 'get_logs',
        name: 'Get Logs',
        description: 'Retrieve Tautulli logs',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_logs',
        implemented: false,
        category: 'Logging',
        parameters: [
          { name: 'sort', type: 'string', required: false, description: 'Sort direction' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
          { name: 'order', type: 'string', required: false, description: 'asc or desc' },
          { name: 'regex', type: 'string', required: false, description: 'Regex pattern' },
          { name: 'start', type: 'number', required: false, description: 'Start line' },
          { name: 'end', type: 'number', required: false, description: 'End line' },
        ],
      },
      {
        id: 'get_plex_log',
        name: 'Get Plex Log',
        description: 'Get PMS logs',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_plex_log',
        implemented: false,
        category: 'Logging',
        parameters: [
          { name: 'window', type: 'number', required: false, description: 'Number of lines' },
          { name: 'logfile', type: 'string', required: false, description: 'Log file name' },
        ],
      },
      {
        id: 'delete_login_log',
        name: 'Delete Login Log',
        description: 'Clear login logs',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_login_log',
        implemented: false,
        category: 'Logging',
      },

      // Geolocation
      {
        id: 'get_geoip_lookup',
        name: 'Get GeoIP Lookup',
        description: 'Get geolocation for IP address',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_geoip_lookup',
        implemented: false,
        category: 'Utility',
        parameters: [
          { name: 'ip_address', type: 'string', required: true, description: 'IP address' },
        ],
      },

      // System
      {
        id: 'get_apikey',
        name: 'Get API Key',
        description: 'Obtain API key',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_apikey',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'username', type: 'string', required: false, description: 'Username' },
          { name: 'password', type: 'string', required: false, description: 'Password' },
        ],
      },
      {
        id: 'update',
        name: 'Update Tautulli',
        description: 'Update Tautulli',
        method: 'GET',
        endpoint: '/api/v2?cmd=update',
        implemented: false,
        category: 'System',
      },
      {
        id: 'update_check',
        name: 'Check for Updates',
        description: 'Check for Tautulli updates',
        method: 'GET',
        endpoint: '/api/v2?cmd=update_check',
        implemented: false,
        category: 'System',
      },
      {
        id: 'restart',
        name: 'Restart Tautulli',
        description: 'Restart the Tautulli application',
        method: 'GET',
        endpoint: '/api/v2?cmd=restart',
        implemented: false,
        category: 'System',
      },
      {
        id: 'status',
        name: 'Get Status',
        description: 'Get the current status of Tautulli',
        method: 'GET',
        endpoint: '/api/v2?cmd=status',
        implemented: false,
        category: 'System',
      },
      {
        id: 'docs',
        name: 'Get API Docs',
        description: 'Return API documentation as dictionary',
        method: 'GET',
        endpoint: '/api/v2?cmd=docs',
        implemented: false,
        category: 'System',
      },
      {
        id: 'docs_md',
        name: 'Get API Docs Markdown',
        description: 'Return API documentation in Markdown',
        method: 'GET',
        endpoint: '/api/v2?cmd=docs_md',
        implemented: false,
        category: 'System',
      },
      {
        id: 'sql',
        name: 'Run SQL Query',
        description: 'Query the Tautulli database with raw SQL',
        method: 'GET',
        endpoint: '/api/v2?cmd=sql',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'SQL query' },
        ],
      },

      // Mobile Devices
      {
        id: 'get_mobile_devices',
        name: 'Get Mobile Devices',
        description: 'Get list of mobile devices',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_mobile_devices',
        implemented: false,
        category: 'Mobile',
      },
      {
        id: 'delete_mobile_device',
        name: 'Delete Mobile Device',
        description: 'Remove mobile device',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_mobile_device',
        implemented: false,
        category: 'Mobile',
        parameters: [
          { name: 'mobile_device_id', type: 'number', required: false, description: 'Mobile device ID' },
          { name: 'device_id', type: 'string', required: false, description: 'Device ID' },
        ],
      },
      {
        id: 'register_device',
        name: 'Register Device',
        description: 'Register a mobile device',
        method: 'GET',
        endpoint: '/api/v2?cmd=register_device',
        implemented: false,
        category: 'Mobile',
        parameters: [
          { name: 'device_id', type: 'string', required: true, description: 'Device ID' },
          { name: 'device_name', type: 'string', required: true, description: 'Device name' },
          { name: 'onesignal_id', type: 'string', required: false, description: 'OneSignal ID' },
        ],
      },

      // Newsletter
      {
        id: 'get_newsletters',
        name: 'Get Newsletters',
        description: 'List newsletters',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_newsletters',
        implemented: false,
        category: 'Newsletter',
      },
      {
        id: 'get_newsletter_config',
        name: 'Get Newsletter Config',
        description: 'Get newsletter settings',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_newsletter_config',
        implemented: false,
        category: 'Newsletter',
        parameters: [
          { name: 'newsletter_id', type: 'number', required: true, description: 'Newsletter ID' },
        ],
      },
      {
        id: 'add_newsletter_config',
        name: 'Add Newsletter Config',
        description: 'Add newsletter agent',
        method: 'GET',
        endpoint: '/api/v2?cmd=add_newsletter_config',
        implemented: false,
        category: 'Newsletter',
        parameters: [
          { name: 'agent_id', type: 'number', required: true, description: 'Agent ID' },
        ],
      },
      {
        id: 'set_newsletter_config',
        name: 'Set Newsletter Config',
        description: 'Update newsletter settings',
        method: 'GET',
        endpoint: '/api/v2?cmd=set_newsletter_config',
        implemented: false,
        category: 'Newsletter',
        parameters: [
          { name: 'newsletter_id', type: 'number', required: true, description: 'Newsletter ID' },
        ],
      },
      {
        id: 'delete_newsletter',
        name: 'Delete Newsletter',
        description: 'Remove newsletter',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_newsletter',
        implemented: false,
        category: 'Newsletter',
        parameters: [
          { name: 'newsletter_id', type: 'number', required: true, description: 'Newsletter ID' },
        ],
      },
      {
        id: 'get_newsletter_log',
        name: 'Get Newsletter Log',
        description: 'Get newsletter logs',
        method: 'GET',
        endpoint: '/api/v2?cmd=get_newsletter_log',
        implemented: false,
        category: 'Newsletter',
        parameters: [
          { name: 'order_column', type: 'string', required: false, description: 'Column to sort by' },
          { name: 'order_dir', type: 'string', required: false, description: 'asc or desc' },
          { name: 'start', type: 'number', required: false, description: 'Offset' },
          { name: 'length', type: 'number', required: false, description: 'Number of records' },
          { name: 'search', type: 'string', required: false, description: 'Search string' },
        ],
      },
      {
        id: 'delete_newsletter_log',
        name: 'Delete Newsletter Log',
        description: 'Clear newsletter logs',
        method: 'GET',
        endpoint: '/api/v2?cmd=delete_newsletter_log',
        implemented: false,
        category: 'Newsletter',
      },
    ];
  }
}
