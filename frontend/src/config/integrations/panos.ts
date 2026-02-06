import { IntegrationConfig } from './types';
import { refreshIntervalFilter } from './static';

export const panosConfig: IntegrationConfig = {
  type: 'panos',
  displayName: 'Palo Alto PAN-OS',
  category: 'security',
  description: 'Palo Alto Networks next-generation firewall monitoring',
  documentationUrl: 'https://docs.paloaltonetworks.com/pan-os',
  dependencies: {
    apis: ['PAN-OS XML API'],
    notes: 'Requires API admin account with appropriate permissions. API key is recommended.',
  },
  sampleName: 'My Palo Alto',
  defaultPort: 443,
  sampleHost: '192.168.1.1',

  auth: {
    defaultMethod: 'api',
    commonFields: [
      {
        key: 'vsys',
        label: 'Virtual System',
        type: 'text',
        placeholder: 'vsys1',
        required: false,
        helpText: 'Virtual system name (default: vsys1)',
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
            required: true,
            helpText: 'Generate from Device > Administrators or via API keygen',
          },
        ],
      },
      {
        method: 'basic',
        label: 'Username & Password',
        fields: [
          {
            key: 'username',
            label: 'Username',
            type: 'text',
            required: true,
            helpText: 'Admin username with API access',
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true,
          },
        ],
      },
    ],
    helpText: 'API key is recommended. Generate at Device > Administrators > Admin Roles.',
  },

  widgets: [
    {
      type: 'panos-system',
      name: 'System Status',
      description: 'Firewall system information and health',
      metric: 'system',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'card', label: 'System Card (Default)' },
        { value: 'status', label: 'Health Status' },
        { value: 'compact', label: 'Compact' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'panos-interfaces',
      name: 'Interfaces',
      description: 'Network interface status and traffic',
      metric: 'interfaces',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'list', label: 'Interface List (Default)' },
        { value: 'cards', label: 'Interface Cards' },
        { value: 'traffic', label: 'Traffic Stats' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'status',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'up', label: 'Up' },
            { value: 'down', label: 'Down' },
          ],
        },
        refreshIntervalFilter,
      ],
    },
    {
      type: 'panos-vpn',
      name: 'VPN Tunnels',
      description: 'IPsec tunnel and gateway status',
      metric: 'vpn',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'list', label: 'Tunnel List (Default)' },
        { value: 'cards', label: 'Tunnel Cards' },
        { value: 'summary', label: 'Summary' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'panos-policies',
      name: 'Security Policies',
      description: 'Security rule overview',
      metric: 'policies',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 2 },
      visualizations: [
        { value: 'table', label: 'Policy Table (Default)' },
        { value: 'list', label: 'Policy List' },
        { value: 'stats', label: 'Hit Statistics' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'panos-threats',
      name: 'Threats',
      description: 'Threat detection summary',
      metric: 'threats',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'summary', label: 'Threat Summary (Default)' },
        { value: 'list', label: 'Recent Threats' },
        { value: 'chart', label: 'Severity Chart' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'panos-sessions',
      name: 'Sessions',
      description: 'Active session statistics',
      metric: 'sessions',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'gauge', label: 'Session Gauge (Default)' },
        { value: 'stats', label: 'Session Stats' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'panos-ha',
      name: 'High Availability',
      description: 'HA cluster status',
      metric: 'ha',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'status', label: 'HA Status (Default)' },
        { value: 'detailed', label: 'Full Details' },
      ],
      filters: [refreshIntervalFilter],
    },
  ],
};
