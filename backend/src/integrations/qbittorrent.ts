import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  QBittorrentConfig,
  QBittorrentTorrent,
  QBittorrentTransferInfo,
  QBittorrentServerState,
  QBittorrentStatus,
  QBittorrentCategory,
} from '../types';
import { logger } from '../services/logger';

// Session cache for cookie-based auth
const sessionCache = new Map<string, { cookie: string; expires: number }>();

export class QBittorrentIntegration extends BaseIntegration {
  readonly type = 'qbittorrent';
  readonly name = 'qBittorrent';

  private createClient(config: QBittorrentConfig, cookie?: string): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 8080}/api/v2`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    return axios.create({
      baseURL,
      headers,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
      withCredentials: true,
    });
  }

  private getCacheKey(config: QBittorrentConfig): string {
    return `${config.host}:${config.port}:${config.username}`;
  }

  private async getSession(config: QBittorrentConfig): Promise<string> {
    const cacheKey = this.getCacheKey(config);
    const cached = sessionCache.get(cacheKey);

    // Check if we have a valid cached session (valid for 30 minutes)
    if (cached && cached.expires > Date.now()) {
      return cached.cookie;
    }

    // Login to get new session cookie
    const client = this.createClient(config);
    const response = await client.post('/auth/login',
      `username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`,
      {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      }
    );

    // Check for successful login
    if (response.data === 'Fails.') {
      throw new Error('Authentication failed: Invalid credentials');
    }

    // Extract SID cookie from response headers
    const setCookie = response.headers['set-cookie'];
    if (!setCookie || setCookie.length === 0) {
      throw new Error('No session cookie received');
    }

    // Parse the SID cookie
    const sidCookie = setCookie.find((c: string) => c.startsWith('SID='));
    if (!sidCookie) {
      throw new Error('SID cookie not found');
    }

    const cookie = sidCookie.split(';')[0];

    // Cache the session for 30 minutes
    sessionCache.set(cacheKey, {
      cookie,
      expires: Date.now() + 30 * 60 * 1000,
    });

    return cookie;
  }

  private async getAuthenticatedClient(config: QBittorrentConfig): Promise<AxiosInstance> {
    const cookie = await this.getSession(config);
    return this.createClient(config, cookie);
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const qbtConfig = config as QBittorrentConfig;

    if (!qbtConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!qbtConfig.username) {
      return { success: false, message: 'Username is required' };
    }
    if (!qbtConfig.password) {
      return { success: false, message: 'Password is required' };
    }

    try {
      const client = await this.getAuthenticatedClient(qbtConfig);

      const [versionResponse, apiVersionResponse] = await Promise.all([
        client.get('/app/version'),
        client.get('/app/webapiVersion'),
      ]);

      const version = versionResponse.data || 'Unknown';
      const apiVersion = apiVersionResponse.data || 'Unknown';

      return {
        success: true,
        message: `Connected to qBittorrent ${version}`,
        details: {
          version,
          apiVersion,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('qbittorrent', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            message: 'Authentication failed: Invalid credentials',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused: Cannot reach ${qbtConfig.host}:${qbtConfig.port || 8080}`,
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
    const qbtConfig = config as QBittorrentConfig;
    const client = await this.getAuthenticatedClient(qbtConfig);

    switch (metric) {
      case 'status':
        return this.getStatus(client);
      case 'torrents':
        return this.getTorrents(client);
      case 'transfer':
        return this.getTransferInfo(client);
      case 'categories':
        return this.getCategories(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatus(client: AxiosInstance): Promise<{
    status: QBittorrentStatus;
    torrents: QBittorrentTorrent[];
    categories: Record<string, QBittorrentCategory>;
  }> {
    try {
      const [versionRes, apiVersionRes, mainDataRes] = await Promise.all([
        client.get('/app/version'),
        client.get('/app/webapiVersion'),
        client.get('/sync/maindata', { params: { rid: 0 } }),
      ]);

      const mainData = mainDataRes.data;
      const serverState: QBittorrentServerState = mainData.server_state || {};

      const status: QBittorrentStatus = {
        version: versionRes.data || 'Unknown',
        apiVersion: apiVersionRes.data || 'Unknown',
        connectionStatus: serverState.connection_status || 'unknown',
        dhtNodes: serverState.dht_nodes || 0,
        totalPeerConnections: serverState.total_peer_connections || 0,
        freeSpaceOnDisk: serverState.free_space_on_disk || 0,
        useAltSpeedLimits: serverState.use_alt_speed_limits || false,
        downloadSpeed: serverState.dl_info_speed || 0,
        uploadSpeed: serverState.up_info_speed || 0,
        downloadSpeedLimit: serverState.dl_rate_limit || 0,
        uploadSpeedLimit: serverState.up_rate_limit || 0,
        allTimeDownload: serverState.alltime_dl || 0,
        allTimeUpload: serverState.alltime_ul || 0,
        globalRatio: serverState.global_ratio || '0',
      };

      // Convert torrents object to array
      const torrentsObj = mainData.torrents || {};
      const torrents: QBittorrentTorrent[] = Object.entries(torrentsObj).map(([hash, torrent]) => ({
        hash,
        ...(torrent as Omit<QBittorrentTorrent, 'hash'>),
      }));

      const categories = mainData.categories || {};

      return { status, torrents, categories };
    } catch (error) {
      logger.error('qbittorrent', 'Failed to get status', { error });
      throw error;
    }
  }

  private async getTorrents(client: AxiosInstance): Promise<{
    torrents: QBittorrentTorrent[];
    downloading: number;
    seeding: number;
    paused: number;
    total: number;
  }> {
    try {
      const response = await client.get('/torrents/info');
      const torrents: QBittorrentTorrent[] = response.data || [];

      let downloading = 0;
      let seeding = 0;
      let paused = 0;

      for (const torrent of torrents) {
        const state = torrent.state;
        if (state === 'downloading' || state === 'forcedDL' || state === 'metaDL' || state === 'stalledDL' || state === 'queuedDL' || state === 'checkingDL' || state === 'allocating') {
          downloading++;
        } else if (state === 'uploading' || state === 'forcedUP' || state === 'stalledUP' || state === 'queuedUP' || state === 'checkingUP') {
          seeding++;
        } else if (state === 'pausedDL' || state === 'pausedUP') {
          paused++;
        }
      }

      return {
        torrents,
        downloading,
        seeding,
        paused,
        total: torrents.length,
      };
    } catch (error) {
      logger.error('qbittorrent', 'Failed to get torrents', { error });
      throw error;
    }
  }

  private async getTransferInfo(client: AxiosInstance): Promise<{
    transfer: QBittorrentTransferInfo;
  }> {
    try {
      const response = await client.get('/transfer/info');
      const transfer: QBittorrentTransferInfo = response.data || {};

      return { transfer };
    } catch (error) {
      logger.error('qbittorrent', 'Failed to get transfer info', { error });
      throw error;
    }
  }

  private async getCategories(client: AxiosInstance): Promise<{
    categories: Record<string, QBittorrentCategory>;
    tags: string[];
  }> {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        client.get('/torrents/categories'),
        client.get('/torrents/tags'),
      ]);

      return {
        categories: categoriesRes.data || {},
        tags: tagsRes.data || [],
      };
    } catch (error) {
      logger.error('qbittorrent', 'Failed to get categories', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Version, speed, disk space, connection status',
        widgetTypes: ['qbittorrent-status'],
      },
      {
        id: 'torrents',
        name: 'Torrent List',
        description: 'Active downloads/uploads with progress and speed',
        widgetTypes: ['qbittorrent-torrents'],
      },
      {
        id: 'transfer',
        name: 'Transfer Stats',
        description: 'Global transfer statistics',
        widgetTypes: ['qbittorrent-transfer'],
      },
      {
        id: 'categories',
        name: 'Categories',
        description: 'Torrent categories and tags',
        widgetTypes: ['qbittorrent-categories'],
      },
    ];
  }

  // Override to use authenticated client with session cookie
  async executeCapability(
    config: IntegrationConfig,
    capabilityId: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    parameters?: Record<string, unknown>
  ): Promise<import('./base').CapabilityExecuteResult> {
    const qbtConfig = config as QBittorrentConfig;

    // Validate capability exists
    const capabilities = this.getApiCapabilities();
    const capability = capabilities.find((c) => c.id === capabilityId);
    if (!capability) {
      return { success: false, error: `Unknown capability: ${capabilityId}` };
    }

    try {
      // Get authenticated client with session cookie
      const client = await this.getAuthenticatedClient(qbtConfig);

      // Resolve endpoint placeholders
      const resolvedEndpoint = endpoint.replace(/\{(\w+)\}/g, (_, key) =>
        String(parameters?.[key] ?? '')
      );

      // Separate path params from body/query params
      const pathParamMatches = endpoint.match(/\{(\w+)\}/g);
      const pathParams = new Set(pathParamMatches?.map((m) => m.slice(1, -1)) || []);
      const queryOrBodyParams = Object.fromEntries(
        Object.entries(parameters || {}).filter(([k]) => !pathParams.has(k))
      );

      let response;
      switch (method) {
        case 'GET':
          response = await client.get(resolvedEndpoint, {
            params: Object.keys(queryOrBodyParams).length > 0 ? queryOrBodyParams : undefined,
          });
          break;
        case 'POST':
          // qBittorrent uses form-urlencoded for POST requests
          const formData = new URLSearchParams();
          Object.entries(queryOrBodyParams).forEach(([key, value]) => {
            formData.append(key, String(value));
          });
          response = await client.post(resolvedEndpoint, formData.toString());
          break;
        case 'PUT':
          response = await client.put(resolvedEndpoint, queryOrBodyParams);
          break;
        case 'DELETE':
          response = await client.delete(resolvedEndpoint, {
            data: Object.keys(queryOrBodyParams).length > 0 ? queryOrBodyParams : undefined,
          });
          break;
        case 'PATCH':
          response = await client.patch(resolvedEndpoint, queryOrBodyParams);
          break;
      }
      return { success: true, data: response.data, statusCode: response.status };
    } catch (error) {
      const axiosError = error as {
        message?: string;
        response?: { status?: number; data?: unknown };
      };
      return {
        success: false,
        error: axiosError.message || String(error),
        statusCode: axiosError.response?.status,
        data: axiosError.response?.data,
      };
    }
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-login',
        name: 'Login',
        description: 'Authenticate and get session cookie',
        method: 'POST',
        endpoint: '/auth/login',
        implemented: true,
        category: 'Authentication',
        documentationUrl: 'https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)',
      },
      {
        id: 'auth-logout',
        name: 'Logout',
        description: 'End current session',
        method: 'POST',
        endpoint: '/auth/logout',
        implemented: false,
        category: 'Authentication',
      },

      // Application - Implemented
      {
        id: 'app-version',
        name: 'Get Version',
        description: 'Get qBittorrent version',
        method: 'GET',
        endpoint: '/app/version',
        implemented: true,
        category: 'Application',
      },
      {
        id: 'app-api-version',
        name: 'Get API Version',
        description: 'Get WebAPI version',
        method: 'GET',
        endpoint: '/app/webapiVersion',
        implemented: false,
        category: 'Application',
      },
      {
        id: 'app-preferences',
        name: 'Get Preferences',
        description: 'Get application preferences',
        method: 'GET',
        endpoint: '/app/preferences',
        implemented: false,
        category: 'Application',
      },
      {
        id: 'app-set-preferences',
        name: 'Set Preferences',
        description: 'Update application preferences',
        method: 'POST',
        endpoint: '/app/setPreferences',
        implemented: false,
        category: 'Application',
      },
      {
        id: 'app-default-save-path',
        name: 'Get Default Save Path',
        description: 'Get default torrent save path',
        method: 'GET',
        endpoint: '/app/defaultSavePath',
        implemented: false,
        category: 'Application',
      },
      {
        id: 'app-shutdown',
        name: 'Shutdown',
        description: 'Shutdown qBittorrent',
        method: 'POST',
        endpoint: '/app/shutdown',
        implemented: false,
        category: 'Application',
      },

      // Transfer - Implemented
      {
        id: 'transfer-info',
        name: 'Get Transfer Info',
        description: 'Get global transfer statistics',
        method: 'GET',
        endpoint: '/transfer/info',
        implemented: true,
        category: 'Transfer',
      },
      {
        id: 'transfer-speed-limits-mode',
        name: 'Get Speed Limits Mode',
        description: 'Get alternative speed limits state',
        method: 'GET',
        endpoint: '/transfer/speedLimitsMode',
        implemented: false,
        category: 'Transfer',
      },
      {
        id: 'transfer-toggle-speed-limits',
        name: 'Toggle Speed Limits',
        description: 'Toggle alternative speed limits',
        method: 'POST',
        endpoint: '/transfer/toggleSpeedLimitsMode',
        implemented: false,
        category: 'Transfer',
      },
      {
        id: 'transfer-download-limit',
        name: 'Get Download Limit',
        description: 'Get global download speed limit',
        method: 'GET',
        endpoint: '/transfer/downloadLimit',
        implemented: false,
        category: 'Transfer',
      },
      {
        id: 'transfer-set-download-limit',
        name: 'Set Download Limit',
        description: 'Set global download speed limit',
        method: 'POST',
        endpoint: '/transfer/setDownloadLimit',
        implemented: false,
        category: 'Transfer',
        parameters: [
          { name: 'limit', type: 'number', required: true, description: 'Speed limit in bytes/second (0 = unlimited)' },
        ],
      },
      {
        id: 'transfer-upload-limit',
        name: 'Get Upload Limit',
        description: 'Get global upload speed limit',
        method: 'GET',
        endpoint: '/transfer/uploadLimit',
        implemented: false,
        category: 'Transfer',
      },
      {
        id: 'transfer-set-upload-limit',
        name: 'Set Upload Limit',
        description: 'Set global upload speed limit',
        method: 'POST',
        endpoint: '/transfer/setUploadLimit',
        implemented: false,
        category: 'Transfer',
      },
      {
        id: 'transfer-ban-peers',
        name: 'Ban Peers',
        description: 'Ban peers by IP',
        method: 'POST',
        endpoint: '/transfer/banPeers',
        implemented: false,
        category: 'Transfer',
      },

      // Torrents - Implemented
      {
        id: 'torrents-list',
        name: 'List Torrents',
        description: 'Get list of all torrents',
        method: 'GET',
        endpoint: '/torrents/info',
        implemented: true,
        category: 'Torrents',
        parameters: [
          { name: 'filter', type: 'string', required: false, description: 'Filter (all, downloading, seeding, etc.)' },
          { name: 'category', type: 'string', required: false, description: 'Filter by category' },
          { name: 'sort', type: 'string', required: false, description: 'Sort field' },
        ],
      },
      {
        id: 'torrent-properties',
        name: 'Get Torrent Properties',
        description: 'Get detailed properties of a torrent',
        method: 'GET',
        endpoint: '/torrents/properties',
        implemented: false,
        category: 'Torrents',
        parameters: [
          { name: 'hash', type: 'string', required: true, description: 'Torrent hash' },
        ],
      },
      {
        id: 'torrent-trackers',
        name: 'Get Torrent Trackers',
        description: 'Get trackers for a torrent',
        method: 'GET',
        endpoint: '/torrents/trackers',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-webseeds',
        name: 'Get Torrent Webseeds',
        description: 'Get webseeds for a torrent',
        method: 'GET',
        endpoint: '/torrents/webseeds',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-files',
        name: 'Get Torrent Files',
        description: 'Get file list for a torrent',
        method: 'GET',
        endpoint: '/torrents/files',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-piece-states',
        name: 'Get Piece States',
        description: 'Get piece states for a torrent',
        method: 'GET',
        endpoint: '/torrents/pieceStates',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-piece-hashes',
        name: 'Get Piece Hashes',
        description: 'Get piece hashes for a torrent',
        method: 'GET',
        endpoint: '/torrents/pieceHashes',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-add',
        name: 'Add Torrent',
        description: 'Add new torrent (URL or file)',
        method: 'POST',
        endpoint: '/torrents/add',
        implemented: false,
        category: 'Torrents',
        parameters: [
          { name: 'urls', type: 'string', required: false, description: 'Torrent URLs (newline separated)' },
          { name: 'savepath', type: 'string', required: false, description: 'Save path' },
          { name: 'category', type: 'string', required: false, description: 'Category' },
          { name: 'paused', type: 'boolean', required: false, description: 'Add paused' },
        ],
      },
      {
        id: 'torrent-pause',
        name: 'Pause Torrent',
        description: 'Pause one or more torrents',
        method: 'POST',
        endpoint: '/torrents/pause',
        implemented: false,
        category: 'Torrents',
        parameters: [
          { name: 'hashes', type: 'string', required: true, description: 'Torrent hashes (| separated, or "all")' },
        ],
      },
      {
        id: 'torrent-resume',
        name: 'Resume Torrent',
        description: 'Resume one or more torrents',
        method: 'POST',
        endpoint: '/torrents/resume',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-delete',
        name: 'Delete Torrent',
        description: 'Delete one or more torrents',
        method: 'POST',
        endpoint: '/torrents/delete',
        implemented: false,
        category: 'Torrents',
        parameters: [
          { name: 'hashes', type: 'string', required: true, description: 'Torrent hashes' },
          { name: 'deleteFiles', type: 'boolean', required: false, description: 'Also delete files' },
        ],
      },
      {
        id: 'torrent-recheck',
        name: 'Recheck Torrent',
        description: 'Recheck torrent data',
        method: 'POST',
        endpoint: '/torrents/recheck',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-reannounce',
        name: 'Reannounce Torrent',
        description: 'Reannounce to trackers',
        method: 'POST',
        endpoint: '/torrents/reannounce',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-set-location',
        name: 'Set Torrent Location',
        description: 'Set torrent save location',
        method: 'POST',
        endpoint: '/torrents/setLocation',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-rename',
        name: 'Rename Torrent',
        description: 'Rename a torrent',
        method: 'POST',
        endpoint: '/torrents/rename',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-set-category',
        name: 'Set Torrent Category',
        description: 'Set category for torrents',
        method: 'POST',
        endpoint: '/torrents/setCategory',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-add-tags',
        name: 'Add Torrent Tags',
        description: 'Add tags to torrents',
        method: 'POST',
        endpoint: '/torrents/addTags',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-remove-tags',
        name: 'Remove Torrent Tags',
        description: 'Remove tags from torrents',
        method: 'POST',
        endpoint: '/torrents/removeTags',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-top-priority',
        name: 'Set Top Priority',
        description: 'Set torrents to top queue priority',
        method: 'POST',
        endpoint: '/torrents/topPrio',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-bottom-priority',
        name: 'Set Bottom Priority',
        description: 'Set torrents to bottom queue priority',
        method: 'POST',
        endpoint: '/torrents/bottomPrio',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-set-download-limit',
        name: 'Set Torrent Download Limit',
        description: 'Set download speed limit for torrents',
        method: 'POST',
        endpoint: '/torrents/setDownloadLimit',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-set-upload-limit',
        name: 'Set Torrent Upload Limit',
        description: 'Set upload speed limit for torrents',
        method: 'POST',
        endpoint: '/torrents/setUploadLimit',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-toggle-sequential',
        name: 'Toggle Sequential Download',
        description: 'Toggle sequential download mode',
        method: 'POST',
        endpoint: '/torrents/toggleSequentialDownload',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-toggle-first-last',
        name: 'Toggle First/Last Piece Priority',
        description: 'Toggle first/last piece priority',
        method: 'POST',
        endpoint: '/torrents/toggleFirstLastPiecePrio',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-set-force-start',
        name: 'Set Force Start',
        description: 'Set force start mode for torrents',
        method: 'POST',
        endpoint: '/torrents/setForceStart',
        implemented: false,
        category: 'Torrents',
      },
      {
        id: 'torrent-set-super-seeding',
        name: 'Set Super Seeding',
        description: 'Set super seeding mode for torrents',
        method: 'POST',
        endpoint: '/torrents/setSuperSeeding',
        implemented: false,
        category: 'Torrents',
      },

      // Categories - Implemented
      {
        id: 'categories-list',
        name: 'List Categories',
        description: 'Get all categories',
        method: 'GET',
        endpoint: '/torrents/categories',
        implemented: true,
        category: 'Categories',
      },
      {
        id: 'category-create',
        name: 'Create Category',
        description: 'Create a new category',
        method: 'POST',
        endpoint: '/torrents/createCategory',
        implemented: false,
        category: 'Categories',
        parameters: [
          { name: 'category', type: 'string', required: true, description: 'Category name' },
          { name: 'savePath', type: 'string', required: false, description: 'Save path' },
        ],
      },
      {
        id: 'category-edit',
        name: 'Edit Category',
        description: 'Edit an existing category',
        method: 'POST',
        endpoint: '/torrents/editCategory',
        implemented: false,
        category: 'Categories',
      },
      {
        id: 'category-remove',
        name: 'Remove Categories',
        description: 'Remove categories',
        method: 'POST',
        endpoint: '/torrents/removeCategories',
        implemented: false,
        category: 'Categories',
      },

      // Tags
      {
        id: 'tags-list',
        name: 'List Tags',
        description: 'Get all tags',
        method: 'GET',
        endpoint: '/torrents/tags',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-create',
        name: 'Create Tags',
        description: 'Create new tags',
        method: 'POST',
        endpoint: '/torrents/createTags',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-delete',
        name: 'Delete Tags',
        description: 'Delete tags',
        method: 'POST',
        endpoint: '/torrents/deleteTags',
        implemented: false,
        category: 'Tags',
      },

      // RSS
      {
        id: 'rss-items',
        name: 'Get RSS Items',
        description: 'Get all RSS items',
        method: 'GET',
        endpoint: '/rss/items',
        implemented: false,
        category: 'RSS',
      },
      {
        id: 'rss-add-folder',
        name: 'Add RSS Folder',
        description: 'Add RSS folder',
        method: 'POST',
        endpoint: '/rss/addFolder',
        implemented: false,
        category: 'RSS',
      },
      {
        id: 'rss-add-feed',
        name: 'Add RSS Feed',
        description: 'Add RSS feed',
        method: 'POST',
        endpoint: '/rss/addFeed',
        implemented: false,
        category: 'RSS',
      },
      {
        id: 'rss-rules',
        name: 'Get RSS Rules',
        description: 'Get auto-download rules',
        method: 'GET',
        endpoint: '/rss/rules',
        implemented: false,
        category: 'RSS',
      },
      {
        id: 'rss-set-rule',
        name: 'Set RSS Rule',
        description: 'Set auto-download rule',
        method: 'POST',
        endpoint: '/rss/setRule',
        implemented: false,
        category: 'RSS',
      },

      // Search
      {
        id: 'search-start',
        name: 'Start Search',
        description: 'Start a torrent search',
        method: 'POST',
        endpoint: '/search/start',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'pattern', type: 'string', required: true, description: 'Search pattern' },
          { name: 'plugins', type: 'string', required: true, description: 'Search plugins (all or specific)' },
          { name: 'category', type: 'string', required: true, description: 'Category filter' },
        ],
      },
      {
        id: 'search-status',
        name: 'Get Search Status',
        description: 'Get search job status',
        method: 'GET',
        endpoint: '/search/status',
        implemented: false,
        category: 'Search',
      },
      {
        id: 'search-results',
        name: 'Get Search Results',
        description: 'Get search results',
        method: 'GET',
        endpoint: '/search/results',
        implemented: false,
        category: 'Search',
      },
      {
        id: 'search-plugins',
        name: 'Get Search Plugins',
        description: 'Get installed search plugins',
        method: 'GET',
        endpoint: '/search/plugins',
        implemented: false,
        category: 'Search',
      },

      // Log
      {
        id: 'log-main',
        name: 'Get Main Log',
        description: 'Get main log entries',
        method: 'GET',
        endpoint: '/log/main',
        implemented: false,
        category: 'Logs',
        parameters: [
          { name: 'normal', type: 'boolean', required: false, description: 'Include normal messages' },
          { name: 'info', type: 'boolean', required: false, description: 'Include info messages' },
          { name: 'warning', type: 'boolean', required: false, description: 'Include warnings' },
          { name: 'critical', type: 'boolean', required: false, description: 'Include critical messages' },
        ],
      },
      {
        id: 'log-peers',
        name: 'Get Peer Log',
        description: 'Get peer log entries',
        method: 'GET',
        endpoint: '/log/peers',
        implemented: false,
        category: 'Logs',
      },

      // Sync
      {
        id: 'sync-maindata',
        name: 'Get Main Data',
        description: 'Get sync main data (all info)',
        method: 'GET',
        endpoint: '/sync/maindata',
        implemented: false,
        category: 'Sync',
      },
      {
        id: 'sync-torrent-peers',
        name: 'Get Torrent Peers',
        description: 'Get torrent peers sync data',
        method: 'GET',
        endpoint: '/sync/torrentPeers',
        implemented: false,
        category: 'Sync',
      },
    ];
  }
}
