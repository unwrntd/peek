import { IntegrationConfig } from './types';

export const googleWorkspaceConfig: IntegrationConfig = {
  type: 'google-workspace',
  displayName: 'Google Workspace',
  category: 'utilities',
  description: 'Gmail, Calendar, Drive, and Tasks from Google Workspace',
  documentationUrl: 'https://developers.google.com/workspace',
  dependencies: {
    apis: ['Gmail API', 'Calendar API', 'Drive API', 'Tasks API'],
    notes: 'Requires Google Cloud project with OAuth 2.0 credentials and enabled APIs.',
  },
  sampleName: 'My Google Workspace',
  defaultPort: 443,
  sampleHost: 'googleapis.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        placeholder: 'xxxxx.apps.googleusercontent.com',
        required: true,
        helpText: 'OAuth 2.0 Client ID from Google Cloud Console',
      },
    ],
    methods: [
      {
        method: 'token',
        label: 'OAuth 2.0',
        fields: [
          {
            key: 'clientSecret',
            label: 'Client Secret',
            type: 'password',
            required: true,
            helpText: 'OAuth 2.0 Client Secret from Google Cloud Console',
          },
          {
            key: 'refreshToken',
            label: 'Refresh Token',
            type: 'password',
            required: true,
            helpText: 'OAuth refresh token obtained during initial authorization flow',
          },
        ],
      },
    ],
    helpText: 'Create OAuth credentials at console.cloud.google.com. Enable Gmail, Calendar, Drive, and Tasks APIs.',
  },

  widgets: [
    {
      type: 'google-mail',
      name: 'Gmail',
      description: 'Inbox status and recent messages',
      metric: 'mail',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Message List (Default)' },
        { value: 'stats', label: 'Inbox Stats' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Show',
          key: 'filter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'unread', label: 'Unread' },
          ],
        },
        {
          label: 'Max Messages',
          key: 'maxItems',
          type: 'number',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'google-calendar',
      name: 'Calendar',
      description: "Today's events and upcoming meetings",
      metric: 'calendar',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'agenda', label: 'Agenda (Default)' },
        { value: 'today', label: 'Today Only' },
        { value: 'next-event', label: 'Next Event' },
        { value: 'stats', label: 'Calendar Stats' },
      ],
      filters: [
        {
          label: 'View',
          key: 'view',
          type: 'button-group',
          options: [
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Week' },
          ],
        },
      ],
    },
    {
      type: 'google-drive',
      name: 'Drive',
      description: 'Storage usage and recent files',
      metric: 'drive',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'files', label: 'Recent Files (Default)' },
        { value: 'storage', label: 'Storage Usage' },
        { value: 'combined', label: 'Combined View' },
      ],
      filters: [
        {
          label: 'Max Files',
          key: 'maxItems',
          type: 'number',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'google-tasks',
      name: 'Tasks',
      description: 'Task lists and to-dos',
      metric: 'tasks',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Task List (Default)' },
        { value: 'stats', label: 'Task Stats' },
        { value: 'by-list', label: 'By List' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'status',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'completed', label: 'Completed' },
          ],
        },
      ],
    },
  ],
};
