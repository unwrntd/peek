import { IntegrationConfig } from './types';

export const ringConfig: IntegrationConfig = {
  type: 'ring',
  displayName: 'Ring',
  category: 'smart-home',
  description: 'Doorbell, cameras, and alarm system',
  documentationUrl: 'https://github.com/dgreif/ring',
  dependencies: {
    packages: ['ring-client-api'],
    notes: 'Requires refresh token from ring-auth-cli',
  },
  sampleName: 'My Ring',
  defaultPort: 443,
  sampleHost: 'ring.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'Refresh Token',
        fields: [
          {
            key: 'refreshToken',
            label: 'Refresh Token',
            type: 'password',
            placeholder: 'Your Ring refresh token',
            required: true,
            helpText: 'Generate a token using: npx -p ring-client-api ring-auth-cli',
            specialType: 'token-generator',
            colSpan: 2,
          },
        ],
      },
    ],
    helpText: 'Ring uses a refresh token for authentication. Generate one by running: npx -p ring-client-api ring-auth-cli',
  },

  widgets: [
    {
      type: 'ring-devices',
      name: 'Devices',
      description: 'Doorbells and cameras with battery, WiFi signal, online status',
      metric: 'devices',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Device Cards (Default)' },
        { value: 'list', label: 'Device List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Device Type',
          key: 'deviceType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'doorbell', label: 'Doorbells' },
            { value: 'camera', label: 'Cameras' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Battery', key: 'showBattery' },
            { label: 'Show WiFi Signal', key: 'showWifi' },
            { label: 'Show Last Event', key: 'showLastEvent' },
          ],
        },
      ],
    },
    {
      type: 'ring-events',
      name: 'Events',
      description: 'Recent motion and doorbell events with timestamps',
      metric: 'events',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Event List (Default)' },
        { value: 'timeline', label: 'Timeline' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Event Type',
          key: 'eventType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'motion', label: 'Motion' },
            { value: 'ding', label: 'Doorbell' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Device Name', key: 'showDeviceName' },
            { label: 'Show Time', key: 'showTime' },
            { label: 'Show Answered Status', key: 'showAnswered' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '20',
        },
      ],
    },
    {
      type: 'ring-alarm-status',
      name: 'Alarm Status',
      description: 'Current alarm mode, armed/disarmed, sensor summary',
      metric: 'alarm-status',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'card', label: 'Status Card (Default)' },
        { value: 'indicator', label: 'Mode Indicator' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Sensor Summary', key: 'showSensorSummary' },
            { label: 'Show Location Name', key: 'showLocationName' },
            { label: 'Show Faulted Count', key: 'showFaultedCount' },
          ],
        },
      ],
    },
    {
      type: 'ring-sensors',
      name: 'Sensors',
      description: 'All alarm sensors with open/closed state, battery, tamper status',
      metric: 'sensors',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Sensor Cards (Default)' },
        { value: 'list', label: 'Sensor List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Sensor State',
          key: 'stateFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'faulted', label: 'Open/Triggered' },
            { value: 'ok', label: 'Closed/OK' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Battery', key: 'showBattery' },
            { label: 'Show Tamper Status', key: 'showTamper' },
            { label: 'Show Room', key: 'showRoom' },
          ],
        },
      ],
    },
    {
      type: 'ring-snapshot',
      name: 'Camera Snapshot',
      description: 'Live snapshot from selected camera',
      metric: 'snapshot',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'full', label: 'Full Image (Default)' },
        { value: 'fit', label: 'Fit to Widget' },
        { value: 'cover', label: 'Cover Widget' },
      ],
      filters: [
        {
          label: 'Camera',
          key: 'deviceId',
          type: 'ring-camera-select',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Timestamp', key: 'showTimestamp' },
            { label: 'Show Camera Name', key: 'showCameraName' },
          ],
        },
      ],
    },
  ],
};
