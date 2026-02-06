import { IntegrationConfig } from './types';

export const onePasswordConfig: IntegrationConfig = {
  type: 'onepassword',
  displayName: '1Password',
  category: 'utilities',
  description: '1Password vault management and secure credential access',
  documentationUrl: 'https://developer.1password.com/docs/connect/',
  dependencies: {
    apis: ['1Password Connect API', '1Password Service Account API'],
    notes: 'Supports both self-hosted Connect Server and cloud-based Service Accounts.',
  },
  sampleName: 'My 1Password',
  defaultPort: 8080,
  sampleHost: 'localhost',

  auth: {
    defaultMethod: 'token',
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'Connect Server',
        fields: [
          {
            key: 'host',
            label: 'Connect Server Host',
            type: 'text',
            placeholder: 'localhost',
            required: true,
          },
          {
            key: 'port',
            label: 'Port',
            type: 'number',
            placeholder: '8080',
            required: true,
            defaultValue: 8080,
          },
          {
            key: 'token',
            label: 'Connect Token',
            type: 'password',
            placeholder: 'Your 1Password Connect token',
            required: true,
            colSpan: 2,
            helpText: 'Token from 1password-credentials.json when deploying Connect server.',
          },
        ],
      },
      {
        method: 'api',
        label: 'Service Account',
        fields: [
          {
            key: 'token',
            label: 'Service Account Token',
            type: 'password',
            placeholder: 'ops_...',
            required: true,
            colSpan: 2,
            helpText: 'Create a Service Account at 1Password.com > Developer Tools.',
          },
        ],
      },
    ],
    helpText: 'Connect Server is self-hosted; Service Accounts use 1Password cloud API.',
  },

  widgets: [
    {
      type: 'onepassword-status',
      name: 'Status',
      description: 'Connect server health and version info',
      metric: 'status',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'card', label: 'Status Card (Default)' },
        { value: 'compact', label: 'Compact' },
      ],
    },
    {
      type: 'onepassword-vaults',
      name: 'Vaults',
      description: 'List of accessible vaults with item counts',
      metric: 'vaults',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Vault List (Default)' },
        { value: 'cards', label: 'Vault Cards' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter vaults...',
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'onepassword-vault-summary',
      name: 'Vault Summary',
      description: 'Item breakdown by category',
      metric: 'vault-summary',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'chart', label: 'Category Chart (Default)' },
        { value: 'cards', label: 'Category Cards' },
        { value: 'list', label: 'Category List' },
      ],
      filters: [
        {
          label: 'Vault',
          key: 'vaultId',
          type: 'text',
          placeholder: 'Vault ID (optional)',
        },
      ],
    },
    {
      type: 'onepassword-activity',
      name: 'Activity',
      description: 'Recent vault and item activity (Connect Server only)',
      metric: 'recent-activity',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Activity List (Default)' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Activity Type',
          key: 'activityType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'item', label: 'Items' },
            { value: 'vault', label: 'Vaults' },
          ],
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
      ],
    },
  ],
};
