import { IntegrationConfig } from './types';

export const pikvmConfig: IntegrationConfig = {
  type: 'pikvm',
  displayName: 'PiKVM',
  category: 'monitoring',
  description: 'IP-based KVM for remote server management',
  documentationUrl: 'https://docs.pikvm.org/api/',
  dependencies: {
    apis: ['PiKVM API'],
    notes: 'Uses X-KVMD authentication headers',
  },
  sampleName: 'My PiKVM',
  defaultPort: 443,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'basic',
    commonFields: [],
    methods: [
      {
        method: 'basic',
        label: 'Username/Password',
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
            required: true,
          },
        ],
      },
    ],
    helpText: 'Uses X-KVMD authentication headers. Default credentials are admin/admin.',
  },

  widgets: [
    {
      type: 'pikvm-system-info',
      name: 'System Info',
      description: 'PiKVM hardware info, version, and hostname',
      metric: 'info',
      defaultSize: { w: 4, h: 2 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Info Cards (Default)' },
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
            { label: 'Hostname', key: 'showHostname' },
            { label: 'Platform', key: 'showPlatform' },
            { label: 'KVMD Version', key: 'showVersion' },
            { label: 'Streamer Version', key: 'showStreamerVersion' },
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
      type: 'pikvm-power-status',
      name: 'Power Status',
      description: 'ATX power state and LED indicators',
      metric: 'atx',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'indicators', label: 'LED Indicators (Default)' },
        { value: 'cards', label: 'Status Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Elements to Display',
          key: 'displayElements',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Power LED', key: 'showPowerLed' },
            { label: 'HDD LED', key: 'showHddLed' },
            { label: 'ATX Status', key: 'showAtxStatus' },
          ],
        },
      ],
    },
    {
      type: 'pikvm-power-control',
      name: 'Power Control',
      description: 'ATX power control with action buttons',
      metric: 'atx',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'buttons', label: 'Action Buttons (Default)' },
        { value: 'grid', label: 'Button Grid' },
        { value: 'compact', label: 'Compact Buttons' },
      ],
      filters: [
        {
          label: 'Available Actions',
          key: 'actions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Power On', key: 'showPowerOn' },
            { label: 'Power Off', key: 'showPowerOff' },
            { label: 'Force Off', key: 'showForceOff' },
            { label: 'Reset', key: 'showReset' },
          ],
        },
        {
          label: 'Require Confirmation',
          key: 'requireConfirmation',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'pikvm-msd-status',
      name: 'MSD Status',
      description: 'Mass storage drive state and mounted images',
      metric: 'msd',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Status Cards (Default)' },
        { value: 'list', label: 'Image List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Elements to Display',
          key: 'displayElements',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Connection Status', key: 'showConnection' },
            { label: 'Current Image', key: 'showImage' },
            { label: 'Storage Info', key: 'showStorage' },
            { label: 'Image List', key: 'showImageList' },
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
      type: 'pikvm-streamer-status',
      name: 'Streamer Status',
      description: 'Video capture status, resolution, and clients',
      metric: 'streamer',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Status Cards (Default)' },
        { value: 'metrics', label: 'Large Metrics' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Elements to Display',
          key: 'displayElements',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Online Status', key: 'showOnline' },
            { label: 'Resolution', key: 'showResolution' },
            { label: 'FPS', key: 'showFps' },
            { label: 'Client Count', key: 'showClients' },
          ],
        },
      ],
    },
    {
      type: 'pikvm-snapshot',
      name: 'Snapshot',
      description: 'Live screenshot of target system',
      metric: 'snapshot',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'full', label: 'Full Image (Default)' },
        { value: 'fit', label: 'Fit to Widget' },
        { value: 'cover', label: 'Cover Widget' },
      ],
      filters: [
        {
          label: 'Auto Refresh (seconds)',
          key: 'autoRefresh',
          type: 'number',
          placeholder: '0 (disabled)',
        },
        {
          label: 'Click to Open Full Viewer',
          key: 'clickToOpen',
          type: 'checkbox',
        },
      ],
    },
  ],
};
