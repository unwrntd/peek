import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  SABnzbdConfig,
  SABnzbdQueue,
  SABnzbdQueueSlot,
  SABnzbdHistory,
  SABnzbdHistorySlot,
  SABnzbdStatus,
  SABnzbdServer,
  SABnzbdServerStats,
  SABnzbdWarning,
} from '../types';
import { logger } from '../services/logger';

export class SABnzbdIntegration extends BaseIntegration {
  readonly type = 'sabnzbd';
  readonly name = 'SABnzbd';

  private createClient(config: SABnzbdConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 8080}/api`;

    return axios.create({
      baseURL,
      params: {
        apikey: config.apiKey,
        output: 'json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const sabnzbdConfig = config as SABnzbdConfig;

    if (!sabnzbdConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!sabnzbdConfig.apiKey) {
      return { success: false, message: 'API key is required' };
    }

    try {
      const client = this.createClient(sabnzbdConfig);
      const [versionResponse, queueResponse] = await Promise.all([
        client.get('', { params: { mode: 'version' } }),
        client.get('', { params: { mode: 'queue', limit: 1 } }),
      ]);

      const version = versionResponse.data?.version || 'Unknown';
      const queueCount = queueResponse.data?.queue?.noofslots_total || 0;

      return {
        success: true,
        message: `Connected to SABnzbd v${version}`,
        details: {
          version,
          queueCount,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('sabnzbd', 'Connection test failed', { error: errorMsg });

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
            message: `Connection refused: Cannot reach ${sabnzbdConfig.host}:${sabnzbdConfig.port || 8080}`,
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
    const sabnzbdConfig = config as SABnzbdConfig;
    const client = this.createClient(sabnzbdConfig);

    switch (metric) {
      case 'queue':
        return this.getQueue(client);
      case 'history':
        return this.getHistory(client);
      case 'status':
        return this.getStatus(client);
      case 'server-stats':
        return this.getServerStats(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getQueue(client: AxiosInstance): Promise<{
    queue: SABnzbdQueue;
    slots: SABnzbdQueueSlot[];
  }> {
    try {
      const response = await client.get('', {
        params: { mode: 'queue' },
      });

      const queueData = response.data?.queue || {};
      const queue: SABnzbdQueue = {
        status: queueData.status || 'Idle',
        speedlimit: queueData.speedlimit || '0',
        speedlimit_abs: queueData.speedlimit_abs || '',
        paused: queueData.paused || false,
        pause_int: queueData.pause_int || '0',
        kbpersec: queueData.kbpersec || '0',
        speed: queueData.speed || '0',
        mbleft: queueData.mbleft || '0',
        mb: queueData.mb || '0',
        noofslots: queueData.noofslots || 0,
        noofslots_total: queueData.noofslots_total || 0,
        timeleft: queueData.timeleft || '0:00:00',
        eta: queueData.eta || 'unknown',
        diskspace1: queueData.diskspace1 || '0',
        diskspace2: queueData.diskspace2 || '0',
        diskspacetotal1: queueData.diskspacetotal1 || '0',
        diskspacetotal2: queueData.diskspacetotal2 || '0',
        slots: [],
      };

      const slots: SABnzbdQueueSlot[] = (queueData.slots || []).map((slot: Record<string, unknown>) => ({
        nzo_id: (slot.nzo_id as string) || '',
        filename: (slot.filename as string) || 'Unknown',
        status: (slot.status as string) || 'Unknown',
        mb: (slot.mb as string) || '0',
        mbleft: (slot.mbleft as string) || '0',
        percentage: (slot.percentage as string) || '0',
        timeleft: (slot.timeleft as string) || '0:00:00',
        eta: (slot.eta as string) || 'unknown',
        cat: (slot.cat as string) || '*',
        priority: (slot.priority as string) || 'Normal',
        avg_age: (slot.avg_age as string) || '0d',
      }));

      queue.slots = slots;

      return { queue, slots };
    } catch (error) {
      logger.error('sabnzbd', 'Failed to get queue', { error });
      throw error;
    }
  }

  private async getHistory(client: AxiosInstance): Promise<{
    history: SABnzbdHistory;
    slots: SABnzbdHistorySlot[];
  }> {
    try {
      const response = await client.get('', {
        params: { mode: 'history', limit: 50 },
      });

      const historyData = response.data?.history || {};
      const history: SABnzbdHistory = {
        noofslots: historyData.noofslots || 0,
        day_size: historyData.day_size || '0',
        week_size: historyData.week_size || '0',
        month_size: historyData.month_size || '0',
        total_size: historyData.total_size || '0',
        slots: [],
      };

      const slots: SABnzbdHistorySlot[] = (historyData.slots || []).map((slot: Record<string, unknown>) => ({
        nzo_id: (slot.nzo_id as string) || '',
        name: (slot.name as string) || 'Unknown',
        status: (slot.status as string) || 'Unknown',
        fail_message: (slot.fail_message as string) || '',
        bytes: (slot.bytes as number) || 0,
        size: (slot.size as string) || '0',
        category: (slot.category as string) || '*',
        completed: (slot.completed as number) || 0,
        download_time: (slot.download_time as number) || 0,
        postproc_time: (slot.postproc_time as number) || 0,
        stage_log: ((slot.stage_log as Array<{ name: string; actions: string[] }>) || []).map(log => ({
          name: log.name || '',
          actions: log.actions || [],
        })),
      }));

      history.slots = slots;

      return { history, slots };
    } catch (error) {
      logger.error('sabnzbd', 'Failed to get history', { error });
      throw error;
    }
  }

  private async getStatus(client: AxiosInstance): Promise<{
    status: SABnzbdStatus;
    warnings: SABnzbdWarning[];
    queue: SABnzbdQueue;
  }> {
    try {
      const [statusResponse, warningsResponse, queueResponse] = await Promise.all([
        client.get('', { params: { mode: 'fullstatus' } }),
        client.get('', { params: { mode: 'warnings' } }),
        client.get('', { params: { mode: 'queue' } }),
      ]);

      const statusData = statusResponse.data?.status || {};
      const queueData = queueResponse.data?.queue || {};

      const status: SABnzbdStatus = {
        version: statusData.version || 'Unknown',
        uptime: statusData.uptime || '0',
        color_scheme: statusData.color_scheme || '',
        helpuri: statusData.helpuri || '',
        pid: statusData.pid || 0,
        active_lang: statusData.active_lang || 'en',
        rtl: statusData.rtl || false,
        diskspace1: queueData.diskspace1 || statusData.diskspace1 || '0',
        diskspace2: queueData.diskspace2 || statusData.diskspace2 || '0',
        diskspacetotal1: queueData.diskspacetotal1 || statusData.diskspacetotal1 || '0',
        diskspacetotal2: queueData.diskspacetotal2 || statusData.diskspacetotal2 || '0',
        speedlimit: queueData.speedlimit || statusData.speedlimit || '0',
        speedlimit_abs: queueData.speedlimit_abs || statusData.speedlimit_abs || '',
        have_warnings: statusData.have_warnings || '0',
        finishaction: statusData.finishaction || null,
        quota: statusData.quota || '',
        left_quota: statusData.left_quota || '',
        paused: queueData.paused || statusData.paused || false,
        pause_int: queueData.pause_int || statusData.pause_int || '0',
        loadavg: statusData.loadavg || '',
        servers: ((statusData.servers as Array<Record<string, unknown>>) || []).map(server => ({
          servername: (server.servername as string) || 'Unknown',
          serveractive: (server.serveractive as boolean) || false,
          serveractiveconn: (server.serveractiveconn as number) || 0,
          servertotalconn: (server.servertotalconn as number) || 0,
          serverssl: (server.serverssl as boolean) || false,
          serveroptional: (server.serveroptional as boolean) || false,
          servererror: (server.servererror as string) || '',
        })),
      };

      const warnings: SABnzbdWarning[] = (warningsResponse.data?.warnings || []).map((warning: Record<string, unknown>) => ({
        type: (warning.type as string) || 'warning',
        text: (warning.text as string) || '',
        time: (warning.time as number) || 0,
      }));

      const queue: SABnzbdQueue = {
        status: queueData.status || 'Idle',
        speedlimit: queueData.speedlimit || '0',
        speedlimit_abs: queueData.speedlimit_abs || '',
        paused: queueData.paused || false,
        pause_int: queueData.pause_int || '0',
        kbpersec: queueData.kbpersec || '0',
        speed: queueData.speed || '0',
        mbleft: queueData.mbleft || '0',
        mb: queueData.mb || '0',
        noofslots: queueData.noofslots || 0,
        noofslots_total: queueData.noofslots_total || 0,
        timeleft: queueData.timeleft || '0:00:00',
        eta: queueData.eta || 'unknown',
        diskspace1: queueData.diskspace1 || '0',
        diskspace2: queueData.diskspace2 || '0',
        diskspacetotal1: queueData.diskspacetotal1 || '0',
        diskspacetotal2: queueData.diskspacetotal2 || '0',
        slots: [],
      };

      return { status, warnings, queue };
    } catch (error) {
      logger.error('sabnzbd', 'Failed to get status', { error });
      throw error;
    }
  }

  private async getServerStats(client: AxiosInstance): Promise<{
    stats: SABnzbdServerStats;
  }> {
    try {
      const response = await client.get('', {
        params: { mode: 'server_stats' },
      });

      const statsData = response.data || {};
      const stats: SABnzbdServerStats = {
        total: statsData.total || 0,
        month: statsData.month || 0,
        week: statsData.week || 0,
        day: statsData.day || 0,
        servers: {},
      };

      // Process server-specific stats
      if (statsData.servers && typeof statsData.servers === 'object') {
        for (const [serverName, serverData] of Object.entries(statsData.servers)) {
          const data = serverData as Record<string, unknown>;
          stats.servers[serverName] = {
            total: (data.total as number) || 0,
            month: (data.month as number) || 0,
            week: (data.week as number) || 0,
            day: (data.day as number) || 0,
            daily: (data.daily as Record<string, number>) || {},
            articles_tried: (data.articles_tried as number) || 0,
            articles_success: (data.articles_success as number) || 0,
          };
        }
      }

      return { stats };
    } catch (error) {
      logger.error('sabnzbd', 'Failed to get server stats', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'Server Status',
        description: 'Version, speed, disk space, pause status, warnings',
        widgetTypes: ['sabnzbd-status'],
      },
      {
        id: 'queue',
        name: 'Download Queue',
        description: 'Active downloads with progress, speed, ETA',
        widgetTypes: ['sabnzbd-queue'],
      },
      {
        id: 'history',
        name: 'History',
        description: 'Completed/failed downloads with size and time',
        widgetTypes: ['sabnzbd-history'],
      },
      {
        id: 'server-stats',
        name: 'Server Stats',
        description: 'Per-server download statistics',
        widgetTypes: ['sabnzbd-stats'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Queue Management - Partially Implemented
      {
        id: 'queue',
        name: 'Get Queue',
        description: 'Get current download queue with all job details, speeds, and progress',
        method: 'GET',
        endpoint: '?mode=queue',
        implemented: true,
        category: 'Queue',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Starting index for pagination' },
          { name: 'limit', type: 'number', required: false, description: 'Number of items to return' },
          { name: 'search', type: 'string', required: false, description: 'Filter by search term' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-pause',
        name: 'Pause Queue',
        description: 'Pause the entire download queue',
        method: 'GET',
        endpoint: '?mode=pause',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'number', required: false, description: 'Minutes to pause (omit for indefinite)' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-resume',
        name: 'Resume Queue',
        description: 'Resume downloading',
        method: 'GET',
        endpoint: '?mode=resume',
        implemented: false,
        category: 'Queue',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-delete',
        name: 'Delete from Queue',
        description: 'Remove jobs from the download queue',
        method: 'GET',
        endpoint: '?mode=queue&name=delete',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID(s) to delete (comma-separated)' },
          { name: 'del_files', type: 'number', required: false, description: 'Delete downloaded files (1)' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-purge',
        name: 'Purge Queue',
        description: 'Remove all items from the queue',
        method: 'GET',
        endpoint: '?mode=queue&name=purge',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'search', type: 'string', required: false, description: 'Filter items to purge' },
          { name: 'del_files', type: 'number', required: false, description: 'Delete downloaded files (1)' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-pause-item',
        name: 'Pause Queue Item',
        description: 'Pause a specific job in the queue',
        method: 'GET',
        endpoint: '?mode=queue&name=pause',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID to pause' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-resume-item',
        name: 'Resume Queue Item',
        description: 'Resume a specific paused job',
        method: 'GET',
        endpoint: '?mode=queue&name=resume',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID to resume' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-move',
        name: 'Move Queue Item',
        description: 'Reorder a job in the queue',
        method: 'GET',
        endpoint: '?mode=switch',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID to move' },
          { name: 'value2', type: 'number', required: true, description: 'New position index' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-sort',
        name: 'Sort Queue',
        description: 'Sort the queue by various criteria',
        method: 'GET',
        endpoint: '?mode=queue&name=sort',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'sort', type: 'string', required: true, description: 'Sort by: avg_age, name, remaining, size' },
          { name: 'dir', type: 'string', required: false, description: 'Direction: asc or desc' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-priority',
        name: 'Set Priority',
        description: 'Change job priority',
        method: 'GET',
        endpoint: '?mode=queue&name=priority',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID' },
          { name: 'value2', type: 'number', required: true, description: 'Priority: -3=Stop, -2=Paused, -1=Low, 0=Normal, 1=High, 2=Force' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-change-cat',
        name: 'Change Category',
        description: 'Change the category of a job',
        method: 'GET',
        endpoint: '?mode=change_cat',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID' },
          { name: 'value2', type: 'string', required: true, description: 'New category name' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-change-script',
        name: 'Change Script',
        description: 'Change the post-processing script of a job',
        method: 'GET',
        endpoint: '?mode=change_script',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID' },
          { name: 'value2', type: 'string', required: true, description: 'Script filename' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-change-opts',
        name: 'Change Post-Process Options',
        description: 'Change repair/unpack/delete options for a job',
        method: 'GET',
        endpoint: '?mode=change_opts',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID' },
          { name: 'value2', type: 'number', required: true, description: 'Options: 0=Skip, 1=Repair, 2=Repair+Unpack, 3=Repair+Unpack+Delete' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'queue-rename',
        name: 'Rename Job',
        description: 'Change the name of a queued job',
        method: 'GET',
        endpoint: '?mode=queue&name=rename',
        implemented: false,
        category: 'Queue',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID' },
          { name: 'value2', type: 'string', required: true, description: 'New name' },
          { name: 'value3', type: 'string', required: false, description: 'New password (if set)' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // Adding NZBs - Not Implemented
      {
        id: 'addurl',
        name: 'Add NZB by URL',
        description: 'Add an NZB file from a URL',
        method: 'GET',
        endpoint: '?mode=addurl',
        implemented: false,
        category: 'Add NZB',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'URL of the NZB file' },
          { name: 'nzbname', type: 'string', required: false, description: 'Custom name for the job' },
          { name: 'cat', type: 'string', required: false, description: 'Category' },
          { name: 'script', type: 'string', required: false, description: 'Post-processing script' },
          { name: 'priority', type: 'number', required: false, description: 'Priority level' },
          { name: 'pp', type: 'number', required: false, description: 'Post-processing options' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'addfile',
        name: 'Upload NZB File',
        description: 'Upload an NZB file directly',
        method: 'POST',
        endpoint: '?mode=addfile',
        implemented: false,
        category: 'Add NZB',
        parameters: [
          { name: 'name', type: 'file', required: true, description: 'NZB file (multipart/form-data)' },
          { name: 'nzbname', type: 'string', required: false, description: 'Custom name for the job' },
          { name: 'cat', type: 'string', required: false, description: 'Category' },
          { name: 'script', type: 'string', required: false, description: 'Post-processing script' },
          { name: 'priority', type: 'number', required: false, description: 'Priority level' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'addlocalfile',
        name: 'Add Local NZB',
        description: 'Add an NZB from the local filesystem',
        method: 'GET',
        endpoint: '?mode=addlocalfile',
        implemented: false,
        category: 'Add NZB',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Local file path (URL-encoded)' },
          { name: 'nzbname', type: 'string', required: false, description: 'Custom name for the job' },
          { name: 'cat', type: 'string', required: false, description: 'Category' },
          { name: 'script', type: 'string', required: false, description: 'Post-processing script' },
          { name: 'priority', type: 'number', required: false, description: 'Priority level' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // History - Implemented
      {
        id: 'history',
        name: 'Get History',
        description: 'Get download history with completed and failed jobs',
        method: 'GET',
        endpoint: '?mode=history',
        implemented: true,
        category: 'History',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Starting index' },
          { name: 'limit', type: 'number', required: false, description: 'Number of items (default 50)' },
          { name: 'search', type: 'string', required: false, description: 'Filter by search term' },
          { name: 'failed_only', type: 'number', required: false, description: 'Show only failed (1)' },
          { name: 'category', type: 'string', required: false, description: 'Filter by category' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'history-delete',
        name: 'Delete History Item',
        description: 'Delete items from history',
        method: 'GET',
        endpoint: '?mode=history&name=delete',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID(s) to delete, or "all", or "failed"' },
          { name: 'del_files', type: 'number', required: false, description: 'Delete files (1)' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'retry',
        name: 'Retry Failed',
        description: 'Retry a failed download',
        method: 'GET',
        endpoint: '?mode=retry',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID to retry' },
          { name: 'nzbfile', type: 'file', required: false, description: 'Replacement NZB file (POST)' },
          { name: 'password', type: 'string', required: false, description: 'Archive password' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'retry-all',
        name: 'Retry All Failed',
        description: 'Retry all failed downloads',
        method: 'GET',
        endpoint: '?mode=retry_all',
        implemented: false,
        category: 'History',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'mark-completed',
        name: 'Mark as Completed',
        description: 'Mark a failed job as completed',
        method: 'GET',
        endpoint: '?mode=history&name=mark_as_completed',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // Status & Info - Implemented
      {
        id: 'version',
        name: 'Get Version',
        description: 'Get SABnzbd version (no API key required)',
        method: 'GET',
        endpoint: '?mode=version',
        implemented: true,
        category: 'Status',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'fullstatus',
        name: 'Get Full Status',
        description: 'Get comprehensive system status including servers, disk space, and settings',
        method: 'GET',
        endpoint: '?mode=fullstatus',
        implemented: true,
        category: 'Status',
        parameters: [
          { name: 'skip_dashboard', type: 'number', required: false, description: 'Skip dashboard data (1)' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'warnings',
        name: 'Get Warnings',
        description: 'Get recent warning messages',
        method: 'GET',
        endpoint: '?mode=warnings',
        implemented: true,
        category: 'Status',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'server-stats',
        name: 'Get Server Stats',
        description: 'Get per-server download statistics',
        method: 'GET',
        endpoint: '?mode=server_stats',
        implemented: true,
        category: 'Status',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'auth',
        name: 'Get Auth Methods',
        description: 'Get available authentication methods (no API key required)',
        method: 'GET',
        endpoint: '?mode=auth',
        implemented: false,
        category: 'Status',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // Speed Control - Not Implemented
      {
        id: 'speedlimit',
        name: 'Set Speed Limit',
        description: 'Set download speed limit',
        method: 'GET',
        endpoint: '?mode=config&name=speedlimit',
        implemented: false,
        category: 'Speed Control',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'Speed in KB/s, MB/s, or percentage' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'speedlimit-get',
        name: 'Get Speed Limit',
        description: 'Get current speed limit setting',
        method: 'GET',
        endpoint: '?mode=config&name=speedlimit',
        implemented: false,
        category: 'Speed Control',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // System Control - Not Implemented
      {
        id: 'shutdown',
        name: 'Shutdown',
        description: 'Shutdown SABnzbd',
        method: 'GET',
        endpoint: '?mode=shutdown',
        implemented: false,
        category: 'System Control',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'restart',
        name: 'Restart',
        description: 'Restart SABnzbd',
        method: 'GET',
        endpoint: '?mode=restart',
        implemented: false,
        category: 'System Control',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'pause-postprocess',
        name: 'Pause Post-Processing',
        description: 'Pause post-processing queue',
        method: 'GET',
        endpoint: '?mode=pause_pp',
        implemented: false,
        category: 'System Control',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'resume-postprocess',
        name: 'Resume Post-Processing',
        description: 'Resume post-processing queue',
        method: 'GET',
        endpoint: '?mode=resume_pp',
        implemented: false,
        category: 'System Control',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'rss-now',
        name: 'Run RSS Now',
        description: 'Force RSS feed check',
        method: 'GET',
        endpoint: '?mode=rss_now',
        implemented: false,
        category: 'System Control',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'watched-now',
        name: 'Scan Watched Folder',
        description: 'Force scan of watched folder',
        method: 'GET',
        endpoint: '?mode=watched_now',
        implemented: false,
        category: 'System Control',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // Configuration - Not Implemented
      {
        id: 'get-config',
        name: 'Get Configuration',
        description: 'Get configuration settings',
        method: 'GET',
        endpoint: '?mode=get_config',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'section', type: 'string', required: false, description: 'Config section (misc, servers, categories, etc.)' },
          { name: 'keyword', type: 'string', required: false, description: 'Specific setting to retrieve' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'set-config',
        name: 'Set Configuration',
        description: 'Update configuration settings',
        method: 'GET',
        endpoint: '?mode=set_config',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'section', type: 'string', required: true, description: 'Config section' },
          { name: 'keyword', type: 'string', required: true, description: 'Setting name' },
          { name: 'value', type: 'string', required: true, description: 'New value' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'del-config',
        name: 'Delete Configuration',
        description: 'Delete configuration items',
        method: 'GET',
        endpoint: '?mode=del_config',
        implemented: false,
        category: 'Configuration',
        parameters: [
          { name: 'section', type: 'string', required: true, description: 'Config section' },
          { name: 'keyword', type: 'string', required: true, description: 'Setting name' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'get-cats',
        name: 'Get Categories',
        description: 'Get list of available categories',
        method: 'GET',
        endpoint: '?mode=get_cats',
        implemented: false,
        category: 'Configuration',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'get-scripts',
        name: 'Get Scripts',
        description: 'Get list of available post-processing scripts',
        method: 'GET',
        endpoint: '?mode=get_scripts',
        implemented: false,
        category: 'Configuration',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // Server Management - Not Implemented
      {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test connection to a news server',
        method: 'GET',
        endpoint: '?mode=config&name=test_server',
        implemented: false,
        category: 'Servers',
        parameters: [
          { name: 'host', type: 'string', required: true, description: 'Server hostname' },
          { name: 'port', type: 'number', required: true, description: 'Server port' },
          { name: 'username', type: 'string', required: false, description: 'Username' },
          { name: 'password', type: 'string', required: false, description: 'Password' },
          { name: 'ssl', type: 'number', required: false, description: 'Use SSL (0/1)' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'enable-server',
        name: 'Enable Server',
        description: 'Enable a news server',
        method: 'GET',
        endpoint: '?mode=config&name=set_server&value=1',
        implemented: false,
        category: 'Servers',
        parameters: [
          { name: 'server', type: 'string', required: true, description: 'Server name' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'disable-server',
        name: 'Disable Server',
        description: 'Disable a news server',
        method: 'GET',
        endpoint: '?mode=config&name=set_server&value=0',
        implemented: false,
        category: 'Servers',
        parameters: [
          { name: 'server', type: 'string', required: true, description: 'Server name' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // RSS - Not Implemented
      {
        id: 'rss-list',
        name: 'Get RSS Feeds',
        description: 'Get list of configured RSS feeds',
        method: 'GET',
        endpoint: '?mode=rss',
        implemented: false,
        category: 'RSS',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'rss-eval',
        name: 'Evaluate RSS Feed',
        description: 'Test RSS feed and show matching items',
        method: 'GET',
        endpoint: '?mode=eval_rss',
        implemented: false,
        category: 'RSS',
        parameters: [
          { name: 'feed', type: 'string', required: true, description: 'Feed name' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // File Management - Not Implemented
      {
        id: 'get-files',
        name: 'Get Job Files',
        description: 'Get list of files in a queued job',
        method: 'GET',
        endpoint: '?mode=get_files',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'NZO ID' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'change-complete-action',
        name: 'Set Completion Action',
        description: 'Set action to perform when queue completes',
        method: 'GET',
        endpoint: '?mode=change_complete_action',
        implemented: false,
        category: 'Files',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'Action: shutdown_pc, hibernate_pc, standby_pc, shutdown_program' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // Notifications - Not Implemented
      {
        id: 'clear-warnings',
        name: 'Clear Warnings',
        description: 'Clear all warning messages',
        method: 'GET',
        endpoint: '?mode=warnings&name=clear',
        implemented: false,
        category: 'Notifications',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },

      // Orphan Management - Not Implemented
      {
        id: 'get-orphaned',
        name: 'Get Orphaned Jobs',
        description: 'Get list of orphaned download folders',
        method: 'GET',
        endpoint: '?mode=status&name=orphaned_jobs',
        implemented: false,
        category: 'Maintenance',
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'delete-orphaned',
        name: 'Delete Orphaned',
        description: 'Delete orphaned download folders',
        method: 'GET',
        endpoint: '?mode=delete_orphaned',
        implemented: false,
        category: 'Maintenance',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'Folder name or "all"' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
      {
        id: 'add-orphaned',
        name: 'Add Orphaned to Queue',
        description: 'Re-add orphaned folder to queue',
        method: 'GET',
        endpoint: '?mode=retry_orphaned',
        implemented: false,
        category: 'Maintenance',
        parameters: [
          { name: 'value', type: 'string', required: true, description: 'Folder name' },
        ],
        documentationUrl: 'https://sabnzbd.org/wiki/configuration/4.5/api',
      },
    ];
  }
}
