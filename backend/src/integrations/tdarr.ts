import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  TdarrConfig,
  TdarrStatus,
  TdarrQueueStats,
  TdarrNode,
  TdarrWorker,
  TdarrLibraryStats,
} from '../types';
import { logger } from '../services/logger';

export class TdarrIntegration extends BaseIntegration {
  readonly type = 'tdarr';
  readonly name = 'Tdarr';

  private createClient(config: TdarrConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 8265}/api/v2`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    return axios.create({
      baseURL,
      headers,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const tdarrConfig = config as TdarrConfig;

    if (!tdarrConfig.host) {
      return { success: false, message: 'Host is required' };
    }

    try {
      const client = this.createClient(tdarrConfig);

      // Try to get status
      const statusResponse = await client.get('/status');
      const status = statusResponse.data;

      return {
        success: true,
        message: `Connected to Tdarr`,
        details: {
          version: status.version || 'Unknown',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('tdarr', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            message: 'Authentication failed: Invalid or missing API key',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused - is Tdarr running on ${tdarrConfig.host}:${tdarrConfig.port || 8265}?`,
          };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
          return {
            success: false,
            message: `Cannot reach host ${tdarrConfig.host}`,
          };
        }
      }

      return { success: false, message: errorMsg };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Tdarr server status and version',
        widgetTypes: ['tdarr-status'],
      },
      {
        id: 'queue',
        name: 'Queue Stats',
        description: 'Transcoding queue statistics',
        widgetTypes: ['tdarr-queue'],
      },
      {
        id: 'nodes',
        name: 'Node Status',
        description: 'Connected nodes and their status',
        widgetTypes: ['tdarr-nodes'],
      },
      {
        id: 'workers',
        name: 'Active Workers',
        description: 'Currently active transcoding workers',
        widgetTypes: ['tdarr-workers'],
      },
      {
        id: 'stats',
        name: 'Library Stats',
        description: 'Library statistics and space saved',
        widgetTypes: ['tdarr-stats'],
      },
    ];
  }

  async getData(
    config: IntegrationConfig,
    metric: string
  ): Promise<IntegrationData> {
    const tdarrConfig = config as TdarrConfig;
    const client = this.createClient(tdarrConfig);

    try {
      switch (metric) {
        case 'status':
          return await this.getStatus(client);
        case 'queue':
          return await this.getQueueStats(client);
        case 'nodes':
          return await this.getNodes(client);
        case 'workers':
          return await this.getWorkers(client);
        case 'stats':
          return await this.getLibraryStats(client);
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('tdarr', `Failed to fetch ${metric}`, { error: errorMsg });
      throw error;
    }
  }

  private async getStatus(client: AxiosInstance): Promise<{ status: TdarrStatus }> {
    // Get basic status
    const statusResponse = await client.get('/status');

    // Get statistics from cruddb
    const statsResponse = await client.post('/cruddb', {
      data: {
        collection: 'StatisticsJSONDB',
        mode: 'getById',
        docID: 'statistics',
      },
    });

    const stats = statsResponse.data || {};

    const status: TdarrStatus = {
      version: statusResponse.data?.version || 'Unknown',
      uptime: statusResponse.data?.uptime || 0, // Tdarr returns uptime in seconds
      totalFileCount: stats.totalFileCount || 0,
      totalTranscodeCount: stats.totalTranscodeCount || 0,
      totalHealthCheckCount: stats.totalHealthCheckCount || 0,
      sizeDiff: stats.sizeDiff || 0,
    };

    return { status };
  }

  private async getQueueStats(client: AxiosInstance): Promise<{ queue: TdarrQueueStats }> {
    // Get statistics
    const statsResponse = await client.post('/cruddb', {
      data: {
        collection: 'StatisticsJSONDB',
        mode: 'getById',
        docID: 'statistics',
      },
    });

    const stats = statsResponse.data || {};
    const tdarrScore = stats.tdarrScore || {};
    const pies = stats.pies || {};

    const queue: TdarrQueueStats = {
      totalQueued: (tdarrScore.transcodeQueue || 0) + (tdarrScore.healthCheckQueue || 0),
      totalProcessing: stats.totalProcessing || 0,
      totalErrored: pies.transcodeStatus?.Error || 0,
      totalCompleted: stats.totalTranscodeCount || 0,
      transcodeQueue: tdarrScore.transcodeQueue || 0,
      healthCheckQueue: tdarrScore.healthCheckQueue || 0,
    };

    return { queue };
  }

  private async getNodes(client: AxiosInstance): Promise<{ nodes: TdarrNode[] }> {
    const response = await client.get('/get-nodes');
    const nodesData = response.data || {};

    const nodes: TdarrNode[] = Object.entries(nodesData).map(([id, nodeData]: [string, unknown]) => {
      const node = nodeData as Record<string, unknown>;
      const workers = (node.workers || {}) as Record<string, unknown>;

      return {
        _id: id,
        nodeName: (node.nodeName as string) || id,
        nodePaused: (node.nodePaused as boolean) || false,
        workers: Object.entries(workers).map(([workerId, workerData]: [string, unknown]) => {
          const worker = workerData as Record<string, unknown>;
          const job = worker.job as Record<string, unknown> | undefined;
          const jobType = job?.type as string | undefined;
          return {
            id: workerId,
            file: (worker.file as string) || '',
            status: (worker.idle ? 'idle' : jobType === 'transcode' ? 'transcoding' : 'health_check') as 'idle' | 'transcoding' | 'health_check',
            percentage: (worker.percentage as number) || 0,
            ETA: (worker.ETA as string) || '',
            workerType: (jobType as 'transcode' | 'health_check') || 'transcode',
            mode: (worker.workerType as 'cpu' | 'gpu') || 'cpu',
          };
        }),
        resources: {
          cpuPercent: (node.cpuPercent as number) || 0,
          memPercent: (node.memPercent as number) || 0,
          gpuPercent: node.gpuPercent as number | undefined,
        },
      };
    });

    return { nodes };
  }

  private async getWorkers(client: AxiosInstance): Promise<{ workers: TdarrWorker[] }> {
    const response = await client.get('/get-nodes');
    const nodesData = response.data || {};

    const workers: TdarrWorker[] = [];

    Object.entries(nodesData).forEach(([_nodeId, nodeData]: [string, unknown]) => {
      const node = nodeData as Record<string, unknown>;
      const nodeWorkers = (node.workers || {}) as Record<string, unknown>;

      Object.entries(nodeWorkers).forEach(([workerId, workerData]: [string, unknown]) => {
        const worker = workerData as Record<string, unknown>;
        const job = worker.job as Record<string, unknown> | undefined;

        // Only include active workers (not idle)
        if (!worker.idle && job) {
          workers.push({
            id: workerId,
            file: (job.file as string) || (worker.file as string) || '',
            status: job.type === 'transcode' ? 'transcoding' : 'health_check',
            percentage: (worker.percentage as number) || 0,
            ETA: (worker.ETA as string) || '',
            workerType: (job.type as 'transcode' | 'health_check') || 'transcode',
            mode: (worker.workerType as 'cpu' | 'gpu') || 'cpu',
          });
        }
      });
    });

    return { workers };
  }

  private async getLibraryStats(client: AxiosInstance): Promise<{ stats: TdarrLibraryStats }> {
    const statsResponse = await client.post('/cruddb', {
      data: {
        collection: 'StatisticsJSONDB',
        mode: 'getById',
        docID: 'statistics',
      },
    });

    const data = statsResponse.data || {};
    const pies = data.pies || {};

    // Calculate space saved percentage
    const totalSize = data.totalFileSize || 0;
    const sizeDiff = data.sizeDiff || 0;
    const originalSize = totalSize + Math.abs(sizeDiff);
    const spaceSavedPercent = originalSize > 0 ? (Math.abs(sizeDiff) / originalSize) * 100 : 0;

    const stats: TdarrLibraryStats = {
      totalFiles: data.totalFileCount || 0,
      totalSize: totalSize,
      spaceSaved: Math.abs(sizeDiff),
      spaceSavedPercent: Math.round(spaceSavedPercent * 10) / 10,
      codecBreakdown: pies.videoCodec || {},
      containerBreakdown: pies.container || {},
      resolutionBreakdown: pies.resolution || {},
    };

    return { stats };
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Server Status - Implemented
      {
        id: 'status',
        name: 'Get Status',
        description: 'Returns status of server including version and uptime',
        method: 'GET',
        endpoint: '/status',
        implemented: true,
        category: 'Server',
        documentationUrl: 'https://docs.tdarr.io/docs/api',
      },
      {
        id: 'get-time-now',
        name: 'Get Current Time',
        description: 'Returns the current time from the server',
        method: 'POST',
        endpoint: '/get-time-now',
        implemented: false,
        category: 'Server',
      },

      // Database Operations - Implemented
      {
        id: 'cruddb',
        name: 'CRUD Database',
        description: 'Interact with database (insert, getById, getAll, update, removeOne, removeAll)',
        method: 'POST',
        endpoint: '/cruddb',
        implemented: true,
        category: 'Database',
        parameters: [
          { name: 'collection', type: 'string', required: true, description: 'Database collection name' },
          { name: 'mode', type: 'string', required: true, description: 'Operation mode (insert, getById, getAll, update, removeOne, removeAll)' },
          { name: 'docID', type: 'string', required: false, description: 'Document ID for getById/update/removeOne' },
          { name: 'data', type: 'object', required: false, description: 'Data for insert/update operations' },
        ],
      },
      {
        id: 'search-db',
        name: 'Search Database',
        description: 'Returns array of files matching search criteria',
        method: 'POST',
        endpoint: '/search-db',
        implemented: false,
        category: 'Database',
        parameters: [
          { name: 'data', type: 'object', required: true, description: 'Search criteria' },
        ],
      },
      {
        id: 'get-db-statuses',
        name: 'Get Database Statuses',
        description: 'Returns the statuses of all databases',
        method: 'POST',
        endpoint: '/get-db-statuses',
        implemented: false,
        category: 'Database',
      },

      // Nodes - Implemented
      {
        id: 'get-nodes',
        name: 'Get Nodes',
        description: 'Returns all connected nodes and their workers',
        method: 'GET',
        endpoint: '/get-nodes',
        implemented: true,
        category: 'Nodes',
      },
      {
        id: 'update-node',
        name: 'Update Node',
        description: 'Updates node configuration',
        method: 'POST',
        endpoint: '/update-node',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'nodeID', type: 'string', required: true, description: 'Node ID' },
          { name: 'data', type: 'object', required: true, description: 'Node configuration data' },
        ],
      },
      {
        id: 'restart-node',
        name: 'Restart Node',
        description: 'Restarts a node',
        method: 'POST',
        endpoint: '/restart-node',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'nodeID', type: 'string', required: true, description: 'Node ID' },
        ],
      },
      {
        id: 'disconnect-node',
        name: 'Disconnect Node',
        description: 'Disconnects a node',
        method: 'POST',
        endpoint: '/disconnect-node',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'nodeID', type: 'string', required: true, description: 'Node ID' },
        ],
      },
      {
        id: 'get-node-log',
        name: 'Get Node Log',
        description: 'Retrieves logs from a specific node',
        method: 'POST',
        endpoint: '/get-node-log',
        implemented: false,
        category: 'Nodes',
        parameters: [
          { name: 'nodeID', type: 'string', required: true, description: 'Node ID' },
        ],
      },

      // Workers
      {
        id: 'cancel-worker-item',
        name: 'Cancel Worker Item',
        description: 'Cancels an item being processed by a worker',
        method: 'POST',
        endpoint: '/cancel-worker-item',
        implemented: false,
        category: 'Workers',
        parameters: [
          { name: 'workerID', type: 'string', required: true, description: 'Worker ID' },
          { name: 'nodeID', type: 'string', required: true, description: 'Node ID' },
        ],
      },
      {
        id: 'kill-worker',
        name: 'Kill Worker',
        description: 'Terminates a worker process',
        method: 'POST',
        endpoint: '/kill-worker',
        implemented: false,
        category: 'Workers',
        parameters: [
          { name: 'workerID', type: 'string', required: true, description: 'Worker ID' },
          { name: 'nodeID', type: 'string', required: true, description: 'Node ID' },
        ],
      },
      {
        id: 'alter-worker-limit',
        name: 'Alter Worker Limit',
        description: 'Modifies worker limits for a node',
        method: 'POST',
        endpoint: '/alter-worker-limit',
        implemented: false,
        category: 'Workers',
        parameters: [
          { name: 'nodeID', type: 'string', required: true, description: 'Node ID' },
          { name: 'workerType', type: 'string', required: true, description: 'Worker type (transcode/healthcheck)' },
          { name: 'mode', type: 'string', required: true, description: 'cpu or gpu' },
          { name: 'limit', type: 'number', required: true, description: 'New limit value' },
        ],
      },
      {
        id: 'poll-worker-limits',
        name: 'Poll Worker Limits',
        description: 'Polls current worker limits',
        method: 'POST',
        endpoint: '/poll-worker-limits',
        implemented: false,
        category: 'Workers',
      },

      // File Operations
      {
        id: 'scan-individual-file',
        name: 'Scan Individual File',
        description: 'Scans a specific file',
        method: 'POST',
        endpoint: '/scan-individual-file',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'filePath', type: 'string', required: true, description: 'Path to the file' },
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
        ],
      },
      {
        id: 'scan-files',
        name: 'Scan Files',
        description: 'Scans files in a library',
        method: 'POST',
        endpoint: '/scan-files',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
        ],
      },
      {
        id: 'delete-file',
        name: 'Delete File',
        description: 'Deletes a file from the library',
        method: 'POST',
        endpoint: '/delete-file',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
        ],
      },
      {
        id: 'delete-unhealthy-files',
        name: 'Delete Unhealthy Files',
        description: 'Deletes unhealthy files from a table',
        method: 'POST',
        endpoint: '/delete-unhealthy-files',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
        ],
      },
      {
        id: 'create-sample',
        name: 'Create Sample',
        description: 'Creates a sample file for testing',
        method: 'POST',
        endpoint: '/create-sample',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
        ],
      },
      {
        id: 'read-job-file',
        name: 'Read Job File',
        description: 'Reads job file content',
        method: 'POST',
        endpoint: '/read-job-file',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'jobId', type: 'string', required: true, description: 'Job ID' },
        ],
      },

      // File Scanner
      {
        id: 'get-filescanner-status',
        name: 'Get File Scanner Status',
        description: 'Gets the status of the file scanner for a given database',
        method: 'POST',
        endpoint: '/get-filescanner-status',
        implemented: false,
        category: 'Scanner',
        parameters: [
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
        ],
      },
      {
        id: 'kill-file-scanner',
        name: 'Kill File Scanner',
        description: 'Terminates the file scanner',
        method: 'POST',
        endpoint: '/kill-file-scanner',
        implemented: false,
        category: 'Scanner',
        parameters: [
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
        ],
      },

      // Libraries
      {
        id: 'remove-library-files',
        name: 'Remove Library Files',
        description: 'Removes files from a library',
        method: 'POST',
        endpoint: '/remove-library-files',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
        ],
      },
      {
        id: 'set-all-status',
        name: 'Set All Status',
        description: 'Sets all status values for a library',
        method: 'POST',
        endpoint: '/set-all-status',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
          { name: 'status', type: 'string', required: true, description: 'Status value' },
        ],
      },
      {
        id: 'toggle-folder-watch',
        name: 'Toggle Folder Watch',
        description: 'Toggles folder watching for a library',
        method: 'POST',
        endpoint: '/toggle-folder-watch',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
          { name: 'enabled', type: 'boolean', required: true, description: 'Enable/disable watching' },
        ],
      },
      {
        id: 'toggle-schedule',
        name: 'Toggle Schedule',
        description: 'Toggles scheduling for a library',
        method: 'POST',
        endpoint: '/toggle-schedule',
        implemented: false,
        category: 'Libraries',
        parameters: [
          { name: 'libraryId', type: 'string', required: true, description: 'Library ID' },
          { name: 'enabled', type: 'boolean', required: true, description: 'Enable/disable scheduling' },
        ],
      },

      // Plugins
      {
        id: 'search-plugins',
        name: 'Search Plugins',
        description: 'Returns array of plugins matching search criteria',
        method: 'POST',
        endpoint: '/search-plugins',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'query', type: 'string', required: false, description: 'Search query' },
        ],
      },
      {
        id: 'search-flow-plugins',
        name: 'Search Flow Plugins',
        description: 'Searches for flow plugins',
        method: 'POST',
        endpoint: '/search-flow-plugins',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'query', type: 'string', required: false, description: 'Search query' },
        ],
      },
      {
        id: 'search-flow-templates',
        name: 'Search Flow Templates',
        description: 'Searches for flow templates',
        method: 'POST',
        endpoint: '/search-flow-templates',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'query', type: 'string', required: false, description: 'Search query' },
        ],
      },
      {
        id: 'delete-plugin',
        name: 'Delete Plugin',
        description: 'Deletes a plugin',
        method: 'POST',
        endpoint: '/delete-plugin',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
        ],
      },
      {
        id: 'copy-community-to-local',
        name: 'Copy Community to Local',
        description: 'Copies a plugin from the community to the local machine',
        method: 'POST',
        endpoint: '/copy-community-to-local',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
        ],
      },
      {
        id: 'read-plugin-text',
        name: 'Read Plugin Text',
        description: 'Reads the text of a plugin',
        method: 'POST',
        endpoint: '/read-plugin-text',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
        ],
      },
      {
        id: 'save-plugin-text',
        name: 'Save Plugin Text',
        description: 'Saves the text of a plugin',
        method: 'POST',
        endpoint: '/save-plugin-text',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
          { name: 'text', type: 'string', required: true, description: 'Plugin text content' },
        ],
      },
      {
        id: 'create-plugin',
        name: 'Create Plugin',
        description: 'Creates a new plugin',
        method: 'POST',
        endpoint: '/create-plugin',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginName', type: 'string', required: true, description: 'Plugin name' },
          { name: 'pluginType', type: 'string', required: true, description: 'Plugin type' },
        ],
      },
      {
        id: 'verify-plugin',
        name: 'Verify Plugin',
        description: 'Verifies a plugin',
        method: 'POST',
        endpoint: '/verify-plugin',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
        ],
      },
      {
        id: 'read-plugin',
        name: 'Read Plugin',
        description: 'Reads plugin information',
        method: 'POST',
        endpoint: '/read-plugin',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
        ],
      },
      {
        id: 'update-plugins',
        name: 'Update Plugins',
        description: 'Updates plugins',
        method: 'POST',
        endpoint: '/update-plugins',
        implemented: false,
        category: 'Plugins',
      },
      {
        id: 'download-plugins',
        name: 'Download Plugins',
        description: 'Downloads plugins from the community',
        method: 'GET',
        endpoint: '/download-plugins',
        implemented: false,
        category: 'Plugins',
      },
      {
        id: 'sync-plugins',
        name: 'Sync Plugins',
        description: 'Synchronizes plugins with the community',
        method: 'POST',
        endpoint: '/sync-plugins',
        implemented: false,
        category: 'Plugins',
      },
      {
        id: 'add-plugin-include',
        name: 'Add Plugin Include',
        description: 'Adds plugin to include list',
        method: 'POST',
        endpoint: '/add-plugin-include',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
        ],
      },
      {
        id: 'update-plugin-include',
        name: 'Update Plugin Include',
        description: 'Updates the plugin include status of a file',
        method: 'POST',
        endpoint: '/update-plugin-include',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
        ],
      },
      {
        id: 'remove-plugin-include',
        name: 'Remove Plugin Include',
        description: 'Removes the plugin include status of a file',
        method: 'POST',
        endpoint: '/remove-plugin-include',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'pluginId', type: 'string', required: true, description: 'Plugin ID' },
        ],
      },

      // Codec Exclusions
      {
        id: 'add-video-codec-exclude',
        name: 'Add Video Codec Exclude',
        description: 'Adds video codec to exclusion list',
        method: 'POST',
        endpoint: '/add-video-codec-exclude',
        implemented: false,
        category: 'Codecs',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'codec', type: 'string', required: true, description: 'Codec name' },
        ],
      },
      {
        id: 'update-video-codec-exclude',
        name: 'Update Video Codec Exclude',
        description: 'Updates video codec exclusion',
        method: 'POST',
        endpoint: '/update-video-codec-exclude',
        implemented: false,
        category: 'Codecs',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'codec', type: 'string', required: true, description: 'Codec name' },
        ],
      },
      {
        id: 'remove-video-codec-exclude',
        name: 'Remove Video Codec Exclude',
        description: 'Removes video codec from exclusion',
        method: 'POST',
        endpoint: '/remove-video-codec-exclude',
        implemented: false,
        category: 'Codecs',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'codec', type: 'string', required: true, description: 'Codec name' },
        ],
      },
      {
        id: 'add-audio-codec-exclude',
        name: 'Add Audio Codec Exclude',
        description: 'Adds audio codec to exclusion list',
        method: 'POST',
        endpoint: '/add-audio-codec-exclude',
        implemented: false,
        category: 'Codecs',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'codec', type: 'string', required: true, description: 'Codec name' },
        ],
      },
      {
        id: 'update-audio-codec-exclude',
        name: 'Update Audio Codec Exclude',
        description: 'Updates the audio codec exclude status of a file',
        method: 'POST',
        endpoint: '/update-audio-codec-exclude',
        implemented: false,
        category: 'Codecs',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'codec', type: 'string', required: true, description: 'Codec name' },
        ],
      },
      {
        id: 'remove-audio-codec-exclude',
        name: 'Remove Audio Codec Exclude',
        description: 'Removes the audio codec exclude status of a file',
        method: 'POST',
        endpoint: '/remove-audio-codec-exclude',
        implemented: false,
        category: 'Codecs',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'codec', type: 'string', required: true, description: 'Codec name' },
        ],
      },

      // Schedule
      {
        id: 'update-schedule-block',
        name: 'Update Schedule Block',
        description: 'Updates the schedule block status of a file',
        method: 'POST',
        endpoint: '/update-schedule-block',
        implemented: false,
        category: 'Schedule',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'blocked', type: 'boolean', required: true, description: 'Block status' },
        ],
      },

      // Backup
      {
        id: 'get-backup-status',
        name: 'Get Backup Status',
        description: 'Get the current backup status',
        method: 'POST',
        endpoint: '/get-backup-status',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'get-backups',
        name: 'Get Backups',
        description: 'Get list of available backups',
        method: 'POST',
        endpoint: '/get-backups',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'create-backup',
        name: 'Create Backup',
        description: 'Creates a backup file',
        method: 'POST',
        endpoint: '/create-backup',
        implemented: false,
        category: 'Backup',
      },
      {
        id: 'delete-backup',
        name: 'Delete Backup',
        description: 'Deletes a backup file',
        method: 'POST',
        endpoint: '/delete-backup',
        implemented: false,
        category: 'Backup',
        parameters: [
          { name: 'backupId', type: 'string', required: true, description: 'Backup ID' },
        ],
      },
      {
        id: 'reset-backup-status',
        name: 'Reset Backup Status',
        description: 'Resets the backup status of the server',
        method: 'POST',
        endpoint: '/reset-backup-status',
        implemented: false,
        category: 'Backup',
      },

      // Cache
      {
        id: 'delete-cache-file',
        name: 'Delete Cache File',
        description: 'Deletes a cache file',
        method: 'POST',
        endpoint: '/delete-cache-file',
        implemented: false,
        category: 'Cache',
        parameters: [
          { name: 'cacheId', type: 'string', required: true, description: 'Cache file ID' },
        ],
      },

      // Folder Operations
      {
        id: 'verify-folder-exists',
        name: 'Verify Folder Exists',
        description: 'Verifies whether a folder exists',
        method: 'POST',
        endpoint: '/verify-folder-exists',
        implemented: false,
        category: 'Folders',
        parameters: [
          { name: 'folderPath', type: 'string', required: true, description: 'Folder path' },
        ],
      },
      {
        id: 'get-subdirectories',
        name: 'Get Subdirectories',
        description: 'Returns a list of subdirectories of a given folder',
        method: 'POST',
        endpoint: '/get-subdirectories',
        implemented: false,
        category: 'Folders',
        parameters: [
          { name: 'folderPath', type: 'string', required: true, description: 'Folder path' },
        ],
      },

      // Resources
      {
        id: 'get-res-stats',
        name: 'Get Resource Stats',
        description: 'Returns statistics about the resources on the server',
        method: 'POST',
        endpoint: '/get-res-stats',
        implemented: false,
        category: 'Resources',
      },
      {
        id: 'performance-stats',
        name: 'Get Performance Stats',
        description: 'Retrieves performance statistics',
        method: 'POST',
        endpoint: '/performance-stats',
        implemented: false,
        category: 'Resources',
      },

      // Commands
      {
        id: 'run-help-command',
        name: 'Run Help Command',
        description: 'Runs an FFmpeg/HandBrake command',
        method: 'POST',
        endpoint: '/run-help-command',
        implemented: false,
        category: 'Commands',
        parameters: [
          { name: 'command', type: 'string', required: true, description: 'Command to run' },
        ],
      },

      // User Decisions
      {
        id: 'transcode-user-verdict',
        name: 'Transcode User Verdict',
        description: 'Records user transcode decision',
        method: 'POST',
        endpoint: '/transcode-user-verdict',
        implemented: false,
        category: 'Transcode',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
          { name: 'verdict', type: 'string', required: true, description: 'User verdict' },
        ],
      },
      {
        id: 'item-proc-end',
        name: 'Item Processing End',
        description: 'Marks item processing as complete',
        method: 'POST',
        endpoint: '/item-proc-end',
        implemented: false,
        category: 'Transcode',
        parameters: [
          { name: 'fileId', type: 'string', required: true, description: 'File ID' },
        ],
      },

      // Reports
      {
        id: 'list-footprintId-reports',
        name: 'List Footprint Reports',
        description: 'Lists fingerprint reports',
        method: 'POST',
        endpoint: '/list-footprintId-reports',
        implemented: false,
        category: 'Reports',
      },

      // Logs
      {
        id: 'get-server-log',
        name: 'Get Server Log',
        description: 'Retrieves server logs',
        method: 'GET',
        endpoint: '/get-server-log',
        implemented: false,
        category: 'Logs',
      },

      // Client
      {
        id: 'client',
        name: 'Client Endpoint',
        description: 'Client endpoint for different client types',
        method: 'POST',
        endpoint: '/client/{clientType}',
        implemented: false,
        category: 'Client',
        parameters: [
          { name: 'clientType', type: 'string', required: true, description: 'Client type' },
        ],
      },
    ];
  }
}
