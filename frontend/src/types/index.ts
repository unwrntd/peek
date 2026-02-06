export interface Integration {
  id: string;
  type: 'proxmox' | 'unifi' | 'unifi-protect' | 'beszel' | 'adguard' | 'qnap' | 'plex' | 'cisco-iosxe' | 'pikvm' | 'tautulli' | 'tapo' | 'kasa' | 'overseerr' | 'homeconnect' | 'sonarr' | 'radarr' | 'tdarr' | 'bazarr' | 'prowlarr' | 'sabnzbd' | 'qbittorrent' | 'ring' | 'immich' | 'weather' | 'homebridge' | 'homeassistant' | 'netalertx' | 'nodered' | 'actualbudget' | 'ollama' | 'kasm' | 'wazuh' | 'paperless';
  name: string;
  config: IntegrationConfig;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  kiosk_slug?: string;
  created_at: string;
  updated_at: string;
  widget_count?: number;
  group_count?: number;
}

export type DashboardMode = 'view' | 'edit';

export interface DashboardExport {
  version: string;
  exported_at: string;
  dashboard: {
    name: string;
    description: string;
  };
  widgets: Array<{
    widget_type: string;
    title: string;
    config: Record<string, unknown>;
    integration_type: string;
    layout: { x: number; y: number; w: number; h: number };
  }>;
  groups: Array<{
    title: string;
    config: Record<string, unknown>;
    layout: { x: number; y: number; w: number; h: number };
    members: Array<{
      widget_index: number;
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
  }>;
}

export interface IntegrationMapping {
  [integrationTypeKey: string]: string; // integration_type -> integration_id
}

export interface ProxmoxConfig {
  host: string;
  port: number;
  tokenId?: string;
  tokenSecret?: string;
  username?: string;
  password?: string;
  realm?: string;
  verifySSL: boolean;
}

export interface UnifiConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  apiKey?: string;
  site: string;
  verifySSL: boolean;
}

export interface BeszelConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL: boolean;
}

export interface AdGuardConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL: boolean;
}

export interface QnapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL: boolean;
}

export interface PlexConfig {
  host: string;
  port: number;
  token: string;
  verifySSL: boolean;
}

export interface UnifiProtectConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  apiKey?: string;
  verifySSL: boolean;
}

export interface CiscoIOSXEConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL: boolean;
}

export interface PiKVMConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL: boolean;
}

export interface TautulliConfig {
  host: string;
  port: number;
  apiKey: string;
  verifySSL: boolean;
}

export interface TapoConfig {
  email: string;
  password: string;
  deviceIps?: string | string[];
  hubIps?: string | string[];
}

export interface KasaConfig {
  email?: string;
  password?: string;
  deviceIps?: string | string[];
  enableDiscovery?: boolean;
  discoveryTimeout?: number;
}

export interface OverseerrConfig {
  host: string;
  port?: number;
  apiKey: string;
  verifySSL?: boolean;
}

export interface HomeConnectConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: number;
}

export interface SonarrConfig {
  host: string;
  port: number;
  apiKey: string;
  verifySSL?: boolean;
}

export interface RadarrConfig {
  host: string;
  port: number;
  apiKey: string;
  verifySSL?: boolean;
}

export interface TdarrConfig {
  host: string;
  port: number;
  apiKey?: string;
  verifySSL?: boolean;
}

export interface BazarrConfig {
  host: string;
  port: number;
  apiKey: string;
  verifySSL?: boolean;
}

export interface ProwlarrConfig {
  host: string;
  port: number;
  apiKey: string;
  verifySSL?: boolean;
}

export interface SABnzbdConfig {
  host: string;
  port: number;
  apiKey: string;
  verifySSL?: boolean;
}

export interface QBittorrentConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL?: boolean;
}

export interface RingConfig {
  refreshToken: string;
  locationIds?: string[];
  cameraStatusPollingSeconds?: number;
}

export interface ImmichConfig {
  host: string;
  port: number;
  apiKey: string;
  verifySSL?: boolean;
}

export interface WeatherConfig {
  apiKey: string;
}

export interface HomebridgeConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL?: boolean;
}

export interface ActualBudgetConfig {
  serverUrl: string;
  password: string;
  syncId: string;
  encryptionPassword?: string;
}

export interface NodeRedConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  accessToken?: string;
  verifySSL?: boolean;
}

export interface WazuhConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  verifySSL?: boolean;
}

export interface PaperlessConfig {
  host: string;
  port: number;
  apiToken?: string;
  username?: string;
  password?: string;
  verifySSL?: boolean;
  basePath?: string;
}

export type IntegrationConfig = ProxmoxConfig | UnifiConfig | UnifiProtectConfig | BeszelConfig | AdGuardConfig | QnapConfig | PlexConfig | CiscoIOSXEConfig | PiKVMConfig | TautulliConfig | TapoConfig | KasaConfig | OverseerrConfig | HomeConnectConfig | SonarrConfig | RadarrConfig | TdarrConfig | BazarrConfig | SABnzbdConfig | QBittorrentConfig | RingConfig | ImmichConfig | WeatherConfig | HomebridgeConfig | ActualBudgetConfig | NodeRedConfig | WazuhConfig | PaperlessConfig;

// Beszel data types
export interface BeszelSystem {
  id: string;
  name: string;
  host: string;
  port: number;
  status: 'up' | 'down' | 'paused' | 'pending';
  created: string;
  updated: string;
  info?: {
    hostname?: string;
    cores?: number;
    threads?: number;
    cpu_model?: string;
    kernel?: string;
    os?: string;
    agent_version?: string;
    uptime?: number;
  };
}

export interface BeszelSystemStats {
  id: string;
  system: string;
  created: string;
  cpu: number;
  mem: number;
  memUsed: number;
  memTotal: number;
  memBuffCache: number;
  disk: number;
  diskUsed: number;
  diskTotal: number;
  netIn: number;
  netOut: number;
  temps?: { name: string; temp: number }[];
  cores?: number;
}

export interface BeszelContainerStats {
  id: string;
  system: string;
  created: string;
  name: string;
  cpu: number;
  mem: number;
  memUsed: number;
  netIn: number;
  netOut: number;
}

export interface BeszelAlert {
  id: string;
  system: string;
  name: string;
  triggered: boolean;
  count: number;
  value: number;
  updated: string;
}

export interface Widget {
  id: string;
  integration_id: string | null;
  widget_type: string;
  title: string;
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  widget_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetWithLayout extends Widget {
  layout: DashboardLayout;
}

export interface LogEntry {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface MetricInfo {
  id: string;
  name: string;
  description: string;
  widgetTypes: string[];
}

export interface IntegrationType {
  type: string;
  name: string;
}

// Proxmox data types
export interface ProxmoxNode {
  node: string;
  status: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
}

export interface ProxmoxVM {
  vmid: number;
  name: string;
  status: string;
  cpu: number;
  cpus: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  node: string;
  type: 'qemu' | 'lxc';
}

// UniFi data types
export interface UnifiClient {
  _id: string;
  mac: string;
  hostname?: string;
  name?: string;
  ip: string;
  is_wired: boolean;
  network: string;
  rx_bytes: number;
  tx_bytes: number;
  uptime: number;
}

export interface UnifiSwitchPort {
  port_idx: number;
  name: string;
  up: boolean;
  enable: boolean;
  speed: number;
  full_duplex: boolean;
  poe_enable?: boolean;
  poe_power?: number;
  rx_bytes: number;
  tx_bytes: number;
  rx_packets: number;
  tx_packets: number;
  media?: string;
  port_poe?: boolean;
  is_uplink?: boolean;
}

export interface UnifiDevice {
  _id: string;
  mac: string;
  name: string;
  model: string;
  type: string;
  state: number;
  adopted: boolean;
  uptime: number;
  port_table?: UnifiSwitchPort[];
}

export interface UnifiHealth {
  subsystem: string;
  status: string;
  num_user: number;
  num_guest: number;
  num_iot: number;
  tx_bytes: number;
  rx_bytes: number;
}

export interface UnifiWlan {
  _id: string;
  name: string;
  enabled: boolean;
  security: string;
  is_guest: boolean;
  num_sta: number;
}

export interface UnifiDpiCategory {
  cat: number;
  app: number;
  rx_bytes: number;
  tx_bytes: number;
  rx_packets: number;
  tx_packets: number;
}

export interface UnifiEvent {
  _id: string;
  key: string;
  msg: string;
  time: number;
  datetime: string;
  subsystem: string;
}

export interface UnifiSpeedTest {
  xput_download: number;
  xput_upload: number;
  latency: number;
  rundate: number;
  status_download: number;
  status_upload: number;
  status_ping: number;
}

// Additional Proxmox data types
export interface ProxmoxStorage {
  storage: string;
  node: string;
  type: string;
  content: string;
  used: number;
  total: number;
  avail: number;
  active: boolean;
  enabled: boolean;
  shared: boolean;
}

export interface ProxmoxTask {
  upid: string;
  node: string;
  type: string;
  status: string;
  user: string;
  starttime: number;
  endtime?: number;
  id?: string;
  pstart?: number;
}

export interface ProxmoxBackupInfo {
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
}

export interface ProxmoxBackupJob {
  id: string;
  schedule: string;
  enabled: boolean;
  storage: string;
  vmid?: string;
  node?: string;
  mode: string;
  compress: string;
  'next-run'?: number;
}

export interface ProxmoxRrdDataPoint {
  time: number;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  netin?: number;
  netout?: number;
  diskread?: number;
  diskwrite?: number;
  iowait?: number;
  rootused?: number;
  roottotal?: number;
  swapused?: number;
  swaptotal?: number;
  loadavg?: number;
  node?: string;
}

export interface ProxmoxClusterStatus {
  type: string;
  name: string;
  id?: string;
  nodes?: number;
  quorate?: number;
  version?: number;
  online?: boolean;
  ip?: string;
  level?: string;
  local?: boolean;
  nodeid?: number;
}

export interface ProxmoxDisk {
  devpath: string;
  model: string;
  serial: string;
  size: number;
  type: string;
  health?: string;
  wearout?: number;
  rpm?: number;
  vendor?: string;
  used?: string;
  gpt?: boolean;
}

export interface ProxmoxNetwork {
  iface: string;
  type: string;
  method?: string;
  address?: string;
  netmask?: string;
  gateway?: string;
  active: boolean;
  autostart: boolean;
  bridge_ports?: string;
  cidr?: string;
}

export interface ProxmoxCephStatus {
  health: {
    status: string;
    checks?: Record<string, { severity: string; message: string }>;
  };
  pgmap?: {
    pgs_by_state: { state_name: string; count: number }[];
    num_pgs: number;
    bytes_total: number;
    bytes_used: number;
    bytes_avail: number;
  };
  osdmap?: {
    num_osds: number;
    num_up_osds: number;
    num_in_osds: number;
  };
  monmap?: {
    mons: { name: string; rank: number }[];
  };
}

export interface ProxmoxHAResource {
  sid: string;
  type: string;
  state: string;
  status: string;
  node: string;
  request_state?: string;
  max_restart?: number;
  max_relocate?: number;
  group?: string;
}

export interface ProxmoxHAStatus {
  quorum: {
    node: string;
    quorate: boolean;
    local: boolean;
  };
  manager_status: {
    master_node: string;
    status: string;
  };
}

// Widget definitions
export interface WidgetDefinition {
  type: string;
  name: string;
  description: string;
  integrationTypes: string[];
  metric: string;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
}

// Widget Groups
export interface GroupMember {
  id: string;
  group_id: string;
  widget_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  widget_title?: string;
  widget_type?: string;
  integration_id?: string;
}

export interface GroupLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetGroup {
  id: string;
  title: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  layout: GroupLayout | null;
  members: GroupMember[];
}

export interface WidgetGroupWithWidgets extends WidgetGroup {
  widgets: WidgetWithLayout[];
}

// Branding settings
export type IconStyle = 'emoji' | 'simple' | 'none';

export interface BrandingSettings {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  hideNavTitle: boolean;
  iconStyle: IconStyle;
}

// Network Tools types
export type NetworkTool = 'ping' | 'traceroute' | 'dns' | 'port' | 'whois';

export interface NetworkToolResponse {
  success: boolean;
  tool: NetworkTool;
  target: string;
  output?: string;
  parsed?: PingResult | TracerouteResult | DnsResult | PortResult | WhoisResult;
  error?: string;
  duration: number;
}

export interface PingResult {
  transmitted: number;
  received: number;
  lossPercent: number;
  minMs: number;
  avgMs: number;
  maxMs: number;
}

export interface TracerouteHop {
  hop: number;
  host: string;
  ip: string;
  times: number[];
}

export interface TracerouteResult {
  hops: TracerouteHop[];
}

export interface DnsResult {
  hostname: string;
  addresses: string[];
  records?: { type: string; addresses: string[] }[];
}

export interface PortResult {
  host: string;
  port: number;
  open: boolean;
  responseTime?: number;
}

export interface WhoisResult {
  registrar?: string;
  createdDate?: string;
  expiryDate?: string;
  nameServers?: string[];
  registrant?: string;
}

// AdGuard Home data types
export interface AdGuardStats {
  num_dns_queries: number;
  num_blocked_filtering: number;
  num_replaced_safebrowsing: number;
  num_replaced_safesearch: number;
  num_replaced_parental: number;
  avg_processing_time: number;
  top_queried_domains: Array<{ [domain: string]: number }>;
  top_blocked_domains: Array<{ [domain: string]: number }>;
  top_clients: Array<{ [client: string]: number }>;
  dns_queries: number[];
  blocked_filtering: number[];
  replaced_safebrowsing: number[];
  replaced_parental: number[];
}

export interface AdGuardStatus {
  dns_addresses: string[];
  dns_port: number;
  http_port: number;
  protection_enabled: boolean;
  running: boolean;
  version: string;
}

export interface AdGuardQueryLogEntry {
  answer: Array<{
    type: string;
    value: string;
    ttl: number;
  }>;
  client: string;
  client_proto: string;
  elapsedMs: string;
  question: {
    class: string;
    name: string;
    type: string;
  };
  reason: string;
  status: string;
  time: string;
  rules?: Array<{
    filter_list_id: number;
    text: string;
  }>;
}

export interface AdGuardFilterStatus {
  enabled: boolean;
  interval: number;
  filters: Array<{
    enabled: boolean;
    id: number;
    last_updated: string;
    name: string;
    rules_count: number;
    url: string;
  }>;
  user_rules: string[];
}

// QNAP QTS data types
export interface QnapSystemInfo {
  hostname: string;
  model: string;
  firmware: string;
  uptime: number;
  serialNumber?: string;
}

export interface QnapSystemStats {
  cpu: {
    usage: number;
    temperature: number | null;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  systemTemperature: number | null;
}

export interface QnapVolume {
  id: string;
  name: string;
  status: string;
  raidType: string;
  totalSize: number;
  usedSize: number;
  freeSize: number;
  usagePercent: number;
}

export interface QnapDisk {
  id: string;
  model: string;
  serial?: string;
  capacity: number;
  temperature: number | null;
  health: string;
  smartStatus: string;
  type: 'ssd' | 'hdd' | 'nvme' | 'unknown';
}

export interface QnapNetworkStats {
  uploadSpeed: number;
  downloadSpeed: number;
  totalUpload: number;
  totalDownload: number;
}

// Plex Media Server data types
export interface PlexServerInfo {
  friendlyName: string;
  machineIdentifier: string;
  version: string;
  platform: string;
  platformVersion: string;
  transcoderActiveVideoSessions: number;
  myPlex: boolean;
  myPlexUsername: string;
  claimed: boolean;
}

export interface PlexLibrary {
  key: string;
  type: 'movie' | 'show' | 'artist' | 'photo';
  title: string;
  agent: string;
  scanner: string;
  count: number;
  refreshing: boolean;
}

export interface PlexMediaItem {
  ratingKey: string;
  key: string;
  type: 'movie' | 'show' | 'season' | 'episode' | 'track' | 'photo';
  title: string;
  parentTitle?: string;
  grandparentTitle?: string;
  thumb?: string;
  addedAt: number;
  duration?: number;
  year?: number;
  contentRating?: string;
}

export interface PlexPlayer {
  title: string;
  platform: string;
  state: 'playing' | 'paused' | 'buffering';
  local: boolean;
  address: string;
  machineIdentifier: string;
}

export interface PlexUser {
  id: string;
  title: string;
  thumb?: string;
}

export interface PlexTranscodeSession {
  key: string;
  throttled: boolean;
  complete: boolean;
  progress: number;
  speed: number;
  duration: number;
  context: string;
  videoDecision: 'transcode' | 'copy' | 'directplay';
  audioDecision: 'transcode' | 'copy' | 'directplay';
  transcodeHwRequested: boolean;
  transcodeHwFullPipeline: boolean;
}

export interface PlexSession {
  sessionKey: string;
  ratingKey: string;
  title: string;
  parentTitle?: string;
  grandparentTitle?: string;
  type: 'movie' | 'episode' | 'track';
  thumb?: string;
  viewOffset: number;
  duration: number;
  player: PlexPlayer;
  user: PlexUser;
  transcodeSession?: PlexTranscodeSession;
}

export interface PlexLibraryStats {
  libraries: PlexLibrary[];
  totalMovies: number;
  totalShows: number;
  totalEpisodes: number;
  totalMusic: number;
  totalPhotos: number;
}

export interface PlexSessionsData {
  sessions: PlexSession[];
  totalSessions: number;
  transcoding: number;
  directPlay: number;
  directStream: number;
}

// Image Library types
export interface ImageLibrary {
  id: string;
  name: string;
  description: string;
  image_count?: number;
  created_at: string;
  updated_at: string;
}

export interface LibraryImage {
  id: string;
  library_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  alt_text: string;
  created_at: string;
}

// TP-Link Tapo data types
export type TapoDeviceType = 'plug' | 'plug_energy' | 'bulb' | 'bulb_color' | 'strip';

export interface TapoDevice {
  deviceId: string;
  alias: string;
  deviceType: TapoDeviceType;
  deviceModel: string;
  deviceMac: string;
  deviceOn: boolean;
  ipAddress?: string;
  fwVersion?: string;
  hwVersion?: string;
  hasEnergyMonitoring: boolean;
}

export interface TapoDeviceInfo extends TapoDevice {
  signalLevel: number;
  overheated: boolean;
  onTime: number;
  brightness?: number;
  colorTemp?: number;
  hue?: number;
  saturation?: number;
}

export interface TapoEnergyUsage {
  deviceId: string;
  alias: string;
  currentPower: number;
  todayEnergy: number;
  monthEnergy: number;
  todayRuntime: number;
  monthRuntime: number;
}

export type TapoSensorType = 'temperature' | 'motion' | 'contact' | 'water_leak' | 'button' | 'unknown';

export interface TapoSensor {
  deviceId: string;
  alias: string;
  model: string;
  sensorType: TapoSensorType;
  parentDeviceId?: string;
  status: 'online' | 'offline';
  batteryPercentage?: number;
  // Temperature/humidity sensor fields (T310, T315)
  temperature?: number;
  temperatureUnit?: 'celsius' | 'fahrenheit';
  humidity?: number;
  // Motion sensor fields (T100)
  detected?: boolean;
  lastDetectedTime?: string;
  // Contact sensor fields (T110 - door/window)
  isOpen?: boolean;
  lastOpenTime?: string;
  lastCloseTime?: string;
  // Water leak sensor fields (T300)
  waterDetected?: boolean;
  // Common fields
  lastUpdate?: string;
  reportInterval?: number;
}

// TP-Link Kasa data types
export type KasaDeviceType =
  | 'plug'
  | 'plug_energy'
  | 'bulb'
  | 'bulb_dimmable'
  | 'bulb_tunable'
  | 'bulb_color'
  | 'switch'
  | 'dimmer'
  | 'power_strip';

export interface KasaDevice {
  deviceId: string;
  alias: string;
  deviceType: KasaDeviceType;
  model: string;
  mac: string;
  host: string;
  isOn: boolean;
  hasEnergyMonitoring: boolean;
  fwVersion?: string;
  hwVersion?: string;
}

export interface KasaDeviceInfo extends KasaDevice {
  rssi?: number;
  onTime?: number;
  ledOff?: boolean;
  brightness?: number;
  colorTemp?: number;
  hue?: number;
  saturation?: number;
}

export interface KasaEnergyUsage {
  deviceId: string;
  alias: string;
  currentPower: number;
  voltage: number;
  current: number;
  todayEnergy: number;
  monthEnergy: number;
  totalEnergy: number;
}

// Overseerr data types
export type OverseerrMediaStatus =
  | 'unknown'
  | 'pending'
  | 'processing'
  | 'partially_available'
  | 'available'
  | 'deleted';

export type OverseerrRequestStatus = 'pending' | 'approved' | 'declined';

export interface OverseerrServerStatus {
  version: string;
  commitTag: string;
  updateAvailable: boolean;
  commitsBehind: number;
  restartRequired: boolean;
}

export interface OverseerrStats {
  totalRequests: number;
  totalMediaItems: number;
  totalMovies: number;
  totalSeries: number;
}

export interface OverseerrRequest {
  id: number;
  status: number;
  media: {
    id: number;
    mediaType: 'movie' | 'tv';
    tmdbId: number;
    tvdbId?: number;
    status: number;
    title?: string;
    posterPath?: string;
  };
  requestedBy: {
    id: number;
    displayName: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  modifiedBy?: {
    id: number;
    displayName: string;
  };
}

export interface OverseerrUser {
  id: number;
  email: string;
  displayName: string;
  avatar?: string;
  requestCount: number;
  movieQuotaLimit?: number;
  movieQuotaDays?: number;
  tvQuotaLimit?: number;
  tvQuotaDays?: number;
}

export interface OverseerrRequestCount {
  total: number;
  pending: number;
  approved: number;
  declined: number;
  processing: number;
  available: number;
}

// Home Connect data types
export type HomeConnectApplianceType =
  | 'Oven'
  | 'Dishwasher'
  | 'Washer'
  | 'Dryer'
  | 'WasherDryer'
  | 'CoffeeMaker'
  | 'Refrigerator'
  | 'Freezer'
  | 'FridgeFreezer'
  | 'Cooktop'
  | 'Hood'
  | 'CleaningRobot';

export interface HomeConnectAppliance {
  haId: string;
  name: string;
  brand: string;
  type: HomeConnectApplianceType;
  vib: string;
  enumber: string;
  connected: boolean;
}

export interface HomeConnectStatus {
  haId: string;
  name: string;
  type: HomeConnectApplianceType;
  connected: boolean;
  operationState?: string;
  doorState?: 'Open' | 'Closed' | 'Locked';
  remoteControlActive?: boolean;
  remoteStartAllowed?: boolean;
  localControlActive?: boolean;
  temperatureTarget?: number;
  temperatureCurrent?: number;
  powerState?: 'On' | 'Off' | 'Standby';
}

export interface HomeConnectProgramOption {
  key: string;
  name: string;
  value: string | number | boolean;
  unit?: string;
}

export interface HomeConnectProgram {
  haId: string;
  applianceName: string;
  applianceType: HomeConnectApplianceType;
  programKey: string;
  programName: string;
  options: HomeConnectProgramOption[];
  progress?: number;
  remainingTime?: number;
  elapsedTime?: number;
  startTime?: string;
}

export interface HomeConnectImage {
  imageKey: string;
  timestamp?: string;
}

export interface HomeConnectFridgeCamera {
  haId: string;
  applianceName: string;
  applianceType: HomeConnectApplianceType;
  images: HomeConnectImage[];
  available: boolean;
}

// Sonarr data types
export interface SonarrSystemStatus {
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  branch: string;
  authentication: string;
  startOfWeek: number;
  urlBase: string;
  runtimeVersion: string;
  startTime: string;
  runtimeName: string;
}

export interface SonarrDiskSpace {
  path: string;
  label: string;
  freeSpace: number;
  totalSpace: number;
}

export interface SonarrImage {
  coverType: 'banner' | 'poster' | 'fanart';
  url: string;
  remoteUrl?: string;
}

export interface SonarrSeasonStatistics {
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  percentOfEpisodes: number;
}

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
  statistics?: SonarrSeasonStatistics;
}

export interface SonarrSeriesStatistics {
  seasonCount: number;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  percentOfEpisodes: number;
}

export interface SonarrSeries {
  id: number;
  title: string;
  sortTitle: string;
  status: 'continuing' | 'ended' | 'upcoming' | 'deleted';
  overview?: string;
  network?: string;
  airTime?: string;
  images: SonarrImage[];
  seasons: SonarrSeason[];
  year: number;
  path: string;
  qualityProfileId: number;
  seasonFolder: boolean;
  monitored: boolean;
  runtime: number;
  tvdbId: number;
  tvMazeId?: number;
  firstAired?: string;
  seriesType: 'standard' | 'daily' | 'anime';
  cleanTitle: string;
  imdbId?: string;
  titleSlug: string;
  certification?: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings?: { votes: number; value: number };
  statistics?: SonarrSeriesStatistics;
}

export interface SonarrEpisode {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate?: string;
  airDateUtc?: string;
  overview?: string;
  hasFile: boolean;
  monitored: boolean;
  absoluteEpisodeNumber?: number;
  unverifiedSceneNumbering: boolean;
  series?: SonarrSeries;
}

export interface SonarrQueueRecord {
  id: number;
  seriesId: number;
  episodeId: number;
  series?: SonarrSeries;
  episode?: SonarrEpisode;
  quality: { quality: { id: number; name: string } };
  size: number;
  title: string;
  sizeleft: number;
  timeleft?: string;
  estimatedCompletionTime?: string;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages?: { title: string; messages: string[] }[];
  downloadId?: string;
  protocol: 'usenet' | 'torrent';
  downloadClient?: string;
  indexer?: string;
  outputPath?: string;
}

export interface SonarrHistoryRecord {
  id: number;
  episodeId: number;
  seriesId: number;
  sourceTitle: string;
  quality: { quality: { id: number; name: string } };
  qualityCutoffNotMet: boolean;
  date: string;
  downloadId?: string;
  eventType: 'grabbed' | 'downloadFolderImported' | 'downloadFailed' | 'episodeFileDeleted' | 'episodeFileRenamed';
  series?: SonarrSeries;
  episode?: SonarrEpisode;
}

export interface SonarrHealth {
  source: string;
  type: 'ok' | 'notice' | 'warning' | 'error';
  message: string;
  wikiUrl?: string;
}

// Radarr data types
export interface RadarrSystemStatus {
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  branch: string;
  authentication: string;
  urlBase: string;
  runtimeVersion: string;
  runtimeName: string;
  startTime: string;
}

export interface RadarrDiskSpace {
  path: string;
  label: string;
  freeSpace: number;
  totalSpace: number;
}

export interface RadarrMovieImage {
  coverType: 'poster' | 'fanart' | 'banner';
  url?: string;
  remoteUrl?: string;
}

export interface RadarrMovie {
  id: number;
  title: string;
  originalTitle?: string;
  sortTitle: string;
  sizeOnDisk: number;
  status: 'tba' | 'announced' | 'inCinemas' | 'released' | 'deleted';
  overview?: string;
  inCinemas?: string;
  physicalRelease?: string;
  digitalRelease?: string;
  images: RadarrMovieImage[];
  website?: string;
  year: number;
  hasFile: boolean;
  youTubeTrailerId?: string;
  studio?: string;
  path: string;
  qualityProfileId: number;
  monitored: boolean;
  minimumAvailability: 'tba' | 'announced' | 'inCinemas' | 'released';
  isAvailable: boolean;
  folderName?: string;
  runtime: number;
  cleanTitle: string;
  imdbId?: string;
  tmdbId: number;
  titleSlug: string;
  certification?: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings?: { votes: number; value: number };
  movieFile?: {
    id: number;
    relativePath: string;
    path: string;
    size: number;
    dateAdded: string;
    quality: { quality: { id: number; name: string } };
  };
}

export interface RadarrQueueRecord {
  id: number;
  movieId: number;
  movie?: RadarrMovie;
  quality: { quality: { id: number; name: string } };
  size: number;
  title: string;
  sizeleft: number;
  timeleft?: string;
  estimatedCompletionTime?: string;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages?: { title: string; messages: string[] }[];
  downloadId?: string;
  protocol: 'usenet' | 'torrent';
  downloadClient?: string;
  indexer?: string;
  outputPath?: string;
}

export interface RadarrHistoryRecord {
  id: number;
  movieId: number;
  sourceTitle: string;
  quality: { quality: { id: number; name: string } };
  qualityCutoffNotMet: boolean;
  date: string;
  downloadId?: string;
  eventType: 'grabbed' | 'downloadFolderImported' | 'downloadFailed' | 'movieFileDeleted' | 'movieFileRenamed';
  movie?: RadarrMovie;
}

export interface RadarrHealth {
  source: string;
  type: 'ok' | 'notice' | 'warning' | 'error';
  message: string;
  wikiUrl?: string;
}

// Tdarr data types
export interface TdarrStatus {
  version: string;
  uptime: number; // seconds
  totalFileCount: number;
  totalTranscodeCount: number;
  totalHealthCheckCount: number;
  sizeDiff: number;
}

export interface TdarrQueueStats {
  totalQueued: number;
  totalProcessing: number;
  totalErrored: number;
  totalCompleted: number;
  transcodeQueue: number;
  healthCheckQueue: number;
}

export interface TdarrNode {
  _id: string;
  nodeName: string;
  nodePaused: boolean;
  workers: TdarrWorker[];
  resources: {
    cpuPercent: number;
    memPercent: number;
    gpuPercent?: number;
  };
}

export interface TdarrWorker {
  id: string;
  file: string;
  status: 'idle' | 'transcoding' | 'health_check';
  percentage: number;
  ETA: string;
  workerType: 'transcode' | 'health_check';
  mode: 'cpu' | 'gpu';
}

export interface TdarrLibraryStats {
  totalFiles: number;
  totalSize: number;
  spaceSaved: number;
  spaceSavedPercent: number;
  codecBreakdown: Record<string, number>;
  containerBreakdown: Record<string, number>;
  resolutionBreakdown: Record<string, number>;
}

// Bazarr data types
export interface BazarrStatus {
  version: string;
  pythonVersion: string;
  startTime: string;
  timezone: string;
}

export interface BazarrWanted {
  seriesTotal: number;
  seriesMissing: number;
  moviesTotal: number;
  moviesMissing: number;
}

export interface BazarrHistoryItem {
  id: number;
  action: 'downloaded' | 'upgraded' | 'manual' | 'deleted' | 'synced';
  title: string;
  season?: number;
  episode?: number;
  language: string;
  provider: string;
  timestamp: string;
  type: 'series' | 'movie';
  subs_id?: string;
  video_path?: string;
  subtitles_path?: string;
  score?: number;
}

export interface BazarrSeriesItem {
  sonarrSeriesId: number;
  title: string;
  year: number;
  poster?: string;
  episodeCount: number;
  missingSubtitles: number;
  monitored: boolean;
  profileId?: number;
}

export interface BazarrMovieItem {
  radarrId: number;
  title: string;
  year: number;
  poster?: string;
  missingSubtitles: string[];
  monitored: boolean;
  profileId?: number;
}

// Prowlarr data types
export interface ProwlarrSystemStatus {
  version: string;
  buildTime: string;
  startTime: string;
  osName: string;
  osVersion: string;
  branch: string;
}

export interface ProwlarrIndexer {
  id: number;
  name: string;
  protocol: 'torrent' | 'usenet';
  privacy: 'public' | 'private' | 'semiPrivate';
  enable: boolean;
  appProfileId: number;
  priority: number;
  added: string;
}

export interface ProwlarrIndexerStats {
  indexerId: number;
  indexerName: string;
  averageResponseTime: number;
  numberOfQueries: number;
  numberOfGrabs: number;
  numberOfRssQueries: number;
  numberOfAuthQueries: number;
  numberOfFailedQueries: number;
  numberOfFailedGrabs: number;
  numberOfFailedRssQueries: number;
  numberOfFailedAuthQueries: number;
}

export interface ProwlarrApplication {
  id: number;
  name: string;
  syncLevel: 'disabled' | 'addOnly' | 'fullSync';
  implementationName: string;
  tags: number[];
}

export interface ProwlarrHealth {
  source: string;
  type: 'warning' | 'error';
  message: string;
  wikiUrl?: string;
}

export interface ProwlarrHistoryRecord {
  id: number;
  indexerId: number;
  indexer: string;
  eventType: string;
  successful: boolean;
  date: string;
  data?: {
    query?: string;
    source?: string;
    title?: string;
  };
}

// SABnzbd data types
export interface SABnzbdQueue {
  status: string;
  speedlimit: string;
  speedlimit_abs: string;
  paused: boolean;
  pause_int: string;
  kbpersec: string;
  speed: string;
  mbleft: string;
  mb: string;
  noofslots: number;
  noofslots_total: number;
  timeleft: string;
  eta: string;
  diskspace1: string;
  diskspace2: string;
  diskspacetotal1: string;
  diskspacetotal2: string;
  slots: SABnzbdQueueSlot[];
}

export interface SABnzbdQueueSlot {
  nzo_id: string;
  filename: string;
  status: string;
  mb: string;
  mbleft: string;
  percentage: string;
  timeleft: string;
  eta: string;
  cat: string;
  priority: string;
  avg_age: string;
}

export interface SABnzbdHistory {
  noofslots: number;
  day_size: string;
  week_size: string;
  month_size: string;
  total_size: string;
  slots: SABnzbdHistorySlot[];
}

export interface SABnzbdHistorySlot {
  nzo_id: string;
  name: string;
  status: string;
  fail_message: string;
  bytes: number;
  size: string;
  category: string;
  completed: number;
  download_time: number;
  postproc_time: number;
}

export interface SABnzbdStatus {
  version: string;
  uptime: string;
  diskspace1: string;
  diskspace2: string;
  diskspacetotal1: string;
  diskspacetotal2: string;
  speedlimit: string;
  speedlimit_abs: string;
  have_warnings: string;
  paused: boolean;
  pause_int: string;
  loadavg: string;
  servers: SABnzbdServer[];
}

export interface SABnzbdServer {
  servername: string;
  serveractive: boolean;
  serveractiveconn: number;
  servertotalconn: number;
  serverssl: boolean;
  serveroptional: boolean;
  servererror: string;
}

export interface SABnzbdServerStats {
  total: number;
  month: number;
  week: number;
  day: number;
  servers: Record<string, SABnzbdServerStat>;
}

export interface SABnzbdServerStat {
  total: number;
  month: number;
  week: number;
  day: number;
  daily: Record<string, number>;
  articles_tried: number;
  articles_success: number;
}

export interface SABnzbdWarning {
  type: string;
  text: string;
  time: number;
}

// qBittorrent data types
export interface QBittorrentTransferInfo {
  dl_info_speed: number;
  dl_info_data: number;
  up_info_speed: number;
  up_info_data: number;
  dl_rate_limit: number;
  up_rate_limit: number;
  dht_nodes: number;
  connection_status: 'connected' | 'firewalled' | 'disconnected';
}

export interface QBittorrentTorrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  priority: number;
  num_seeds: number;
  num_leechs: number;
  ratio: number;
  eta: number;
  state: QBittorrentTorrentState;
  category: string;
  tags: string;
  added_on: number;
  completion_on: number;
  tracker: string;
  save_path: string;
  downloaded: number;
  uploaded: number;
  num_complete: number;
  num_incomplete: number;
  availability: number;
  content_path: string;
}

export type QBittorrentTorrentState =
  | 'error'
  | 'missingFiles'
  | 'uploading'
  | 'pausedUP'
  | 'queuedUP'
  | 'stalledUP'
  | 'checkingUP'
  | 'forcedUP'
  | 'allocating'
  | 'downloading'
  | 'metaDL'
  | 'pausedDL'
  | 'queuedDL'
  | 'stalledDL'
  | 'checkingDL'
  | 'forcedDL'
  | 'checkingResumeData'
  | 'moving'
  | 'unknown';

export interface QBittorrentMainData {
  rid: number;
  full_update: boolean;
  torrents: Record<string, QBittorrentTorrent>;
  torrents_removed?: string[];
  categories: Record<string, QBittorrentCategory>;
  categories_removed?: string[];
  tags?: string[];
  tags_removed?: string[];
  server_state: QBittorrentServerState;
}

export interface QBittorrentCategory {
  name: string;
  savePath: string;
}

export interface QBittorrentServerState {
  alltime_dl: number;
  alltime_ul: number;
  average_time_queue: number;
  connection_status: string;
  dht_nodes: number;
  dl_info_data: number;
  dl_info_speed: number;
  dl_rate_limit: number;
  free_space_on_disk: number;
  global_ratio: string;
  queued_io_jobs: number;
  queueing: boolean;
  read_cache_hits: string;
  read_cache_overload: string;
  refresh_interval: number;
  total_buffers_size: number;
  total_peer_connections: number;
  total_queued_size: number;
  total_wasted_session: number;
  up_info_data: number;
  up_info_speed: number;
  up_rate_limit: number;
  use_alt_speed_limits: boolean;
  use_subcategories: boolean;
  write_cache_overload: string;
}

export interface QBittorrentStatus {
  version: string;
  apiVersion: string;
  connectionStatus: string;
  dhtNodes: number;
  totalPeerConnections: number;
  freeSpaceOnDisk: number;
  useAltSpeedLimits: boolean;
  downloadSpeed: number;
  uploadSpeed: number;
  downloadSpeedLimit: number;
  uploadSpeedLimit: number;
  allTimeDownload: number;
  allTimeUpload: number;
  globalRatio: string;
}

// Ring data types
export interface RingDevice {
  id: number;
  name: string;
  deviceType: string;
  description: string;
  batteryLife: number | null;
  hasLight: boolean;
  hasSiren: boolean;
  isOnline: boolean;
  firmwareStatus: string;
  wifiSignalStrength: number;
  wifiSignalCategory: string;
  lastMotion: number | null;
  lastDing: number | null;
}

export interface RingEvent {
  id: string;
  deviceId: number;
  deviceName: string;
  kind: 'motion' | 'ding' | 'on_demand';
  createdAt: string;
  answered: boolean;
  favorite: boolean;
  duration: number;
}

export interface RingAlarmStatus {
  locationId: string;
  locationName: string;
  mode: 'all' | 'some' | 'none';
  modeLabel: string;
  sirenActive: boolean;
  entryDelayActive: boolean;
  exitDelayActive: boolean;
  faultedSensors: number;
  totalSensors: number;
  lowBatterySensors: number;
}

export interface RingSensor {
  id: string;
  name: string;
  deviceType: string;
  roomName: string;
  faulted: boolean;
  tamperStatus: 'ok' | 'tamper';
  batteryLevel: number | null;
  batteryStatus: 'ok' | 'low' | 'none';
  lastUpdate: string;
  bypassed: boolean;
}

export interface RingSnapshot {
  deviceId: number;
  deviceName: string;
  timestamp: string;
  imageBase64: string;
}

// Immich data types
export interface ImmichServerInfo {
  version: string;
  versionUrl: string;
  build: string;
  buildUrl: string;
  repository: string;
  repositoryUrl: string;
  sourceRef: string;
  sourceCommit: string;
  sourceUrl: string;
  nodejs: string;
  ffmpeg: string;
  imagemagick: string;
  libvips: string;
  exiftool: string;
}

export interface ImmichStorageInfo {
  diskAvailable: string;
  diskAvailableRaw: number;
  diskSize: string;
  diskSizeRaw: number;
  diskUsagePercentage: number;
  diskUse: string;
  diskUseRaw: number;
}

export interface ImmichUserUsage {
  userId: string;
  userName: string;
  photos: number;
  videos: number;
  usage: number;
  usageFormatted: string;
  quotaSizeInBytes: number | null;
  quotaFormatted: string | null;
  quotaPercentage: number | null;
}

export interface ImmichStatistics {
  photos: number;
  videos: number;
  usage: number;
  usageFormatted: string;
  usageByUser: ImmichUserUsage[];
  totalUsers: number;
  totalAssets: number;
}

export interface ImmichJobCounts {
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  waiting: number;
  paused: number;
}

export interface ImmichJob {
  name: string;
  key: string;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  waiting: number;
  paused: number;
  isActive: boolean;
  isPaused: boolean;
}

export interface ImmichJobsData {
  jobs: ImmichJob[];
  totalActive: number;
  totalWaiting: number;
  totalFailed: number;
  totalJobs: number;
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  albumThumbnailAssetId: string | null;
  thumbnailUrl: string | null;
  shared: boolean;
  hasSharedLink: boolean;
  assetCount: number;
  owner: {
    id: string;
    email: string;
    name: string;
  };
}

export interface ImmichAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  originalFileName: string;
  fileCreatedAt: string;
  isFavorite: boolean;
  duration: string | null;
  thumbhash: string | null;
}

// Homebridge data types
export interface HomebridgeStatus {
  status: 'up' | 'down' | 'pending';
  name: string;
  port: number;
  pin: string;
  setupUri?: string;
  packageVersion: string;  // This is the Homebridge version
  paired: boolean;
  consolePort?: number;
}

export interface HomebridgeServerInfo {
  serviceUser?: string;
  homebridgeConfigJsonPath: string;
  homebridgeStoragePath: string;
  homebridgeInsecureMode: boolean;
  homebridgeCustomPluginPath?: string;
  homebridgePluginPath?: string;
  homebridgeRunningInDocker?: boolean;
  homebridgeRunningInSynologyPackage?: boolean;
  homebridgeRunningInPackageMode?: boolean;
  nodeVersion: string;
  os?: {
    platform?: string;
    distro?: string;
    release?: string;
    hostname?: string;
  };
  time?: {
    current?: number;
    uptime?: number;
    timezone?: string;
    timezoneName?: string;
  };
  network?: {
    ip4?: string;
    mac?: string;
  };
}

export interface HomebridgeCpuInfo {
  currentLoad: number;
  cpuTemperature?: {
    main: number;
    cores: number[];
  };
}

export interface HomebridgeRamInfo {
  mem: {
    total: number;
    used: number;
    free: number;
    active: number;
    available: number;
  };
  memoryUsageHistory?: number[];
}

export interface HomebridgeCharacteristic {
  type: string;
  serviceName: string;
  value: string | number | boolean | null;
  format: string;
  canRead: boolean;
  canWrite: boolean;
  minValue?: number;
  maxValue?: number;
  minStep?: number;
  unit?: string;
}

export interface HomebridgeAccessory {
  aid: number;
  iid: number;
  uuid: string;
  type: string;
  humanType: string;
  serviceName: string;
  serviceCharacteristics: HomebridgeCharacteristic[];
  accessoryInformation: {
    Manufacturer: string;
    Model: string;
    Name: string;
    'Serial Number': string;
    'Firmware Revision'?: string;
  };
  values: Record<string, string | number | boolean | null>;
  instance: {
    name: string;
    username: string;
    ipAddress?: string;
    port: number;
  };
  uniqueId: string;
}

export interface HomebridgePlugin {
  name: string;
  displayName?: string;
  description?: string;
  installedVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  publicPackage: boolean;
  settingsSchema: boolean;
  homepage?: string;
  author?: string;
}

export interface HomebridgeCombinedStatus {
  status: HomebridgeStatus;
  serverInfo: HomebridgeServerInfo;
  cpu: HomebridgeCpuInfo;
  ram: HomebridgeRamInfo;
  insecureMode: boolean;
}

// NetAlertX data types
export interface NetAlertXDevice {
  devMac: string;
  devName: string;
  devOwner: string;
  devType: string;
  devVendor: string;
  devStatus: 'On-line' | 'Off-line' | 'Down' | 'Archived';
  devIP: string;
  devLastIP: string;
  devFavorite: 0 | 1;
  devFirstConnection: string;
  devLastConnection: string;
  devSessions: number;
  devEvents: number;
  devDownAlerts: number;
  devPresenceHours: number;
}

export interface NetAlertXDeviceTotals {
  all: number;
  connected: number;
  favorites: number;
  new: number;
  down: number;
  archived: number;
}

export interface NetAlertXEvent {
  eve_MAC: string;
  eve_IP: string;
  eve_DateTime: string;
  eve_EventType: string;
  eve_AdditionalInfo: string;
  eve_PendingAlertEmail: number;
}

export interface NetAlertXTopologyNode {
  id: string;
  title: string;
  devMAC: string;
  devIP: string;
  devType: string;
  devStatus: string;
}

export interface NetAlertXTopologyLink {
  source: string;
  target: string;
  port?: string;
}

export interface NetAlertXTopology {
  nodes: NetAlertXTopologyNode[];
  links: NetAlertXTopologyLink[];
}

export interface NetAlertXInternetInfo {
  ip: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
}

export interface NetAlertXInterface {
  name: string;
  short: string;
  type: string;
  state: string;
  mtu: number;
  mac: string;
  ipv4: string[];
  ipv6: string[];
  rx_bytes: number;
  tx_bytes: number;
}

export interface NetAlertXSessionTotals {
  total: number;
  sessions: number;
  missing: number;
  voided: number;
  newDevices: number;
  down: number;
}
