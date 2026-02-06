import { IntegrationConfig } from './types';

export const overseerrConfig: IntegrationConfig = {
  type: 'overseerr',
  displayName: 'Overseerr',
  category: 'media-management',
  description: 'Media request and discovery management',
  documentationUrl: 'https://api-docs.overseerr.dev/',
  dependencies: {
    apis: ['Overseerr API'],
  },
  sampleName: 'My Overseerr',
  defaultPort: 5055,
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
            placeholder: 'Your Overseerr API key',
            required: true,
            helpText: 'Find your API key in Overseerr Settings > General > API Key',
          },
        ],
      },
    ],
    helpText: 'Enter your Overseerr API key. You can find this in Overseerr Settings > General > API Key.',
  },

  widgets: [
    {
      type: 'overseerr-stats',
      name: 'Request Statistics',
      description: 'Total request counts with breakdown by status',
      metric: 'request-count',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'number', label: 'Number' },
        { value: 'donut', label: 'Donut Chart' },
        { value: 'multi-row', label: 'Multi-Row' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Pending', key: 'showPending' },
            { label: 'Show Approved', key: 'showApproved' },
            { label: 'Show Declined', key: 'showDeclined' },
            { label: 'Show Processing', key: 'showProcessing' },
            { label: 'Show Available', key: 'showAvailable' },
          ],
        },
      ],
    },
    {
      type: 'overseerr-requests',
      name: 'Request List',
      description: 'Recent media requests with poster, title, and status',
      metric: 'requests',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Request Cards (Default)' },
        { value: 'list', label: 'Compact List' },
        { value: 'posters', label: 'Poster Grid' },
      ],
      filters: [
        {
          label: 'Media Type',
          key: 'mediaType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
          ],
        },
        {
          label: 'Request Status',
          key: 'requestStatus',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'declined', label: 'Declined' },
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
            { label: 'Show Poster', key: 'showPoster' },
            { label: 'Show Requester', key: 'showRequester' },
            { label: 'Show Date', key: 'showDate' },
            { label: 'Show Media Status', key: 'showMediaStatus' },
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
      type: 'overseerr-pending',
      name: 'Pending Requests',
      description: 'Requests awaiting approval',
      metric: 'requests',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Request Cards (Default)' },
        { value: 'list', label: 'Compact List' },
        { value: 'posters', label: 'Poster Grid' },
      ],
      filters: [
        {
          label: 'Media Type',
          key: 'mediaType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '5',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Poster', key: 'showPoster' },
            { label: 'Show Requester', key: 'showRequester' },
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
      type: 'overseerr-status',
      name: 'Server Status',
      description: 'Overseerr server version and update status',
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
          label: 'Elements to Display',
          key: 'displayElements',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Version', key: 'showVersion' },
            { label: 'Commit Tag', key: 'showCommitTag' },
            { label: 'Update Status', key: 'showUpdateStatus' },
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
