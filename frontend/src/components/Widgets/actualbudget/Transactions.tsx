import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Transaction {
  id: string;
  account: string;
  date: string;
  amount: number;
  payee?: string;
  payee_name?: string;
  category?: string;
  notes?: string;
  cleared: boolean;
  transfer_id?: string;
}

interface TransactionsData {
  transactions: Transaction[];
}

interface TransactionsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatAmount(amount: number): string {
  const value = Math.abs(amount) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function ArrowIcon({ isIncome }: { isIncome: boolean }) {
  if (isIncome) {
    // Arrow down (incoming)
    return (
      <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  }
  // Arrow up (outgoing)
  return (
    <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );
}

export function Transactions({ integrationId, config, widgetId }: TransactionsWidgetProps) {
  const { data, loading, error } = useWidgetData<TransactionsData>({
    integrationId,
    metric: 'transactions',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const transactions = data?.transactions || [];
  const maxItems = (config.maxItems as number) || 20;
  const showCategory = config.showCategory !== false;
  const showNotes = config.showNotes === true;
  const showAccount = config.showAccount === true;

  const displayedTransactions = transactions.slice(0, maxItems);

  // Group transactions by date
  const groupedByDate = displayedTransactions.reduce(
    (acc, tx) => {
      const date = tx.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(tx);
      return acc;
    },
    {} as Record<string, Transaction[]>
  );

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 p-2 overflow-y-auto h-full">
          {displayedTransactions.map((tx) => {
            const isIncome = tx.amount > 0;
            const displayName = tx.payee_name || tx.payee || 'Unknown';
            return (
              <div key={tx.id} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isIncome ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="flex-1 truncate text-gray-200">{displayName}</span>
                <span className={`flex-shrink-0 ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                  {isIncome ? '+' : '-'}{formatAmount(tx.amount)}
                </span>
              </div>
            );
          })}
          {displayedTransactions.length === 0 && (
            <div className="text-center text-gray-500 text-sm">No transactions</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Table visualization
  if (visualization === 'table') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="overflow-x-auto h-full">
          <table className="w-full text-sm">
            {!hideLabels && (
              <thead className="bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 text-gray-400 font-medium">Date</th>
                  <th className="text-left p-2 text-gray-400 font-medium">Payee</th>
                  {showCategory && <th className="text-left p-2 text-gray-400 font-medium">Category</th>}
                  <th className="text-right p-2 text-gray-400 font-medium">Amount</th>
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-800/30">
              {displayedTransactions.map((tx) => {
                const isIncome = tx.amount > 0;
                const displayName = tx.payee_name || tx.payee || 'Unknown';
                return (
                  <tr key={tx.id} className="hover:bg-gray-800/20">
                    <td className="p-2 text-gray-400 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="p-2 text-gray-200 truncate max-w-[150px]">{displayName}</td>
                    {showCategory && <td className="p-2 text-gray-500 truncate max-w-[100px]">{tx.category || '-'}</td>}
                    <td className={`p-2 text-right font-medium whitespace-nowrap ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                      {isIncome ? '+' : '-'}{formatAmount(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayedTransactions.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">No recent transactions</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {Object.entries(groupedByDate).map(([date, dateTxs]) => (
            <div key={date}>
              {/* Date header */}
              {!hideLabels && (
                <div className="px-3 py-1.5 bg-gray-800/30 sticky top-0">
                  <span className="text-xs font-medium text-gray-500">{formatDate(date)}</span>
                </div>
              )}

              {/* Transactions for this date */}
              <div className="divide-y divide-gray-800/30">
                {dateTxs.map((tx) => {
                  const isIncome = tx.amount > 0;
                  const displayName = tx.payee_name || tx.payee || 'Unknown';

                  return (
                    <div key={tx.id} className="px-3 py-2 hover:bg-gray-800/20">
                      <div className="flex items-start justify-between gap-2">
                        {/* Left side - transaction info */}
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div
                            className={`mt-0.5 p-1 rounded ${isIncome ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                          >
                            <ArrowIcon isIncome={isIncome} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-gray-200 truncate">
                              {tx.transfer_id ? `Transfer: ${displayName}` : displayName}
                            </div>
                            {!hideLabels && (
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                {showCategory && tx.category && (
                                  <span className="text-xs text-gray-500">{tx.category}</span>
                                )}
                                {showAccount && (
                                  <span className="text-xs text-gray-600">{tx.account}</span>
                                )}
                                {!tx.cleared && (
                                  <span className="text-xs text-yellow-500/70">Pending</span>
                                )}
                              </div>
                            )}
                            {showNotes && tx.notes && (
                              <div className="text-xs text-gray-500 truncate mt-0.5">
                                {tx.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right side - amount */}
                        <span
                          className={`text-sm font-medium whitespace-nowrap ${
                            isIncome ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatAmount(tx.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {displayedTransactions.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">No recent transactions</div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
