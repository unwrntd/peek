import { IntegrationConfig } from './types';

export const beszelConfig: IntegrationConfig = {
  type: 'beszel',
  displayName: 'Beszel',
  category: 'monitoring',
  description: 'Lightweight server monitoring with Docker support',
  documentationUrl: 'https://github.com/henrygd/beszel',
  dependencies: {
    apis: ['Beszel API'],
    notes: 'Uses PocketBase authentication',
  },
  sampleName: 'My Beszel Instance',
  defaultPort: 8090,
  sampleHost: '192.168.1.100',

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
            placeholder: 'admin@example.com',
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
      type: 'system-stats',
      name: 'System Stats',
      description: 'CPU, Memory, Disk, and Network usage',
      metric: 'system-stats',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'bars', label: 'Progress Bars (Default)' },
        { value: 'gauges', label: 'Circular Gauges' },
        { value: 'text', label: 'Text Only' },
      ],
      filters: [
        // Data Selection (ungrouped - always visible)
        {
          label: 'Systems',
          key: 'selectedHosts',
          type: 'beszel-host-select',
        },
        {
          label: 'Host Order',
          key: 'hostOrder',
          type: 'beszel-host-order',
        },
        {
          label: 'Metrics to Display',
          key: 'metrics',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'CPU Usage', key: 'showCpu' },
            { label: 'Memory Usage', key: 'showMemory' },
            { label: 'Disk Usage', key: 'showDisk' },
            { label: 'Network I/O', key: 'showNetwork' },
            { label: 'Temperatures', key: 'showTemps' },
          ],
        },
        // Temperature group (collapsed by default)
        {
          label: 'Temperature Sensors',
          key: 'selectedTemps',
          type: 'beszel-temp-select',
          group: 'Temperature Settings',
          groupCollapsedByDefault: true,
        },
        {
          label: 'Warning (°C)',
          key: 'tempWarningThreshold',
          type: 'number',
          placeholder: '60 (default)',
          group: 'Temperature Settings',
        },
        {
          label: 'Critical (°C)',
          key: 'tempCriticalThreshold',
          type: 'number',
          placeholder: '80 (default)',
          group: 'Temperature Settings',
        },
        // Appearance group (collapsed by default)
        {
          label: 'Show Totals',
          key: 'totals',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Total CPUs', key: 'showTotalCpus' },
            { label: 'Total RAM', key: 'showTotalRam' },
            { label: 'Total Disk', key: 'showTotalDisk' },
            { label: 'Max Temp', key: 'showMaxTemp' },
          ],
          group: 'Appearance',
          groupCollapsedByDefault: true,
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Hostname', key: 'showHostname' },
            { label: 'Show Border', key: 'showBorder' },
          ],
          group: 'Appearance',
        },
        {
          label: 'Host Icons',
          key: 'hostIcons',
          type: 'beszel-host-icons',
          group: 'Appearance',
        },
        {
          label: 'Compact View',
          key: 'compactView',
          type: 'checkbox',
          group: 'Appearance',
        },
        // Thresholds group (collapsed by default)
        {
          label: 'Warning (%)',
          key: 'warningThreshold',
          type: 'number',
          placeholder: '75 (default)',
          group: 'Usage Thresholds',
          groupCollapsedByDefault: true,
        },
        {
          label: 'Critical (%)',
          key: 'criticalThreshold',
          type: 'number',
          placeholder: '90 (default)',
          group: 'Usage Thresholds',
        },
      ],
    },
    {
      type: 'system-list',
      name: 'System List',
      description: 'List of monitored systems with status',
      metric: 'systems',
      defaultSize: { w: 5, h: 4 },
      minSize: { w: 4, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Table View (Default)' },
        { value: 'cards', label: 'System Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'e.g. server*, prod*, host1,host2',
        },
        {
          label: 'Status Filter',
          key: 'statusFilter',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Up', key: 'showUp' },
            { label: 'Down', key: 'showDown' },
            { label: 'Paused', key: 'showPaused' },
            { label: 'Pending', key: 'showPending' },
          ],
        },
        {
          label: 'Columns to Display',
          key: 'columns',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Host', key: 'showHost' },
            { label: 'Uptime', key: 'showUptime' },
            { label: 'OS Info', key: 'showInfo' },
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
      type: 'container-stats',
      name: 'Container Stats',
      description: 'Docker container resource usage',
      metric: 'container-stats',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'table', label: 'Table View (Default)' },
        { value: 'cards', label: 'Container Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search Containers',
          key: 'search',
          type: 'text',
          placeholder: 'e.g. nginx*, web*, app1,app2',
        },
        {
          label: 'System Filter',
          key: 'systemFilter',
          type: 'text',
          placeholder: 'Filter by system name',
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '50',
        },
        {
          label: 'Columns to Display',
          key: 'columns',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'System', key: 'showSystem' },
            { label: 'CPU', key: 'showCpu' },
            { label: 'Memory', key: 'showMemory' },
            { label: 'Network', key: 'showNetwork' },
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
      type: 'alerts',
      name: 'Alerts List',
      description: 'Active and configured alerts',
      metric: 'alerts',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Alert List (Default)' },
        { value: 'cards', label: 'Alert Cards' },
        { value: 'compact', label: 'Compact List' },
      ],
      filters: [
        {
          label: 'Search',
          key: 'search',
          type: 'text',
          placeholder: 'e.g. cpu*, memory*, alert1,alert2',
        },
        {
          label: 'System Filter',
          key: 'systemFilter',
          type: 'text',
          placeholder: 'Filter by system name',
        },
        {
          label: 'Max Items',
          key: 'maxItems',
          type: 'number',
          placeholder: '20',
        },
        {
          label: 'Show Triggered Only',
          key: 'showTriggeredOnly',
          type: 'checkbox',
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
