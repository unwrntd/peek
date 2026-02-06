import { IntegrationConfig } from './types';

export const storjConfig: IntegrationConfig = {
  type: 'storj',
  displayName: 'Storj',
  category: 'infrastructure',
  description: 'Decentralized cloud storage with S3 compatibility and node operator dashboard',
  documentationUrl: 'https://storj.dev',
  dependencies: {
    apis: ['S3 Compatible API', 'Storage Node API'],
    notes: 'S3 credentials from Storj Satellite for storage; local network access for node dashboard',
  },
  sampleName: 'My Storj',
  defaultPort: 14002,
  sampleHost: 'gateway.storjshare.io',

  auth: {
    defaultMethod: 'api',
    commonFields: [],
    methods: [
      {
        method: 'api',
        label: 'S3 Storage Access',
        fields: [
          {
            key: 'mode',
            label: 'Mode',
            type: 'text',
            placeholder: 'storage',
            required: true,
            helpText: 'Set to "storage" for S3 access',
          },
          {
            key: 'accessKeyId',
            label: 'Access Key ID',
            type: 'text',
            required: true,
            helpText: 'S3-compatible Access Key from Storj Satellite',
          },
          {
            key: 'secretAccessKey',
            label: 'Secret Access Key',
            type: 'password',
            required: true,
            helpText: 'S3-compatible Secret Key',
          },
          {
            key: 'endpoint',
            label: 'Gateway Endpoint',
            type: 'text',
            placeholder: 'https://gateway.storjshare.io',
            required: false,
            helpText: 'S3 gateway endpoint (default: gateway.storjshare.io)',
          },
        ],
      },
      {
        method: 'basic',
        label: 'Node Operator Dashboard',
        fields: [
          {
            key: 'mode',
            label: 'Mode',
            type: 'text',
            placeholder: 'node',
            required: true,
            helpText: 'Set to "node" for operator dashboard',
          },
          {
            key: 'nodeHost',
            label: 'Node Host',
            type: 'text',
            placeholder: '192.168.1.100',
            required: true,
            helpText: 'Storage node IP address',
          },
          {
            key: 'nodePort',
            label: 'Node Port',
            type: 'number',
            placeholder: '14002',
            required: false,
            helpText: 'Dashboard API port (default: 14002)',
          },
        ],
      },
    ],
    helpText: 'Choose S3 credentials for storage access or Node API for operator dashboard',
  },

  widgets: [
    // S3 Storage widgets
    {
      type: 'storj-storage',
      name: 'Storage Overview',
      description: 'Buckets and total storage usage',
      metric: 'storage',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Bucket Cards (Default)' },
        { value: 'list', label: 'Bucket List' },
        { value: 'stats', label: 'Storage Stats' },
      ],
    },
    {
      type: 'storj-files',
      name: 'Recent Files',
      description: 'Files in a bucket',
      metric: 'files',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'File List (Default)' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Bucket',
          key: 'bucket',
          type: 'text',
          placeholder: 'my-bucket',
        },
        {
          label: 'Max Files',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
      ],
    },
    // Node operator widgets
    {
      type: 'storj-node-status',
      name: 'Node Status',
      description: 'Storage node status and disk usage',
      metric: 'node-status',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'card', label: 'Status Card (Default)' },
        { value: 'detailed', label: 'Detailed View' },
        { value: 'compact', label: 'Compact View' },
      ],
    },
    {
      type: 'storj-satellites',
      name: 'Satellites',
      description: 'Connected satellites and reputation',
      metric: 'satellites',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Satellite List (Default)' },
        { value: 'cards', label: 'Satellite Cards' },
        { value: 'compact', label: 'Score Indicators' },
      ],
    },
    {
      type: 'storj-earnings',
      name: 'Earnings',
      description: 'Node operator earnings and payouts',
      metric: 'earnings',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Earnings Cards (Default)' },
        { value: 'summary', label: 'Summary View' },
      ],
    },
    {
      type: 'storj-bandwidth',
      name: 'Bandwidth',
      description: 'Bandwidth usage statistics',
      metric: 'bandwidth',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'stats', label: 'Summary Stats (Default)' },
        { value: 'breakdown', label: 'By Satellite' },
      ],
    },
  ],
};
