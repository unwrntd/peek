import { IntegrationConfig } from './types';

export const wazuhConfig: IntegrationConfig = {
  type: 'wazuh',
  displayName: 'Wazuh',
  category: 'monitoring',
  description: 'Open-source security platform for threat detection, compliance, and incident response',
  documentationUrl: 'https://documentation.wazuh.com/current/user-manual/api/reference.html',
  dependencies: {
    apis: ['Wazuh REST API'],
    notes: 'Requires API access with user credentials. JWT authentication is used.',
  },
  sampleName: 'My Wazuh',
  defaultPort: 55000,
  sampleHost: 'wazuh.example.com',

  auth: {
    defaultMethod: 'basic',
    commonFields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        placeholder: 'wazuh.example.com',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '55000',
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
            placeholder: 'wazuh-wui',
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
    ],
    helpText: 'Use Wazuh API credentials. Default user is wazuh-wui.',
  },

  widgets: [
    {
      type: 'wazuh-status',
      name: 'Server Status',
      description: 'Wazuh manager status and running services',
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
            { label: 'Show Services', key: 'showServices' },
            { label: 'Show Uptime', key: 'showUptime' },
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
      type: 'wazuh-agent-overview',
      name: 'Agent Overview',
      description: 'Summary of agent connection states',
      metric: 'agent-summary',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'donut', label: 'Donut Chart (Default)' },
        { value: 'bars', label: 'Bar Chart' },
        { value: 'numbers', label: 'Large Numbers' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Percentages', key: 'showPercentages' },
            { label: 'Show Legend', key: 'showLegend' },
          ],
        },
      ],
    },
    {
      type: 'wazuh-agents',
      name: 'Agent List',
      description: 'List of all agents with status and details',
      metric: 'agents',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Table View (Default)' },
        { value: 'cards', label: 'Agent Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by name or IP',
        },
        {
          label: 'Status',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { label: 'All', value: '' },
            { label: 'Active', value: 'active' },
            { label: 'Disconnected', value: 'disconnected' },
            { label: 'Never Connected', value: 'never_connected' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '20',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show IP Address', key: 'showIp' },
            { label: 'Show OS Info', key: 'showOs' },
            { label: 'Show Last Keep Alive', key: 'showLastAlive' },
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
      type: 'wazuh-vulnerabilities',
      name: 'Vulnerabilities',
      description: 'Vulnerability summary with severity breakdown',
      metric: 'vulnerabilities',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'donut', label: 'Donut Chart (Default)' },
        { value: 'bars', label: 'Severity Bars' },
        { value: 'numbers', label: 'Large Numbers' },
      ],
      filters: [
        {
          label: 'Severity',
          key: 'severityFilter',
          type: 'button-group',
          options: [
            { label: 'All', value: '' },
            { label: 'Critical', value: 'critical' },
            { label: 'High', value: 'high' },
            { label: 'Medium', value: 'medium' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Counts', key: 'showCounts' },
            { label: 'Show Percentages', key: 'showPercentages' },
          ],
        },
      ],
    },
    {
      type: 'wazuh-cluster',
      name: 'Cluster Status',
      description: 'Wazuh cluster health and node information',
      metric: 'cluster',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Status Cards (Default)' },
        { value: 'list', label: 'Node List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Node Details', key: 'showNodeDetails' },
            { label: 'Show Version', key: 'showVersion' },
          ],
        },
      ],
    },
    {
      type: 'wazuh-stats',
      name: 'Statistics',
      description: 'Manager statistics including events and alerts',
      metric: 'stats',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'numbers', label: 'Large Numbers (Default)' },
        { value: 'bars', label: 'Bar Chart' },
        { value: 'cards', label: 'Stat Cards' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Events', key: 'showEvents' },
            { label: 'Show Alerts', key: 'showAlerts' },
            { label: 'Show Archives', key: 'showArchives' },
          ],
        },
      ],
    },
  ],
};
