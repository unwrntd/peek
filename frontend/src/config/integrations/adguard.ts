import { IntegrationConfig } from './types';

export const adguardConfig: IntegrationConfig = {
  type: 'adguard',
  displayName: 'AdGuard Home',
  category: 'networking',
  description: 'DNS-based ad blocking and privacy protection',
  documentationUrl: 'https://github.com/AdguardTeam/AdGuardHome/wiki/API',
  dependencies: {
    apis: ['AdGuard Home API'],
  },
  sampleName: 'My AdGuard Instance',
  defaultPort: 3000,
  sampleHost: '192.168.1.1',

  auth: {
    defaultMethod: 'basic',
    commonFields: [],
    methods: [
      {
        method: 'basic',
        label: 'Username/Password',
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
            required: true,
          },
        ],
      },
    ],
  },

  widgets: [
    {
      type: 'stats',
      name: 'Stats Overview',
      description: 'DNS queries, blocked count, and block rate',
      metric: 'stats',
      defaultSize: { w: 4, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'numbers', label: 'Numbers (Default)' },
        { value: 'gauge', label: 'Block Rate Gauge' },
        { value: 'donut', label: 'Blocked vs Allowed Donut' },
        { value: 'text', label: 'Text Only' },
      ],
      filters: [
        {
          label: 'Metrics to Display',
          key: 'displayElements',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Total Queries', key: 'showTotalQueries' },
            { label: 'Blocked Count', key: 'showBlocked' },
            { label: 'Block Rate', key: 'showBlockRate' },
            { label: 'Avg Response Time', key: 'showResponseTime' },
          ],
        },
      ],
    },
    {
      type: 'status',
      name: 'Protection Status',
      description: 'Protection status, version, and filter info',
      metric: 'status',
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
          label: 'Elements to Display',
          key: 'displayElements',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'DNS Port', key: 'showDnsPort' },
            { label: 'HTTP Port', key: 'showHttpPort' },
            { label: 'Active Rules', key: 'showRules' },
            { label: 'Filter Count', key: 'showFilterCount' },
            { label: 'Filter List', key: 'showFilters' },
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
      type: 'top-clients',
      name: 'Top Clients',
      description: 'Most active DNS clients',
      metric: 'stats',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'bars', label: 'Horizontal Bars (Default)' },
        { value: 'list', label: 'Client List' },
        { value: 'donut', label: 'Donut Chart' },
      ],
      filters: [
        {
          label: 'Max Items',
          key: 'limit',
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
      type: 'top-domains',
      name: 'Top Domains',
      description: 'Most queried and blocked domains',
      metric: 'stats',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'bars', label: 'Horizontal Bars (Default)' },
        { value: 'list', label: 'Domain List' },
        { value: 'donut', label: 'Donut Chart' },
      ],
      filters: [
        {
          label: 'Default Tab',
          key: 'defaultTab',
          type: 'select',
          options: [
            { value: 'blocked', label: 'Blocked Domains' },
            { value: 'queried', label: 'Queried Domains' },
          ],
        },
        {
          label: 'Max Items',
          key: 'limit',
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
      type: 'activity-heatmap',
      name: 'Activity Heatmap',
      description: 'DNS query patterns by hour and day of week',
      metric: 'query-log',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      supportsHideLabels: true,
      filters: [
        {
          label: 'Color Scheme',
          key: 'colorScheme',
          type: 'select',
          options: [
            { value: 'green', label: 'Green' },
            { value: 'blue', label: 'Blue' },
            { value: 'purple', label: 'Purple' },
            { value: 'orange', label: 'Orange' },
            { value: 'red', label: 'Red' },
          ],
        },
        {
          label: 'Show Only Blocked',
          key: 'showOnlyBlocked',
          type: 'checkbox',
        },
        {
          label: 'Show Values',
          key: 'showValues',
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
      type: 'query-log',
      name: 'Query Log',
      description: 'Recent DNS queries with status',
      metric: 'query-log',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Table (Default)' },
        { value: 'timeline', label: 'Timeline' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'e.g. google*, 192.168.*, domain1,domain2',
        },
        {
          label: 'Max Items',
          key: 'limit',
          type: 'number',
          placeholder: '50',
        },
        {
          label: 'Show Only Blocked',
          key: 'showOnlyBlocked',
          type: 'checkbox',
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
        },
        {
          label: 'Columns to Display',
          key: 'columns',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Time', key: 'showTime' },
            { label: 'Domain', key: 'showDomain' },
            { label: 'Type', key: 'showType' },
            { label: 'Client', key: 'showClient' },
            { label: 'Status', key: 'showStatus' },
            { label: 'Response', key: 'showResponse' },
          ],
        },
      ],
    },
  ],
};
