import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { ScaledMetric } from '../../common/ScaledMetric';

interface NetWorthData {
  netWorth: {
    total: number;
    assets: number;
    liabilities: number;
    accounts: Array<{ name: string; balance: number; type: string }>;
  };
}

interface NetWorthWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatAmount(amount: number): string {
  // Actual Budget stores amounts as integers (cents)
  const value = amount / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function NetWorth({ integrationId, config, widgetId }: NetWorthWidgetProps) {
  const { data, loading, error } = useWidgetData<NetWorthData>({
    integrationId,
    metric: 'net-worth',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'number';
  const hideLabels = (config.hideLabels as boolean) || false;
  const netWorth = data?.netWorth;
  const showBreakdown = config.showBreakdown !== false;
  const showAccounts = config.showAccounts === true;

  const isPositive = netWorth && netWorth.total >= 0;

  // Number visualization - large metric
  if (visualization === 'number') {
    return (
      <BaseWidget loading={loading} error={error}>
        <ScaledMetric
          value={netWorth ? formatAmount(netWorth.total) : '$0'}
          className={isPositive ? 'text-green-400' : 'text-red-400'}
        />
      </BaseWidget>
    );
  }

  // Breakdown visualization - shows assets/liabilities
  if (visualization === 'breakdown') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col h-full p-3">
          <div className="text-center mb-4">
            <div className={`text-3xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {netWorth ? formatAmount(netWorth.total) : '$0'}
            </div>
            {!hideLabels && <div className="text-xs text-gray-500 mt-1">Net Worth</div>}
          </div>
          {netWorth && (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <div className="text-xl font-bold text-green-400">{formatAmount(netWorth.assets)}</div>
                {!hideLabels && <div className="text-xs text-gray-500 mt-1">Assets</div>}
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <div className="text-xl font-bold text-red-400">{formatAmount(netWorth.liabilities)}</div>
                {!hideLabels && <div className="text-xs text-gray-500 mt-1">Liabilities</div>}
              </div>
            </div>
          )}
          {showAccounts && netWorth?.accounts && (
            <div className="mt-3 flex-1 overflow-y-auto">
              <div className="space-y-1">
                {netWorth.accounts.map((account, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-gray-400 truncate">{account.name}</span>
                    <span className={account.balance >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {formatAmount(account.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Card visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-2">
        {/* Main metric value */}
        <div className="text-center flex-shrink-0">
          <div className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {netWorth ? formatAmount(netWorth.total) : '$0'}
          </div>
          {!hideLabels && <div className="text-xs text-gray-500 mt-1">Net Worth</div>}
        </div>

        {showBreakdown && netWorth && (
          <div className="mt-3 flex justify-between text-xs">
            <div className="text-center">
              <div className="text-green-400 font-medium">{formatAmount(netWorth.assets)}</div>
              {!hideLabels && <div className="text-gray-500">Assets</div>}
            </div>
            <div className="text-center">
              <div className="text-red-400 font-medium">{formatAmount(netWorth.liabilities)}</div>
              {!hideLabels && <div className="text-gray-500">Liabilities</div>}
            </div>
          </div>
        )}

        {showAccounts && netWorth?.accounts && (
          <div className="mt-3 flex-1 overflow-y-auto">
            <div className="space-y-1">
              {netWorth.accounts.map((account, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-gray-400 truncate">{account.name}</span>
                  <span className={account.balance >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatAmount(account.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
