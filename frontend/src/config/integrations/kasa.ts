import { IntegrationConfig } from './types';

export const kasaConfig: IntegrationConfig = {
  type: 'kasa',
  displayName: 'TP-Link Kasa',
  category: 'smart-home',
  description: 'Smart plugs, bulbs, and switches with energy monitoring',
  documentationUrl: 'https://www.tp-link.com/us/support/download/kasa/',
  dependencies: {
    packages: ['tplink-smarthome-api'],
    notes: 'Uses local network discovery; newer devices may require TP-Link account',
  },
  sampleName: 'My Smart Home',
  sampleHost: '',
  defaultPort: 0,

  auth: {
    defaultMethod: 'basic',
    commonFields: [],
    methods: [
      {
        method: 'basic',
        label: 'TP-Link Account',
        fields: [
          {
            key: 'email',
            label: 'TP-Link Account Email',
            type: 'text',
            placeholder: 'user@example.com',
            required: false,
            helpText: 'Required for newer Kasa devices with KLAP firmware. Use the same credentials as the Kasa app.',
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: false,
            helpText: 'Leave empty for older devices that don\'t require authentication.',
          },
          {
            key: 'deviceIps',
            label: 'Device IPs (Optional)',
            type: 'text',
            placeholder: '192.168.1.100, 192.168.1.101',
            required: false,
            helpText: 'Comma-separated IP addresses. Leave empty to auto-discover devices on your network.',
          },
          {
            key: 'discoveryTimeout',
            label: 'Discovery Timeout (ms)',
            type: 'number',
            defaultValue: 10000,
            placeholder: '10000',
            required: false,
            helpText: 'Time to wait for device discovery in milliseconds.',
          },
        ],
      },
    ],
    helpText: 'Newer Kasa devices require TP-Link account credentials. Older devices may work without credentials.',
  },

  widgets: [
    {
      type: 'kasa-devices',
      name: 'Device List',
      description: 'All Kasa devices with status indicators',
      metric: 'devices',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Device Cards (Default)' },
        { value: 'list', label: 'Device List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Device Type',
          key: 'deviceType',
          type: 'select',
          options: [
            { value: '', label: 'All Devices' },
            { value: 'plug', label: 'Smart Plugs' },
            { value: 'plug_energy', label: 'Energy Plugs' },
            { value: 'bulb', label: 'Smart Bulbs' },
            { value: 'bulb_color', label: 'Color Bulbs' },
            { value: 'power_strip', label: 'Power Strips' },
            { value: 'switch', label: 'Switches' },
            { value: 'dimmer', label: 'Dimmers' },
          ],
        },
        {
          label: 'Status',
          key: 'statusFilter',
          type: 'select',
          options: [
            { value: '', label: 'All' },
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
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
      type: 'kasa-device-status',
      name: 'Device Status',
      description: 'Single device detailed view with status',
      metric: 'device-info',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'card', label: 'Status Card (Default)' },
        { value: 'toggle', label: 'Toggle Button' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Device',
          key: 'deviceId',
          type: 'kasa-device-select',
        },
        {
          label: 'Options',
          key: 'options',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Signal', key: 'showSignal' },
            { label: 'Show Uptime', key: 'showUptime' },
          ],
        },
      ],
    },
    {
      type: 'kasa-energy',
      name: 'Energy Overview',
      description: 'Energy consumption for devices with monitoring (HS110, KP115, etc.)',
      metric: 'energy-usage',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Energy Cards (Default)' },
        { value: 'bars', label: 'Energy Bars' },
        { value: 'numbers', label: 'Large Numbers' },
      ],
      filters: [
        {
          label: 'Metrics to Display',
          key: 'metrics',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Current Power', key: 'showCurrentPower' },
            { label: 'Voltage', key: 'showVoltage' },
            { label: 'Current (Amps)', key: 'showCurrent' },
            { label: 'Today Energy', key: 'showTodayEnergy' },
            { label: 'Month Energy', key: 'showMonthEnergy' },
            { label: 'Total Energy', key: 'showTotalEnergy' },
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
      type: 'kasa-power',
      name: 'Power Monitor',
      description: 'Real-time power for a single device',
      metric: 'energy-usage',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'number', label: 'Large Number (Default)' },
        { value: 'gauge', label: 'Power Gauge' },
        { value: 'card', label: 'Power Card' },
      ],
      filters: [
        {
          label: 'Device',
          key: 'deviceId',
          type: 'kasa-device-select',
        },
      ],
    },
  ],
};
