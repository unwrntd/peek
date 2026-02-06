import { IntegrationConfig } from './types';
import { refreshIntervalFilter } from './static';

export const fortigateConfig: IntegrationConfig = {
  type: 'fortigate',
  displayName: 'FortiGate',
  category: 'security',
  description: 'Fortinet FortiGate next-generation firewall',
  documentationUrl: 'https://docs.fortinet.com/product/fortigate/',
  dependencies: {
    apis: ['FortiOS REST API'],
    notes: 'Requires REST API administrator with appropriate permissions',
  },
  sampleName: 'My FortiGate',
  defaultPort: 443,
  sampleHost: '192.168.1.1',

  auth: {
    defaultMethod: 'token',
    commonFields: [
      {
        key: 'vdom',
        label: 'VDOM',
        type: 'text',
        placeholder: 'root',
        required: false,
        helpText: 'Virtual domain name (default: root)',
      },
    ],
    methods: [
      {
        method: 'token',
        label: 'API Token',
        fields: [
          {
            key: 'apiToken',
            label: 'API Token',
            type: 'password',
            required: true,
            helpText: 'Generate from System > Administrators > REST API Admin',
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
    helpText: 'API token is recommended. Create at System > Administrators > Create New > REST API Admin.',
  },

  widgets: [
    {
      type: 'fortigate-system',
      name: 'System Status',
      description: 'System information and resource usage',
      metric: 'system',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'card', label: 'System Card (Default)' },
        { value: 'gauges', label: 'Resource Gauges' },
        { value: 'compact', label: 'Compact' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'fortigate-interfaces',
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
          label: 'Type',
          key: 'type',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'physical', label: 'Physical' },
            { value: 'vlan', label: 'VLAN' },
            { value: 'tunnel', label: 'Tunnel' },
          ],
        },
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
      type: 'fortigate-policies',
      name: 'Firewall Policies',
      description: 'Policy overview and hit counts',
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
      type: 'fortigate-vpn',
      name: 'VPN Status',
      description: 'IPsec and SSL VPN tunnel status',
      metric: 'vpn',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'list', label: 'Tunnel List (Default)' },
        { value: 'cards', label: 'VPN Cards' },
        { value: 'users', label: 'SSL VPN Users' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'fortigate-sessions',
      name: 'Sessions',
      description: 'Active session statistics',
      metric: 'sessions',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'gauge', label: 'Session Gauge (Default)' },
        { value: 'stats', label: 'Session Stats' },
        { value: 'top', label: 'Top Sessions' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'fortigate-security',
      name: 'Security Events',
      description: 'IPS, antivirus, and web filter stats',
      metric: 'security',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'summary', label: 'Security Summary (Default)' },
        { value: 'chart', label: 'Threats Chart' },
        { value: 'detailed', label: 'Detailed Stats' },
      ],
      filters: [refreshIntervalFilter],
    },
    {
      type: 'fortigate-devices',
      name: 'Detected Devices',
      description: 'Network devices detected by FortiGate',
      metric: 'devices',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'grid', label: 'Device Grid (Default)' },
        { value: 'list', label: 'Device List' },
        { value: 'stats', label: 'Device Stats' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'status',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'Offline' },
          ],
        },
        refreshIntervalFilter,
      ],
    },
    {
      type: 'fortigate-ha',
      name: 'High Availability',
      description: 'HA cluster status',
      metric: 'ha',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      visualizations: [
        { value: 'status', label: 'HA Status (Default)' },
        { value: 'members', label: 'Member List' },
      ],
      filters: [refreshIntervalFilter],
    },
  ],
};
