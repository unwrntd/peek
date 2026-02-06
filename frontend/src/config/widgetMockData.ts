/**
 * Comprehensive mock data for widget previews in the Layout Editor.
 * This data is used to render actual widget components with realistic sample data.
 */

// Beszel System Stats mock data
export const beszelSystemStatsMockData = {
  stats: [
    {
      id: 'mock-system-1',
      system: "Evin's Desktop",
      cpu: 0,
      mem: 10,
      disk: 38,
      cores: 12,
      memUsed: 6764240896,
      memTotal: 67645734912,
      diskUsed: 684354560000,
      diskTotal: 1800000000000,
      netIn: 1250000,
      netOut: 450000,
      temps: [
        { name: 'GeForce RTX 4090', temp: 30 },
        { name: 'CPU Package', temp: 45 },
      ],
    },
  ],
};

// Proxmox mock data
export const proxmoxVmsMockData = {
  vms: [
    { vmid: 100, name: 'web-server-01', status: 'running', node: 'pve1', cpu: 0.25, mem: 2147483648, maxmem: 4294967296, uptime: 86400 },
    { vmid: 101, name: 'db-server-01', status: 'running', node: 'pve1', cpu: 0.15, mem: 4294967296, maxmem: 8589934592, uptime: 172800 },
    { vmid: 102, name: 'dev-vm', status: 'stopped', node: 'pve2', cpu: 0, mem: 0, maxmem: 2147483648, uptime: 0 },
  ],
};

export const proxmoxNodesMockData = {
  nodes: [
    { node: 'pve1', status: 'online', cpu: 0.35, maxcpu: 8, mem: 8589934592, maxmem: 17179869184, disk: 107374182400, maxdisk: 500000000000, uptime: 604800 },
    { node: 'pve2', status: 'online', cpu: 0.22, maxcpu: 8, mem: 6442450944, maxmem: 17179869184, disk: 85899345920, maxdisk: 500000000000, uptime: 432000 },
  ],
};

export const proxmoxContainersMockData = {
  containers: [
    { vmid: 200, name: 'docker-host', status: 'running', node: 'pve1', cpu: 0.15, mem: 1073741824, maxmem: 2147483648, uptime: 172800 },
    { vmid: 201, name: 'nginx-proxy', status: 'running', node: 'pve1', cpu: 0.05, mem: 268435456, maxmem: 536870912, uptime: 259200 },
  ],
};

// UniFi mock data
export const unifiClientsMockData = {
  clients: [
    { _id: '1', hostname: 'Johns-MacBook', ip: '192.168.1.100', mac: '00:11:22:33:44:55', is_wired: false, network: 'LAN', uptime: 7200, tx_bytes: 1073741824, rx_bytes: 5368709120 },
    { _id: '2', hostname: 'Living-Room-TV', ip: '192.168.1.101', mac: '00:11:22:33:44:56', is_wired: true, network: 'LAN', uptime: 86400, tx_bytes: 536870912, rx_bytes: 10737418240 },
    { _id: '3', hostname: 'iPhone-Jane', ip: '192.168.1.102', mac: '00:11:22:33:44:57', is_wired: false, network: 'LAN', uptime: 3600, tx_bytes: 268435456, rx_bytes: 1073741824 },
  ],
  totalClients: 45,
  wiredClients: 12,
  wirelessClients: 33,
};

export const unifiDevicesMockData = {
  devices: [
    { _id: '1', name: 'Office Switch', model: 'USW-24-POE', type: 'usw', state: 1, ip: '192.168.1.5', mac: 'aa:bb:cc:dd:ee:ff', uptime: 1209600, version: '6.5.59' },
    { _id: '2', name: 'Living Room AP', model: 'U6-Pro', type: 'uap', state: 1, ip: '192.168.1.6', mac: 'aa:bb:cc:dd:ee:00', uptime: 1209600, version: '6.5.59' },
    { _id: '3', name: 'Dream Machine', model: 'UDM-Pro', type: 'udm', state: 1, ip: '192.168.1.1', mac: 'aa:bb:cc:dd:ee:01', uptime: 2592000, version: '3.1.16' },
  ],
};

// Plex mock data
export const plexNowPlayingMockData = {
  sessions: [
    { title: 'Breaking Bad S01E01', type: 'episode', user: 'John', player: 'Living Room TV', state: 'playing', progress: 0.35, duration: 3600, quality: '1080p', transcoding: false },
  ],
  count: 1,
};

export const plexLibraryMockData = {
  libraries: [
    { name: 'Movies', type: 'movie', count: 500, size: 5000000000000 },
    { name: 'TV Shows', type: 'show', count: 150, size: 3000000000000 },
    { name: 'Music', type: 'artist', count: 1000, size: 100000000000 },
  ],
};

// AdGuard mock data
export const adguardStatsMockData = {
  num_dns_queries: 50000,
  num_blocked_filtering: 15000,
  num_replaced_safebrowsing: 50,
  num_replaced_safesearch: 100,
  num_replaced_parental: 25,
  avg_processing_time: 25,
  totalClients: 20,
};

// Sonarr mock data
export const sonarrSeriesMockData = {
  series: [
    { id: 1, title: 'Breaking Bad', year: 2008, status: 'ended', network: 'AMC', episodeCount: 62, episodeFileCount: 62, sizeOnDisk: 150000000000 },
    { id: 2, title: 'The Mandalorian', year: 2019, status: 'continuing', network: 'Disney+', episodeCount: 24, episodeFileCount: 24, sizeOnDisk: 80000000000 },
  ],
};

export const sonarrQueueMockData = {
  records: [
    { id: 1, title: 'Breaking Bad S01E01', status: 'downloading', quality: { quality: { name: '1080p HDTV' } }, size: 1500000000, sizeleft: 750000000, timeleft: '15:30' },
  ],
};

// Radarr mock data
export const radarrMoviesMockData = {
  movies: [
    { id: 1, title: 'Oppenheimer', year: 2023, status: 'released', hasFile: true, sizeOnDisk: 80000000000 },
    { id: 2, title: 'Dune Part Two', year: 2024, status: 'released', hasFile: false, sizeOnDisk: 0 },
  ],
};

// Tautulli mock data
export const tautulliActivityMockData = {
  response: {
    data: {
      stream_count: 5,
      stream_count_transcode: 2,
      stream_count_direct_play: 2,
      stream_count_direct_stream: 1,
      total_bandwidth: 50000,
      lan_bandwidth: 30000,
      wan_bandwidth: 20000,
    },
  },
};

// Get mock data for a specific widget type
export function getMockDataForWidgetType(widgetType: string): Record<string, unknown> {
  const mockDataMap: Record<string, Record<string, unknown>> = {
    // Beszel
    'beszel-system-stats': beszelSystemStatsMockData,
    'system-stats': beszelSystemStatsMockData,

    // Proxmox
    'vm-list': proxmoxVmsMockData,
    'vms': proxmoxVmsMockData,
    'container-list': proxmoxContainersMockData,
    'containers': proxmoxContainersMockData,
    'node-status': proxmoxNodesMockData,
    'nodes': proxmoxNodesMockData,
    'resource-usage': proxmoxNodesMockData,

    // UniFi
    'client-list': unifiClientsMockData,
    'client-count': unifiClientsMockData,
    'clients': unifiClientsMockData,
    'active-devices': unifiDevicesMockData,
    'devices': unifiDevicesMockData,

    // Plex
    'plex-now-playing': plexNowPlayingMockData,
    'now-playing': plexNowPlayingMockData,
    'plex-library-stats': plexLibraryMockData,
    'library-stats': plexLibraryMockData,

    // AdGuard
    'adguard-stats': adguardStatsMockData,
    'stats-overview': adguardStatsMockData,

    // Sonarr
    'sonarr-series': sonarrSeriesMockData,
    'sonarr-queue': sonarrQueueMockData,

    // Radarr
    'radarr-movies': radarrMoviesMockData,

    // Tautulli
    'tautulli-activity': tautulliActivityMockData,
  };

  return mockDataMap[widgetType] || {};
}
