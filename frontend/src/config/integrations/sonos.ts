import { IntegrationConfig } from './types';

export const sonosConfig: IntegrationConfig = {
  type: 'sonos',
  displayName: 'Sonos',
  category: 'smart-home',
  description: 'Multi-room wireless speakers and home audio',
  documentationUrl: 'https://developer.sonos.com/',
  dependencies: {
    apis: ['Sonos Cloud API'],
    notes: 'Requires OAuth authorization with Sonos account',
  },
  sampleName: 'My Sonos System',
  defaultPort: 443,
  sampleHost: 'api.sonos.com',

  auth: {
    defaultMethod: 'api',
    commonFields: [],
    methods: [
      {
        method: 'api',
        label: 'OAuth Credentials',
        fields: [
          {
            key: 'clientId',
            label: 'Client ID',
            type: 'text',
            placeholder: 'Your Sonos Client ID',
            required: true,
            helpText: 'From Sonos Developer Portal (integration.sonos.com)',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            type: 'password',
            placeholder: 'Your Sonos Client Secret',
            required: true,
            helpText: 'From Sonos Developer Portal',
          },
          {
            key: 'redirectUri',
            label: 'Redirect URI',
            type: 'text',
            placeholder: 'http://localhost:3001/api/sonos-auth/callback',
            required: false,
            helpText: 'Must match the redirect URI registered in Sonos Developer Portal',
          },
          {
            key: 'refreshToken',
            label: 'Refresh Token',
            type: 'password',
            placeholder: 'Generated via OAuth',
            required: true,
            helpText: 'Click "Generate Token" to authorize with your Sonos account',
            specialType: 'token-generator',
            colSpan: 2,
          },
        ],
      },
    ],
    helpText: 'Register at integration.sonos.com and create an integration with "Control" scope. Set the Redirect URI to match your instance.',
  },

  widgets: [
    {
      type: 'sonos-now-playing',
      name: 'Now Playing',
      description: 'Current playback with controls',
      metric: 'now-playing',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'card', label: 'Media Card (Default)' },
        { value: 'compact', label: 'Compact View' },
        { value: 'minimal', label: 'Minimal' },
      ],
      filters: [
        {
          label: 'Group',
          key: 'selectedGroupId',
          type: 'text',
          placeholder: 'All groups (leave empty)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Album Art', key: 'showAlbumArt' },
            { label: 'Show Progress', key: 'showProgress' },
            { label: 'Show Controls', key: 'showControls' },
            { label: 'Show Volume', key: 'showVolume' },
          ],
        },
      ],
    },
    {
      type: 'sonos-groups',
      name: 'Speaker Groups',
      description: 'All speaker groups and status',
      metric: 'groups',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Group Cards (Default)' },
        { value: 'list', label: 'Group List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Player Count', key: 'showPlayerCount' },
            { label: 'Show Playback State', key: 'showPlaybackState' },
            { label: 'Show Quick Controls', key: 'showControls' },
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
      type: 'sonos-volume',
      name: 'Volume Control',
      description: 'Volume sliders for all groups',
      metric: 'volume',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'sliders', label: 'Volume Sliders (Default)' },
        { value: 'knobs', label: 'Volume Knobs' },
        { value: 'bars', label: 'Volume Bars' },
      ],
      filters: [
        {
          label: 'Group',
          key: 'selectedGroupId',
          type: 'text',
          placeholder: 'All groups (leave empty)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Group Name', key: 'showGroupName' },
            { label: 'Show Mute Button', key: 'showMuteButton' },
            { label: 'Show Volume Percentage', key: 'showPercentage' },
          ],
        },
      ],
    },
    {
      type: 'sonos-favorites',
      name: 'Favorites',
      description: 'Quick access to saved favorites',
      metric: 'favorites',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Cover Grid (Default)' },
        { value: 'list', label: 'Favorites List' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Target Group',
          key: 'targetGroupId',
          type: 'text',
          placeholder: 'Group to play on (leave empty)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Cover Art', key: 'showCoverArt' },
            { label: 'Show Service Icon', key: 'showServiceIcon' },
            { label: 'Show Description', key: 'showDescription' },
          ],
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'text',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'sonos-playlists',
      name: 'Playlists',
      description: 'Browse Sonos playlists',
      metric: 'playlists',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Playlist List (Default)' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Target Group',
          key: 'targetGroupId',
          type: 'text',
          placeholder: 'Group to play on (leave empty)',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Track Count', key: 'showTrackCount' },
            { label: 'Show Play Button', key: 'showPlayButton' },
          ],
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'text',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'sonos-players',
      name: 'Individual Players',
      description: 'All Sonos speakers and devices',
      metric: 'groups',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Player Cards (Default)' },
        { value: 'list', label: 'Player List' },
        { value: 'grid', label: 'Player Grid' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Group Assignment', key: 'showGroup' },
            { label: 'Show Model Info', key: 'showModel' },
            { label: 'Show Software Version', key: 'showVersion' },
          ],
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
  ],
};
