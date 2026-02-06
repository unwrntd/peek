import { IntegrationConfig } from './types';

export const ollamaConfig: IntegrationConfig = {
  type: 'ollama',
  displayName: 'Ollama',
  category: 'utilities',
  description: 'Local large language model runner',
  documentationUrl: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
  dependencies: {
    apis: ['Ollama REST API'],
    notes: 'Requires Ollama to be running locally or on a remote server',
  },
  sampleName: 'My Ollama',
  defaultPort: 11434,
  sampleHost: 'localhost',

  auth: {
    defaultMethod: 'api',
    commonFields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        placeholder: 'localhost',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '11434',
        required: true,
      },
    ],
    methods: [
      {
        method: 'api',
        label: 'No Authentication',
        fields: [],
      },
    ],
    helpText: 'Ollama typically runs without authentication. For remote access, consider using a reverse proxy with authentication.',
  },

  widgets: [
    {
      type: 'ollama-status',
      name: 'Server Status',
      description: 'Ollama server status and version',
      metric: 'status',
      defaultSize: { w: 2, h: 2 },
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
            { label: 'Show Version', key: 'showVersion' },
            { label: 'Show Model Count', key: 'showModelCount' },
          ],
        },
      ],
    },
    {
      type: 'ollama-models',
      name: 'Model List',
      description: 'All locally available models',
      metric: 'models',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Table View (Default)' },
        { value: 'cards', label: 'Model Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter models by name',
        },
        {
          label: 'Sort By',
          key: 'sortBy',
          type: 'button-group',
          options: [
            { value: 'name', label: 'Name' },
            { value: 'size', label: 'Size' },
            { value: 'modified', label: 'Modified' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Size', key: 'showSize' },
            { label: 'Show Modified Date', key: 'showModified' },
            { label: 'Show Family', key: 'showFamily' },
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
      type: 'ollama-running',
      name: 'Running Models',
      description: 'Currently loaded models with VRAM usage',
      metric: 'running',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Model Cards (Default)' },
        { value: 'list', label: 'Model List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show VRAM Usage', key: 'showVram' },
            { label: 'Show Expiry Time', key: 'showExpiry' },
            { label: 'Show Size', key: 'showSize' },
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
      type: 'ollama-storage',
      name: 'Storage Usage',
      description: 'Total storage used by models',
      metric: 'storage',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'gauge', label: 'Circular Gauge (Default)' },
        { value: 'bar', label: 'Progress Bar' },
        { value: 'number', label: 'Large Number' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Model Count', key: 'showModelCount' },
            { label: 'Show Breakdown', key: 'showBreakdown' },
          ],
        },
      ],
    },
  ],
};
