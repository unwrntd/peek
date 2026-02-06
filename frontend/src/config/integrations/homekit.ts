import { IntegrationConfig } from './types';

export const homekitConfig: IntegrationConfig = {
  type: 'homekit',
  displayName: 'Apple HomeKit',
  category: 'smart-home',
  description: 'Direct HomeKit device control via HAP protocol',
  documentationUrl: 'https://developer.apple.com/homekit/',
  dependencies: {
    apis: ['HomeKit Accessory Protocol (HAP)'],
    notes: 'Requires network access for mDNS device discovery. Works best with host network mode in Docker.',
  },
  sampleName: 'My HomeKit',
  defaultPort: 51826,
  sampleHost: 'auto-discovery',

  auth: {
    defaultMethod: 'token',
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'Device Configuration',
        fields: [
          {
            key: 'discoveryMode',
            label: 'Discovery Mode',
            type: 'text',
            placeholder: 'auto',
            required: true,
            helpText: 'Enter "auto" to discover devices or "manual" for manual configuration',
          },
          {
            key: 'discoveryTimeout',
            label: 'Discovery Timeout (ms)',
            type: 'number',
            placeholder: '10000',
            required: false,
            helpText: 'How long to scan for devices (default: 10 seconds)',
          },
        ],
      },
    ],
    helpText: 'Connects directly to HomeKit devices using the HAP protocol. Pair devices using their 8-digit setup PIN.',
  },

  widgets: [
    {
      type: 'homekit-devices',
      name: 'All Devices',
      description: 'Overview of all paired HomeKit devices',
      metric: 'devices',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Device Grid (Default)' },
        { value: 'list', label: 'Device List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Device Category',
          key: 'category',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'lights', label: 'Lights' },
            { value: 'switches', label: 'Switches' },
            { value: 'sensors', label: 'Sensors' },
            { value: 'climate', label: 'Climate' },
            { value: 'locks', label: 'Locks' },
          ],
        },
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
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Status', key: 'showStatus' },
            { label: 'Show Category', key: 'showCategory' },
            { label: 'Show Address', key: 'showAddress' },
          ],
        },
      ],
    },
    {
      type: 'homekit-lights',
      name: 'Lights',
      description: 'Control HomeKit light bulbs and dimmers',
      metric: 'lights',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Light Cards (Default)' },
        { value: 'sliders', label: 'Brightness Sliders' },
        { value: 'compact', label: 'Compact Toggles' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'status',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Brightness', key: 'showBrightness' },
            { label: 'Show Color', key: 'showColor' },
          ],
        },
      ],
    },
    {
      type: 'homekit-climate',
      name: 'Climate',
      description: 'Thermostats, temperature sensors, and fans',
      metric: 'climate',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Climate Cards (Default)' },
        { value: 'compact', label: 'Compact View' },
        { value: 'gauges', label: 'Temperature Gauges' },
      ],
      filters: [
        {
          label: 'Device Type',
          key: 'deviceType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'thermostat', label: 'Thermostats' },
            { value: 'sensor', label: 'Sensors' },
            { value: 'fan', label: 'Fans' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Target Temp', key: 'showTarget' },
            { label: 'Show Humidity', key: 'showHumidity' },
            { label: 'Show Mode', key: 'showMode' },
          ],
        },
      ],
    },
    {
      type: 'homekit-sensors',
      name: 'Sensors',
      description: 'Motion, contact, temperature, and other sensors',
      metric: 'sensors',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Sensor Grid (Default)' },
        { value: 'list', label: 'Sensor List' },
        { value: 'status', label: 'Status Only' },
      ],
      filters: [
        {
          label: 'Sensor Type',
          key: 'sensorType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'motion', label: 'Motion' },
            { value: 'contact', label: 'Contact' },
            { value: 'temperature', label: 'Temperature' },
            { value: 'humidity', label: 'Humidity' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Battery', key: 'showBattery' },
            { label: 'Show Last Updated', key: 'showLastUpdated' },
          ],
        },
      ],
    },
    {
      type: 'homekit-device-control',
      name: 'Device Control',
      description: 'Control a single HomeKit device',
      metric: 'devices',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'card', label: 'Control Card (Default)' },
        { value: 'toggle', label: 'Simple Toggle' },
        { value: 'compact', label: 'Compact' },
      ],
      filters: [
        {
          label: 'Device ID',
          key: 'deviceId',
          type: 'text',
          placeholder: 'Device identifier',
        },
      ],
    },
  ],
};
