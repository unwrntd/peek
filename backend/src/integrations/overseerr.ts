import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  OverseerrConfig,
  OverseerrServerStatus,
  OverseerrRequest,
  OverseerrRequestCount,
  OverseerrStats,
} from '../types';
import { logger } from '../services/logger';

export class OverseerrIntegration extends BaseIntegration {
  readonly type = 'overseerr';
  readonly name = 'Overseerr';

  private createClient(config: OverseerrConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 5055}/api/v1`;

    return axios.create({
      baseURL,
      headers: {
        'X-Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const overseerrConfig = config as OverseerrConfig;

    if (!overseerrConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!overseerrConfig.apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const client = this.createClient(overseerrConfig);
      const response = await client.get('/status');

      const data = response.data;

      if (!data || !data.version) {
        return {
          success: false,
          message: 'Invalid response from Overseerr server',
        };
      }

      return {
        success: true,
        message: `Connected to Overseerr v${data.version}`,
        details: {
          version: data.version,
          commitTag: data.commitTag,
          updateAvailable: data.updateAvailable,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('overseerr', 'Connection test failed', { error: errorMsg });

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
            message: `Connection refused: Cannot reach ${overseerrConfig.host}:${overseerrConfig.port || 5055}`,
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
    const overseerrConfig = config as OverseerrConfig;
    const client = this.createClient(overseerrConfig);

    switch (metric) {
      case 'status':
        return this.getServerStatus(client);
      case 'requests':
        return this.getRequests(client);
      case 'request-count':
        return this.getRequestCount(client);
      case 'stats':
        return this.getStats(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getServerStatus(client: AxiosInstance): Promise<{ serverStatus: OverseerrServerStatus }> {
    try {
      const response = await client.get('/status');
      const data = response.data;

      const serverStatus: OverseerrServerStatus = {
        version: data.version || '',
        commitTag: data.commitTag || '',
        updateAvailable: data.updateAvailable || false,
        commitsBehind: data.commitsBehind || 0,
        restartRequired: data.restartRequired || false,
      };

      return { serverStatus };
    } catch (error) {
      logger.error('overseerr', 'Failed to get server status', { error });
      throw error;
    }
  }

  private async getRequests(client: AxiosInstance): Promise<{ requests: OverseerrRequest[], totalCount: number }> {
    try {
      const response = await client.get('/request', {
        params: {
          take: 50,
          skip: 0,
          sort: 'added',
        },
      });

      const data = response.data;
      const results = data.results || [];

      // Fetch media details for each request to get titles
      const requests: OverseerrRequest[] = await Promise.all(
        results.map(async (req: Record<string, unknown>) => {
          const media = req.media as Record<string, unknown>;
          const mediaType = (media?.mediaType as 'movie' | 'tv') || 'movie';
          const tmdbId = media?.tmdbId ? Number(media.tmdbId) : 0;

          // Try to get title from various possible locations in the response
          let title = (media?.title as string) || (media?.name as string);
          let posterPath = media?.posterPath as string | undefined;

          // If no title, try to fetch from Overseerr's media endpoint
          if (!title && tmdbId) {
            try {
              const mediaEndpoint = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
              const mediaResponse = await client.get(mediaEndpoint);
              const mediaData = mediaResponse.data;
              title = mediaData?.title || mediaData?.name || mediaData?.originalTitle || mediaData?.originalName;
              if (!posterPath) {
                posterPath = mediaData?.posterPath;
              }
            } catch (mediaError) {
              // If media fetch fails, continue without title
              logger.debug('overseerr', `Failed to fetch media details for ${mediaType}/${tmdbId}`, { error: mediaError });
            }
          }

          return {
            id: Number(req.id) || 0,
            status: Number(req.status) || 1,
            media: {
              id: media?.id ? Number(media.id) : 0,
              mediaType,
              tmdbId,
              tvdbId: media?.tvdbId ? Number(media.tvdbId) : undefined,
              status: media?.status ? Number(media.status) : 1,
              title,
              posterPath,
            },
            requestedBy: {
              id: (req.requestedBy as Record<string, unknown>)?.id ? Number((req.requestedBy as Record<string, unknown>).id) : 0,
              displayName: ((req.requestedBy as Record<string, unknown>)?.displayName as string) ||
                           ((req.requestedBy as Record<string, unknown>)?.username as string) || 'Unknown',
              avatar: ((req.requestedBy as Record<string, unknown>)?.avatar as string) || undefined,
            },
            createdAt: (req.createdAt as string) || '',
            updatedAt: (req.updatedAt as string) || '',
            modifiedBy: req.modifiedBy ? {
              id: Number((req.modifiedBy as Record<string, unknown>).id) || 0,
              displayName: ((req.modifiedBy as Record<string, unknown>).displayName as string) ||
                           ((req.modifiedBy as Record<string, unknown>).username as string) || 'Unknown',
            } : undefined,
          };
        })
      );

      return {
        requests,
        totalCount: data.pageInfo?.results || requests.length,
      };
    } catch (error) {
      logger.error('overseerr', 'Failed to get requests', { error });
      throw error;
    }
  }

  private async getRequestCount(client: AxiosInstance): Promise<{ requestCount: OverseerrRequestCount }> {
    try {
      const response = await client.get('/request/count');
      const data = response.data;

      const requestCount: OverseerrRequestCount = {
        total: Number(data.total) || 0,
        pending: Number(data.pending) || 0,
        approved: Number(data.approved) || 0,
        declined: Number(data.declined) || 0,
        processing: Number(data.processing) || 0,
        available: Number(data.available) || 0,
      };

      return { requestCount };
    } catch (error) {
      logger.error('overseerr', 'Failed to get request count', { error });
      throw error;
    }
  }

  private async getStats(client: AxiosInstance): Promise<{ stats: OverseerrStats }> {
    try {
      const response = await client.get('/settings/about');
      const data = response.data;

      const stats: OverseerrStats = {
        totalRequests: Number(data.totalRequests) || 0,
        totalMediaItems: Number(data.totalMediaItems) || 0,
        totalMovies: Number(data.totalMovies) || 0,
        totalSeries: Number(data.totalSeries) || 0,
      };

      return { stats };
    } catch (error) {
      logger.error('overseerr', 'Failed to get stats', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Overseerr server version and status',
        widgetTypes: ['overseerr-status'],
      },
      {
        id: 'requests',
        name: 'Media Requests',
        description: 'List of media requests with details',
        widgetTypes: ['overseerr-requests', 'overseerr-pending'],
      },
      {
        id: 'request-count',
        name: 'Request Statistics',
        description: 'Total request counts by status',
        widgetTypes: ['overseerr-stats'],
      },
      {
        id: 'stats',
        name: 'Library Statistics',
        description: 'Overall media library statistics',
        widgetTypes: ['overseerr-stats'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Public - Implemented
      {
        id: 'status',
        name: 'Get Status',
        description: 'Retrieve Overseerr status and version information',
        method: 'GET',
        endpoint: '/status',
        implemented: true,
        category: 'Public',
        documentationUrl: 'https://api-docs.overseerr.dev/',
      },
      {
        id: 'status-appdata',
        name: 'Get App Data Status',
        description: 'Check application data volume configuration status',
        method: 'GET',
        endpoint: '/status/appdata',
        implemented: false,
        category: 'Public',
      },
      {
        id: 'settings-public',
        name: 'Get Public Settings',
        description: 'Access non-sensitive settings for initial setup',
        method: 'GET',
        endpoint: '/settings/public',
        implemented: false,
        category: 'Public',
      },

      // Settings
      {
        id: 'settings-main-get',
        name: 'Get Main Settings',
        description: 'Get core application configuration',
        method: 'GET',
        endpoint: '/settings/main',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-main-post',
        name: 'Update Main Settings',
        description: 'Update core application configuration',
        method: 'POST',
        endpoint: '/settings/main',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-regenerate',
        name: 'Regenerate API Key',
        description: 'Generate new API key',
        method: 'POST',
        endpoint: '/settings/main/regenerate',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-plex-get',
        name: 'Get Plex Settings',
        description: 'Get Plex server connection configuration',
        method: 'GET',
        endpoint: '/settings/plex',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-plex-post',
        name: 'Update Plex Settings',
        description: 'Configure Plex server connection',
        method: 'POST',
        endpoint: '/settings/plex',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-plex-library',
        name: 'Get Plex Libraries',
        description: 'List and synchronize Plex libraries',
        method: 'GET',
        endpoint: '/settings/plex/library',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-plex-sync',
        name: 'Sync Plex Libraries',
        description: 'Execute full library scan',
        method: 'POST',
        endpoint: '/settings/plex/sync',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-plex-servers',
        name: 'Discover Plex Servers',
        description: 'Discover available Plex servers',
        method: 'GET',
        endpoint: '/settings/plex/devices/servers',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-plex-users',
        name: 'Get Plex Users',
        description: 'Retrieve Plex user list',
        method: 'GET',
        endpoint: '/settings/plex/users',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-radarr-get',
        name: 'Get Radarr Settings',
        description: 'Get Radarr movie instance configuration',
        method: 'GET',
        endpoint: '/settings/radarr',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-radarr-post',
        name: 'Update Radarr Settings',
        description: 'Configure Radarr movie instances',
        method: 'POST',
        endpoint: '/settings/radarr',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-radarr-test',
        name: 'Test Radarr Connection',
        description: 'Validate Radarr configuration',
        method: 'POST',
        endpoint: '/settings/radarr/test',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-sonarr-get',
        name: 'Get Sonarr Settings',
        description: 'Get Sonarr TV instance configuration',
        method: 'GET',
        endpoint: '/settings/sonarr',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-sonarr-post',
        name: 'Update Sonarr Settings',
        description: 'Configure Sonarr TV instances',
        method: 'POST',
        endpoint: '/settings/sonarr',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-sonarr-test',
        name: 'Test Sonarr Connection',
        description: 'Validate Sonarr configuration',
        method: 'POST',
        endpoint: '/settings/sonarr/test',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-jobs',
        name: 'List Jobs',
        description: 'List scheduled background jobs',
        method: 'GET',
        endpoint: '/settings/jobs',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-job-run',
        name: 'Run Job',
        description: 'Execute specific job immediately',
        method: 'POST',
        endpoint: '/settings/jobs/{jobId}/run',
        implemented: false,
        category: 'Settings',
        parameters: [
          { name: 'jobId', type: 'string', required: true, description: 'Job ID' },
        ],
      },
      {
        id: 'settings-job-cancel',
        name: 'Cancel Job',
        description: 'Stop running job',
        method: 'POST',
        endpoint: '/settings/jobs/{jobId}/cancel',
        implemented: false,
        category: 'Settings',
        parameters: [
          { name: 'jobId', type: 'string', required: true, description: 'Job ID' },
        ],
      },
      {
        id: 'settings-cache',
        name: 'Get Cache Stats',
        description: 'Monitor active cache statistics',
        method: 'GET',
        endpoint: '/settings/cache',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-cache-flush',
        name: 'Flush Cache',
        description: 'Clear specific cache',
        method: 'POST',
        endpoint: '/settings/cache/{cacheId}/flush',
        implemented: false,
        category: 'Settings',
        parameters: [
          { name: 'cacheId', type: 'string', required: true, description: 'Cache ID' },
        ],
      },
      {
        id: 'settings-logs',
        name: 'Get Logs',
        description: 'Retrieve system logs with filtering',
        method: 'GET',
        endpoint: '/settings/logs',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-about',
        name: 'Get About Info',
        description: 'Display server statistics and version info',
        method: 'GET',
        endpoint: '/settings/about',
        implemented: true,
        category: 'Settings',
      },

      // Notifications
      {
        id: 'notifications-email-get',
        name: 'Get Email Settings',
        description: 'Get email notification configuration',
        method: 'GET',
        endpoint: '/settings/notifications/email',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-email-post',
        name: 'Update Email Settings',
        description: 'Configure email alerts',
        method: 'POST',
        endpoint: '/settings/notifications/email',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-email-test',
        name: 'Test Email',
        description: 'Send test email notification',
        method: 'POST',
        endpoint: '/settings/notifications/email/test',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-discord-get',
        name: 'Get Discord Settings',
        description: 'Get Discord notification configuration',
        method: 'GET',
        endpoint: '/settings/notifications/discord',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-discord-post',
        name: 'Update Discord Settings',
        description: 'Setup Discord integration',
        method: 'POST',
        endpoint: '/settings/notifications/discord',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-discord-test',
        name: 'Test Discord',
        description: 'Verify Discord settings',
        method: 'POST',
        endpoint: '/settings/notifications/discord/test',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-slack-get',
        name: 'Get Slack Settings',
        description: 'Get Slack notification configuration',
        method: 'GET',
        endpoint: '/settings/notifications/slack',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-slack-post',
        name: 'Update Slack Settings',
        description: 'Configure Slack webhooks',
        method: 'POST',
        endpoint: '/settings/notifications/slack',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-slack-test',
        name: 'Test Slack',
        description: 'Test Slack delivery',
        method: 'POST',
        endpoint: '/settings/notifications/slack/test',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-telegram-get',
        name: 'Get Telegram Settings',
        description: 'Get Telegram notification configuration',
        method: 'GET',
        endpoint: '/settings/notifications/telegram',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-telegram-post',
        name: 'Update Telegram Settings',
        description: 'Enable Telegram messaging',
        method: 'POST',
        endpoint: '/settings/notifications/telegram',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-telegram-test',
        name: 'Test Telegram',
        description: 'Validate Telegram config',
        method: 'POST',
        endpoint: '/settings/notifications/telegram/test',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-pushbullet-get',
        name: 'Get Pushbullet Settings',
        description: 'Get Pushbullet notification configuration',
        method: 'GET',
        endpoint: '/settings/notifications/pushbullet',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-pushbullet-post',
        name: 'Update Pushbullet Settings',
        description: 'Setup push notifications',
        method: 'POST',
        endpoint: '/settings/notifications/pushbullet',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-pushbullet-test',
        name: 'Test Pushbullet',
        description: 'Test push service',
        method: 'POST',
        endpoint: '/settings/notifications/pushbullet/test',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-pushover-get',
        name: 'Get Pushover Settings',
        description: 'Get Pushover notification configuration',
        method: 'GET',
        endpoint: '/settings/notifications/pushover',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-pushover-post',
        name: 'Update Pushover Settings',
        description: 'Configure Pushover alerts',
        method: 'POST',
        endpoint: '/settings/notifications/pushover',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-pushover-test',
        name: 'Test Pushover',
        description: 'Verify Pushover setup',
        method: 'POST',
        endpoint: '/settings/notifications/pushover/test',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-webhook-get',
        name: 'Get Webhook Settings',
        description: 'Get custom webhook configuration',
        method: 'GET',
        endpoint: '/settings/notifications/webhook',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-webhook-post',
        name: 'Update Webhook Settings',
        description: 'Configure custom webhooks',
        method: 'POST',
        endpoint: '/settings/notifications/webhook',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-webhook-test',
        name: 'Test Webhook',
        description: 'Verify webhook endpoint',
        method: 'POST',
        endpoint: '/settings/notifications/webhook/test',
        implemented: false,
        category: 'Notifications',
      },

      // Authentication
      {
        id: 'auth-plex',
        name: 'Sign In with Plex',
        description: 'Sign in using Plex token',
        method: 'POST',
        endpoint: '/auth/plex',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-local',
        name: 'Sign In Locally',
        description: 'Sign in with local credentials',
        method: 'POST',
        endpoint: '/auth/local',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-logout',
        name: 'Logout',
        description: 'End session and clear cookies',
        method: 'POST',
        endpoint: '/auth/logout',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-me',
        name: 'Get Current User',
        description: 'Get currently authenticated user details',
        method: 'GET',
        endpoint: '/auth/me',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-reset-password',
        name: 'Request Password Reset',
        description: 'Request password reset email',
        method: 'POST',
        endpoint: '/auth/reset-password',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-reset-password-guid',
        name: 'Complete Password Reset',
        description: 'Complete password reset with token',
        method: 'POST',
        endpoint: '/auth/reset-password/{guid}',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'guid', type: 'string', required: true, description: 'Password reset token' },
        ],
      },

      // Users
      {
        id: 'user-list',
        name: 'List Users',
        description: 'List all system users with pagination',
        method: 'GET',
        endpoint: '/user',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-create',
        name: 'Create User',
        description: 'Create new local user account',
        method: 'POST',
        endpoint: '/user',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-batch-update',
        name: 'Batch Update Users',
        description: 'Batch update multiple users',
        method: 'PUT',
        endpoint: '/user',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-import-plex',
        name: 'Import Plex Users',
        description: 'Import users from Plex server',
        method: 'POST',
        endpoint: '/user/import-from-plex',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-get',
        name: 'Get User',
        description: 'Retrieve specific user profile',
        method: 'GET',
        endpoint: '/user/{userId}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'number', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'user-update',
        name: 'Update User',
        description: 'Update individual user details',
        method: 'PUT',
        endpoint: '/user/{userId}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'number', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'user-delete',
        name: 'Delete User',
        description: 'Remove user account',
        method: 'DELETE',
        endpoint: '/user/{userId}',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'number', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'user-requests',
        name: 'Get User Requests',
        description: "Fetch user's media requests",
        method: 'GET',
        endpoint: '/user/{userId}/requests',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'number', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'user-quota',
        name: 'Get User Quota',
        description: 'Check request quotas and limits',
        method: 'GET',
        endpoint: '/user/{userId}/quota',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'number', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'user-watchlist',
        name: 'Get User Watchlist',
        description: 'Access Plex watchlist data',
        method: 'GET',
        endpoint: '/user/{userId}/watchlist',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'number', required: true, description: 'User ID' },
        ],
      },
      {
        id: 'user-watch-data',
        name: 'Get User Watch Data',
        description: 'Review watch history and stats',
        method: 'GET',
        endpoint: '/user/{userId}/watch_data',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'userId', type: 'number', required: true, description: 'User ID' },
        ],
      },

      // Requests - Implemented
      {
        id: 'request-list',
        name: 'List Requests',
        description: 'List all media requests',
        method: 'GET',
        endpoint: '/request',
        implemented: true,
        category: 'Requests',
        parameters: [
          { name: 'take', type: 'number', required: false, description: 'Number of results' },
          { name: 'skip', type: 'number', required: false, description: 'Offset for pagination' },
          { name: 'sort', type: 'string', required: false, description: 'Sort field (added, modified)' },
          { name: 'filter', type: 'string', required: false, description: 'Filter by status' },
        ],
      },
      {
        id: 'request-create',
        name: 'Create Request',
        description: 'Submit new media request',
        method: 'POST',
        endpoint: '/request',
        implemented: false,
        category: 'Requests',
      },
      {
        id: 'request-count',
        name: 'Get Request Count',
        description: 'Get count of requests by status',
        method: 'GET',
        endpoint: '/request/count',
        implemented: true,
        category: 'Requests',
      },
      {
        id: 'request-get',
        name: 'Get Request',
        description: 'Retrieve specific request details',
        method: 'GET',
        endpoint: '/request/{requestId}',
        implemented: false,
        category: 'Requests',
        parameters: [
          { name: 'requestId', type: 'number', required: true, description: 'Request ID' },
        ],
      },
      {
        id: 'request-update',
        name: 'Update Request',
        description: 'Update request details (approve/decline)',
        method: 'PUT',
        endpoint: '/request/{requestId}',
        implemented: false,
        category: 'Requests',
        parameters: [
          { name: 'requestId', type: 'number', required: true, description: 'Request ID' },
        ],
      },
      {
        id: 'request-delete',
        name: 'Delete Request',
        description: 'Cancel/remove request',
        method: 'DELETE',
        endpoint: '/request/{requestId}',
        implemented: false,
        category: 'Requests',
        parameters: [
          { name: 'requestId', type: 'number', required: true, description: 'Request ID' },
        ],
      },

      // Search & Discovery
      {
        id: 'search',
        name: 'Search',
        description: 'Search across movies, shows, and people',
        method: 'GET',
        endpoint: '/search',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'language', type: 'string', required: false, description: 'Language code' },
        ],
      },
      {
        id: 'search-keyword',
        name: 'Search Keywords',
        description: 'Find TMDB keywords',
        method: 'GET',
        endpoint: '/search/keyword',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
        ],
      },
      {
        id: 'search-company',
        name: 'Search Companies',
        description: 'Locate production companies',
        method: 'GET',
        endpoint: '/search/company',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
        ],
      },
      {
        id: 'discover-movies',
        name: 'Discover Movies',
        description: 'Browse movies with advanced filters',
        method: 'GET',
        endpoint: '/discover/movies',
        implemented: false,
        category: 'Discovery',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'language', type: 'string', required: false, description: 'Language code' },
          { name: 'genre', type: 'string', required: false, description: 'Genre ID' },
        ],
      },
      {
        id: 'discover-movies-genre',
        name: 'Discover Movies by Genre',
        description: 'Filter movies by genre',
        method: 'GET',
        endpoint: '/discover/movies/genre/{genreId}',
        implemented: false,
        category: 'Discovery',
        parameters: [
          { name: 'genreId', type: 'string', required: true, description: 'Genre ID' },
        ],
      },
      {
        id: 'discover-tv',
        name: 'Discover TV',
        description: 'Explore TV series with filtering',
        method: 'GET',
        endpoint: '/discover/tv',
        implemented: false,
        category: 'Discovery',
        parameters: [
          { name: 'page', type: 'number', required: false, description: 'Page number' },
          { name: 'language', type: 'string', required: false, description: 'Language code' },
          { name: 'genre', type: 'string', required: false, description: 'Genre ID' },
        ],
      },
      {
        id: 'discover-tv-genre',
        name: 'Discover TV by Genre',
        description: 'Browse series by genre',
        method: 'GET',
        endpoint: '/discover/tv/genre/{genreId}',
        implemented: false,
        category: 'Discovery',
        parameters: [
          { name: 'genreId', type: 'string', required: true, description: 'Genre ID' },
        ],
      },
      {
        id: 'discover-tv-network',
        name: 'Discover TV by Network',
        description: 'Find shows by network',
        method: 'GET',
        endpoint: '/discover/tv/network/{networkId}',
        implemented: false,
        category: 'Discovery',
        parameters: [
          { name: 'networkId', type: 'string', required: true, description: 'Network ID' },
        ],
      },
      {
        id: 'discover-upcoming',
        name: 'Discover Upcoming',
        description: 'Upcoming theatrical releases',
        method: 'GET',
        endpoint: '/discover/movies/upcoming',
        implemented: false,
        category: 'Discovery',
      },
      {
        id: 'discover-trending',
        name: 'Discover Trending',
        description: 'Current trending content',
        method: 'GET',
        endpoint: '/discover/trending',
        implemented: false,
        category: 'Discovery',
      },

      // Movies - Implemented (for fetching media details)
      {
        id: 'movie-search',
        name: 'Search Movies',
        description: 'Search for movies',
        method: 'GET',
        endpoint: '/movie',
        implemented: false,
        category: 'Movies',
      },
      {
        id: 'movie-details',
        name: 'Get Movie Details',
        description: 'Retrieve movie details',
        method: 'GET',
        endpoint: '/movie/{movieId}',
        implemented: true,
        category: 'Movies',
        parameters: [
          { name: 'movieId', type: 'number', required: true, description: 'TMDB Movie ID' },
        ],
      },
      {
        id: 'movie-recommendations',
        name: 'Get Movie Recommendations',
        description: 'Related movie suggestions',
        method: 'GET',
        endpoint: '/movie/{movieId}/recommendations',
        implemented: false,
        category: 'Movies',
        parameters: [
          { name: 'movieId', type: 'number', required: true, description: 'TMDB Movie ID' },
        ],
      },
      {
        id: 'movie-similar',
        name: 'Get Similar Movies',
        description: 'Similar movies',
        method: 'GET',
        endpoint: '/movie/{movieId}/similar',
        implemented: false,
        category: 'Movies',
        parameters: [
          { name: 'movieId', type: 'number', required: true, description: 'TMDB Movie ID' },
        ],
      },

      // TV Shows - Implemented (for fetching media details)
      {
        id: 'tv-search',
        name: 'Search TV',
        description: 'Search for television series',
        method: 'GET',
        endpoint: '/tv',
        implemented: false,
        category: 'TV Shows',
      },
      {
        id: 'tv-details',
        name: 'Get TV Details',
        description: 'Get series details and seasons',
        method: 'GET',
        endpoint: '/tv/{tvId}',
        implemented: true,
        category: 'TV Shows',
        parameters: [
          { name: 'tvId', type: 'number', required: true, description: 'TMDB TV ID' },
        ],
      },
      {
        id: 'tv-season',
        name: 'Get Season Details',
        description: 'Season episode listings',
        method: 'GET',
        endpoint: '/tv/{tvId}/season/{seasonNumber}',
        implemented: false,
        category: 'TV Shows',
        parameters: [
          { name: 'tvId', type: 'number', required: true, description: 'TMDB TV ID' },
          { name: 'seasonNumber', type: 'number', required: true, description: 'Season number' },
        ],
      },
      {
        id: 'tv-recommendations',
        name: 'Get TV Recommendations',
        description: 'Recommended series',
        method: 'GET',
        endpoint: '/tv/{tvId}/recommendations',
        implemented: false,
        category: 'TV Shows',
        parameters: [
          { name: 'tvId', type: 'number', required: true, description: 'TMDB TV ID' },
        ],
      },
      {
        id: 'tv-similar',
        name: 'Get Similar TV',
        description: 'Similar shows',
        method: 'GET',
        endpoint: '/tv/{tvId}/similar',
        implemented: false,
        category: 'TV Shows',
        parameters: [
          { name: 'tvId', type: 'number', required: true, description: 'TMDB TV ID' },
        ],
      },

      // People
      {
        id: 'person-search',
        name: 'Search People',
        description: 'Search for cast and crew',
        method: 'GET',
        endpoint: '/person',
        implemented: false,
        category: 'People',
      },
      {
        id: 'person-details',
        name: 'Get Person Details',
        description: 'Actor/crew biography and credits',
        method: 'GET',
        endpoint: '/person/{personId}',
        implemented: false,
        category: 'People',
        parameters: [
          { name: 'personId', type: 'number', required: true, description: 'TMDB Person ID' },
        ],
      },
      {
        id: 'person-credits',
        name: 'Get Person Credits',
        description: 'Full work history',
        method: 'GET',
        endpoint: '/person/{personId}/combined_credits',
        implemented: false,
        category: 'People',
        parameters: [
          { name: 'personId', type: 'number', required: true, description: 'TMDB Person ID' },
        ],
      },

      // Media Management
      {
        id: 'media-list',
        name: 'List Media',
        description: 'List all managed media',
        method: 'GET',
        endpoint: '/media',
        implemented: false,
        category: 'Media',
      },
      {
        id: 'media-details',
        name: 'Get Media Details',
        description: 'Get media details and status',
        method: 'GET',
        endpoint: '/media/{mediaId}',
        implemented: false,
        category: 'Media',
        parameters: [
          { name: 'mediaId', type: 'number', required: true, description: 'Media ID' },
        ],
      },
      {
        id: 'media-status',
        name: 'Get Media Status',
        description: 'Current availability status',
        method: 'GET',
        endpoint: '/media/{mediaId}/status',
        implemented: false,
        category: 'Media',
        parameters: [
          { name: 'mediaId', type: 'number', required: true, description: 'Media ID' },
        ],
      },
      {
        id: 'media-delete',
        name: 'Delete Media',
        description: 'Remove media from Overseerr',
        method: 'DELETE',
        endpoint: '/media/{mediaId}',
        implemented: false,
        category: 'Media',
        parameters: [
          { name: 'mediaId', type: 'number', required: true, description: 'Media ID' },
        ],
      },

      // Collections
      {
        id: 'collection-details',
        name: 'Get Collection',
        description: 'View movie collection details',
        method: 'GET',
        endpoint: '/collection/{collectionId}',
        implemented: false,
        category: 'Collections',
        parameters: [
          { name: 'collectionId', type: 'number', required: true, description: 'Collection ID' },
        ],
      },

      // Genres
      {
        id: 'genres-movies',
        name: 'Get Movie Genres',
        description: 'Available movie genres',
        method: 'GET',
        endpoint: '/genres/movie',
        implemented: false,
        category: 'Genres',
      },
      {
        id: 'genres-tv',
        name: 'Get TV Genres',
        description: 'Available TV genres',
        method: 'GET',
        endpoint: '/genres/tv',
        implemented: false,
        category: 'Genres',
      },

      // Service Integration
      {
        id: 'service-radarr',
        name: 'Get Radarr Services',
        description: 'Get configured Radarr servers',
        method: 'GET',
        endpoint: '/service/radarr',
        implemented: false,
        category: 'Services',
      },
      {
        id: 'service-sonarr',
        name: 'Get Sonarr Services',
        description: 'Get configured Sonarr servers',
        method: 'GET',
        endpoint: '/service/sonarr',
        implemented: false,
        category: 'Services',
      },

      // Issues
      {
        id: 'issue-list',
        name: 'List Issues',
        description: 'List all media issues',
        method: 'GET',
        endpoint: '/issue',
        implemented: false,
        category: 'Issues',
      },
      {
        id: 'issue-create',
        name: 'Create Issue',
        description: 'Report a new issue',
        method: 'POST',
        endpoint: '/issue',
        implemented: false,
        category: 'Issues',
      },
      {
        id: 'issue-get',
        name: 'Get Issue',
        description: 'Get issue details',
        method: 'GET',
        endpoint: '/issue/{issueId}',
        implemented: false,
        category: 'Issues',
        parameters: [
          { name: 'issueId', type: 'number', required: true, description: 'Issue ID' },
        ],
      },
      {
        id: 'issue-delete',
        name: 'Delete Issue',
        description: 'Remove an issue',
        method: 'DELETE',
        endpoint: '/issue/{issueId}',
        implemented: false,
        category: 'Issues',
        parameters: [
          { name: 'issueId', type: 'number', required: true, description: 'Issue ID' },
        ],
      },
      {
        id: 'issue-comment',
        name: 'Add Issue Comment',
        description: 'Add comment to an issue',
        method: 'POST',
        endpoint: '/issue/{issueId}/comment',
        implemented: false,
        category: 'Issues',
        parameters: [
          { name: 'issueId', type: 'number', required: true, description: 'Issue ID' },
        ],
      },
      {
        id: 'issue-count',
        name: 'Get Issue Count',
        description: 'Count of issues by status',
        method: 'GET',
        endpoint: '/issue/count',
        implemented: false,
        category: 'Issues',
      },
    ];
  }
}
