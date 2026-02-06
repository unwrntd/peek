import { IntegrationConfig } from './types';

export const kasmConfig: IntegrationConfig = {
  type: 'kasm',
  displayName: 'Kasm Workspaces',
  category: 'infrastructure',
  description: 'Container streaming platform for browser-based desktops',
  documentationUrl: 'https://www.kasmweb.com/docs/latest/developers/developer_api.html',
  dependencies: {
    apis: ['Kasm Developer API'],
    notes: 'Requires API key with appropriate permissions (Sessions View, Users View, Images View, Zones View)',
  },
  sampleName: 'My Kasm',
  defaultPort: 443,
  sampleHost: 'kasm.example.com',

  auth: {
    defaultMethod: 'api',
    commonFields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        placeholder: 'kasm.example.com',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '443',
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
            placeholder: 'Your API key',
            required: true,
          },
          {
            key: 'apiKeySecret',
            label: 'API Key Secret',
            type: 'password',
            placeholder: 'Your API key secret',
            required: true,
          },
        ],
      },
    ],
    helpText: 'Generate API keys from the Kasm admin panel under Keys → API Keys.',
  },

  widgets: [
    {
      type: 'kasm-status',
      name: 'Server Status',
      description: 'Kasm server overview with session and user counts',
      metric: 'status',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
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
            { label: 'Show Sessions', key: 'showSessions' },
            { label: 'Show Users', key: 'showUsers' },
            { label: 'Show Zones', key: 'showZones' },
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
      type: 'kasm-sessions',
      name: 'Active Sessions',
      description: 'List of all active Kasm sessions',
      metric: 'sessions',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Session List (Default)' },
        { value: 'cards', label: 'Session Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by user or image',
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
            { label: 'Show User', key: 'showUser' },
            { label: 'Show Image', key: 'showImage' },
            { label: 'Show Duration', key: 'showDuration' },
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
      type: 'kasm-session-count',
      name: 'Session Count',
      description: 'Total active session count',
      metric: 'sessions',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'number', label: 'Large Number (Default)' },
        { value: 'gauge', label: 'Circular Gauge' },
        { value: 'donut', label: 'Donut Chart' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Breakdown', key: 'showBreakdown' },
          ],
        },
      ],
    },
    {
      type: 'kasm-users',
      name: 'Users',
      description: 'List of users with status and last activity',
      metric: 'users',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'User List (Default)' },
        { value: 'cards', label: 'User Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by username',
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
            { label: 'Show Disabled', key: 'showDisabled' },
            { label: 'Show Groups', key: 'showGroups' },
            { label: 'Show Last Activity', key: 'showLastActivity' },
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
      type: 'kasm-images',
      name: 'Available Images',
      description: 'List of available workspace images',
      metric: 'images',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Image Grid (Default)' },
        { value: 'list', label: 'Image List' },
        { value: 'cards', label: 'Image Cards' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter images',
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
            { label: 'Show Disabled', key: 'showDisabled' },
            { label: 'Show Resources', key: 'showResources' },
            { label: 'Show Categories', key: 'showCategories' },
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
      type: 'kasm-zones',
      name: 'Zones',
      description: 'Deployment zones with auto-scaling status',
      metric: 'zones',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Zone Cards (Default)' },
        { value: 'list', label: 'Zone List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Status Filter',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Auto-scaling', key: 'showAutoScaling' },
            { label: 'Show Agents', key: 'showAgents' },
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
