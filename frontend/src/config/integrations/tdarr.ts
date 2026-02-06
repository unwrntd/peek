import { IntegrationConfig } from './types';

export const tdarrConfig: IntegrationConfig = {
  type: 'tdarr',
  displayName: 'Tdarr',
  category: 'media-management',
  description: 'Distributed media transcoding and health checking',
  documentationUrl: 'https://github.com/HaveAGitGat/Tdarr',
  dependencies: {
    apis: ['Tdarr API'],
    notes: 'API key optional; authentication may be disabled',
  },
  sampleName: 'My Tdarr',
  defaultPort: 8265,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'api',
    commonFields: [],
    methods: [
      {
        method: 'api',
        label: 'API Key (Optional)',
        fields: [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'Leave empty if auth is disabled',
            required: false,
            helpText: 'Found in Tdarr under Tools > API Keys (only needed if authentication is enabled)',
          },
        ],
      },
    ],
    helpText: 'API key is optional - Tdarr can run without authentication.',
  },

  widgets: [
    {
      type: 'tdarr-status',
      name: 'Server Status',
      description: 'Tdarr server version and statistics',
      metric: 'status',
      defaultSize: { w: 2, h: 2 },
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
            { label: 'Show Uptime', key: 'showUptime' },
            { label: 'Show Node Count', key: 'showNodes' },
          ],
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'tdarr-queue',
      name: 'Queue Overview',
      description: 'Transcoding queue statistics',
      metric: 'queue',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'numbers', label: 'Large Numbers (Default)' },
        { value: 'donut', label: 'Donut Chart' },
        { value: 'bars', label: 'Progress Bars' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Transcode Queue', key: 'showTranscode' },
            { label: 'Show Health Check Queue', key: 'showHealthCheck' },
            { label: 'Show Processed Count', key: 'showProcessed' },
          ],
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'tdarr-workers',
      name: 'Active Workers',
      description: 'Currently active transcoding jobs',
      metric: 'workers',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Worker List (Default)' },
        { value: 'cards', label: 'Worker Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Worker Type',
          key: 'workerType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'transcode', label: 'Transcode' },
            { value: 'healthCheck', label: 'Health Check' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Progress', key: 'showProgress' },
            { label: 'Show File Name', key: 'showFileName' },
            { label: 'Show Node', key: 'showNode' },
          ],
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'tdarr-nodes',
      name: 'Node Status',
      description: 'Connected nodes and their status',
      metric: 'nodes',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Node List (Default)' },
        { value: 'cards', label: 'Node Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'Offline' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Workers', key: 'showWorkers' },
            { label: 'Show CPU/GPU', key: 'showResources' },
            { label: 'Show OS', key: 'showOS' },
          ],
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'tdarr-stats',
      name: 'Library Stats',
      description: 'Library statistics and space saved',
      metric: 'stats',
      defaultSize: { w: 2, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'numbers', label: 'Large Numbers (Default)' },
        { value: 'donut', label: 'Donut Chart' },
        { value: 'bars', label: 'Progress Bars' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Files Processed', key: 'showProcessed' },
            { label: 'Show Space Saved', key: 'showSpaceSaved' },
            { label: 'Show Health Checked', key: 'showHealthChecked' },
          ],
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
  ],
};
