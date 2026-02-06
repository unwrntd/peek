import { IntegrationConfig } from './types';

export const sonarrConfig: IntegrationConfig = {
  type: 'sonarr',
  displayName: 'Sonarr',
  category: 'media-management',
  description: 'TV series automation and management',
  documentationUrl: 'https://wiki.servarr.com/sonarr',
  dependencies: {
    apis: ['Sonarr API v3'],
  },
  sampleName: 'My Sonarr',
  defaultPort: 8989,
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
            placeholder: 'Your Sonarr API key',
            required: true,
            helpText: 'Find your API key in Sonarr Settings > General > Security',
          },
        ],
      },
    ],
    helpText: 'Enter your Sonarr API key. You can find this in Sonarr Settings > General > Security.',
  },

  widgets: [
    {
      type: 'sonarr-series',
      name: 'Series Library',
      description: 'All TV series with episode counts and status',
      metric: 'series',
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
            { value: 'continuing', label: 'Continuing' },
            { value: 'ended', label: 'Ended' },
            { value: 'upcoming', label: 'Upcoming' },
          ],
        },
        {
          label: 'Monitored',
          key: 'monitoredFilter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'monitored', label: 'Monitored' },
            { value: 'unmonitored', label: 'Unmonitored' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Poster', key: 'showPoster' },
            { label: 'Show Network', key: 'showNetwork' },
            { label: 'Show Episode Count', key: 'showEpisodeCount' },
            { label: 'Show Progress Bar', key: 'showProgressBar' },
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
      type: 'sonarr-calendar',
      name: 'Calendar',
      description: 'Upcoming and recent episode air dates',
      metric: 'calendar',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Episode List (Default)' },
        { value: 'calendar', label: 'Calendar View' },
        { value: 'cards', label: 'Episode Cards' },
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
            { label: 'Show Air Time', key: 'showAirTime' },
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
      type: 'sonarr-queue',
      name: 'Download Queue',
      description: 'Active downloads with progress',
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
      type: 'sonarr-wanted',
      name: 'Wanted/Missing',
      description: 'Missing episodes without files',
      metric: 'wanted',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Episode List (Default)' },
        { value: 'compact', label: 'Compact List' },
        { value: 'cards', label: 'Episode Cards' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Poster', key: 'showPoster' },
            { label: 'Show Air Date', key: 'showAirDate' },
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
      type: 'sonarr-history',
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
            { label: 'Show Episode', key: 'showEpisode' },
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
      type: 'sonarr-status',
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
