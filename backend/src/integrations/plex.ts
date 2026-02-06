import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  PlexConfig,
  PlexServerInfo,
  PlexLibrary,
  PlexMediaItem,
  PlexSession,
  PlexLibraryStats,
  PlexSessionsData,
  PlexTranscodeSession,
} from '../types';
import { logger } from '../services/logger';

export class PlexIntegration extends BaseIntegration {
  readonly type = 'plex';
  readonly name = 'Plex Media Server';

  private createClient(config: PlexConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 32400}`;

    return axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': config.token,
      },
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const plexConfig = config as PlexConfig;

    if (!plexConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!plexConfig.token) {
      return { success: false, message: 'Plex token is required' };
    }

    try {
      const client = this.createClient(plexConfig);
      const response = await client.get('/');

      const serverInfo = response.data?.MediaContainer;

      if (!serverInfo) {
        return {
          success: false,
          message: 'Invalid response from Plex server',
        };
      }

      return {
        success: true,
        message: `Connected to ${serverInfo.friendlyName || 'Plex Server'}`,
        details: {
          name: serverInfo.friendlyName,
          version: serverInfo.version,
          platform: serverInfo.platform,
          machineIdentifier: serverInfo.machineIdentifier,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('plex', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Authentication failed: Invalid Plex token',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused: Cannot reach ${plexConfig.host}:${plexConfig.port || 32400}`,
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
    const plexConfig = config as PlexConfig;
    const client = this.createClient(plexConfig);

    switch (metric) {
      case 'server-info':
        return this.getServerInfo(client);
      case 'libraries':
        return this.getLibraries(client);
      case 'sessions':
        return this.getSessions(client);
      case 'recently-added':
        return this.getRecentlyAdded(client);
      case 'transcode-sessions':
        return this.getTranscodeSessions(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getServerInfo(client: AxiosInstance): Promise<{ serverInfo: PlexServerInfo }> {
    try {
      const response = await client.get('/');
      const data = response.data?.MediaContainer;

      const serverInfo: PlexServerInfo = {
        friendlyName: data.friendlyName || 'Plex Server',
        machineIdentifier: data.machineIdentifier || '',
        version: data.version || '',
        platform: data.platform || '',
        platformVersion: data.platformVersion || '',
        transcoderActiveVideoSessions: data.transcoderActiveVideoSessions || 0,
        myPlex: data.myPlex === true || data.myPlex === 1,
        myPlexUsername: data.myPlexUsername || '',
        claimed: data.claimed === true || data.claimed === '1',
      };

      return { serverInfo };
    } catch (error) {
      logger.error('plex', 'Failed to get server info', { error });
      throw error;
    }
  }

  private async getLibraries(client: AxiosInstance): Promise<{ libraryStats: PlexLibraryStats }> {
    try {
      const response = await client.get('/library/sections');
      const sections = response.data?.MediaContainer?.Directory || [];

      const libraries: PlexLibrary[] = [];
      let totalMovies = 0;
      let totalShows = 0;
      let totalEpisodes = 0;
      let totalMusic = 0;
      let totalPhotos = 0;

      for (const section of sections) {
        // Fetch count for each library
        let count = 0;
        try {
          const countResponse = await client.get(`/library/sections/${section.key}/all`, {
            params: { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 0 },
          });
          count = countResponse.data?.MediaContainer?.totalSize || 0;
        } catch {
          // If we can't get count, use 0
          count = 0;
        }

        const libType = section.type as 'movie' | 'show' | 'artist' | 'photo';

        libraries.push({
          key: section.key,
          type: libType,
          title: section.title,
          agent: section.agent || '',
          scanner: section.scanner || '',
          count,
          refreshing: section.refreshing === true || section.refreshing === 1,
        });

        // Aggregate counts by type
        switch (libType) {
          case 'movie':
            totalMovies += count;
            break;
          case 'show':
            totalShows += count;
            // Try to get episode count for shows
            try {
              const episodeResponse = await client.get(`/library/sections/${section.key}/all`, {
                params: { type: 4, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 0 },
              });
              totalEpisodes += episodeResponse.data?.MediaContainer?.totalSize || 0;
            } catch {
              // Ignore episode count errors
            }
            break;
          case 'artist':
            totalMusic += count;
            break;
          case 'photo':
            totalPhotos += count;
            break;
        }
      }

      return {
        libraryStats: {
          libraries,
          totalMovies,
          totalShows,
          totalEpisodes,
          totalMusic,
          totalPhotos,
        },
      };
    } catch (error) {
      logger.error('plex', 'Failed to get libraries', { error });
      throw error;
    }
  }

  private async getSessions(client: AxiosInstance): Promise<{ sessionsData: PlexSessionsData }> {
    try {
      const response = await client.get('/status/sessions');
      const metadata = response.data?.MediaContainer?.Metadata || [];

      const sessions: PlexSession[] = metadata.map((item: Record<string, unknown>) => {
        const player = item.Player as Record<string, unknown> || {};
        const user = item.User as Record<string, unknown> || {};
        const transcodeSession = item.TranscodeSession as Record<string, unknown> | undefined;

        const session: PlexSession = {
          sessionKey: String(item.sessionKey || ''),
          ratingKey: String(item.ratingKey || ''),
          title: String(item.title || ''),
          parentTitle: item.parentTitle ? String(item.parentTitle) : undefined,
          grandparentTitle: item.grandparentTitle ? String(item.grandparentTitle) : undefined,
          type: (item.type as 'movie' | 'episode' | 'track') || 'movie',
          thumb: item.thumb ? String(item.thumb) : undefined,
          viewOffset: Number(item.viewOffset) || 0,
          duration: Number(item.duration) || 0,
          player: {
            title: String(player.title || 'Unknown Device'),
            platform: String(player.platform || 'Unknown'),
            state: (player.state as 'playing' | 'paused' | 'buffering') || 'playing',
            local: player.local === true || player.local === 1,
            address: String(player.address || ''),
            machineIdentifier: String(player.machineIdentifier || ''),
          },
          user: {
            id: String(user.id || ''),
            title: String(user.title || 'Unknown User'),
            thumb: user.thumb ? String(user.thumb) : undefined,
          },
        };

        if (transcodeSession) {
          session.transcodeSession = {
            key: String(transcodeSession.key || ''),
            throttled: transcodeSession.throttled === true || transcodeSession.throttled === 1,
            complete: transcodeSession.complete === true || transcodeSession.complete === 1,
            progress: Number(transcodeSession.progress) || 0,
            speed: Number(transcodeSession.speed) || 0,
            duration: Number(transcodeSession.duration) || 0,
            context: String(transcodeSession.context || ''),
            videoDecision: (transcodeSession.videoDecision as 'transcode' | 'copy' | 'directplay') || 'directplay',
            audioDecision: (transcodeSession.audioDecision as 'transcode' | 'copy' | 'directplay') || 'directplay',
            transcodeHwRequested: transcodeSession.transcodeHwRequested === true || transcodeSession.transcodeHwRequested === 1,
            transcodeHwFullPipeline: transcodeSession.transcodeHwFullPipeline === true || transcodeSession.transcodeHwFullPipeline === 1,
          };
        }

        return session;
      });

      // Calculate session types
      let transcoding = 0;
      let directPlay = 0;
      let directStream = 0;

      for (const session of sessions) {
        if (session.transcodeSession) {
          if (session.transcodeSession.videoDecision === 'transcode') {
            transcoding++;
          } else if (session.transcodeSession.videoDecision === 'copy') {
            directStream++;
          } else {
            directPlay++;
          }
        } else {
          directPlay++;
        }
      }

      return {
        sessionsData: {
          sessions,
          totalSessions: sessions.length,
          transcoding,
          directPlay,
          directStream,
        },
      };
    } catch (error) {
      logger.error('plex', 'Failed to get sessions', { error });
      throw error;
    }
  }

  private async getRecentlyAdded(client: AxiosInstance): Promise<{ recentlyAdded: PlexMediaItem[] }> {
    try {
      const response = await client.get('/library/recentlyAdded', {
        params: { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 50 },
      });
      const metadata = response.data?.MediaContainer?.Metadata || [];

      const recentlyAdded: PlexMediaItem[] = metadata.map((item: Record<string, unknown>) => ({
        ratingKey: String(item.ratingKey || ''),
        key: String(item.key || ''),
        type: (item.type as 'movie' | 'episode' | 'track' | 'photo') || 'movie',
        title: String(item.title || ''),
        parentTitle: item.parentTitle ? String(item.parentTitle) : undefined,
        grandparentTitle: item.grandparentTitle ? String(item.grandparentTitle) : undefined,
        thumb: item.thumb ? String(item.thumb) : undefined,
        addedAt: Number(item.addedAt) || 0,
        duration: item.duration ? Number(item.duration) : undefined,
        year: item.year ? Number(item.year) : undefined,
        contentRating: item.contentRating ? String(item.contentRating) : undefined,
      }));

      return { recentlyAdded };
    } catch (error) {
      logger.error('plex', 'Failed to get recently added', { error });
      throw error;
    }
  }

  private async getTranscodeSessions(client: AxiosInstance): Promise<{ transcodeSessions: PlexTranscodeSession[] }> {
    try {
      const response = await client.get('/transcode/sessions');
      const sessions = response.data?.MediaContainer?.TranscodeSession || [];

      const transcodeSessions: PlexTranscodeSession[] = sessions.map((item: Record<string, unknown>) => ({
        key: String(item.key || ''),
        throttled: item.throttled === true || item.throttled === 1,
        complete: item.complete === true || item.complete === 1,
        progress: Number(item.progress) || 0,
        speed: Number(item.speed) || 0,
        duration: Number(item.duration) || 0,
        context: String(item.context || ''),
        videoDecision: (item.videoDecision as 'transcode' | 'copy' | 'directplay') || 'directplay',
        audioDecision: (item.audioDecision as 'transcode' | 'copy' | 'directplay') || 'directplay',
        transcodeHwRequested: item.transcodeHwRequested === true || item.transcodeHwRequested === 1,
        transcodeHwFullPipeline: item.transcodeHwFullPipeline === true || item.transcodeHwFullPipeline === 1,
      }));

      return { transcodeSessions };
    } catch (error) {
      logger.error('plex', 'Failed to get transcode sessions', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'server-info',
        name: 'Server Information',
        description: 'Server name, version, and status',
        widgetTypes: ['plex-server-status'],
      },
      {
        id: 'libraries',
        name: 'Library Statistics',
        description: 'Library counts and types',
        widgetTypes: ['plex-library-stats'],
      },
      {
        id: 'sessions',
        name: 'Active Sessions',
        description: 'Currently playing media and users',
        widgetTypes: ['plex-now-playing'],
      },
      {
        id: 'recently-added',
        name: 'Recently Added',
        description: 'Recently added media items',
        widgetTypes: ['plex-recently-added'],
      },
      {
        id: 'transcode-sessions',
        name: 'Transcode Sessions',
        description: 'Active transcoding operations',
        widgetTypes: ['plex-transcoding'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Server - Implemented
      {
        id: 'server-identity',
        name: 'Get Server Identity',
        description: 'Get server name, version, and machine identifier',
        method: 'GET',
        endpoint: '/identity',
        implemented: true,
        category: 'Server',
        documentationUrl: 'https://github.com/Arcanemagus/plex-api/wiki',
      },
      {
        id: 'server-capabilities',
        name: 'Get Server Capabilities',
        description: 'Get server capabilities and features',
        method: 'GET',
        endpoint: '/',
        implemented: true,
        category: 'Server',
      },
      {
        id: 'server-preferences',
        name: 'Get Server Preferences',
        description: 'Get server preference settings',
        method: 'GET',
        endpoint: '/:/prefs',
        implemented: false,
        category: 'Server',
      },
      {
        id: 'server-activities',
        name: 'Get Server Activities',
        description: 'Get background activities (scanning, etc.)',
        method: 'GET',
        endpoint: '/activities',
        implemented: false,
        category: 'Server',
      },

      // Libraries - Implemented
      {
        id: 'library-sections',
        name: 'List Libraries',
        description: 'Get all library sections',
        method: 'GET',
        endpoint: '/library/sections',
        implemented: true,
        category: 'Libraries',
      },
      {
        id: 'library-content',
        name: 'Get Library Content',
        description: 'Get all items in a library',
        method: 'GET',
        endpoint: '/library/sections/{key}/all',
        implemented: true,
        category: 'Libraries',
        parameters: [
          { name: 'key', type: 'string', required: true, description: 'Library section key' },
        ],
      },
      {
        id: 'library-refresh',
        name: 'Refresh Library',
        description: 'Scan library for changes',
        method: 'GET',
        endpoint: '/library/sections/{key}/refresh',
        implemented: false,
        category: 'Libraries',
      },
      {
        id: 'library-recently-added',
        name: 'Get Recently Added',
        description: 'Get recently added items from a library',
        method: 'GET',
        endpoint: '/library/sections/{key}/recentlyAdded',
        implemented: true,
        category: 'Libraries',
      },
      {
        id: 'library-on-deck',
        name: 'Get On Deck',
        description: 'Get on deck items (continue watching)',
        method: 'GET',
        endpoint: '/library/onDeck',
        implemented: false,
        category: 'Libraries',
      },

      // Sessions - Implemented
      {
        id: 'sessions-list',
        name: 'List Active Sessions',
        description: 'Get currently playing sessions',
        method: 'GET',
        endpoint: '/status/sessions',
        implemented: true,
        category: 'Sessions',
      },
      {
        id: 'transcode-sessions',
        name: 'List Transcode Sessions',
        description: 'Get active transcode sessions',
        method: 'GET',
        endpoint: '/transcode/sessions',
        implemented: true,
        category: 'Sessions',
      },
      {
        id: 'session-terminate',
        name: 'Terminate Session',
        description: 'Stop a playing session',
        method: 'GET',
        endpoint: '/status/sessions/terminate',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'sessionId', type: 'string', required: true, description: 'Session ID to terminate' },
          { name: 'reason', type: 'string', required: false, description: 'Message to display to user' },
        ],
      },

      // Media
      {
        id: 'metadata-item',
        name: 'Get Item Metadata',
        description: 'Get detailed metadata for a media item',
        method: 'GET',
        endpoint: '/library/metadata/{ratingKey}',
        implemented: false,
        category: 'Media',
        parameters: [
          { name: 'ratingKey', type: 'string', required: true, description: 'Media item rating key' },
        ],
      },
      {
        id: 'metadata-children',
        name: 'Get Item Children',
        description: 'Get children of a media item (episodes, tracks)',
        method: 'GET',
        endpoint: '/library/metadata/{ratingKey}/children',
        implemented: false,
        category: 'Media',
      },
      {
        id: 'mark-watched',
        name: 'Mark as Watched',
        description: 'Mark a media item as watched',
        method: 'GET',
        endpoint: '/:/scrobble',
        implemented: false,
        category: 'Media',
        parameters: [
          { name: 'key', type: 'string', required: true, description: 'Media item key' },
          { name: 'identifier', type: 'string', required: true, description: 'com.plexapp.plugins.library' },
        ],
      },
      {
        id: 'mark-unwatched',
        name: 'Mark as Unwatched',
        description: 'Mark a media item as unwatched',
        method: 'GET',
        endpoint: '/:/unscrobble',
        implemented: false,
        category: 'Media',
      },
      {
        id: 'rate-item',
        name: 'Rate Item',
        description: 'Set rating for a media item',
        method: 'PUT',
        endpoint: '/:/rate',
        implemented: false,
        category: 'Media',
        parameters: [
          { name: 'key', type: 'string', required: true, description: 'Media item key' },
          { name: 'rating', type: 'number', required: true, description: 'Rating value' },
        ],
      },

      // Search
      {
        id: 'search',
        name: 'Search',
        description: 'Search for media across all libraries',
        method: 'GET',
        endpoint: '/search',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
        ],
      },
      {
        id: 'search-hub',
        name: 'Hub Search',
        description: 'Search with categorized results',
        method: 'GET',
        endpoint: '/hubs/search',
        implemented: false,
        category: 'Search',
      },

      // Playlists
      {
        id: 'playlists-list',
        name: 'List Playlists',
        description: 'Get all playlists',
        method: 'GET',
        endpoint: '/playlists',
        implemented: false,
        category: 'Playlists',
      },
      {
        id: 'playlist-create',
        name: 'Create Playlist',
        description: 'Create a new playlist',
        method: 'POST',
        endpoint: '/playlists',
        implemented: false,
        category: 'Playlists',
      },
      {
        id: 'playlist-items',
        name: 'Get Playlist Items',
        description: 'Get items in a playlist',
        method: 'GET',
        endpoint: '/playlists/{ratingKey}/items',
        implemented: false,
        category: 'Playlists',
      },

      // Users & Sharing
      {
        id: 'users-list',
        name: 'List Users',
        description: 'Get users with server access',
        method: 'GET',
        endpoint: '/accounts',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'sharing-invite',
        name: 'Invite User',
        description: 'Invite a user to the server',
        method: 'POST',
        endpoint: '/friends/invite',
        implemented: false,
        category: 'Users',
      },

      // Sync & Downloads
      {
        id: 'sync-list',
        name: 'List Sync Items',
        description: 'Get sync/download items',
        method: 'GET',
        endpoint: '/sync/items',
        implemented: false,
        category: 'Sync',
      },

      // Devices
      {
        id: 'devices-list',
        name: 'List Devices',
        description: 'Get connected devices/clients',
        method: 'GET',
        endpoint: '/devices',
        implemented: false,
        category: 'Devices',
      },

      // Statistics
      {
        id: 'statistics',
        name: 'Get Statistics',
        description: 'Get media statistics',
        method: 'GET',
        endpoint: '/statistics/media',
        implemented: false,
        category: 'Statistics',
      },
      {
        id: 'bandwidth-stats',
        name: 'Get Bandwidth Stats',
        description: 'Get bandwidth usage statistics',
        method: 'GET',
        endpoint: '/statistics/bandwidth',
        implemented: false,
        category: 'Statistics',
      },

      // Butler (Scheduled Tasks)
      {
        id: 'butler-tasks',
        name: 'Get Butler Tasks',
        description: 'Get scheduled maintenance tasks',
        method: 'GET',
        endpoint: '/butler',
        implemented: false,
        category: 'Maintenance',
      },
      {
        id: 'butler-run',
        name: 'Run Butler Task',
        description: 'Run a specific maintenance task',
        method: 'POST',
        endpoint: '/butler/{taskName}',
        implemented: false,
        category: 'Maintenance',
      },
      {
        id: 'optimize-db',
        name: 'Optimize Database',
        description: 'Optimize the Plex database',
        method: 'PUT',
        endpoint: '/library/optimize',
        implemented: false,
        category: 'Maintenance',
      },
      {
        id: 'clean-bundles',
        name: 'Clean Bundles',
        description: 'Clean unused bundles',
        method: 'PUT',
        endpoint: '/library/clean/bundles',
        implemented: false,
        category: 'Maintenance',
      },
      {
        id: 'empty-trash',
        name: 'Empty Trash',
        description: 'Empty library trash',
        method: 'PUT',
        endpoint: '/library/sections/{key}/emptyTrash',
        implemented: false,
        category: 'Maintenance',
      },

      // Logs
      {
        id: 'logs',
        name: 'Get Logs',
        description: 'Get server logs',
        method: 'GET',
        endpoint: '/log',
        implemented: false,
        category: 'System',
      },
    ];
  }
}
