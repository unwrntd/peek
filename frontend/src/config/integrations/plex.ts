import { IntegrationConfig } from './types';

export const plexConfig: IntegrationConfig = {
  type: 'plex',
  displayName: 'Plex Media Server',
  category: 'media-servers',
  description: 'Media server and streaming platform',
  documentationUrl: 'https://www.plex.tv/claim/',
  dependencies: {
    apis: ['Plex Media Server API'],
    notes: 'Requires X-Plex-Token for authentication',
  },
  sampleName: 'My Plex Server',
  defaultPort: 32400,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'api',
    commonFields: [],
    methods: [
      {
        method: 'api',
        label: 'API Token',
        fields: [
          {
            key: 'token',  // CRITICAL: Must match PlexConfig.token in backend
            label: 'X-Plex-Token',
            type: 'password',
            placeholder: 'Your Plex authentication token',
            required: true,
            helpText: 'Find your token at plex.tv/claim or in Plex Web (XML source)',
          },
        ],
      },
    ],
    helpText: 'Enter your Plex authentication token. You can find this in the XML source of any Plex Web page (look for X-Plex-Token) or get a new one at plex.tv/claim.',
  },

  widgets: [
    {
      type: 'plex-server-status',
      name: 'Server Status',
      description: 'Plex server name, version, and online status',
      metric: 'server-info',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Status Cards (Default)' },
        { value: 'compact', label: 'Compact List' },
        { value: 'metrics', label: 'Large Metrics' },
      ],
      filters: [
        {
          label: 'Elements to Display',
          key: 'displayElements',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Server Name', key: 'showName' },
            { label: 'Version', key: 'showVersion' },
            { label: 'Platform', key: 'showPlatform' },
            { label: 'Active Streams', key: 'showStreams' },
            { label: 'Plex User', key: 'showUser' },
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
      type: 'plex-library-stats',
      name: 'Library Statistics',
      description: 'Media library counts by type',
      metric: 'libraries',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'bars', label: 'Horizontal Bars (Default)' },
        { value: 'donut', label: 'Donut Chart' },
        { value: 'numbers', label: 'Large Numbers' },
      ],
      filters: [
        {
          label: 'Library Types',
          key: 'libraryTypes',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Movies', key: 'showMovies' },
            { label: 'TV Shows', key: 'showShows' },
            { label: 'Music', key: 'showMusic' },
            { label: 'Photos', key: 'showPhotos' },
          ],
        },
        {
          label: 'Show Individual Libraries',
          key: 'showLibraries',
          type: 'checkbox',
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'plex-now-playing',
      name: 'Now Playing',
      description: 'Currently active streaming sessions',
      metric: 'sessions',
      defaultSize: { w: 5, h: 4 },
      minSize: { w: 4, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'cards', label: 'Session Cards (Default)' },
        { value: 'list', label: 'Compact List' },
        { value: 'posters', label: 'Poster Grid' },
      ],
      filters: [
        {
          label: 'Session Details',
          key: 'details',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Progress Bar', key: 'showProgress' },
            { label: 'User', key: 'showUser' },
            { label: 'Device', key: 'showDevice' },
            { label: 'Quality/Transcode', key: 'showQuality' },
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
      type: 'plex-recently-added',
      name: 'Recently Added',
      description: 'Recently added movies, shows, and music',
      metric: 'recently-added',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'posters', label: 'Poster Grid (Default)' },
        { value: 'list', label: 'Detailed List' },
        { value: 'cards', label: 'Media Cards' },
      ],
      filters: [
        {
          label: 'Media Type',
          key: 'mediaType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'episode', label: 'TV' },
            { value: 'track', label: 'Music' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '10',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Year', key: 'showYear' },
            { label: 'Content Rating', key: 'showRating' },
            { label: 'Duration', key: 'showDuration' },
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
      type: 'plex-transcoding',
      name: 'Transcoding Status',
      description: 'Active transcoding sessions and load',
      metric: 'transcode-sessions',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Session List (Default)' },
        { value: 'compact', label: 'Compact Summary' },
        { value: 'gauges', label: 'Progress Gauges' },
      ],
      filters: [
        {
          label: 'Show Details',
          key: 'details',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Progress', key: 'showProgress' },
            { label: 'Speed', key: 'showSpeed' },
            { label: 'Video Decision', key: 'showVideoDecision' },
            { label: 'Audio Decision', key: 'showAudioDecision' },
            { label: 'Hardware Acceleration', key: 'showHwAccel' },
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
