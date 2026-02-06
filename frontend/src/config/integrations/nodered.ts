import { IntegrationConfig } from './types';

export const nodeRedConfig: IntegrationConfig = {
  type: 'nodered',
  displayName: 'Node-RED',
  category: 'smart-home',
  description: 'Flow-based programming for IoT and automation',
  documentationUrl: 'https://nodered.org/docs/api/admin/',
  dependencies: {
    apis: ['Node-RED Admin API'],
    notes: 'Requires Admin API access enabled in Node-RED settings',
  },
  sampleName: 'My Node-RED',
  defaultPort: 1880,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'basic',
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
        placeholder: '1880',
        required: true,
      },
    ],
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
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'Your password',
            required: true,
          },
        ],
      },
      {
        method: 'token',
        label: 'Access Token',
        fields: [
          {
            key: 'accessToken',
            label: 'Access Token',
            type: 'password',
            placeholder: 'Your access token',
            required: true,
            colSpan: 2,
          },
        ],
      },
      {
        method: 'api',
        label: 'No Authentication',
        fields: [],
      },
    ],
  },

  widgets: [
    {
      type: 'nodered-status',
      name: 'Server Status',
      description: 'Node-RED server version and state',
      metric: 'status',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Status Cards (Default)' },
        { value: 'compact', label: 'Compact View' },
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
            { label: 'Show State', key: 'showState' },
          ],
        },
      ],
    },
    {
      type: 'nodered-flow-list',
      name: 'Flow List',
      description: 'List of all flows with node counts',
      metric: 'flows',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Flow List (Default)' },
        { value: 'cards', label: 'Flow Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter flows by name',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Disabled', key: 'showDisabled' },
            { label: 'Show Node Count', key: 'showNodeCount' },
          ],
        },
      ],
    },
    {
      type: 'nodered-nodes',
      name: 'Installed Nodes',
      description: 'List of installed node modules',
      metric: 'nodes',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Node List (Default)' },
        { value: 'cards', label: 'Node Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter modules by name',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Version', key: 'showVersion' },
            { label: 'Show Type Count', key: 'showTypeCount' },
          ],
        },
      ],
    },
    {
      type: 'nodered-diagnostics',
      name: 'Diagnostics',
      description: 'System diagnostics and resource usage',
      metric: 'diagnostics',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Diagnostic Cards (Default)' },
        { value: 'bars', label: 'Resource Bars' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Memory', key: 'showMemory' },
            { label: 'Show CPU', key: 'showCpu' },
            { label: 'Show Uptime', key: 'showUptime' },
          ],
        },
      ],
    },
  ],
};
