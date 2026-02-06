import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { ScaledMetric } from '../../common/ScaledMetric';

interface BudgetMonth {
  month: string;
  incomeAvailable: number;
  lastMonthOverspent: number;
  forNextMonth: number;
  totalBudgeted: number;
  toBudget: number;
  categoryBudgets: Array<{
    category: string;
    budgeted: number;
    spent: number;
    balance: number;
    carryover: boolean;
  }>;
}

interface BudgetOverviewData {
  budget: BudgetMonth;
}

interface BudgetOverviewWidgetProps {
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function BudgetOverview({ integrationId, config, widgetId }: BudgetOverviewWidgetProps) {
  const { data, loading, error } = useWidgetData<BudgetOverviewData>({
    integrationId,
    metric: 'budget-month',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const budget = data?.budget;
  const showToBudget = config.showToBudget !== false;
  const showOverspent = config.showOverspent !== false;
  const showIncome = config.showIncome !== false;

  // Calculate totals from category budgets
  const totalBudgeted = budget?.categoryBudgets?.reduce((sum, c) => sum + c.budgeted, 0) || 0;
  const totalSpent = budget?.categoryBudgets?.reduce((sum, c) => sum + c.spent, 0) || 0;
  const totalBalance = budget?.categoryBudgets?.reduce((sum, c) => sum + c.balance, 0) || 0;

  // Find overspent categories
  const overspentCategories = budget?.categoryBudgets?.filter((c) => c.balance < 0) || [];
  const totalOverspent = overspentCategories.reduce((sum, c) => sum + Math.abs(c.balance), 0);
  const spendingPercent = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  // Numbers visualization - large metrics
  if (visualization === 'numbers') {
    const visibleCount = [showToBudget, showOverspent, showIncome].filter(Boolean).length;
    if (visibleCount === 1) {
      const value = showToBudget ? formatAmount(budget?.toBudget || 0)
        : showIncome ? formatAmount(budget?.incomeAvailable || 0)
        : formatAmount(totalOverspent);
      const color = showToBudget ? ((budget?.toBudget || 0) >= 0 ? 'text-green-400' : 'text-red-400')
        : showIncome ? 'text-green-400' : 'text-red-400';
      return (
        <BaseWidget loading={loading} error={error}>
          <ScaledMetric value={value} className={color} />
        </BaseWidget>
      );
    }

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">{formatAmount(totalBudgeted)}</div>
              {!hideLabels && <div className="text-xs text-gray-500 mt-1">Budgeted</div>}
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-400">{formatAmount(totalSpent)}</div>
              {!hideLabels && <div className="text-xs text-gray-500 mt-1">Spent</div>}
            </div>
            <div>
              <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatAmount(totalBalance)}
              </div>
              {!hideLabels && <div className="text-xs text-gray-500 mt-1">Remaining</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Bars visualization - progress bars for each metric
  if (visualization === 'bars') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col h-full p-3 space-y-4">
          {!hideLabels && budget?.month && (
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-400">{formatMonth(budget.month)}</h3>
            </div>
          )}

          {/* Spending progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Spent</span>
              <span className={totalSpent > totalBudgeted ? 'text-red-400' : 'text-green-400'}>
                {formatAmount(totalSpent)} / {formatAmount(totalBudgeted)}
              </span>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${totalSpent > totalBudgeted ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(spendingPercent, 100)}%` }}
              />
            </div>
            {!hideLabels && <div className="text-xs text-gray-500 mt-1 text-right">{spendingPercent}%</div>}
          </div>

          {showToBudget && budget && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">To Budget</span>
                <span className={budget.toBudget >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatAmount(budget.toBudget)}
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${budget.toBudget >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: budget.toBudget >= 0 ? '100%' : '0%' }}
                />
              </div>
            </div>
          )}

          {showOverspent && totalOverspent > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Overspent ({overspentCategories.length})</span>
                <span className="text-red-400">{formatAmount(totalOverspent)}</span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: '100%' }} />
              </div>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-3">
        {/* Month header */}
        {!hideLabels && (
          <div className="text-center mb-3">
            <h3 className="text-lg font-semibold text-gray-200">
              {budget?.month ? formatMonth(budget.month) : 'Current Month'}
            </h3>
          </div>
        )}

        {/* Main stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-gray-800/30 rounded">
            <div className="text-lg font-semibold text-blue-400">{formatAmount(totalBudgeted)}</div>
            {!hideLabels && <div className="text-xs text-gray-500">Budgeted</div>}
          </div>
          <div className="text-center p-2 bg-gray-800/30 rounded">
            <div className="text-lg font-semibold text-orange-400">{formatAmount(totalSpent)}</div>
            {!hideLabels && <div className="text-xs text-gray-500">Spent</div>}
          </div>
          <div className="text-center p-2 bg-gray-800/30 rounded">
            <div
              className={`text-lg font-semibold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {formatAmount(totalBalance)}
            </div>
            {!hideLabels && <div className="text-xs text-gray-500">Remaining</div>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          {!hideLabels && (
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Spending Progress</span>
              <span>{spendingPercent}%</span>
            </div>
          )}
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                totalSpent > totalBudgeted ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{
                width: `${Math.min(spendingPercent, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Additional info */}
        <div className="space-y-2 text-sm">
          {showToBudget && budget && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">To Budget</span>
              <span
                className={`font-medium ${budget.toBudget >= 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {formatAmount(budget.toBudget)}
              </span>
            </div>
          )}

          {showIncome && budget && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Income Available</span>
              <span className="font-medium text-green-400">
                {formatAmount(budget.incomeAvailable)}
              </span>
            </div>
          )}

          {showOverspent && totalOverspent > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Overspent ({overspentCategories.length})</span>
              <span className="font-medium text-red-400">{formatAmount(totalOverspent)}</span>
            </div>
          )}

          {showOverspent && budget?.lastMonthOverspent !== 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Last Month Overspent</span>
              <span className="font-medium text-red-400">
                {formatAmount(budget?.lastMonthOverspent || 0)}
              </span>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
