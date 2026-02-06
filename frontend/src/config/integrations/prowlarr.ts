import { IntegrationConfig } from './types';

export const prowlarrConfig: IntegrationConfig = {
  type: 'prowlarr',
  displayName: 'Prowlarr',
  category: 'media-management',
  description: 'Indexer manager for the *arr stack',
  documentationUrl: 'https://wiki.servarr.com/prowlarr',
  dependencies: {
    apis: ['Prowlarr API'],
  },
  sampleName: 'My Prowlarr',
  defaultPort: 9696,
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
            placeholder: 'Your Prowlarr API key',
            required: true,
            helpText: 'Find your API key in Prowlarr Settings > General > Security',
          },
        ],
      },
    ],
    helpText: 'Enter your Prowlarr API key. You can find this in Prowlarr Settings > General > Security.',
  },

  widgets: [
    {
      type: 'prowlarr-status',
      name: 'System Status',
      description: 'Server info, uptime, and health warnings',
      metric: 'system-status',
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
            { label: 'Show Uptime', key: 'showUptime' },
            { label: 'Show Health', key: 'showHealth' },
            { label: 'Show OS Info', key: 'showOsInfo' },
          ],
        },
      ],
    },
    {
      type: 'prowlarr-indexers',
      name: 'Indexers',
      description: 'All configured indexers with status',
      metric: 'indexers',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Indexer List (Default)' },
        { value: 'cards', label: 'Indexer Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Protocol',
          key: 'protocolFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'torrent', label: 'Torrent' },
            { value: 'usenet', label: 'Usenet' },
          ],
        },
        {
          label: 'Privacy',
          key: 'privacyFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'public', label: 'Public' },
            { value: 'private', label: 'Private' },
          ],
        },
        {
          label: 'Status',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'enabled', label: 'Enabled' },
            { value: 'disabled', label: 'Disabled' },
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
      type: 'prowlarr-stats',
      name: 'Indexer Stats',
      description: 'Query and grab statistics per indexer',
      metric: 'indexer-stats',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'bars', label: 'Bar Chart (Default)' },
        { value: 'list', label: 'Stat List' },
        { value: 'donut', label: 'Donut Chart' },
      ],
      filters: [
        {
          label: 'Sort By',
          key: 'sortBy',
          type: 'button-group',
          options: [
            { value: 'queries', label: 'Queries' },
            { value: 'grabs', label: 'Grabs' },
            { value: 'failures', label: 'Failures' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Response Time', key: 'showResponseTime' },
            { label: 'Show Success Rate', key: 'showSuccessRate' },
          ],
        },
      ],
    },
    {
      type: 'prowlarr-apps',
      name: 'Applications',
      description: 'Connected *arr applications',
      metric: 'applications',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'App List (Default)' },
        { value: 'cards', label: 'App Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Sync Level', key: 'showSyncLevel' },
            { label: 'Show App Type', key: 'showAppType' },
          ],
        },
      ],
    },
    {
      type: 'prowlarr-history',
      name: 'History',
      description: 'Recent search and grab activity',
      metric: 'history',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Activity List (Default)' },
        { value: 'timeline', label: 'Timeline' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Event Type',
          key: 'eventTypeFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'grabbed', label: 'Grabbed' },
            { value: 'indexerQuery', label: 'Query' },
          ],
        },
        {
          label: 'Status',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'successful', label: 'Success' },
            { value: 'failed', label: 'Failed' },
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
  ],
};
