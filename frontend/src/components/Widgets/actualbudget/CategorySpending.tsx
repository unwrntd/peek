import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { DonutChart } from '../../common/visualizations';

interface CategorySpendingItem {
  categoryId: string;
  categoryName: string;
  groupName: string;
  spent: number;
  budgeted: number;
}

interface CategorySpendingData {
  spending: CategorySpendingItem[];
}

interface CategorySpendingWidgetProps {
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

const chartColors = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
  '#6366F1', '#EF4444', '#14B8A6', '#F97316', '#84CC16',
];

export function CategorySpending({ integrationId, config, widgetId }: CategorySpendingWidgetProps) {
  const { data, loading, error } = useWidgetData<CategorySpendingData>({
    integrationId,
    metric: 'category-spending',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'bars';
  const hideLabels = (config.hideLabels as boolean) || false;
  const spending = data?.spending || [];
  const maxCategories = (config.maxCategories as number) || 10;
  const showBudget = config.showBudget !== false;
  const showProgress = config.showProgress !== false;
  const showGroup = config.showGroup === true;

  // Filter out zero spending and limit
  const displayedCategories = spending
    .filter((c) => c.spent > 0)
    .slice(0, maxCategories);

  // Calculate total spending
  const totalSpent = displayedCategories.reduce((sum, c) => sum + c.spent, 0);

  // Donut visualization
  if (visualization === 'donut') {
    const segments = displayedCategories.map((cat, idx) => ({
      label: cat.categoryName,
      value: cat.spent,
      color: chartColors[idx % chartColors.length],
    }));

    return (
      <BaseWidget loading={loading} error={error}>
        {segments.length > 0 ? (
          <DonutChart
            segments={segments}
            centerValue={formatAmount(totalSpent)}
            centerLabel={hideLabels ? undefined : 'spent'}
            responsive
            showLegend={!hideLabels}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No spending this month
          </div>
        )}
      </BaseWidget>
    );
  }

  // List visualization - simple list without progress bars
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col h-full overflow-hidden">
          {!hideLabels && (
            <div className="px-3 py-2 border-b border-gray-700/50">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total Spent</span>
                <span className="text-lg font-semibold text-orange-400">
                  {formatAmount(totalSpent)}
                </span>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-1 p-2">
              {displayedCategories.map((category, idx) => (
                <div key={category.categoryId} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: chartColors[idx % chartColors.length] }}
                  />
                  <span className="flex-1 truncate text-gray-200">{category.categoryName}</span>
                  <span className="flex-shrink-0 text-gray-200 font-medium">
                    {formatAmount(category.spent)}
                  </span>
                </div>
              ))}
              {displayedCategories.length === 0 && (
                <div className="text-center text-gray-500 text-sm">No spending this month</div>
              )}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: Bars visualization with progress bars
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Total header */}
        {!hideLabels && (
          <div className="px-3 py-2 border-b border-gray-700/50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Spent</span>
              <span className="text-lg font-semibold text-orange-400">
                {formatAmount(totalSpent)}
              </span>
            </div>
          </div>
        )}

        {/* Category list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-800/30">
            {displayedCategories.map((category) => {
              const percentage =
                category.budgeted > 0
                  ? Math.round((category.spent / category.budgeted) * 100)
                  : 0;
              const isOverspent = category.budgeted > 0 && category.spent > category.budgeted;

              return (
                <div key={category.categoryId} className="px-3 py-2 hover:bg-gray-800/20">
                  <div className="flex justify-between items-start mb-1">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-200 truncate">{category.categoryName}</div>
                      {showGroup && !hideLabels && (
                        <div className="text-xs text-gray-500 truncate">{category.groupName}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${isOverspent ? 'text-red-400' : 'text-gray-200'}`}>
                        {formatAmount(category.spent)}
                      </div>
                      {showBudget && category.budgeted > 0 && !hideLabels && (
                        <div className="text-xs text-gray-500">
                          of {formatAmount(category.budgeted)}
                        </div>
                      )}
                    </div>
                  </div>

                  {showProgress && category.budgeted > 0 && (
                    <div className="mt-1">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isOverspent ? 'bg-red-500' : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        />
                      </div>
                      {isOverspent && !hideLabels && (
                        <div className="text-xs text-red-400 mt-0.5">
                          {percentage}% - Over by {formatAmount(category.spent - category.budgeted)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {displayedCategories.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">No spending this month</div>
            )}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
