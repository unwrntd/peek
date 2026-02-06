import { IntegrationConfig } from './types';

export const netalertxConfig: IntegrationConfig = {
  type: 'netalertx',
  displayName: 'NetAlertX',
  category: 'networking',
  description: 'Network device monitoring and alerting (formerly Pi.Alert)',
  documentationUrl: 'https://github.com/netalertx/NetAlertX/blob/main/docs/API.md',
  dependencies: {
    apis: ['NetAlertX REST API'],
    notes: 'Requires Bearer API token from NetAlertX settings',
  },
  sampleName: 'My NetAlertX',
  defaultPort: 20212,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'token',
    commonFields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        placeholder: '192.168.1.100',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '20212',
        required: true,
      },
    ],
    methods: [
      {
        method: 'token',
        label: 'API Token',
        fields: [
          {
            key: 'apiToken',
            label: 'API Token',
            type: 'password',
            placeholder: 'Your NetAlertX API token',
            required: true,
            colSpan: 2,
            helpText: 'Generate from NetAlertX settings under API configuration',
          },
        ],
      },
    ],
  },

  widgets: [
    {
      type: 'netalertx-device-overview',
      name: 'Device Overview',
      description: 'Summary of device counts by status',
      metric: 'device-totals',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'numbers', label: 'Large Numbers (Default)' },
        { value: 'donut', label: 'Donut Chart' },
        { value: 'bars', label: 'Status Bars' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Online', key: 'showOnline' },
            { label: 'Show Offline', key: 'showOffline' },
            { label: 'Show New', key: 'showNew' },
          ],
        },
      ],
    },
    {
      type: 'netalertx-device-list',
      name: 'Device List',
      description: 'List of network devices with status',
      metric: 'devices',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Table View (Default)' },
        { value: 'cards', label: 'Device Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'status',
          type: 'button-group',
          options: [
            { value: 'all', label: 'All' },
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'Offline' },
            { value: 'down', label: 'Down' },
            { value: 'new', label: 'New' },
            { value: 'favorites', label: 'Favorites' },
          ],
        },
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by name, MAC, or IP',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Vendor', key: 'showVendor' },
            { label: 'Show Last Connection', key: 'showLastConnection' },
            { label: 'Show Sessions', key: 'showSessions' },
          ],
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '50',
        },
      ],
    },
    {
      type: 'netalertx-recent-events',
      name: 'Recent Events',
      description: 'Network events from the last 24 hours',
      metric: 'recent-events',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
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
            { value: 'Connected', label: 'Connected' },
            { value: 'Disconnected', label: 'Disconnected' },
            { value: 'Device Down', label: 'Down' },
            { value: 'New Device', label: 'New' },
          ],
        },
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by MAC or IP',
        },
        {
          label: 'Max Events',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
      ],
    },
    {
      type: 'netalertx-session-stats',
      name: 'Session Statistics',
      description: 'Connection session metrics',
      metric: 'session-stats',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'numbers', label: 'Large Numbers (Default)' },
        { value: 'cards', label: 'Stat Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Total Sessions', key: 'showTotal' },
            { label: 'Show Active Sessions', key: 'showActive' },
          ],
        },
      ],
    },
    {
      type: 'netalertx-internet-info',
      name: 'Internet Info',
      description: 'Public IP and ISP information',
      metric: 'internet-info',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Info Cards (Default)' },
        { value: 'compact', label: 'Compact View' },
        { value: 'list', label: 'Info List' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Public IP', key: 'showIp' },
            { label: 'Show ISP', key: 'showIsp' },
            { label: 'Show Location', key: 'showLocation' },
          ],
        },
      ],
    },
    {
      type: 'netalertx-interfaces',
      name: 'Network Interfaces',
      description: 'Server network interface statistics',
      metric: 'interfaces',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Table View (Default)' },
        { value: 'cards', label: 'Interface Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Interface Filter',
          key: 'interfaceFilter',
          type: 'text',
          placeholder: 'Filter by name',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show MAC', key: 'showMac' },
            { label: 'Show MTU', key: 'showMtu' },
            { label: 'Show IPv6', key: 'showIpv6' },
          ],
        },
      ],
    },
  ],
};
