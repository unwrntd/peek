export interface Integration {
  id: string;
  type: 'proxmox' | 'unifi' | 'unifi-protect' | 'beszel' | 'adguard' | 'qnap' | 'plex' | 'cisco-iosxe' | 'pikvm' | 'glkvm' | 'tautulli' | 'tapo' | 'kasa' | 'overseerr' | 'homeconnect' | 'sonarr' | 'radarr' | 'tdarr' | 'bazarr' | 'prowlarr' | 'sabnzbd' | 'qbittorrent' | 'ring' | 'immich' | 'weather' | 'homebridge' | 'homeassistant' | 'nodered' | 'actualbudget' | 'ollama' | 'kasm' | 'wazuh' | 'paperless' | 'sonos' | 'ecobee' | 'mikrotik' | 'controld' | 'notion' | 'slack' | 'ge-smarthq' | 'lg-thinq' | 'homekit' | 'microsoft365' | 'google-workspace' | 'storj' | 'kitchenowl' | 'esxi' | 'panos' | 'fortigate' | 'github' | 'docker' | 'tailscale' | 'opnsense';
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

export interface GLKVMConfig {
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

export interface HomeKitConfig {
  discoveryMode: 'auto' | 'manual';
  devices?: Array<{
    id: string;
    name: string;
    address: string;
    port: number;
  }>;
  pairings?: Record<string, {
    iOSDevicePairingID: string;
    iOSDeviceLTSK: string;
    iOSDeviceLTPK: string;
    AccessoryPairingID: string;
    AccessoryLTPK: string;
  }>;
  discoveryTimeout?: number;
}

export interface HomeAssistantConfig {
  host: string;
  port: number;
  token: string;
  verifySSL?: boolean;
}

export interface NetAlertXConfig {
  host: string;
  port: number;
  apiToken: string;
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

export interface OllamaConfig {
  host: string;
  port: number;
  verifySSL?: boolean;
}

export interface KasmConfig {
  host: string;
  port: number;
  apiKey: string;
  apiKeySecret: string;
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

export interface SonosConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri?: string;
  accessToken?: string;
  tokenExpiry?: number;
  householdId?: string;
}

export interface EcobeeConfig {
  accessToken: string;
  // Legacy fields (kept for backward compatibility)
  apiKey?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

// MikroTik RouterOS Configuration
export interface MikroTikConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useSSL?: boolean;
  verifySSL?: boolean;
}

// MikroTik API Responses
export interface MikroTikSystemResource {
  uptime: string;
  version: string;
  'build-time': string;
  'free-memory': string;
  'total-memory': string;
  cpu: string;
  'cpu-count': string;
  'cpu-frequency': string;
  'cpu-load': string;
  'free-hdd-space': string;
  'total-hdd-space': string;
  'architecture-name': string;
  'board-name': string;
  platform: string;
}

export interface MikroTikIdentity {
  name: string;
}

export interface MikroTikRouterboard {
  routerboard: string;
  model: string;
  'serial-number': string;
  'firmware-type': string;
  'factory-firmware': string;
  'current-firmware': string;
  'upgrade-firmware': string;
}

export interface MikroTikInterface {
  '.id': string;
  name: string;
  type: string;
  mtu: string;
  'actual-mtu': string;
  'mac-address': string;
  running: string;
  disabled: string;
  comment?: string;
  'rx-byte': string;
  'tx-byte': string;
  'rx-packet': string;
  'tx-packet': string;
  'rx-error': string;
  'tx-error': string;
  'rx-drop': string;
  'tx-drop': string;
  'link-downs': string;
}

export interface MikroTikWirelessClient {
  '.id': string;
  interface: string;
  'mac-address': string;
  ap: string;
  uptime: string;
  'last-activity': string;
  'signal-strength': string;
  'signal-to-noise': string;
  'tx-rate': string;
  'rx-rate': string;
  packets: string;
  bytes: string;
}

export interface MikroTikDHCPLease {
  '.id': string;
  address: string;
  'mac-address': string;
  'client-id'?: string;
  'host-name'?: string;
  server: string;
  status: string;
  'last-seen'?: string;
  'expires-after'?: string;
  'active-address'?: string;
  'active-mac-address'?: string;
  dynamic: string;
  disabled: string;
  comment?: string;
}

export interface MikroTikFirewallRule {
  '.id': string;
  chain: string;
  action: string;
  protocol?: string;
  'src-address'?: string;
  'dst-address'?: string;
  'src-port'?: string;
  'dst-port'?: string;
  'in-interface'?: string;
  'out-interface'?: string;
  bytes: string;
  packets: string;
  disabled: string;
  dynamic: string;
  comment?: string;
}

export interface MikroTikConnection {
  '.id': string;
  protocol: string;
  'src-address': string;
  'dst-address': string;
  'reply-src-address': string;
  'reply-dst-address': string;
  'tcp-state'?: string;
  timeout: string;
  'orig-bytes': string;
  'repl-bytes': string;
  'orig-packets': string;
  'repl-packets': string;
}

export interface MikroTikLogEntry {
  '.id': string;
  time: string;
  topics: string;
  message: string;
}

export interface MikroTikRoute {
  '.id': string;
  'dst-address': string;
  gateway: string;
  'gateway-status'?: string;
  distance: string;
  scope: string;
  'target-scope': string;
  active: string;
  dynamic: string;
  disabled: string;
  comment?: string;
}

export interface MikroTikArpEntry {
  '.id': string;
  address: string;
  'mac-address': string;
  interface: string;
  dynamic: string;
  complete: string;
  disabled: string;
  published: string;
}

// ControlD Configuration
export interface ControlDConfig {
  apiToken: string;
}

// ControlD API Responses
export interface ControlDProfile {
  PK: string;
  name: string;
  updated: number;
  stats: number;
  profile: {
    flt: { count: number };
    cflt: { count: number };
    ipflt: { count: number };
    rule: { count: number };
    svc: { count: number };
    grp: { count: number };
    opt: {
      count: number;
      data: Array<{ PK: string; value: string | number }>;
    };
    da: string[];
  };
}

export interface ControlDDevice {
  PK: string;
  ts: number;
  name: string;
  device_id: string;
  status: number;
  learn_ip: number;
  restricted: number;
  stats: number;
  desc: string;
  icon: string;
  profile: {
    PK: string;
    updated: number;
    name: string;
  };
  resolvers: {
    uid: string;
    doh: string;
    dot: string;
    ipv4: string[];
    ipv6: string[];
  };
  legacy_ipv4: {
    status: number;
    resolver: string;
  };
  ddns: {
    status: number;
    subdomain: string;
    hostname: string;
    record: string;
  };
  ddns_ext: {
    status: number;
    host: string;
  };
}

export interface ControlDFilter {
  PK: string;
  name: string;
  description: string;
  category: string;
  sources: number;
  count: number;
}

export interface ControlDService {
  PK: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  warning?: string;
  unlock_location?: string[];
}

export interface ControlDServiceCategory {
  PK: string;
  name: string;
  count: number;
}

export interface ControlDCustomRule {
  PK: string;
  ts: number;
  order: number;
  group: string;
  action: {
    status: number;
    do: string;
  };
  hostnames: string[];
}

export interface ControlDRuleFolder {
  PK: string;
  name: string;
  count: number;
  order: number;
}

export interface ControlDKnownIP {
  PK: string;
  ip: string;
  ts: number;
  last_used: number;
  geo: {
    country: string;
    city: string;
    asn: number;
    asn_org: string;
  };
}

export interface ControlDProxy {
  PK: string;
  city: string;
  country: string;
  country_name: string;
  gps: {
    lat: number;
    long: number;
  };
}

export interface ControlDOrganization {
  PK: string;
  name: string;
  members: number;
  endpoints: number;
  profiles: number;
}

export interface ControlDUser {
  PK: string;
  email: string;
  ts: number;
  status: number;
  org?: {
    PK: string;
    name: string;
    role: string;
  };
}

// Notion Configuration
export interface NotionConfig {
  token: string;
}

// Notion API Responses
export interface NotionUser {
  id: string;
  type: 'person' | 'bot';
  name: string;
  avatar_url: string | null;
  person?: {
    email: string;
  };
  bot?: {
    owner: {
      type: string;
      workspace?: boolean;
    };
  };
}

export interface NotionIcon {
  type: 'emoji' | 'external' | 'file';
  emoji?: string;
  external?: { url: string };
  file?: { url: string };
}

export interface NotionFile {
  type: 'external' | 'file';
  external?: { url: string };
  file?: { url: string; expiry_time: string };
}

export interface NotionRichText {
  type: 'text' | 'mention' | 'equation';
  plain_text: string;
  href?: string | null;
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
}

export interface NotionDatabase {
  id: string;
  object: 'database';
  title: NotionRichText[];
  description: NotionRichText[];
  icon: NotionIcon | null;
  cover: NotionFile | null;
  properties: Record<string, NotionPropertySchema>;
  created_time: string;
  last_edited_time: string;
  url: string;
}

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: string;
  title?: Record<string, never>;
  rich_text?: Record<string, never>;
  number?: { format: string };
  select?: { options: Array<{ id: string; name: string; color: string }> };
  multi_select?: { options: Array<{ id: string; name: string; color: string }> };
  date?: Record<string, never>;
  checkbox?: Record<string, never>;
  status?: { options: Array<{ id: string; name: string; color: string }>; groups: Array<{ id: string; name: string; option_ids: string[] }> };
}

export interface NotionPage {
  id: string;
  object: 'page';
  parent: { type: string; database_id?: string; page_id?: string; workspace?: boolean };
  properties: Record<string, NotionPropertyValue>;
  icon: NotionIcon | null;
  cover: NotionFile | null;
  created_time: string;
  last_edited_time: string;
  created_by: { id: string };
  last_edited_by: { id: string };
  url: string;
}

export interface NotionPropertyValue {
  id: string;
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  number?: number | null;
  select?: { id: string; name: string; color: string } | null;
  multi_select?: Array<{ id: string; name: string; color: string }>;
  date?: { start: string; end?: string | null; time_zone?: string | null } | null;
  checkbox?: boolean;
  status?: { id: string; name: string; color: string } | null;
  people?: Array<{ id: string; name?: string; avatar_url?: string | null }>;
  url?: string | null;
  email?: string | null;
  phone_number?: string | null;
  created_time?: string;
  last_edited_time?: string;
  created_by?: { id: string };
  last_edited_by?: { id: string };
}

// Slack Configuration
export interface SlackConfig {
  token: string;
}

// Slack API Responses
export interface SlackTeam {
  id: string;
  name: string;
  domain: string;
  email_domain?: string;
  icon: {
    image_34?: string;
    image_44?: string;
    image_68?: string;
    image_88?: string;
    image_102?: string;
    image_132?: string;
    image_default?: boolean;
  };
  enterprise_id?: string;
  enterprise_name?: string;
}

export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  real_name?: string;
  profile: {
    title?: string;
    phone?: string;
    email?: string;
    display_name?: string;
    status_text?: string;
    status_emoji?: string;
    status_expiration?: number;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
  };
  is_admin?: boolean;
  is_owner?: boolean;
  is_bot?: boolean;
  is_app_user?: boolean;
  updated?: number;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
}

export interface SlackUserPresence {
  presence: 'active' | 'away';
  online?: boolean;
  auto_away?: boolean;
  manual_away?: boolean;
  connection_count?: number;
  last_activity?: number;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_general: boolean;
  is_member: boolean;
  created: number;
  creator: string;
  topic: { value: string; creator: string; last_set: number };
  purpose: { value: string; creator: string; last_set: number };
  num_members?: number;
  unread_count?: number;
  unread_count_display?: number;
}

export interface SlackMessage {
  type: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
}

// 1Password Configuration
export interface OnePasswordConfig {
  // Connect Server mode
  host?: string;
  port?: number;
  token: string;
  verifySSL?: boolean;

  // Service Account mode
  useServiceAccount?: boolean;
}

// 1Password API Responses
export interface OnePasswordVault {
  id: string;
  name: string;
  description?: string;
  attributeVersion: number;
  contentVersion: number;
  items: number;
  type: 'USER_CREATED' | 'PERSONAL' | 'EVERYONE' | 'TRANSFER';
  createdAt: string;
  updatedAt: string;
}

export interface OnePasswordItem {
  id: string;
  title: string;
  vault: { id: string; name?: string };
  category: OnePasswordCategory;
  urls?: Array<{ primary?: boolean; href: string }>;
  favorite: boolean;
  tags?: string[];
  version: number;
  state: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  lastEditedBy?: string;
  // Fields only included when fetching single item
  fields?: OnePasswordField[];
  sections?: OnePasswordSection[];
}

export type OnePasswordCategory =
  | 'LOGIN'
  | 'SECURE_NOTE'
  | 'CREDIT_CARD'
  | 'IDENTITY'
  | 'PASSWORD'
  | 'DOCUMENT'
  | 'API_CREDENTIAL'
  | 'DATABASE'
  | 'MEMBERSHIP'
  | 'PASSPORT'
  | 'DRIVER_LICENSE'
  | 'OUTDOOR_LICENSE'
  | 'REWARD_PROGRAM'
  | 'SOCIAL_SECURITY_NUMBER'
  | 'BANK_ACCOUNT'
  | 'EMAIL_ACCOUNT'
  | 'SERVER'
  | 'WIRELESS_ROUTER'
  | 'SOFTWARE_LICENSE';

export interface OnePasswordField {
  id: string;
  type: 'STRING' | 'EMAIL' | 'CONCEALED' | 'URL' | 'TOTP' | 'DATE' | 'MONTH_YEAR' | 'MENU';
  purpose?: 'USERNAME' | 'PASSWORD' | 'NOTES';
  label: string;
  value?: string;
  reference?: string;
  section?: { id: string };
}

export interface OnePasswordSection {
  id: string;
  label?: string;
}

export interface OnePasswordActivity {
  uuid: string;
  timestamp: string;
  actorUuid?: string;
  actorType?: 'user' | 'service_account';
  action: string;
  objectType: 'item' | 'vault' | 'user' | 'group';
  objectUuid: string;
  auxUuid?: string;
  auxInfo?: Record<string, unknown>;
}

export interface OnePasswordHealth {
  name: string;
  version: string;
  dependencies: Array<{
    service: string;
    status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
    message?: string;
  }>;
}

// Microsoft 365 Configuration
export interface Microsoft365Config {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

// Google Workspace Configuration
export interface GoogleWorkspaceConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

// Storj Configuration
export interface StorjConfig {
  mode?: 'storage' | 'node';
  // S3 mode fields
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  bucket?: string;
  // Node mode fields
  nodeHost?: string;
  nodePort?: number;
}

// KitchenOwl Configuration
export interface KitchenOwlConfig {
  host: string;
  port?: number;
  username: string;
  password: string;
  householdId?: number;
  verifySSL?: boolean;
}

// VMware ESXi Configuration
export interface ESXiConfig {
  host: string;
  port?: number;
  username: string;
  password: string;
  verifySSL?: boolean;
}

// Palo Alto PAN-OS Configuration
export interface PANOSConfig {
  host: string;
  port?: number;
  apiKey?: string;
  username?: string;
  password?: string;
  vsys?: string;
  verifySSL?: boolean;
}

// FortiGate Configuration
export interface FortiGateConfig {
  host: string;
  port?: number;
  apiToken?: string;
  username?: string;
  password?: string;
  vdom?: string;
  verifySSL?: boolean;
}

// GitHub Configuration
export interface GitHubConfig {
  token: string;
  username?: string;
  defaultOrg?: string;
}

// Docker Configuration
export interface DockerConfig {
  connectionType: 'socket' | 'tcp';
  // Socket connection
  socketPath?: string;  // Default: /var/run/docker.sock
  // TCP connection
  host?: string;
  port?: number;
  // TLS configuration
  useTls?: boolean;
  tlsCert?: string;
  tlsKey?: string;
  tlsCa?: string;
  tlsVerify?: boolean;
  // Read-only mode
  readOnly?: boolean;
}

// Docker Container
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  imageId: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'removing';
  status: string;
  created: number;
  ports: { privatePort: number; publicPort?: number; type: string; ip?: string }[];
  labels: Record<string, string>;
  networkMode?: string;
  mounts?: { type: string; source: string; destination: string; mode: string }[];
  healthStatus?: 'healthy' | 'unhealthy' | 'starting' | 'none';
}

// Docker Container Stats
export interface DockerContainerStats {
  containerId: string;
  containerName: string;
  cpu: {
    percent: number;
    cores: number;
  };
  memory: {
    used: number;
    limit: number;
    percent: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
    rxRate: number;
    txRate: number;
  };
  blockIo: {
    read: number;
    write: number;
  };
  pids: number;
}

// Docker System Info
export interface DockerSystemInfo {
  dockerVersion: string;
  apiVersion: string;
  osType: string;
  architecture: string;
  kernelVersion: string;
  operatingSystem: string;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  memoryTotal: number;
  cpus: number;
  storageDriver: string;
  serverVersion: string;
}

// Docker Disk Usage
export interface DockerDiskUsageCategory {
  totalCount: number;
  totalSize: number;
  reclaimableSize: number;
  activeCount?: number;
  runningCount?: number;
  inUseCount?: number;
}

export interface DockerDiskUsage {
  images: DockerDiskUsageCategory;
  containers: DockerDiskUsageCategory;
  volumes: DockerDiskUsageCategory;
  buildCache: DockerDiskUsageCategory;
  totalSize: number;
  totalReclaimable: number;
}

// Docker Image
export interface DockerImage {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  size: number;
  created: number;
  containers: number;
  dangling: boolean;
}

// Docker Network
export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet?: string;
  gateway?: string;
  containerCount: number;
  internal: boolean;
  attachable: boolean;
}

// Docker Volume
export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string;
  inUse: boolean;
  size?: number;
  labels: Record<string, string>;
}

// Docker Log Entry
export interface DockerLogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr';
  message: string;
}

// GitHub User
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

// GitHub Repository
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  language: string | null;
  forks_count: number;
  stargazers_count: number;
  watchers_count: number;
  open_issues_count: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  visibility: 'public' | 'private' | 'internal';
  topics: string[];
  archived: boolean;
  disabled: boolean;
}

// GitHub Label
export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

// GitHub Milestone
export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  due_on: string | null;
}

// GitHub Issue
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  body: string | null;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: { url: string };
  repository?: GitHubRepository;
}

// GitHub Pull Request
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  body: string | null;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  draft: boolean;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  merged_at: string | null;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
  repository_url?: string;
}

// GitHub Workflow Run
export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
  workflow_id: number;
  html_url: string;
  event: string;
  actor: GitHubUser;
  run_started_at: string;
  updated_at: string;
  run_attempt: number;
}

// GitHub Notification
export interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  last_read_at: string | null;
  subject: {
    title: string;
    url: string;
    latest_comment_url: string | null;
    type: 'Issue' | 'PullRequest' | 'Commit' | 'Release' | 'Discussion';
  };
  repository: GitHubRepository;
}

// GitHub Contribution Day
export interface GitHubContributionDay {
  date: string;
  contributionCount: number;
  color: string;
}

// GitHub Contribution Week
export interface GitHubContributionWeek {
  contributionDays: GitHubContributionDay[];
}

// GitHub Contribution Calendar
export interface GitHubContributionCalendar {
  totalContributions: number;
  weeks: GitHubContributionWeek[];
}

// ============================================================================
// Gitea Types
// ============================================================================

// Gitea Configuration
export interface GiteaConfig {
  host: string;
  port?: number;
  useSSL?: boolean;
  verifySSL?: boolean;
  token?: string;
  username?: string;
  password?: string;
  otp?: string;
}

// Gitea User
export interface GiteaUser {
  id: number;
  login: string;
  full_name: string;
  email: string;
  avatar_url: string;
  language: string;
  is_admin: boolean;
  last_login: string;
  created: string;
  followers_count: number;
  following_count: number;
  starred_repos_count: number;
}

// Gitea Organization
export interface GiteaOrganization {
  id: number;
  username: string;
  full_name: string;
  avatar_url: string;
  description: string;
  website: string;
  location: string;
  visibility: string;
  repo_admin_change_team_access: boolean;
}

// Gitea Repository
export interface GiteaRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GiteaUser;
  private: boolean;
  html_url: string;
  description: string;
  fork: boolean;
  language: string;
  forks_count: number;
  stars_count: number;
  watchers_count: number;
  open_issues_count: number;
  open_pr_counter: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  mirror: boolean;
  size: number;
  empty: boolean;
  topics: string[];
}

// Gitea Label
export interface GiteaLabel {
  id: number;
  name: string;
  color: string;
  description: string;
  url: string;
}

// Gitea Milestone
export interface GiteaMilestone {
  id: number;
  title: string;
  description: string;
  state: 'open' | 'closed';
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
  closed_at: string | null;
}

// Gitea Issue
export interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  body: string;
  user: GiteaUser;
  labels: GiteaLabel[];
  assignee: GiteaUser | null;
  assignees: GiteaUser[];
  milestone: GiteaMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  is_locked: boolean;
  repository?: {
    id: number;
    name: string;
    full_name: string;
  };
}

// Gitea Pull Request
export interface GiteaPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  body: string;
  user: GiteaUser;
  labels: GiteaLabel[];
  assignee: GiteaUser | null;
  assignees: GiteaUser[];
  milestone: GiteaMilestone | null;
  head: {
    ref: string;
    sha: string;
    repo: GiteaRepository;
  };
  base: {
    ref: string;
    sha: string;
    repo: GiteaRepository;
  };
  merged: boolean;
  mergeable: boolean;
  merged_at: string | null;
  merged_by: GiteaUser | null;
  comments: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
}

// Gitea Notification
export interface GiteaNotification {
  id: number;
  repository: GiteaRepository;
  subject: {
    title: string;
    url: string;
    latest_comment_url: string;
    type: 'Issue' | 'Pull' | 'Commit' | 'Repository';
    state: string;
  };
  unread: boolean;
  pinned: boolean;
  updated_at: string;
  url: string;
}

// Gitea Team
export interface GiteaTeam {
  id: number;
  name: string;
  description: string;
  organization: GiteaOrganization;
  permission: 'none' | 'read' | 'write' | 'admin' | 'owner';
  units: string[];
  members_count: number;
  repos_count: number;
}

// Gitea Activity/Event
export interface GiteaActivity {
  id: number;
  op_type: string;
  actor: GiteaUser;
  repo: GiteaRepository;
  ref_name: string;
  is_private: boolean;
  content: string;
  created: string;
}

// Gitea Heatmap Entry
export interface GiteaHeatmapEntry {
  timestamp: number;
  contributions: number;
}

// Discord Configuration
export interface DiscordConfig {
  token: string;
  guildId?: string;
}

// Discord API Responses
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
  banner?: string;
  accent_color?: number;
  flags?: number;
  public_flags?: number;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  splash?: string;
  owner_id: string;
  afk_channel_id?: string;
  afk_timeout: number;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  roles: DiscordRole[];
  emojis: DiscordEmoji[];
  features: string[];
  mfa_level: number;
  system_channel_id?: string;
  rules_channel_id?: string;
  max_members?: number;
  vanity_url_code?: string;
  description?: string;
  banner?: string;
  premium_tier: number;
  premium_subscription_count?: number;
  preferred_locale: string;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  nsfw_level: number;
  premium_progress_bar_enabled: boolean;
}

export interface DiscordGuildMember {
  user?: DiscordUser;
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending?: boolean;
}

export interface DiscordChannel {
  id: string;
  type: number;
  guild_id?: string;
  position?: number;
  name?: string;
  topic?: string;
  nsfw?: boolean;
  last_message_id?: string;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  parent_id?: string;
  last_pin_timestamp?: string;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  tts: boolean;
  mention_everyone: boolean;
  mentions: DiscordUser[];
  mention_roles: string[];
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  reactions?: DiscordReaction[];
  pinned: boolean;
  type: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  icon?: string;
  unicode_emoji?: string;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  flags: number;
}

export interface DiscordEmoji {
  id?: string;
  name?: string;
  roles?: string[];
  user?: DiscordUser;
  require_colons?: boolean;
  managed?: boolean;
  animated?: boolean;
  available?: boolean;
}

export interface DiscordVoiceState {
  guild_id?: string;
  channel_id?: string;
  user_id: string;
  member?: DiscordGuildMember;
  session_id: string;
  deaf: boolean;
  mute: boolean;
  self_deaf: boolean;
  self_mute: boolean;
  self_stream?: boolean;
  self_video: boolean;
  suppress: boolean;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  description?: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: { text: string; icon_url?: string };
  image?: { url: string; height?: number; width?: number };
  thumbnail?: { url: string; height?: number; width?: number };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export interface DiscordReaction {
  count: number;
  me: boolean;
  emoji: DiscordEmoji;
}

// GE SmartHQ Configuration
export interface GESmartHQConfig {
  email: string;
  password: string;
}

// GE SmartHQ API Responses
export interface GEAppliance {
  applianceId: string;
  type: GEApplianceType;
  brand: string;
  jid: string;
  nickname: string;
  online: boolean;
  lastSeen?: string;
  features: GEApplianceFeature[];
  erd: Record<string, string>;
}

export type GEApplianceType =
  | 'REFRIGERATOR'
  | 'FREEZER'
  | 'WINE_COOLER'
  | 'DISHWASHER'
  | 'WASHER'
  | 'DRYER'
  | 'WASHER_DRYER'
  | 'OVEN'
  | 'COOKTOP'
  | 'RANGE'
  | 'MICROWAVE'
  | 'HOOD'
  | 'AIR_CONDITIONER'
  | 'WATER_HEATER'
  | 'WATER_SOFTENER'
  | 'WATER_FILTER'
  | 'GARBAGE_DISPOSAL'
  | 'ADVANTIUM'
  | 'COFFEE_MAKER'
  | 'OPAL_ICE_MAKER'
  | 'UNKNOWN';

export interface GEApplianceFeature {
  featureId: string;
  featureName: string;
  featureType: string;
  readable: boolean;
  writable: boolean;
  options?: GEFeatureOption[];
}

export interface GEFeatureOption {
  value: string;
  label: string;
}

export interface GERefrigeratorState {
  fridgeTemp: number;
  fridgeTempSet: number;
  freezerTemp: number;
  freezerTempSet: number;
  doorOpen: boolean;
  filterStatus: 'good' | 'replace_soon' | 'replace_now';
  icemaker: 'on' | 'off';
  turboFreezeActive: boolean;
  turboCoolActive: boolean;
  waterFilterRemaining: number;
}

export interface GEDishwasherState {
  cycleState: 'idle' | 'running' | 'paused' | 'complete';
  cycleName: string;
  timeRemaining: number;
  delayStartHours: number;
  rinseAidLevel: 'full' | 'low' | 'empty';
  doorOpen: boolean;
  pods: number;
}

export interface GEWasherState {
  cycleState: 'idle' | 'running' | 'paused' | 'complete';
  cycleName: string;
  timeRemaining: number;
  spinSpeed: string;
  washTemp: string;
  soilLevel: string;
  doorLocked: boolean;
  delayStartHours: number;
}

export interface GEDryerState {
  cycleState: 'idle' | 'running' | 'paused' | 'complete';
  cycleName: string;
  timeRemaining: number;
  heatLevel: string;
  dampAlert: boolean;
  ecoMode: boolean;
}

export interface GEOvenState {
  upperOvenState: 'off' | 'preheating' | 'cooking' | 'keep_warm';
  upperOvenMode: string;
  upperOvenTemp: number;
  upperOvenTempSet: number;
  upperOvenProbeTemp?: number;
  upperOvenTimeRemaining: number;
  lowerOvenState?: 'off' | 'preheating' | 'cooking' | 'keep_warm';
  lowerOvenMode?: string;
  lowerOvenTemp?: number;
  lowerOvenTempSet?: number;
  lowerOvenTimeRemaining?: number;
  cooktopStatus?: GECooktopBurner[];
  sabbathMode: boolean;
}

export interface GECooktopBurner {
  position: string;
  active: boolean;
  heatLevel: number;
}

export interface GEAirConditionerState {
  powerOn: boolean;
  mode: 'cool' | 'heat' | 'fan' | 'auto' | 'eco';
  fanSpeed: 'low' | 'medium' | 'high' | 'auto';
  currentTemp: number;
  targetTemp: number;
  humidity?: number;
  filterAlert: boolean;
}

export interface GEWaterHeaterState {
  mode: 'standard' | 'heat_pump' | 'high_demand' | 'vacation';
  currentTemp: number;
  targetTemp: number;
  heating: boolean;
  available: number;
  efficiency?: number;
}

export interface GEOpalIceMakerState {
  powerOn: boolean;
  making: boolean;
  iceBinFull: boolean;
  needsWater: boolean;
  nightLightOn: boolean;
  scheduleEnabled: boolean;
}

// LG ThinQ Configuration
export interface LGThinQConfig {
  region: 'US' | 'EU' | 'KR' | 'AU' | 'CN' | 'RU';
  language: string;
  username: string;
  password: string;
}

// LG ThinQ API Responses
export interface LGDevice {
  deviceId: string;
  alias: string;
  deviceType: LGDeviceType;
  modelName: string;
  modelNumber: string;
  macAddress?: string;
  ssid?: string;
  networkType: 'wifi' | 'ethernet';
  online: boolean;
  platformType: 'thinq1' | 'thinq2';
  snapshot?: Record<string, unknown>;
  state?: LGDeviceState;
}

export type LGDeviceType =
  | 'REFRIGERATOR'
  | 'KIMCHI_REFRIGERATOR'
  | 'WINE_CELLAR'
  | 'WASHER'
  | 'DRYER'
  | 'STYLER'
  | 'DISHWASHER'
  | 'OVEN'
  | 'MICROWAVE'
  | 'COOKTOP'
  | 'HOOD'
  | 'AIR_CONDITIONER'
  | 'AIR_PURIFIER'
  | 'DEHUMIDIFIER'
  | 'HUMIDIFIER'
  | 'ROBOT_VACUUM'
  | 'TV'
  | 'STICK_VACUUM'
  | 'WATER_PURIFIER'
  | 'WATER_HEATER'
  | 'UNKNOWN';

export type LGDeviceState =
  | LGRefrigeratorState
  | LGWasherState
  | LGDryerState
  | LGDishwasherState
  | LGAirConditionerState
  | LGAirPurifierState
  | LGRobotVacuumState
  | LGTVState;

export interface LGRefrigeratorState {
  fridgeTemp: number;
  fridgeTempSet: number;
  freezerTemp: number;
  freezerTempSet: number;
  doorOpen: boolean;
  expressMode: boolean;
  expressFreezeMode: boolean;
  ecoFriendly: boolean;
  icemaker: 'on' | 'off';
  waterFilterUsed: number;
  freshAirFilter: 'on' | 'off' | 'auto';
  tempUnit: 'C' | 'F';
}

export interface LGWasherState {
  state: 'POWEROFF' | 'INITIAL' | 'PAUSE' | 'DETECTING' | 'RUNNING' | 'RINSING' | 'SPINNING' | 'END' | 'RESERVED' | 'ERROR';
  course: string;
  smartCourse: string;
  remainTimeHour: number;
  remainTimeMinute: number;
  initialTimeHour: number;
  initialTimeMinute: number;
  reserveTimeHour: number;
  reserveTimeMinute: number;
  doorLock: boolean;
  childLock: boolean;
  spinSpeed: string;
  waterTemp: string;
  rinseCount: number;
  dryLevel?: string;
  steam: boolean;
  turbowash: boolean;
  tcl?: number;
  errorCode?: string;
}

export interface LGDryerState {
  state: 'POWEROFF' | 'INITIAL' | 'RUNNING' | 'PAUSE' | 'END' | 'ERROR';
  course: string;
  remainTimeHour: number;
  remainTimeMinute: number;
  initialTimeHour: number;
  initialTimeMinute: number;
  dryLevel: string;
  tempControl: string;
  timeDry: boolean;
  antiCrease: boolean;
  childLock: boolean;
  selfClean: boolean;
  errorCode?: string;
}

export interface LGDishwasherState {
  state: 'POWEROFF' | 'INITIAL' | 'RUNNING' | 'PAUSE' | 'END' | 'ERROR';
  course: string;
  remainTimeHour: number;
  remainTimeMinute: number;
  initialTimeHour: number;
  initialTimeMinute: number;
  reserveTimeHour: number;
  reserveTimeMinute: number;
  delayStart: boolean;
  doorOpen: boolean;
  rinseRefill: boolean;
  childLock: boolean;
  extraDry: boolean;
  halfLoad: boolean;
  steamMode: boolean;
  dualZone: boolean;
  nightDry: boolean;
  energySaver: boolean;
  errorCode?: string;
}

export interface LGAirConditionerState {
  operation: boolean;
  opMode: 'COOL' | 'DRY' | 'FAN' | 'HEAT' | 'ACO' | 'AI' | 'AIRCLEAN' | 'AROMA';
  tempCurrent: number;
  tempTarget: number;
  windStrength: 'LOW' | 'MID' | 'HIGH' | 'POWER' | 'AUTO' | 'NATURE';
  windDirection: 'UP_DOWN' | 'LEFT_RIGHT' | 'SWING';
  airClean: boolean;
  airQuality?: number;
  humidity?: number;
  energySaving: boolean;
  sleepMode: boolean;
  filterRemain?: number;
  errorCode?: string;
}

export interface LGAirPurifierState {
  operation: boolean;
  opMode: 'CLEAN' | 'SILENT' | 'AUTO' | 'CIRCULATOR' | 'DUALCLEAN';
  windStrength: 'LOW' | 'MID' | 'HIGH' | 'AUTO' | 'POWER';
  circulate: boolean;
  airQuality: number;
  pm1: number;
  pm25: number;
  pm10: number;
  humidity?: number;
  filterRemainPercent: number;
  errorCode?: string;
}

export interface LGRobotVacuumState {
  state: 'CHARGING' | 'WORKING' | 'PAUSE' | 'HOMING' | 'ERROR' | 'STANDBY';
  cleanMode: 'NORMAL' | 'TURBO' | 'SILENT' | 'MOP';
  batteryLevel: number;
  repeat: boolean;
  cleanArea?: number;
  cleanTime?: number;
  errorCode?: string;
}

export interface LGTVState {
  power: boolean;
  volume: number;
  mute: boolean;
  channel?: string;
  channelName?: string;
  input: string;
  app?: string;
  pictureMode: string;
  soundMode: string;
}

export interface LGEnergyData {
  deviceId: string;
  day: number;
  week: number;
  month: number;
  year?: number;
}

export type IntegrationConfig = ProxmoxConfig | UnifiConfig | UnifiProtectConfig | BeszelConfig | AdGuardConfig | QnapConfig | PlexConfig | CiscoIOSXEConfig | PiKVMConfig | TautulliConfig | TapoConfig | KasaConfig | OverseerrConfig | HomeConnectConfig | SonarrConfig | RadarrConfig | TdarrConfig | BazarrConfig | SABnzbdConfig | QBittorrentConfig | RingConfig | ImmichConfig | WeatherConfig | HomebridgeConfig | HomeAssistantConfig | NetAlertXConfig | ActualBudgetConfig | NodeRedConfig | OllamaConfig | KasmConfig | WazuhConfig | PaperlessConfig | SonosConfig | EcobeeConfig | MikroTikConfig | ControlDConfig | NotionConfig | SlackConfig | OnePasswordConfig | DiscordConfig | GESmartHQConfig | LGThinQConfig | HomeKitConfig | Microsoft365Config | GoogleWorkspaceConfig | StorjConfig | KitchenOwlConfig | ESXiConfig | PANOSConfig | DockerConfig;

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

export interface LogEntry {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface IntegrationData {
  [key: string]: unknown;
}

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
  num_sta?: number; // Number of connected clients (for APs)
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

// UniFi Protect data types
export interface ProtectCamera {
  id: string;
  name: string;
  type: string;
  model: string;
  mac: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  isRecording: boolean;
  isMotionDetected: boolean;
  lastMotion: number | null;
  isMicEnabled: boolean;
  micVolume: number;
  videoMode: string;
  hdrType: string;
  featureFlags: {
    hasSmartDetect: boolean;
    smartDetectTypes: string[];
    hasHdr: boolean;
    hasChime: boolean;
    hasSpeaker: boolean;
  };
  lastSeen: number | null;
  uptime: number | null;
  firmwareVersion: string | null;
}

export interface ProtectSensor {
  id: string;
  name: string;
  type: string;
  model: string;
  mac: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  mountType: 'door' | 'window' | 'garage' | 'leak' | 'none';
  batteryStatus: {
    percentage: number | null;
    isLow: boolean;
  };
  isOpened: boolean | null;
  openStatusChangedAt: number | null;
  isMotionDetected: boolean;
  motionDetectedAt: number | null;
  leakDetectedAt: number | null;
  tamperingDetectedAt: number | null;
  alarmTriggeredAt: number | null;
  temperature: number | null;
  humidity: number | null;
  light: number | null;
}

export interface ProtectLight {
  id: string;
  name: string;
  type: string;
  model: string;
  mac: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  isLightOn: boolean;
  lightDeviceSettings: {
    isIndicatorEnabled: boolean;
    ledLevel: number;
    pirSensitivity: number;
  };
  isMotionDetected: boolean;
  lastMotion: number | null;
  isPirMotionDetected: boolean;
}

export interface ProtectChime {
  id: string;
  name: string;
  type: string;
  model: string;
  mac: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  volume: number;
  isProbing: boolean;
  lastRing: number | null;
}

export interface ProtectNvr {
  id: string;
  name: string;
  type: string;
  version: string;
  firmwareVersion: string;
  uptime: number;
  lastSeen: number;
  isRecordingDisabled: boolean;
  storageInfo: {
    totalSize: number;
    usedSize: number;
    totalSpaceUsed: number;
  };
  recordingRetentionDurationMs: number | null;
}

export interface ProtectEvent {
  id: string;
  type: string;
  start: number;
  end: number | null;
  camera: string | null;
  sensor: string | null;
  smartDetectTypes: string[];
  thumbnail: string | null;
  score: number | null;
  metadata: Record<string, unknown>;
}

export interface ProtectLiveview {
  id: string;
  name: string;
  isDefault: boolean;
  slots: Array<{
    cameras: string[];
    cycleInterval: number;
    cycleMode: string;
  }>;
}

// Cisco IOS-XE data types
export interface CiscoDeviceInfo {
  hostname: string;
  model: string;
  serialNumber: string;
  softwareVersion: string;
  uptime: number;
  systemDescription: string;
}

export interface CiscoInterface {
  name: string;
  description: string;
  type: string;
  adminStatus: 'up' | 'down';
  operStatus: 'up' | 'down' | 'testing' | 'unknown' | 'dormant' | 'notPresent' | 'lowerLayerDown';
  speed: number;
  mtu: number;
  macAddress: string;
  inOctets: number;
  outOctets: number;
  inErrors: number;
  outErrors: number;
  inDiscards: number;
  outDiscards: number;
  lastChange: number;
}

export interface CiscoResourceUsage {
  cpuUsage: number;
  memoryUsed: number;
  memoryFree: number;
  memoryTotal: number;
  memoryUsagePercent: number;
}

export interface CiscoEnvironmentSensor {
  name: string;
  type: 'temperature' | 'fan' | 'power' | 'voltage' | 'current' | 'other';
  value: number;
  unit: string;
  status: 'ok' | 'warning' | 'critical' | 'shutdown' | 'notPresent' | 'notFunctioning';
  thresholdLow?: number;
  thresholdHigh?: number;
}

export interface CiscoVlan {
  id: number;
  name: string;
  status: 'active' | 'suspend' | 'act/unsup';
  ports: string[];
}

export interface CiscoPoePort {
  interface: string;
  adminStatus: 'auto' | 'off' | 'static';
  operStatus: 'on' | 'off' | 'faulty' | 'denied';
  power: number;
  maxPower: number;
  device: string;
  class: string;
}

export interface CiscoPoeStatus {
  module: number;
  availablePower: number;
  usedPower: number;
  remainingPower: number;
  ports: CiscoPoePort[];
}

export interface CiscoSpanningTreeInstance {
  vlan: number;
  rootBridge: string;
  rootCost: number;
  rootPort: string;
  localBridge: string;
  localPriority: number;
  topologyChanges: number;
  lastTopologyChange: number;
}

export interface CiscoSpanningTreePort {
  interface: string;
  vlan: number;
  role: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
  state: 'forwarding' | 'learning' | 'listening' | 'blocking' | 'disabled';
  cost: number;
  priority: number;
  type: string;
}

export interface CiscoStackMember {
  switchNumber: number;
  role: 'active' | 'standby' | 'member';
  priority: number;
  state: 'ready' | 'initializing' | 'version-mismatch' | 'waiting' | 'progressing' | 'invalid';
  macAddress: string;
  model: string;
  serialNumber: string;
  softwareImage: string;
}

// PiKVM data types
export interface PiKVMInfo {
  hw: {
    platform: string;
    type: string;
  };
  system: {
    kvmd: { version: string };
    streamer: { version: string };
  };
  meta: {
    server: { host: string };
  };
  extras?: {
    ipmi?: { enabled: boolean };
    janus?: { enabled: boolean };
  };
}

export interface PiKVMAtx {
  enabled: boolean;
  busy: boolean;
  leds: {
    power: boolean;
    hdd: boolean;
  };
}

export interface PiKVMMsd {
  enabled: boolean;
  online: boolean;
  busy: boolean;
  drive: {
    image: { name: string; size: number } | null;
    connected: boolean;
    cdrom: boolean;
  };
  storage: {
    size: number;
    free: number;
    images: { name: string; size: number; complete: boolean }[];
  };
}

export interface PiKVMStreamer {
  enabled: boolean;
  features: {
    quality: boolean;
    resolution: boolean;
  };
  params: {
    quality: number;
    desired_fps: number;
  };
  source: {
    online: boolean;
    resolution: { width: number; height: number };
    captured_fps: number;
  };
  stream: {
    queued_fps: number;
    clients: number;
    clients_stat: Record<string, unknown>;
  };
  snapshot: {
    saved: string | null;
  };
}

// Tautulli data types
export interface TautulliServerInfo {
  tautulliVersion: string;
  tautulliInstallType: string;
  tautulliUpdateAvailable: boolean;
  pmsName: string;
  pmsVersion: string;
  pmsPlatform: string;
  pmsIp: string;
  pmsPort: number;
  pmsIsRemote: boolean;
  pmsUrl: string;
  pmsIdentifier: string;
}

export interface TautulliSession {
  sessionKey: string;
  sessionId: string;
  mediaType: 'movie' | 'episode' | 'track' | 'photo' | 'clip';
  title: string;
  parentTitle?: string;
  grandparentTitle?: string;
  thumb?: string;
  parentThumb?: string;
  grandparentThumb?: string;
  year?: number;
  ratingKey: string;
  parentRatingKey?: string;
  grandparentRatingKey?: string;
  viewOffset: number;
  duration: number;
  progressPercent: number;
  state: 'playing' | 'paused' | 'buffering';
  transcodeDecision: 'transcode' | 'copy' | 'direct play';
  videoDecision?: 'transcode' | 'copy' | 'direct play';
  audioDecision?: 'transcode' | 'copy' | 'direct play';
  subtitleDecision?: 'transcode' | 'copy' | 'burn' | 'none';
  transcodeHwRequested: boolean;
  transcodeHwFullPipeline: boolean;
  streamBitrate: number;
  bandwidth: number;
  quality: string;
  qualityProfile: string;
  optimizedVersion: boolean;
  optimizedVersionProfile: string;
  optimizedVersionTitle: string;
  streamContainerDecision: string;
  streamContainer: string;
  streamVideoDecision?: string;
  streamVideoCodec?: string;
  streamVideoBitrate?: number;
  streamVideoWidth?: number;
  streamVideoHeight?: number;
  streamAudioDecision?: string;
  streamAudioCodec?: string;
  streamAudioBitrate?: number;
  streamAudioChannels?: number;
  user: string;
  userId: string;
  userThumb?: string;
  friendlyName: string;
  platform: string;
  product: string;
  player: string;
  device: string;
  ipAddress: string;
  ipAddressPublic?: string;
  location?: string;
  relayed: boolean;
  secure: boolean;
  local: boolean;
}

export interface TautulliActivity {
  streamCount: number;
  streamCountDirectPlay: number;
  streamCountDirectStream: number;
  streamCountTranscode: number;
  totalBandwidth: number;
  lanBandwidth: number;
  wanBandwidth: number;
  sessions: TautulliSession[];
}

export interface TautulliStatItem {
  rowId: number;
  title: string;
  thumb?: string;
  year?: number;
  users?: number;
  rating_key?: number;
  grandparent_rating_key?: number;
  total_plays: number;
  total_duration: number;
  user?: string;
  user_id?: number;
  user_thumb?: string;
  friendly_name?: string;
  platform?: string;
  last_play?: number;
}

export interface TautulliHomeStat {
  stat_id: string;
  stat_title: string;
  stat_type: 'plays' | 'duration';
  rows: TautulliStatItem[];
}

export interface TautulliRecentlyAddedItem {
  addedAt: number;
  mediaType: 'movie' | 'show' | 'season' | 'episode' | 'artist' | 'album' | 'track';
  ratingKey: string;
  parentRatingKey?: string;
  grandparentRatingKey?: string;
  title: string;
  parentTitle?: string;
  grandparentTitle?: string;
  thumb?: string;
  parentThumb?: string;
  grandparentThumb?: string;
  year?: number;
  duration?: number;
  contentRating?: string;
  libraryName: string;
  sectionId: number;
}

export interface TautulliHistoryItem {
  referenceId: number;
  rowId: number;
  id: number;
  date: number;
  started: number;
  stopped: number;
  duration: number;
  pausedCounter: number;
  user: string;
  userId: number;
  userThumb?: string;
  friendlyName: string;
  platform: string;
  product: string;
  player: string;
  ipAddress: string;
  live: boolean;
  machineId: string;
  mediaType: 'movie' | 'episode' | 'track' | 'photo' | 'clip';
  ratingKey: string;
  parentRatingKey?: string;
  grandparentRatingKey?: string;
  title: string;
  parentTitle?: string;
  grandparentTitle?: string;
  originalTitle?: string;
  year?: number;
  thumb?: string;
  parentThumb?: string;
  grandparentThumb?: string;
  watchedStatus: number;
  percentComplete: number;
  transcodeDecision: string;
}

export interface TautulliLibrary {
  sectionId: number;
  sectionName: string;
  sectionType: 'movie' | 'show' | 'artist' | 'photo';
  count: number;
  parentCount?: number;
  childCount?: number;
  lastAccessed?: number;
  historyRowId?: number;
  isActive: boolean;
}

export interface TautulliPlaysByDateItem {
  date: string;
  movies: number;
  tv: number;
  music: number;
  live: number;
}

export interface TautulliPlaysByDate {
  categories: string[];
  series: {
    name: string;
    data: number[];
  }[];
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
  runtimeName: string;
  startTime: string;
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
export interface ProwlarrConfig {
  host: string;
  port: number;
  apiKey: string;
  verifySSL?: boolean;
}

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
  stage_log: SABnzbdStageLog[];
}

export interface SABnzbdStageLog {
  name: string;
  actions: string[];
}

export interface SABnzbdStatus {
  version: string;
  uptime: string;
  color_scheme: string;
  helpuri: string;
  pid: number;
  active_lang: string;
  rtl: boolean;
  diskspace1: string;
  diskspace2: string;
  diskspacetotal1: string;
  diskspacetotal2: string;
  speedlimit: string;
  speedlimit_abs: string;
  have_warnings: string;
  finishaction: string | null;
  quota: string;
  left_quota: string;
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

export interface QBittorrentAppPreferences {
  locale: string;
  save_path: string;
  temp_path_enabled: boolean;
  temp_path: string;
  scan_dirs: Record<string, number | string>;
  max_active_downloads: number;
  max_active_torrents: number;
  max_active_uploads: number;
  dht: boolean;
  pex: boolean;
  lsd: boolean;
  dl_limit: number;
  up_limit: number;
  alt_dl_limit: number;
  alt_up_limit: number;
  scheduler_enabled: boolean;
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
  quotaSizeInBytes: number | null;
}

export interface ImmichStatistics {
  photos: number;
  videos: number;
  usage: number;
  usageByUser: ImmichUserUsage[];
}

export interface ImmichJobCounts {
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  waiting: number;
  paused: number;
}

export interface ImmichQueueStatus {
  isActive: boolean;
  isPaused: boolean;
}

export interface ImmichJobStatus {
  jobCounts: ImmichJobCounts;
  queueStatus: ImmichQueueStatus;
}

export interface ImmichAllJobs {
  thumbnailGeneration: ImmichJobStatus;
  metadataExtraction: ImmichJobStatus;
  videoConversion: ImmichJobStatus;
  faceDetection: ImmichJobStatus;
  facialRecognition: ImmichJobStatus;
  smartSearch: ImmichJobStatus;
  duplicateDetection: ImmichJobStatus;
  backgroundTask: ImmichJobStatus;
  storageTemplateMigration: ImmichJobStatus;
  migration: ImmichJobStatus;
  search: ImmichJobStatus;
  sidecar: ImmichJobStatus;
  library: ImmichJobStatus;
  notifications: ImmichJobStatus;
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  albumThumbnailAssetId: string | null;
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
  deviceAssetId: string;
  ownerId: string;
  deviceId: string;
  type: 'IMAGE' | 'VIDEO';
  originalPath: string;
  originalFileName: string;
  resized: boolean;
  fileCreatedAt: string;
  fileModifiedAt: string;
  updatedAt: string;
  isFavorite: boolean;
  isArchived: boolean;
  isTrashed: boolean;
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

// Home Assistant data types
export interface HomeAssistantSystemConfig {
  location_name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  unit_system: {
    length: string;
    mass: string;
    temperature: string;
    volume: string;
  };
  time_zone: string;
  version: string;
  config_dir: string;
  allowlist_external_dirs: string[];
  allowlist_external_urls: string[];
  components: string[];
  state: string;
}

export interface HomeAssistantEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface HomeAssistantService {
  domain: string;
  services: Record<string, {
    name?: string;
    description?: string;
    fields?: Record<string, unknown>;
  }>;
}

export interface HomeAssistantLogEntry {
  when: string;
  name: string;
  message?: string;
  entity_id?: string;
  domain?: string;
  state?: string;
  icon?: string;
}

export interface HomeAssistantCombinedStatus {
  config: HomeAssistantSystemConfig;
  entityCount: number;
  domainCounts: Record<string, number>;
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

export interface NetAlertXSession {
  ses_MAC: string;
  ses_Connection: string;
  ses_Disconnection: string;
  ses_Duration: number;
  ses_IP: string;
  ses_Info: string;
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

// Actual Budget data types
export interface ActualBudgetAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'mortgage' | 'debt' | 'other';
  offbudget: boolean;
  closed: boolean;
  balance?: number;
}

export interface ActualBudgetTransaction {
  id: string;
  account: string;
  date: string;
  amount: number;
  payee?: string;
  payee_name?: string;
  category?: string;
  notes?: string;
  cleared: boolean;
  transfer_id?: string;
}

export interface ActualBudgetCategory {
  id: string;
  name: string;
  group_id: string;
  is_income: boolean;
}

export interface ActualBudgetCategoryGroup {
  id: string;
  name: string;
  is_income: boolean;
}

export interface ActualBudgetBudgetMonth {
  month: string;
  incomeAvailable: number;
  lastMonthOverspent: number;
  forNextMonth: number;
  totalBudgeted: number;
  toBudget: number;
  categoryBudgets: Array<{
    category: string;
    budgeted: number;
    spent: number;
    balance: number;
    carryover: boolean;
  }>;
}

export interface ActualBudgetPayee {
  id: string;
  name: string;
  transfer_acct?: string;
}

// Node-RED data types
export interface NodeRedFlow {
  id: string;
  label: string;
  disabled: boolean;
  info: string;
  nodeCount: number;
  env?: Array<{ name: string; value: string; type: string }>;
}

export interface NodeRedNode {
  module: string;
  version: string;
  local: boolean;
  types: string[];
  enabled: boolean;
}

export interface NodeRedSettings {
  httpNodeRoot: string;
  version: string;
  context: {
    default: string;
    stores: string[];
  };
  libraries: Array<{ id: string; label: string }>;
  flowFilePretty: boolean;
  externalModules: {
    autoInstall: boolean;
    palette: { allowInstall: boolean };
  };
  functionExternalModules: boolean;
  flowEncryptionType: string;
  diagnostics: { enabled: boolean };
}

export interface NodeRedDiagnostics {
  report?: string;
  os?: {
    arch: string;
    platform: string;
    type: string;
    release: string;
    cpus: number;
    mem: {
      total: number;
      free: number;
    };
  };
  runtime?: {
    version: string;
    heap: {
      total: number;
      used: number;
    };
  };
  settings?: {
    version: string;
    flowFile?: string;
    contextStorageDefault?: string;
  };
  error?: string;
}

export interface NodeRedStatus {
  version: string;
  httpNodeRoot: string;
  state: string;
  flowCount: number;
  nodeCount: number;
  contextStores: string[];
  functionExternalModules: boolean;
}

export interface NodeRedFlowState {
  state: 'start' | 'stop' | 'safe' | 'unknown';
}

// Sonos data types
export interface SonosHousehold {
  id: string;
  name?: string;
}

export interface SonosPlayer {
  id: string;
  name: string;
  icon: string;
  softwareVersion: string;
  apiVersion: string;
  minApiVersion: string;
  capabilities: string[];
  deviceIds: string[];
  websocketUrl?: string;
}

export interface SonosGroup {
  id: string;
  name: string;
  coordinatorId: string;
  playbackState: 'PLAYBACK_STATE_IDLE' | 'PLAYBACK_STATE_BUFFERING' | 'PLAYBACK_STATE_PLAYING' | 'PLAYBACK_STATE_PAUSED';
  playerIds: string[];
}

export interface SonosPlaybackStatus {
  playbackState: 'PLAYBACK_STATE_IDLE' | 'PLAYBACK_STATE_BUFFERING' | 'PLAYBACK_STATE_PLAYING' | 'PLAYBACK_STATE_PAUSED';
  positionMillis?: number;
  playModes?: {
    repeat: boolean;
    repeatOne: boolean;
    shuffle: boolean;
    crossfade: boolean;
  };
  availablePlaybackActions?: {
    canSkip: boolean;
    canSkipBack: boolean;
    canSeek: boolean;
    canRepeat: boolean;
    canRepeatOne: boolean;
    canShuffle: boolean;
    canCrossfade: boolean;
    canPause: boolean;
    canStop: boolean;
  };
}

export interface SonosTrack {
  type: 'track' | 'episode' | 'ad';
  name: string;
  artist?: {
    name: string;
  };
  album?: {
    name: string;
  };
  imageUrl?: string;
  durationMillis?: number;
  service?: {
    name: string;
    id: string;
    imageUrl?: string;
  };
}

export interface SonosPlaybackMetadata {
  container?: {
    name: string;
    type: string;
    id?: {
      serviceId?: string;
      objectId?: string;
      accountId?: string;
    };
    imageUrl?: string;
    service?: {
      name: string;
      id: string;
      imageUrl?: string;
    };
  };
  currentItem?: {
    track?: SonosTrack;
  };
  nextItem?: {
    track?: SonosTrack;
  };
  streamInfo?: string;
}

export interface SonosVolume {
  volume: number;
  muted: boolean;
  fixed: boolean;
}

export interface SonosFavorite {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  service?: {
    name: string;
    id: string;
    imageUrl?: string;
  };
}

export interface SonosPlaylist {
  id: string;
  name: string;
  type: string;
  trackCount?: number;
}

export interface SonosNowPlaying {
  groupId: string;
  groupName: string;
  playbackState: string;
  track?: SonosTrack;
  positionMillis?: number;
  volume?: SonosVolume;
  players: string[];
}

export interface SonosGroupsData {
  households: SonosHousehold[];
  groups: SonosGroup[];
  players: SonosPlayer[];
}

// Ecobee data types
export interface EcobeeThermostat {
  identifier: string;
  name: string;
  thermostatRev: string;
  isRegistered: boolean;
  modelNumber: string;
  brand: string;
  features: string;
  lastModified: string;
  thermostatTime: string;
  utcTime: string;
  runtime: EcobeeRuntime;
  extendedRuntime?: EcobeeExtendedRuntime;
  settings: EcobeeSettings;
  location?: EcobeeLocation;
  program?: EcobeeProgram;
  events?: EcobeeEvent[];
  device?: EcobeeDevice[];
  alerts?: EcobeeAlert[];
  reminders?: EcobeeReminder[];
  weather?: EcobeeWeather;
  equipmentStatus?: string;
  remoteSensors?: EcobeeRemoteSensor[];
}

export interface EcobeeRuntime {
  runtimeRev: string;
  connected: boolean;
  firstConnected: string;
  connectDateTime: string;
  disconnectDateTime: string;
  lastModified: string;
  lastStatusModified: string;
  runtimeDate: string;
  runtimeInterval: number;
  actualTemperature: number;  // Divide by 10 for Fahrenheit
  actualHumidity: number;
  rawTemperature: number;
  showIconMode: number;
  desiredHeat: number;
  desiredCool: number;
  desiredHumidity: number;
  desiredDehumidity: number;
  desiredFanMode: string;
  desiredHeatRange: number[];
  desiredCoolRange: number[];
}

export interface EcobeeExtendedRuntime {
  lastReadingTimestamp: string;
  runtimeDate: string;
  runtimeInterval: number;
  actualTemperature: number[];
  actualHumidity: number[];
  desiredHeat: number[];
  desiredCool: number[];
  desiredHumidity: number[];
  desiredDehumidity: number[];
  dmOffset: number[];
  hvacMode: string[];
  heatPump1: number[];
  heatPump2: number[];
  auxHeat1: number[];
  auxHeat2: number[];
  auxHeat3: number[];
  cool1: number[];
  cool2: number[];
  fan: number[];
  humidifier: number[];
  dehumidifier: number[];
  economizer: number[];
  ventilator: number[];
  currentElectricityBill: number;
  projectedElectricityBill: number;
}

export interface EcobeeSettings {
  hvacMode: string;  // 'auto', 'auxHeatOnly', 'cool', 'heat', 'off'
  lastServiceDate: string;
  serviceRemindMe: boolean;
  monthsBetweenService: number;
  remindMeDate: string;
  vent: string;
  ventilatorMinOnTime: number;
  serviceRemindTechnician: boolean;
  eiLocation: string;
  coldTempAlert: number;
  coldTempAlertEnabled: boolean;
  hotTempAlert: number;
  hotTempAlertEnabled: boolean;
  coolStages: number;
  heatStages: number;
  maxSetBack: number;
  maxSetForward: number;
  quickSaveSetBack: number;
  quickSaveSetForward: number;
  hasHeatPump: boolean;
  hasForcedAir: boolean;
  hasBoiler: boolean;
  hasHumidifier: boolean;
  hasErv: boolean;
  hasHrv: boolean;
  condensationAvoid: boolean;
  useCelsius: boolean;
  useTimeFormat12: boolean;
  locale: string;
  humidity: string;
  humidifierMode: string;
  backlightOnIntensity: number;
  backlightSleepIntensity: number;
  backlightOffTime: number;
  soundTickVolume: number;
  soundAlertVolume: number;
  compressorProtectionMinTime: number;
  compressorProtectionMinTemp: number;
  stage1HeatingDifferentialTemp: number;
  stage1CoolingDifferentialTemp: number;
  stage1HeatingDissipationTime: number;
  stage1CoolingDissipationTime: number;
  heatPumpReversalOnCool: boolean;
  heatPumpGroundWater: boolean;
  dehumidifierMode: string;
  dehumidifierLevel: number;
  dehumidifyWithAC: boolean;
  dehumidifyOvercoolOffset: number;
  autoHeatCoolFeatureEnabled: boolean;
  wifiOfflineAlert: boolean;
  heatMinTemp: number;
  heatMaxTemp: number;
  coolMinTemp: number;
  coolMaxTemp: number;
  heatRangeHigh: number;
  heatRangeLow: number;
  coolRangeHigh: number;
  coolRangeLow: number;
  userAccessCode: string;
  userAccessSetting: number;
  auxRuntimeAlert: number;
  auxOutdoorTempAlert: number;
  auxMaxOutdoorTemp: number;
  auxRuntimeAlertNotify: boolean;
  auxOutdoorTempAlertNotify: boolean;
  auxRuntimeAlertNotifyTechnician: boolean;
  auxOutdoorTempAlertNotifyTechnician: boolean;
  disablePreHeating: boolean;
  disablePreCooling: boolean;
  installerCodeRequired: boolean;
  drAccept: string;
  isRentalProperty: boolean;
  useZoneController: boolean;
  randomStartDelayCool: number;
  randomStartDelayHeat: number;
  humidityHighAlert: number;
  humidityLowAlert: number;
  disableHeatPumpAlerts: boolean;
  disableAlertsOnIdt: boolean;
  humidityAlertNotify: boolean;
  humidityAlertNotifyTechnician: boolean;
  tempAlertNotify: boolean;
  tempAlertNotifyTechnician: boolean;
  monthlyElectricityBillLimit: number;
  enableElectricityBillAlert: boolean;
  enableProjectedElectricityBillAlert: boolean;
  electricityBillingDayOfMonth: number;
  electricityBillCycleMonths: number;
  electricityBillStartMonth: number;
  ventilatorMinOnTimeHome: number;
  ventilatorMinOnTimeAway: number;
  backlightOnTime: number;
  fanMinOnTime: number;
  fanControlRequired: boolean;
  groupRef: string;
  groupName: string;
  groupSetting: number;
}

export interface EcobeeLocation {
  timeZoneOffsetMinutes: number;
  timeZone: string;
  isDaylightSaving: boolean;
  streetAddress: string;
  city: string;
  provinceState: string;
  country: string;
  postalCode: string;
  phoneNumber: string;
  mapCoordinates: string;
}

export interface EcobeeProgram {
  schedule: number[][][];  // [day][period][climateRef]
  climates: EcobeeClimate[];
  currentClimateRef: string;
}

export interface EcobeeClimate {
  name: string;
  climateRef: string;
  isOccupied: boolean;
  isOptimized: boolean;
  coolFan: string;
  heatFan: string;
  vent: string;
  ventilatorMinOnTime: number;
  owner: string;
  type: string;
  colour: number;
  coolTemp: number;
  heatTemp: number;
}

export interface EcobeeEvent {
  type: string;
  name: string;
  running: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isOccupied: boolean;
  isCoolOff: boolean;
  isHeatOff: boolean;
  coolHoldTemp: number;
  heatHoldTemp: number;
  fan: string;
  vent: string;
  ventilatorMinOnTime: number;
  isOptional: boolean;
  isTemperatureRelative: boolean;
  isTemperatureAbsolute: boolean;
  dutyCyclePercentage: number;
  fanMinOnTime: number;
  occupiedSensorActive: boolean;
  unoccupiedSensorActive: boolean;
  drRampUpTemp: number;
  drRampUpTime: number;
  linkRef: string;
  holdClimateRef: string;
}

export interface EcobeeAlert {
  acknowledgeRef: string;
  date: string;
  time: string;
  severity: string;
  text: string;
  alertNumber: number;
  alertType: string;
  isOperatorAlert: boolean;
  reminder: string;
  showIdt: boolean;
  showWeb: boolean;
  sendEmail: boolean;
  acknowledgement: string;
  remindMeLater: boolean;
  thermostatIdentifier: string;
  notificationType: string;
}

export interface EcobeeRemoteSensor {
  id: string;
  name: string;
  type: string;
  code: string;
  inUse: boolean;
  capability: EcobeeSensorCapability[];
}

export interface EcobeeSensorCapability {
  id: string;
  type: string;  // 'temperature', 'humidity', 'occupancy'
  value: string;
}

export interface EcobeeWeather {
  timestamp: string;
  weatherStation: string;
  forecasts: EcobeeWeatherForecast[];
}

export interface EcobeeWeatherForecast {
  weatherSymbol: number;
  dateTime: string;
  condition: string;
  temperature: number;
  pressure: number;
  relativeHumidity: number;
  dewpoint: number;
  visibility: number;
  windSpeed: number;
  windGust: number;
  windDirection: string;
  windBearing: number;
  pop: number;  // Probability of precipitation
  tempHigh: number;
  tempLow: number;
  sky: number;
}

export interface EcobeeDevice {
  deviceId: number;
  name: string;
  sensors: EcobeeDeviceSensor[];
  outputs: EcobeeDeviceOutput[];
}

export interface EcobeeDeviceSensor {
  name: string;
  type: string;
  usage: string;
  numberOfBits: number;
  bconstant: number;
  thermistorSize: number;
  tempCorrection: number;
  gain: number;
  maxVoltage: number;
  multiplier: number;
  sensorDataPoints: number[];
}

export interface EcobeeDeviceOutput {
  name: string;
  zone: number;
  outputId: number;
  type: string;
  sendUpdate: boolean;
  activeClosed: boolean;
  activationTime: number;
  deactivationTime: number;
}

export interface EcobeeReminder {
  reminderRef: string;
  date: string;
  message: string;
  priority: string;
  sendEmail: boolean;
  enabled: boolean;
}

export interface EcobeeThermostatSummary {
  thermostatCount: number;
  revisionList: string[];
  statusList: string[];
}

// Tailscale Types
export interface TailscaleConfig {
  authMethod: 'apiKey' | 'oauth';
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  tailnet?: string;
}

export interface TailscaleDevice {
  id: string;
  addresses: string[];
  name: string;
  hostname: string;
  user: string;
  os: string;
  clientVersion: string;
  created: string;
  lastSeen?: string;
  keyExpiryDisabled: boolean;
  expires: string;
  authorized: boolean;
  isExternal: boolean;
  machineKey: string;
  nodeKey: string;
  blocksIncomingConnections: boolean;
  enabledRoutes: string[];
  advertisedRoutes: string[];
  clientConnectivity?: {
    endpoints: string[];
    derp: string;
    mappingVariesByDestIP: boolean;
    latency: Record<string, { latencyMs: number }>;
    clientSupports: {
      hairPinning: boolean;
      ipv6: boolean;
      pcp: boolean;
      pmp: boolean;
      udp: boolean;
      upnp: boolean;
    };
  };
  tags?: string[];
  tailnetLockError?: string;
  tailnetLockKey?: string;
  postureIdentity?: {
    serialNumbers: string[];
    disabled: boolean;
  };
}

export interface TailscaleUser {
  id: string;
  loginName: string;
  displayName: string;
  profilePicURL: string;
  tailnetId: string;
  created: string;
  type: 'member' | 'shared' | 'tagged';
  role: 'owner' | 'admin' | 'it-admin' | 'network-admin' | 'billing-admin' | 'auditor' | 'member';
  status: 'active' | 'idle' | 'suspended';
  deviceCount: number;
  lastSeen?: string;
  currentlyConnected: boolean;
}

export interface TailscaleDNSNameservers {
  dns: string[];
}

export interface TailscaleDNSPreferences {
  magicDNS: boolean;
}

export interface TailscaleDNSSearchPaths {
  searchPaths: string[];
}

export interface TailscaleAuthKey {
  id: string;
  key?: string;
  created: string;
  expires: string;
  revoked?: string;
  capabilities: {
    devices: {
      create: {
        reusable: boolean;
        ephemeral: boolean;
        preauthorized: boolean;
        tags: string[];
      };
    };
  };
  description?: string;
}

export interface TailscaleACL {
  acls: Array<{
    action: 'accept';
    src: string[];
    dst: string[];
  }>;
  groups?: Record<string, string[]>;
  tagOwners?: Record<string, string[]>;
  autoApprovers?: {
    routes?: Record<string, string[]>;
    exitNode?: string[];
  };
  ssh?: Array<{
    action: 'accept' | 'check';
    src: string[];
    dst: string[];
    users: string[];
  }>;
  tests?: Array<{
    src: string;
    accept?: string[];
    deny?: string[];
  }>;
}

export interface TailscaleWebhook {
  endpointId: string;
  endpointUrl: string;
  providerType?: 'slack' | 'mattermost' | 'googlechat' | 'discord';
  creatorId: string;
  created: string;
  lastModified: string;
  subscriptions: string[];
  secret?: string;
}

export type TailscaleWebhookEvent =
  | 'nodeCreated'
  | 'nodeApproved'
  | 'nodeDeleted'
  | 'nodeKeyExpired'
  | 'nodeKeyExpiringInOneDay'
  | 'nodeNeedsApproval'
  | 'nodeNeedsSignature'
  | 'nodeSigned'
  | 'policyUpdate'
  | 'userCreated'
  | 'userApproved'
  | 'userNeedsApproval'
  | 'userRoleUpdated'
  | 'exitNodeIPForwardingNotEnabled'
  | 'subnetIPForwardingNotEnabled'
  | 'test'
  | 'webhookDeleted'
  | 'webhookUpdated';

export interface TailscaleOverview {
  tailnetName: string;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalUsers: number;
  pendingApprovals: number;
  expiringKeys: number;
  subnetRouters: number;
  exitNodes: number;
  magicDNSEnabled: boolean;
}

export interface TailscaleRoute {
  id: string;
  deviceId: string;
  deviceName: string;
  route: string;
  type: 'subnet' | 'exit';
  enabled: boolean;
  approved: boolean;
}

export interface TailscaleDNS {
  nameservers: string[];
  magicDNS: boolean;
  searchPaths: string[];
}

// OPNsense Types
export interface OPNsenseConfig {
  host: string;
  port?: number;
  apiKey: string;
  apiSecret: string;
  verifySSL?: boolean;
}

export interface OPNsenseSystemData {
  hostname: string;
  version: string;
  platform: string;
  uptime: number;
  uptimeFormatted: string;
  firmware: {
    current: string;
    available?: string;
    updateAvailable: boolean;
  };
  cpu: {
    usage: number;
    model: string;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    percentUsed: number;
  };
  disk: {
    total: number;
    used: number;
    percentUsed: number;
  };
}

export interface OPNsenseInterface {
  name: string;
  description: string;
  device: string;
  status: 'up' | 'down' | 'no carrier';
  ipv4?: string;
  ipv6?: string;
  mac: string;
  mtu: number;
  media: string;
  inBytes: number;
  outBytes: number;
  inPackets: number;
  outPackets: number;
  inErrors: number;
  outErrors: number;
}

export interface OPNsenseFirewallRule {
  uuid: string;
  sequence: number;
  interface: string;
  direction: 'in' | 'out';
  action: 'pass' | 'block' | 'reject';
  protocol: string;
  source: string;
  destination: string;
  description: string;
  enabled: boolean;
  log: boolean;
  evaluations?: number;
  states?: number;
}

export interface OPNsenseAlias {
  uuid: string;
  name: string;
  type: string;
  content: string[];
  description: string;
  enabled: boolean;
}

export interface OPNsenseGateway {
  name: string;
  interface: string;
  gateway: string;
  status: 'online' | 'offline' | 'pending' | 'none';
  monitor: string;
  delay: number;
  stddev: number;
  loss: number;
  default: boolean;
}

export interface OPNsenseOpenVPNInstance {
  uuid: string;
  name: string;
  role: 'server' | 'client';
  status: 'up' | 'down';
  protocol: string;
  port?: number;
  connectedClients?: number;
  virtualAddress?: string;
}

export interface OPNsenseIPsecConnection {
  uuid: string;
  name: string;
  local: string;
  remote: string;
  status: 'established' | 'connecting' | 'down';
  phase1Up: boolean;
  phase2Up: boolean;
}

export interface OPNsenseWireGuardServer {
  uuid: string;
  name: string;
  publicKey: string;
  listenPort: number;
  peers: number;
}

export interface OPNsenseWireGuardClient {
  uuid: string;
  name: string;
  publicKey: string;
  endpoint?: string;
  allowedIPs: string[];
}

export interface OPNsenseService {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped';
  locked: boolean;
}

export interface OPNsenseDNSQuery {
  time: string;
  client: string;
  domain: string;
  type: string;
  status: string;
}

export interface OPNsenseIDSAlert {
  timestamp: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  signature: string;
  sourceIp: string;
  destIp: string;
  protocol: string;
}
