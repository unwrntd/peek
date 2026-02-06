import * as actualApi from '@actual-app/api';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  ActualBudgetConfig,
  ActualBudgetAccount,
  ActualBudgetTransaction,
  ActualBudgetCategory,
  ActualBudgetCategoryGroup,
  ActualBudgetBudgetMonth,
} from '../types';
import { logger } from '../services/logger';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Connection state per config
interface ConnectionState {
  initialized: boolean;
  lastUsed: number;
}

const connectionStates = new Map<string, ConnectionState>();

export class ActualBudgetIntegration extends BaseIntegration {
  readonly type = 'actualbudget';
  readonly name = 'Actual Budget';

  private getConfigKey(config: ActualBudgetConfig): string {
    return `ab_${config.serverUrl}_${config.syncId}`;
  }

  private getDataDir(config: ActualBudgetConfig): string {
    const baseDir = path.join(os.tmpdir(), 'actual-budget-cache');
    const configDir = path.join(baseDir, this.getConfigKey(config).replace(/[^a-zA-Z0-9]/g, '_'));

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    return configDir;
  }

  private async ensureInitialized(config: ActualBudgetConfig): Promise<void> {
    const configKey = this.getConfigKey(config);
    const state = connectionStates.get(configKey);

    if (state?.initialized) {
      state.lastUsed = Date.now();
      return;
    }

    try {
      logger.debug('actualbudget', 'Initializing Actual Budget API', { serverUrl: config.serverUrl });

      await actualApi.init({
        serverURL: config.serverUrl,
        password: config.password,
        dataDir: this.getDataDir(config),
      });

      await actualApi.downloadBudget(config.syncId, {
        password: config.encryptionPassword,
      });

      connectionStates.set(configKey, {
        initialized: true,
        lastUsed: Date.now(),
      });

      logger.debug('actualbudget', 'Actual Budget API initialized successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('actualbudget', 'Failed to initialize Actual Budget API', { error: errorMsg });
      throw new Error(`Failed to connect: ${errorMsg}`);
    }
  }

  private async shutdown(): Promise<void> {
    try {
      await actualApi.shutdown();
    } catch (error) {
      logger.debug('actualbudget', 'Shutdown error (may be expected)', { error });
    }
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const abConfig = config as ActualBudgetConfig;

    if (!abConfig.serverUrl) {
      return { success: false, message: 'Server URL is required' };
    }
    if (!abConfig.password) {
      return { success: false, message: 'Password is required' };
    }
    if (!abConfig.syncId) {
      return { success: false, message: 'Budget Sync ID is required' };
    }

    try {
      // Reset any existing state
      await this.shutdown();
      connectionStates.delete(this.getConfigKey(abConfig));

      await this.ensureInitialized(abConfig);

      // Test by getting accounts
      const accounts = await actualApi.getAccounts();
      const accountCount = accounts?.length || 0;

      // Get budget months to verify access
      const months = await actualApi.getBudgetMonths();
      const monthCount = months?.length || 0;

      return {
        success: true,
        message: `Connected to Actual Budget (${accountCount} accounts, ${monthCount} budget months)`,
        details: {
          accountCount,
          monthCount,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('actualbudget', 'Connection test failed', { error: errorMsg });

      if (errorMsg.includes('Invalid sync ID')) {
        return { success: false, message: 'Invalid Budget Sync ID. Check Settings → Advanced Settings in Actual Budget.' };
      }
      if (errorMsg.includes('password')) {
        return { success: false, message: 'Invalid password' };
      }
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
        return { success: false, message: `Cannot reach server at ${abConfig.serverUrl}` };
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const abConfig = config as ActualBudgetConfig;
    await this.ensureInitialized(abConfig);

    switch (metric) {
      case 'accounts':
        return this.getAccounts();
      case 'budget-month':
        return this.getBudgetMonth();
      case 'net-worth':
        return this.getNetWorth();
      case 'transactions':
        return this.getRecentTransactions();
      case 'category-spending':
        return this.getCategorySpending();
      case 'categories':
        return this.getCategories();
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getAccounts(): Promise<{ accounts: ActualBudgetAccount[] }> {
    try {
      const accounts = await actualApi.getAccounts();

      // Get balances for each account - use any to avoid type issues with the API
      const accountsWithBalances: ActualBudgetAccount[] = await Promise.all(
        (accounts as unknown[]).map(async (account: unknown) => {
          const acc = account as { id: string; name: string; type?: string; offbudget?: boolean; closed?: boolean };
          const balance = await actualApi.getAccountBalance(acc.id);
          return {
            id: acc.id,
            name: acc.name,
            type: (acc.type || 'checking') as ActualBudgetAccount['type'],
            offbudget: Boolean(acc.offbudget),
            closed: Boolean(acc.closed),
            balance: balance || 0,
          };
        })
      );

      return { accounts: accountsWithBalances };
    } catch (error) {
      logger.error('actualbudget', 'Failed to get accounts', { error });
      throw error;
    }
  }

  private async getBudgetMonth(): Promise<{ budget: ActualBudgetBudgetMonth }> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const budgetData = await actualApi.getBudgetMonth(currentMonth) as {
        incomeAvailable?: number;
        lastMonthOverspent?: number;
        forNextMonth?: number;
        totalBudgeted?: number;
        toBudget?: number;
        categoryGroups?: Array<{
          categories?: Array<{
            id: string;
            budgeted: number;
            spent: number;
            balance: number;
            carryover?: boolean;
          }>;
        }>;
      };

      const categoryBudgets = budgetData?.categoryGroups?.flatMap(
        (group) =>
          group.categories?.map((cat) => ({
            category: cat.id,
            budgeted: cat.budgeted || 0,
            spent: Math.abs(cat.spent || 0),
            balance: cat.balance || 0,
            carryover: cat.carryover || false,
          })) || []
      ) || [];

      const budget: ActualBudgetBudgetMonth = {
        month: currentMonth,
        incomeAvailable: budgetData?.incomeAvailable || 0,
        lastMonthOverspent: budgetData?.lastMonthOverspent || 0,
        forNextMonth: budgetData?.forNextMonth || 0,
        totalBudgeted: budgetData?.totalBudgeted || 0,
        toBudget: budgetData?.toBudget || 0,
        categoryBudgets,
      };

      return { budget };
    } catch (error) {
      logger.error('actualbudget', 'Failed to get budget month', { error });
      throw error;
    }
  }

  private async getNetWorth(): Promise<{ netWorth: { total: number; assets: number; liabilities: number; accounts: Array<{ name: string; balance: number; type: string }> } }> {
    try {
      const accounts = await actualApi.getAccounts() as unknown[];

      let assets = 0;
      let liabilities = 0;
      const accountDetails: Array<{ name: string; balance: number; type: string }> = [];

      for (const account of accounts) {
        const acc = account as { id: string; name: string; type?: string; closed?: boolean };
        if (acc.closed) continue;

        const balance = await actualApi.getAccountBalance(acc.id);
        const balanceValue = balance || 0;

        accountDetails.push({
          name: acc.name,
          balance: balanceValue,
          type: acc.type || 'checking',
        });

        if (balanceValue >= 0) {
          assets += balanceValue;
        } else {
          liabilities += Math.abs(balanceValue);
        }
      }

      return {
        netWorth: {
          total: assets - liabilities,
          assets,
          liabilities,
          accounts: accountDetails,
        },
      };
    } catch (error) {
      logger.error('actualbudget', 'Failed to get net worth', { error });
      throw error;
    }
  }

  private async getRecentTransactions(): Promise<{ transactions: ActualBudgetTransaction[] }> {
    try {
      const accounts = await actualApi.getAccounts() as unknown[];

      // Get transactions from the last 30 days
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const allTransactions: ActualBudgetTransaction[] = [];

      for (const account of accounts) {
        const acc = account as { id: string; closed?: boolean };
        if (acc.closed) continue;

        const transactions = await actualApi.getTransactions(acc.id, startDate, endDate) as unknown[];

        for (const tx of transactions || []) {
          const t = tx as {
            id: string;
            account: string;
            date: string;
            amount: number;
            payee?: string;
            imported_payee?: string;
            category?: string;
            notes?: string;
            cleared?: boolean;
            transfer_id?: string;
          };
          allTransactions.push({
            id: t.id,
            account: t.account,
            date: t.date,
            amount: t.amount,
            payee: t.payee,
            payee_name: t.imported_payee,
            category: t.category,
            notes: t.notes,
            cleared: Boolean(t.cleared),
            transfer_id: t.transfer_id,
          });
        }
      }

      // Sort by date descending
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return { transactions: allTransactions.slice(0, 50) }; // Limit to 50 recent
    } catch (error) {
      logger.error('actualbudget', 'Failed to get transactions', { error });
      throw error;
    }
  }

  private async getCategorySpending(): Promise<{ spending: Array<{ categoryId: string; categoryName: string; groupName: string; spent: number; budgeted: number }> }> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const budgetData = await actualApi.getBudgetMonth(currentMonth) as unknown as {
        categoryGroups?: Array<{
          id: string;
          categories?: Array<{ id: string; spent: number; budgeted: number }>;
        }>;
      };
      const categories = await actualApi.getCategories() as unknown[];
      const categoryGroups = await actualApi.getCategoryGroups() as unknown[];

      // Build lookup maps
      const categoryMap = new Map<string, { id: string; name: string; group_id?: string }>();
      for (const c of categories) {
        const cat = c as { id: string; name: string; group_id?: string };
        categoryMap.set(cat.id, cat);
      }

      const groupMap = new Map<string, { id: string; name: string }>();
      for (const g of categoryGroups) {
        const group = g as { id: string; name: string };
        groupMap.set(group.id, group);
      }

      const spending = budgetData?.categoryGroups?.flatMap(
        (group) =>
          group.categories?.map((cat) => {
            const category = categoryMap.get(cat.id);
            const categoryGroup = category?.group_id ? groupMap.get(category.group_id) : undefined;
            return {
              categoryId: cat.id,
              categoryName: category?.name || 'Unknown',
              groupName: categoryGroup?.name || 'Unknown',
              spent: Math.abs(cat.spent || 0),
              budgeted: cat.budgeted || 0,
            };
          }) || []
      ) || [];

      // Sort by spent amount descending
      spending.sort((a, b) => b.spent - a.spent);

      return { spending };
    } catch (error) {
      logger.error('actualbudget', 'Failed to get category spending', { error });
      throw error;
    }
  }

  private async getCategories(): Promise<{ categories: ActualBudgetCategory[]; groups: ActualBudgetCategoryGroup[] }> {
    try {
      const categories = await actualApi.getCategories() as unknown[];
      const groups = await actualApi.getCategoryGroups() as unknown[];

      return {
        categories: categories.map((c: unknown) => {
          const cat = c as { id: string; name: string; group_id?: string; is_income?: boolean };
          return {
            id: cat.id,
            name: cat.name,
            group_id: cat.group_id || '',
            is_income: cat.is_income || false,
          };
        }),
        groups: groups.map((g: unknown) => {
          const group = g as { id: string; name: string; is_income?: boolean };
          return {
            id: group.id,
            name: group.name,
            is_income: group.is_income || false,
          };
        }),
      };
    } catch (error) {
      logger.error('actualbudget', 'Failed to get categories', { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'accounts',
        name: 'Accounts',
        description: 'All budget accounts with current balances',
        widgetTypes: ['actualbudget-accounts'],
      },
      {
        id: 'budget-month',
        name: 'Budget Overview',
        description: 'Current month budget summary',
        widgetTypes: ['actualbudget-budget-overview'],
      },
      {
        id: 'net-worth',
        name: 'Net Worth',
        description: 'Total net worth (assets minus liabilities)',
        widgetTypes: ['actualbudget-net-worth'],
      },
      {
        id: 'transactions',
        name: 'Recent Transactions',
        description: 'Recent transactions across all accounts',
        widgetTypes: ['actualbudget-transactions'],
      },
      {
        id: 'category-spending',
        name: 'Category Spending',
        description: 'Spending breakdown by category',
        widgetTypes: ['actualbudget-category-spending'],
      },
      {
        id: 'categories',
        name: 'Categories',
        description: 'Budget categories and groups',
        widgetTypes: ['actualbudget-categories'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Initialization & Connection
      {
        id: 'init',
        name: 'Initialize API',
        description: 'Initialize the API by connecting to an Actual Budget server',
        method: 'POST',
        endpoint: 'init(config)',
        implemented: true,
        category: 'Connection',
        parameters: [
          { name: 'serverURL', type: 'string', required: true, description: 'Server URL' },
          { name: 'password', type: 'string', required: true, description: 'Server password' },
          { name: 'dataDir', type: 'string', required: false, description: 'Local data directory' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#init',
      },
      {
        id: 'shutdown',
        name: 'Shutdown API',
        description: 'Shut down the API, closing any open budget and cleaning up resources',
        method: 'POST',
        endpoint: 'shutdown()',
        implemented: true,
        category: 'Connection',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#shutdown',
      },
      {
        id: 'sync',
        name: 'Sync Budget',
        description: 'Synchronize the locally cached budget files with the server',
        method: 'POST',
        endpoint: 'sync()',
        implemented: false,
        category: 'Connection',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#sync',
      },

      // Budget Management
      {
        id: 'get-budgets',
        name: 'Get Budgets',
        description: 'Get a list of all budget files locally cached or on the remote server',
        method: 'GET',
        endpoint: 'getBudgets()',
        implemented: false,
        category: 'Budgets',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getbudgets',
      },
      {
        id: 'load-budget',
        name: 'Load Budget',
        description: 'Load a locally cached budget file by ID',
        method: 'POST',
        endpoint: 'loadBudget(budgetId)',
        implemented: false,
        category: 'Budgets',
        parameters: [
          { name: 'budgetId', type: 'string', required: true, description: 'Budget file ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#loadbudget',
      },
      {
        id: 'download-budget',
        name: 'Download Budget',
        description: 'Download a budget file from the server by sync ID',
        method: 'POST',
        endpoint: 'downloadBudget(syncId, options)',
        implemented: true,
        category: 'Budgets',
        parameters: [
          { name: 'syncId', type: 'string', required: true, description: 'Budget sync ID' },
          { name: 'password', type: 'string', required: false, description: 'Encryption password' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#downloadbudget',
      },
      {
        id: 'batch-budget-updates',
        name: 'Batch Budget Updates',
        description: 'Run multiple budget updates in a single batch for better performance',
        method: 'POST',
        endpoint: 'batchBudgetUpdates(func)',
        implemented: false,
        category: 'Budgets',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#batchbudgetupdates',
      },
      {
        id: 'run-import',
        name: 'Run Import',
        description: 'Create a new budget and run a custom importer to populate it',
        method: 'POST',
        endpoint: 'runImport(options)',
        implemented: false,
        category: 'Budgets',
        parameters: [
          { name: 'budgetName', type: 'string', required: true, description: 'Name for the new budget' },
          { name: 'func', type: 'function', required: true, description: 'Import function' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#runimport',
      },

      // Budget Months
      {
        id: 'get-budget-months',
        name: 'Get Budget Months',
        description: 'Get a list of all months that have budget data',
        method: 'GET',
        endpoint: 'getBudgetMonths()',
        implemented: true,
        category: 'Budget Months',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getbudgetmonths',
      },
      {
        id: 'get-budget-month',
        name: 'Get Budget Month',
        description: 'Get budget data for a specific month including category budgets',
        method: 'GET',
        endpoint: 'getBudgetMonth(month)',
        implemented: true,
        category: 'Budget Months',
        parameters: [
          { name: 'month', type: 'string', required: true, description: 'Month in YYYY-MM format' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getbudgetmonth',
      },
      {
        id: 'set-budget-amount',
        name: 'Set Budget Amount',
        description: 'Set the budget amount for a category in a specific month',
        method: 'POST',
        endpoint: 'setBudgetAmount(month, categoryId, amount)',
        implemented: false,
        category: 'Budget Months',
        parameters: [
          { name: 'month', type: 'string', required: true, description: 'Month in YYYY-MM format' },
          { name: 'categoryId', type: 'string', required: true, description: 'Category ID' },
          { name: 'amount', type: 'number', required: true, description: 'Budget amount (in cents)' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#setbudgetamount',
      },
      {
        id: 'set-budget-carryover',
        name: 'Set Budget Carryover',
        description: 'Set whether a category carries over its balance to the next month',
        method: 'POST',
        endpoint: 'setBudgetCarryover(month, categoryId, flag)',
        implemented: false,
        category: 'Budget Months',
        parameters: [
          { name: 'month', type: 'string', required: true, description: 'Month in YYYY-MM format' },
          { name: 'categoryId', type: 'string', required: true, description: 'Category ID' },
          { name: 'flag', type: 'boolean', required: true, description: 'Carryover flag' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#setbudgetcarryover',
      },

      // Accounts - Implemented
      {
        id: 'get-accounts',
        name: 'Get Accounts',
        description: 'Get all accounts in the budget',
        method: 'GET',
        endpoint: 'getAccounts()',
        implemented: true,
        category: 'Accounts',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getaccounts',
      },
      {
        id: 'create-account',
        name: 'Create Account',
        description: 'Create a new account with an optional initial balance',
        method: 'POST',
        endpoint: 'createAccount(account, initialBalance)',
        implemented: false,
        category: 'Accounts',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Account name' },
          { name: 'type', type: 'string', required: false, description: 'Account type (checking, savings, credit, etc.)' },
          { name: 'offbudget', type: 'boolean', required: false, description: 'Off-budget account' },
          { name: 'initialBalance', type: 'number', required: false, description: 'Initial balance (in cents)' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#createaccount',
      },
      {
        id: 'update-account',
        name: 'Update Account',
        description: 'Update account fields (name, type, etc.)',
        method: 'PUT',
        endpoint: 'updateAccount(id, fields)',
        implemented: false,
        category: 'Accounts',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Account ID' },
          { name: 'name', type: 'string', required: false, description: 'Account name' },
          { name: 'type', type: 'string', required: false, description: 'Account type' },
          { name: 'offbudget', type: 'boolean', required: false, description: 'Off-budget flag' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#updateaccount',
      },
      {
        id: 'close-account',
        name: 'Close Account',
        description: 'Close an account and optionally transfer remaining balance',
        method: 'POST',
        endpoint: 'closeAccount(id, transferAccountId, transferCategoryId)',
        implemented: false,
        category: 'Accounts',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Account ID to close' },
          { name: 'transferAccountId', type: 'string', required: false, description: 'Account to transfer balance to' },
          { name: 'transferCategoryId', type: 'string', required: false, description: 'Category for transfer' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#closeaccount',
      },
      {
        id: 'reopen-account',
        name: 'Reopen Account',
        description: 'Reopen a previously closed account',
        method: 'POST',
        endpoint: 'reopenAccount(id)',
        implemented: false,
        category: 'Accounts',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Account ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#reopenaccount',
      },
      {
        id: 'delete-account',
        name: 'Delete Account',
        description: 'Permanently delete an account',
        method: 'DELETE',
        endpoint: 'deleteAccount(id)',
        implemented: false,
        category: 'Accounts',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Account ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#deleteaccount',
      },
      {
        id: 'get-account-balance',
        name: 'Get Account Balance',
        description: 'Get the current balance of an account',
        method: 'GET',
        endpoint: 'getAccountBalance(id, cutoff)',
        implemented: true,
        category: 'Accounts',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Account ID' },
          { name: 'cutoff', type: 'string', required: false, description: 'Date cutoff for balance calculation' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getaccountbalance',
      },

      // Transactions - Partially Implemented
      {
        id: 'get-transactions',
        name: 'Get Transactions',
        description: 'Get transactions for an account within a date range',
        method: 'GET',
        endpoint: 'getTransactions(accountId, startDate, endDate)',
        implemented: true,
        category: 'Transactions',
        parameters: [
          { name: 'accountId', type: 'string', required: true, description: 'Account ID' },
          { name: 'startDate', type: 'string', required: false, description: 'Start date (YYYY-MM-DD)' },
          { name: 'endDate', type: 'string', required: false, description: 'End date (YYYY-MM-DD)' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#gettransactions',
      },
      {
        id: 'add-transactions',
        name: 'Add Transactions',
        description: 'Add multiple transactions at once (does not reconcile)',
        method: 'POST',
        endpoint: 'addTransactions(accountId, transactions)',
        implemented: false,
        category: 'Transactions',
        parameters: [
          { name: 'accountId', type: 'string', required: true, description: 'Account ID' },
          { name: 'transactions', type: 'array', required: true, description: 'Array of transaction objects' },
          { name: 'runTransfers', type: 'boolean', required: false, description: 'Process transfer transactions' },
          { name: 'learnCategories', type: 'boolean', required: false, description: 'Learn category from payee' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#addtransactions',
      },
      {
        id: 'import-transactions',
        name: 'Import Transactions',
        description: 'Import transactions with reconciliation and duplicate detection',
        method: 'POST',
        endpoint: 'importTransactions(accountId, transactions)',
        implemented: false,
        category: 'Transactions',
        parameters: [
          { name: 'accountId', type: 'string', required: true, description: 'Account ID' },
          { name: 'transactions', type: 'array', required: true, description: 'Array of transaction objects' },
          { name: 'dryRun', type: 'boolean', required: false, description: 'Preview import without saving' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#importtransactions',
      },
      {
        id: 'update-transaction',
        name: 'Update Transaction',
        description: 'Update fields of an existing transaction',
        method: 'PUT',
        endpoint: 'updateTransaction(id, fields)',
        implemented: false,
        category: 'Transactions',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Transaction ID' },
          { name: 'date', type: 'string', required: false, description: 'Transaction date' },
          { name: 'amount', type: 'number', required: false, description: 'Amount (in cents)' },
          { name: 'category', type: 'string', required: false, description: 'Category ID' },
          { name: 'notes', type: 'string', required: false, description: 'Transaction notes' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#updatetransaction',
      },
      {
        id: 'delete-transaction',
        name: 'Delete Transaction',
        description: 'Delete a transaction',
        method: 'DELETE',
        endpoint: 'deleteTransaction(id)',
        implemented: false,
        category: 'Transactions',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Transaction ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#deletetransaction',
      },

      // Categories - Implemented
      {
        id: 'get-categories',
        name: 'Get Categories',
        description: 'Get all budget categories',
        method: 'GET',
        endpoint: 'getCategories()',
        implemented: true,
        category: 'Categories',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getcategories',
      },
      {
        id: 'create-category',
        name: 'Create Category',
        description: 'Create a new budget category',
        method: 'POST',
        endpoint: 'createCategory(category)',
        implemented: false,
        category: 'Categories',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Category name' },
          { name: 'group_id', type: 'string', required: true, description: 'Category group ID' },
          { name: 'is_income', type: 'boolean', required: false, description: 'Income category flag' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#createcategory',
      },
      {
        id: 'update-category',
        name: 'Update Category',
        description: 'Update category fields',
        method: 'PUT',
        endpoint: 'updateCategory(id, fields)',
        implemented: false,
        category: 'Categories',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Category ID' },
          { name: 'name', type: 'string', required: false, description: 'Category name' },
          { name: 'group_id', type: 'string', required: false, description: 'Category group ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#updatecategory',
      },
      {
        id: 'delete-category',
        name: 'Delete Category',
        description: 'Delete a category and optionally transfer transactions',
        method: 'DELETE',
        endpoint: 'deleteCategory(id, transferCategoryId)',
        implemented: false,
        category: 'Categories',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Category ID' },
          { name: 'transferCategoryId', type: 'string', required: false, description: 'Category to transfer transactions to' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#deletecategory',
      },

      // Category Groups - Implemented
      {
        id: 'get-category-groups',
        name: 'Get Category Groups',
        description: 'Get all category groups',
        method: 'GET',
        endpoint: 'getCategoryGroups()',
        implemented: true,
        category: 'Category Groups',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getcategorygroups',
      },
      {
        id: 'create-category-group',
        name: 'Create Category Group',
        description: 'Create a new category group',
        method: 'POST',
        endpoint: 'createCategoryGroup(group)',
        implemented: false,
        category: 'Category Groups',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Group name' },
          { name: 'is_income', type: 'boolean', required: false, description: 'Income group flag' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#createcategorygroup',
      },
      {
        id: 'update-category-group',
        name: 'Update Category Group',
        description: 'Update category group fields',
        method: 'PUT',
        endpoint: 'updateCategoryGroup(id, fields)',
        implemented: false,
        category: 'Category Groups',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Group ID' },
          { name: 'name', type: 'string', required: false, description: 'Group name' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#updatecategorygroup',
      },
      {
        id: 'delete-category-group',
        name: 'Delete Category Group',
        description: 'Delete a category group and optionally transfer categories',
        method: 'DELETE',
        endpoint: 'deleteCategoryGroup(id, transferCategoryId)',
        implemented: false,
        category: 'Category Groups',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Group ID' },
          { name: 'transferCategoryId', type: 'string', required: false, description: 'Category to transfer items to' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#deletecategorygroup',
      },

      // Payees
      {
        id: 'get-payees',
        name: 'Get Payees',
        description: 'Get all payees',
        method: 'GET',
        endpoint: 'getPayees()',
        implemented: false,
        category: 'Payees',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getpayees',
      },
      {
        id: 'create-payee',
        name: 'Create Payee',
        description: 'Create a new payee',
        method: 'POST',
        endpoint: 'createPayee(payee)',
        implemented: false,
        category: 'Payees',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Payee name' },
          { name: 'category', type: 'string', required: false, description: 'Default category ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#createpayee',
      },
      {
        id: 'update-payee',
        name: 'Update Payee',
        description: 'Update payee fields',
        method: 'PUT',
        endpoint: 'updatePayee(id, fields)',
        implemented: false,
        category: 'Payees',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Payee ID' },
          { name: 'name', type: 'string', required: false, description: 'Payee name' },
          { name: 'category', type: 'string', required: false, description: 'Default category ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#updatepayee',
      },
      {
        id: 'delete-payee',
        name: 'Delete Payee',
        description: 'Delete a payee',
        method: 'DELETE',
        endpoint: 'deletePayee(id)',
        implemented: false,
        category: 'Payees',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Payee ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#deletepayee',
      },
      {
        id: 'merge-payees',
        name: 'Merge Payees',
        description: 'Merge multiple payees into one',
        method: 'POST',
        endpoint: 'mergePayees(targetId, sourceIds)',
        implemented: false,
        category: 'Payees',
        parameters: [
          { name: 'targetId', type: 'string', required: true, description: 'Target payee ID' },
          { name: 'sourceIds', type: 'array', required: true, description: 'Array of source payee IDs' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#mergepayees',
      },

      // Rules
      {
        id: 'get-rules',
        name: 'Get Rules',
        description: 'Get all transaction rules',
        method: 'GET',
        endpoint: 'getRules()',
        implemented: false,
        category: 'Rules',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getrules',
      },
      {
        id: 'get-payee-rules',
        name: 'Get Payee Rules',
        description: 'Get rules associated with a specific payee',
        method: 'GET',
        endpoint: 'getPayeeRules(payeeId)',
        implemented: false,
        category: 'Rules',
        parameters: [
          { name: 'payeeId', type: 'string', required: true, description: 'Payee ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getpayeerules',
      },
      {
        id: 'create-rule',
        name: 'Create Rule',
        description: 'Create a new transaction rule',
        method: 'POST',
        endpoint: 'createRule(rule)',
        implemented: false,
        category: 'Rules',
        parameters: [
          { name: 'conditions', type: 'array', required: true, description: 'Array of rule conditions' },
          { name: 'actions', type: 'array', required: true, description: 'Array of rule actions' },
          { name: 'stage', type: 'string', required: false, description: 'Rule stage (pre or post)' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#createrule',
      },
      {
        id: 'update-rule',
        name: 'Update Rule',
        description: 'Update a rule',
        method: 'PUT',
        endpoint: 'updateRule(id, fields)',
        implemented: false,
        category: 'Rules',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Rule ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#updaterule',
      },
      {
        id: 'delete-rule',
        name: 'Delete Rule',
        description: 'Delete a rule',
        method: 'DELETE',
        endpoint: 'deleteRule(id)',
        implemented: false,
        category: 'Rules',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Rule ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#deleterule',
      },

      // Schedules
      {
        id: 'get-schedules',
        name: 'Get Schedules',
        description: 'Get all scheduled transactions',
        method: 'GET',
        endpoint: 'getSchedules()',
        implemented: false,
        category: 'Schedules',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getschedules',
      },
      {
        id: 'create-schedule',
        name: 'Create Schedule',
        description: 'Create a new scheduled transaction',
        method: 'POST',
        endpoint: 'createSchedule(schedule)',
        implemented: false,
        category: 'Schedules',
        parameters: [
          { name: 'account', type: 'string', required: true, description: 'Account ID' },
          { name: 'amount', type: 'number', required: true, description: 'Amount (in cents)' },
          { name: 'payee', type: 'string', required: false, description: 'Payee ID' },
          { name: 'date', type: 'object', required: true, description: 'Schedule date configuration' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#createschedule',
      },
      {
        id: 'update-schedule',
        name: 'Update Schedule',
        description: 'Update a scheduled transaction',
        method: 'PUT',
        endpoint: 'updateSchedule(id, fields)',
        implemented: false,
        category: 'Schedules',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Schedule ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#updateschedule',
      },
      {
        id: 'delete-schedule',
        name: 'Delete Schedule',
        description: 'Delete a scheduled transaction',
        method: 'DELETE',
        endpoint: 'deleteSchedule(id)',
        implemented: false,
        category: 'Schedules',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Schedule ID' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#deleteschedule',
      },

      // Bank Sync
      {
        id: 'run-bank-sync',
        name: 'Run Bank Sync',
        description: 'Run third-party bank sync (GoCardless, SimpleFIN) to download transactions',
        method: 'POST',
        endpoint: 'runBankSync()',
        implemented: false,
        category: 'Bank Sync',
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#runbanksync',
      },

      // Queries
      {
        id: 'run-query',
        name: 'Run Query',
        description: 'Run a custom ActualQL query against the database',
        method: 'POST',
        endpoint: 'runQuery(query)',
        implemented: false,
        category: 'Queries',
        parameters: [
          { name: 'query', type: 'object', required: true, description: 'ActualQL query object' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/actual-ql/',
      },

      // Utilities
      {
        id: 'get-id-by-name',
        name: 'Get ID by Name',
        description: 'Get the ID of an entity by its name',
        method: 'GET',
        endpoint: 'getIDByName(table, name)',
        implemented: false,
        category: 'Utilities',
        parameters: [
          { name: 'table', type: 'string', required: true, description: 'Table name (accounts, categories, payees)' },
          { name: 'name', type: 'string', required: true, description: 'Entity name to search for' },
        ],
        documentationUrl: 'https://actualbudget.org/docs/api/reference/#getidbyname',
      },
    ];
  }
}
