import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  ImmichConfig,
  ImmichServerInfo,
  ImmichStorageInfo,
  ImmichStatistics,
  ImmichAllJobs,
  ImmichAlbum,
  ImmichAsset,
} from '../types';
import { logger } from '../services/logger';

export class ImmichIntegration extends BaseIntegration {
  readonly type = 'immich';
  readonly name = 'Immich';

  private createClient(config: ImmichConfig): AxiosInstance {
    // Use HTTP by default (most self-hosted setups), HTTPS only if verifySSL is explicitly true
    const protocol = config.verifySSL === true ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port}/api`;

    return axios.create({
      baseURL,
      headers: {
        'x-api-key': config.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const immichConfig = config as ImmichConfig;

    if (!immichConfig.host || !immichConfig.apiKey) {
      return { success: false, message: 'Host and API key are required' };
    }

    try {
      const client = this.createClient(immichConfig);

      // Test with server about endpoint
      const aboutResponse = await client.get('/server/about');
      const serverInfo = aboutResponse.data as ImmichServerInfo;

      // Try to get statistics (may fail if not admin)
      let photoCount = 0;
      let videoCount = 0;
      try {
        const statsResponse = await client.get('/server/statistics');
        const stats = statsResponse.data as ImmichStatistics;
        photoCount = stats.photos;
        videoCount = stats.videos;
      } catch {
        // Statistics endpoint requires admin - that's ok
      }

      return {
        success: true,
        message: `Connected to Immich v${serverInfo.version}`,
        details: {
          version: serverInfo.version,
          photos: photoCount,
          videos: videoCount,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('immich', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return { success: false, message: 'Invalid API key' };
        }
        if (error.response?.status === 403) {
          return { success: false, message: 'API key lacks required permissions' };
        }
        if (error.code === 'ECONNREFUSED') {
          return { success: false, message: 'Connection refused - check host and port' };
        }
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const immichConfig = config as ImmichConfig;

    switch (metric) {
      case 'server-info':
        return this.getServerInfo(immichConfig);
      case 'statistics':
        return this.getStatistics(immichConfig);
      case 'jobs':
        return this.getJobs(immichConfig);
      case 'albums':
        return this.getAlbums(immichConfig);
      case 'recent':
        return this.getRecentAssets(immichConfig);
      default:
        return this.getServerInfo(immichConfig);
    }
  }

  private async getServerInfo(config: ImmichConfig): Promise<IntegrationData> {
    try {
      const client = this.createClient(config);

      // Get server about info
      const aboutResponse = await client.get('/server/about');
      const serverInfo = aboutResponse.data as ImmichServerInfo;

      // Get storage info
      let storageInfo: ImmichStorageInfo | null = null;
      try {
        const storageResponse = await client.get('/server/storage');
        storageInfo = storageResponse.data as ImmichStorageInfo;
      } catch {
        // Storage endpoint may not be available
      }

      // Check for updates
      let updateAvailable = false;
      let latestVersion: string | null = null;
      try {
        const versionResponse = await client.get('/server/version-check');
        const versionData = versionResponse.data;
        updateAvailable = versionData.isNewVersionAvailable || false;
        latestVersion = versionData.latestVersion || null;
      } catch {
        // Version check may fail
      }

      return {
        serverInfo,
        storageInfo,
        updateAvailable,
        latestVersion,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('immich', 'Failed to get server info', { error: errorMsg });
      throw new Error(`Failed to get Immich server info: ${errorMsg}`);
    }
  }

  private async getStatistics(config: ImmichConfig): Promise<IntegrationData> {
    try {
      const client = this.createClient(config);

      const response = await client.get('/server/statistics');
      const stats = response.data as ImmichStatistics;

      return {
        photos: stats.photos,
        videos: stats.videos,
        usage: stats.usage,
        usageFormatted: this.formatBytes(stats.usage),
        usageByUser: stats.usageByUser?.map(user => ({
          ...user,
          usageFormatted: this.formatBytes(user.usage),
          quotaFormatted: user.quotaSizeInBytes ? this.formatBytes(user.quotaSizeInBytes) : null,
          quotaPercentage: user.quotaSizeInBytes ? Math.round((user.usage / user.quotaSizeInBytes) * 100) : null,
        })) || [],
        totalUsers: stats.usageByUser?.length || 0,
        totalAssets: stats.photos + stats.videos,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('immich', 'Failed to get statistics', { error: errorMsg });

      if (axios.isAxiosError(error) && error.response?.status === 403) {
        throw new Error('Statistics require admin permissions');
      }

      throw new Error(`Failed to get Immich statistics: ${errorMsg}`);
    }
  }

  private async getJobs(config: ImmichConfig): Promise<IntegrationData> {
    try {
      const client = this.createClient(config);

      const response = await client.get('/jobs');
      const jobs = response.data as ImmichAllJobs;

      // Calculate totals
      let totalActive = 0;
      let totalWaiting = 0;
      let totalFailed = 0;

      const jobList = Object.entries(jobs).map(([name, status]) => {
        totalActive += status.jobCounts.active;
        totalWaiting += status.jobCounts.waiting;
        totalFailed += status.jobCounts.failed;

        return {
          name: this.formatJobName(name),
          key: name,
          ...status.jobCounts,
          isActive: status.queueStatus.isActive,
          isPaused: status.queueStatus.isPaused,
        };
      });

      return {
        jobs: jobList,
        totalActive,
        totalWaiting,
        totalFailed,
        totalJobs: jobList.length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('immich', 'Failed to get jobs', { error: errorMsg });

      if (axios.isAxiosError(error) && error.response?.status === 403) {
        throw new Error('Jobs status requires admin permissions');
      }

      throw new Error(`Failed to get Immich jobs: ${errorMsg}`);
    }
  }

  private async getAlbums(config: ImmichConfig): Promise<IntegrationData> {
    try {
      const client = this.createClient(config);

      const response = await client.get('/albums');
      const albums = response.data as ImmichAlbum[];

      // Sort by updated date, most recent first
      albums.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const sharedCount = albums.filter(a => a.shared).length;
      const totalAssets = albums.reduce((sum, a) => sum + a.assetCount, 0);

      return {
        albums: albums.map(album => ({
          ...album,
          thumbnailUrl: album.albumThumbnailAssetId
            ? `/api/integrations/immich/thumbnail/${album.albumThumbnailAssetId}`
            : null,
        })),
        total: albums.length,
        sharedCount,
        totalAssets,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('immich', 'Failed to get albums', { error: errorMsg });
      throw new Error(`Failed to get Immich albums: ${errorMsg}`);
    }
  }

  private async getRecentAssets(config: ImmichConfig): Promise<IntegrationData> {
    try {
      const client = this.createClient(config);

      // Use search/metadata endpoint with POST request for recent assets
      const response = await client.post('/search/metadata', {
        take: 24,
        order: 'desc',
        orderDirection: 'desc',
        isArchived: false,
        isTrashed: false,
        withExif: false,
        withPeople: false,
        withStacked: false,
      });

      // The response has assets in the assets.items array
      const searchResult = response.data as { assets: { items: ImmichAsset[]; total: number } };
      const assets = searchResult.assets?.items || [];

      const photos = assets.filter(a => a.type === 'IMAGE').length;
      const videos = assets.filter(a => a.type === 'VIDEO').length;

      return {
        assets: assets.map(asset => ({
          id: asset.id,
          type: asset.type,
          originalFileName: asset.originalFileName,
          fileCreatedAt: asset.fileCreatedAt,
          isFavorite: asset.isFavorite,
          duration: asset.duration,
          thumbhash: asset.thumbhash,
        })),
        total: assets.length,
        photos,
        videos,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('immich', 'Failed to get recent assets', { error: errorMsg });
      throw new Error(`Failed to get Immich recent assets: ${errorMsg}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatJobName(name: string): string {
    // Convert camelCase to Title Case with spaces
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'server-info',
        name: 'Server Info',
        description: 'Server version, storage, and update status',
        widgetTypes: ['immich-server-info'],
      },
      {
        id: 'statistics',
        name: 'Statistics',
        description: 'Photo/video counts and storage usage',
        widgetTypes: ['immich-statistics'],
      },
      {
        id: 'jobs',
        name: 'Jobs',
        description: 'Background job queue status',
        widgetTypes: ['immich-jobs'],
      },
      {
        id: 'albums',
        name: 'Albums',
        description: 'Album list with counts',
        widgetTypes: ['immich-albums'],
      },
      {
        id: 'recent',
        name: 'Recent Uploads',
        description: 'Recently added photos and videos',
        widgetTypes: ['immich-recent'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication - Not Implemented
      {
        id: 'auth-login',
        name: 'Login',
        description: 'Authenticate user with email and password',
        method: 'POST',
        endpoint: '/auth/login',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'email', type: 'string', required: true },
          { name: 'password', type: 'string', required: true },
        ],
        documentationUrl: 'https://api.immich.app/',
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
      {
        id: 'auth-change-password',
        name: 'Change Password',
        description: 'Change user password',
        method: 'POST',
        endpoint: '/auth/change-password',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-status',
        name: 'Get Auth Status',
        description: 'Retrieve current authentication status',
        method: 'GET',
        endpoint: '/auth/status',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'auth-validate-token',
        name: 'Validate Access Token',
        description: 'Validate the current access token',
        method: 'POST',
        endpoint: '/auth/validateToken',
        implemented: false,
        category: 'Authentication',
      },

      // Server - Implemented
      {
        id: 'server-about',
        name: 'Get Server About',
        description: 'Get server version and build information',
        method: 'GET',
        endpoint: '/server/about',
        implemented: true,
        category: 'Server',
        documentationUrl: 'https://api.immich.app/',
      },
      {
        id: 'server-storage',
        name: 'Get Server Storage',
        description: 'Get storage usage statistics',
        method: 'GET',
        endpoint: '/server/storage',
        implemented: true,
        category: 'Server',
      },
      {
        id: 'server-statistics',
        name: 'Get Server Statistics',
        description: 'Get photo/video counts and user statistics (admin only)',
        method: 'GET',
        endpoint: '/server/statistics',
        implemented: true,
        category: 'Server',
      },
      {
        id: 'server-version-check',
        name: 'Check Server Version',
        description: 'Check if a new version is available',
        method: 'GET',
        endpoint: '/server/version-check',
        implemented: true,
        category: 'Server',
      },
      {
        id: 'server-config',
        name: 'Get Server Config',
        description: 'Get public server configuration',
        method: 'GET',
        endpoint: '/server/config',
        implemented: false,
        category: 'Server',
      },
      {
        id: 'server-features',
        name: 'Get Server Features',
        description: 'Get enabled server features',
        method: 'GET',
        endpoint: '/server/features',
        implemented: false,
        category: 'Server',
      },
      {
        id: 'server-ping',
        name: 'Ping Server',
        description: 'Check if server is reachable',
        method: 'GET',
        endpoint: '/server/ping',
        implemented: false,
        category: 'Server',
      },

      // Assets - Partially Implemented
      {
        id: 'assets-upload',
        name: 'Upload Asset',
        description: 'Upload a photo or video',
        method: 'POST',
        endpoint: '/assets',
        implemented: false,
        category: 'Assets',
        parameters: [
          { name: 'assetData', type: 'file', required: true, description: 'The asset file to upload' },
          { name: 'deviceAssetId', type: 'string', required: true },
          { name: 'deviceId', type: 'string', required: true },
          { name: 'fileCreatedAt', type: 'string', required: true },
          { name: 'fileModifiedAt', type: 'string', required: true },
        ],
      },
      {
        id: 'assets-get',
        name: 'Get Asset',
        description: 'Retrieve a single asset by ID',
        method: 'GET',
        endpoint: '/assets/{id}',
        implemented: false,
        category: 'Assets',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Asset ID' },
        ],
      },
      {
        id: 'assets-update',
        name: 'Update Asset',
        description: 'Update asset metadata',
        method: 'PUT',
        endpoint: '/assets/{id}',
        implemented: false,
        category: 'Assets',
      },
      {
        id: 'assets-delete',
        name: 'Delete Assets',
        description: 'Delete one or more assets',
        method: 'DELETE',
        endpoint: '/assets',
        implemented: false,
        category: 'Assets',
        parameters: [
          { name: 'ids', type: 'array', required: true, description: 'Array of asset IDs to delete' },
        ],
      },
      {
        id: 'assets-thumbnail',
        name: 'Get Asset Thumbnail',
        description: 'Get the thumbnail image for an asset',
        method: 'GET',
        endpoint: '/assets/{id}/thumbnail',
        implemented: false,
        category: 'Assets',
      },
      {
        id: 'assets-original',
        name: 'Download Original Asset',
        description: 'Download the original asset file',
        method: 'GET',
        endpoint: '/assets/{id}/original',
        implemented: false,
        category: 'Assets',
      },
      {
        id: 'assets-video-playback',
        name: 'Play Asset Video',
        description: 'Stream video playback for an asset',
        method: 'GET',
        endpoint: '/assets/{id}/video/playback',
        implemented: false,
        category: 'Assets',
      },
      {
        id: 'assets-by-device',
        name: 'Get Assets by Device',
        description: 'Retrieve assets uploaded from a specific device',
        method: 'GET',
        endpoint: '/assets/device/{deviceId}',
        implemented: false,
        category: 'Assets',
      },
      {
        id: 'assets-exist',
        name: 'Check Assets Exist',
        description: 'Check if assets already exist on server',
        method: 'POST',
        endpoint: '/assets/exist',
        implemented: false,
        category: 'Assets',
      },
      {
        id: 'assets-random',
        name: 'Get Random Assets',
        description: 'Get random assets from the library',
        method: 'GET',
        endpoint: '/assets/random',
        implemented: false,
        category: 'Assets',
      },
      {
        id: 'assets-statistics',
        name: 'Get Asset Statistics',
        description: 'Get statistics about assets',
        method: 'GET',
        endpoint: '/assets/statistics',
        implemented: false,
        category: 'Assets',
      },
      {
        id: 'assets-jobs',
        name: 'Run Asset Jobs',
        description: 'Trigger processing jobs on assets',
        method: 'POST',
        endpoint: '/assets/jobs',
        implemented: false,
        category: 'Assets',
      },

      // Albums - Implemented
      {
        id: 'albums-list',
        name: 'List Albums',
        description: 'Get all albums',
        method: 'GET',
        endpoint: '/albums',
        implemented: true,
        category: 'Albums',
      },
      {
        id: 'albums-create',
        name: 'Create Album',
        description: 'Create a new album',
        method: 'POST',
        endpoint: '/albums',
        implemented: false,
        category: 'Albums',
        parameters: [
          { name: 'albumName', type: 'string', required: true },
          { name: 'description', type: 'string', required: false },
          { name: 'assetIds', type: 'array', required: false },
        ],
      },
      {
        id: 'albums-get',
        name: 'Get Album',
        description: 'Retrieve a single album',
        method: 'GET',
        endpoint: '/albums/{id}',
        implemented: false,
        category: 'Albums',
      },
      {
        id: 'albums-update',
        name: 'Update Album',
        description: 'Update album details',
        method: 'PATCH',
        endpoint: '/albums/{id}',
        implemented: false,
        category: 'Albums',
      },
      {
        id: 'albums-delete',
        name: 'Delete Album',
        description: 'Delete an album',
        method: 'DELETE',
        endpoint: '/albums/{id}',
        implemented: false,
        category: 'Albums',
      },
      {
        id: 'albums-add-assets',
        name: 'Add Assets to Album',
        description: 'Add assets to an existing album',
        method: 'PUT',
        endpoint: '/albums/{id}/assets',
        implemented: false,
        category: 'Albums',
      },
      {
        id: 'albums-remove-assets',
        name: 'Remove Assets from Album',
        description: 'Remove assets from an album',
        method: 'DELETE',
        endpoint: '/albums/{id}/assets',
        implemented: false,
        category: 'Albums',
      },
      {
        id: 'albums-add-users',
        name: 'Share Album with Users',
        description: 'Add users to share an album with',
        method: 'PUT',
        endpoint: '/albums/{id}/users',
        implemented: false,
        category: 'Albums',
      },
      {
        id: 'albums-remove-user',
        name: 'Remove User from Album',
        description: 'Remove a user from a shared album',
        method: 'DELETE',
        endpoint: '/albums/{id}/user/{userId}',
        implemented: false,
        category: 'Albums',
      },
      {
        id: 'albums-statistics',
        name: 'Get Album Statistics',
        description: 'Retrieve album statistics',
        method: 'GET',
        endpoint: '/albums/statistics',
        implemented: false,
        category: 'Albums',
      },

      // Search - Implemented
      {
        id: 'search-metadata',
        name: 'Search by Metadata',
        description: 'Search assets using metadata filters',
        method: 'POST',
        endpoint: '/search/metadata',
        implemented: true,
        category: 'Search',
        parameters: [
          { name: 'take', type: 'number', required: false, description: 'Number of results to return' },
          { name: 'order', type: 'string', required: false },
          { name: 'isArchived', type: 'boolean', required: false },
          { name: 'isTrashed', type: 'boolean', required: false },
        ],
      },
      {
        id: 'search-smart',
        name: 'Smart Search',
        description: 'Search assets using CLIP embeddings (semantic search)',
        method: 'POST',
        endpoint: '/search/smart',
        implemented: false,
        category: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Natural language search query' },
        ],
      },
      {
        id: 'search-explore',
        name: 'Explore Search',
        description: 'Get suggested searches and categories',
        method: 'GET',
        endpoint: '/search/explore',
        implemented: false,
        category: 'Search',
      },
      {
        id: 'search-places',
        name: 'Search Places',
        description: 'Search for assets by location/place name',
        method: 'GET',
        endpoint: '/search/places',
        implemented: false,
        category: 'Search',
      },
      {
        id: 'search-suggestions',
        name: 'Get Search Suggestions',
        description: 'Get auto-complete suggestions for search',
        method: 'GET',
        endpoint: '/search/suggestions',
        implemented: false,
        category: 'Search',
      },

      // People & Faces - Not Implemented
      {
        id: 'people-list',
        name: 'List People',
        description: 'Get all recognized people',
        method: 'GET',
        endpoint: '/people',
        implemented: false,
        category: 'People',
      },
      {
        id: 'people-create',
        name: 'Create Person',
        description: 'Create a new person',
        method: 'POST',
        endpoint: '/people',
        implemented: false,
        category: 'People',
      },
      {
        id: 'people-get',
        name: 'Get Person',
        description: 'Get details for a specific person',
        method: 'GET',
        endpoint: '/people/{id}',
        implemented: false,
        category: 'People',
      },
      {
        id: 'people-delete',
        name: 'Delete Person',
        description: 'Delete a person',
        method: 'DELETE',
        endpoint: '/people/{id}',
        implemented: false,
        category: 'People',
      },
      {
        id: 'people-thumbnail',
        name: 'Get Person Thumbnail',
        description: 'Get the thumbnail for a person',
        method: 'GET',
        endpoint: '/people/{id}/thumbnail',
        implemented: false,
        category: 'People',
      },
      {
        id: 'people-merge',
        name: 'Merge People',
        description: 'Merge multiple people into one',
        method: 'POST',
        endpoint: '/people/{id}/merge',
        implemented: false,
        category: 'People',
      },
      {
        id: 'people-reassign',
        name: 'Reassign Faces',
        description: 'Reassign faces to a different person',
        method: 'PUT',
        endpoint: '/people/{id}/reassign',
        implemented: false,
        category: 'People',
      },
      {
        id: 'faces-list',
        name: 'List Faces',
        description: 'Get all detected faces for an asset',
        method: 'GET',
        endpoint: '/faces',
        implemented: false,
        category: 'People',
      },
      {
        id: 'faces-create',
        name: 'Create Face',
        description: 'Create a new face entry',
        method: 'POST',
        endpoint: '/faces',
        implemented: false,
        category: 'People',
      },
      {
        id: 'faces-update',
        name: 'Update Face',
        description: 'Reassign a face to another person',
        method: 'PUT',
        endpoint: '/faces/{id}',
        implemented: false,
        category: 'People',
      },

      // Libraries - Not Implemented
      {
        id: 'libraries-list',
        name: 'List Libraries',
        description: 'Get all external libraries',
        method: 'GET',
        endpoint: '/libraries',
        implemented: false,
        category: 'Libraries',
      },
      {
        id: 'libraries-create',
        name: 'Create Library',
        description: 'Create a new external library',
        method: 'POST',
        endpoint: '/libraries',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'name', type: 'string', required: true },
          { name: 'importPaths', type: 'array', required: true },
          { name: 'exclusionPatterns', type: 'array', required: false },
        ],
      },
      {
        id: 'libraries-get',
        name: 'Get Library',
        description: 'Retrieve a library',
        method: 'GET',
        endpoint: '/libraries/{id}',
        implemented: false,
        category: 'Libraries',
      },
      {
        id: 'libraries-update',
        name: 'Update Library',
        description: 'Update library settings',
        method: 'PUT',
        endpoint: '/libraries/{id}',
        implemented: false,
        category: 'Libraries',
      },
      {
        id: 'libraries-delete',
        name: 'Delete Library',
        description: 'Delete a library',
        method: 'DELETE',
        endpoint: '/libraries/{id}',
        implemented: false,
        category: 'Libraries',
      },
      {
        id: 'libraries-scan',
        name: 'Scan Library',
        description: 'Trigger a library scan for new files',
        method: 'POST',
        endpoint: '/libraries/{id}/scan',
        implemented: false,
        category: 'Libraries',
      },
      {
        id: 'libraries-validate',
        name: 'Validate Library',
        description: 'Validate library import paths',
        method: 'POST',
        endpoint: '/libraries/{id}/validate',
        implemented: false,
        category: 'Libraries',
      },
      {
        id: 'libraries-statistics',
        name: 'Get Library Statistics',
        description: 'Get statistics for a library',
        method: 'GET',
        endpoint: '/libraries/{id}/statistics',
        implemented: false,
        category: 'Libraries',
      },

      // Jobs - Implemented
      {
        id: 'jobs-list',
        name: 'List Jobs',
        description: 'Get all job queue statuses',
        method: 'GET',
        endpoint: '/jobs',
        implemented: true,
        category: 'Jobs',
      },
      {
        id: 'jobs-run',
        name: 'Run Job',
        description: 'Start or stop a specific job',
        method: 'PUT',
        endpoint: '/jobs/{name}',
        implemented: false,
        category: 'Jobs',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Job name (e.g., thumbnailGeneration, metadataExtraction)' },
          { name: 'command', type: 'string', required: true, description: 'start, pause, resume, or empty' },
        ],
      },

      // Users - Not Implemented
      {
        id: 'users-me',
        name: 'Get Current User',
        description: 'Get the currently authenticated user',
        method: 'GET',
        endpoint: '/users/me',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'users-list',
        name: 'List Users',
        description: 'Get all users (admin only)',
        method: 'GET',
        endpoint: '/users',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'users-get',
        name: 'Get User',
        description: 'Get a user by ID',
        method: 'GET',
        endpoint: '/users/{id}',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'users-create',
        name: 'Create User',
        description: 'Create a new user (admin only)',
        method: 'POST',
        endpoint: '/admin/users',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'users-update',
        name: 'Update User',
        description: 'Update user information',
        method: 'PUT',
        endpoint: '/users',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'users-delete',
        name: 'Delete User',
        description: 'Delete a user (admin only)',
        method: 'DELETE',
        endpoint: '/admin/users/{id}',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'users-profile-image',
        name: 'Get User Profile Image',
        description: 'Get user profile picture',
        method: 'GET',
        endpoint: '/users/{id}/profile-image',
        implemented: false,
        category: 'Users',
      },

      // API Keys - Not Implemented
      {
        id: 'api-keys-list',
        name: 'List API Keys',
        description: 'Get all API keys for current user',
        method: 'GET',
        endpoint: '/api-keys',
        implemented: false,
        category: 'API Keys',
      },
      {
        id: 'api-keys-create',
        name: 'Create API Key',
        description: 'Create a new API key',
        method: 'POST',
        endpoint: '/api-keys',
        implemented: false,
        category: 'API Keys',
        parameters: [
          { name: 'name', type: 'string', required: true },
          { name: 'permissions', type: 'array', required: false },
        ],
      },
      {
        id: 'api-keys-get',
        name: 'Get API Key',
        description: 'Retrieve an API key',
        method: 'GET',
        endpoint: '/api-keys/{id}',
        implemented: false,
        category: 'API Keys',
      },
      {
        id: 'api-keys-update',
        name: 'Update API Key',
        description: 'Update an API key',
        method: 'PUT',
        endpoint: '/api-keys/{id}',
        implemented: false,
        category: 'API Keys',
      },
      {
        id: 'api-keys-delete',
        name: 'Delete API Key',
        description: 'Delete an API key',
        method: 'DELETE',
        endpoint: '/api-keys/{id}',
        implemented: false,
        category: 'API Keys',
      },

      // Memories - Not Implemented
      {
        id: 'memories-list',
        name: 'List Memories',
        description: 'Get all memories (On This Day, etc.)',
        method: 'GET',
        endpoint: '/memories',
        implemented: false,
        category: 'Memories',
      },
      {
        id: 'memories-create',
        name: 'Create Memory',
        description: 'Create a new memory',
        method: 'POST',
        endpoint: '/memories',
        implemented: false,
        category: 'Memories',
      },
      {
        id: 'memories-get',
        name: 'Get Memory',
        description: 'Retrieve a memory',
        method: 'GET',
        endpoint: '/memories/{id}',
        implemented: false,
        category: 'Memories',
      },
      {
        id: 'memories-update',
        name: 'Update Memory',
        description: 'Update a memory',
        method: 'PUT',
        endpoint: '/memories/{id}',
        implemented: false,
        category: 'Memories',
      },
      {
        id: 'memories-delete',
        name: 'Delete Memory',
        description: 'Delete a memory',
        method: 'DELETE',
        endpoint: '/memories/{id}',
        implemented: false,
        category: 'Memories',
      },

      // Map - Not Implemented
      {
        id: 'map-markers',
        name: 'Get Map Markers',
        description: 'Get all assets with location data for map view',
        method: 'GET',
        endpoint: '/map/markers',
        implemented: false,
        category: 'Map',
      },
      {
        id: 'map-reverse-geocode',
        name: 'Reverse Geocode',
        description: 'Get location name from coordinates',
        method: 'GET',
        endpoint: '/map/reverse-geocode',
        implemented: false,
        category: 'Map',
        parameters: [
          { name: 'lat', type: 'number', required: true },
          { name: 'lon', type: 'number', required: true },
        ],
      },

      // Partners - Not Implemented
      {
        id: 'partners-list',
        name: 'List Partners',
        description: 'Get all partner sharing relationships',
        method: 'GET',
        endpoint: '/partners',
        implemented: false,
        category: 'Partners',
      },
      {
        id: 'partners-create',
        name: 'Create Partner',
        description: 'Create a partner sharing relationship',
        method: 'POST',
        endpoint: '/partners',
        implemented: false,
        category: 'Partners',
      },
      {
        id: 'partners-update',
        name: 'Update Partner',
        description: 'Update partner sharing settings',
        method: 'PUT',
        endpoint: '/partners/{id}',
        implemented: false,
        category: 'Partners',
      },
      {
        id: 'partners-remove',
        name: 'Remove Partner',
        description: 'Remove a partner sharing relationship',
        method: 'DELETE',
        endpoint: '/partners/{id}',
        implemented: false,
        category: 'Partners',
      },

      // Duplicates - Not Implemented
      {
        id: 'duplicates-list',
        name: 'List Duplicates',
        description: 'Get all detected duplicate assets',
        method: 'GET',
        endpoint: '/duplicates',
        implemented: false,
        category: 'Duplicates',
      },
      {
        id: 'duplicates-delete',
        name: 'Delete Duplicate',
        description: 'Delete a duplicate asset',
        method: 'DELETE',
        endpoint: '/duplicates/{id}',
        implemented: false,
        category: 'Duplicates',
      },

      // Download - Not Implemented
      {
        id: 'download-archive',
        name: 'Download Archive',
        description: 'Download multiple assets as a ZIP archive',
        method: 'POST',
        endpoint: '/download/archive',
        implemented: false,
        category: 'Download',
        parameters: [
          { name: 'assetIds', type: 'array', required: true },
        ],
      },
      {
        id: 'download-info',
        name: 'Get Download Info',
        description: 'Get information about a potential download',
        method: 'POST',
        endpoint: '/download/info',
        implemented: false,
        category: 'Download',
      },

      // Activities - Not Implemented
      {
        id: 'activities-list',
        name: 'List Activities',
        description: 'Get album activities (comments, likes)',
        method: 'GET',
        endpoint: '/activities',
        implemented: false,
        category: 'Activities',
      },
      {
        id: 'activities-create',
        name: 'Create Activity',
        description: 'Create a new activity (comment/like)',
        method: 'POST',
        endpoint: '/activities',
        implemented: false,
        category: 'Activities',
      },
      {
        id: 'activities-delete',
        name: 'Delete Activity',
        description: 'Delete an activity',
        method: 'DELETE',
        endpoint: '/activities/{id}',
        implemented: false,
        category: 'Activities',
      },

      // Shared Links - Not Implemented
      {
        id: 'shared-links-list',
        name: 'List Shared Links',
        description: 'Get all shared links',
        method: 'GET',
        endpoint: '/shared-links',
        implemented: false,
        category: 'Shared Links',
      },
      {
        id: 'shared-links-create',
        name: 'Create Shared Link',
        description: 'Create a new shared link',
        method: 'POST',
        endpoint: '/shared-links',
        implemented: false,
        category: 'Shared Links',
        parameters: [
          { name: 'assetIds', type: 'array', required: false },
          { name: 'albumId', type: 'string', required: false },
          { name: 'expiresAt', type: 'string', required: false },
          { name: 'allowDownload', type: 'boolean', required: false },
          { name: 'password', type: 'string', required: false },
        ],
      },
      {
        id: 'shared-links-get',
        name: 'Get Shared Link',
        description: 'Get a shared link by ID',
        method: 'GET',
        endpoint: '/shared-links/{id}',
        implemented: false,
        category: 'Shared Links',
      },
      {
        id: 'shared-links-update',
        name: 'Update Shared Link',
        description: 'Update a shared link',
        method: 'PATCH',
        endpoint: '/shared-links/{id}',
        implemented: false,
        category: 'Shared Links',
      },
      {
        id: 'shared-links-delete',
        name: 'Delete Shared Link',
        description: 'Delete a shared link',
        method: 'DELETE',
        endpoint: '/shared-links/{id}',
        implemented: false,
        category: 'Shared Links',
      },

      // Tags - Not Implemented
      {
        id: 'tags-list',
        name: 'List Tags',
        description: 'Get all tags',
        method: 'GET',
        endpoint: '/tags',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-create',
        name: 'Create Tag',
        description: 'Create a new tag',
        method: 'POST',
        endpoint: '/tags',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-get',
        name: 'Get Tag',
        description: 'Get a tag by ID',
        method: 'GET',
        endpoint: '/tags/{id}',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-update',
        name: 'Update Tag',
        description: 'Update a tag',
        method: 'PATCH',
        endpoint: '/tags/{id}',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-delete',
        name: 'Delete Tag',
        description: 'Delete a tag',
        method: 'DELETE',
        endpoint: '/tags/{id}',
        implemented: false,
        category: 'Tags',
      },
      {
        id: 'tags-assets',
        name: 'Tag Assets',
        description: 'Add or remove tags from assets',
        method: 'PUT',
        endpoint: '/tags/{id}/assets',
        implemented: false,
        category: 'Tags',
      },

      // Trash - Not Implemented
      {
        id: 'trash-empty',
        name: 'Empty Trash',
        description: 'Permanently delete all trashed assets',
        method: 'POST',
        endpoint: '/trash/empty',
        implemented: false,
        category: 'Trash',
      },
      {
        id: 'trash-restore',
        name: 'Restore from Trash',
        description: 'Restore assets from trash',
        method: 'POST',
        endpoint: '/trash/restore',
        implemented: false,
        category: 'Trash',
      },
      {
        id: 'trash-restore-all',
        name: 'Restore All from Trash',
        description: 'Restore all trashed assets',
        method: 'POST',
        endpoint: '/trash/restore/all',
        implemented: false,
        category: 'Trash',
      },

      // System Config (Admin) - Not Implemented
      {
        id: 'system-config-get',
        name: 'Get System Config',
        description: 'Get system configuration (admin only)',
        method: 'GET',
        endpoint: '/system-config',
        implemented: false,
        category: 'System Config',
      },
      {
        id: 'system-config-update',
        name: 'Update System Config',
        description: 'Update system configuration (admin only)',
        method: 'PUT',
        endpoint: '/system-config',
        implemented: false,
        category: 'System Config',
      },
      {
        id: 'system-config-defaults',
        name: 'Get Default Config',
        description: 'Get default system configuration',
        method: 'GET',
        endpoint: '/system-config/defaults',
        implemented: false,
        category: 'System Config',
      },

      // OAuth - Not Implemented
      {
        id: 'oauth-authorize',
        name: 'Start OAuth',
        description: 'Begin OAuth authentication flow',
        method: 'POST',
        endpoint: '/oauth/authorize',
        implemented: false,
        category: 'OAuth',
      },
      {
        id: 'oauth-callback',
        name: 'OAuth Callback',
        description: 'Complete OAuth authentication',
        method: 'POST',
        endpoint: '/oauth/callback',
        implemented: false,
        category: 'OAuth',
      },
      {
        id: 'oauth-link',
        name: 'Link OAuth Account',
        description: 'Link an OAuth provider to existing account',
        method: 'POST',
        endpoint: '/oauth/link',
        implemented: false,
        category: 'OAuth',
      },
      {
        id: 'oauth-unlink',
        name: 'Unlink OAuth Account',
        description: 'Remove OAuth provider from account',
        method: 'POST',
        endpoint: '/oauth/unlink',
        implemented: false,
        category: 'OAuth',
      },

      // Timeline - Not Implemented
      {
        id: 'timeline-buckets',
        name: 'Get Timeline Buckets',
        description: 'Get time-based buckets for timeline view',
        method: 'GET',
        endpoint: '/timeline/buckets',
        implemented: false,
        category: 'Timeline',
      },
      {
        id: 'timeline-bucket',
        name: 'Get Timeline Bucket',
        description: 'Get assets for a specific time bucket',
        method: 'GET',
        endpoint: '/timeline/bucket',
        implemented: false,
        category: 'Timeline',
      },

      // Audit - Not Implemented
      {
        id: 'audit-deletes',
        name: 'Get Audit Deletes',
        description: 'Get deleted asset audit log',
        method: 'GET',
        endpoint: '/audit/deletes',
        implemented: false,
        category: 'Audit',
      },
    ];
  }
}
