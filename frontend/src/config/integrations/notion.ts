import { IntegrationConfig } from './types';

export const notionConfig: IntegrationConfig = {
  type: 'notion',
  displayName: 'Notion',
  category: 'utilities',
  description: 'Notion workspace, databases, and pages',
  documentationUrl: 'https://developers.notion.com',
  dependencies: {
    apis: ['Notion API'],
    notes: 'Create an internal integration at notion.so/my-integrations. Share pages/databases with your integration to access them.',
  },
  sampleName: 'My Notion Workspace',
  defaultPort: 443,
  sampleHost: 'api.notion.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'Integration Token',
        fields: [
          {
            key: 'token',
            label: 'Internal Integration Token',
            type: 'password',
            placeholder: 'secret_...',
            required: true,
            helpText: 'Create at notion.so/my-integrations. Share pages/databases with your integration to access them.',
          },
        ],
      },
    ],
    helpText: 'Create an internal integration at notion.so/my-integrations.',
  },

  widgets: [
    {
      type: 'notion-workspace',
      name: 'Workspace',
      description: 'Workspace info and quick stats',
      metric: 'workspace',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'card', label: 'Summary Card (Default)' },
        { value: 'stats', label: 'Statistics' },
      ],
    },
    {
      type: 'notion-databases',
      name: 'Databases',
      description: 'List of accessible databases',
      metric: 'databases',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Database List (Default)' },
        { value: 'cards', label: 'Database Cards' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter databases...',
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'notion-database-view',
      name: 'Database View',
      description: 'View items from a specific database',
      metric: 'database-items',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Table View (Default)' },
        { value: 'list', label: 'List View' },
        { value: 'board', label: 'Board View' },
      ],
      filters: [
        {
          label: 'Database ID',
          key: 'databaseId',
          type: 'text',
          placeholder: 'Paste database ID from Notion URL',
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '25',
        },
      ],
    },
    {
      type: 'notion-task-list',
      name: 'Task List',
      description: 'Tasks from a database with checkbox/status property',
      metric: 'database-items',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Task List (Default)' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Database ID',
          key: 'databaseId',
          type: 'text',
          placeholder: 'Paste database ID from Notion URL',
        },
        {
          label: 'Status Property',
          key: 'statusProperty',
          type: 'text',
          placeholder: 'Status or Done',
        },
        {
          label: 'Show',
          key: 'showCompleted',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'incomplete', label: 'Incomplete' },
            { value: 'complete', label: 'Complete' },
          ],
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
      ],
    },
    {
      type: 'notion-recent',
      name: 'Recent Pages',
      description: 'Recently edited pages across workspace',
      metric: 'recent',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Page List (Default)' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
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
