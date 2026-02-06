import { IntegrationConfig } from './types';

export const homeAssistantConfig: IntegrationConfig = {
  type: 'homeassistant',
  displayName: 'Home Assistant',
  category: 'smart-home',
  description: 'Open-source home automation platform',
  documentationUrl: 'https://www.home-assistant.io/integrations/api/',
  dependencies: {
    apis: ['Home Assistant REST API'],
    notes: 'Requires Long-Lived Access Token',
  },
  sampleName: 'My Home Assistant',
  defaultPort: 8123,
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
        placeholder: '8123',
        required: true,
      },
    ],
    methods: [
      {
        method: 'token',
        label: 'Access Token',
        fields: [
          {
            key: 'token',
            label: 'Long-Lived Access Token',
            type: 'password',
            placeholder: 'Your Home Assistant access token',
            required: true,
            colSpan: 2,
            helpText: 'Generate from your HA profile: Settings → People → [User] → Long-Lived Access Tokens',
          },
        ],
      },
    ],
  },

  widgets: [
    {
      type: 'homeassistant-status',
      name: 'System Status',
      description: 'Home Assistant version, location, and entity counts',
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
            { label: 'Show Location', key: 'showLocation' },
            { label: 'Show Timezone', key: 'showTimezone' },
            { label: 'Show Entity Count', key: 'showEntityCount' },
            { label: 'Show Components', key: 'showComponents' },
          ],
        },
      ],
    },
    {
      type: 'homeassistant-entities',
      name: 'Entities',
      description: 'All entities with current states',
      metric: 'entities',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Entity Cards (Default)' },
        { value: 'table', label: 'Entity Table' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Domain',
          key: 'domain',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'light', label: 'Lights' },
            { value: 'switch', label: 'Switches' },
            { value: 'sensor', label: 'Sensors' },
            { value: 'binary_sensor', label: 'Binary' },
            { value: 'climate', label: 'Climate' },
            { value: 'cover', label: 'Covers' },
          ],
        },
        {
          label: 'State Filter',
          key: 'stateFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
            { value: 'unavailable', label: 'Unavailable' },
          ],
        },
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by name or entity_id',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Entity ID', key: 'showEntityId' },
            { label: 'Show Last Changed', key: 'showLastChanged' },
            { label: 'Show Attributes', key: 'showAttributes' },
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
      type: 'homeassistant-entity-control',
      name: 'Entity Control',
      description: 'Control a single entity (light, switch, etc.)',
      metric: 'entities',
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
          label: 'Entity ID',
          key: 'entityId',
          type: 'text',
          placeholder: 'light.living_room',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Entity Name', key: 'showName' },
            { label: 'Show State', key: 'showState' },
            { label: 'Show Last Changed', key: 'showLastChanged' },
          ],
        },
      ],
    },
    {
      type: 'homeassistant-logbook',
      name: 'Logbook',
      description: 'Recent activity and state changes',
      metric: 'logbook',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Log List (Default)' },
        { value: 'timeline', label: 'Timeline' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Domain Filter',
          key: 'domain',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'light', label: 'Lights' },
            { value: 'switch', label: 'Switches' },
            { value: 'automation', label: 'Automations' },
            { value: 'scene', label: 'Scenes' },
          ],
        },
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by name or entity',
        },
        {
          label: 'Max Entries',
          key: 'maxItems',
          type: 'number',
          placeholder: '50',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Time', key: 'showTime' },
            { label: 'Show Entity ID', key: 'showEntityId' },
            { label: 'Show State', key: 'showState' },
          ],
        },
      ],
    },
  ],
};
