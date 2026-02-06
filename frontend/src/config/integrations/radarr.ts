import { IntegrationConfig } from './types';

export const radarrConfig: IntegrationConfig = {
  type: 'radarr',
  displayName: 'Radarr',
  category: 'media-management',
  description: 'Movie automation and management',
  documentationUrl: 'https://wiki.servarr.com/radarr',
  dependencies: {
    apis: ['Radarr API v3'],
  },
  sampleName: 'My Radarr',
  defaultPort: 7878,
  sampleHost: '192.168.1.100',

  auth: {
    defaultMethod: 'api',
    commonFields: [],
    methods: [
      {
        method: 'api',
        label: 'API Key',
        fields: [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'Your Radarr API key',
            required: true,
            helpText: 'Find your API key in Radarr Settings > General > Security',
          },
        ],
      },
    ],
    helpText: 'Enter your Radarr API key. You can find this in Radarr Settings > General > Security.',
  },

  widgets: [
    {
      type: 'radarr-movies',
      name: 'Movie Library',
      description: 'All movies with file info and status',
      metric: 'movies',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'posters', label: 'Poster Grid (Default)' },
        { value: 'list', label: 'Detailed List' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'statusFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'released', label: 'Released' },
            { value: 'inCinemas', label: 'In Cinemas' },
            { value: 'announced', label: 'Announced' },
          ],
        },
        {
          label: 'File Status',
          key: 'fileFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'hasFile', label: 'Downloaded' },
            { value: 'missing', label: 'Missing' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Poster', key: 'showPoster' },
            { label: 'Show Studio', key: 'showStudio' },
            { label: 'Show Runtime', key: 'showRuntime' },
            { label: 'Show Quality', key: 'showQuality' },
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
      type: 'radarr-calendar',
      name: 'Calendar',
      description: 'Upcoming and recent movie releases',
      metric: 'calendar',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Movie List (Default)' },
        { value: 'calendar', label: 'Calendar View' },
        { value: 'cards', label: 'Movie Cards' },
      ],
      filters: [
        {
          label: 'Show',
          key: 'timeFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'recent', label: 'Recent' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Poster', key: 'showPoster' },
            { label: 'Show Overview', key: 'showOverview' },
            { label: 'Show Studio', key: 'showStudio' },
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
      type: 'radarr-queue',
      name: 'Download Queue',
      description: 'Active movie downloads with progress',
      metric: 'queue',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Detailed List (Default)' },
        { value: 'compact', label: 'Compact Summary' },
        { value: 'progress', label: 'Progress View' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Progress Bar', key: 'showProgressBar' },
            { label: 'Show Time Remaining', key: 'showTimeRemaining' },
            { label: 'Show Quality', key: 'showQuality' },
            { label: 'Show Download Client', key: 'showDownloadClient' },
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
      type: 'radarr-wanted',
      name: 'Wanted/Missing',
      description: 'Monitored movies without files',
      metric: 'wanted',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Movie List (Default)' },
        { value: 'compact', label: 'Compact List' },
        { value: 'posters', label: 'Poster Grid' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Poster', key: 'showPoster' },
            { label: 'Show Release Date', key: 'showReleaseDate' },
            { label: 'Show Overview', key: 'showOverview' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '10',
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
      ],
    },
    {
      type: 'radarr-history',
      name: 'Activity/History',
      description: 'Recent grabs, downloads, and activity',
      metric: 'history',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'List (Default)' },
        { value: 'timeline', label: 'Timeline' },
      ],
      filters: [
        {
          label: 'Event Type',
          key: 'eventTypeFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'grabbed', label: 'Grabbed' },
            { value: 'downloadFolderImported', label: 'Imported' },
            { value: 'downloadFailed', label: 'Failed' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Quality', key: 'showQuality' },
            { label: 'Show Date', key: 'showDate' },
          ],
        },
        {
          label: 'Items to Show',
          key: 'itemCount',
          type: 'number',
          placeholder: '10',
        },
      ],
    },
    {
      type: 'radarr-status',
      name: 'System Status',
      description: 'Server info, disk space, and health',
      metric: 'system-status',
      defaultSize: { w: 3, h: 3 },
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
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Version', key: 'showVersion' },
            { label: 'Show Disk Space', key: 'showDiskSpace' },
            { label: 'Show Health', key: 'showHealth' },
            { label: 'Show OS Info', key: 'showOsInfo' },
          ],
        },
      ],
    },
  ],
};
