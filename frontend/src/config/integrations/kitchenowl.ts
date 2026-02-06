import { IntegrationConfig } from './types';

export const kitchenowlConfig: IntegrationConfig = {
  type: 'kitchenowl',
  displayName: 'KitchenOwl',
  category: 'utilities',
  description: 'Self-hosted grocery list and recipe manager',
  documentationUrl: 'https://docs.kitchenowl.org/',
  dependencies: {
    apis: ['KitchenOwl REST API'],
    notes: 'Requires KitchenOwl server with user credentials.',
  },
  sampleName: 'My KitchenOwl',
  defaultPort: 443,
  sampleHost: 'kitchenowl.local',

  auth: {
    defaultMethod: 'basic',
    commonFields: [],
    methods: [
      {
        method: 'basic',
        label: 'Username & Password',
        fields: [
          {
            key: 'username',
            label: 'Username',
            type: 'text',
            required: true,
            helpText: 'Your KitchenOwl username',
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true,
            helpText: 'Your KitchenOwl password',
          },
          {
            key: 'householdId',
            label: 'Household ID',
            type: 'number',
            placeholder: '1',
            required: false,
            helpText: 'Household ID (default: 1)',
          },
        ],
      },
    ],
    helpText: 'Enter your KitchenOwl credentials. Find household ID in app settings.',
  },

  widgets: [
    {
      type: 'kitchenowl-shopping-list',
      name: 'Shopping List',
      description: 'Shopping lists and items',
      metric: 'shopping-list',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Item List (Default)' },
        { value: 'compact', label: 'Compact View' },
        { value: 'summary', label: 'Summary Only' },
      ],
      filters: [
        {
          label: 'Show',
          key: 'filter',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'done', label: 'Done' },
          ],
        },
      ],
    },
    {
      type: 'kitchenowl-recipes',
      name: 'Recipes',
      description: 'Recipe collection',
      metric: 'recipes',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'grid', label: 'Recipe Grid (Default)' },
        { value: 'list', label: 'Recipe List' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Max Recipes',
          key: 'maxItems',
          type: 'number',
          placeholder: '12',
        },
      ],
    },
    {
      type: 'kitchenowl-meal-plan',
      name: 'Meal Plan',
      description: 'Meal planning schedule',
      metric: 'meal-plan',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'calendar', label: 'Calendar View (Default)' },
        { value: 'list', label: 'List View' },
        { value: 'today', label: 'Today Only' },
      ],
    },
    {
      type: 'kitchenowl-expenses',
      name: 'Expenses',
      description: 'Expense tracking',
      metric: 'expenses',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Expense List (Default)' },
        { value: 'summary', label: 'Summary View' },
        { value: 'by-category', label: 'By Category' },
      ],
      filters: [
        {
          label: 'Max Expenses',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
      ],
    },
    {
      type: 'kitchenowl-household',
      name: 'Household',
      description: 'Household overview and statistics',
      metric: 'household',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'stats', label: 'Statistics (Default)' },
        { value: 'members', label: 'Members View' },
      ],
    },
  ],
};
