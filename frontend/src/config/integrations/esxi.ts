import { IntegrationConfig } from './types';

export const esxiConfig: IntegrationConfig = {
  type: 'esxi',
  displayName: 'VMware ESXi',
  category: 'infrastructure',
  description: 'VMware ESXi hypervisor monitoring and VM management',
  documentationUrl: 'https://developer.broadcom.com/xapis/vsphere-automation-api/latest/',
  dependencies: {
    apis: ['vSphere Automation REST API'],
    notes: 'Requires ESXi 7.0+ for full REST API support. Some features may require vCenter.',
  },
  sampleName: 'My ESXi Host',
  defaultPort: 443,
  sampleHost: 'esxi.local',

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
            placeholder: 'root',
            required: true,
            helpText: 'ESXi host username (typically root)',
          },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true,
            helpText: 'ESXi host password',
          },
        ],
      },
    ],
    helpText: 'Enter credentials for ESXi host. SSH access is not required.',
  },

  widgets: [
    {
      type: 'esxi-vm-list',
      name: 'Virtual Machines',
      description: 'List and status of virtual machines',
      metric: 'vms',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'VM List (Default)' },
        { value: 'cards', label: 'VM Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Power State',
          key: 'powerState',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'POWERED_ON', label: 'On' },
            { value: 'POWERED_OFF', label: 'Off' },
          ],
        },
      ],
    },
    {
      type: 'esxi-host-status',
      name: 'Host Status',
      description: 'ESXi host status and information',
      metric: 'host-status',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'card', label: 'Status Card (Default)' },
        { value: 'detailed', label: 'Detailed View' },
      ],
    },
    {
      type: 'esxi-datastores',
      name: 'Datastores',
      description: 'Storage datastores and capacity',
      metric: 'datastores',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Datastore List (Default)' },
        { value: 'bars', label: 'Usage Bars' },
        { value: 'summary', label: 'Summary Only' },
      ],
    },
    {
      type: 'esxi-networks',
      name: 'Networks',
      description: 'Virtual networks and port groups',
      metric: 'networks',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Network List (Default)' },
        { value: 'compact', label: 'Compact View' },
      ],
    },
    {
      type: 'esxi-resource-usage',
      name: 'Resource Usage',
      description: 'Overall resource allocation and usage',
      metric: 'resource-usage',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'overview', label: 'Overview (Default)' },
        { value: 'detailed', label: 'Detailed Breakdown' },
      ],
    },
  ],
};
