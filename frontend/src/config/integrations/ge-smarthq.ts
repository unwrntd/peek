import { IntegrationConfig } from './types';

export const geSmartHQConfig: IntegrationConfig = {
  type: 'ge-smarthq',
  displayName: 'GE SmartHQ',
  category: 'smart-home',
  description: 'Monitor and control GE smart appliances including refrigerators, washers, dryers, dishwashers, ovens, and air conditioners.',
  sampleName: 'My GE Appliances',
  sampleHost: 'api.brillion.geappliances.com',
  defaultPort: 443, // Cloud-only, uses HTTPS
  documentationUrl: 'https://www.geappliances.com/connect',
  dependencies: {
    notes: 'Uses unofficial reverse-engineered API. Same credentials as the GE SmartHQ mobile app.',
  },

  auth: {
    defaultMethod: 'basic',
    commonFields: [],
    methods: [
      {
        method: 'basic',
        label: 'GE Account',
        fields: [
          {
            key: 'email',
            label: 'Email',
            type: 'text',
            placeholder: 'your.email@example.com',
            required: true,
            helpText: 'Your GE Appliances account email',
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'Your GE SmartHQ password',
            required: true,
            helpText: 'Same password used for the SmartHQ mobile app',
          },
        ],
      },
    ],
  },

  widgets: [
    {
      type: 'ge-appliances',
      name: 'Appliances',
      description: 'Overview of all connected GE appliances',
      metric: 'appliances',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      filters: [
        {
          label: 'Appliance Type',
          key: 'applianceType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'kitchen', label: 'Kitchen' },
            { value: 'laundry', label: 'Laundry' },
            { value: 'hvac', label: 'HVAC' },
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
      type: 'ge-refrigerator',
      name: 'Refrigerator',
      description: 'Refrigerator temperatures, door status, and filter',
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
            { label: 'Filter Status', key: 'showFilterStatus' },
            { label: 'Ice Maker', key: 'showIceMaker' },
          ],
        },
      ],
    },
    {
      type: 'ge-laundry',
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
          ],
        },
      ],
    },
    {
      type: 'ge-dishwasher',
      name: 'Dishwasher',
      description: 'Dishwasher cycle status and supplies',
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
            { label: 'Rinse Aid', key: 'showRinseAid' },
          ],
        },
      ],
    },
    {
      type: 'ge-oven',
      name: 'Oven',
      description: 'Oven temperature, mode, and timer',
      metric: 'oven',
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
            { label: 'Upper Oven', key: 'showUpperOven' },
            { label: 'Lower Oven', key: 'showLowerOven' },
            { label: 'Cooktop', key: 'showCooktop' },
            { label: 'Timer', key: 'showTimer' },
            { label: 'Probe Temp', key: 'showProbe' },
          ],
        },
      ],
    },
    {
      type: 'ge-hvac',
      name: 'AC/Heat',
      description: 'Air conditioner or water heater status',
      metric: 'hvac',
      defaultSize: { w: 3, h: 2 },
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
            { label: 'Mode', key: 'showMode' },
            { label: 'Fan Speed', key: 'showFanSpeed' },
            { label: 'Humidity', key: 'showHumidity' },
            { label: 'Filter Alert', key: 'showFilterAlert' },
          ],
        },
      ],
    },
    {
      type: 'ge-opal',
      name: 'Opal Ice Maker',
      description: 'GE Opal ice maker status',
      metric: 'appliance-detail',
      defaultSize: { w: 2, h: 2 },
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
            { label: 'Ice Level', key: 'showIceLevel' },
            { label: 'Water Status', key: 'showWaterStatus' },
            { label: 'Schedule', key: 'showSchedule' },
          ],
        },
      ],
    },
  ],
};
