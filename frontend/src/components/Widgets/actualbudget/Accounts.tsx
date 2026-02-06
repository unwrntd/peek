import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Account {
  id: string;
  name: string;
  type: string;
  offbudget: boolean;
  closed: boolean;
  balance: number;
}

interface AccountsData {
  accounts: Account[];
}

interface AccountsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatAmount(amount: number): string {
  const value = amount / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function AccountIcon({ type }: { type: string }) {
  switch (type) {
    case 'checking':
    case 'savings':
      // Banknotes icon
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'credit':
      // Credit card icon
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case 'investment':
      // Chart icon
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'mortgage':
    case 'debt':
      // Home icon
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    default:
      // Building icon
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
  }
}

function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    checking: 'Checking',
    savings: 'Savings',
    credit: 'Credit Card',
    investment: 'Investment',
    mortgage: 'Mortgage',
    debt: 'Debt',
    other: 'Other',
  };
  return labels[type] || type;
}

export function Accounts({ integrationId, config, widgetId }: AccountsWidgetProps) {
  const { data, loading, error } = useWidgetData<AccountsData>({
    integrationId,
    metric: 'accounts',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const accounts = data?.accounts || [];
  const accountType = (config.accountType as string) || '';
  const showClosed = config.showClosed === true;
  const showOffBudget = config.showOffBudget === true;

  // Filter accounts
  let filteredAccounts = accounts;

  if (accountType) {
    filteredAccounts = filteredAccounts.filter((a) => a.type === accountType);
  }

  if (!showClosed) {
    filteredAccounts = filteredAccounts.filter((a) => !a.closed);
  }

  if (!showOffBudget) {
    filteredAccounts = filteredAccounts.filter((a) => !a.offbudget);
  }

  // Group by type
  const groupedAccounts = filteredAccounts.reduce(
    (acc, account) => {
      const type = account.type || 'other';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(account);
      return acc;
    },
    {} as Record<string, Account[]>
  );

  // Calculate totals
  const totalBalance = filteredAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 p-2">
          {!hideLabels && (
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700/50">
              <span className="text-xs text-gray-400">Total</span>
              <span className={`text-sm font-semibold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatAmount(totalBalance)}
              </span>
            </div>
          )}
          {filteredAccounts.map((account) => (
            <div key={account.id} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${(account.balance || 0) >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="flex-1 truncate text-gray-200">{account.name}</span>
              <span className={`flex-shrink-0 ${(account.balance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatAmount(account.balance || 0)}
              </span>
            </div>
          ))}
          {filteredAccounts.length === 0 && (
            <div className="text-center text-gray-500 text-sm">No accounts</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col h-full overflow-hidden p-2">
          {!hideLabels && (
            <div className="text-center mb-3">
              <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatAmount(totalBalance)}
              </div>
              <div className="text-xs text-gray-500">Total Balance</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 overflow-y-auto">
            {filteredAccounts.map((account) => (
              <div
                key={account.id}
                className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <AccountIcon type={account.type} />
                  <span className="text-xs text-gray-400 truncate">{getAccountTypeLabel(account.type)}</span>
                </div>
                <div className="text-sm text-gray-200 truncate">{account.name}</div>
                <div className={`text-lg font-semibold mt-1 ${(account.balance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatAmount(account.balance || 0)}
                </div>
              </div>
            ))}
          </div>
          {filteredAccounts.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">No accounts found</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Total balance header */}
        {!hideLabels && (
          <div className="px-3 py-2 border-b border-gray-700/50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Balance</span>
              <span
                className={`text-lg font-semibold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {formatAmount(totalBalance)}
              </span>
            </div>
          </div>
        )}

        {/* Account list */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
            <div key={type} className="border-b border-gray-800/50 last:border-0">
              {!hideLabels && (
                <div className="px-3 py-1.5 bg-gray-800/30">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    {getAccountTypeLabel(type)}
                  </span>
                </div>
              )}
              <div className="divide-y divide-gray-800/30">
                {typeAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="px-3 py-2 flex items-center justify-between hover:bg-gray-800/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AccountIcon type={account.type} />
                      <div className="min-w-0">
                        <div className="text-sm text-gray-200 truncate">{account.name}</div>
                        {!hideLabels && (account.offbudget || account.closed) && (
                          <div className="flex gap-1 mt-0.5">
                            {account.offbudget && (
                              <span className="text-xs text-yellow-500/70">Off Budget</span>
                            )}
                            {account.closed && (
                              <span className="text-xs text-gray-500">Closed</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        (account.balance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {formatAmount(account.balance || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredAccounts.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">No accounts found</div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
