import axios, { AxiosInstance } from 'axios';
import https from 'https';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import { IntegrationConfig, IntegrationData, ESXiConfig } from '../types';
import { logger } from '../services/logger';

interface SessionCache {
  sessionId: string;
  expiresAt: number;
}

const sessionCache = new Map<string, SessionCache>();

export class ESXiIntegration extends BaseIntegration {
  readonly type = 'esxi';
  readonly name = 'VMware ESXi';

  private getConfigKey(config: ESXiConfig): string {
    return `esxi_${config.host}_${config.username}`;
  }

  private async getSessionId(config: ESXiConfig): Promise<string> {
    const configKey = this.getConfigKey(config);
    const cached = sessionCache.get(configKey);

    // Return cached session if still valid (with 5 min buffer)
    if (cached && cached.expiresAt > Date.now() + 300000) {
      return cached.sessionId;
    }

    // Create new session
    const baseUrl = `https://${config.host}${config.port && config.port !== 443 ? `:${config.port}` : ''}`;

    const response = await axios.post(
      `${baseUrl}/api/session`,
      null,
      {
        auth: {
          username: config.username,
          password: config.password,
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: config.verifySSL ?? false,
        }),
        timeout: 15000,
      }
    );

    const sessionId = response.data;

    // ESXi sessions typically last 30 minutes
    sessionCache.set(configKey, {
      sessionId,
      expiresAt: Date.now() + 25 * 60 * 1000,
    });

    return sessionId;
  }

  private async createClient(config: ESXiConfig): Promise<AxiosInstance> {
    const baseUrl = `https://${config.host}${config.port && config.port !== 443 ? `:${config.port}` : ''}`;

    let sessionId: string | null = null;
    try {
      sessionId = await this.getSessionId(config);
    } catch {
      // Session API may not be available, fall back to basic auth
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (sessionId) {
      headers['vmware-api-session-id'] = sessionId;
    }

    return axios.create({
      baseURL: baseUrl,
      headers,
      auth: sessionId ? undefined : {
        username: config.username,
        password: config.password,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const esxiConfig = config as ESXiConfig;

    if (!esxiConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!esxiConfig.username) {
      return { success: false, message: 'Username is required' };
    }
    if (!esxiConfig.password) {
      return { success: false, message: 'Password is required' };
    }

    try {
      // Clear cached session
      sessionCache.delete(this.getConfigKey(esxiConfig));

      const client = await this.createClient(esxiConfig);

      // Try to get host system info
      let version = 'Unknown';
      let hostname = esxiConfig.host;

      try {
        // Try REST API first
        const hostResponse = await client.get('/api/vcenter/host');
        if (hostResponse.data && hostResponse.data.length > 0) {
          hostname = hostResponse.data[0].name || hostname;
        }
      } catch {
        // Try MOB API for standalone ESXi
        try {
          const aboutResponse = await client.get('/sdk/about');
          if (aboutResponse.data) {
            version = aboutResponse.data.version || version;
          }
        } catch {
          // Fallback - just verify we can connect
        }
      }

      // Try to get VM count
      let vmCount = 0;
      try {
        const vmResponse = await client.get('/api/vcenter/vm');
        vmCount = vmResponse.data?.length || 0;
      } catch {
        // VM listing may fail on standalone ESXi
      }

      return {
        success: true,
        message: `Connected to ESXi host ${hostname}`,
        details: {
          host: hostname,
          version,
          vmCount,
        },
      };
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { status?: number; data?: { message?: string } };
        code?: string;
      };

      logger.error('esxi', 'Connection test failed', { error: err.message });

      if (err.response?.status === 401) {
        return { success: false, message: 'Invalid username or password' };
      }
      if (err.code === 'ECONNREFUSED') {
        return { success: false, message: 'Connection refused. Check host and port.' };
      }
      if (err.code === 'ENOTFOUND') {
        return { success: false, message: 'Host not found. Check the hostname.' };
      }
      if (err.code === 'CERT_HAS_EXPIRED' || err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        return { success: false, message: 'SSL certificate error. Try disabling SSL verification.' };
      }

      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const esxiConfig = config as ESXiConfig;
    const client = await this.createClient(esxiConfig);

    switch (metric) {
      case 'vms':
        return this.getVMs(client, esxiConfig);
      case 'host-status':
        return this.getHostStatus(client, esxiConfig);
      case 'datastores':
        return this.getDatastores(client);
      case 'networks':
        return this.getNetworks(client);
      case 'resource-usage':
        return this.getResourceUsage(client, esxiConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getVMs(client: AxiosInstance, config: ESXiConfig): Promise<IntegrationData> {
    try {
      const response = await client.get('/api/vcenter/vm');
      const vms = response.data || [];

      const vmDetails = await Promise.all(
        vms.slice(0, 50).map(async (vm: { vm: string; name: string; power_state: string; cpu_count?: number; memory_size_MiB?: number }) => {
          let details: {
            guest_OS?: string;
            boot_devices?: string[];
            hardware?: { version?: string };
          } = {};

          try {
            const detailResponse = await client.get(`/api/vcenter/vm/${vm.vm}`);
            details = detailResponse.data || {};
          } catch {
            // Individual VM detail may fail
          }

          return {
            id: vm.vm,
            name: vm.name,
            powerState: vm.power_state,
            cpuCount: vm.cpu_count || details.hardware?.version ? 1 : 0,
            memoryMB: vm.memory_size_MiB || 0,
            guestOS: details.guest_OS || 'Unknown',
          };
        })
      );

      const summary = {
        total: vms.length,
        poweredOn: vms.filter((vm: { power_state: string }) => vm.power_state === 'POWERED_ON').length,
        poweredOff: vms.filter((vm: { power_state: string }) => vm.power_state === 'POWERED_OFF').length,
        suspended: vms.filter((vm: { power_state: string }) => vm.power_state === 'SUSPENDED').length,
      };

      return {
        vms: vmDetails,
        summary,
      };
    } catch (error) {
      logger.error('esxi', 'Failed to get VMs', { error });
      return {
        vms: [],
        summary: { total: 0, poweredOn: 0, poweredOff: 0, suspended: 0 },
      };
    }
  }

  private async getHostStatus(client: AxiosInstance, config: ESXiConfig): Promise<IntegrationData> {
    let hostname = config.host;
    let connectionState = 'CONNECTED';
    let powerState = 'POWERED_ON';
    let cpuModel = 'Unknown';
    let cpuCores = 0;
    let cpuMhz = 0;
    let memoryBytes = 0;

    try {
      const hostResponse = await client.get('/api/vcenter/host');
      if (hostResponse.data && hostResponse.data.length > 0) {
        const host = hostResponse.data[0];
        hostname = host.name || hostname;
        connectionState = host.connection_state || 'CONNECTED';
        powerState = host.power_state || 'POWERED_ON';

        // Get host details
        if (host.host) {
          try {
            const detailResponse = await client.get(`/api/vcenter/host/${host.host}`);
            const detail = detailResponse.data || {};
            cpuModel = detail.cpu?.model || cpuModel;
            cpuCores = detail.cpu?.core_count || 0;
            cpuMhz = detail.cpu?.mhz || 0;
            memoryBytes = detail.memory?.size_MiB ? detail.memory.size_MiB * 1024 * 1024 : 0;
          } catch {
            // Host detail may fail
          }
        }
      }
    } catch {
      // Host API may not be available
    }

    return {
      host: {
        name: hostname,
        connectionState,
        powerState,
        cpu: {
          model: cpuModel,
          cores: cpuCores,
          mhz: cpuMhz,
        },
        memory: {
          totalBytes: memoryBytes,
        },
      },
    };
  }

  private async getDatastores(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/api/vcenter/datastore');
      const datastores = response.data || [];

      const datastoreDetails = await Promise.all(
        datastores.map(async (ds: { datastore: string; name: string; type: string; capacity?: number; free_space?: number }) => {
          let details: { capacity?: number; free_space?: number } = {};

          try {
            const detailResponse = await client.get(`/api/vcenter/datastore/${ds.datastore}`);
            details = detailResponse.data || {};
          } catch {
            // Detail may fail
          }

          const capacity = ds.capacity || details.capacity || 0;
          const freeSpace = ds.free_space || details.free_space || 0;
          const usedSpace = capacity - freeSpace;

          return {
            id: ds.datastore,
            name: ds.name,
            type: ds.type,
            capacity,
            freeSpace,
            usedSpace,
            usedPercent: capacity > 0 ? Math.round((usedSpace / capacity) * 100) : 0,
          };
        })
      );

      const totalCapacity = datastoreDetails.reduce((sum, ds) => sum + ds.capacity, 0);
      const totalFree = datastoreDetails.reduce((sum, ds) => sum + ds.freeSpace, 0);

      return {
        datastores: datastoreDetails,
        summary: {
          count: datastores.length,
          totalCapacity,
          totalFree,
          totalUsed: totalCapacity - totalFree,
          usedPercent: totalCapacity > 0 ? Math.round(((totalCapacity - totalFree) / totalCapacity) * 100) : 0,
        },
      };
    } catch (error) {
      logger.error('esxi', 'Failed to get datastores', { error });
      return {
        datastores: [],
        summary: { count: 0, totalCapacity: 0, totalFree: 0, totalUsed: 0, usedPercent: 0 },
      };
    }
  }

  private async getNetworks(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/api/vcenter/network');
      const networks = response.data || [];

      const networkDetails = networks.map((net: { network: string; name: string; type: string }) => ({
        id: net.network,
        name: net.name,
        type: net.type,
      }));

      return {
        networks: networkDetails,
        summary: {
          count: networks.length,
          byType: networks.reduce((acc: Record<string, number>, net: { type: string }) => {
            acc[net.type] = (acc[net.type] || 0) + 1;
            return acc;
          }, {}),
        },
      };
    } catch (error) {
      logger.error('esxi', 'Failed to get networks', { error });
      return {
        networks: [],
        summary: { count: 0, byType: {} },
      };
    }
  }

  private async getResourceUsage(client: AxiosInstance, config: ESXiConfig): Promise<IntegrationData> {
    // Combine host status with VM summary for resource overview
    const hostData = await this.getHostStatus(client, config);
    const vmData = await this.getVMs(client, config);
    const datastoreData = await this.getDatastores(client);

    // Calculate VM resource usage
    const vms = vmData.vms as Array<{ cpuCount: number; memoryMB: number; powerState: string }>;
    const runningVMs = vms.filter(vm => vm.powerState === 'POWERED_ON');

    const totalVMCpu = runningVMs.reduce((sum, vm) => sum + (vm.cpuCount || 0), 0);
    const totalVMMemory = runningVMs.reduce((sum, vm) => sum + (vm.memoryMB || 0), 0);

    return {
      host: hostData.host,
      vms: vmData.summary,
      storage: datastoreData.summary,
      allocation: {
        cpuAllocated: totalVMCpu,
        memoryAllocatedMB: totalVMMemory,
      },
    };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'vms',
        name: 'Virtual Machines',
        description: 'List and status of virtual machines',
        widgetTypes: ['esxi-vm-list'],
      },
      {
        id: 'host-status',
        name: 'Host Status',
        description: 'ESXi host status and information',
        widgetTypes: ['esxi-host-status'],
      },
      {
        id: 'datastores',
        name: 'Datastores',
        description: 'Storage datastores and capacity',
        widgetTypes: ['esxi-datastores'],
      },
      {
        id: 'networks',
        name: 'Networks',
        description: 'Virtual networks and port groups',
        widgetTypes: ['esxi-networks'],
      },
      {
        id: 'resource-usage',
        name: 'Resource Usage',
        description: 'Overall resource allocation and usage',
        widgetTypes: ['esxi-resource-usage'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Session
      {
        id: 'session-create',
        name: 'Create Session',
        description: 'Authenticate and create API session',
        method: 'POST',
        endpoint: '/api/session',
        implemented: true,
        category: 'Authentication',
        documentationUrl: 'https://developer.broadcom.com/xapis/vsphere-automation-api/latest/',
      },
      {
        id: 'session-delete',
        name: 'Delete Session',
        description: 'Logout and delete session',
        method: 'DELETE',
        endpoint: '/api/session',
        implemented: false,
        category: 'Authentication',
      },

      // VMs
      {
        id: 'vm-list',
        name: 'List VMs',
        description: 'Get list of all virtual machines',
        method: 'GET',
        endpoint: '/api/vcenter/vm',
        implemented: true,
        category: 'Virtual Machines',
      },
      {
        id: 'vm-get',
        name: 'Get VM Details',
        description: 'Get detailed information about a VM',
        method: 'GET',
        endpoint: '/api/vcenter/vm/{vm}',
        implemented: true,
        category: 'Virtual Machines',
        parameters: [
          { name: 'vm', type: 'string', required: true, description: 'VM identifier' },
        ],
      },
      {
        id: 'vm-power-start',
        name: 'Power On VM',
        description: 'Start a virtual machine',
        method: 'POST',
        endpoint: '/api/vcenter/vm/{vm}/power/start',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'vm-power-stop',
        name: 'Power Off VM',
        description: 'Stop a virtual machine',
        method: 'POST',
        endpoint: '/api/vcenter/vm/{vm}/power/stop',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'vm-power-suspend',
        name: 'Suspend VM',
        description: 'Suspend a virtual machine',
        method: 'POST',
        endpoint: '/api/vcenter/vm/{vm}/power/suspend',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'vm-power-reset',
        name: 'Reset VM',
        description: 'Reset a virtual machine',
        method: 'POST',
        endpoint: '/api/vcenter/vm/{vm}/power/reset',
        implemented: false,
        category: 'Virtual Machines',
      },

      // Host
      {
        id: 'host-list',
        name: 'List Hosts',
        description: 'Get list of ESXi hosts',
        method: 'GET',
        endpoint: '/api/vcenter/host',
        implemented: true,
        category: 'Hosts',
      },
      {
        id: 'host-get',
        name: 'Get Host Details',
        description: 'Get detailed information about a host',
        method: 'GET',
        endpoint: '/api/vcenter/host/{host}',
        implemented: true,
        category: 'Hosts',
        parameters: [
          { name: 'host', type: 'string', required: true, description: 'Host identifier' },
        ],
      },

      // Datastores
      {
        id: 'datastore-list',
        name: 'List Datastores',
        description: 'Get list of datastores',
        method: 'GET',
        endpoint: '/api/vcenter/datastore',
        implemented: true,
        category: 'Storage',
      },
      {
        id: 'datastore-get',
        name: 'Get Datastore Details',
        description: 'Get detailed information about a datastore',
        method: 'GET',
        endpoint: '/api/vcenter/datastore/{datastore}',
        implemented: true,
        category: 'Storage',
        parameters: [
          { name: 'datastore', type: 'string', required: true, description: 'Datastore identifier' },
        ],
      },

      // Networks
      {
        id: 'network-list',
        name: 'List Networks',
        description: 'Get list of networks',
        method: 'GET',
        endpoint: '/api/vcenter/network',
        implemented: true,
        category: 'Networking',
      },

      // Folders
      {
        id: 'folder-list',
        name: 'List Folders',
        description: 'Get list of inventory folders',
        method: 'GET',
        endpoint: '/api/vcenter/folder',
        implemented: false,
        category: 'Inventory',
      },

      // Resource Pools
      {
        id: 'resource-pool-list',
        name: 'List Resource Pools',
        description: 'Get list of resource pools',
        method: 'GET',
        endpoint: '/api/vcenter/resource-pool',
        implemented: false,
        category: 'Resources',
      },
    ];
  }
}
