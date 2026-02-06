/**
 * Cross-Integration Widget Configuration
 *
 * Cross-integration widgets aggregate data from multiple integrations.
 * They don't require a specific integration to be selected - they automatically
 * fetch from all configured integrations of the required types.
 */

import { StaticWidgetConfig, FilterConfig } from './types';
import { refreshIntervalFilter } from './static';

/**
 * Cross-Integration static widgets
 * These appear as "static" widgets since they don't require a specific integration selection
 */
export const crossIntegrationWidgets: StaticWidgetConfig[] = [
  {
    type: 'cross-media-pipeline',
    name: 'Media Pipeline Status',
    description: 'Visualize your media acquisition pipeline from request to playback',
    defaultSize: { w: 6, h: 2 },
    minSize: { w: 4, h: 2 },
    filters: [
      {
        label: 'Display Options',
        key: 'displayOptions',
        type: 'checkbox-group',
        defaultEnabled: true,
        items: [
          { label: 'Show Stage Names', key: 'showStageNames' },
          { label: 'Show Counts', key: 'showCounts' },
          { label: 'Show Sources', key: 'showSources' },
          { label: 'Highlight Bottleneck', key: 'highlightBottleneck' },
        ],
      },
      {
        label: 'Compact Mode',
        key: 'compact',
        type: 'checkbox',
      },
      refreshIntervalFilter,
    ],
  },
  {
    type: 'cross-subtitle-health',
    name: 'Subtitle Health Check',
    description: 'Monitor missing subtitles for your most watched content',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    filters: [
      {
        label: 'Display Options',
        key: 'displayOptions',
        type: 'checkbox-group',
        defaultEnabled: true,
        items: [
          { label: 'Show Health Score', key: 'showHealthScore' },
          { label: 'Show Popular Missing', key: 'showPopularMissing' },
          { label: 'Show Totals', key: 'showTotals' },
        ],
      },
      {
        label: 'Max Items',
        key: 'maxItems',
        type: 'number',
        placeholder: '5',
      },
      refreshIntervalFilter,
    ],
  },
  {
    type: 'cross-download-activity',
    name: 'Download vs Streaming',
    description: 'Compare download activity with streaming bandwidth',
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    filters: [
      {
        label: 'Display Options',
        key: 'displayOptions',
        type: 'checkbox-group',
        defaultEnabled: true,
        items: [
          { label: 'Show Download Speed', key: 'showDownloadSpeed' },
          { label: 'Show Streaming Bandwidth', key: 'showStreamingBandwidth' },
          { label: 'Show Contention Warning', key: 'showContentionWarning' },
          { label: 'Show Sources', key: 'showSources' },
        ],
      },
      refreshIntervalFilter,
    ],
  },
  {
    type: 'cross-transcoding-resources',
    name: 'Transcoding Resources',
    description: 'Correlate Plex transcoding with server CPU usage',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    filters: [
      {
        label: 'Infrastructure Source',
        key: 'infrastructureSource',
        type: 'select',
        options: [
          { value: 'auto', label: 'Auto-detect' },
          { value: 'proxmox', label: 'Proxmox' },
          { value: 'beszel', label: 'Beszel' },
        ],
      },
      {
        label: 'Display Options',
        key: 'displayOptions',
        type: 'checkbox-group',
        defaultEnabled: true,
        items: [
          { label: 'Show Transcode Count', key: 'showTranscodeCount' },
          { label: 'Show CPU Usage', key: 'showCpuUsage' },
          { label: 'Show Memory Usage', key: 'showMemoryUsage' },
          { label: 'Show Correlation', key: 'showCorrelation' },
        ],
      },
      refreshIntervalFilter,
    ],
  },
  {
    type: 'cross-service-mapping',
    name: 'Service Mapping',
    description: 'Map your integrations to Proxmox VMs/containers',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    filters: [
      {
        label: 'Show Options',
        key: 'showOptions',
        type: 'checkbox-group',
        defaultEnabled: true,
        items: [
          { label: 'Show VM Status', key: 'showVmStatus' },
          { label: 'Show Resource Usage', key: 'showResourceUsage' },
          { label: 'Show Unmapped VMs', key: 'showUnmappedVms' },
        ],
      },
      {
        label: 'Group By',
        key: 'groupBy',
        type: 'select',
        options: [
          { value: 'node', label: 'Proxmox Node' },
          { value: 'type', label: 'Integration Type' },
          { value: 'none', label: 'No Grouping' },
        ],
      },
      refreshIntervalFilter,
    ],
  },
  {
    type: 'cross-client-correlation',
    name: 'Client Correlation',
    description: 'Enrich Plex streams with UniFi network client info',
    defaultSize: { w: 5, h: 4 },
    minSize: { w: 4, h: 3 },
    filters: [
      {
        label: 'Display Options',
        key: 'displayOptions',
        type: 'checkbox-group',
        defaultEnabled: true,
        items: [
          { label: 'Show Device Name', key: 'showDeviceName' },
          { label: 'Show Connection Type', key: 'showConnectionType' },
          { label: 'Show Signal Strength', key: 'showSignalStrength' },
          { label: 'Show Bandwidth', key: 'showBandwidth' },
        ],
      },
      {
        label: 'Show Unmatched',
        key: 'showUnmatched',
        type: 'checkbox',
      },
      refreshIntervalFilter,
    ],
  },
  {
    type: 'cross-switch-port-overlay',
    name: 'Switch Port Overlay',
    description: 'Visual switch/firewall port status overlaid on device image (UniFi, MikroTik, Cisco, FortiGate, Palo Alto)',
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 2 },
    filters: [
      {
        label: 'Integration',
        key: 'integrationId',
        type: 'integration-select',
        integrationTypes: ['unifi', 'mikrotik', 'cisco-iosxe', 'fortigate', 'panos'],
        placeholder: 'Select integration...',
      },
      {
        label: 'Switch Device',
        key: 'deviceId',
        type: 'switch-select-single',
        placeholder: 'Select a switch...',
      },
      {
        label: 'Device Template',
        key: 'templateId',
        type: 'template-select',
      },
      {
        label: 'Indicator Style',
        key: 'indicatorStyle',
        type: 'select',
        options: [
          { value: 'led', label: 'LED (Glowing)' },
          { value: 'dot', label: 'Dot (Simple)' },
          { value: 'square', label: 'Square' },
          { value: 'outline', label: 'Outline' },
        ],
      },
      {
        label: 'Indicator Size',
        key: 'indicatorSize',
        type: 'select',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
      {
        label: 'Display Options',
        key: 'displayOptions',
        type: 'checkbox-group',
        defaultEnabled: true,
        items: [
          { label: 'Show Legend', key: 'showLegend' },
          { label: 'Highlight PoE Ports', key: 'highlightPoe' },
          { label: 'Highlight High-Speed Ports', key: 'highlightSpeed' },
        ],
      },
      {
        label: 'Show Switch Name',
        key: 'showSwitchName',
        type: 'checkbox',
      },
      {
        label: 'Switch Name Position',
        key: 'switchNamePosition',
        type: 'select',
        options: [
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
        ],
        dependsOn: { key: 'showSwitchName', value: true },
      },
      {
        label: 'Switch Name Alignment',
        key: 'switchNameAlign',
        type: 'select',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
        dependsOn: { key: 'showSwitchName', value: true },
      },
      {
        label: 'Switch Name Font Size',
        key: 'switchNameFontSize',
        type: 'number',
        min: 10,
        max: 32,
        defaultValue: 14,
        dependsOn: { key: 'showSwitchName', value: true },
      },
      refreshIntervalFilter,
    ],
  },
  {
    type: 'device-overlay',
    name: 'Device Overlay',
    description: 'Visual device diagram (server, NAS, etc.) with NIC port indicators and switch connections',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    filters: [
      {
        label: 'Device Template',
        key: 'templateId',
        type: 'device-template-select',
        placeholder: 'Select a device template...',
      },
      {
        label: 'Device Name',
        key: 'deviceName',
        type: 'text',
        placeholder: 'e.g., TrueNAS-01, Proxmox-Node1',
      },
      {
        label: 'Indicator Style',
        key: 'indicatorStyle',
        type: 'select',
        options: [
          { value: 'led', label: 'LED (Glowing)' },
          { value: 'dot', label: 'Dot (Simple)' },
          { value: 'square', label: 'Square' },
          { value: 'outline', label: 'Outline' },
        ],
      },
      {
        label: 'Indicator Size',
        key: 'indicatorSize',
        type: 'select',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
      {
        label: 'Display Options',
        key: 'displayOptions',
        type: 'checkbox-group',
        defaultEnabled: true,
        items: [
          { label: 'Show Legend', key: 'showLegend' },
          { label: 'Show Device Name', key: 'showDeviceName' },
          { label: 'Show NIC Labels', key: 'showNicLabels' },
        ],
      },
      {
        label: 'Device Name Position',
        key: 'deviceNamePosition',
        type: 'select',
        options: [
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
        ],
        dependsOn: { key: 'showDeviceName', value: true },
      },
      {
        label: 'Device Name Alignment',
        key: 'deviceNameAlign',
        type: 'select',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
        dependsOn: { key: 'showDeviceName', value: true },
      },
      {
        label: 'Device Name Font Size',
        key: 'deviceNameFontSize',
        type: 'number',
        min: 10,
        max: 32,
        defaultValue: 14,
        dependsOn: { key: 'showDeviceName', value: true },
      },
    ],
  },
];

/**
 * Required integration types for each cross-integration widget
 */
export const crossIntegrationRequirements: Record<string, {
  required: string[];
  optional: string[];
  description: string;
}> = {
  'cross-media-pipeline': {
    required: [],
    optional: ['overseerr', 'prowlarr', 'sonarr', 'radarr', 'sabnzbd', 'qbittorrent', 'tdarr', 'plex', 'tautulli'],
    description: 'Works best with: Overseerr, Prowlarr, Sonarr, Radarr, SABnzbd/qBittorrent, Tdarr, Plex/Tautulli',
  },
  'cross-subtitle-health': {
    required: ['bazarr'],
    optional: ['tautulli'],
    description: 'Requires: Bazarr. Enhanced with: Tautulli (for watch history)',
  },
  'cross-download-activity': {
    required: [],
    optional: ['sabnzbd', 'qbittorrent', 'tautulli'],
    description: 'Requires at least one: SABnzbd or qBittorrent. Enhanced with: Tautulli',
  },
  'cross-transcoding-resources': {
    required: ['tautulli'],
    optional: ['proxmox', 'beszel', 'plex'],
    description: 'Requires: Tautulli. Enhanced with: Proxmox or Beszel (for resource metrics)',
  },
  'cross-service-mapping': {
    required: ['proxmox'],
    optional: ['plex', 'tautulli', 'sonarr', 'radarr', 'bazarr', 'overseerr', 'prowlarr', 'sabnzbd', 'qbittorrent', 'tdarr', 'adguard', 'unifi', 'beszel', 'homeassistant', 'homebridge', 'immich'],
    description: 'Requires: Proxmox. Maps any configured integrations to VMs/containers',
  },
  'cross-client-correlation': {
    required: ['unifi', 'tautulli'],
    optional: ['plex'],
    description: 'Requires: UniFi and Tautulli (or Plex for basic info)',
  },
  'cross-switch-port-overlay': {
    required: [],
    optional: ['unifi', 'mikrotik', 'cisco-iosxe', 'fortigate', 'panos'],
    description: 'Works with: UniFi, MikroTik, Cisco IOS-XE, FortiGate, or Palo Alto firewalls',
  },
  'device-overlay': {
    required: [],
    optional: [],
    description: 'Static device diagram widget. Configure NIC-to-switch mappings manually.',
  },
};

/**
 * Get cross-integration widget config by type
 */
export function getCrossIntegrationWidgetConfig(type: string): StaticWidgetConfig | undefined {
  return crossIntegrationWidgets.find(w => w.type === type);
}

/**
 * Check if a widget type is a cross-integration widget
 */
export function isCrossIntegrationWidget(type: string): boolean {
  return type.startsWith('cross-');
}
