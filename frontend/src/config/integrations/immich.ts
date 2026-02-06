import { IntegrationConfig } from './types';

export const immichConfig: IntegrationConfig = {
  type: 'immich',
  displayName: 'Immich',
  category: 'media-management',
  description: 'Self-hosted photo and video management',
  documentationUrl: 'https://immich.app/docs/api/',
  dependencies: {
    apis: ['Immich API'],
  },
  sampleName: 'My Immich',
  defaultPort: 2283,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'api',
    commonFields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        placeholder: '192.168.1.100',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '2283',
        defaultValue: 2283,
        required: true,
      },
    ],
    methods: [
      {
        method: 'api',
        label: 'API Key',
        fields: [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'Your Immich API key',
            required: true,
            colSpan: 2,
            helpText: 'Create an API key in Account Settings > API Keys',
          },
        ],
      },
    ],
    helpText: 'Generate an API key in Immich: Account Settings > API Keys. For full features, use an admin account.',
  },

  widgets: [
    {
      type: 'immich-server-info',
      name: 'Server Info',
      description: 'Server version, storage usage, and update status',
      metric: 'server-info',
      defaultSize: { w: 3, h: 2 },
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
            { label: 'Show Storage Bar', key: 'showStorage' },
            { label: 'Show Version Details', key: 'showVersionDetails' },
            { label: 'Show Update Status', key: 'showUpdateStatus' },
          ],
        },
        {
          label: 'Storage Warning Threshold (%)',
          key: 'warningThreshold',
          type: 'number',
          placeholder: '75 (default)',
        },
        {
          label: 'Storage Critical Threshold (%)',
          key: 'criticalThreshold',
          type: 'number',
          placeholder: '90 (default)',
        },
      ],
    },
    {
      type: 'immich-statistics',
      name: 'Statistics',
      description: 'Total photos, videos, users with storage breakdown',
      metric: 'statistics',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'numbers', label: 'Large Numbers (Default)' },
        { value: 'donut', label: 'Donut Chart' },
        { value: 'bars', label: 'Bar Chart' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show User Breakdown', key: 'showUserBreakdown' },
            { label: 'Show Storage Usage', key: 'showStorageUsage' },
          ],
        },
      ],
    },
    {
      type: 'immich-jobs',
      name: 'Jobs Status',
      description: 'Background job queues with progress (admin only)',
      metric: 'jobs',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Job List (Default)' },
        { value: 'compact', label: 'Compact List' },
        { value: 'progress', label: 'Progress Bars' },
      ],
      filters: [
        {
          label: 'Show Jobs',
          key: 'jobFilter',
          type: 'button-group',
          options: [
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active Only' },
            { value: 'failed', label: 'Failed Only' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Completed Count', key: 'showCompleted' },
            { label: 'Show Progress Bars', key: 'showProgressBars' },
          ],
        },
      ],
    },
    {
      type: 'immich-albums',
      name: 'Albums',
      description: 'Album list with photo counts',
      metric: 'albums',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Album Grid (Default)' },
        { value: 'list', label: 'Album List' },
        { value: 'cards', label: 'Album Cards' },
      ],
      filters: [
        {
          label: 'Show Albums',
          key: 'albumFilter',
          type: 'button-group',
          options: [
            { value: 'all', label: 'All' },
            { value: 'owned', label: 'Owned' },
            { value: 'shared', label: 'Shared' },
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
            { label: 'Show Owner', key: 'showOwner' },
            { label: 'Show Date', key: 'showDate' },
          ],
        },
      ],
    },
    {
      type: 'immich-recent',
      name: 'Recent Uploads',
      description: 'Recently added photos and videos',
      metric: 'recent',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Photo Grid (Default)' },
        { value: 'list', label: 'Photo List' },
        { value: 'carousel', label: 'Carousel' },
      ],
      filters: [
        {
          label: 'Media Type',
          key: 'mediaType',
          type: 'button-group',
          options: [
            { value: 'all', label: 'All' },
            { value: 'photos', label: 'Photos' },
            { value: 'videos', label: 'Videos' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '12',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Filename', key: 'showFilename' },
            { label: 'Show Date', key: 'showDate' },
          ],
        },
      ],
    },
  ],
};
