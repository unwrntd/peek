import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Expense {
  id: number;
  name: string;
  amount: number;
  date: string;
  paidBy?: string;
  category?: string;
  createdAt?: string;
}

interface ExpensesData {
  expenses: Expense[];
  categories: Array<{ id: number; name: string; color?: string }>;
  summary: {
    totalExpenses: number;
    totalAmount: number;
    thisMonthCount: number;
    thisMonthTotal: number;
    categoryCount: number;
  };
}

interface ExpensesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Expenses({ integrationId, config, widgetId }: ExpensesWidgetProps) {
  const { data, loading, error } = useWidgetData<ExpensesData>({
    integrationId,
    metric: 'expenses',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const maxItems = (config.maxItems as number) || 20;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Loading expenses...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'summary') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-xs text-gray-500 mb-1">This Month</div>
          <div className="text-3xl font-bold text-green-400 mb-3">
            {formatCurrency(data.summary.thisMonthTotal)}
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs text-center">
            <div>
              <div className="text-lg font-medium text-white">{data.summary.thisMonthCount}</div>
              <div className="text-xs text-gray-500">purchases</div>
            </div>
            <div>
              <div className="text-lg font-medium text-white">{data.summary.totalExpenses}</div>
              <div className="text-xs text-gray-500">all time</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'by-category') {
    // Group expenses by category
    const byCategory: Record<string, { total: number; count: number }> = {};
    for (const expense of data.expenses) {
      const cat = expense.category || 'Uncategorized';
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, count: 0 };
      }
      byCategory[cat].total += expense.amount;
      byCategory[cat].count += 1;
    }

    const sortedCategories = Object.entries(byCategory)
      .sort((a, b) => b[1].total - a[1].total);

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-gray-500">{data.summary.categoryCount} categories</span>
            <span className="text-gray-400">{formatCurrency(data.summary.totalAmount)} total</span>
          </div>
          <div className="space-y-2">
            {sortedCategories.map(([category, stats]) => {
              const percentage = data.summary.totalAmount > 0
                ? (stats.total / data.summary.totalAmount) * 100
                : 0;

              return (
                <div key={category} className="p-2 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white">{category}</span>
                    <span className="text-sm font-medium text-green-400">{formatCurrency(stats.total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{stats.count}</span>
                  </div>
                </div>
              );
            })}
            {sortedCategories.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">No expenses</p>
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  const expenses = data.expenses.slice(0, maxItems);

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <span className="text-gray-500">{data.summary.thisMonthCount} this month</span>
          <span className="text-green-400 font-medium">{formatCurrency(data.summary.thisMonthTotal)}</span>
        </div>
        <div className="space-y-1">
          {expenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{expense.name}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatDate(expense.date)}</span>
                  {expense.category && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span>{expense.category}</span>
                    </>
                  )}
                  {expense.paidBy && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span>{expense.paidBy}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-sm font-medium text-green-400 ml-2">
                {formatCurrency(expense.amount)}
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No expenses</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
