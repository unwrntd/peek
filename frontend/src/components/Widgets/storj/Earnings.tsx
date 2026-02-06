import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface EarningsData {
  currentMonth: {
    storage: number;
    egress: number;
    repair: number;
    audit: number;
    total: number;
  };
  payout: {
    held: number;
    paid: number;
    disposed: number;
  };
  history: Array<{
    month: string;
    storage: number;
    egress: number;
    total: number;
  }>;
}

interface EarningsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 0.01 && dollars > 0) return '<$0.01';
  return `$${dollars.toFixed(2)}`;
}

export function Earnings({ integrationId, config, widgetId }: EarningsWidgetProps) {
  const { data, loading, error } = useWidgetData<EarningsData>({
    integrationId,
    metric: 'earnings',
    refreshInterval: (config.refreshInterval as number) || 300000, // 5 minutes
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Loading earnings...</p>
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
          <div className="text-3xl font-bold text-green-400 mb-4">
            {formatCurrency(data.currentMonth.total)}
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs w-full max-w-xs">
            <div className="text-center">
              <div className="text-gray-500">Held</div>
              <div className="text-yellow-400">{formatCurrency(data.payout.held)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">Paid Out</div>
              <div className="text-green-400">{formatCurrency(data.payout.paid)}</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default cards view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="text-xs text-gray-500 mb-2 px-1">Current Month Earnings</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-lg font-semibold text-green-400">{formatCurrency(data.currentMonth.total)}</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500">Egress</div>
            <div className="text-lg font-semibold text-blue-400">{formatCurrency(data.currentMonth.egress)}</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500">Storage</div>
            <div className="text-lg font-semibold text-purple-400">{formatCurrency(data.currentMonth.storage)}</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500">Repair/Audit</div>
            <div className="text-lg font-semibold text-gray-400">
              {formatCurrency(data.currentMonth.repair + data.currentMonth.audit)}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-2">
          <div className="text-xs text-gray-500 mb-2">Payout Status</div>
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500">Held: </span>
              <span className="text-yellow-400">{formatCurrency(data.payout.held)}</span>
            </div>
            <div>
              <span className="text-gray-500">Paid: </span>
              <span className="text-green-400">{formatCurrency(data.payout.paid)}</span>
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
