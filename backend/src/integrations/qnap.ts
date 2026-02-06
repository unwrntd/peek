import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  QnapConfig,
  QnapSystemInfo,
  QnapSystemStats,
  QnapVolume,
  QnapDisk,
  QnapNetworkStats,
} from '../types';
import { logger } from '../services/logger';

// Session cache for QNAP authentication
interface CachedSession {
  authSid: string;
  expiresAt: number;
  uptime?: number; // System uptime in seconds from auth response
}

const sessionCache = new Map<string, CachedSession>();
const SESSION_TTL = 25 * 60 * 1000; // 25 minutes (sessions typically last 30 min)

export class QnapIntegration extends BaseIntegration {
  readonly type = 'qnap';
  readonly name = 'QNAP QTS';

  private xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  private getSessionCacheKey(config: QnapConfig): string {
    return `${config.host}:${config.port || 443}:${config.username}`;
  }

  private getCachedSession(config: QnapConfig): CachedSession | null {
    const key = this.getSessionCacheKey(config);
    const session = sessionCache.get(key);

    if (session && session.expiresAt > Date.now()) {
      logger.debug('qnap', 'Using cached session', { key });
      return session;
    }

    if (session) {
      sessionCache.delete(key);
    }
    return null;
  }

  private cacheSession(config: QnapConfig, authSid: string, uptime?: number): void {
    const key = this.getSessionCacheKey(config);
    sessionCache.set(key, {
      authSid,
      expiresAt: Date.now() + SESSION_TTL,
      uptime,
    });
    logger.debug('qnap', 'Cached session', { key });
  }

  private getCachedUptime(config: QnapConfig): number | undefined {
    const key = this.getSessionCacheKey(config);
    const session = sessionCache.get(key);
    return session?.uptime;
  }

  private clearSessionCache(config: QnapConfig): void {
    const key = this.getSessionCacheKey(config);
    sessionCache.delete(key);
  }

  private createClient(config: QnapConfig): AxiosInstance {
    const protocol = config.verifySSL ? 'https' : 'http';
    const baseURL = `${protocol}://${config.host}:${config.port || 8080}`;

    return axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
    });
  }

  private async authenticate(client: AxiosInstance, config: QnapConfig): Promise<string> {
    // Check cache first
    const cached = this.getCachedSession(config);
    if (cached) {
      return cached.authSid;
    }

    logger.debug('qnap', 'Authenticating with username/password');

    try {
      // QNAP uses Base64 encoded password
      const encodedPassword = Buffer.from(config.password).toString('base64');

      const response = await client.get('/cgi-bin/authLogin.cgi', {
        params: {
          user: config.username,
          pwd: encodedPassword,
          remme: 1,
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const authResult = parsed?.QDocRoot;

      if (authResult?.authPassed !== 1 && authResult?.authPassed !== '1') {
        throw new Error('Authentication failed: Invalid credentials');
      }

      const authSid = authResult?.authSid;
      if (!authSid) {
        throw new Error('Authentication failed: No session ID returned');
      }

      // Extract system uptime from auth response 'ts' field
      const uptime = authResult?.ts ? parseInt(String(authResult.ts), 10) : undefined;

      this.cacheSession(config, authSid, uptime);
      logger.debug('qnap', 'Authentication successful', { uptime });
      return authSid;
    } catch (error) {
      this.clearSessionCache(config);
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('qnap', 'Authentication failed', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const qnapConfig = config as QnapConfig;

    try {
      const client = this.createClient(qnapConfig);
      this.clearSessionCache(qnapConfig); // Fresh login for test
      const authSid = await this.authenticate(client, qnapConfig);

      // Fetch system info to verify connection
      const response = await client.get('/cgi-bin/management/manaRequest.cgi', {
        params: {
          subfunc: 'sysinfo',
          sysHealth: 1,
          sid: authSid,
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const sysInfo = parsed?.QDocRoot;

      return {
        success: true,
        message: `Connected to QNAP ${sysInfo?.model || 'NAS'}`,
        details: {
          hostname: sysInfo?.hostname,
          model: sysInfo?.model,
          firmware: sysInfo?.firmware?.version || sysInfo?.version,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('qnap', 'Connection test failed', { error: errorMsg });

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const qnapConfig = config as QnapConfig;
    const client = this.createClient(qnapConfig);
    const authSid = await this.authenticate(client, qnapConfig);

    switch (metric) {
      case 'system-info':
        return this.getSystemInfo(client, authSid, qnapConfig);
      case 'system-stats':
        return this.getSystemStats(client, authSid);
      case 'volumes':
        return this.getVolumes(client, authSid);
      case 'disks':
        return this.getDisks(client, authSid);
      case 'network':
        return this.getNetworkStats(client, authSid);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getSystemInfo(client: AxiosInstance, authSid: string, config: QnapConfig): Promise<{ systemInfo: QnapSystemInfo }> {
    const response = await client.get('/cgi-bin/management/manaRequest.cgi', {
      params: {
        subfunc: 'sysinfo',
        sysHealth: 1,
        sid: authSid,
      },
    });

    const parsed = this.xmlParser.parse(response.data);
    const info = parsed?.QDocRoot || {};

    // Extract model name - QNAP returns model as an object with modelName/displayModelName
    let modelName = 'Unknown';
    if (typeof info?.model === 'object' && info.model !== null) {
      modelName = info.model.displayModelName || info.model.modelName || 'Unknown';
    } else if (typeof info?.model === 'string') {
      modelName = info.model;
    } else if (info?.modelName) {
      modelName = info.modelName;
    }

    // Get uptime from cached auth response (QNAP returns uptime as 'ts' during login)
    const cachedUptime = this.getCachedUptime(config);

    const systemInfo: QnapSystemInfo = {
      hostname: info?.hostname || info?.serverName || 'Unknown',
      model: modelName,
      firmware: info?.firmware?.version || info?.version || 'Unknown',
      uptime: cachedUptime || this.parseUptime(info?.uptime) || 0,
      serialNumber: info?.serial || info?.serialNumber,
    };

    logger.debug('qnap', 'Fetched system info', { hostname: systemInfo.hostname, uptime: systemInfo.uptime });
    return { systemInfo };
  }

  private async getSystemStats(client: AxiosInstance, authSid: string): Promise<{ stats: QnapSystemStats }> {
    // Try multiple endpoints to get system stats
    let cpuUsage = 0;
    let totalMem = 0;
    let freeMem = 0;
    let cpuTemp: number | null = null;
    let sysTemp: number | null = null;

    // Try endpoint 1: sysinfo with multicpu flag (gethomepage approach)
    // The CPU/memory data is nested inside func.ownContent.root
    try {
      const sysInfoResponse = await client.get('/cgi-bin/management/manaRequest.cgi', {
        params: {
          subfunc: 'sysinfo',
          hd: 'no',
          multicpu: 1,
          sid: authSid,
        },
      });
      const sysInfoParsed = this.xmlParser.parse(sysInfoResponse.data);
      const sysInfo = sysInfoParsed?.QDocRoot || {};

      logger.debug('qnap', 'SysInfo response keys', { keys: Object.keys(sysInfo).slice(0, 40) });

      // The data is nested inside func.ownContent.root
      const funcData = sysInfo?.func?.ownContent?.root || sysInfo?.func?.ownContent || {};
      logger.debug('qnap', 'func.ownContent.root keys', { keys: Object.keys(funcData).slice(0, 40) });

      // Extract CPU usage - may have " %" suffix
      if (funcData?.cpu_usage !== undefined) {
        const cpuStr = String(funcData.cpu_usage).replace(/\s*%/g, '');
        cpuUsage = parseFloat(cpuStr) || 0;
        logger.debug('qnap', 'Found CPU usage in func.ownContent.root', { raw: funcData.cpu_usage, parsed: cpuUsage });
      }

      // Extract memory info - QNAP returns memory in MB
      if (funcData?.total_memory !== undefined) {
        const totalMB = parseFloat(String(funcData.total_memory)) || 0;
        const freeMB = parseFloat(String(funcData.free_memory || 0)) || 0;
        // Convert MB to bytes
        totalMem = totalMB * 1024 * 1024;
        freeMem = freeMB * 1024 * 1024;
        logger.debug('qnap', 'Found memory in func.ownContent.root', { totalMB, freeMB, totalBytes: totalMem, freeBytes: freeMem });
      }

      // Extract temperatures - sys_tempc is the system temperature
      if (funcData?.sys_tempc !== undefined) {
        sysTemp = this.parseTemp(funcData.sys_tempc);
      } else if (funcData?.sys_temp !== undefined) {
        sysTemp = this.parseTemp(funcData.sys_temp);
      }

      if (funcData?.cpu_tempc !== undefined) {
        cpuTemp = this.parseTemp(funcData.cpu_tempc);
      } else if (funcData?.cpu_temp !== undefined) {
        cpuTemp = this.parseTemp(funcData.cpu_temp);
      }
    } catch (e) {
      logger.debug('qnap', 'sysinfo request failed', { error: String(e) });
    }

    // Try endpoint 1b: /cgi-bin/sys/sysRequest.cgi with sys_status
    if (cpuUsage === 0 && totalMem === 0) {
      try {
        const sysStatusResponse = await client.get('/cgi-bin/sys/sysRequest.cgi', {
          params: {
            subfunc: 'sys_status',
            sid: authSid,
          },
        });
        const sysStatusParsed = this.xmlParser.parse(sysStatusResponse.data);
        const sysStatus = sysStatusParsed?.QDocRoot || {};

        logger.debug('qnap', 'sysRequest sys_status keys', { keys: Object.keys(sysStatus).slice(0, 40) });

        if (sysStatus?.cpu_usage !== undefined) {
          cpuUsage = parseFloat(sysStatus.cpu_usage) || 0;
        }
        if (sysStatus?.total_memory !== undefined) {
          totalMem = this.parseBytes(sysStatus.total_memory);
          freeMem = this.parseBytes(sysStatus.free_memory || 0);
        }
        if (cpuTemp === null) {
          cpuTemp = this.parseTemp(sysStatus.cpu_temp);
        }
        if (sysTemp === null) {
          sysTemp = this.parseTemp(sysStatus.sys_temp);
        }
      } catch (e) {
        logger.debug('qnap', 'sysRequest sys_status failed', { error: String(e) });
      }
    }

    // Try endpoint 1c: live data from utilization endpoint
    if (cpuUsage === 0 && totalMem === 0) {
      try {
        const utilResponse = await client.get('/cgi-bin/management/manaRequest.cgi', {
          params: {
            subfunc: 'utilization',
            sid: authSid,
          },
        });
        const utilParsed = this.xmlParser.parse(utilResponse.data);
        const utilData = utilParsed?.QDocRoot || {};

        logger.debug('qnap', 'manaRequest utilization keys', { keys: Object.keys(utilData).slice(0, 40) });

        if (utilData?.cpu_usage !== undefined || utilData?.cpu !== undefined) {
          cpuUsage = parseFloat(utilData.cpu_usage || utilData.cpu || 0) || 0;
        }
        if (utilData?.total_memory !== undefined) {
          totalMem = this.parseBytes(utilData.total_memory);
          freeMem = this.parseBytes(utilData.free_memory || 0);
        }
        if (utilData?.memory_usage !== undefined && totalMem === 0) {
          // Some endpoints return memory as percentage
          const memUsage = parseFloat(utilData.memory_usage);
          if (!isNaN(memUsage)) {
            // We'll set usagePercent directly later if we have this
          }
        }
      } catch (e) {
        logger.debug('qnap', 'manaRequest utilization failed', { error: String(e) });
      }
    }

    // Try endpoint 2: chartReq.cgi system_health
    if (cpuUsage === 0 && totalMem === 0) {
      try {
        const chartResponse = await client.get('/cgi-bin/management/chartReq.cgi', {
          params: {
            chart_func: 'sys_health',
            sid: authSid,
          },
        });
        const chartParsed = this.xmlParser.parse(chartResponse.data);
        const chartData = chartParsed?.QDocRoot || {};

        logger.debug('qnap', 'Chart health data keys', { keys: Object.keys(chartData).slice(0, 30) });

        // Extract CPU and memory from chart data
        if (chartData.cpu_usage !== undefined) {
          cpuUsage = parseFloat(chartData.cpu_usage) || 0;
        } else if (chartData.cpu !== undefined) {
          cpuUsage = parseFloat(chartData.cpu) || 0;
        }

        if (chartData.total_memory !== undefined) {
          totalMem = this.parseBytes(chartData.total_memory);
          freeMem = this.parseBytes(chartData.free_memory || 0);
        }

        if (cpuTemp === null) {
          cpuTemp = this.parseTemp(chartData.cpu_temp || chartData.cpu_tempc);
        }
        if (sysTemp === null) {
          sysTemp = this.parseTemp(chartData.sys_temp || chartData.system_temp);
        }
      } catch (e) {
        logger.debug('qnap', 'chartReq sys_health failed', { error: String(e) });
      }
    }

    // Try endpoint 3: resourceMonitor
    if (cpuUsage === 0 && totalMem === 0) {
      try {
        const resourceResponse = await client.get('/cgi-bin/resourceMonitor/rsrcMon.cgi', {
          params: {
            func: 'get_sys_info',
            sid: authSid,
          },
        });
        const resourceParsed = this.xmlParser.parse(resourceResponse.data);
        const resourceData = resourceParsed?.QDocRoot || {};

        logger.debug('qnap', 'Resource monitor data keys', { keys: Object.keys(resourceData).slice(0, 30) });

        if (resourceData.cpu_usage !== undefined) {
          cpuUsage = parseFloat(resourceData.cpu_usage) || 0;
        }
        if (resourceData.total_memory !== undefined) {
          totalMem = this.parseBytes(resourceData.total_memory);
          freeMem = this.parseBytes(resourceData.free_memory || 0);
        }

        if (cpuTemp === null) {
          cpuTemp = this.parseTemp(resourceData.cpu_temp);
        }
        if (sysTemp === null) {
          sysTemp = this.parseTemp(resourceData.sys_temp);
        }
      } catch (e) {
        logger.debug('qnap', 'resourceMonitor failed', { error: String(e) });
      }
    }

    // Try endpoint 4: systemStats.cgi
    if (cpuUsage === 0 && totalMem === 0) {
      try {
        const statsResponse = await client.get('/cgi-bin/sys/systemStats.cgi', {
          params: {
            sid: authSid,
          },
        });
        const statsParsed = this.xmlParser.parse(statsResponse.data);
        const statsData = statsParsed?.QDocRoot || statsParsed || {};

        logger.debug('qnap', 'systemStats.cgi data keys', { keys: Object.keys(statsData).slice(0, 30) });

        if (statsData.cpu_usage !== undefined) {
          cpuUsage = parseFloat(statsData.cpu_usage) || 0;
        }
        if (statsData.total_memory !== undefined) {
          totalMem = this.parseBytes(statsData.total_memory);
          freeMem = this.parseBytes(statsData.free_memory || 0);
        }
      } catch (e) {
        logger.debug('qnap', 'systemStats.cgi failed', { error: String(e) });
      }
    }

    // Try endpoint 5: qsmart.cgi for temperatures (same endpoint as disks)
    if (cpuTemp === null || sysTemp === null) {
      try {
        const qsmartResponse = await client.get('/cgi-bin/disk/qsmart.cgi', {
          params: {
            func: 'all_hd_data',
            sid: authSid,
          },
        });
        const qsmartParsed = this.xmlParser.parse(qsmartResponse.data);
        const qsmartData = qsmartParsed?.QDocRoot || {};

        // Get system temperature thresholds
        if (sysTemp === null) {
          sysTemp = this.parseTemp(qsmartData.sys_temp || qsmartData.SysTempNow);
        }
        if (cpuTemp === null) {
          cpuTemp = this.parseTemp(qsmartData.cpu_temp || qsmartData.CPUTempNow);
        }
      } catch (e) {
        logger.debug('qnap', 'qsmart.cgi temperature failed', { error: String(e) });
      }
    }

    // Try endpoint 6: hal_app (hardware abstraction layer)
    if (cpuUsage === 0 || totalMem === 0) {
      try {
        const halResponse = await client.get('/cgi-bin/hal_app', {
          params: {
            func: 'get_resource',
            sid: authSid,
          },
        });
        const halParsed = this.xmlParser.parse(halResponse.data);
        const halData = halParsed?.QDocRoot || halParsed || {};

        logger.debug('qnap', 'hal_app get_resource keys', { keys: Object.keys(halData).slice(0, 30) });

        if (cpuUsage === 0 && halData.cpu_usage !== undefined) {
          cpuUsage = parseFloat(halData.cpu_usage) || 0;
        }
        if (totalMem === 0 && halData.total_memory !== undefined) {
          totalMem = this.parseBytes(halData.total_memory);
          freeMem = this.parseBytes(halData.free_memory || 0);
        }
      } catch (e) {
        logger.debug('qnap', 'hal_app get_resource failed', { error: String(e) });
      }
    }

    // Try endpoint 7: QRM (QNAP Resource Monitor) app endpoint
    if (cpuUsage === 0 || totalMem === 0) {
      try {
        const qrmResponse = await client.get('/resourceMonitor/monitor.cgi', {
          params: {
            func: 'get_status',
            sid: authSid,
          },
        });
        const qrmParsed = this.xmlParser.parse(qrmResponse.data);
        const qrmData = qrmParsed?.QDocRoot || qrmParsed || {};

        logger.debug('qnap', 'QRM monitor.cgi keys', { keys: Object.keys(qrmData).slice(0, 30) });

        if (cpuUsage === 0 && qrmData.cpu_usage !== undefined) {
          cpuUsage = parseFloat(qrmData.cpu_usage) || 0;
        }
        if (totalMem === 0 && qrmData.total_memory !== undefined) {
          totalMem = this.parseBytes(qrmData.total_memory);
          freeMem = this.parseBytes(qrmData.free_memory || 0);
        }
      } catch (e) {
        logger.debug('qnap', 'QRM monitor.cgi failed', { error: String(e) });
      }
    }

    // Try endpoint 8: systemHealth get_runtime
    if (cpuUsage === 0 || totalMem === 0) {
      try {
        const runtimeResponse = await client.get('/cgi-bin/management/manaRequest.cgi', {
          params: {
            subfunc: 'runtime',
            sid: authSid,
          },
        });
        const runtimeParsed = this.xmlParser.parse(runtimeResponse.data);
        const runtimeData = runtimeParsed?.QDocRoot || {};

        logger.debug('qnap', 'manaRequest runtime keys', { keys: Object.keys(runtimeData).slice(0, 40) });

        // Check for nested resource info
        const resource = runtimeData?.resource || runtimeData?.system || runtimeData;

        if (cpuUsage === 0) {
          cpuUsage = parseFloat(resource.cpu_usage || resource.cpu || 0) || 0;
        }
        if (totalMem === 0 && resource.total_memory !== undefined) {
          totalMem = this.parseBytes(resource.total_memory);
          freeMem = this.parseBytes(resource.free_memory || 0);
        }

        // Get temperatures if not found yet
        if (cpuTemp === null) {
          cpuTemp = this.parseTemp(runtimeData.cpu_temp || resource.cpu_temp);
        }
        if (sysTemp === null) {
          sysTemp = this.parseTemp(runtimeData.sys_temp || resource.sys_temp);
        }
      } catch (e) {
        logger.debug('qnap', 'manaRequest runtime failed', { error: String(e) });
      }
    }

    const usedMem = totalMem - freeMem;
    const memPercent = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;

    const stats: QnapSystemStats = {
      cpu: {
        usage: cpuUsage,
        temperature: cpuTemp,
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: memPercent,
      },
      systemTemperature: sysTemp,
    };

    logger.debug('qnap', 'Fetched system stats', { cpu: stats.cpu.usage, memUsage: stats.memory.usagePercent, totalMem, freeMem });
    return { stats };
  }

  private async getVolumes(client: AxiosInstance, authSid: string): Promise<{ volumes: QnapVolume[] }> {
    const response = await client.get('/cgi-bin/management/chartReq.cgi', {
      params: {
        chart_func: 'disk_usage',
        disk_select: 'all',
        include: 'all',
        sid: authSid,
      },
    });

    const parsed = this.xmlParser.parse(response.data);
    const root = parsed?.QDocRoot || {};

    // QNAP returns volumeList and volumeUseList as JSON strings
    let volumeListData: { volume?: Array<Record<string, unknown>> } = { volume: [] };
    let volumeUseListData: { volumeUse?: Array<Record<string, unknown>> } = { volumeUse: [] };

    try {
      if (typeof root?.volumeList === 'string') {
        volumeListData = JSON.parse(root.volumeList);
      } else if (root?.volumeList?.volume) {
        volumeListData = root.volumeList;
      }
    } catch (e) {
      logger.debug('qnap', 'Failed to parse volumeList', { error: String(e) });
    }

    try {
      if (typeof root?.volumeUseList === 'string') {
        volumeUseListData = JSON.parse(root.volumeUseList);
      } else if (root?.volumeUseList?.volumeUse) {
        volumeUseListData = root.volumeUseList;
      }
    } catch (e) {
      logger.debug('qnap', 'Failed to parse volumeUseList', { error: String(e) });
    }

    const volumeInfoList = volumeListData?.volume || [];
    const volumeUseList = volumeUseListData?.volumeUse || [];

    // Create a map of volumeValue to usage data
    const usageMap = new Map<number, Record<string, unknown>>();
    for (const usage of volumeUseList) {
      const volValue = usage.volumeValue as number;
      if (volValue !== undefined) {
        usageMap.set(volValue, usage);
      }
    }

    // Map volume status codes to readable strings
    const getStatusString = (status: number | string | undefined): string => {
      const statusNum = typeof status === 'number' ? status : parseInt(String(status), 10);
      switch (statusNum) {
        case 0: return 'Inactive';
        case 1: return 'Ready';
        case 43: return 'Ready';
        case 2: return 'Rebuilding';
        case 3: return 'Degraded';
        case 4: return 'Error';
        default: return 'Ready';
      }
    };

    const volumes: QnapVolume[] = volumeInfoList.map((vol: Record<string, unknown>, index: number) => {
      const volumeValue = vol.volumeValue as number;
      const usage = usageMap.get(volumeValue) || {};

      const totalSize = (usage.total_size as number) || 0;
      const freeSize = (usage.free_size as number) || 0;
      const usedSize = totalSize - freeSize;
      const usagePercent = totalSize > 0 ? (usedSize / totalSize) * 100 : 0;

      return {
        id: String(volumeValue || index + 1),
        name: String(vol.volumeLabel || `Volume ${volumeValue || index + 1}`),
        status: getStatusString(vol.volumeStatus as number | string | undefined),
        raidType: String(vol.volumeStat || 'Unknown').toUpperCase(),
        totalSize,
        usedSize,
        freeSize,
        usagePercent,
      };
    });

    logger.debug('qnap', `Fetched ${volumes.length} volumes`);
    return { volumes };
  }

  private async getDisks(client: AxiosInstance, authSid: string): Promise<{ disks: QnapDisk[] }> {
    let disks: QnapDisk[] = [];

    // Try endpoint 1: disk/qsmart.cgi
    try {
      const response = await client.get('/cgi-bin/disk/qsmart.cgi', {
        params: {
          func: 'all_hd_data',
          sid: authSid,
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const root = parsed?.QDocRoot || {};

      logger.debug('qnap', 'qsmart.cgi response keys', { keys: Object.keys(root).slice(0, 30) });

      const diskList = root?.Disk_Info?.entry || root?.HDD_Info?.entry || root?.entry || [];
      const disksArray = Array.isArray(diskList) ? diskList : (diskList ? [diskList] : []);

      if (disksArray.length > 0) {
        // Log the first disk's keys to understand the structure
        if (disksArray[0]) {
          logger.debug('qnap', 'Disk entry keys', { keys: Object.keys(disksArray[0]), sample: JSON.stringify(disksArray[0]).slice(0, 500) });
        }
        disks = this.parseDiskArray(disksArray);
        logger.debug('qnap', `qsmart.cgi returned ${disks.length} disks`);
        if (disks.length > 0) return { disks };
      }
    } catch (e) {
      logger.debug('qnap', 'qsmart.cgi failed', { error: String(e) });
    }

    // Try endpoint 2: disk/disk_manage.cgi
    try {
      const response = await client.get('/cgi-bin/disk/disk_manage.cgi', {
        params: {
          disk_func: 'disk_list',
          sid: authSid,
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const root = parsed?.QDocRoot || {};

      logger.debug('qnap', 'disk_manage.cgi response keys', { keys: Object.keys(root).slice(0, 30) });

      const diskList = root?.Disk_Info?.entry || root?.disk_list?.entry || root?.entry || root?.Disk || [];
      const disksArray = Array.isArray(diskList) ? diskList : (diskList ? [diskList] : []);

      if (disksArray.length > 0) {
        disks = this.parseDiskArray(disksArray);
        logger.debug('qnap', `disk_manage.cgi returned ${disks.length} disks`);
        if (disks.length > 0) return { disks };
      }
    } catch (e) {
      logger.debug('qnap', 'disk_manage.cgi failed', { error: String(e) });
    }

    // Try endpoint 3: smart_info_all (original)
    try {
      const response = await client.get('/cgi-bin/management/manaRequest.cgi', {
        params: {
          subfunc: 'smart_info_all',
          sid: authSid,
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const root = parsed?.QDocRoot || {};

      logger.debug('qnap', 'smart_info_all response keys', { keys: Object.keys(root).slice(0, 30) });

      // Check if user has permission (authPassed = 0 means no permission)
      if (root?.authPassed === 0 || root?.authPassed === '0') {
        logger.warn('qnap', 'Disk info requires admin permissions');
      }

      const diskList = root?.Disk_Info?.entry || root?.disk || root?.disks || root?.HDD_Info?.entry || root?.Disk || [];
      const disksArray = Array.isArray(diskList) ? diskList : (diskList ? [diskList] : []);

      if (disksArray.length > 0) {
        disks = this.parseDiskArray(disksArray);
        logger.debug('qnap', `smart_info_all returned ${disks.length} disks`);
        if (disks.length > 0) return { disks };
      }
    } catch (e) {
      logger.debug('qnap', 'smart_info_all failed', { error: String(e) });
    }

    // Try endpoint 4: sys/sysRequest.cgi
    try {
      const response = await client.get('/cgi-bin/sys/sysRequest.cgi', {
        params: {
          subfunc: 'hdd_info',
          sid: authSid,
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const root = parsed?.QDocRoot || {};

      logger.debug('qnap', 'sysRequest hdd_info response keys', { keys: Object.keys(root).slice(0, 30) });

      const diskList = root?.HDD_Info?.entry || root?.Disk_Info?.entry || root?.entry || [];
      const disksArray = Array.isArray(diskList) ? diskList : (diskList ? [diskList] : []);

      if (disksArray.length > 0) {
        disks = this.parseDiskArray(disksArray);
        logger.debug('qnap', `sysRequest hdd_info returned ${disks.length} disks`);
        if (disks.length > 0) return { disks };
      }
    } catch (e) {
      logger.debug('qnap', 'sysRequest hdd_info failed', { error: String(e) });
    }

    // Try endpoint 5: healthMgr/getHdd
    try {
      const response = await client.get('/healthMgr/getHdd.php', {
        params: {
          sid: authSid,
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const root = parsed?.QDocRoot || parsed || {};

      logger.debug('qnap', 'healthMgr getHdd response keys', { keys: Object.keys(root).slice(0, 30) });

      const diskList = root?.HDD_Info?.entry || root?.hdds?.hdd || root?.entry || [];
      const disksArray = Array.isArray(diskList) ? diskList : (diskList ? [diskList] : []);

      if (disksArray.length > 0) {
        disks = this.parseDiskArray(disksArray);
        logger.debug('qnap', `healthMgr getHdd returned ${disks.length} disks`);
        if (disks.length > 0) return { disks };
      }
    } catch (e) {
      logger.debug('qnap', 'healthMgr getHdd failed', { error: String(e) });
    }

    logger.debug('qnap', `All disk endpoints returned 0 disks`);
    return { disks };
  }

  private parseDiskArray(disksArray: Array<Record<string, unknown>>): QnapDisk[] {
    return disksArray.map((disk: Record<string, unknown>, index: number) => {
      // Handle Temperature which can be an object like {oC: 45, oF: 113} or a simple value
      let temp: number | null = null;
      const tempValue = disk.Temperature || disk.temperature || disk.hd_temp || disk.temp;
      if (tempValue && typeof tempValue === 'object' && 'oC' in (tempValue as Record<string, unknown>)) {
        temp = this.parseTemp((tempValue as Record<string, unknown>).oC as number);
      } else {
        temp = this.parseTemp(tempValue as string | number | undefined);
      }

      // Map Disk_Status codes to SMART status strings
      const diskStatus = disk.Disk_Status ?? disk.disk_status ?? disk.hd_smart_status ?? disk.smart_status;
      let smartStatus = 'Unknown';
      if (diskStatus !== undefined) {
        const statusNum = typeof diskStatus === 'number' ? diskStatus : parseInt(String(diskStatus), 10);
        if (statusNum === 0) smartStatus = 'Normal';
        else if (statusNum === 1) smartStatus = 'Warning';
        else if (statusNum === 2) smartStatus = 'Error';
        else smartStatus = String(diskStatus);
      }

      // Determine disk type from hd_is_ssd flag or model name
      let diskType: 'ssd' | 'hdd' | 'nvme' | 'unknown' = 'unknown';
      const isSsd = disk.hd_is_ssd ?? disk.is_ssd;
      if (isSsd === 1 || isSsd === '1' || isSsd === true) {
        diskType = 'ssd';
      } else if (isSsd === 0 || isSsd === '0' || isSsd === false) {
        diskType = 'hdd';
      } else {
        diskType = this.detectDiskType(String(disk.Model || disk.model || disk.hd_model || disk.modelName || ''));
      }

      return {
        id: String(disk.HDNo || disk.hd_no || disk.id || disk.disk_no || disk.portStr || index + 1),
        model: String(disk.Model || disk.model || disk.hd_model || disk.modelName || 'Unknown'),
        serial: (disk.Serial || disk.serial || disk.hd_serial || disk.serialNum) as string | undefined,
        capacity: this.parseBytes((disk.Capacity || disk.capacity || disk.hd_capacity || disk.diskSize) as string | number | undefined),
        temperature: temp,
        health: String(disk.Health || disk.health || disk.hd_status || disk.status || 'Unknown'),
        smartStatus,
        type: diskType,
      };
    });
  }

  private async getNetworkStats(client: AxiosInstance, authSid: string): Promise<{ network: QnapNetworkStats }> {
    const response = await client.get('/cgi-bin/management/chartReq.cgi', {
      params: {
        chart_func: 'bandwidth',
        sid: authSid,
      },
    });

    const parsed = this.xmlParser.parse(response.data);
    const root = parsed?.QDocRoot || {};

    // QNAP returns bandwidth data inside bandwidth_info
    const bandwidthInfo = root?.bandwidth_info || root;

    logger.debug('qnap', 'Bandwidth data keys', {
      rootKeys: Object.keys(root).slice(0, 20),
      bandwidthKeys: bandwidthInfo ? Object.keys(bandwidthInfo).slice(0, 20) : [],
    });

    // Extract total values - these are bytes/second speeds
    const totalRx = parseFloat(bandwidthInfo?.total_usage_rx || 0) || 0;
    const totalTx = parseFloat(bandwidthInfo?.total_usage_tx || 0) || 0;

    // Sum up individual interface speeds for current bandwidth
    let rxSpeed = 0;
    let txSpeed = 0;

    // Look for interface entries (eth0, eth1, etc.)
    for (const key of Object.keys(bandwidthInfo)) {
      if (key.startsWith('eth') || key.startsWith('bond') || key.startsWith('en')) {
        const iface = bandwidthInfo[key];
        if (iface && typeof iface === 'object') {
          rxSpeed += parseFloat(iface.rx || 0) || 0;
          txSpeed += parseFloat(iface.tx || 0) || 0;
        }
      }
    }

    // If no interface data found, use totals as speeds
    if (rxSpeed === 0 && txSpeed === 0) {
      rxSpeed = totalRx;
      txSpeed = totalTx;
    }

    const network: QnapNetworkStats = {
      uploadSpeed: txSpeed,
      downloadSpeed: rxSpeed,
      totalUpload: totalTx,
      totalDownload: totalRx,
    };

    logger.debug('qnap', 'Fetched network stats', { up: network.uploadSpeed, down: network.downloadSpeed });
    return { network };
  }

  // Helper methods
  private parseUptime(uptimeStr: string | number | undefined): number {
    if (!uptimeStr) return 0;
    if (typeof uptimeStr === 'number') return uptimeStr;

    // Parse uptime string like "5 days, 3:24:15" or "5d 3h 24m 15s"
    const match = uptimeStr.match(/(\d+)\s*(?:days?|d)?,?\s*(\d+):(\d+):(\d+)/i);
    if (match) {
      const days = parseInt(match[1], 10);
      const hours = parseInt(match[2], 10);
      const minutes = parseInt(match[3], 10);
      const seconds = parseInt(match[4], 10);
      return days * 86400 + hours * 3600 + minutes * 60 + seconds;
    }

    // Try parsing as seconds directly
    const num = parseInt(uptimeStr, 10);
    return isNaN(num) ? 0 : num;
  }

  private parseBytes(value: string | number | undefined): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;

    const num = parseFloat(value);
    if (isNaN(num)) return 0;

    // Check for unit suffix (KB, MB, GB, TB)
    const upper = value.toUpperCase();
    if (upper.includes('TB')) return num * 1024 * 1024 * 1024 * 1024;
    if (upper.includes('GB')) return num * 1024 * 1024 * 1024;
    if (upper.includes('MB')) return num * 1024 * 1024;
    if (upper.includes('KB')) return num * 1024;
    return num;
  }

  private parseTemp(value: string | number | undefined): number | null {
    if (value === undefined || value === null || value === '') return null;
    const num = parseFloat(String(value));
    return isNaN(num) ? null : num;
  }

  private detectDiskType(model: string | undefined): 'ssd' | 'hdd' | 'nvme' | 'unknown' {
    if (!model) return 'unknown';
    const upper = model.toUpperCase();
    if (upper.includes('NVME') || upper.includes('M.2')) return 'nvme';
    if (upper.includes('SSD')) return 'ssd';
    // Most spinning disks from WD, Seagate, etc. don't have SSD in name
    if (upper.includes('WD') || upper.includes('SEAGATE') || upper.includes('TOSHIBA') || upper.includes('HITACHI')) {
      return 'hdd';
    }
    return 'unknown';
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'system-info',
        name: 'System Information',
        description: 'Hostname, model, firmware, uptime',
        widgetTypes: ['qnap-system-overview'],
      },
      {
        id: 'system-stats',
        name: 'System Statistics',
        description: 'CPU usage, memory usage, temperatures',
        widgetTypes: ['qnap-resource-usage'],
      },
      {
        id: 'volumes',
        name: 'Storage Volumes',
        description: 'Volume status, RAID type, capacity, usage',
        widgetTypes: ['qnap-volume-status'],
      },
      {
        id: 'disks',
        name: 'Physical Disks',
        description: 'Disk health, SMART status, temperatures',
        widgetTypes: ['qnap-disk-health'],
      },
      {
        id: 'network',
        name: 'Network Bandwidth',
        description: 'Upload/download speeds and totals',
        widgetTypes: ['qnap-network-bandwidth'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication - Implemented
      {
        id: 'auth-login',
        name: 'Login',
        description: 'Authenticate and obtain session ID (authSid)',
        method: 'GET',
        endpoint: '/cgi-bin/authLogin.cgi',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'user', type: 'string', required: true, description: 'Username' },
          { name: 'pwd', type: 'string', required: true, description: 'Base64 encoded password' },
          { name: 'remme', type: 'number', required: false, description: 'Remember me (1 to enable)' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/API_QNAP_QTS_Authentication.pdf',
      },
      {
        id: 'auth-logout',
        name: 'Logout',
        description: 'Invalidate session and log out',
        method: 'GET',
        endpoint: '/cgi-bin/authLogout.cgi',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/API_QNAP_QTS_Authentication.pdf',
      },

      // System Information - Implemented
      {
        id: 'system-info',
        name: 'Get System Info',
        description: 'Get system information including hostname, model, firmware version, and health status',
        method: 'GET',
        endpoint: '/cgi-bin/management/manaRequest.cgi',
        implemented: true,
        category: 'System',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "sysinfo"' },
          { name: 'sysHealth', type: 'number', required: false, description: 'Include system health (1)' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'system-stats',
        name: 'Get System Statistics',
        description: 'Get CPU usage, memory usage, and temperatures',
        method: 'GET',
        endpoint: '/cgi-bin/management/manaRequest.cgi',
        implemented: true,
        category: 'System',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "sysinfo"' },
          { name: 'hd', type: 'string', required: false, description: 'Include HDD info (no to exclude)' },
          { name: 'multicpu', type: 'number', required: false, description: 'Multi-CPU data (1)' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'system-runtime',
        name: 'Get Runtime Info',
        description: 'Get system runtime information and resource usage',
        method: 'GET',
        endpoint: '/cgi-bin/management/manaRequest.cgi',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "runtime"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'system-utilization',
        name: 'Get Utilization',
        description: 'Get real-time system utilization metrics',
        method: 'GET',
        endpoint: '/cgi-bin/management/manaRequest.cgi',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "utilization"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'system-health-chart',
        name: 'Get System Health Chart',
        description: 'Get system health data for charting',
        method: 'GET',
        endpoint: '/cgi-bin/management/chartReq.cgi',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'chart_func', type: 'string', required: true, description: 'Set to "sys_health"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'sys-status',
        name: 'Get System Status',
        description: 'Get system status via sysRequest endpoint',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "sys_status"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'resource-monitor',
        name: 'Get Resource Monitor Data',
        description: 'Get system resource information from resource monitor',
        method: 'GET',
        endpoint: '/cgi-bin/resourceMonitor/rsrcMon.cgi',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "get_sys_info"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'hal-resource',
        name: 'Get HAL Resource',
        description: 'Get hardware abstraction layer resource data',
        method: 'GET',
        endpoint: '/cgi-bin/hal_app',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "get_resource"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Storage Volumes - Implemented
      {
        id: 'volume-usage',
        name: 'Get Volume Usage',
        description: 'Get storage volume information and usage statistics',
        method: 'GET',
        endpoint: '/cgi-bin/management/chartReq.cgi',
        implemented: true,
        category: 'Storage',
        parameters: [
          { name: 'chart_func', type: 'string', required: true, description: 'Set to "disk_usage"' },
          { name: 'disk_select', type: 'string', required: false, description: 'Disk selection (all)' },
          { name: 'include', type: 'string', required: false, description: 'Include options (all)' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'storage-pools',
        name: 'Get Storage Pools',
        description: 'Get storage pool configuration and status',
        method: 'GET',
        endpoint: '/cgi-bin/disk/disk_manage.cgi',
        implemented: false,
        category: 'Storage',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "pool_status"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'shared-folders',
        name: 'Get Shared Folders',
        description: 'List shared folders and their properties',
        method: 'GET',
        endpoint: '/cgi-bin/filemanager/utilRequest.cgi',
        implemented: false,
        category: 'Storage',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "get_tree"' },
          { name: 'is_iso', type: 'number', required: false, description: 'Include ISO mounts' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'iscsi-targets',
        name: 'Get iSCSI Targets',
        description: 'List iSCSI targets and their status',
        method: 'GET',
        endpoint: '/cgi-bin/disk/iscsi_portal_setting.cgi',
        implemented: false,
        category: 'Storage',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "iscsi_target_list"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'snapshots',
        name: 'Get Snapshots',
        description: 'List volume snapshots',
        method: 'GET',
        endpoint: '/cgi-bin/disk/snapshot.cgi',
        implemented: false,
        category: 'Storage',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "snapshot_list"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Physical Disks - Implemented
      {
        id: 'disk-smart',
        name: 'Get Disk SMART Data',
        description: 'Get SMART health information for all disks',
        method: 'GET',
        endpoint: '/cgi-bin/disk/qsmart.cgi',
        implemented: true,
        category: 'Disks',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "all_hd_data"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'disk-list',
        name: 'Get Disk List',
        description: 'Get list of physical disks',
        method: 'GET',
        endpoint: '/cgi-bin/disk/disk_manage.cgi',
        implemented: true,
        category: 'Disks',
        parameters: [
          { name: 'disk_func', type: 'string', required: true, description: 'Set to "disk_list"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'smart-info-all',
        name: 'Get All SMART Info',
        description: 'Get detailed SMART information for all disks',
        method: 'GET',
        endpoint: '/cgi-bin/management/manaRequest.cgi',
        implemented: true,
        category: 'Disks',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "smart_info_all"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'hdd-info',
        name: 'Get HDD Info',
        description: 'Get HDD information via sysRequest',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: true,
        category: 'Disks',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "hdd_info"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'disk-health',
        name: 'Get Disk Health',
        description: 'Get disk health from health manager',
        method: 'GET',
        endpoint: '/healthMgr/getHdd.php',
        implemented: true,
        category: 'Disks',
        parameters: [
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Network - Implemented
      {
        id: 'network-bandwidth',
        name: 'Get Network Bandwidth',
        description: 'Get network bandwidth usage and interface statistics',
        method: 'GET',
        endpoint: '/cgi-bin/management/chartReq.cgi',
        implemented: true,
        category: 'Network',
        parameters: [
          { name: 'chart_func', type: 'string', required: true, description: 'Set to "bandwidth"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'network-config',
        name: 'Get Network Configuration',
        description: 'Get network interface configuration',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Network',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "net_info"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'network-interfaces',
        name: 'Get Network Interfaces',
        description: 'List network interfaces and their status',
        method: 'GET',
        endpoint: '/cgi-bin/management/manaRequest.cgi',
        implemented: false,
        category: 'Network',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "net_iface"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'dhcp-settings',
        name: 'Get DHCP Settings',
        description: 'Get DHCP server settings',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Network',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "dhcp_info"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Users & Access Control - Not Implemented
      {
        id: 'user-list',
        name: 'Get User List',
        description: 'List all system users',
        method: 'GET',
        endpoint: '/cgi-bin/authLogin.cgi',
        implemented: false,
        category: 'Access Control',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "user_list"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'group-list',
        name: 'Get Group List',
        description: 'List all user groups',
        method: 'GET',
        endpoint: '/cgi-bin/authLogin.cgi',
        implemented: false,
        category: 'Access Control',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "group_list"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Applications & Services - Not Implemented
      {
        id: 'app-list',
        name: 'Get Installed Apps',
        description: 'List installed applications',
        method: 'GET',
        endpoint: '/cgi-bin/application/appRequest.cgi',
        implemented: false,
        category: 'Applications',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "get_app_list"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'service-status',
        name: 'Get Service Status',
        description: 'Get status of system services',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Applications',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "service_status"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // External Devices - Not Implemented
      {
        id: 'external-devices',
        name: 'Get External Devices',
        description: 'List connected external devices',
        method: 'GET',
        endpoint: '/cgi-bin/devices/devRequest.cgi',
        implemented: false,
        category: 'External Devices',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "getExternalDev"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'usb-devices',
        name: 'Get USB Devices',
        description: 'List connected USB devices',
        method: 'GET',
        endpoint: '/cgi-bin/devices/devRequest.cgi',
        implemented: false,
        category: 'External Devices',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "get_usb_device"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'external-volumes',
        name: 'Get External Volumes',
        description: 'Get external device volume information',
        method: 'GET',
        endpoint: '/cgi-bin/disk/disk_manage.cgi',
        implemented: false,
        category: 'External Devices',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "external_get_all"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Firmware & Updates - Not Implemented
      {
        id: 'firmware-info',
        name: 'Get Firmware Info',
        description: 'Get current firmware version and update availability',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Firmware',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "firm_update"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'firmware-check',
        name: 'Check Firmware Update',
        description: 'Check for available firmware updates',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Firmware',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "check_update"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Backup & Sync - Not Implemented
      {
        id: 'backup-jobs',
        name: 'Get Backup Jobs',
        description: 'List configured backup jobs',
        method: 'GET',
        endpoint: '/cgi-bin/hbs/hbsRequest.cgi',
        implemented: false,
        category: 'Backup',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "get_job_list"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'rsync-jobs',
        name: 'Get Rsync Jobs',
        description: 'List Rsync backup jobs',
        method: 'GET',
        endpoint: '/cgi-bin/backup/rsync.cgi',
        implemented: false,
        category: 'Backup',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "rsync_list"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Notifications & Logs - Not Implemented
      {
        id: 'system-logs',
        name: 'Get System Logs',
        description: 'Retrieve system event logs',
        method: 'GET',
        endpoint: '/cgi-bin/logs/logRequest.cgi',
        implemented: false,
        category: 'Logs',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "get_sys_log"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'event-notifications',
        name: 'Get Event Notifications',
        description: 'Get recent event notifications',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Logs',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "get_notification"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Power Management - Not Implemented
      {
        id: 'power-schedule',
        name: 'Get Power Schedule',
        description: 'Get scheduled power on/off times',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Power',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "power_schedule"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'ups-status',
        name: 'Get UPS Status',
        description: 'Get UPS status if connected',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Power',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "ups_info"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'shutdown',
        name: 'Shutdown NAS',
        description: 'Initiate system shutdown',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Power',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "shutdown"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'reboot',
        name: 'Reboot NAS',
        description: 'Initiate system reboot',
        method: 'GET',
        endpoint: '/cgi-bin/sys/sysRequest.cgi',
        implemented: false,
        category: 'Power',
        parameters: [
          { name: 'subfunc', type: 'string', required: true, description: 'Set to "reboot"' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // File Station - Not Implemented
      {
        id: 'file-list',
        name: 'List Files',
        description: 'List files in a directory',
        method: 'GET',
        endpoint: '/cgi-bin/filemanager/utilRequest.cgi',
        implemented: false,
        category: 'File Station',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "get_list"' },
          { name: 'path', type: 'string', required: true, description: 'Directory path' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/QNAP_QTS_File_Station_API_v5.pdf',
      },
      {
        id: 'file-upload',
        name: 'Upload File',
        description: 'Upload a file to the NAS',
        method: 'POST',
        endpoint: '/cgi-bin/filemanager/utilRequest.cgi',
        implemented: false,
        category: 'File Station',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "upload"' },
          { name: 'dest_path', type: 'string', required: true, description: 'Destination path' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/QNAP_QTS_File_Station_API_v5.pdf',
      },
      {
        id: 'file-download',
        name: 'Download File',
        description: 'Download a file from the NAS',
        method: 'GET',
        endpoint: '/cgi-bin/filemanager/utilRequest.cgi',
        implemented: false,
        category: 'File Station',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "download"' },
          { name: 'source_path', type: 'string', required: true, description: 'Source file path' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/QNAP_QTS_File_Station_API_v5.pdf',
      },
      {
        id: 'file-delete',
        name: 'Delete File',
        description: 'Delete a file or folder',
        method: 'GET',
        endpoint: '/cgi-bin/filemanager/utilRequest.cgi',
        implemented: false,
        category: 'File Station',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "delete"' },
          { name: 'path', type: 'string', required: true, description: 'File or folder path' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/QNAP_QTS_File_Station_API_v5.pdf',
      },
      {
        id: 'file-rename',
        name: 'Rename File',
        description: 'Rename a file or folder',
        method: 'GET',
        endpoint: '/cgi-bin/filemanager/utilRequest.cgi',
        implemented: false,
        category: 'File Station',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "rename"' },
          { name: 'path', type: 'string', required: true, description: 'Current path' },
          { name: 'new_name', type: 'string', required: true, description: 'New name' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/QNAP_QTS_File_Station_API_v5.pdf',
      },
      {
        id: 'file-copy',
        name: 'Copy File',
        description: 'Copy files or folders',
        method: 'GET',
        endpoint: '/cgi-bin/filemanager/utilRequest.cgi',
        implemented: false,
        category: 'File Station',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "copy"' },
          { name: 'source_path', type: 'string', required: true, description: 'Source path' },
          { name: 'dest_path', type: 'string', required: true, description: 'Destination path' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/QNAP_QTS_File_Station_API_v5.pdf',
      },
      {
        id: 'folder-create',
        name: 'Create Folder',
        description: 'Create a new folder',
        method: 'GET',
        endpoint: '/cgi-bin/filemanager/utilRequest.cgi',
        implemented: false,
        category: 'File Station',
        parameters: [
          { name: 'func', type: 'string', required: true, description: 'Set to "createdir"' },
          { name: 'dest_path', type: 'string', required: true, description: 'Parent path' },
          { name: 'dest_folder', type: 'string', required: true, description: 'New folder name' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
        documentationUrl: 'https://download.qnap.com/dev/QNAP_QTS_File_Station_API_v5.pdf',
      },

      // Virtualization Station - Not Implemented
      {
        id: 'vm-list',
        name: 'Get VM List',
        description: 'List virtual machines',
        method: 'GET',
        endpoint: '/virtualstation/api/virtualMachines',
        implemented: false,
        category: 'Virtualization',
        parameters: [
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'vm-status',
        name: 'Get VM Status',
        description: 'Get status of a virtual machine',
        method: 'GET',
        endpoint: '/virtualstation/api/virtualMachines/{vmId}',
        implemented: false,
        category: 'Virtualization',
        parameters: [
          { name: 'vmId', type: 'string', required: true, description: 'Virtual machine ID' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'vm-start',
        name: 'Start VM',
        description: 'Start a virtual machine',
        method: 'POST',
        endpoint: '/virtualstation/api/virtualMachines/{vmId}/start',
        implemented: false,
        category: 'Virtualization',
        parameters: [
          { name: 'vmId', type: 'string', required: true, description: 'Virtual machine ID' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'vm-stop',
        name: 'Stop VM',
        description: 'Stop a virtual machine',
        method: 'POST',
        endpoint: '/virtualstation/api/virtualMachines/{vmId}/stop',
        implemented: false,
        category: 'Virtualization',
        parameters: [
          { name: 'vmId', type: 'string', required: true, description: 'Virtual machine ID' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },

      // Container Station - Not Implemented
      {
        id: 'container-list',
        name: 'Get Container List',
        description: 'List Docker containers',
        method: 'GET',
        endpoint: '/container-station/api/v1/container',
        implemented: false,
        category: 'Container Station',
        parameters: [
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'container-start',
        name: 'Start Container',
        description: 'Start a Docker container',
        method: 'POST',
        endpoint: '/container-station/api/v1/container/{id}/start',
        implemented: false,
        category: 'Container Station',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Container ID' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
      {
        id: 'container-stop',
        name: 'Stop Container',
        description: 'Stop a Docker container',
        method: 'POST',
        endpoint: '/container-station/api/v1/container/{id}/stop',
        implemented: false,
        category: 'Container Station',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Container ID' },
          { name: 'sid', type: 'string', required: true, description: 'Session ID' },
        ],
      },
    ];
  }
}
