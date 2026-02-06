import { IntegrationConfig } from './types';

export const lgThinQConfig: IntegrationConfig = {
  type: 'lg-thinq',
  displayName: 'LG ThinQ',
  category: 'smart-home',
  description: 'Monitor and control LG smart appliances including refrigerators, washers, dryers, dishwashers, air conditioners, air purifiers, and robot vacuums.',
  sampleName: 'My LG Appliances',
  sampleHost: 'us.lgeapi.com',
  defaultPort: 443, // Cloud-only, uses HTTPS
  documentationUrl: 'https://www.lg.com/us/support/thinq',
  dependencies: {
    notes: 'Uses unofficial reverse-engineered API. Same credentials as the LG ThinQ mobile app. Supports both ThinQ1 and ThinQ2 devices.',
  },

  auth: {
    defaultMethod: 'basic',
    commonFields: [
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        placeholder: 'US',
        required: true,
        helpText: 'Region code: US, EU, KR, AU, CN, or RU',
      },
      {
        key: 'language',
        label: 'Language',
        type: 'text',
        placeholder: 'en-US',
        required: true,
        helpText: 'Language code (e.g., en-US, ko-KR, de-DE)',
      },
    ],
    methods: [
      {
        method: 'basic',
        label: 'LG Account',
        fields: [
          {
            key: 'username',
            label: 'Email',
            type: 'text',
            placeholder: 'your.email@example.com',
            required: true,
            helpText: 'Your LG account email',
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'Your LG ThinQ password',
            required: true,
            helpText: 'Same password used for the ThinQ mobile app',
          },
        ],
      },
    ],
  },

  widgets: [
    {
      type: 'lg-devices',
      name: 'Devices',
      description: 'Overview of all connected LG devices',
      metric: 'devices',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      filters: [
        {
          label: 'Device Type',
          key: 'deviceType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'kitchen', label: 'Kitchen' },
            { value: 'laundry', label: 'Laundry' },
            { value: 'climate', label: 'Climate' },
            { value: 'cleaning', label: 'Cleaning' },
          ],
        },
        {
          label: 'Status',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'online', label: 'Online' },
            { value: 'running', label: 'Active' },
          ],
        },
      ],
    },
    {
      type: 'lg-refrigerator',
      name: 'Refrigerator',
      description: 'Refrigerator temperatures, modes, and filter status',
      metric: 'refrigerator',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      filters: [
        {
          label: 'Temperature Unit',
          key: 'tempUnit',
          type: 'button-group',
          options: [
            { value: 'f', label: '°F' },
            { value: 'c', label: '°C' },
          ],
        },
        {
          label: 'Display',
          key: 'display',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Freezer', key: 'showFreezer' },
            { label: 'Door Status', key: 'showDoorStatus' },
            { label: 'Express Mode', key: 'showExpressMode' },
            { label: 'Filter Status', key: 'showFilterStatus' },
          ],
        },
      ],
    },
    {
      type: 'lg-laundry',
      name: 'Laundry',
      description: 'Washer and dryer status with cycle progress',
      metric: 'laundry',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      filters: [
        {
          label: 'Display',
          key: 'display',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Cycle Name', key: 'showCycleName' },
            { label: 'Time Remaining', key: 'showTimeRemaining' },
            { label: 'Progress Bar', key: 'showProgress' },
            { label: 'Settings', key: 'showSettings' },
            { label: 'TurboWash', key: 'showTurboWash' },
          ],
        },
      ],
    },
    {
      type: 'lg-dishwasher',
      name: 'Dishwasher',
      description: 'Dishwasher cycle status and features',
      metric: 'dishwasher',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      filters: [
        {
          label: 'Display',
          key: 'display',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Cycle Name', key: 'showCycleName' },
            { label: 'Time Remaining', key: 'showTimeRemaining' },
            { label: 'Progress Bar', key: 'showProgress' },
            { label: 'Steam Mode', key: 'showSteamMode' },
            { label: 'Rinse Refill', key: 'showRinseRefill' },
          ],
        },
      ],
    },
    {
      type: 'lg-climate',
      name: 'Climate',
      description: 'Air conditioner and air purifier status',
      metric: 'climate',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      filters: [
        {
          label: 'Temperature Unit',
          key: 'tempUnit',
          type: 'button-group',
          options: [
            { value: 'f', label: '°F' },
            { value: 'c', label: '°C' },
          ],
        },
        {
          label: 'Display',
          key: 'display',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Mode', key: 'showMode' },
            { label: 'Fan Speed', key: 'showFanSpeed' },
            { label: 'Air Quality', key: 'showAirQuality' },
            { label: 'Filter Status', key: 'showFilterStatus' },
            { label: 'PM2.5', key: 'showPM25' },
          ],
        },
      ],
    },
    {
      type: 'lg-robot-vacuum',
      name: 'Robot Vacuum',
      description: 'Robot vacuum status and battery level',
      metric: 'robot-vacuum',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      filters: [
        {
          label: 'Display',
          key: 'display',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Battery', key: 'showBattery' },
            { label: 'Clean Mode', key: 'showCleanMode' },
            { label: 'Clean Area', key: 'showCleanArea' },
            { label: 'Clean Time', key: 'showCleanTime' },
          ],
        },
      ],
    },
    {
      type: 'lg-energy',
      name: 'Energy Usage',
      description: 'Energy consumption for ThinQ devices',
      metric: 'energy',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      filters: [
        {
          label: 'Time Range',
          key: 'timeRange',
          type: 'button-group',
          options: [
            { value: 'day', label: 'Today' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ],
        },
        {
          label: 'View',
          key: 'viewType',
          type: 'button-group',
          options: [
            { value: 'chart', label: 'Chart' },
            { value: 'numbers', label: 'Numbers' },
          ],
        },
      ],
    },
  ],
};
