import { IntegrationConfig } from './types';

export const plantitConfig: IntegrationConfig = {
  type: 'plantit',
  displayName: 'Plant-it',
  category: 'smart-home',
  description: 'Self-hosted plant care companion for tracking plants, reminders, and care events',
  documentationUrl: 'https://docs.plant-it.org/',
  dependencies: {
    apis: ['Plant-it REST API'],
    notes: 'Requires API key or username/password authentication. API typically runs on port 8080.',
  },
  sampleName: 'My Garden',
  defaultPort: 8080,
  sampleHost: 'plantit.example.com',

  auth: {
    defaultMethod: 'token',
    commonFields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        placeholder: '192.168.1.100',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        placeholder: '8080',
        required: true,
      },
    ],
    methods: [
      {
        method: 'token',
        label: 'API Key',
        fields: [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'Your API key',
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
    helpText: 'Generate an API key via POST /api/api-key after logging in, or use username/password.',
  },

  widgets: [
    {
      type: 'plantit-stats',
      name: 'Statistics',
      description: 'Plant collection statistics overview',
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
    },
    {
      type: 'plantit-plants',
      name: 'Plant Collection',
      description: 'View your plant collection with photos',
      metric: 'plants',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Photo Grid (Default)' },
        { value: 'list', label: 'Plant List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'Filter by name',
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
            { label: 'Show Species', key: 'showSpecies' },
            { label: 'Show Location', key: 'showLocation' },
            { label: 'Show Last Watered', key: 'showLastWatered' },
          ],
        },
      ],
    },
    {
      type: 'plantit-events',
      name: 'Recent Events',
      description: 'Recent care activities and events',
      metric: 'events',
      defaultSize: { w: 2, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'timeline', label: 'Timeline (Default)' },
        { value: 'list', label: 'Event List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Event Type',
          key: 'eventType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'WATERING', label: 'Watering' },
            { value: 'FERTILIZING', label: 'Fertilizing' },
            { value: 'PRUNING', label: 'Pruning' },
            { value: 'TRANSPLANTING', label: 'Repotting' },
          ],
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
            { label: 'Show Plant Name', key: 'showPlantName' },
            { label: 'Show Notes', key: 'showNotes' },
            { label: 'Show Date', key: 'showDate' },
          ],
        },
      ],
    },
    {
      type: 'plantit-reminders',
      name: 'Care Reminders',
      description: 'Upcoming and overdue care reminders',
      metric: 'reminders',
      defaultSize: { w: 2, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Reminder List (Default)' },
        { value: 'calendar', label: 'Calendar View' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Status',
          key: 'status',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'upcoming', label: 'Upcoming' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Plant Name', key: 'showPlantName' },
            { label: 'Show Frequency', key: 'showFrequency' },
            { label: 'Show Due Date', key: 'showDueDate' },
          ],
        },
      ],
    },
    {
      type: 'plantit-plant-detail',
      name: 'Plant Detail',
      description: 'Detailed view of a single plant',
      metric: 'plant-detail',
      defaultSize: { w: 2, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'card', label: 'Detail Card (Default)' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Plant ID',
          key: 'plantId',
          type: 'number',
          placeholder: 'Enter plant ID',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Recent Events', key: 'showEvents' },
            { label: 'Show Reminders', key: 'showReminders' },
            { label: 'Show Species Info', key: 'showSpecies' },
          ],
        },
      ],
    },
  ],
};
