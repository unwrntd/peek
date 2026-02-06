import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { NetAlertXSessionTotals } from '../../../types';

interface SessionStatsData {
  stats: NetAlertXSessionTotals;
}

interface SessionStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function SessionStats({ integrationId, config, widgetId }: SessionStatsProps) {
  const { data, loading, error } = useWidgetData<SessionStatsData>({
    integrationId,
    metric: 'session-stats',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const hideLabels = config.hideLabels === true;
  const metricSize = (config.metricSize as string) || 'default';

  const stats = data?.stats;

  const getTextSize = () => {
    if (metricSize === 'small') return 'text-lg';
    if (metricSize === 'large') return 'text-3xl';
    return 'text-2xl';
  };

  const getLabelSize = () => {
    return 'text-xs';
  };

  const statItems = [
    {
      label: 'Total',
      value: stats?.total ?? 0,
      color: 'text-gray-700 dark:text-gray-300',
      bgColor: 'bg-gray-100 dark:bg-gray-700/50',
    },
    {
      label: 'Sessions',
      value: stats?.sessions ?? 0,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Missing',
      value: stats?.missing ?? 0,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    {
      label: 'Voided',
      value: stats?.voided ?? 0,
      color: 'text-gray-500 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-700/30',
    },
    {
      label: 'New Devices',
      value: stats?.newDevices ?? 0,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Down',
      value: stats?.down ?? 0,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
  ];

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="grid grid-cols-3 gap-2">
        {statItems.map((stat) => (
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
