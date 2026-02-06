import { IntegrationConfig } from './types';

export const tapoConfig: IntegrationConfig = {
  type: 'tapo',
  displayName: 'TP-Link Tapo',
  category: 'smart-home',
  description: 'Smart plugs, bulbs, and sensors with energy monitoring',
  documentationUrl: 'https://www.tp-link.com/us/support/download/tapo/',
  dependencies: {
    apis: ['TP-Link Cloud API'],
    packages: ['tp-link-tapo-connect'],
    notes: 'Uses TP-Link Cloud account with optional local device IPs',
  },
  sampleName: 'My Smart Home',
  sampleHost: '', // Cloud-based, no host needed
  defaultPort: 0, // Cloud-based, no port needed

  auth: {
    defaultMethod: 'basic',
    commonFields: [],
    methods: [
      {
        method: 'basic',
        label: 'TP-Link Cloud Account',
        fields: [
          {
            key: 'email',
            label: 'Email',
            type: 'text',
            placeholder: 'user@example.com',
            required: true,
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true,
          },
          {
            key: 'deviceIps',
            label: 'Device IPs (Optional)',
            type: 'text',
            placeholder: '192.168.1.100, 192.168.1.101',
            required: false,
            helpText: 'IP addresses for plugs and bulbs (comma-separated). Enables live on/off status and energy monitoring.',
          },
          {
            key: 'hubIps',
            label: 'Hub IPs (Optional)',
            type: 'text',
            placeholder: '192.168.1.50',
            required: false,
            helpText: 'IP addresses for Tapo Hubs H100/H200 (comma-separated). Required to fetch temperature sensor data.',
          },
        ],
      },
    ],
    helpText: 'Use your TP-Link account credentials. Device IPs enable local control and real-time power monitoring.',
  },

  widgets: [
    {
      type: 'tapo-devices',
      name: 'Device List',
      description: 'All Tapo devices with status indicators',
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
            { value: 'plug_energy', label: 'Energy Plugs (P110/P115)' },
            { value: 'bulb', label: 'Smart Bulbs' },
            { value: 'bulb_color', label: 'Color Bulbs' },
            { value: 'strip', label: 'Light Strips' },
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
      type: 'tapo-device-status',
      name: 'Device Status',
      description: 'Single device status with toggle control',
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
          type: 'tapo-device-select',
        },
        {
          label: 'Options',
          key: 'options',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Power Info', key: 'showPowerInfo' },
            { label: 'Show Signal', key: 'showSignal' },
          ],
        },
      ],
    },
    {
      type: 'tapo-energy',
      name: 'Energy Overview',
      description: 'Energy consumption for P110/P115 devices',
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
            { label: 'Today Energy', key: 'showTodayEnergy' },
            { label: 'Month Energy', key: 'showMonthEnergy' },
            { label: 'Runtime', key: 'showRuntime' },
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
      type: 'tapo-power',
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
          type: 'tapo-device-select',
        },
      ],
    },
    {
      type: 'tapo-sensors',
      name: 'Sensor List',
      description: 'Sensors from Tapo Hubs (H100/H200) - temperature, motion, contact, water leak',
      metric: 'sensors',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Sensor Cards (Default)' },
        { value: 'list', label: 'Sensor List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Sensor Types',
          key: 'sensorTypes',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Temperature', key: 'showTemperature' },
            { label: 'Motion', key: 'showMotion' },
            { label: 'Contact (Door/Window)', key: 'showContact' },
            { label: 'Water Leak', key: 'showWaterLeak' },
            { label: 'Button', key: 'showButton' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Battery', key: 'showBattery' },
            { label: 'Show Humidity', key: 'showHumidity' },
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
      type: 'tapo-sensor-value',
      name: 'Sensor Value',
      description: 'Display a single sensor value prominently',
      metric: 'sensors',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 1 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'large', label: 'Large Value (Default)' },
        { value: 'compact', label: 'Compact' },
      ],
      filters: [
        {
          label: 'Sensor',
          key: 'sensorId',
          type: 'tapo-sensor-select',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Name', key: 'showName' },
            { label: 'Show Battery', key: 'showBattery' },
            { label: 'Show Humidity (Temp sensors)', key: 'showHumidity' },
            { label: 'Show Status', key: 'showStatus' },
            { label: 'Show Last Update', key: 'showLastUpdate' },
          ],
        },
      ],
    },
  ],
};
