import { IntegrationConfig } from './types';

export const sabnzbdConfig: IntegrationConfig = {
  type: 'sabnzbd',
  displayName: 'SABnzbd',
  category: 'download-clients',
  description: 'Usenet/NZB binary newsreader',
  documentationUrl: 'https://sabnzbd.org/wiki/',
  dependencies: {
    apis: ['SABnzbd API'],
  },
  sampleName: 'My SABnzbd',
  defaultPort: 8080,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'api',
    commonFields: [],
    methods: [
      {
        method: 'api',
        label: 'API Key',
        fields: [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'Your SABnzbd API key',
            required: true,
            helpText: 'Find your API key in SABnzbd Config > General > Security',
          },
        ],
      },
    ],
    helpText: 'Enter your SABnzbd API key. You can find this in SABnzbd Config > General > Security.',
  },

  widgets: [
    {
      type: 'sabnzbd-status',
      name: 'Server Status',
      description: 'Version, speed, disk space, pause status, warnings',
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
            { label: 'Show Servers', key: 'showServers' },
          ],
        },
      ],
    },
    {
      type: 'sabnzbd-queue',
      name: 'Download Queue',
      description: 'Active downloads with progress bars, ETA, speed',
      metric: 'queue',
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
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Progress Bar', key: 'showProgressBar' },
            { label: 'Show ETA', key: 'showEta' },
            { label: 'Show Category', key: 'showCategory' },
            { label: 'Show Priority', key: 'showPriority' },
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
      type: 'sabnzbd-history',
      name: 'History',
      description: 'Completed/failed downloads with size and time',
      metric: 'history',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'History List (Default)' },
        { value: 'timeline', label: 'Timeline' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Status Filter',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Size', key: 'showSize' },
            { label: 'Show Time', key: 'showTime' },
            { label: 'Show Category', key: 'showCategory' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '20',
        },
      ],
    },
    {
      type: 'sabnzbd-stats',
      name: 'Server Stats',
      description: 'Per-server download statistics and article success rates',
      metric: 'server-stats',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'bars', label: 'Bar Chart (Default)' },
        { value: 'list', label: 'Stat List' },
        { value: 'cards', label: 'Server Cards' },
      ],
      filters: [
        {
          label: 'Time Period',
          key: 'timePeriod',
          type: 'button-group',
          options: [
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'total', label: 'Total' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Article Success Rate', key: 'showSuccessRate' },
            { label: 'Show Per-Server Stats', key: 'showServerStats' },
          ],
        },
      ],
    },
  ],
};
