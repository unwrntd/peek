import { IntegrationConfig } from './types';

export const discordConfig: IntegrationConfig = {
  type: 'discord',
  displayName: 'Discord',
  category: 'utilities',
  description: 'Discord server monitoring and activity tracking',
  documentationUrl: 'https://discord.com/developers/docs',
  dependencies: {
    apis: ['Discord API v10'],
    notes: 'Create a bot at discord.com/developers/applications. Add bot to server with required permissions.',
  },
  sampleName: 'My Discord Server',
  defaultPort: 443,
  sampleHost: 'discord.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [],
    methods: [
      {
        method: 'token',
        label: 'Bot Token',
        fields: [
          {
            key: 'token',
            label: 'Bot Token',
            type: 'password',
            placeholder: 'Your Discord bot token',
            required: true,
            colSpan: 2,
            helpText: 'Create a bot at discord.com/developers/applications. Copy token from Bot tab.',
          },
          {
            key: 'guildId',
            label: 'Server ID (optional)',
            type: 'text',
            placeholder: '123456789012345678',
            required: false,
            helpText: 'Default server to monitor. Enable Developer Mode in Discord settings to copy IDs.',
          },
        ],
      },
    ],
    helpText: 'Enable privileged intents (Members, Presence) in bot settings for full functionality.',
  },

  widgets: [
    {
      type: 'discord-server',
      name: 'Server',
      description: 'Server info and quick stats',
      metric: 'server',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'card', label: 'Server Card (Default)' },
        { value: 'compact', label: 'Compact' },
      ],
      filters: [
        {
          label: 'Server ID',
          key: 'guildId',
          type: 'text',
          placeholder: 'Override default server ID',
        },
      ],
    },
    {
      type: 'discord-members',
      name: 'Members',
      description: 'Server members list',
      metric: 'members',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Member List (Default)' },
        { value: 'grid', label: 'Member Grid' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Server ID',
          key: 'guildId',
          type: 'text',
          placeholder: 'Override default server ID',
        },
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by name...',
        },
        {
          label: 'Max Members',
          key: 'maxItems',
          type: 'number',
          placeholder: '50',
        },
      ],
    },
    {
      type: 'discord-channels',
      name: 'Channels',
      description: 'List of server channels',
      metric: 'channels',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Channel List (Default)' },
        { value: 'grouped', label: 'Grouped by Category' },
      ],
      filters: [
        {
          label: 'Server ID',
          key: 'guildId',
          type: 'text',
          placeholder: 'Override default server ID',
        },
        {
          label: 'Channel Type',
          key: 'channelType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'text', label: 'Text' },
            { value: 'voice', label: 'Voice' },
            { value: 'forum', label: 'Forum' },
          ],
        },
      ],
    },
    {
      type: 'discord-activity',
      name: 'Activity',
      description: 'Recent messages from channels',
      metric: 'activity',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'feed', label: 'Message Feed (Default)' },
        { value: 'compact', label: 'Compact Feed' },
      ],
      filters: [
        {
          label: 'Server ID',
          key: 'guildId',
          type: 'text',
          placeholder: 'Override default server ID',
        },
        {
          label: 'Max Messages',
          key: 'maxItems',
          type: 'number',
          placeholder: '25',
        },
      ],
    },
    {
      type: 'discord-voice',
      name: 'Voice',
      description: 'Who is in voice channels',
      metric: 'voice',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Voice List (Default)' },
        { value: 'compact', label: 'Compact' },
      ],
      filters: [
        {
          label: 'Server ID',
          key: 'guildId',
          type: 'text',
          placeholder: 'Override default server ID',
        },
      ],
    },
  ],
};
