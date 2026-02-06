import { IntegrationConfig } from './types';

export const slackConfig: IntegrationConfig = {
  type: 'slack',
  displayName: 'Slack',
  category: 'utilities',
  description: 'Slack workspace communication and team collaboration',
  documentationUrl: 'https://api.slack.com',
  dependencies: {
    apis: ['Slack Web API'],
    notes: 'Create a Slack app at api.slack.com/apps with bot token scopes for users:read, channels:read, chat:write, etc.',
  },
  sampleName: 'My Slack Workspace',
  defaultPort: 443,
  sampleHost: 'slack.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'Bot Token',
        fields: [
          {
            key: 'botToken',
            label: 'Bot User OAuth Token',
            type: 'password',
            placeholder: 'xoxb-...',
            required: true,
            helpText: 'Create a Slack app at api.slack.com/apps and install it to your workspace to get a bot token.',
          },
        ],
      },
    ],
    helpText: 'Create a Slack app with required scopes: users:read, channels:read, chat:write, team:read',
  },

  widgets: [
    {
      type: 'slack-workspace',
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
      type: 'slack-users',
      name: 'Users',
      description: 'List of workspace members and their presence',
      metric: 'users',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'User List (Default)' },
        { value: 'grid', label: 'User Grid' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter users...',
        },
        {
          label: 'Show',
          key: 'presence',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'away', label: 'Away' },
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
      type: 'slack-channels',
      name: 'Channels',
      description: 'List of workspace channels',
      metric: 'channels',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Channel List (Default)' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter channels...',
        },
        {
          label: 'Type',
          key: 'type',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'public', label: 'Public' },
            { value: 'private', label: 'Private' },
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
      type: 'slack-activity',
      name: 'Activity',
      description: 'Recent workspace activity metrics',
      metric: 'activity',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'stats', label: 'Activity Stats (Default)' },
        { value: 'chart', label: 'Activity Chart' },
      ],
    },
    {
      type: 'slack-presence',
      name: 'Team Presence',
      description: 'Overview of team availability',
      metric: 'presence',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'donut', label: 'Donut Chart (Default)' },
        { value: 'bar', label: 'Bar Chart' },
        { value: 'stats', label: 'Simple Stats' },
      ],
    },
  ],
};
