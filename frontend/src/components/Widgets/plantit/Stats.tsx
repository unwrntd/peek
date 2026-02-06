import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { ScaledMetric } from '../../common/ScaledMetric';

interface StatsData {
  statistics: {
    plantCount: number;
    eventCount: number;
    reminderCount: number;
    photoCount: number;
    speciesCount: number;
    overdueReminders: number;
  };
}

interface StatsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function Stats({ integrationId, config, widgetId }: StatsWidgetProps) {
  const { data, loading, error } = useWidgetData<StatsData>({
    integrationId,
    metric: 'statistics',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'numbers';
  const hideLabels = (config.hideLabels as boolean) || false;
  const stats = data?.statistics;
  const isMetricSize = config.metricSize === true;

  // Numbers visualization - large metrics
  if (visualization === 'numbers') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={formatNumber(stats?.plantCount || 0)}
                className="text-green-600 dark:text-green-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Plants</div>}
            </div>
            <div>
              <ScaledMetric
                value={formatNumber(stats?.overdueReminders || 0)}
                className={stats?.overdueReminders ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Overdue</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Plants</span>
            <span className="text-gray-900 dark:text-white">{formatNumber(stats?.plantCount || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Species</span>
            <span className="text-gray-900 dark:text-white">{formatNumber(stats?.speciesCount || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Events</span>
            <span className="text-gray-900 dark:text-white">{formatNumber(stats?.eventCount || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Reminders</span>
            <span className={stats?.overdueReminders ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}>
              {formatNumber(stats?.reminderCount || 0)} ({stats?.overdueReminders || 0} overdue)
            </span>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (isMetricSize) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-3xl font-bold text-white mb-1">
            {formatNumber(stats?.plantCount || 0)}
          </div>
          <div className="text-sm text-gray-400">plants</div>
          {stats && stats.overdueReminders > 0 && (
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-orange-400">{stats.overdueReminders} overdue</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization (default)
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-4">
        <div className="text-sm font-medium text-gray-400 mb-3">Garden Statistics</div>

        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-xs text-gray-400">Plants</span>
              </div>
              <div className="text-xl font-bold text-white">{formatNumber(stats.plantCount)}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="text-xs text-gray-400">Species</span>
              </div>
              <div className="text-xl font-bold text-blue-400">{formatNumber(stats.speciesCount)}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-xs text-gray-400">Events</span>
              </div>
              <div className="text-xl font-bold text-purple-400">{formatNumber(stats.eventCount)}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="text-xs text-gray-400">Reminders</span>
              </div>
              <div className={`text-xl font-bold ${stats.overdueReminders > 0 ? 'text-orange-400' : 'text-white'}`}>
                {formatNumber(stats.reminderCount)}
              </div>
              {stats.overdueReminders > 0 && (
                <div className="text-xs text-orange-400 mt-1">{stats.overdueReminders} overdue</div>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
