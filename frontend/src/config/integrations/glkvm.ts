import { IntegrationConfig } from './types';

export const glkvmConfig: IntegrationConfig = {
  type: 'glkvm',
  displayName: 'GL.iNet KVM',
  category: 'monitoring',
  description: 'GL.iNet Comet (GL-RM1) KVM-over-IP for remote server management',
  documentationUrl: 'https://docs.gl-inet.com/kvm/en/user_guide/gl-rm1/',
  dependencies: {
    apis: ['PiKVM-compatible API'],
    notes: 'Requires PiKVM interface to be enabled on port 8888',
  },
  sampleName: 'My GL-KVM',
  defaultPort: 8888,
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
    helpText: 'SETUP: 1) Enable PiKVM interface: edit /etc/kvmd/nginx-kvmd.conf to enable port 8888, then restart kvmd. 2) Set password: run "kvmd-htpasswd set admin" and enter a password. 3) Use admin + your new password here.',
  },

  widgets: [
    {
      type: 'glkvm-system-info',
      name: 'System Info',
      description: 'GL.iNet KVM hardware info, version, and hostname',
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
      type: 'glkvm-power-status',
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
      type: 'glkvm-power-control',
      name: 'Power Control',
      description: 'ATX power control with action buttons (requires ATX power board)',
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
      type: 'glkvm-msd-status',
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
      type: 'glkvm-streamer-status',
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
      type: 'glkvm-snapshot',
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
