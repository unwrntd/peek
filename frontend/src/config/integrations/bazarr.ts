import { IntegrationConfig } from './types';

export const bazarrConfig: IntegrationConfig = {
  type: 'bazarr',
  displayName: 'Bazarr',
  category: 'media-management',
  description: 'Automatic subtitle management for Sonarr and Radarr',
  documentationUrl: 'https://wiki.bazarr.media/',
  dependencies: {
    apis: ['Bazarr API'],
  },
  sampleName: 'My Bazarr',
  defaultPort: 6767,
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
            placeholder: 'Enter API key',
            required: true,
            helpText: 'Found in Bazarr under Settings > General > Security',
          },
        ],
      },
    ],
  },

  widgets: [
    {
      type: 'bazarr-status',
      name: 'System Status',
      description: 'Bazarr version and system info',
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
            { label: 'Show Provider Status', key: 'showProviders' },
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
      type: 'bazarr-wanted',
      name: 'Wanted Overview',
      description: 'Missing subtitle counts for series and movies',
      metric: 'wanted',
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
            { label: 'Show Series Count', key: 'showSeries' },
            { label: 'Show Movies Count', key: 'showMovies' },
            { label: 'Show Total', key: 'showTotal' },
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
      type: 'bazarr-history',
      name: 'Recent Activity',
      description: 'Recent subtitle downloads and upgrades',
      metric: 'history',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Activity List (Default)' },
        { value: 'timeline', label: 'Timeline' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Media Type',
          key: 'mediaType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'series', label: 'Series' },
            { value: 'movies', label: 'Movies' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '10',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Provider', key: 'showProvider' },
            { label: 'Show Language', key: 'showLanguage' },
            { label: 'Show Date', key: 'showDate' },
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
      type: 'bazarr-series',
      name: 'Series Status',
      description: 'Series with missing subtitles',
      metric: 'series',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Series List (Default)' },
        { value: 'posters', label: 'Poster Grid' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Filter',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'missing', label: 'Missing Only' },
            { value: 'complete', label: 'Complete' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '10',
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'bazarr-movies',
      name: 'Movies Status',
      description: 'Movies with missing subtitles',
      metric: 'movies',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Movie List (Default)' },
        { value: 'posters', label: 'Poster Grid' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Filter',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'missing', label: 'Missing Only' },
            { value: 'complete', label: 'Complete' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '10',
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
