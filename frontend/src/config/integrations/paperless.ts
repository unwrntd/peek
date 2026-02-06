import { IntegrationConfig } from './types';

export const paperlessConfig: IntegrationConfig = {
  type: 'paperless',
  displayName: 'Paperless-ngx',
  category: 'utilities',
  description: 'Document management system for scanning, indexing, and archiving paper documents',
  documentationUrl: 'https://docs.paperless-ngx.com/api/',
  dependencies: {
    apis: ['Paperless-ngx REST API'],
    notes: 'Requires API token or username/password authentication.',
  },
  sampleName: 'My Paperless',
  defaultPort: 8000,
  sampleHost: 'paperless.example.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        placeholder: 'paperless.example.com',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '8000',
        required: true,
      },
      {
        key: 'basePath',
        label: 'Base Path',
        type: 'text',
        placeholder: '/paperless (optional)',
        required: false,
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
            placeholder: 'Your API token',
            required: true,
          },
        ],
      },
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
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'Your password',
            required: true,
          },
        ],
      },
    ],
    helpText: 'Generate an API token in Paperless Settings > API, or use username/password.',
  },

  widgets: [
    {
      type: 'paperless-stats',
      name: 'Statistics',
      description: 'Document count and storage statistics',
      metric: 'statistics',
      defaultSize: { w: 2, h: 2 },
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
            { label: 'Show Document Count', key: 'showCount' },
            { label: 'Show Storage Usage', key: 'showStorage' },
          ],
        },
      ],
    },
    {
      type: 'paperless-recent',
      name: 'Recent Documents',
      description: 'Recently added documents',
      metric: 'documents',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Document List (Default)' },
        { value: 'cards', label: 'Document Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by title',
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Date', key: 'showDate' },
            { label: 'Show Tags', key: 'showTags' },
            { label: 'Show Correspondent', key: 'showCorrespondent' },
          ],
        },
      ],
    },
    {
      type: 'paperless-inbox',
      name: 'Inbox',
      description: 'Documents awaiting processing',
      metric: 'inbox',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Inbox List (Default)' },
        { value: 'cards', label: 'Document Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Date Added', key: 'showDate' },
            { label: 'Show Filename', key: 'showFilename' },
          ],
        },
      ],
    },
    {
      type: 'paperless-tags',
      name: 'Tags',
      description: 'Document tags overview',
      metric: 'tags',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cloud', label: 'Tag Cloud (Default)' },
        { value: 'list', label: 'Tag List' },
        { value: 'bars', label: 'Tag Bars' },
      ],
      filters: [
        {
          label: 'Max Tags',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Count', key: 'showCount' },
            { label: 'Show Color', key: 'showColor' },
          ],
        },
      ],
    },
    {
      type: 'paperless-correspondents',
      name: 'Correspondents',
      description: 'Document correspondents',
      metric: 'correspondents',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Correspondent List (Default)' },
        { value: 'bars', label: 'Correspondent Bars' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Document Count', key: 'showCount' },
          ],
        },
      ],
    },
    {
      type: 'paperless-document-types',
      name: 'Document Types',
      description: 'Document type distribution',
      metric: 'document-types',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'donut', label: 'Donut Chart (Default)' },
        { value: 'bars', label: 'Type Bars' },
        { value: 'list', label: 'Type List' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Document Count', key: 'showCount' },
            { label: 'Show Percentage', key: 'showPercentage' },
          ],
        },
      ],
    },
    {
      type: 'paperless-tasks',
      name: 'Background Tasks',
      description: 'Processing tasks status',
      metric: 'tasks',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Task List (Default)' },
        { value: 'progress', label: 'Progress View' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Task Status',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
          ],
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '10',
        },
      ],
    },
  ],
};
