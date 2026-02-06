import React, { useState, useContext, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WidgetWithLayout, Integration } from '../../types';
import { WidgetDimensionsProvider, WidgetDimensions } from '../../contexts/WidgetDimensionsContext';
import { calculateScaleFactors, calculatePixelScaleFactors } from '../../utils/widgetScaling';
import { MoveWidgetModal } from './MoveWidgetModal';
import { VMList } from '../Widgets/proxmox/VMList';
import { ContainerList } from '../Widgets/proxmox/ContainerList';
import { NodeStatus } from '../Widgets/proxmox/NodeStatus';
import { ResourceUsage } from '../Widgets/proxmox/ResourceUsage';
import { StorageStatus } from '../Widgets/proxmox/StorageStatus';
import { TaskList } from '../Widgets/proxmox/TaskList';
import { BackupStatus } from '../Widgets/proxmox/BackupStatus';
import { MetricsChart } from '../Widgets/proxmox/MetricsChart';
import { ClusterStatus } from '../Widgets/proxmox/ClusterStatus';
import { DiskStatus } from '../Widgets/proxmox/DiskStatus';
import { NetworkStatus } from '../Widgets/proxmox/NetworkStatus';
import { CephStatus } from '../Widgets/proxmox/CephStatus';
import { HAStatus } from '../Widgets/proxmox/HAStatus';
import { GuestCount } from '../Widgets/proxmox/GuestCount';
import { GuestList } from '../Widgets/proxmox/GuestList';
import { ClientCount } from '../Widgets/unifi/ClientCount';
import { ApStatus } from '../Widgets/unifi/ApStatus';
import { ClientList } from '../Widgets/unifi/ClientList';
import { NetworkHealth } from '../Widgets/unifi/NetworkHealth';
import { ActiveDevices } from '../Widgets/unifi/ActiveDevices';
import { WifiNetworks } from '../Widgets/unifi/WifiNetworks';
import { DpiStats } from '../Widgets/unifi/DpiStats';
import { EventsList } from '../Widgets/unifi/EventsList';
import { SpeedTest } from '../Widgets/unifi/SpeedTest';
import { WanInfo } from '../Widgets/unifi/WanInfo';
import { SwitchPorts } from '../Widgets/unifi/SwitchPorts';
import { CameraList as ProtectCameraList } from '../Widgets/unifi-protect/CameraList';
import { CameraCount as ProtectCameraCount } from '../Widgets/unifi-protect/CameraCount';
import { SensorList as ProtectSensorList } from '../Widgets/unifi-protect/SensorList';
import { NvrStatus as ProtectNvrStatus } from '../Widgets/unifi-protect/NvrStatus';
import { EventList as ProtectEventList } from '../Widgets/unifi-protect/EventList';
import { SmartDetections as ProtectSmartDetections } from '../Widgets/unifi-protect/SmartDetections';
import { CameraSnapshot as ProtectCameraSnapshot } from '../Widgets/unifi-protect/CameraSnapshot';
import { ImageWidget } from '../Widgets/static/ImageWidget';
import { TextWidget } from '../Widgets/static/TextWidget';
import { NetworkTools } from '../Widgets/static/NetworkTools';
import { RSSWidget } from '../Widgets/static/RSSWidget';
import { WorldTimeWidget } from '../Widgets/static/WorldTimeWidget';
import { ServiceStatusWidget } from '../Widgets/static/ServiceStatusWidget';
import { WeatherWidget } from '../Widgets/static/WeatherWidget';
import { SpacerWidget } from '../Widgets/static/SpacerWidget';
import { SystemList as BeszelSystemList } from '../Widgets/beszel/SystemList';
import { SystemStats as BeszelSystemStats } from '../Widgets/beszel/SystemStats';
import { ContainerStats as BeszelContainerStats } from '../Widgets/beszel/ContainerStats';
import { AlertsList as BeszelAlertsList } from '../Widgets/beszel/AlertsList';
import {
  GitHubProfileWidget,
  GitHubRepoStatsWidget,
  GitHubReposWidget,
  GitHubIssuesWidget,
  GitHubPRsWidget,
  GitHubActionsWidget,
  GitHubNotificationsWidget,
  GitHubContributionsWidget,
} from '../Widgets/github';
import {
  Overview as GiteaOverview,
  Repositories as GiteaRepositories,
  Issues as GiteaIssues,
  PullRequests as GiteaPullRequests,
  Activity as GiteaActivity,
  Organizations as GiteaOrganizations,
  Notifications as GiteaNotifications,
} from '../Widgets/gitea';
import {
  ContainerList as DockerContainerList,
  ContainerStats as DockerContainerStats,
  SystemOverview as DockerSystemOverview,
  DiskUsage as DockerDiskUsage,
  ImageList as DockerImageList,
  NetworkOverview as DockerNetworkOverview,
  VolumeList as DockerVolumeList,
  ContainerLogs as DockerContainerLogs,
} from '../Widgets/docker';
import {
  Overview as TailscaleOverview,
  Devices as TailscaleDevices,
  Users as TailscaleUsers,
  DNS as TailscaleDNS,
  ACL as TailscaleACL,
  Routes as TailscaleRoutes,
  Keys as TailscaleKeys,
} from '../Widgets/tailscale';
import {
  System as OPNsenseSystem,
  Interfaces as OPNsenseInterfaces,
  Firewall as OPNsenseFirewall,
  Gateways as OPNsenseGateways,
  VPN as OPNsenseVPN,
  Services as OPNsenseServices,
  DNS as OPNsenseDNS,
  IDS as OPNsenseIDS,
} from '../Widgets/opnsense';
import { StatsOverview as AdGuardStatsOverview } from '../Widgets/adguard/StatsOverview';
import { TopClients as AdGuardTopClients } from '../Widgets/adguard/TopClients';
import { TopDomains as AdGuardTopDomains } from '../Widgets/adguard/TopDomains';
import { QueryLog as AdGuardQueryLog } from '../Widgets/adguard/QueryLog';
import { ProtectionStatus as AdGuardProtectionStatus } from '../Widgets/adguard/ProtectionStatus';
import { ActivityHeatmap as AdGuardActivityHeatmap } from '../Widgets/adguard/ActivityHeatmap';
import { SystemOverview as QnapSystemOverview } from '../Widgets/qnap/SystemOverview';
import { ResourceUsage as QnapResourceUsage } from '../Widgets/qnap/ResourceUsage';
import { VolumeStatus as QnapVolumeStatus } from '../Widgets/qnap/VolumeStatus';
import { DiskHealth as QnapDiskHealth } from '../Widgets/qnap/DiskHealth';
import { NetworkBandwidth as QnapNetworkBandwidth } from '../Widgets/qnap/NetworkBandwidth';
import { ServerStatus as PlexServerStatus } from '../Widgets/plex/ServerStatus';
import { LibraryStats as PlexLibraryStats } from '../Widgets/plex/LibraryStats';
import { NowPlaying as PlexNowPlaying } from '../Widgets/plex/NowPlaying';
import { RecentlyAdded as PlexRecentlyAdded } from '../Widgets/plex/RecentlyAdded';
import { TranscodingStatus as PlexTranscodingStatus } from '../Widgets/plex/TranscodingStatus';
import { DeviceOverview as CiscoDeviceOverview } from '../Widgets/cisco-iosxe/DeviceOverview';
import { InterfaceList as CiscoInterfaceList } from '../Widgets/cisco-iosxe/InterfaceList';
import { InterfaceCount as CiscoInterfaceCount } from '../Widgets/cisco-iosxe/InterfaceCount';
import { ResourceUsage as CiscoResourceUsage } from '../Widgets/cisco-iosxe/ResourceUsage';
import { EnvironmentStatus as CiscoEnvironmentStatus } from '../Widgets/cisco-iosxe/EnvironmentStatus';
import { VlanList as CiscoVlanList } from '../Widgets/cisco-iosxe/VlanList';
import { PoeStatus as CiscoPoeStatus } from '../Widgets/cisco-iosxe/PoeStatus';
import { SpanningTreeStatus as CiscoSpanningTreeStatus } from '../Widgets/cisco-iosxe/SpanningTreeStatus';
import { StackStatus as CiscoStackStatus } from '../Widgets/cisco-iosxe/StackStatus';
import { PortGrid as CiscoPortGrid } from '../Widgets/cisco-iosxe/PortGrid';
import { SystemInfo as PikvmSystemInfo } from '../Widgets/pikvm/SystemInfo';
import { PowerStatus as PikvmPowerStatus } from '../Widgets/pikvm/PowerStatus';
import { PowerControl as PikvmPowerControl } from '../Widgets/pikvm/PowerControl';
import { MsdStatus as PikvmMsdStatus } from '../Widgets/pikvm/MsdStatus';
import { StreamerStatus as PikvmStreamerStatus } from '../Widgets/pikvm/StreamerStatus';
import { Snapshot as PikvmSnapshot } from '../Widgets/pikvm/Snapshot';
import { SystemInfo as GlkvmSystemInfo } from '../Widgets/glkvm/SystemInfo';
import { PowerStatus as GlkvmPowerStatus } from '../Widgets/glkvm/PowerStatus';
import { PowerControl as GlkvmPowerControl } from '../Widgets/glkvm/PowerControl';
import { MsdStatus as GlkvmMsdStatus } from '../Widgets/glkvm/MsdStatus';
import { StreamerStatus as GlkvmStreamerStatus } from '../Widgets/glkvm/StreamerStatus';
import { Snapshot as GlkvmSnapshot } from '../Widgets/glkvm/Snapshot';
import { Activity as TautulliActivity } from '../Widgets/tautulli/Activity';
import { StreamCount as TautulliStreamCount } from '../Widgets/tautulli/StreamCount';
import { WatchStats as TautulliWatchStats } from '../Widgets/tautulli/WatchStats';
import { RecentlyAdded as TautulliRecentlyAdded } from '../Widgets/tautulli/RecentlyAdded';
import { History as TautulliHistory } from '../Widgets/tautulli/History';
import { PlaysChart as TautulliPlaysChart } from '../Widgets/tautulli/PlaysChart';
import { ServerStatus as TautulliServerStatus } from '../Widgets/tautulli/ServerStatus';
import { ActivityHeatmap as TautulliActivityHeatmap } from '../Widgets/tautulli/ActivityHeatmap';
import { DeviceList as TapoDeviceList } from '../Widgets/tapo/DeviceList';
import { DeviceStatus as TapoDeviceStatus } from '../Widgets/tapo/DeviceStatus';
import { EnergyOverview as TapoEnergyOverview } from '../Widgets/tapo/EnergyOverview';
import { PowerMonitor as TapoPowerMonitor } from '../Widgets/tapo/PowerMonitor';
import { SensorList as TapoSensorList } from '../Widgets/tapo/SensorList';
import { SensorValue as TapoSensorValue } from '../Widgets/tapo/SensorValue';
import { DeviceList as KasaDeviceList } from '../Widgets/kasa/DeviceList';
import { DeviceStatus as KasaDeviceStatus } from '../Widgets/kasa/DeviceStatus';
import { EnergyOverview as KasaEnergyOverview } from '../Widgets/kasa/EnergyOverview';
import { PowerMonitor as KasaPowerMonitor } from '../Widgets/kasa/PowerMonitor';
import { RequestStats as OverseerrRequestStats } from '../Widgets/overseerr/RequestStats';
import { RequestList as OverseerrRequestList } from '../Widgets/overseerr/RequestList';
import { PendingRequests as OverseerrPendingRequests } from '../Widgets/overseerr/PendingRequests';
import { ServerStatus as OverseerrServerStatus } from '../Widgets/overseerr/ServerStatus';
import { ApplianceList as HomeConnectApplianceList } from '../Widgets/homeconnect/ApplianceList';
import { ApplianceStatus as HomeConnectApplianceStatus } from '../Widgets/homeconnect/ApplianceStatus';
import { ActivePrograms as HomeConnectActivePrograms } from '../Widgets/homeconnect/ActivePrograms';
import { ProgramTimer as HomeConnectProgramTimer } from '../Widgets/homeconnect/ProgramTimer';
import { FridgeCamera as HomeConnectFridgeCamera } from '../Widgets/homeconnect/FridgeCamera';
import { SeriesLibrary as SonarrSeriesLibrary } from '../Widgets/sonarr/SeriesLibrary';
import { Calendar as SonarrCalendar } from '../Widgets/sonarr/Calendar';
import { DownloadQueue as SonarrDownloadQueue } from '../Widgets/sonarr/DownloadQueue';
import { WantedMissing as SonarrWantedMissing } from '../Widgets/sonarr/WantedMissing';
import { ActivityHistory as SonarrActivityHistory } from '../Widgets/sonarr/ActivityHistory';
import { SystemStatus as SonarrSystemStatus } from '../Widgets/sonarr/SystemStatus';
import { MovieLibrary as RadarrMovieLibrary } from '../Widgets/radarr/MovieLibrary';
import { Calendar as RadarrCalendar } from '../Widgets/radarr/Calendar';
import { DownloadQueue as RadarrDownloadQueue } from '../Widgets/radarr/DownloadQueue';
import { WantedMissing as RadarrWantedMissing } from '../Widgets/radarr/WantedMissing';
import { ActivityHistory as RadarrActivityHistory } from '../Widgets/radarr/ActivityHistory';
import { SystemStatus as RadarrSystemStatus } from '../Widgets/radarr/SystemStatus';
import { ServerStatus as TdarrServerStatus } from '../Widgets/tdarr/ServerStatus';
import { QueueOverview as TdarrQueueOverview } from '../Widgets/tdarr/QueueOverview';
import { ActiveWorkers as TdarrActiveWorkers } from '../Widgets/tdarr/ActiveWorkers';
import { NodeStatus as TdarrNodeStatus } from '../Widgets/tdarr/NodeStatus';
import { LibraryStats as TdarrLibraryStats } from '../Widgets/tdarr/LibraryStats';
import { SystemStatus as BazarrSystemStatus } from '../Widgets/bazarr/SystemStatus';
import { WantedOverview as BazarrWantedOverview } from '../Widgets/bazarr/WantedOverview';
import { RecentActivity as BazarrRecentActivity } from '../Widgets/bazarr/RecentActivity';
import { SeriesStatus as BazarrSeriesStatus } from '../Widgets/bazarr/SeriesStatus';
import { MoviesStatus as BazarrMoviesStatus } from '../Widgets/bazarr/MoviesStatus';
import { SystemStatus as ProwlarrSystemStatus } from '../Widgets/prowlarr/SystemStatus';
import { IndexerList as ProwlarrIndexerList } from '../Widgets/prowlarr/IndexerList';
import { IndexerStats as ProwlarrIndexerStats } from '../Widgets/prowlarr/IndexerStats';
import { ApplicationList as ProwlarrApplicationList } from '../Widgets/prowlarr/ApplicationList';
import { History as ProwlarrHistory } from '../Widgets/prowlarr/History';
import { ServerStatus as SABnzbdServerStatus } from '../Widgets/sabnzbd/ServerStatus';
import { DownloadQueue as SABnzbdDownloadQueue } from '../Widgets/sabnzbd/DownloadQueue';
import { History as SABnzbdHistory } from '../Widgets/sabnzbd/History';
import { ServerStats as SABnzbdServerStats } from '../Widgets/sabnzbd/ServerStats';
import { ServerStatus as QBittorrentServerStatus } from '../Widgets/qbittorrent/ServerStatus';
import { TorrentList as QBittorrentTorrentList } from '../Widgets/qbittorrent/TorrentList';
import { TransferStats as QBittorrentTransferStats } from '../Widgets/qbittorrent/TransferStats';
import { Categories as QBittorrentCategories } from '../Widgets/qbittorrent/Categories';
import { DeviceList as RingDeviceList } from '../Widgets/ring/DeviceList';
import { EventList as RingEventList } from '../Widgets/ring/EventList';
import { AlarmStatus as RingAlarmStatus } from '../Widgets/ring/AlarmStatus';
import { SensorList as RingSensorList } from '../Widgets/ring/SensorList';
import { Snapshot as RingSnapshot } from '../Widgets/ring/Snapshot';
import { ServerInfo as ImmichServerInfo } from '../Widgets/immich/ServerInfo';
import { Statistics as ImmichStatistics } from '../Widgets/immich/Statistics';
import { JobsStatus as ImmichJobsStatus } from '../Widgets/immich/JobsStatus';
import { AlbumList as ImmichAlbumList } from '../Widgets/immich/AlbumList';
import { RecentUploads as ImmichRecentUploads } from '../Widgets/immich/RecentUploads';
import { ServerStatus as HomebridgeServerStatus } from '../Widgets/homebridge/ServerStatus';
import { Accessories as HomebridgeAccessories } from '../Widgets/homebridge/Accessories';
import { AccessoryControl as HomebridgeAccessoryControl } from '../Widgets/homebridge/AccessoryControl';
import { Plugins as HomebridgePlugins } from '../Widgets/homebridge/Plugins';
import { SystemStatus as HomeAssistantSystemStatus } from '../Widgets/homeassistant/SystemStatus';
import { Entities as HomeAssistantEntities } from '../Widgets/homeassistant/Entities';
import { EntityControl as HomeAssistantEntityControl } from '../Widgets/homeassistant/EntityControl';
import { Logbook as HomeAssistantLogbook } from '../Widgets/homeassistant/Logbook';
import {
  DeviceOverview as NetAlertXDeviceOverview,
  DeviceList as NetAlertXDeviceList,
  RecentEvents as NetAlertXRecentEvents,
  SessionStats as NetAlertXSessionStats,
  InternetInfo as NetAlertXInternetInfo,
  Interfaces as NetAlertXInterfaces,
} from '../Widgets/netalertx';
import {
  NetWorth as ActualBudgetNetWorth,
  Accounts as ActualBudgetAccounts,
  BudgetOverview as ActualBudgetBudgetOverview,
  Transactions as ActualBudgetTransactions,
  CategorySpending as ActualBudgetCategorySpending,
} from '../Widgets/actualbudget';
import {
  Status as NodeRedStatus,
  FlowList as NodeRedFlowList,
  InstalledNodes as NodeRedInstalledNodes,
  Diagnostics as NodeRedDiagnostics,
} from '../Widgets/nodered';
import {
  Status as OllamaStatus,
  ModelList as OllamaModelList,
  RunningModels as OllamaRunningModels,
  Storage as OllamaStorage,
} from '../Widgets/ollama';
import {
  Status as KasmStatus,
  Sessions as KasmSessions,
  SessionCount as KasmSessionCount,
  Users as KasmUsers,
  Images as KasmImages,
  Zones as KasmZones,
} from '../Widgets/kasm';
import {
  Status as WazuhStatus,
  AgentOverview as WazuhAgentOverview,
  AgentList as WazuhAgentList,
  Vulnerabilities as WazuhVulnerabilities,
  ClusterStatus as WazuhClusterStatus,
  Stats as WazuhStats,
} from '../Widgets/wazuh';
import {
  Stats as PaperlessStats,
  RecentDocuments as PaperlessRecentDocuments,
  Inbox as PaperlessInbox,
  Tags as PaperlessTags,
  Correspondents as PaperlessCorrespondents,
  DocumentTypes as PaperlessDocumentTypes,
  Tasks as PaperlessTasks,
} from '../Widgets/paperless';
import {
  MediaPipeline as CrossMediaPipeline,
  SubtitleHealth as CrossSubtitleHealth,
  DownloadActivity as CrossDownloadActivity,
  TranscodingResources as CrossTranscodingResources,
  ServiceMapping as CrossServiceMapping,
  ClientCorrelation as CrossClientCorrelation,
} from '../Widgets/cross';
import {
  NowPlaying as SonosNowPlaying,
  Groups as SonosGroups,
  Volume as SonosVolume,
  Favorites as SonosFavorites,
  Playlists as SonosPlaylists,
  Players as SonosPlayers,
} from '../Widgets/sonos';
import {
  Thermostat as EcobeeThermostat,
  Sensors as EcobeeSensors,
  Weather as EcobeeWeather,
  Alerts as EcobeeAlerts,
  Equipment as EcobeeEquipment,
  Schedule as EcobeeSchedule,
} from '../Widgets/ecobee';
import {
  System as MikroTikSystem,
  Interfaces as MikroTikInterfaces,
  WirelessClients as MikroTikWirelessClients,
  DHCPLeases as MikroTikDHCPLeases,
  Firewall as MikroTikFirewall,
  Connections as MikroTikConnections,
  Routes as MikroTikRoutes,
  Arp as MikroTikArp,
  Log as MikroTikLog,
} from '../Widgets/mikrotik';
import {
  Overview as ControlDOverview,
  Devices as ControlDDevices,
  Profiles as ControlDProfiles,
  Filters as ControlDFilters,
  Services as ControlDServices,
  Rules as ControlDRules,
  KnownIPs as ControlDKnownIPs,
  Proxies as ControlDProxies,
} from '../Widgets/controld';
import {
  Workspace as NotionWorkspace,
  Databases as NotionDatabases,
  DatabaseView as NotionDatabaseView,
  TaskList as NotionTaskList,
  Recent as NotionRecent,
} from '../Widgets/notion';
import {
  Stats as PlantitStats,
  Plants as PlantitPlants,
  Events as PlantitEvents,
  Reminders as PlantitReminders,
  PlantDetail as PlantitPlantDetail,
} from '../Widgets/plantit';
import {
  Devices as HomeKitDevices,
  Lights as HomeKitLights,
  Climate as HomeKitClimate,
  Sensors as HomeKitSensors,
  DeviceControl as HomeKitDeviceControl,
} from '../Widgets/homekit';
import {
  Mail as Microsoft365Mail,
  Calendar as Microsoft365Calendar,
  OneDrive as Microsoft365OneDrive,
  Teams as Microsoft365Teams,
  Tasks as Microsoft365Tasks,
  Profile as Microsoft365Profile,
} from '../Widgets/microsoft365';
import {
  Mail as GoogleMail,
  Calendar as GoogleCalendar,
  Drive as GoogleDrive,
  Tasks as GoogleTasks,
} from '../Widgets/google-workspace';
import {
  Storage as StorjStorage,
  Files as StorjFiles,
  NodeStatus as StorjNodeStatus,
  Satellites as StorjSatellites,
  Earnings as StorjEarnings,
  Bandwidth as StorjBandwidth,
} from '../Widgets/storj';
import {
  ShoppingList as KitchenOwlShoppingList,
  Recipes as KitchenOwlRecipes,
  MealPlan as KitchenOwlMealPlan,
  Expenses as KitchenOwlExpenses,
  Household as KitchenOwlHousehold,
} from '../Widgets/kitchenowl';
import {
  VMList as ESXiVMList,
  HostStatus as ESXiHostStatus,
  Datastores as ESXiDatastores,
  Networks as ESXiNetworks,
  ResourceUsage as ESXiResourceUsage,
} from '../Widgets/esxi';
import {
  System as PANOSSystem,
  Interfaces as PANOSInterfaces,
  VPN as PANOSVPN,
  Policies as PANOSPolicies,
  Threats as PANOSThreats,
  Sessions as PANOSSessions,
  HA as PANOSHA,
} from '../Widgets/panos';
import {
  FortiGateSystem,
  FortiGateInterfaces,
  FortiGatePolicies,
  FortiGateVPN,
  FortiGateSessions,
  FortiGateSecurity,
  FortiGateDevices,
  FortiGateHA,
} from '../Widgets/fortigate';
import { SwitchPortOverlay } from '../Widgets/network/SwitchPortOverlay';
import { DeviceOverlay } from '../Widgets/network/DeviceOverlay';
import { EditWidgetModal } from './EditWidgetModal';
import { useDashboardStore } from '../../stores/dashboardStore';
import { WidgetRefreshContext } from '../../contexts/WidgetRefreshContext';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface GroupInfo {
  id: string;
  title: string;
}

interface WidgetWrapperProps {
  widget: WidgetWithLayout;
  integration?: Integration;
  onRemove: () => void;
  hideTitle?: boolean;
  isEditMode?: boolean;
  availableGroups?: GroupInfo[];
  onAddToGroup?: (groupId: string) => void;
  onCreateGroup?: (widgetId: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isInGroup?: boolean;
  onRemoveFromGroup?: () => void;
}

// Static widget types that don't require an integration
const STATIC_WIDGET_TYPES = ['image', 'text', 'network-tools', 'rss', 'world-time', 'service-status', 'spacer'];

// Cross-integration widget types (also don't require a specific integration)
const CROSS_INTEGRATION_WIDGET_TYPES = [
  'cross-media-pipeline',
  'cross-subtitle-health',
  'cross-download-activity',
  'cross-transcoding-resources',
  'cross-service-mapping',
  'cross-client-correlation',
  'cross-switch-port-overlay',
  'device-overlay',
];

// Efficient shallow comparison of widget config objects
// Avoids expensive JSON.stringify by comparing known config keys directly
const configsAreEqual = (
  prevConfig: Record<string, unknown>,
  nextConfig: Record<string, unknown>
): boolean => {
  const prevKeys = Object.keys(prevConfig);
  const nextKeys = Object.keys(nextConfig);

  // Different number of keys = different configs
  if (prevKeys.length !== nextKeys.length) return false;

  // Compare each key/value pair using strict equality
  // This handles primitives well; for nested objects, referential equality is checked
  for (const key of prevKeys) {
    if (prevConfig[key] !== nextConfig[key]) {
      // Special case: both are objects/arrays - do shallow comparison
      const prevVal = prevConfig[key];
      const nextVal = nextConfig[key];
      if (
        typeof prevVal === 'object' && prevVal !== null &&
        typeof nextVal === 'object' && nextVal !== null
      ) {
        // For nested objects, fall back to JSON comparison only for this specific value
        // This is still more efficient than stringifying the entire config
        if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) return false;
      } else {
        return false;
      }
    }
  }

  return true;
};

// Custom comparison for memo - only re-render when essential props change
const widgetWrapperPropsAreEqual = (
  prevProps: WidgetWrapperProps,
  nextProps: WidgetWrapperProps
): boolean => {
  // Always re-render if edit mode changes
  if (prevProps.isEditMode !== nextProps.isEditMode) return false;
  if (prevProps.hideTitle !== nextProps.hideTitle) return false;

  // Check widget changes
  if (prevProps.widget.id !== nextProps.widget.id) return false;
  if (prevProps.widget.title !== nextProps.widget.title) return false;
  if (prevProps.widget.widget_type !== nextProps.widget.widget_type) return false;

  // Check config changes with efficient comparison
  if (!configsAreEqual(prevProps.widget.config, nextProps.widget.config)) return false;

  // Check layout changes
  if (prevProps.widget.layout?.x !== nextProps.widget.layout?.x) return false;
  if (prevProps.widget.layout?.y !== nextProps.widget.layout?.y) return false;
  if (prevProps.widget.layout?.w !== nextProps.widget.layout?.w) return false;
  if (prevProps.widget.layout?.h !== nextProps.widget.layout?.h) return false;

  // Check integration changes
  if (prevProps.integration?.id !== nextProps.integration?.id) return false;

  // Check available groups changes (for Add to Group dropdown)
  const prevGroups = prevProps.availableGroups || [];
  const nextGroups = nextProps.availableGroups || [];
  if (prevGroups.length !== nextGroups.length) return false;
  for (let i = 0; i < prevGroups.length; i++) {
    if (prevGroups[i].id !== nextGroups[i].id) return false;
  }

  return true;
};

export const WidgetWrapper = memo(function WidgetWrapper({ widget, integration, onRemove, hideTitle: hideTitleProp = false, isEditMode = true, availableGroups = [], onAddToGroup, onCreateGroup, onDragStart, onDragEnd, isInGroup = false, onRemoveFromGroup }: WidgetWrapperProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [groupMenuPosition, setGroupMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [overflowMenuPosition, setOverflowMenuPosition] = useState<{ x: number; y: number; openUpward: boolean } | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);
  const overflowMenuContentRef = useRef<HTMLDivElement>(null);

  // Get dashboard store for move/copy functionality
  const { dashboards, currentDashboardId, copyWidgetToDashboard, moveWidgetToDashboard } = useDashboardStore();
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuButtonRef = useRef<HTMLButtonElement>(null);
  const { updateWidget, addWidget } = useDashboardStore();
  const refreshContext = useContext(WidgetRefreshContext);

  // Track widget dimensions for scaling
  const contentRef = useRef<HTMLDivElement>(null);
  const contentScale = (widget.config.contentScale as string) || 'auto';

  // Estimate pixel size from grid (assuming ~100px per grid unit)
  const gridWidth = widget.layout?.w || 3;
  const gridHeight = widget.layout?.h || 2;
  const estimatedPixelWidth = gridWidth * 100;
  const estimatedPixelHeight = gridHeight * 100;

  // Initialize with estimated dimensions immediately (no waiting for ResizeObserver)
  const [dimensions, setDimensions] = useState<WidgetDimensions>(() => ({
    gridWidth,
    gridHeight,
    pixelWidth: estimatedPixelWidth,
    pixelHeight: estimatedPixelHeight,
    scaleFactors: calculatePixelScaleFactors(estimatedPixelWidth, estimatedPixelHeight),
    contentScale,
  }));

  // ResizeObserver to update with actual pixel dimensions
  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const pixelWidth = entry.contentRect.width;
        const pixelHeight = entry.contentRect.height;

        // Skip if dimensions are zero (element not yet visible)
        if (pixelWidth === 0 || pixelHeight === 0) return;

        // Only update if dimensions actually changed significantly
        setDimensions(prev => {
          if (Math.abs(prev.pixelWidth - pixelWidth) < 5 && Math.abs(prev.pixelHeight - pixelHeight) < 5) {
            return prev; // No significant change, avoid re-render
          }
          return {
            gridWidth,
            gridHeight,
            pixelWidth,
            pixelHeight,
            scaleFactors: calculatePixelScaleFactors(pixelWidth, pixelHeight),
            contentScale,
          };
        });
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [gridWidth, gridHeight, contentScale, isCollapsed]);

  const isStaticWidget = STATIC_WIDGET_TYPES.includes(widget.widget_type);
  const isCrossIntegrationWidget = CROSS_INTEGRATION_WIDGET_TYPES.includes(widget.widget_type);

  // Check both the prop (from group) and the widget's own config
  const hideTitle = hideTitleProp || (widget.config.hideTitle as boolean) || false;
  const hideTitleText = (widget.config.hideTitleText as boolean) || false;
  const transparentBackground = (widget.config.transparentBackground as boolean) || false;
  const transparentHeader = (widget.config.transparentHeader as boolean) || false;
  const headerImageUrl = (widget.config.headerImageUrl as string) || '';
  const hideHeaderImage = (widget.config.hideHeaderImage as boolean) || false;
  const headerIconSize = (widget.config.headerIconSize as string) || 'md';
  const backgroundColor = (widget.config.backgroundColor as string) || '';
  const headerColor = (widget.config.headerColor as string) || '';
  const borderColor = (widget.config.borderColor as string) || '';
  const headerLinkUrl = (widget.config.headerLinkUrl as string) || '';
  const headerLinkOpenNewTab = (widget.config.headerLinkOpenNewTab as boolean) ?? true;
  const hideScrollbar = (widget.config.hideScrollbar as boolean) || false;
  const showHeaderImage = headerImageUrl && !hideHeaderImage;

  // Header icon size classes
  const headerIconSizeClasses: Record<string, string> = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
    xxl: 'h-10 w-10',
    xxxl: 'h-12 w-12',
  };
  const headerIconClass = headerIconSizeClasses[headerIconSize] || 'h-5 w-5';
  const showLastUpdated = (widget.config.showLastUpdated as boolean) || false;

  // Can only collapse if title bar is visible
  const canCollapse = !hideTitle;

  // Track last updated time locally
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Subscribe to lastUpdated changes when showLastUpdated is enabled
  useEffect(() => {
    if (!showLastUpdated || !refreshContext) return;

    // Get initial value
    const initial = refreshContext.getLastUpdated(widget.id);
    if (initial) {
      setLastUpdated(initial);
    }

    // Subscribe to updates for this widget
    const unsubscribe = refreshContext.subscribeToUpdates((widgetId, updated) => {
      if (widgetId === widget.id) {
        setLastUpdated(updated);
      }
    });

    return unsubscribe;
  }, [widget.id, showLastUpdated, refreshContext]);

  // Format last updated time
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return null;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle refresh button click
  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (refreshContext && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await refreshContext.refresh(widget.id);
        // Update timestamp immediately after refresh
        const updated = refreshContext.getLastUpdated(widget.id);
        if (updated) setLastUpdated(updated);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Handle duplicate button click
  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await addWidget(
        {
          integration_id: widget.integration_id,
          widget_type: widget.widget_type,
          title: `${widget.title} (Copy)`,
          config: { ...widget.config },
        },
        { w: widget.layout.w, h: widget.layout.h }
      );
    } catch (error) {
      console.error('Failed to duplicate widget:', error);
    }
  };

  // Only check for integration if not a static widget
  if (!isStaticWidget && !isCrossIntegrationWidget && !integration) {
    return (
      <div className="h-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Integration not found</span>
      </div>
    );
  }

  const handleConfigChange = async (newConfig: Record<string, unknown>) => {
    try {
      await updateWidget(widget.id, { config: newConfig });
    } catch (error) {
      console.error('Failed to update widget config:', error);
    }
  };

  const renderWidget = () => {
    // Props for integration-based widgets (integration_id is guaranteed non-null for these)
    const commonProps = {
      integrationId: widget.integration_id as string,
      title: widget.title,
      config: widget.config,
      widgetId: widget.id,
    };

    // Props for static widgets (no integration required)
    const staticProps = {
      title: widget.title,
      config: widget.config,
      onConfigChange: handleConfigChange,
      isEditMode,
      widgetId: widget.id,
    };

    switch (widget.widget_type) {
      // Proxmox widgets
      case 'vm-list':
        return <VMList {...commonProps} />;
      case 'container-list':
        return <ContainerList {...commonProps} />;
      case 'node-status':
        return <NodeStatus {...commonProps} />;
      case 'resource-usage':
        return <ResourceUsage {...commonProps} />;
      case 'storage-status':
        return <StorageStatus {...commonProps} />;
      case 'task-list':
        return <TaskList {...commonProps} />;
      case 'backup-status':
        return <BackupStatus {...commonProps} />;
      case 'metrics-chart':
        return <MetricsChart {...commonProps} />;
      case 'cluster-status':
        return <ClusterStatus {...commonProps} />;
      case 'disk-status':
        return <DiskStatus {...commonProps} />;
      case 'network-status':
        return <NetworkStatus {...commonProps} />;
      case 'ceph-status':
        return <CephStatus {...commonProps} />;
      case 'ha-status':
        return <HAStatus {...commonProps} />;
      case 'guest-count':
        return <GuestCount {...commonProps} />;
      case 'guest-list':
        return <GuestList {...commonProps} />;

      // UniFi widgets
      case 'client-count':
        return <ClientCount {...commonProps} />;
      case 'ap-status':
        return <ApStatus {...commonProps} />;
      case 'client-list':
        return <ClientList {...commonProps} />;
      case 'network-health':
        return <NetworkHealth {...commonProps} />;
      case 'active-devices':
        return <ActiveDevices {...commonProps} />;
      case 'wifi-networks':
        return <WifiNetworks {...commonProps} />;
      case 'dpi-stats':
        return <DpiStats {...commonProps} />;
      case 'events-list':
        return <EventsList {...commonProps} />;
      case 'speed-test':
        return <SpeedTest {...commonProps} />;
      case 'wan-info':
        return <WanInfo {...commonProps} />;
      case 'switch-ports':
        return <SwitchPorts {...commonProps} />;
      case 'cross-switch-port-overlay':
        return <SwitchPortOverlay {...commonProps} />;
      case 'device-overlay':
        return <DeviceOverlay {...commonProps} />;

      // UniFi Protect widgets
      case 'camera-list':
        return <ProtectCameraList {...commonProps} />;
      case 'camera-count':
        return <ProtectCameraCount {...commonProps} />;
      case 'sensor-list':
        return <ProtectSensorList {...commonProps} />;
      case 'nvr-status':
        return <ProtectNvrStatus {...commonProps} />;
      case 'event-list':
        return <ProtectEventList {...commonProps} />;
      case 'smart-detections':
        return <ProtectSmartDetections {...commonProps} />;
      case 'camera-snapshot':
        return <ProtectCameraSnapshot {...commonProps} />;

      // Static widgets (no integration required)
      case 'image':
        return <ImageWidget {...staticProps} />;
      case 'text':
        return <TextWidget {...staticProps} />;
      case 'network-tools':
        return <NetworkTools {...staticProps} />;
      case 'rss':
        return <RSSWidget {...staticProps} />;
      case 'world-time':
        return <WorldTimeWidget {...staticProps} />;
      case 'service-status':
        return <ServiceStatusWidget {...staticProps} />;
      case 'spacer':
        return <SpacerWidget {...staticProps} />;

      // Beszel widgets
      case 'beszel-system-list':
        return <BeszelSystemList {...commonProps} />;
      case 'beszel-system-stats':
        return <BeszelSystemStats {...commonProps} />;
      case 'beszel-container-stats':
        return <BeszelContainerStats {...commonProps} />;
      case 'beszel-alerts':
        return <BeszelAlertsList {...commonProps} />;

      // GitHub widgets
      case 'github-profile':
        return <GitHubProfileWidget {...commonProps} />;
      case 'github-repo-stats':
        return <GitHubRepoStatsWidget {...commonProps} />;
      case 'github-repos':
        return <GitHubReposWidget {...commonProps} />;
      case 'github-issues':
        return <GitHubIssuesWidget {...commonProps} />;
      case 'github-prs':
        return <GitHubPRsWidget {...commonProps} />;
      case 'github-actions':
        return <GitHubActionsWidget {...commonProps} />;
      case 'github-notifications':
        return <GitHubNotificationsWidget {...commonProps} />;
      case 'github-contributions':
        return <GitHubContributionsWidget {...commonProps} />;

      // Gitea widgets
      case 'gitea-overview':
        return <GiteaOverview {...commonProps} />;
      case 'gitea-repositories':
        return <GiteaRepositories {...commonProps} />;
      case 'gitea-issues':
        return <GiteaIssues {...commonProps} />;
      case 'gitea-pull-requests':
        return <GiteaPullRequests {...commonProps} />;
      case 'gitea-activity':
        return <GiteaActivity {...commonProps} />;
      case 'gitea-organizations':
        return <GiteaOrganizations {...commonProps} />;
      case 'gitea-notifications':
        return <GiteaNotifications {...commonProps} />;

      // Docker widgets
      case 'docker-container-list':
        return <DockerContainerList {...commonProps} />;
      case 'docker-container-stats':
        return <DockerContainerStats {...commonProps} />;
      case 'docker-system-overview':
        return <DockerSystemOverview {...commonProps} />;
      case 'docker-disk-usage':
        return <DockerDiskUsage {...commonProps} />;
      case 'docker-image-list':
        return <DockerImageList {...commonProps} />;
      case 'docker-network-overview':
        return <DockerNetworkOverview {...commonProps} />;
      case 'docker-volume-list':
        return <DockerVolumeList {...commonProps} />;
      case 'docker-container-logs':
        return <DockerContainerLogs {...commonProps} />;

      // Tailscale widgets
      case 'tailscale-overview':
        return <TailscaleOverview {...commonProps} />;
      case 'tailscale-devices':
        return <TailscaleDevices {...commonProps} />;
      case 'tailscale-users':
        return <TailscaleUsers {...commonProps} />;
      case 'tailscale-dns':
        return <TailscaleDNS {...commonProps} />;
      case 'tailscale-acl':
        return <TailscaleACL {...commonProps} />;
      case 'tailscale-routes':
        return <TailscaleRoutes {...commonProps} />;
      case 'tailscale-keys':
        return <TailscaleKeys {...commonProps} />;

      // OPNsense widgets
      case 'opnsense-system':
        return <OPNsenseSystem {...commonProps} />;
      case 'opnsense-interfaces':
        return <OPNsenseInterfaces {...commonProps} />;
      case 'opnsense-firewall':
        return <OPNsenseFirewall {...commonProps} />;
      case 'opnsense-gateways':
        return <OPNsenseGateways {...commonProps} />;
      case 'opnsense-vpn':
        return <OPNsenseVPN {...commonProps} />;
      case 'opnsense-services':
        return <OPNsenseServices {...commonProps} />;
      case 'opnsense-dns':
        return <OPNsenseDNS {...commonProps} />;
      case 'opnsense-ids':
        return <OPNsenseIDS {...commonProps} />;

      // AdGuard Home widgets
      case 'adguard-stats':
        return <AdGuardStatsOverview {...commonProps} />;
      case 'adguard-top-clients':
        return <AdGuardTopClients {...commonProps} />;
      case 'adguard-top-domains':
        return <AdGuardTopDomains {...commonProps} />;
      case 'adguard-query-log':
        return <AdGuardQueryLog {...commonProps} />;
      case 'adguard-status':
        return <AdGuardProtectionStatus {...commonProps} />;
      case 'adguard-activity-heatmap':
        return <AdGuardActivityHeatmap {...commonProps} />;

      // QNAP QTS widgets
      case 'qnap-system-overview':
        return <QnapSystemOverview {...commonProps} />;
      case 'qnap-resource-usage':
        return <QnapResourceUsage {...commonProps} />;
      case 'qnap-volume-status':
        return <QnapVolumeStatus {...commonProps} />;
      case 'qnap-disk-health':
        return <QnapDiskHealth {...commonProps} />;
      case 'qnap-network-bandwidth':
        return <QnapNetworkBandwidth {...commonProps} />;

      // Plex widgets
      case 'plex-server-status':
        return <PlexServerStatus {...commonProps} />;
      case 'plex-library-stats':
        return <PlexLibraryStats {...commonProps} />;
      case 'plex-now-playing':
        return <PlexNowPlaying {...commonProps} />;
      case 'plex-recently-added':
        return <PlexRecentlyAdded {...commonProps} />;
      case 'plex-transcoding':
        return <PlexTranscodingStatus {...commonProps} />;

      // Cisco IOS-XE widgets
      case 'cisco-device-overview':
        return <CiscoDeviceOverview {...commonProps} />;
      case 'cisco-interface-list':
        return <CiscoInterfaceList {...commonProps} />;
      case 'cisco-interface-count':
        return <CiscoInterfaceCount {...commonProps} />;
      case 'cisco-resource-usage':
        return <CiscoResourceUsage {...commonProps} />;
      case 'cisco-environment-status':
        return <CiscoEnvironmentStatus {...commonProps} />;
      case 'cisco-vlan-list':
        return <CiscoVlanList {...commonProps} />;
      case 'cisco-poe-status':
        return <CiscoPoeStatus {...commonProps} />;
      case 'cisco-spanning-tree':
        return <CiscoSpanningTreeStatus {...commonProps} />;
      case 'cisco-stack-status':
        return <CiscoStackStatus {...commonProps} />;
      case 'cisco-port-grid':
        return <CiscoPortGrid {...commonProps} />;

      // PiKVM widgets
      case 'pikvm-system-info':
        return <PikvmSystemInfo {...commonProps} />;
      case 'pikvm-power-status':
        return <PikvmPowerStatus {...commonProps} />;
      case 'pikvm-power-control':
        return <PikvmPowerControl {...commonProps} />;
      case 'pikvm-msd-status':
        return <PikvmMsdStatus {...commonProps} />;
      case 'pikvm-streamer-status':
        return <PikvmStreamerStatus {...commonProps} />;
      case 'pikvm-snapshot':
        return <PikvmSnapshot {...commonProps} />;

      // GL.iNet KVM widgets (uses same components as PiKVM)
      case 'glkvm-system-info':
        return <GlkvmSystemInfo {...commonProps} />;
      case 'glkvm-power-status':
        return <GlkvmPowerStatus {...commonProps} />;
      case 'glkvm-power-control':
        return <GlkvmPowerControl {...commonProps} />;
      case 'glkvm-msd-status':
        return <GlkvmMsdStatus {...commonProps} />;
      case 'glkvm-streamer-status':
        return <GlkvmStreamerStatus {...commonProps} />;
      case 'glkvm-snapshot':
        return <GlkvmSnapshot {...commonProps} />;

      // Tautulli widgets
      case 'tautulli-activity':
        return <TautulliActivity {...commonProps} />;
      case 'tautulli-stream-count':
        return <TautulliStreamCount {...commonProps} />;
      case 'tautulli-watch-stats':
        return <TautulliWatchStats {...commonProps} />;
      case 'tautulli-recently-added':
        return <TautulliRecentlyAdded {...commonProps} />;
      case 'tautulli-history':
        return <TautulliHistory {...commonProps} />;
      case 'tautulli-plays-chart':
        return <TautulliPlaysChart {...commonProps} />;
      case 'tautulli-server-status':
        return <TautulliServerStatus {...commonProps} />;
      case 'tautulli-activity-heatmap':
        return <TautulliActivityHeatmap {...commonProps} />;

      // Tapo widgets
      case 'tapo-devices':
        return <TapoDeviceList {...commonProps} />;
      case 'tapo-device-status':
        return <TapoDeviceStatus {...commonProps} />;
      case 'tapo-energy':
        return <TapoEnergyOverview {...commonProps} />;
      case 'tapo-power':
        return <TapoPowerMonitor {...commonProps} />;
      case 'tapo-sensors':
        return <TapoSensorList {...commonProps} />;
      case 'tapo-sensor-value':
        return <TapoSensorValue {...commonProps} />;

      // Kasa widgets
      case 'kasa-devices':
        return <KasaDeviceList {...commonProps} />;
      case 'kasa-device-status':
        return <KasaDeviceStatus {...commonProps} />;
      case 'kasa-energy':
        return <KasaEnergyOverview {...commonProps} />;
      case 'kasa-power':
        return <KasaPowerMonitor {...commonProps} />;

      // Overseerr widgets
      case 'overseerr-stats':
        return <OverseerrRequestStats {...commonProps} />;
      case 'overseerr-requests':
        return <OverseerrRequestList {...commonProps} />;
      case 'overseerr-pending':
        return <OverseerrPendingRequests {...commonProps} />;
      case 'overseerr-status':
        return <OverseerrServerStatus {...commonProps} />;

      // Home Connect widgets
      case 'homeconnect-appliances':
        return <HomeConnectApplianceList {...commonProps} />;
      case 'homeconnect-status':
        return <HomeConnectApplianceStatus {...commonProps} />;
      case 'homeconnect-programs':
        return <HomeConnectActivePrograms {...commonProps} />;
      case 'homeconnect-timer':
        return <HomeConnectProgramTimer {...commonProps} />;
      case 'homeconnect-fridge-camera':
        return <HomeConnectFridgeCamera {...commonProps} />;

      // Sonarr widgets
      case 'sonarr-series':
        return <SonarrSeriesLibrary {...commonProps} />;
      case 'sonarr-calendar':
        return <SonarrCalendar {...commonProps} />;
      case 'sonarr-queue':
        return <SonarrDownloadQueue {...commonProps} />;
      case 'sonarr-wanted':
        return <SonarrWantedMissing {...commonProps} />;
      case 'sonarr-history':
        return <SonarrActivityHistory {...commonProps} />;
      case 'sonarr-status':
        return <SonarrSystemStatus {...commonProps} />;

      // Radarr widgets
      case 'radarr-movies':
        return <RadarrMovieLibrary {...commonProps} />;
      case 'radarr-calendar':
        return <RadarrCalendar {...commonProps} />;
      case 'radarr-queue':
        return <RadarrDownloadQueue {...commonProps} />;
      case 'radarr-wanted':
        return <RadarrWantedMissing {...commonProps} />;
      case 'radarr-history':
        return <RadarrActivityHistory {...commonProps} />;
      case 'radarr-status':
        return <RadarrSystemStatus {...commonProps} />;

      // Tdarr widgets
      case 'tdarr-status':
        return <TdarrServerStatus {...commonProps} />;
      case 'tdarr-queue':
        return <TdarrQueueOverview {...commonProps} />;
      case 'tdarr-workers':
        return <TdarrActiveWorkers {...commonProps} />;
      case 'tdarr-nodes':
        return <TdarrNodeStatus {...commonProps} />;
      case 'tdarr-stats':
        return <TdarrLibraryStats {...commonProps} />;

      // Bazarr widgets
      case 'bazarr-status':
        return <BazarrSystemStatus {...commonProps} />;
      case 'bazarr-wanted':
        return <BazarrWantedOverview {...commonProps} />;
      case 'bazarr-history':
        return <BazarrRecentActivity {...commonProps} />;
      case 'bazarr-series':
        return <BazarrSeriesStatus {...commonProps} />;
      case 'bazarr-movies':
        return <BazarrMoviesStatus {...commonProps} />;

      // Prowlarr widgets
      case 'prowlarr-status':
        return <ProwlarrSystemStatus {...commonProps} />;
      case 'prowlarr-indexers':
        return <ProwlarrIndexerList {...commonProps} />;
      case 'prowlarr-stats':
        return <ProwlarrIndexerStats {...commonProps} />;
      case 'prowlarr-apps':
        return <ProwlarrApplicationList {...commonProps} />;
      case 'prowlarr-history':
        return <ProwlarrHistory {...commonProps} />;

      // SABnzbd widgets
      case 'sabnzbd-status':
        return <SABnzbdServerStatus {...commonProps} />;
      case 'sabnzbd-queue':
        return <SABnzbdDownloadQueue {...commonProps} />;
      case 'sabnzbd-history':
        return <SABnzbdHistory {...commonProps} />;
      case 'sabnzbd-stats':
        return <SABnzbdServerStats {...commonProps} />;

      // qBittorrent widgets
      case 'qbittorrent-status':
        return <QBittorrentServerStatus {...commonProps} />;
      case 'qbittorrent-torrents':
        return <QBittorrentTorrentList {...commonProps} />;
      case 'qbittorrent-transfer':
        return <QBittorrentTransferStats {...commonProps} />;
      case 'qbittorrent-categories':
        return <QBittorrentCategories {...commonProps} />;

      // Ring widgets
      case 'ring-devices':
        return <RingDeviceList {...commonProps} />;
      case 'ring-events':
        return <RingEventList {...commonProps} />;
      case 'ring-alarm-status':
        return <RingAlarmStatus {...commonProps} />;
      case 'ring-sensors':
        return <RingSensorList {...commonProps} />;
      case 'ring-snapshot':
        return <RingSnapshot {...commonProps} />;

      // Immich widgets
      case 'immich-server-info':
        return <ImmichServerInfo {...commonProps} />;
      case 'immich-statistics':
        return <ImmichStatistics {...commonProps} />;
      case 'immich-jobs':
        return <ImmichJobsStatus {...commonProps} />;
      case 'immich-albums':
        return <ImmichAlbumList {...commonProps} />;
      case 'immich-recent':
        return <ImmichRecentUploads {...commonProps} />;

      // Weather widget
      case 'weather':
        return <WeatherWidget {...commonProps} />;

      // Homebridge widgets
      case 'homebridge-status':
        return <HomebridgeServerStatus {...commonProps} />;
      case 'homebridge-accessories':
        return <HomebridgeAccessories {...commonProps} />;
      case 'homebridge-accessory-control':
        return <HomebridgeAccessoryControl {...commonProps} />;
      case 'homebridge-plugins':
        return <HomebridgePlugins {...commonProps} />;

      // Home Assistant widgets
      case 'homeassistant-status':
        return <HomeAssistantSystemStatus {...commonProps} />;
      case 'homeassistant-entities':
        return <HomeAssistantEntities {...commonProps} />;
      case 'homeassistant-entity-control':
        return <HomeAssistantEntityControl {...commonProps} />;
      case 'homeassistant-logbook':
        return <HomeAssistantLogbook {...commonProps} />;

      // NetAlertX widgets
      case 'netalertx-device-overview':
        return <NetAlertXDeviceOverview {...commonProps} />;
      case 'netalertx-device-list':
        return <NetAlertXDeviceList {...commonProps} />;
      case 'netalertx-recent-events':
        return <NetAlertXRecentEvents {...commonProps} />;
      case 'netalertx-session-stats':
        return <NetAlertXSessionStats {...commonProps} />;
      case 'netalertx-internet-info':
        return <NetAlertXInternetInfo {...commonProps} />;
      case 'netalertx-interfaces':
        return <NetAlertXInterfaces {...commonProps} />;

      // Actual Budget widgets
      case 'actualbudget-net-worth':
        return <ActualBudgetNetWorth {...commonProps} />;
      case 'actualbudget-accounts':
        return <ActualBudgetAccounts {...commonProps} />;
      case 'actualbudget-budget-overview':
        return <ActualBudgetBudgetOverview {...commonProps} />;
      case 'actualbudget-transactions':
        return <ActualBudgetTransactions {...commonProps} />;
      case 'actualbudget-category-spending':
        return <ActualBudgetCategorySpending {...commonProps} />;

      // Node-RED widgets
      case 'nodered-status':
        return <NodeRedStatus {...commonProps} />;
      case 'nodered-flow-list':
        return <NodeRedFlowList {...commonProps} />;
      case 'nodered-nodes':
        return <NodeRedInstalledNodes {...commonProps} />;
      case 'nodered-diagnostics':
        return <NodeRedDiagnostics {...commonProps} />;

      // Ollama widgets
      case 'ollama-status':
        return <OllamaStatus {...commonProps} />;
      case 'ollama-models':
        return <OllamaModelList {...commonProps} />;
      case 'ollama-running':
        return <OllamaRunningModels {...commonProps} />;
      case 'ollama-storage':
        return <OllamaStorage {...commonProps} />;

      // Kasm widgets
      case 'kasm-status':
        return <KasmStatus {...commonProps} />;
      case 'kasm-sessions':
        return <KasmSessions {...commonProps} />;
      case 'kasm-session-count':
        return <KasmSessionCount {...commonProps} />;
      case 'kasm-users':
        return <KasmUsers {...commonProps} />;
      case 'kasm-images':
        return <KasmImages {...commonProps} />;
      case 'kasm-zones':
        return <KasmZones {...commonProps} />;

      // Wazuh widgets
      case 'wazuh-status':
        return <WazuhStatus {...commonProps} />;
      case 'wazuh-agent-overview':
        return <WazuhAgentOverview {...commonProps} />;
      case 'wazuh-agents':
        return <WazuhAgentList {...commonProps} />;
      case 'wazuh-vulnerabilities':
        return <WazuhVulnerabilities {...commonProps} />;
      case 'wazuh-cluster':
        return <WazuhClusterStatus {...commonProps} />;
      case 'wazuh-stats':
        return <WazuhStats {...commonProps} />;

      // Paperless-ngx widgets
      case 'paperless-stats':
        return <PaperlessStats {...commonProps} />;
      case 'paperless-recent':
        return <PaperlessRecentDocuments {...commonProps} />;
      case 'paperless-inbox':
        return <PaperlessInbox {...commonProps} />;
      case 'paperless-tags':
        return <PaperlessTags {...commonProps} />;
      case 'paperless-correspondents':
        return <PaperlessCorrespondents {...commonProps} />;
      case 'paperless-document-types':
        return <PaperlessDocumentTypes {...commonProps} />;
      case 'paperless-tasks':
        return <PaperlessTasks {...commonProps} />;

      // Sonos widgets
      case 'sonos-now-playing':
        return <SonosNowPlaying {...commonProps} />;
      case 'sonos-groups':
        return <SonosGroups {...commonProps} />;
      case 'sonos-volume':
        return <SonosVolume {...commonProps} />;
      case 'sonos-favorites':
        return <SonosFavorites {...commonProps} />;
      case 'sonos-playlists':
        return <SonosPlaylists {...commonProps} />;
      case 'sonos-players':
        return <SonosPlayers {...commonProps} />;

      // Ecobee widgets
      case 'ecobee-thermostat':
        return <EcobeeThermostat {...commonProps} />;
      case 'ecobee-sensors':
        return <EcobeeSensors {...commonProps} />;
      case 'ecobee-weather':
        return <EcobeeWeather {...commonProps} />;
      case 'ecobee-alerts':
        return <EcobeeAlerts {...commonProps} />;
      case 'ecobee-equipment':
        return <EcobeeEquipment {...commonProps} />;
      case 'ecobee-schedule':
        return <EcobeeSchedule {...commonProps} />;

      // MikroTik widgets
      case 'mikrotik-system':
        return <MikroTikSystem {...commonProps} />;
      case 'mikrotik-interfaces':
        return <MikroTikInterfaces {...commonProps} />;
      case 'mikrotik-wireless':
        return <MikroTikWirelessClients {...commonProps} />;
      case 'mikrotik-dhcp':
        return <MikroTikDHCPLeases {...commonProps} />;
      case 'mikrotik-firewall':
        return <MikroTikFirewall {...commonProps} />;
      case 'mikrotik-connections':
        return <MikroTikConnections {...commonProps} />;
      case 'mikrotik-routes':
        return <MikroTikRoutes {...commonProps} />;
      case 'mikrotik-arp':
        return <MikroTikArp {...commonProps} />;
      case 'mikrotik-log':
        return <MikroTikLog {...commonProps} />;

      // ControlD widgets
      case 'controld-overview':
        return <ControlDOverview {...commonProps} />;
      case 'controld-devices':
        return <ControlDDevices {...commonProps} />;
      case 'controld-profiles':
        return <ControlDProfiles {...commonProps} />;
      case 'controld-filters':
        return <ControlDFilters {...commonProps} />;
      case 'controld-services':
        return <ControlDServices {...commonProps} />;
      case 'controld-rules':
        return <ControlDRules {...commonProps} />;
      case 'controld-ips':
        return <ControlDKnownIPs {...commonProps} />;
      case 'controld-proxies':
        return <ControlDProxies {...commonProps} />;

      // Notion widgets
      case 'notion-workspace':
        return <NotionWorkspace {...commonProps} />;
      case 'notion-databases':
        return <NotionDatabases {...commonProps} />;
      case 'notion-database-view':
        return <NotionDatabaseView {...commonProps} />;
      case 'notion-task-list':
        return <NotionTaskList {...commonProps} />;
      case 'notion-recent':
        return <NotionRecent {...commonProps} />;

      // Plant-it widgets
      case 'plantit-stats':
        return <PlantitStats {...commonProps} />;
      case 'plantit-plants':
        return <PlantitPlants {...commonProps} />;
      case 'plantit-events':
        return <PlantitEvents {...commonProps} />;
      case 'plantit-reminders':
        return <PlantitReminders {...commonProps} />;
      case 'plantit-plant-detail':
        return <PlantitPlantDetail {...commonProps} />;

      // HomeKit widgets
      case 'homekit-devices':
        return <HomeKitDevices {...commonProps} />;
      case 'homekit-lights':
        return <HomeKitLights {...commonProps} />;
      case 'homekit-climate':
        return <HomeKitClimate {...commonProps} />;
      case 'homekit-sensors':
        return <HomeKitSensors {...commonProps} />;
      case 'homekit-device-control':
        return <HomeKitDeviceControl {...commonProps} />;

      // Microsoft 365 widgets
      case 'microsoft365-mail':
        return <Microsoft365Mail {...commonProps} />;
      case 'microsoft365-calendar':
        return <Microsoft365Calendar {...commonProps} />;
      case 'microsoft365-onedrive':
        return <Microsoft365OneDrive {...commonProps} />;
      case 'microsoft365-teams':
        return <Microsoft365Teams {...commonProps} />;
      case 'microsoft365-tasks':
        return <Microsoft365Tasks {...commonProps} />;
      case 'microsoft365-profile':
        return <Microsoft365Profile {...commonProps} />;

      // Google Workspace widgets
      case 'google-mail':
        return <GoogleMail {...commonProps} />;
      case 'google-calendar':
        return <GoogleCalendar {...commonProps} />;
      case 'google-drive':
        return <GoogleDrive {...commonProps} />;
      case 'google-tasks':
        return <GoogleTasks {...commonProps} />;

      // Storj widgets
      case 'storj-storage':
        return <StorjStorage {...commonProps} />;
      case 'storj-files':
        return <StorjFiles {...commonProps} />;
      case 'storj-node-status':
        return <StorjNodeStatus {...commonProps} />;
      case 'storj-satellites':
        return <StorjSatellites {...commonProps} />;
      case 'storj-earnings':
        return <StorjEarnings {...commonProps} />;
      case 'storj-bandwidth':
        return <StorjBandwidth {...commonProps} />;

      // KitchenOwl widgets
      case 'kitchenowl-shopping-list':
        return <KitchenOwlShoppingList {...commonProps} />;
      case 'kitchenowl-recipes':
        return <KitchenOwlRecipes {...commonProps} />;
      case 'kitchenowl-meal-plan':
        return <KitchenOwlMealPlan {...commonProps} />;
      case 'kitchenowl-expenses':
        return <KitchenOwlExpenses {...commonProps} />;
      case 'kitchenowl-household':
        return <KitchenOwlHousehold {...commonProps} />;

      // ESXi widgets
      case 'esxi-vms':
        return <ESXiVMList {...commonProps} />;
      case 'esxi-host-status':
        return <ESXiHostStatus {...commonProps} />;
      case 'esxi-datastores':
        return <ESXiDatastores {...commonProps} />;
      case 'esxi-networks':
        return <ESXiNetworks {...commonProps} />;
      case 'esxi-resource-usage':
        return <ESXiResourceUsage {...commonProps} />;

      // PAN-OS widgets
      case 'panos-system':
        return <PANOSSystem {...commonProps} />;
      case 'panos-interfaces':
        return <PANOSInterfaces {...commonProps} />;
      case 'panos-vpn':
        return <PANOSVPN {...commonProps} />;
      case 'panos-policies':
        return <PANOSPolicies {...commonProps} />;
      case 'panos-threats':
        return <PANOSThreats {...commonProps} />;
      case 'panos-sessions':
        return <PANOSSessions {...commonProps} />;
      case 'panos-ha':
        return <PANOSHA {...commonProps} />;

      // FortiGate widgets
      case 'fortigate-system':
        return <FortiGateSystem {...commonProps} />;
      case 'fortigate-interfaces':
        return <FortiGateInterfaces {...commonProps} />;
      case 'fortigate-policies':
        return <FortiGatePolicies {...commonProps} />;
      case 'fortigate-vpn':
        return <FortiGateVPN {...commonProps} />;
      case 'fortigate-sessions':
        return <FortiGateSessions {...commonProps} />;
      case 'fortigate-security':
        return <FortiGateSecurity {...commonProps} />;
      case 'fortigate-devices':
        return <FortiGateDevices {...commonProps} />;
      case 'fortigate-ha':
        return <FortiGateHA {...commonProps} />;

      // Cross-Integration widgets (no specific integration required)
      case 'cross-media-pipeline':
        return <CrossMediaPipeline {...staticProps} />;
      case 'cross-subtitle-health':
        return <CrossSubtitleHealth {...staticProps} />;
      case 'cross-download-activity':
        return <CrossDownloadActivity {...staticProps} />;
      case 'cross-transcoding-resources':
        return <CrossTranscodingResources {...staticProps} />;
      case 'cross-service-mapping':
        return <CrossServiceMapping {...staticProps} />;
      case 'cross-client-correlation':
        return <CrossClientCorrelation {...staticProps} />;

      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            Unknown widget type: {widget.widget_type}
          </div>
        );
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove();
    setShowConfirm(false);
  };

  const handleCancelRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowConfirm(false);
  };

  // Close group menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedInsideButton = groupMenuButtonRef.current && groupMenuButtonRef.current.contains(event.target as Node);
      const clickedInsideMenu = groupMenuRef.current && groupMenuRef.current.contains(event.target as Node);
      if (!clickedInsideButton && !clickedInsideMenu) {
        setShowGroupMenu(false);
      }
    };

    if (showGroupMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGroupMenu]);

  // Handle opening group menu with position calculation
  const handleOpenGroupMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (showGroupMenu) {
      setShowGroupMenu(false);
      return;
    }
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    setGroupMenuPosition({
      x: rect.right - 192, // 192px = w-48 menu width, align right edge
      y: rect.bottom + 4,
    });
    setShowGroupMenu(true);
  }, [showGroupMenu]);

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedInsideButton = overflowMenuRef.current && overflowMenuRef.current.contains(event.target as Node);
      const clickedInsideMenu = overflowMenuContentRef.current && overflowMenuContentRef.current.contains(event.target as Node);
      if (!clickedInsideButton && !clickedInsideMenu) {
        setShowOverflowMenu(false);
      }
    };

    if (showOverflowMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOverflowMenu]);

  // Determine if widget is narrow (needs overflow menu)
  // Widgets in groups always use the compact menu since they're rendered smaller
  const isNarrowWidget = gridWidth <= 2 || isInGroup;

  // Handle drag start for drag-to-group
  const handleDragToGroupStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('widgetId', widget.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.();
  };

  const handleDragToGroupEnd = () => {
    onDragEnd?.();
  };

  // Build inline styles for custom colors
  const containerStyle: React.CSSProperties = {
    ...(backgroundColor && !transparentBackground ? { backgroundColor } : {}),
    ...(borderColor && !transparentBackground ? { borderColor, borderWidth: '2px', borderStyle: 'solid' } : {}),
  };

  const headerStyle: React.CSSProperties = {
    ...(headerColor ? { backgroundColor: headerColor } : {}),
    ...(borderColor ? { borderColor } : {}),
  };

  return (
    <div
      className={`rounded-lg overflow-hidden flex flex-col transition-colors relative group/widget ${
        isCollapsed && canCollapse ? '' : 'h-full'
      } ${
        transparentBackground
          ? 'bg-transparent'
          : backgroundColor || borderColor
            ? 'shadow-md'
            : 'bg-white dark:bg-gray-800 shadow-md'
      }`}
      style={containerStyle}
    >
      {/* Header */}
      {!hideTitle ? (
        <div
          className={`flex items-center justify-between px-3 py-2 ${
            transparentHeader ? '' : 'border-b'
          } ${
            transparentHeader ? '' : (headerColor ? '' : 'bg-gray-50 dark:bg-gray-700')
          } ${
            transparentHeader ? '' : (borderColor ? '' : 'border-gray-200 dark:border-gray-600')
          }`}
          style={transparentHeader ? {} : headerStyle}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Drag handle - always visible in edit mode */}
            {isEditMode && (
              <div
                className="widget-drag-handle group-widget-drag-handle p-1 -ml-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-move transition-colors flex-shrink-0"
                title="Drag to move"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>
            )}
            {canCollapse && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="widget-no-drag text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {headerLinkUrl ? (
              <a
                href={headerLinkUrl}
                target={headerLinkOpenNewTab ? '_blank' : undefined}
                rel={headerLinkOpenNewTab ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {showHeaderImage && (
                  <img
                    src={headerImageUrl}
                    alt=""
                    className={`${headerIconClass} object-contain flex-shrink-0`}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    loading="lazy"
                  />
                )}
                {!hideTitleText && (
                  <span className="flex-1 font-medium text-gray-800 dark:text-gray-200 text-sm truncate pr-2 hover:text-primary-600 dark:hover:text-primary-400">
                    {widget.title}
                  </span>
                )}
              </a>
            ) : (
              <>
                {showHeaderImage && (
                  <img
                    src={headerImageUrl}
                    alt=""
                    className={`${headerIconClass} object-contain flex-shrink-0`}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    loading="lazy"
                  />
                )}
                {!hideTitleText && (
                  <h3 className="flex-1 font-medium text-gray-800 dark:text-gray-200 text-sm truncate pr-2">{widget.title}</h3>
                )}
              </>
            )}
          </div>

          {/* Refresh button - always visible */}
          <div className="widget-no-drag flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleRefresh}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              disabled={isRefreshing}
              className={`p-1.5 rounded-md text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              title="Refresh widget"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {isEditMode && (
            <>
              {showConfirm ? (
                <div
                  className="widget-no-drag flex items-center gap-1 flex-shrink-0"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={handleConfirmRemove}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                    title="Confirm remove"
                  >
                    Remove
                  </button>
                  <button
                    onClick={handleCancelRemove}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 text-xs font-medium bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded transition-colors"
                    title="Cancel"
                  >
                    Cancel
                  </button>
                </div>
              ) : isNarrowWidget ? (
                /* Overflow menu for narrow widgets */
                <div className="widget-no-drag relative flex-shrink-0" ref={overflowMenuRef}>
                  <button
                    ref={overflowButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!showOverflowMenu && overflowButtonRef.current) {
                        const rect = overflowButtonRef.current.getBoundingClientRect();
                        const menuHeight = 300; // Approximate menu height
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const openUpward = spaceBelow < menuHeight && rect.top > menuHeight;
                        setOverflowMenuPosition({
                          x: rect.right,
                          y: openUpward ? rect.top : rect.bottom,
                          openUpward,
                        });
                      }
                      setShowOverflowMenu(!showOverflowMenu);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="More actions"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  {showOverflowMenu && overflowMenuPosition && createPortal(
                    <div
                      ref={overflowMenuContentRef}
                      className={`fixed ${isInGroup ? 'w-32' : 'w-36'} bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[100]`}
                      style={{
                        right: window.innerWidth - overflowMenuPosition.x,
                        ...(overflowMenuPosition.openUpward
                          ? { bottom: window.innerHeight - overflowMenuPosition.y + 4 }
                          : { top: overflowMenuPosition.y + 4 }),
                      }}
                    >
                      {/* Edit */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowEditModal(true); setShowOverflowMenu(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      {/* Duplicate */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDuplicate(e); setShowOverflowMenu(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Duplicate
                      </button>
                      {/* Move/Copy to Dashboard */}
                      {dashboards.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowMoveModal(true); setShowOverflowMenu(false); }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Move/Copy
                        </button>
                      )}
                      {/* Add to Group */}
                      {(availableGroups.length > 0 || onCreateGroup) && (onAddToGroup || onCreateGroup) && (
                        <>
                          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                          {availableGroups.map(group => (
                            <button
                              key={group.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToGroup?.(group.id);
                                setShowOverflowMenu(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                              </svg>
                              <span className="truncate">Add to {group.title}</span>
                            </button>
                          ))}
                          {onCreateGroup && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCreateGroup(widget.id);
                                setShowOverflowMenu(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              New Group
                            </button>
                          )}
                        </>
                      )}
                      {/* Remove from Group */}
                      {isInGroup && onRemoveFromGroup && (
                        <>
                          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveFromGroup(); setShowOverflowMenu(false); }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Remove from Group
                          </button>
                        </>
                      )}
                      {/* Remove */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveClick(e); setShowOverflowMenu(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              ) : (
                <div className="widget-no-drag flex items-center gap-1 flex-shrink-0">
                  {/* Add to Group button */}
                  {(availableGroups.length > 0 || onCreateGroup) && (onAddToGroup || onCreateGroup) && (
                    <div className="relative">
                      <button
                        ref={groupMenuButtonRef}
                        onClick={handleOpenGroupMenu}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        draggable
                        onDragStart={handleDragToGroupStart}
                        onDragEnd={handleDragToGroupEnd}
                        className="p-1.5 rounded-md text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-grab active:cursor-grabbing"
                        title="Add to group (or drag onto a group)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {showGroupMenu && groupMenuPosition && createPortal(
                        <div
                          ref={groupMenuRef}
                          className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
                          style={{ left: groupMenuPosition.x, top: groupMenuPosition.y }}
                        >
                          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            Add to Group
                          </div>
                          {availableGroups.map(group => (
                            <button
                              key={group.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToGroup?.(group.id);
                                setShowGroupMenu(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              <span className="truncate">{group.title}</span>
                            </button>
                          ))}
                          {onCreateGroup && (
                            <>
                              {availableGroups.length > 0 && (
                                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCreateGroup(widget.id);
                                  setShowGroupMenu(false);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <span>Create New Group</span>
                              </button>
                            </>
                          )}
                        </div>,
                        document.body
                      )}
                    </div>
                  )}
                  {/* Remove from Group button */}
                  {isInGroup && onRemoveFromGroup && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveFromGroup(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                      title="Remove from group"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  )}
                  {/* Duplicate button */}
                  <button
                    onClick={handleDuplicate}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                    title="Duplicate widget"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {/* Move/Copy to Dashboard button */}
                  {dashboards.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowMoveModal(true); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-md text-gray-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-colors"
                      title="Move/Copy to another dashboard"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                  )}
                  {/* Edit button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEditModal(true); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    title="Edit widget"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {/* Remove button */}
                  <button
                    onClick={handleRemoveClick}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Remove widget"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Minimal header when title is hidden - action buttons and drag handle on hover (only in edit mode) */
        isEditMode && (
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover/widget:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 rounded-md p-1 shadow-sm">
              {/* Drag handle */}
              <div
                className="widget-drag-handle group-widget-drag-handle p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-move transition-colors"
                title="Drag to move"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>
              <div className="widget-no-drag flex items-center gap-1">
                <button
                  onClick={handleRefresh}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  disabled={isRefreshing}
                  className={`p-1 rounded text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                  title="Refresh widget"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {/* Add to Group - compact version for hidden header */}
                {(availableGroups.length > 0 || onCreateGroup) && (onAddToGroup || onCreateGroup) && (
                  <div className="relative">
                    <button
                      ref={groupMenuButtonRef}
                      onClick={handleOpenGroupMenu}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      draggable
                      onDragStart={handleDragToGroupStart}
                      onDragEnd={handleDragToGroupEnd}
                      className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-grab active:cursor-grabbing"
                      title="Add to group"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {showGroupMenu && groupMenuPosition && createPortal(
                      <div
                        ref={groupMenuRef}
                        className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
                        style={{ left: groupMenuPosition.x, top: groupMenuPosition.y }}
                      >
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          Add to Group
                        </div>
                        {availableGroups.map(group => (
                          <button
                            key={group.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddToGroup?.(group.id);
                              setShowGroupMenu(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="truncate">{group.title}</span>
                          </button>
                        ))}
                        {onCreateGroup && (
                          <>
                            {availableGroups.length > 0 && (
                              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCreateGroup(widget.id);
                                setShowGroupMenu(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 flex items-center gap-2"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <span>Create New Group</span>
                            </button>
                          </>
                        )}
                      </div>,
                      document.body
                    )}
                  </div>
                )}
                {/* Remove from Group - compact version */}
                {isInGroup && onRemoveFromGroup && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFromGroup(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="p-1 rounded text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                    title="Remove from group"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={handleDuplicate}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="p-1 rounded text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                  title="Duplicate widget"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEditModal(true); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title="Edit widget"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={handleRemoveClick}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Remove widget"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Content - only show when not collapsed */}
      {!(isCollapsed && canCollapse) && (
        <div ref={contentRef} className={`flex-1 min-h-0 ${widget.widget_type === 'image' ? 'p-0' : 'p-3'} overflow-auto flex flex-col ${hideScrollbar ? 'scrollbar-hide' : ''} relative`}>
          <WidgetDimensionsProvider dimensions={dimensions}>
            <div className="flex-1 min-h-0 h-full">
              <ErrorBoundary widgetType={widget.widget_type}>
                {renderWidget()}
              </ErrorBoundary>
            </div>
          </WidgetDimensionsProvider>

          {/* Last updated timestamp */}
          {showLastUpdated && lastUpdated && (
            <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Updated {formatLastUpdated(lastUpdated)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditWidgetModal
          widget={widget}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Move/Copy to Dashboard Modal */}
      {showMoveModal && currentDashboardId && (
        <MoveWidgetModal
          widgetTitle={widget.title}
          dashboards={dashboards}
          currentDashboardId={currentDashboardId}
          onMove={async (targetId) => {
            await moveWidgetToDashboard(widget.id, targetId);
          }}
          onCopy={async (targetId) => {
            await copyWidgetToDashboard(widget.id, targetId);
          }}
          onClose={() => setShowMoveModal(false)}
        />
      )}

      {/* Delete confirmation modal - shown as portal when header is hidden */}
      {hideTitle && showConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Remove Widget
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to remove "{widget.title}"?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelRemove}
                className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}, widgetWrapperPropsAreEqual);
