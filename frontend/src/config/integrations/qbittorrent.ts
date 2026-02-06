import { IntegrationConfig } from './types';

export const qbittorrentConfig: IntegrationConfig = {
  type: 'qbittorrent',
  displayName: 'qBittorrent',
  category: 'download-clients',
  description: 'BitTorrent client with Web UI',
  documentationUrl: 'https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)',
  dependencies: {
    apis: ['qBittorrent Web API'],
    notes: 'Requires Web UI enabled in qBittorrent settings',
  },
  sampleName: 'My qBittorrent',
  defaultPort: 8080,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'basic',
    commonFields: [],
    methods: [
      {
        method: 'basic',
        label: 'Username & Password',
        fields: [
          {
            key: 'username',
            label: 'Username',
            type: 'text',
            placeholder: 'admin',
            required: true,
            helpText: 'Your qBittorrent Web UI username',
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'Your password',
            required: true,
            helpText: 'Your qBittorrent Web UI password',
          },
        ],
      },
    ],
    helpText: 'Enter your qBittorrent Web UI credentials. Enable the Web UI in qBittorrent: Tools > Options > Web UI.',
  },

  widgets: [
    {
      type: 'qbittorrent-status',
      name: 'Server Status',
      description: 'Version, speed, disk space, connection status',
      metric: 'status',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Status Cards (Default)' },
        { value: 'compact', label: 'Compact List' },
        { value: 'metrics', label: 'Large Metrics' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Version', key: 'showVersion' },
            { label: 'Show Speed', key: 'showSpeed' },
            { label: 'Show Disk Space', key: 'showDiskSpace' },
            { label: 'Show Ratio', key: 'showRatio' },
          ],
        },
        {
          label: 'Low Disk Warning (GB)',
          key: 'diskWarningGB',
          type: 'number',
          placeholder: '50 (default)',
        },
        {
          label: 'Low Disk Critical (GB)',
          key: 'diskCriticalGB',
          type: 'number',
          placeholder: '10 (default)',
        },
      ],
    },
    {
      type: 'qbittorrent-torrents',
      name: 'Torrent List',
      description: 'Active downloads/uploads with progress and speed',
      metric: 'torrents',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Detailed List (Default)' },
        { value: 'compact', label: 'Compact Summary' },
        { value: 'progress', label: 'Progress View' },
      ],
      filters: [
        {
          label: 'Status Filter',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'downloading', label: 'Downloading' },
            { value: 'seeding', label: 'Seeding' },
            { value: 'paused', label: 'Paused' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Progress Bar', key: 'showProgressBar' },
            { label: 'Show ETA', key: 'showEta' },
            { label: 'Show Category', key: 'showCategory' },
            { label: 'Show Seeds/Peers', key: 'showPeers' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'qbittorrent-transfer',
      name: 'Transfer Stats',
      description: 'Global download/upload statistics and speed',
      metric: 'status',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'numbers', label: 'Large Numbers (Default)' },
        { value: 'gauges', label: 'Speed Gauges' },
        { value: 'bars', label: 'Progress Bars' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show All-Time Stats', key: 'showAllTime' },
            { label: 'Show Speed Limits', key: 'showLimits' },
          ],
        },
      ],
    },
    {
      type: 'qbittorrent-categories',
      name: 'Categories',
      description: 'Torrent categories with counts',
      metric: 'status',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Category List (Default)' },
        { value: 'cards', label: 'Category Cards' },
        { value: 'donut', label: 'Donut Chart' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Save Paths', key: 'showPaths' },
            { label: 'Show Tags', key: 'showTags' },
          ],
        },
      ],
    },
  ],
};
