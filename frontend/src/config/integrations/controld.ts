import { IntegrationConfig } from './types';

export const controldConfig: IntegrationConfig = {
  type: 'controld',
  displayName: 'ControlD',
  category: 'networking',
  description: 'ControlD DNS filtering and privacy service management',
  documentationUrl: 'https://docs.controld.com/docs/org-api',
  dependencies: {
    apis: ['ControlD API'],
    notes: 'Requires API token from ControlD Dashboard. Read-only recommended for monitoring.',
  },
  sampleName: 'My ControlD',
  defaultPort: 443,
  sampleHost: 'api.controld.com',

  auth: {
    defaultMethod: 'token',
    // Cloud-only service - no host/port configuration needed
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'API Token',
        fields: [
          {
            key: 'apiToken',
            label: 'API Token',
            type: 'password',
            placeholder: 'Your ControlD API token',
            required: true,
            helpText: 'Generate in ControlD Dashboard > API section. Read-only recommended for monitoring.',
          },
        ],
      },
    ],
    helpText: 'Generate an API token in your ControlD Dashboard under the API section.',
  },

  widgets: [
    {
      type: 'controld-overview',
      name: 'Overview',
      description: 'Account summary with device and profile counts',
      metric: 'overview',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'card', label: 'Summary Card (Default)' },
        { value: 'stats', label: 'Statistics Grid' },
      ],
    },
    {
      type: 'controld-devices',
      name: 'Devices',
      description: 'DNS endpoints with status and assigned profiles',
      metric: 'devices',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Device Table (Default)' },
        { value: 'cards', label: 'Device Cards' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'status',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: '1', label: 'Active' },
            { value: '0', label: 'Pending' },
            { value: '2', label: 'Disabled' },
          ],
        },
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by name',
        },
      ],
    },
    {
      type: 'controld-profiles',
      name: 'Profiles',
      description: 'DNS profiles with filter and rule counts',
      metric: 'profiles',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Profile Table (Default)' },
        { value: 'cards', label: 'Profile Cards' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by name',
        },
      ],
    },
    {
      type: 'controld-filters',
      name: 'Filters',
      description: 'Available DNS filter lists',
      metric: 'filters',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Filter Table (Default)' },
        { value: 'cards', label: 'Filter Cards' },
      ],
      filters: [
        {
          label: 'Type',
          key: 'type',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'native', label: 'Native' },
            { value: 'thirdparty', label: '3rd Party' },
          ],
        },
        {
          label: 'Category',
          key: 'category',
          type: 'text',
          placeholder: 'Filter by category',
        },
      ],
    },
    {
      type: 'controld-services',
      name: 'Services',
      description: 'Available services for blocking/redirecting',
      metric: 'services',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Service Grid (Default)' },
        { value: 'table', label: 'Service Table' },
        { value: 'byCategory', label: 'By Category' },
      ],
      filters: [
        {
          label: 'Category',
          key: 'category',
          type: 'text',
          placeholder: 'Filter by category',
        },
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Search services',
        },
      ],
    },
    {
      type: 'controld-rules',
      name: 'Custom Rules',
      description: 'Custom DNS rules for profiles',
      metric: 'rules',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Rules Table (Default)' },
        { value: 'byProfile', label: 'By Profile' },
      ],
      filters: [
        {
          label: 'Action',
          key: 'action',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: '0', label: 'Bypass' },
            { value: '1', label: 'Block' },
            { value: '2', label: 'Redirect' },
            { value: '3', label: 'Spoof' },
          ],
        },
      ],
    },
    {
      type: 'controld-ips',
      name: 'Known IPs',
      description: 'Authorized IP addresses',
      metric: 'known-ips',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'IP Table (Default)' },
        { value: 'cards', label: 'IP Cards' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by IP or location',
        },
      ],
    },
    {
      type: 'controld-proxies',
      name: 'Proxy Locations',
      description: 'Available proxy endpoints for redirects',
      metric: 'proxies',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Location Table (Default)' },
        { value: 'byCountry', label: 'By Country' },
        { value: 'map', label: 'Map View' },
      ],
      filters: [
        {
          label: 'Country',
          key: 'country',
          type: 'text',
          placeholder: 'Filter by country',
        },
      ],
    },
  ],
};
