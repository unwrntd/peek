import { IntegrationConfig } from './types';

export const actualbudgetConfig: IntegrationConfig = {
  type: 'actualbudget',
  displayName: 'Actual Budget',
  category: 'utilities',
  description: 'Privacy-focused, local-first personal finance app',
  documentationUrl: 'https://actualbudget.org/docs/api/',
  dependencies: {
    apis: ['Actual Budget API'],
    notes: 'Requires Actual Budget server with API access. Get Sync ID from Settings → Advanced Settings.',
  },
  sampleName: 'My Budget',
  sampleHost: 'localhost',
  defaultPort: 5006,

  auth: {
    defaultMethod: 'token',
    commonFields: [
      {
        key: 'serverUrl',
        label: 'Server URL',
        type: 'text',
        placeholder: 'http://localhost:5006',
        required: true,
        helpText: 'Full URL to your Actual Budget server (e.g., http://localhost:5006)',
      },
      {
        key: 'syncId',
        label: 'Budget Sync ID',
        type: 'text',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        required: true,
        helpText: 'Found in Actual Budget: Settings → Advanced Settings → Sync ID',
      },
    ],
    methods: [
      {
        method: 'token',
        label: 'Server Password',
        fields: [
          {
            key: 'password',
            label: 'Server Password',
            type: 'password',
            required: true,
            helpText: 'The password used to access your Actual Budget server',
          },
          {
            key: 'encryptionPassword',
            label: 'Encryption Password (Optional)',
            type: 'password',
            required: false,
            helpText: 'If your budget uses end-to-end encryption, enter the encryption password here',
          },
        ],
      },
    ],
    helpText: 'Connect to your Actual Budget server using the Sync ID from Settings → Advanced Settings.',
  },

  widgets: [
    {
      type: 'actualbudget-net-worth',
      name: 'Net Worth',
      description: 'Total net worth (assets minus liabilities)',
      metric: 'net-worth',
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
      supportsMetricSize: true,
      supportsHideLabels: true,
      visualizations: [
        { value: 'number', label: 'Large Number (Default)' },
        { value: 'card', label: 'Balance Card' },
        { value: 'breakdown', label: 'Asset Breakdown' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Assets/Liabilities', key: 'showBreakdown' },
            { label: 'Show Account List', key: 'showAccounts' },
          ],
        },
      ],
    },
    {
      type: 'actualbudget-accounts',
      name: 'Account Balances',
      description: 'All budget accounts with current balances',
      metric: 'accounts',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Account List (Default)' },
        { value: 'cards', label: 'Account Cards' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
        {
          label: 'Account Type',
          key: 'accountType',
          type: 'button-group',
          options: [
            { value: '', label: 'All' },
            { value: 'checking', label: 'Checking' },
            { value: 'savings', label: 'Savings' },
            { value: 'credit', label: 'Credit' },
            { value: 'investment', label: 'Investment' },
          ],
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Closed Accounts', key: 'showClosed' },
            { label: 'Show Off-Budget', key: 'showOffBudget' },
          ],
        },
      ],
    },
    {
      type: 'actualbudget-budget-overview',
      name: 'Budget Overview',
      description: 'Current month budget summary',
      metric: 'budget-month',
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 3, h: 2 },
      supportsHideLabels: true,
      supportsMetricSize: true,
      visualizations: [
        { value: 'cards', label: 'Summary Cards (Default)' },
        { value: 'bars', label: 'Progress Bars' },
        { value: 'numbers', label: 'Large Numbers' },
      ],
      filters: [
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show To Budget', key: 'showToBudget' },
            { label: 'Show Overspent', key: 'showOverspent' },
            { label: 'Show Income', key: 'showIncome' },
          ],
        },
      ],
    },
    {
      type: 'actualbudget-transactions',
      name: 'Recent Transactions',
      description: 'Recent transactions across all accounts',
      metric: 'transactions',
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 3 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'list', label: 'Transaction List (Default)' },
        { value: 'table', label: 'Transaction Table' },
        { value: 'compact', label: 'Compact View' },
      ],
      filters: [
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
            { label: 'Show Category', key: 'showCategory' },
            { label: 'Show Notes', key: 'showNotes' },
            { label: 'Show Account', key: 'showAccount' },
          ],
        },
      ],
    },
    {
      type: 'actualbudget-category-spending',
      name: 'Category Spending',
      description: 'Spending breakdown by category for current month',
      metric: 'category-spending',
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      supportsHideLabels: true,
      visualizations: [
        { value: 'bars', label: 'Category Bars (Default)' },
        { value: 'donut', label: 'Donut Chart' },
        { value: 'list', label: 'Category List' },
      ],
      filters: [
        {
          label: 'Max Categories',
          key: 'maxCategories',
          type: 'number',
          placeholder: '10',
        },
        {
          label: 'Display Options',
          key: 'displayOptions',
          type: 'checkbox-group',
          defaultEnabled: true,
          items: [
            { label: 'Show Budget Amount', key: 'showBudget' },
            { label: 'Show Progress Bar', key: 'showProgress' },
            { label: 'Show Group Name', key: 'showGroup' },
          ],
        },
      ],
    },
  ],
};
