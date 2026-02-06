import { IntegrationConfig } from './types';

export const homebridgeConfig: IntegrationConfig = {
  type: 'homebridge',
  displayName: 'Homebridge',
  category: 'smart-home',
  description: 'HomeKit bridge for non-HomeKit accessories',
  documentationUrl: 'https://github.com/homebridge/homebridge-config-ui-x/wiki/API-Reference',
  dependencies: {
    apis: ['Homebridge Config UI X API'],
    notes: 'Enable insecure mode (-I) for accessory control',
  },
  sampleName: 'My Homebridge',
  defaultPort: 8581,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'basic',
    commonFields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        placeholder: '192.168.1.100',
        required: true,
        helpText: 'Homebridge server IP address or hostname',
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '8581',
        required: true,
        helpText: 'Default is 8581',
      },
    ],
    methods: [
      {
        method: 'basic',
        label: 'Username & Password',
        fields: [
          {
            key: 'username',
            label: 'Username',
            type: 'text',
            placeholder: 'admin',
            required: true,
            helpText: 'Homebridge Config UI X username',
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'admin',
            required: true,
            helpText: 'Homebridge Config UI X password',
          },
        ],
      },
    ],
    helpText: 'Enter your Homebridge Config UI X basic. Enable insecure mode (-I flag) for accessory control.',
  },

  widgets: [
    {
      type: 'homebridge-status',
      name: 'Server Status',
      description: 'Homebridge status, version, CPU, and memory',
      metric: 'status',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Status Cards (Default)' },
        { value: 'compact', label: 'Compact View' },
        { value: 'metrics', label: 'Large Metrics' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show CPU', key: 'showCpu' },
            { label: 'Show RAM', key: 'showRam' },
            { label: 'Show Node Version', key: 'showNodeVersion' },
          ],
        },
      ],
    },
    {
      type: 'homebridge-accessories',
      name: 'Accessories',
      description: 'All HomeKit accessories (requires insecure mode)',
      metric: 'accessories',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Accessory Cards (Default)' },
        { value: 'list', label: 'Accessory List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Accessory Type',
          key: 'accessoryType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'Switch', label: 'Switches' },
            { value: 'Lightbulb', label: 'Lights' },
            { value: 'Outlet', label: 'Outlets' },
            { value: 'Sensor', label: 'Sensors' },
            { value: 'Lock', label: 'Locks' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Manufacturer', key: 'showManufacturer' },
            { label: 'Show Model', key: 'showModel' },
            { label: 'Show Bridge Name', key: 'showBridgeName' },
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
      type: 'homebridge-accessory-control',
      name: 'Accessory Control',
      description: 'Control a single accessory',
      metric: 'accessories',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'card', label: 'Control Card (Default)' },
        { value: 'toggle', label: 'Toggle Button' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Accessory',
          key: 'selectedAccessory',
          type: 'text',
          placeholder: 'Accessory name (leave empty for first)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Name', key: 'showName' },
            { label: 'Show State', key: 'showState' },
            { label: 'Show Type Icon', key: 'showIcon' },
          ],
        },
      ],
    },
    {
      type: 'homebridge-plugins',
      name: 'Plugins',
      description: 'Installed Homebridge plugins',
      metric: 'plugins',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Plugin List (Default)' },
        { value: 'cards', label: 'Plugin Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Show Updates Only',
          key: 'updatesOnly',
          type: 'checkbox',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Version', key: 'showVersion' },
            { label: 'Show Description', key: 'showDescription' },
            { label: 'Show Update Badge', key: 'showUpdateBadge' },
          ],
        },
      ],
    },
  ],
};
