import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { NetAlertXDeviceTotals } from '../../../types';

interface DeviceOverviewData {
  totals: NetAlertXDeviceTotals;
}

interface DeviceOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function DeviceOverview({ integrationId, config, widgetId }: DeviceOverviewProps) {
  const { data, loading, error } = useWidgetData<DeviceOverviewData>({
    integrationId,
    metric: 'device-totals',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const hideLabels = config.hideLabels === true;
  const metricSize = (config.metricSize as string) || 'default';

  const totals = data?.totals;

  // Scale classes based on metric size
  const getTextSize = () => {
    if (metricSize === 'small') return 'text-lg';
    if (metricSize === 'large') return 'text-4xl';
    return 'text-2xl';
  };

  const getLabelSize = () => {
    return 'text-xs';
  };

  const stats = [
    {
      label: 'Total',
      value: totals?.all ?? 0,
      color: 'text-gray-700 dark:text-gray-300',
      bgColor: 'bg-gray-100 dark:bg-gray-700/50',
    },
    {
      label: 'Online',
      value: totals?.connected ?? 0,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Down',
      value: totals?.down ?? 0,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      label: 'New',
      value: totals?.new ?? 0,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Favorites',
      value: totals?.favorites ?? 0,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    {
      label: 'Archived',
      value: totals?.archived ?? 0,
      color: 'text-gray-500 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-700/30',
    },
  ];

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bgColor} rounded-lg p-2 text-center`}
          >
            <p className={`${getTextSize()} font-bold ${stat.color}`}>
              {stat.value}
            </p>
            {!hideLabels && (
              <p className={`${getLabelSize()} text-gray-500 dark:text-gray-400 mt-0.5`}>
                {stat.label}
              </p>
            )}
          </div>
        ))}
      </div>
    </BaseWidget>
  );
}
