import Docker from 'dockerode';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  DockerConfig,
  DockerContainer,
  DockerContainerStats,
  DockerSystemInfo,
  DockerDiskUsage,
  DockerImage,
  DockerNetwork,
  DockerVolume,
  DockerLogEntry,
} from '../types';
import { logger } from '../services/logger';

export class DockerIntegration extends BaseIntegration {
  readonly type = 'docker';
  readonly name = 'Docker';

  private createClient(config: DockerConfig): Docker {
    if (config.connectionType === 'socket') {
      return new Docker({
        socketPath: config.socketPath || '/var/run/docker.sock',
      });
    } else {
      const options: Docker.DockerOptions = {
        host: config.host,
        port: config.port || 2376,
      };

      if (config.useTls) {
        options.ca = config.tlsCa;
        options.cert = config.tlsCert;
        options.key = config.tlsKey;
      }

      return new Docker(options);
    }
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const dockerConfig = config as DockerConfig;

    try {
      const docker = this.createClient(dockerConfig);
      const version = await docker.version();

      return {
        success: true,
        message: `Connected to Docker ${version.Version}`,
        details: {
          version: version.Version,
          apiVersion: version.ApiVersion,
          os: version.Os,
          arch: version.Arch,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('docker', 'Connection test failed', { error: errorMsg });

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const dockerConfig = config as DockerConfig;
    const docker = this.createClient(dockerConfig);

    switch (metric) {
      case 'containers':
        return this.getContainers(docker);
      case 'container-stats':
        return this.getAllContainerStats(docker);
      case 'system':
        return this.getSystemInfo(docker);
      case 'disk-usage':
        return this.getDiskUsage(docker);
      case 'images':
        return this.getImages(docker);
      case 'networks':
        return this.getNetworks(docker);
      case 'volumes':
        return this.getVolumes(docker);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getContainers(docker: Docker): Promise<{
    containers: DockerContainer[];
    total: number;
    running: number;
    stopped: number;
    paused: number;
  }> {
    const containers = await docker.listContainers({ all: true });

    const result: DockerContainer[] = containers.map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || c.Id.substring(0, 12),
      image: c.Image,
      imageId: c.ImageID,
      state: c.State as DockerContainer['state'],
      status: c.Status,
      created: c.Created,
      ports: c.Ports.map((p) => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
        ip: p.IP,
      })),
      labels: c.Labels || {},
      networkMode: c.HostConfig?.NetworkMode,
      mounts: c.Mounts?.map((m) => ({
        type: m.Type,
        source: m.Source,
        destination: m.Destination,
        mode: m.Mode,
      })),
    }));

    const running = result.filter((c) => c.state === 'running').length;
    const paused = result.filter((c) => c.state === 'paused').length;
    const stopped = result.filter((c) => c.state === 'exited').length;

    return {
      containers: result,
      total: result.length,
      running,
      stopped,
      paused,
    };
  }

  private async getContainerStats(docker: Docker, containerId: string): Promise<DockerContainerStats | null> {
    try {
      const container = docker.getContainer(containerId);
      const info = await container.inspect();
      const stats = await container.stats({ stream: false });

      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;

      // Calculate memory
      const memUsed = stats.memory_stats.usage || 0;
      const memLimit = stats.memory_stats.limit || 1;
      const memPercent = (memUsed / memLimit) * 100;

      // Calculate network I/O
      let rxBytes = 0;
      let txBytes = 0;
      if (stats.networks) {
        for (const net of Object.values(stats.networks)) {
          rxBytes += (net as { rx_bytes?: number }).rx_bytes || 0;
          txBytes += (net as { tx_bytes?: number }).tx_bytes || 0;
        }
      }

      // Calculate block I/O
      let readBytes = 0;
      let writeBytes = 0;
      if (stats.blkio_stats?.io_service_bytes_recursive) {
        for (const entry of stats.blkio_stats.io_service_bytes_recursive) {
          if (entry.op === 'Read' || entry.op === 'read') readBytes += entry.value;
          if (entry.op === 'Write' || entry.op === 'write') writeBytes += entry.value;
        }
      }

      return {
        containerId,
        containerName: info.Name.replace(/^\//, ''),
        cpu: {
          percent: cpuPercent,
          cores: stats.cpu_stats.online_cpus || 1,
        },
        memory: {
          used: memUsed,
          limit: memLimit,
          percent: memPercent,
        },
        network: {
          rxBytes,
          txBytes,
          rxRate: 0, // Would need time-based calculation
          txRate: 0,
        },
        blockIo: {
          read: readBytes,
          write: writeBytes,
        },
        pids: stats.pids_stats?.current || 0,
      };
    } catch (error) {
      logger.debug('docker', `Failed to get stats for container ${containerId}`, { error });
      return null;
    }
  }

  private async getAllContainerStats(docker: Docker): Promise<{
    stats: DockerContainerStats[];
  }> {
    const containers = await docker.listContainers({ filters: { status: ['running'] } });
    const stats: DockerContainerStats[] = [];

    for (const c of containers) {
      const containerStats = await this.getContainerStats(docker, c.Id);
      if (containerStats) {
        stats.push(containerStats);
      }
    }

    return { stats };
  }

  private async getSystemInfo(docker: Docker): Promise<{ system: DockerSystemInfo }> {
    const info = await docker.info();
    const version = await docker.version();

    return {
      system: {
        dockerVersion: version.Version,
        apiVersion: version.ApiVersion,
        osType: info.OSType || '',
        architecture: info.Architecture,
        kernelVersion: info.KernelVersion,
        operatingSystem: info.OperatingSystem,
        containers: info.Containers,
        containersRunning: info.ContainersRunning,
        containersPaused: info.ContainersPaused,
        containersStopped: info.ContainersStopped,
        images: info.Images,
        memoryTotal: info.MemTotal,
        cpus: info.NCPU,
        storageDriver: info.Driver,
        serverVersion: info.ServerVersion,
      },
    };
  }

  private async getDiskUsage(docker: Docker): Promise<{ diskUsage: DockerDiskUsage }> {
    const df = await docker.df();

    let imagesSize = 0;
    let imagesReclaimable = 0;
    let imagesActive = 0;
    for (const img of df.Images || []) {
      imagesSize += img.Size || 0;
      if (img.Containers === 0) {
        imagesReclaimable += img.Size || 0;
      } else {
        imagesActive++;
      }
    }

    let containersSize = 0;
    let containersReclaimable = 0;
    let containersRunning = 0;
    for (const c of df.Containers || []) {
      containersSize += c.SizeRw || 0;
      if (c.State !== 'running') {
        containersReclaimable += c.SizeRw || 0;
      } else {
        containersRunning++;
      }
    }

    let volumesSize = 0;
    let volumesReclaimable = 0;
    let volumesActive = 0;
    for (const v of df.Volumes || []) {
      volumesSize += v.UsageData?.Size || 0;
      if (v.UsageData?.RefCount === 0) {
        volumesReclaimable += v.UsageData?.Size || 0;
      } else {
        volumesActive++;
      }
    }

    let buildCacheSize = 0;
    let buildCacheReclaimable = 0;
    for (const bc of df.BuildCache || []) {
      buildCacheSize += bc.Size || 0;
      if (!bc.InUse) {
        buildCacheReclaimable += bc.Size || 0;
      }
    }

    return {
      diskUsage: {
        images: {
          totalCount: df.Images?.length || 0,
          activeCount: imagesActive,
          totalSize: imagesSize,
          reclaimableSize: imagesReclaimable,
        },
        containers: {
          totalCount: df.Containers?.length || 0,
          runningCount: containersRunning,
          totalSize: containersSize,
          reclaimableSize: containersReclaimable,
        },
        volumes: {
          totalCount: df.Volumes?.length || 0,
          activeCount: volumesActive,
          totalSize: volumesSize,
          reclaimableSize: volumesReclaimable,
        },
        buildCache: {
          totalCount: df.BuildCache?.length || 0,
          inUseCount: df.BuildCache?.filter((bc: { InUse: boolean }) => bc.InUse).length || 0,
          totalSize: buildCacheSize,
          reclaimableSize: buildCacheReclaimable,
        },
        totalSize: imagesSize + containersSize + volumesSize + buildCacheSize,
        totalReclaimable: imagesReclaimable + containersReclaimable + volumesReclaimable + buildCacheReclaimable,
      },
    };
  }

  private async getImages(docker: Docker): Promise<{
    images: DockerImage[];
    totalSize: number;
    totalImages: number;
  }> {
    const images = await docker.listImages({ all: true });

    const result: DockerImage[] = images.map((img) => ({
      id: img.Id,
      repoTags: img.RepoTags || ['<none>:<none>'],
      repoDigests: img.RepoDigests || [],
      size: img.Size,
      created: img.Created,
      containers: img.Containers || 0,
      dangling: !img.RepoTags || img.RepoTags.length === 0 || img.RepoTags[0] === '<none>:<none>',
    }));

    const totalSize = result.reduce((sum, img) => sum + img.size, 0);

    return {
      images: result,
      totalSize,
      totalImages: result.length,
    };
  }

  private async getNetworks(docker: Docker): Promise<{
    networks: DockerNetwork[];
  }> {
    const networks = await docker.listNetworks();

    const result: DockerNetwork[] = await Promise.all(
      networks.map(async (net) => {
        const network = docker.getNetwork(net.Id);
        const details = await network.inspect();

        const containerCount = Object.keys(details.Containers || {}).length;
        const ipamConfig = details.IPAM?.Config?.[0];

        return {
          id: net.Id,
          name: net.Name,
          driver: net.Driver,
          scope: net.Scope,
          subnet: ipamConfig?.Subnet,
          gateway: ipamConfig?.Gateway,
          containerCount,
          internal: details.Internal || false,
          attachable: details.Attachable || false,
        };
      })
    );

    return { networks: result };
  }

  private async getVolumes(docker: Docker): Promise<{
    volumes: DockerVolume[];
    totalVolumes: number;
    unusedVolumes: number;
  }> {
    const volumeList = await docker.listVolumes();
    const containers = await docker.listContainers({ all: true });

    // Build set of used volumes
    const usedVolumes = new Set<string>();
    for (const c of containers) {
      for (const mount of c.Mounts || []) {
        if (mount.Name) {
          usedVolumes.add(mount.Name);
        }
      }
    }

    const result: DockerVolume[] = (volumeList.Volumes || []).map((vol) => ({
      name: vol.Name,
      driver: vol.Driver,
      mountpoint: vol.Mountpoint,
      createdAt: (vol as { CreatedAt?: string }).CreatedAt || '',
      inUse: usedVolumes.has(vol.Name),
      labels: vol.Labels || {},
    }));

    const unusedVolumes = result.filter((v) => !v.inUse).length;

    return {
      volumes: result,
      totalVolumes: result.length,
      unusedVolumes,
    };
  }

  async getContainerLogs(
    config: IntegrationConfig,
    containerId: string,
    tail: number = 100
  ): Promise<{ logs: DockerLogEntry[]; containerId: string; containerName: string }> {
    const dockerConfig = config as DockerConfig;
    const docker = this.createClient(dockerConfig);
    const container = docker.getContainer(containerId);

    const info = await container.inspect();
    const logBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    const logs: DockerLogEntry[] = [];
    const logString = logBuffer.toString('utf8');
    const lines = logString.split('\n').filter((line) => line.length > 0);

    for (const line of lines) {
      // Docker log format includes 8-byte header for multiplexed streams
      // We'll parse the timestamp and content
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
      if (match) {
        logs.push({
          timestamp: match[1],
          stream: 'stdout', // Simplified - would need proper demuxing for accurate stream detection
          message: match[2],
        });
      } else if (line.length > 8) {
        // Handle binary header case
        const stream = line.charCodeAt(0) === 2 ? 'stderr' : 'stdout';
        const content = line.substring(8);
        const tsMatch = content.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
        if (tsMatch) {
          logs.push({
            timestamp: tsMatch[1],
            stream,
            message: tsMatch[2],
          });
        } else {
          logs.push({
            timestamp: new Date().toISOString(),
            stream,
            message: content,
          });
        }
      }
    }

    return {
      logs,
      containerId,
      containerName: info.Name.replace(/^\//, ''),
    };
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'containers',
        name: 'Containers',
        description: 'List of all Docker containers',
        widgetTypes: ['docker-container-list'],
      },
      {
        id: 'container-stats',
        name: 'Container Stats',
        description: 'Resource usage statistics for running containers',
        widgetTypes: ['docker-container-stats'],
      },
      {
        id: 'system',
        name: 'System Info',
        description: 'Docker system and host information',
        widgetTypes: ['docker-system-overview'],
      },
      {
        id: 'disk-usage',
        name: 'Disk Usage',
        description: 'Docker disk space consumption',
        widgetTypes: ['docker-disk-usage'],
      },
      {
        id: 'images',
        name: 'Images',
        description: 'List of Docker images',
        widgetTypes: ['docker-image-list'],
      },
      {
        id: 'networks',
        name: 'Networks',
        description: 'Docker networks overview',
        widgetTypes: ['docker-network-overview'],
      },
      {
        id: 'volumes',
        name: 'Volumes',
        description: 'Docker volumes overview',
        widgetTypes: ['docker-volume-list'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Data endpoints
      ...this.getAvailableMetrics().map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        method: 'GET' as const,
        endpoint: `/${m.id}`,
        implemented: true,
        category: 'Data',
      })),
      // Container actions
      {
        id: 'startContainer',
        name: 'Start Container',
        description: 'Start a stopped container',
        method: 'POST' as const,
        endpoint: '/containers/{containerId}/start',
        implemented: true,
        category: 'Container Management',
        parameters: [
          { name: 'containerId', type: 'string', required: true, description: 'Container ID or name' },
        ],
      },
      {
        id: 'stopContainer',
        name: 'Stop Container',
        description: 'Stop a running container',
        method: 'POST' as const,
        endpoint: '/containers/{containerId}/stop',
        implemented: true,
        category: 'Container Management',
        parameters: [
          { name: 'containerId', type: 'string', required: true, description: 'Container ID or name' },
          { name: 'timeout', type: 'number', required: false, description: 'Seconds to wait before killing' },
        ],
      },
      {
        id: 'restartContainer',
        name: 'Restart Container',
        description: 'Restart a container',
        method: 'POST' as const,
        endpoint: '/containers/{containerId}/restart',
        implemented: true,
        category: 'Container Management',
        parameters: [
          { name: 'containerId', type: 'string', required: true, description: 'Container ID or name' },
        ],
      },
      {
        id: 'killContainer',
        name: 'Kill Container',
        description: 'Kill a container',
        method: 'POST' as const,
        endpoint: '/containers/{containerId}/kill',
        implemented: true,
        category: 'Container Management',
        parameters: [
          { name: 'containerId', type: 'string', required: true, description: 'Container ID or name' },
          { name: 'signal', type: 'string', required: false, description: 'Signal to send (default: SIGKILL)' },
        ],
      },
      // Cleanup operations
      {
        id: 'pruneContainers',
        name: 'Prune Containers',
        description: 'Remove stopped containers',
        method: 'POST' as const,
        endpoint: '/containers/prune',
        implemented: true,
        category: 'Cleanup',
      },
      {
        id: 'pruneImages',
        name: 'Prune Images',
        description: 'Remove unused images',
        method: 'POST' as const,
        endpoint: '/images/prune',
        implemented: true,
        category: 'Cleanup',
        parameters: [
          { name: 'dangling', type: 'boolean', required: false, description: 'Only remove dangling images' },
        ],
      },
      {
        id: 'pruneVolumes',
        name: 'Prune Volumes',
        description: 'Remove unused volumes',
        method: 'POST' as const,
        endpoint: '/volumes/prune',
        implemented: true,
        category: 'Cleanup',
      },
    ];
  }

  // Execute container actions
  async executeAction(
    config: IntegrationConfig,
    action: string,
    params: Record<string, unknown>
  ): Promise<{ success: boolean; message: string; data?: unknown }> {
    const dockerConfig = config as DockerConfig;

    if (dockerConfig.readOnly) {
      return { success: false, message: 'Integration is in read-only mode' };
    }

    const docker = this.createClient(dockerConfig);

    try {
      switch (action) {
        case 'startContainer': {
          const container = docker.getContainer(params.containerId as string);
          await container.start();
          return { success: true, message: 'Container started' };
        }
        case 'stopContainer': {
          const container = docker.getContainer(params.containerId as string);
          await container.stop({ t: (params.timeout as number) || 10 });
          return { success: true, message: 'Container stopped' };
        }
        case 'restartContainer': {
          const container = docker.getContainer(params.containerId as string);
          await container.restart();
          return { success: true, message: 'Container restarted' };
        }
        case 'killContainer': {
          const container = docker.getContainer(params.containerId as string);
          await container.kill({ signal: (params.signal as string) || 'SIGKILL' });
          return { success: true, message: 'Container killed' };
        }
        case 'pruneContainers': {
          const result = await docker.pruneContainers();
          return {
            success: true,
            message: `Removed ${result.ContainersDeleted?.length || 0} containers`,
            data: result,
          };
        }
        case 'pruneImages': {
          const result = await docker.pruneImages({ dangling: params.dangling as boolean });
          return {
            success: true,
            message: `Reclaimed ${formatBytes(result.SpaceReclaimed || 0)}`,
            data: result,
          };
        }
        case 'pruneVolumes': {
          const result = await docker.pruneVolumes();
          return {
            success: true,
            message: `Removed ${result.VolumesDeleted?.length || 0} volumes`,
            data: result,
          };
        }
        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('docker', `Action ${action} failed`, { error: errorMsg });
      return { success: false, message: errorMsg };
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
