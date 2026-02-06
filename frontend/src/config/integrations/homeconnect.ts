import { IntegrationConfig } from './types';

export const homeConnectConfig: IntegrationConfig = {
  type: 'homeconnect',
  displayName: 'Home Connect',
  category: 'smart-home',
  description: 'BSH home appliances (Bosch, Siemens, Gaggenau, Neff)',
  documentationUrl: 'https://developer.home-connect.com/',
  dependencies: {
    apis: ['Home Connect API'],
    notes: 'Requires OAuth Device Flow authentication',
  },
  sampleName: 'My Home Connect',
  defaultPort: 443,
  sampleHost: 'api.home-connect.com',

  auth: {
    defaultMethod: 'api',
    commonFields: [],
    methods: [
      {
        method: 'api',
        label: 'OAuth Credentials',
        fields: [
          {
            key: 'clientId',
            label: 'Client ID',
            type: 'text',
            placeholder: 'Your Home Connect Client ID',
            required: true,
            helpText: 'From Home Connect Developer Portal',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            type: 'password',
            placeholder: 'Your Home Connect Client Secret',
            required: true,
            helpText: 'From Home Connect Developer Portal',
          },
          {
            key: 'refreshToken',
            label: 'Refresh Token',
            type: 'password',
            placeholder: 'Generated via Device Flow',
            required: true,
            helpText: 'Click "Generate Token" to authorize with your Home Connect account',
            specialType: 'token-generator',
            colSpan: 2,
          },
        ],
      },
    ],
    helpText: 'Register at developer.home-connect.com and enable Device Flow. Then use "Generate Token" to authorize.',
  },

  widgets: [
    {
      type: 'homeconnect-appliances',
      name: 'Appliance List',
      description: 'All connected appliances with status',
      metric: 'appliances',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Appliance Cards (Default)' },
        { value: 'list', label: 'Appliance List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Appliance Type',
          key: 'applianceType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'Washer', label: 'Washer' },
            { value: 'Dryer', label: 'Dryer' },
            { value: 'Dishwasher', label: 'Dishwasher' },
            { value: 'Oven', label: 'Oven' },
            { value: 'Refrigerator', label: 'Fridge' },
            { value: 'CoffeeMaker', label: 'Coffee' },
          ],
        },
        {
          label: 'Connection Status',
          key: 'connectionStatus',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'connected', label: 'Connected' },
            { value: 'disconnected', label: 'Disconnected' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Brand', key: 'showBrand' },
            { label: 'Show Model', key: 'showModel' },
            { label: 'Show Connection Status', key: 'showConnectionStatus' },
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
      type: 'homeconnect-status',
      name: 'Appliance Status',
      description: 'Detailed status for appliances',
      metric: 'appliance-status',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Status Cards (Default)' },
        { value: 'list', label: 'Status List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Appliance Type',
          key: 'applianceType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'Washer', label: 'Washer' },
            { value: 'Dryer', label: 'Dryer' },
            { value: 'Dishwasher', label: 'Dishwasher' },
            { value: 'Oven', label: 'Oven' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Door State', key: 'showDoorState' },
            { label: 'Show Remote Control', key: 'showRemoteControl' },
            { label: 'Show Power State', key: 'showPowerState' },
          ],
        },
        {
          label: 'Connected Only',
          key: 'connectedOnly',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'homeconnect-programs',
      name: 'Active Programs',
      description: 'Running programs with progress',
      metric: 'active-programs',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Program Cards (Default)' },
        { value: 'progress', label: 'Progress View' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Progress Bar', key: 'showProgressBar' },
            { label: 'Show Time Remaining', key: 'showTimeRemaining' },
            { label: 'Show Program Options', key: 'showOptions' },
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
      type: 'homeconnect-timer',
      name: 'Program Timer',
      description: 'Countdown timer for active programs',
      metric: 'active-programs',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'countdown', label: 'Countdown Timer (Default)' },
        { value: 'progress', label: 'Progress Circle' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Appliance',
          key: 'selectedAppliance',
          type: 'text',
          placeholder: 'Appliance name (leave empty for first)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Appliance Name', key: 'showApplianceName' },
            { label: 'Show Program Name', key: 'showProgramName' },
            { label: 'Show Progress Percentage', key: 'showProgress' },
          ],
        },
      ],
    },
    {
      type: 'homeconnect-fridge-camera',
      name: 'Fridge Camera',
      description: 'Interior camera view from refrigerator',
      metric: 'fridge-images',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'full', label: 'Full Image (Default)' },
        { value: 'fit', label: 'Fit to Widget' },
        { value: 'gallery', label: 'Image Gallery' },
      ],
      filters: [
        {
          label: 'Refrigerator',
          key: 'selectedHaId',
          type: 'homeconnect-fridge-select',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Appliance Name', key: 'showApplianceName' },
            { label: 'Show Timestamp', key: 'showTimestamp' },
            { label: 'Show Image Count', key: 'showImageCount' },
          ],
        },
        {
          label: 'Auto Refresh',
          key: 'autoRefresh',
          type: 'checkbox',
        },
      ],
    },
  ],
};
