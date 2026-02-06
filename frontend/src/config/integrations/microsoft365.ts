import { IntegrationConfig } from './types';

export const microsoft365Config: IntegrationConfig = {
  type: 'microsoft365',
  displayName: 'Microsoft 365',
  category: 'utilities',
  description: 'Microsoft 365 productivity suite - mail, calendar, OneDrive, Teams, and tasks',
  documentationUrl: 'https://learn.microsoft.com/en-us/graph/overview',
  dependencies: {
    apis: ['Microsoft Graph API'],
    notes: 'Requires Azure AD app registration with Microsoft Graph API permissions. You need tenant ID, client ID, client secret, and a refresh token.',
  },
  sampleName: 'My Microsoft 365',
  defaultPort: 443,
  sampleHost: 'graph.microsoft.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'OAuth 2.0 (Refresh Token)',
        fields: [
          {
            key: 'tenantId',
            label: 'Tenant ID',
            type: 'text',
            placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            required: true,
            helpText: 'Your Azure AD tenant ID (Directory ID)',
          },
          {
            key: 'clientId',
            label: 'Client ID',
            type: 'text',
            placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            required: true,
            helpText: 'Application (client) ID from your Azure AD app registration',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            type: 'password',
            placeholder: 'Your client secret',
            required: true,
            helpText: 'Client secret from your Azure AD app registration',
          },
          {
            key: 'refreshToken',
            label: 'Refresh Token',
            type: 'password',
            placeholder: 'Your refresh token',
            required: true,
            helpText: 'OAuth refresh token obtained during initial authentication flow',
          },
        ],
      },
    ],
    helpText: 'Register an app in Azure AD with Microsoft Graph permissions: Mail.Read, Calendars.Read, Files.Read, Team.ReadBasic.All, Tasks.Read, User.Read, Presence.Read',
  },

  widgets: [
    {
      type: 'microsoft365-mail',
      name: 'Mail',
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
            { value: 'important', label: 'Important' },
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
      type: 'microsoft365-calendar',
      name: 'Calendar',
      description: 'Today\'s events and upcoming meetings',
      metric: 'calendar',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'agenda', label: 'Agenda (Default)' },
        { value: 'today', label: 'Today Only' },
        { value: 'next-meeting', label: 'Next Meeting' },
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
      type: 'microsoft365-onedrive',
      name: 'OneDrive',
      description: 'Storage usage and recent files',
      metric: 'onedrive',
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
      type: 'microsoft365-teams',
      name: 'Teams',
      description: 'Teams and channels overview',
      metric: 'teams',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Teams List (Default)' },
        { value: 'stats', label: 'Teams Stats' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Show Channels',
          key: 'showChannels',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'microsoft365-tasks',
      name: 'Tasks',
      description: 'To Do tasks and lists',
      metric: 'tasks',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Task List (Default)' },
        { value: 'stats', label: 'Task Stats' },
        { value: 'kanban', label: 'Kanban View' },
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
        {
          label: 'List',
          key: 'listId',
          type: 'text',
          placeholder: 'All lists',
        },
      ],
    },
    {
      type: 'microsoft365-profile',
      name: 'Profile',
      description: 'User profile and presence status',
      metric: 'profile',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'card', label: 'Profile Card (Default)' },
        { value: 'presence', label: 'Presence Only' },
        { value: 'detailed', label: 'Detailed View' },
      ],
    },
  ],
};
