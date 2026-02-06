import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  ProxmoxConfig,
  ProxmoxNode,
  ProxmoxVM,
  ProxmoxStorage,
  ProxmoxTask,
  ProxmoxBackupInfo,
  ProxmoxBackupJob,
  ProxmoxRrdDataPoint,
  ProxmoxClusterStatus,
  ProxmoxDisk,
  ProxmoxNetwork,
  ProxmoxCephStatus,
  ProxmoxHAResource,
  ProxmoxHAStatus,
} from '../types';
import { logger } from '../services/logger';

export class ProxmoxIntegration extends BaseIntegration {
  readonly type = 'proxmox';
  readonly name = 'Proxmox VE';

  private createClient(config: ProxmoxConfig): AxiosInstance {
    const baseURL = `https://${config.host}:${config.port || 8006}/api2/json`;

    const headers: Record<string, string> = {};

    if (config.tokenId && config.tokenSecret) {
      headers['Authorization'] = `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`;
    }

    return axios.create({
      baseURL,
      headers,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 10000,
    });
  }

  private async authenticate(client: AxiosInstance, config: ProxmoxConfig): Promise<void> {
    if (config.tokenId && config.tokenSecret) {
      logger.debug('proxmox', 'Using API token authentication');
      return; // Already using API token
    }

    if (config.username && config.password) {
      const username = `${config.username}@${config.realm || 'pam'}`;
      logger.debug('proxmox', 'Authenticating with username/password', { username, realm: config.realm || 'pam' });

      // Proxmox requires form-urlencoded data for authentication
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', config.password);

      try {
        const response = await client.post('/access/ticket', params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        const { ticket, CSRFPreventionToken } = response.data.data;
        client.defaults.headers.common['Cookie'] = `PVEAuthCookie=${ticket}`;
        client.defaults.headers.common['CSRFPreventionToken'] = CSRFPreventionToken;
        logger.debug('proxmox', 'Authentication successful');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('proxmox', 'Authentication failed', { error: errorMsg, username });
        throw new Error(`Authentication failed: ${errorMsg}`);
      }
    } else {
      logger.warn('proxmox', 'No authentication credentials provided');
    }
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const proxmoxConfig = config as ProxmoxConfig;

    try {
      const client = this.createClient(proxmoxConfig);
      await this.authenticate(client, proxmoxConfig);

      const response = await client.get('/version');

      return {
        success: true,
        message: `Connected to Proxmox VE ${response.data.data.version}`,
        details: {
          version: response.data.data.version,
          release: response.data.data.release,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('proxmox', 'Connection test failed', { error: errorMsg });

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const proxmoxConfig = config as ProxmoxConfig;
    const client = this.createClient(proxmoxConfig);
    await this.authenticate(client, proxmoxConfig);

    switch (metric) {
      case 'nodes':
        return this.getNodes(client);
      case 'vms':
        return this.getVMs(client);
      case 'containers':
        return this.getContainers(client);
      case 'guests':
        return this.getGuests(client);
      case 'cluster':
        return this.getClusterResources(client);
      case 'storage':
        return this.getStorage(client);
      case 'tasks':
        return this.getTasks(client);
      case 'backups':
        return this.getBackupStatus(client);
      case 'rrddata':
        return this.getRrdData(client);
      case 'cluster-status':
        return this.getClusterStatus(client);
      case 'disks':
        return this.getDisks(client);
      case 'network':
        return this.getNetworks(client);
      case 'ceph':
        return this.getCephStatus(client);
      case 'ha':
        return this.getHAStatus(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getNodes(client: AxiosInstance): Promise<{ nodes: ProxmoxNode[] }> {
    const response = await client.get('/nodes');
    logger.debug('proxmox', 'Raw nodes list response', { data: response.data.data });

    // Fetch detailed status for all nodes in parallel
    const nodePromises = response.data.data.map(async (nodeInfo: Record<string, unknown>) => {
      try {
        const statusResponse = await client.get(`/nodes/${nodeInfo.node}/status`);
        const status = statusResponse.data.data;
        logger.debug('proxmox', `Raw status for node ${nodeInfo.node}`, { data: status });

        return {
          node: String(nodeInfo.node || 'unknown'),
          status: String(nodeInfo.status || 'unknown'),
          cpu: typeof status.cpu === 'number' ? status.cpu : 0,
          maxcpu: typeof status.cpuinfo?.cpus === 'number' ? status.cpuinfo.cpus : (typeof status.cpuinfo?.cores === 'number' ? status.cpuinfo.cores : 1),
          mem: typeof status.memory?.used === 'number' ? status.memory.used : 0,
          maxmem: typeof status.memory?.total === 'number' ? status.memory.total : 0,
          disk: typeof status.rootfs?.used === 'number' ? status.rootfs.used : 0,
          maxdisk: typeof status.rootfs?.total === 'number' ? status.rootfs.total : 0,
          uptime: typeof status.uptime === 'number' ? status.uptime : 0,
        };
      } catch (error) {
        logger.warn('proxmox', `Failed to fetch status for node ${nodeInfo.node}`, { error: String(error) });
        // Fall back to basic info from nodes list
        return {
          node: String(nodeInfo.node || 'unknown'),
          status: String(nodeInfo.status || 'unknown'),
          cpu: typeof nodeInfo.cpu === 'number' ? nodeInfo.cpu : 0,
          maxcpu: typeof nodeInfo.maxcpu === 'number' ? nodeInfo.maxcpu : 1,
          mem: typeof nodeInfo.mem === 'number' ? nodeInfo.mem : 0,
          maxmem: typeof nodeInfo.maxmem === 'number' ? nodeInfo.maxmem : 0,
          disk: typeof nodeInfo.disk === 'number' ? nodeInfo.disk : 0,
          maxdisk: typeof nodeInfo.maxdisk === 'number' ? nodeInfo.maxdisk : 0,
          uptime: typeof nodeInfo.uptime === 'number' ? nodeInfo.uptime : 0,
        };
      }
    });

    const nodes: ProxmoxNode[] = await Promise.all(nodePromises);
    logger.debug('proxmox', `Fetched ${nodes.length} nodes with status`, { nodes });
    return { nodes };
  }

  private async getVMs(client: AxiosInstance): Promise<{ vms: ProxmoxVM[] }> {
    const nodesResponse = await client.get('/nodes');

    // Fetch VMs from all nodes in parallel
    const vmPromises = nodesResponse.data.data.map(async (node: Record<string, unknown>) => {
      try {
        const vmResponse = await client.get(`/nodes/${node.node}/qemu`);
        logger.debug('proxmox', `Raw VMs for node ${node.node}`, { data: vmResponse.data.data });

        const vmList = vmResponse.data.data || [];
        return vmList.map((vm: Record<string, unknown>) => ({
          vmid: vm.vmid,
          name: vm.name || `VM ${vm.vmid}`,
          status: vm.status || 'unknown',
          cpu: typeof vm.cpu === 'number' ? vm.cpu : 0,
          cpus: vm.cpus || vm.maxcpu || 1,
          mem: typeof vm.mem === 'number' ? vm.mem : 0,
          maxmem: typeof vm.maxmem === 'number' ? vm.maxmem : 0,
          disk: typeof vm.disk === 'number' ? vm.disk : 0,
          maxdisk: typeof vm.maxdisk === 'number' ? vm.maxdisk : 0,
          uptime: typeof vm.uptime === 'number' ? vm.uptime : 0,
          node: node.node,
          type: 'qemu',
        }));
      } catch (error) {
        logger.warn('proxmox', `Failed to fetch VMs for node ${node.node}`, { error: String(error) });
        return [];
      }
    });

    const vmArrays = await Promise.all(vmPromises);
    const vms: ProxmoxVM[] = vmArrays.flat();
    logger.debug('proxmox', `Fetched ${vms.length} VMs total`);
    return { vms };
  }

  private async getContainers(client: AxiosInstance): Promise<{ containers: ProxmoxVM[] }> {
    const nodesResponse = await client.get('/nodes');

    // Fetch containers from all nodes in parallel
    const containerPromises = nodesResponse.data.data.map(async (node: Record<string, unknown>) => {
      try {
        const lxcResponse = await client.get(`/nodes/${node.node}/lxc`);
        logger.debug('proxmox', `Raw containers for node ${node.node}`, { data: lxcResponse.data.data });

        const ctList = lxcResponse.data.data || [];
        return ctList.map((ct: Record<string, unknown>) => ({
          vmid: ct.vmid,
          name: ct.name || `CT ${ct.vmid}`,
          status: ct.status || 'unknown',
          cpu: typeof ct.cpu === 'number' ? ct.cpu : 0,
          cpus: ct.cpus || ct.maxcpu || 1,
          mem: typeof ct.mem === 'number' ? ct.mem : 0,
          maxmem: typeof ct.maxmem === 'number' ? ct.maxmem : 0,
          disk: typeof ct.disk === 'number' ? ct.disk : 0,
          maxdisk: typeof ct.maxdisk === 'number' ? ct.maxdisk : 0,
          uptime: typeof ct.uptime === 'number' ? ct.uptime : 0,
          node: node.node,
          type: 'lxc',
        }));
      } catch (error) {
        logger.warn('proxmox', `Failed to fetch containers for node ${node.node}`, { error: String(error) });
        return [];
      }
    });

    const containerArrays = await Promise.all(containerPromises);
    const containers: ProxmoxVM[] = containerArrays.flat();
    logger.debug('proxmox', `Fetched ${containers.length} containers total`);
    return { containers };
  }

  private async getGuests(client: AxiosInstance): Promise<{ guests: ProxmoxVM[] }> {
    // Fetch both VMs and containers in parallel
    const [vmsResult, containersResult] = await Promise.all([
      this.getVMs(client),
      this.getContainers(client),
    ]);

    // Combine and add type field for display
    const guests: ProxmoxVM[] = [
      ...vmsResult.vms.map(vm => ({ ...vm, type: 'qemu' as const })),
      ...containersResult.containers.map(ct => ({ ...ct, type: 'lxc' as const })),
    ];

    logger.debug('proxmox', `Fetched ${guests.length} guests total (${vmsResult.vms.length} VMs, ${containersResult.containers.length} containers)`);
    return { guests };
  }

  private async getClusterResources(client: AxiosInstance): Promise<{ resources: unknown[] }> {
    const response = await client.get('/cluster/resources');
    logger.debug('proxmox', `Fetched ${response.data.data.length} cluster resources`);
    return { resources: response.data.data };
  }

  private async getStorage(client: AxiosInstance): Promise<{ storage: ProxmoxStorage[] }> {
    const nodesResponse = await client.get('/nodes');

    // Fetch storage from all nodes in parallel
    const storagePromises = nodesResponse.data.data.map(async (node: Record<string, unknown>) => {
      try {
        const storageResponse = await client.get(`/nodes/${node.node}/storage`);
        const storageList = storageResponse.data.data || [];

        return storageList.map((s: Record<string, unknown>) => ({
          storage: s.storage,
          node: node.node,
          type: s.type || 'unknown',
          content: s.content || '',
          used: s.used || 0,
          total: s.total || 0,
          avail: s.avail || 0,
          active: s.active === 1,
          enabled: s.enabled === 1,
          shared: s.shared === 1,
        }));
      } catch (error) {
        logger.warn('proxmox', `Failed to fetch storage for node ${node.node}`, { error: String(error) });
        return [];
      }
    });

    const storageArrays = await Promise.all(storagePromises);
    const storage: ProxmoxStorage[] = storageArrays.flat();
    logger.debug('proxmox', `Fetched ${storage.length} storage entries`);
    return { storage };
  }

  private async getTasks(client: AxiosInstance): Promise<{ tasks: ProxmoxTask[] }> {
    const nodesResponse = await client.get('/nodes');

    // Fetch tasks from all nodes in parallel
    const taskPromises = nodesResponse.data.data.map(async (node: Record<string, unknown>) => {
      try {
        const tasksResponse = await client.get(`/nodes/${node.node}/tasks`, {
          params: { limit: 50 },
        });
        const taskList = tasksResponse.data.data || [];

        return taskList.map((t: Record<string, unknown>) => ({
          upid: t.upid,
          node: t.node || node.node,
          type: t.type || 'unknown',
          status: t.status || 'unknown',
          user: t.user || 'unknown',
          starttime: t.starttime || 0,
          endtime: t.endtime,
          id: t.id,
          pstart: t.pstart,
        }));
      } catch (error) {
        logger.warn('proxmox', `Failed to fetch tasks for node ${node.node}`, { error: String(error) });
        return [];
      }
    });

    const taskArrays = await Promise.all(taskPromises);
    const tasks: ProxmoxTask[] = taskArrays.flat();

    // Sort by start time descending
    tasks.sort((a, b) => b.starttime - a.starttime);
    logger.debug('proxmox', `Fetched ${tasks.length} tasks`);
    return { tasks: tasks.slice(0, 100) };
  }

  private async getBackupStatus(client: AxiosInstance): Promise<{ notBackedUp: ProxmoxBackupInfo[]; jobs: ProxmoxBackupJob[] }> {
    const notBackedUp: ProxmoxBackupInfo[] = [];
    const jobs: ProxmoxBackupJob[] = [];

    try {
      const notBackedUpResponse = await client.get('/cluster/backup-info/not-backed-up');
      const list = notBackedUpResponse.data.data || [];
      for (const item of list) {
        notBackedUp.push({
          vmid: item.vmid,
          name: item.name || `VM ${item.vmid}`,
          type: item.type || 'qemu',
          node: item.node || 'unknown',
        });
      }
    } catch (error) {
      logger.warn('proxmox', 'Failed to fetch not-backed-up info', { error: String(error) });
    }

    try {
      const jobsResponse = await client.get('/cluster/backup');
      const jobList = jobsResponse.data.data || [];
      for (const job of jobList) {
        jobs.push({
          id: job.id,
          schedule: job.schedule || '',
          enabled: job.enabled === 1,
          storage: job.storage || '',
          vmid: job.vmid,
          node: job.node,
          mode: job.mode || 'snapshot',
          compress: job.compress || 'zstd',
          'next-run': job['next-run'],
        });
      }
    } catch (error) {
      logger.warn('proxmox', 'Failed to fetch backup jobs', { error: String(error) });
    }

    logger.debug('proxmox', `Fetched backup status: ${notBackedUp.length} not backed up, ${jobs.length} jobs`);
    return { notBackedUp, jobs };
  }

  private async getRrdData(client: AxiosInstance): Promise<{ rrddata: ProxmoxRrdDataPoint[]; nodeData: Record<string, ProxmoxRrdDataPoint[]>; nodes: string[] }> {
    const nodesResponse = await client.get('/nodes');
    const nodeNames: string[] = nodesResponse.data.data.map((n: Record<string, unknown>) => n.node as string);

    // Fetch RRD data from all nodes in parallel
    const rrdPromises = nodesResponse.data.data.map(async (node: Record<string, unknown>) => {
      try {
        const rrdResponse = await client.get(`/nodes/${node.node}/rrddata`, {
          params: { timeframe: 'hour' },
        });
        const dataPoints = rrdResponse.data.data || [];

        return dataPoints.map((point: Record<string, unknown>) => ({
          time: point.time,
          cpu: point.cpu,
          maxcpu: point.maxcpu,
          mem: point.memused || point.mem,
          maxmem: point.memtotal || point.maxmem,
          netin: point.netin,
          netout: point.netout,
          // For nodes, Proxmox provides iowait (I/O wait %) not diskread/diskwrite
          // diskread/diskwrite are only available for VM/container RRD data
          diskread: point.diskread,
          diskwrite: point.diskwrite,
          iowait: point.iowait,
          rootused: point.rootused,
          roottotal: point.roottotal,
          swapused: point.swapused,
          swaptotal: point.swaptotal,
          loadavg: point.loadavg,
          node: node.node,
        }));
      } catch (error) {
        logger.warn('proxmox', `Failed to fetch RRD data for node ${node.node}`, { error: String(error) });
        return [];
      }
    });

    const rrdArrays = await Promise.all(rrdPromises);
    const rrddata: ProxmoxRrdDataPoint[] = rrdArrays.flat();

    // Build nodeData map from flattened results
    const nodeData: Record<string, ProxmoxRrdDataPoint[]> = {};
    for (const nodeName of nodeNames) {
      nodeData[nodeName] = rrddata.filter(d => d.node === nodeName);
    }

    logger.debug('proxmox', `Fetched ${rrddata.length} RRD data points from ${nodeNames.length} nodes`);
    return { rrddata, nodeData, nodes: nodeNames };
  }

  private async getClusterStatus(client: AxiosInstance): Promise<{ status: ProxmoxClusterStatus[] }> {
    try {
      const response = await client.get('/cluster/status');
      const statusList = response.data.data || [];

      const status: ProxmoxClusterStatus[] = statusList.map((s: Record<string, unknown>) => ({
        type: s.type as string,
        name: s.name as string,
        id: s.id as string | undefined,
        nodes: s.nodes as number | undefined,
        quorate: s.quorate as number | undefined,
        version: s.version as number | undefined,
        online: (s.online as number) === 1,
        ip: s.ip as string | undefined,
        level: s.level as string | undefined,
        local: (s.local as number) === 1,
        nodeid: s.nodeid as number | undefined,
      }));

      logger.debug('proxmox', `Fetched cluster status: ${status.length} entries`);
      return { status };
    } catch (error) {
      logger.warn('proxmox', 'Failed to fetch cluster status', { error: String(error) });
      return { status: [] };
    }
  }

  private async getDisks(client: AxiosInstance): Promise<{ disks: ProxmoxDisk[] }> {
    const nodesResponse = await client.get('/nodes');

    // Fetch disks from all nodes in parallel
    const diskPromises = nodesResponse.data.data.map(async (node: Record<string, unknown>) => {
      try {
        const disksResponse = await client.get(`/nodes/${node.node}/disks/list`);
        const diskList = disksResponse.data.data || [];

        return diskList.map((d: Record<string, unknown>) => ({
          devpath: d.devpath,
          model: d.model || 'Unknown',
          serial: d.serial || '',
          size: d.size || 0,
          type: d.type || 'unknown',
          health: d.health,
          wearout: d.wearout,
          rpm: d.rpm,
          vendor: d.vendor,
          used: d.used,
          gpt: d.gpt === 1,
        }));
      } catch (error) {
        logger.warn('proxmox', `Failed to fetch disks for node ${node.node}`, { error: String(error) });
        return [];
      }
    });

    const diskArrays = await Promise.all(diskPromises);
    const disks: ProxmoxDisk[] = diskArrays.flat();
    logger.debug('proxmox', `Fetched ${disks.length} disks`);
    return { disks };
  }

  private async getNetworks(client: AxiosInstance): Promise<{ networks: ProxmoxNetwork[] }> {
    const nodesResponse = await client.get('/nodes');

    // Fetch networks from all nodes in parallel
    const networkPromises = nodesResponse.data.data.map(async (node: Record<string, unknown>) => {
      try {
        const networkResponse = await client.get(`/nodes/${node.node}/network`);
        const networkList = networkResponse.data.data || [];

        return networkList.map((n: Record<string, unknown>) => ({
          iface: n.iface,
          type: n.type || 'unknown',
          method: n.method,
          address: n.address,
          netmask: n.netmask,
          gateway: n.gateway,
          active: n.active === 1,
          autostart: n.autostart === 1,
          bridge_ports: n.bridge_ports,
          cidr: n.cidr,
        }));
      } catch (error) {
        logger.warn('proxmox', `Failed to fetch networks for node ${node.node}`, { error: String(error) });
        return [];
      }
    });

    const networkArrays = await Promise.all(networkPromises);
    const networks: ProxmoxNetwork[] = networkArrays.flat();
    logger.debug('proxmox', `Fetched ${networks.length} network interfaces`);
    return { networks };
  }

  private async getCephStatus(client: AxiosInstance): Promise<{ ceph: ProxmoxCephStatus | null; available: boolean }> {
    const nodesResponse = await client.get('/nodes');

    for (const node of nodesResponse.data.data) {
      try {
        const cephResponse = await client.get(`/nodes/${node.node}/ceph/status`);
        const data = cephResponse.data.data;

        const ceph: ProxmoxCephStatus = {
          health: {
            status: data.health?.status || 'UNKNOWN',
            checks: data.health?.checks,
          },
          pgmap: data.pgmap ? {
            pgs_by_state: data.pgmap.pgs_by_state || [],
            num_pgs: data.pgmap.num_pgs || 0,
            bytes_total: data.pgmap.bytes_total || 0,
            bytes_used: data.pgmap.bytes_used || 0,
            bytes_avail: data.pgmap.bytes_avail || 0,
          } : undefined,
          osdmap: data.osdmap?.osdmap ? {
            num_osds: data.osdmap.osdmap.num_osds || 0,
            num_up_osds: data.osdmap.osdmap.num_up_osds || 0,
            num_in_osds: data.osdmap.osdmap.num_in_osds || 0,
          } : undefined,
          monmap: data.monmap ? {
            mons: data.monmap.mons || [],
          } : undefined,
        };

        logger.debug('proxmox', 'Fetched Ceph status', { health: ceph.health.status });
        return { ceph, available: true };
      } catch (error) {
        // Ceph may not be installed, continue to next node
        logger.debug('proxmox', `Ceph not available on node ${node.node}`);
      }
    }

    logger.debug('proxmox', 'Ceph not available on any node');
    return { ceph: null, available: false };
  }

  private async getHAStatus(client: AxiosInstance): Promise<{ resources: ProxmoxHAResource[]; status: ProxmoxHAStatus | null }> {
    const resources: ProxmoxHAResource[] = [];
    let status: ProxmoxHAStatus | null = null;

    try {
      const resourcesResponse = await client.get('/cluster/ha/resources');
      const resourceList = resourcesResponse.data.data || [];

      for (const r of resourceList) {
        resources.push({
          sid: r.sid,
          type: r.type || 'vm',
          state: r.state || 'unknown',
          status: r.status || 'unknown',
          node: r.node || '',
          request_state: r.request_state,
          max_restart: r.max_restart,
          max_relocate: r.max_relocate,
          group: r.group,
        });
      }
    } catch (error) {
      logger.warn('proxmox', 'Failed to fetch HA resources', { error: String(error) });
    }

    try {
      const statusResponse = await client.get('/cluster/ha/status/current');
      const statusData = statusResponse.data.data || [];

      const quorumEntry = statusData.find((s: { type: string }) => s.type === 'quorum');
      const managerEntry = statusData.find((s: { type: string }) => s.type === 'manager');

      if (quorumEntry || managerEntry) {
        status = {
          quorum: {
            node: quorumEntry?.node || '',
            quorate: quorumEntry?.quorate === 1,
            local: quorumEntry?.local === 1,
          },
          manager_status: {
            master_node: managerEntry?.node || '',
            status: managerEntry?.status || 'unknown',
          },
        };
      }
    } catch (error) {
      logger.warn('proxmox', 'Failed to fetch HA status', { error: String(error) });
    }

    logger.debug('proxmox', `Fetched HA status: ${resources.length} resources`);
    return { resources, status };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'nodes',
        name: 'Nodes',
        description: 'List of Proxmox nodes with status and resource usage',
        widgetTypes: ['node-status', 'resource-usage'],
      },
      {
        id: 'vms',
        name: 'Virtual Machines',
        description: 'List of QEMU virtual machines across all nodes',
        widgetTypes: ['vm-list'],
      },
      {
        id: 'containers',
        name: 'Containers',
        description: 'List of LXC containers across all nodes',
        widgetTypes: ['container-list'],
      },
      {
        id: 'cluster',
        name: 'Cluster Resources',
        description: 'Overview of all cluster resources',
        widgetTypes: ['cluster-overview'],
      },
      {
        id: 'storage',
        name: 'Storage',
        description: 'Storage pools and usage across all nodes',
        widgetTypes: ['storage-status'],
      },
      {
        id: 'tasks',
        name: 'Tasks',
        description: 'Recent tasks and job status',
        widgetTypes: ['task-list'],
      },
      {
        id: 'backups',
        name: 'Backups',
        description: 'Backup status and VMs without recent backups',
        widgetTypes: ['backup-status'],
      },
      {
        id: 'rrddata',
        name: 'Metrics History',
        description: 'Historical CPU, memory, and network metrics',
        widgetTypes: ['metrics-chart'],
      },
      {
        id: 'cluster-status',
        name: 'Cluster Status',
        description: 'Cluster health, quorum, and node status',
        widgetTypes: ['cluster-status'],
      },
      {
        id: 'disks',
        name: 'Disks',
        description: 'Physical disk information and health',
        widgetTypes: ['disk-status'],
      },
      {
        id: 'network',
        name: 'Network',
        description: 'Network interfaces and configuration',
        widgetTypes: ['network-status'],
      },
      {
        id: 'ceph',
        name: 'Ceph',
        description: 'Ceph cluster status (if installed)',
        widgetTypes: ['ceph-status'],
      },
      {
        id: 'ha',
        name: 'High Availability',
        description: 'HA resources and status',
        widgetTypes: ['ha-status'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Cluster - Implemented
      {
        id: 'cluster-status',
        name: 'Get Cluster Status',
        description: 'Get cluster status including quorum and node health',
        method: 'GET',
        endpoint: '/cluster/status',
        implemented: true,
        category: 'Cluster',
        documentationUrl: 'https://pve.proxmox.com/pve-docs/api-viewer/#/cluster/status',
      },
      {
        id: 'cluster-resources',
        name: 'Get Cluster Resources',
        description: 'Get all resources in the cluster (VMs, containers, storage, nodes)',
        method: 'GET',
        endpoint: '/cluster/resources',
        implemented: true,
        category: 'Cluster',
      },
      {
        id: 'cluster-tasks',
        name: 'Get Cluster Tasks',
        description: 'Get recent cluster-wide tasks',
        method: 'GET',
        endpoint: '/cluster/tasks',
        implemented: true,
        category: 'Cluster',
      },
      {
        id: 'cluster-options',
        name: 'Get Cluster Options',
        description: 'Get cluster-wide options and configuration',
        method: 'GET',
        endpoint: '/cluster/options',
        implemented: false,
        category: 'Cluster',
      },
      {
        id: 'cluster-log',
        name: 'Get Cluster Log',
        description: 'Read cluster log',
        method: 'GET',
        endpoint: '/cluster/log',
        implemented: false,
        category: 'Cluster',
      },

      // Nodes - Implemented
      {
        id: 'nodes',
        name: 'List Nodes',
        description: 'Get list of all cluster nodes with status',
        method: 'GET',
        endpoint: '/nodes',
        implemented: true,
        category: 'Nodes',
      },
      {
        id: 'node-status',
        name: 'Get Node Status',
        description: 'Get detailed status of a specific node',
        method: 'GET',
        endpoint: '/nodes/{node}/status',
        implemented: true,
        category: 'Nodes',
        parameters: [
          { name: 'node', type: 'string', required: true, description: 'Node name' },
        ],
      },
      {
        id: 'node-rrddata',
        name: 'Get Node RRD Data',
        description: 'Get historical performance data for a node',
        method: 'GET',
        endpoint: '/nodes/{node}/rrddata',
        implemented: true,
        category: 'Nodes',
        parameters: [
          { name: 'node', type: 'string', required: true, description: 'Node name' },
          { name: 'timeframe', type: 'string', required: false, description: 'hour, day, week, month, year' },
        ],
      },
      {
        id: 'node-version',
        name: 'Get Node Version',
        description: 'Get Proxmox VE version info for a node',
        method: 'GET',
        endpoint: '/nodes/{node}/version',
        implemented: false,
        category: 'Nodes',
      },
      {
        id: 'node-time',
        name: 'Get Node Time',
        description: 'Get node time and timezone info',
        method: 'GET',
        endpoint: '/nodes/{node}/time',
        implemented: false,
        category: 'Nodes',
      },
      {
        id: 'node-dns',
        name: 'Get Node DNS',
        description: 'Get DNS configuration for a node',
        method: 'GET',
        endpoint: '/nodes/{node}/dns',
        implemented: false,
        category: 'Nodes',
      },
      {
        id: 'node-syslog',
        name: 'Get Node Syslog',
        description: 'Read system log from a node',
        method: 'GET',
        endpoint: '/nodes/{node}/syslog',
        implemented: false,
        category: 'Nodes',
      },
      {
        id: 'node-services',
        name: 'Get Node Services',
        description: 'Get list of services running on a node',
        method: 'GET',
        endpoint: '/nodes/{node}/services',
        implemented: false,
        category: 'Nodes',
      },
      {
        id: 'node-subscription',
        name: 'Get Node Subscription',
        description: 'Get subscription status for a node',
        method: 'GET',
        endpoint: '/nodes/{node}/subscription',
        implemented: false,
        category: 'Nodes',
      },

      // Virtual Machines - Implemented
      {
        id: 'qemu-list',
        name: 'List VMs',
        description: 'Get list of all QEMU VMs on a node',
        method: 'GET',
        endpoint: '/nodes/{node}/qemu',
        implemented: true,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-status',
        name: 'Get VM Status',
        description: 'Get current status of a specific VM',
        method: 'GET',
        endpoint: '/nodes/{node}/qemu/{vmid}/status/current',
        implemented: true,
        category: 'Virtual Machines',
        parameters: [
          { name: 'node', type: 'string', required: true, description: 'Node name' },
          { name: 'vmid', type: 'number', required: true, description: 'VM ID' },
        ],
      },
      {
        id: 'qemu-config',
        name: 'Get VM Config',
        description: 'Get VM configuration',
        method: 'GET',
        endpoint: '/nodes/{node}/qemu/{vmid}/config',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-start',
        name: 'Start VM',
        description: 'Start a virtual machine',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/status/start',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-stop',
        name: 'Stop VM',
        description: 'Stop a virtual machine (hard stop)',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/status/stop',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-shutdown',
        name: 'Shutdown VM',
        description: 'Shutdown a virtual machine (graceful)',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/status/shutdown',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-reboot',
        name: 'Reboot VM',
        description: 'Reboot a virtual machine',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/status/reboot',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-reset',
        name: 'Reset VM',
        description: 'Reset a virtual machine (hard reset)',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/status/reset',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-suspend',
        name: 'Suspend VM',
        description: 'Suspend a virtual machine',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/status/suspend',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-resume',
        name: 'Resume VM',
        description: 'Resume a suspended virtual machine',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/status/resume',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-clone',
        name: 'Clone VM',
        description: 'Create a copy of a virtual machine',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/clone',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-migrate',
        name: 'Migrate VM',
        description: 'Migrate a VM to another node',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/migrate',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-snapshot-list',
        name: 'List VM Snapshots',
        description: 'Get list of VM snapshots',
        method: 'GET',
        endpoint: '/nodes/{node}/qemu/{vmid}/snapshot',
        implemented: false,
        category: 'Virtual Machines',
      },
      {
        id: 'qemu-snapshot-create',
        name: 'Create VM Snapshot',
        description: 'Create a new VM snapshot',
        method: 'POST',
        endpoint: '/nodes/{node}/qemu/{vmid}/snapshot',
        implemented: false,
        category: 'Virtual Machines',
      },

      // Containers - Implemented
      {
        id: 'lxc-list',
        name: 'List Containers',
        description: 'Get list of all LXC containers on a node',
        method: 'GET',
        endpoint: '/nodes/{node}/lxc',
        implemented: true,
        category: 'Containers',
      },
      {
        id: 'lxc-status',
        name: 'Get Container Status',
        description: 'Get current status of a specific container',
        method: 'GET',
        endpoint: '/nodes/{node}/lxc/{vmid}/status/current',
        implemented: true,
        category: 'Containers',
      },
      {
        id: 'lxc-config',
        name: 'Get Container Config',
        description: 'Get container configuration',
        method: 'GET',
        endpoint: '/nodes/{node}/lxc/{vmid}/config',
        implemented: false,
        category: 'Containers',
      },
      {
        id: 'lxc-start',
        name: 'Start Container',
        description: 'Start a container',
        method: 'POST',
        endpoint: '/nodes/{node}/lxc/{vmid}/status/start',
        implemented: false,
        category: 'Containers',
      },
      {
        id: 'lxc-stop',
        name: 'Stop Container',
        description: 'Stop a container',
        method: 'POST',
        endpoint: '/nodes/{node}/lxc/{vmid}/status/stop',
        implemented: false,
        category: 'Containers',
      },
      {
        id: 'lxc-shutdown',
        name: 'Shutdown Container',
        description: 'Shutdown a container (graceful)',
        method: 'POST',
        endpoint: '/nodes/{node}/lxc/{vmid}/status/shutdown',
        implemented: false,
        category: 'Containers',
      },

      // Storage - Implemented
      {
        id: 'storage-list',
        name: 'List Storage',
        description: 'Get storage configuration',
        method: 'GET',
        endpoint: '/storage',
        implemented: true,
        category: 'Storage',
      },
      {
        id: 'node-storage',
        name: 'Get Node Storage Status',
        description: 'Get storage status for a specific node',
        method: 'GET',
        endpoint: '/nodes/{node}/storage',
        implemented: true,
        category: 'Storage',
      },
      {
        id: 'storage-content',
        name: 'Get Storage Content',
        description: 'List storage content (ISO images, backups, etc.)',
        method: 'GET',
        endpoint: '/nodes/{node}/storage/{storage}/content',
        implemented: false,
        category: 'Storage',
      },

      // Disks - Implemented
      {
        id: 'disks-list',
        name: 'List Disks',
        description: 'Get list of physical disks on a node',
        method: 'GET',
        endpoint: '/nodes/{node}/disks/list',
        implemented: true,
        category: 'Disks',
      },
      {
        id: 'disks-smart',
        name: 'Get Disk SMART',
        description: 'Get SMART health data for a disk',
        method: 'GET',
        endpoint: '/nodes/{node}/disks/smart',
        implemented: false,
        category: 'Disks',
      },
      {
        id: 'disks-lvm',
        name: 'List LVM',
        description: 'List LVM volume groups',
        method: 'GET',
        endpoint: '/nodes/{node}/disks/lvm',
        implemented: false,
        category: 'Disks',
      },
      {
        id: 'disks-zfs',
        name: 'List ZFS Pools',
        description: 'List ZFS pools on a node',
        method: 'GET',
        endpoint: '/nodes/{node}/disks/zfs',
        implemented: false,
        category: 'Disks',
      },

      // Network - Implemented
      {
        id: 'network-list',
        name: 'List Network Interfaces',
        description: 'Get network interface configuration',
        method: 'GET',
        endpoint: '/nodes/{node}/network',
        implemented: true,
        category: 'Network',
      },

      // Ceph - Implemented
      {
        id: 'ceph-status',
        name: 'Get Ceph Status',
        description: 'Get Ceph cluster status',
        method: 'GET',
        endpoint: '/nodes/{node}/ceph/status',
        implemented: true,
        category: 'Ceph',
      },
      {
        id: 'ceph-osd',
        name: 'List Ceph OSDs',
        description: 'Get list of Ceph OSDs',
        method: 'GET',
        endpoint: '/nodes/{node}/ceph/osd',
        implemented: false,
        category: 'Ceph',
      },
      {
        id: 'ceph-mon',
        name: 'List Ceph Monitors',
        description: 'Get list of Ceph monitors',
        method: 'GET',
        endpoint: '/nodes/{node}/ceph/mon',
        implemented: false,
        category: 'Ceph',
      },
      {
        id: 'ceph-pools',
        name: 'List Ceph Pools',
        description: 'Get list of Ceph pools',
        method: 'GET',
        endpoint: '/nodes/{node}/ceph/pool',
        implemented: false,
        category: 'Ceph',
      },

      // High Availability - Implemented
      {
        id: 'ha-status',
        name: 'Get HA Status',
        description: 'Get HA manager status',
        method: 'GET',
        endpoint: '/cluster/ha/status/current',
        implemented: true,
        category: 'High Availability',
      },
      {
        id: 'ha-resources',
        name: 'List HA Resources',
        description: 'Get list of HA resources',
        method: 'GET',
        endpoint: '/cluster/ha/resources',
        implemented: true,
        category: 'High Availability',
      },
      {
        id: 'ha-groups',
        name: 'List HA Groups',
        description: 'Get list of HA groups',
        method: 'GET',
        endpoint: '/cluster/ha/groups',
        implemented: false,
        category: 'High Availability',
      },

      // Backup - Implemented
      {
        id: 'backup-jobs',
        name: 'List Backup Jobs',
        description: 'Get scheduled backup jobs',
        method: 'GET',
        endpoint: '/cluster/backup',
        implemented: true,
        category: 'Backup',
      },
      {
        id: 'backup-run',
        name: 'Run Backup',
        description: 'Start a backup job immediately',
        method: 'POST',
        endpoint: '/nodes/{node}/vzdump',
        implemented: false,
        category: 'Backup',
      },

      // Firewall
      {
        id: 'firewall-options',
        name: 'Get Firewall Options',
        description: 'Get cluster firewall options',
        method: 'GET',
        endpoint: '/cluster/firewall/options',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-rules',
        name: 'List Firewall Rules',
        description: 'Get cluster firewall rules',
        method: 'GET',
        endpoint: '/cluster/firewall/rules',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-groups',
        name: 'List Firewall Groups',
        description: 'Get firewall security groups',
        method: 'GET',
        endpoint: '/cluster/firewall/groups',
        implemented: false,
        category: 'Firewall',
      },

      // Access Control
      {
        id: 'access-users',
        name: 'List Users',
        description: 'Get list of users',
        method: 'GET',
        endpoint: '/access/users',
        implemented: false,
        category: 'Access Control',
      },
      {
        id: 'access-groups',
        name: 'List Groups',
        description: 'Get list of user groups',
        method: 'GET',
        endpoint: '/access/groups',
        implemented: false,
        category: 'Access Control',
      },
      {
        id: 'access-roles',
        name: 'List Roles',
        description: 'Get list of roles',
        method: 'GET',
        endpoint: '/access/roles',
        implemented: false,
        category: 'Access Control',
      },
      {
        id: 'access-acl',
        name: 'Get ACL',
        description: 'Get access control list',
        method: 'GET',
        endpoint: '/access/acl',
        implemented: false,
        category: 'Access Control',
      },

      // Pools
      {
        id: 'pools-list',
        name: 'List Pools',
        description: 'Get list of resource pools',
        method: 'GET',
        endpoint: '/pools',
        implemented: false,
        category: 'Pools',
      },
    ];
  }
}
