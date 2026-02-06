import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { SABnzbdServerStats } from '../../../types';

interface ServerStatsData {
  stats: SABnzbdServerStats;
}

interface ServerStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function ServerStats({ integrationId, config, widgetId }: ServerStatsProps) {
  const { data, loading, error } = useWidgetData<ServerStatsData>({
    integrationId,
    metric: 'server-stats',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'bars';
  const hideLabels = (config.hideLabels as boolean) || false;
  const stats = data?.stats;
  const timePeriod = (config.timePeriod as string) || 'week';

  if (!stats) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No server stats available
        </div>
      </BaseWidget>
    );
  }

  // Get the value for the selected time period
  const getValue = (period: string): number => {
    switch (period) {
      case 'day': return stats.day;
      case 'week': return stats.week;
      case 'month': return stats.month;
      case 'total': return stats.total;
      default: return stats.week;
    }
  };

  const periodLabels: Record<string, string> = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    total: 'All Time',
  };

  const serverEntries = Object.entries(stats.servers || {});

  // List visualization - simple stat list
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2 text-sm">
          {(['day', 'week', 'month', 'total'] as const).map((period) => (
            <div key={period} className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400 capitalize">{periodLabels[period]}</span>
              <span className={`font-medium ${period === timePeriod ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                {formatBytes(getValue(period))}
              </span>
            </div>
          ))}
          {serverEntries.length > 0 && !hideLabels && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
              <div className="text-xs text-gray-500 mb-2">Servers</div>
              {serverEntries.map(([serverName, serverStats]) => (
                <div key={serverName} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 truncate">{serverName}</span>
                  <span className="text-gray-500">{formatBytes(serverStats[timePeriod as keyof typeof serverStats] as number || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization - server cards
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-3">
          {/* Main stat */}
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 text-center">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatBytes(getValue(timePeriod))}
            </p>
            {!hideLabels && (
              <p className="text-xs text-emerald-600 dark:text-emerald-500">{periodLabels[timePeriod]}</p>
            )}
          </div>
          {/* Server cards */}
          {serverEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {serverEntries.map(([serverName, serverStats]) => {
                const successRate = serverStats.articles_tried > 0
                  ? (serverStats.articles_success / serverStats.articles_tried * 100)
                  : 100;
                return (
                  <div key={serverName} className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{serverName}</p>
                    <p className="text-xs text-gray-500">{formatBytes(serverStats[timePeriod as keyof typeof serverStats] as number || 0)}</p>
                    {!hideLabels && serverStats.articles_tried > 0 && (
                      <p className={`text-xs ${successRate >= 95 ? 'text-green-600' : successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {successRate.toFixed(1)}% success
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Bars visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Total Stats */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{periodLabels[timePeriod]}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBytes(getValue(timePeriod))}
              </p>
            </div>
          </div>
        </div>

        {/* Time Period Breakdown */}
        <div className="grid grid-cols-4 gap-2">
          {(['day', 'week', 'month', 'total'] as const).map((period) => (
            <div
              key={period}
              className={`p-2 rounded-lg text-center ${
                period === timePeriod
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-gray-50 dark:bg-gray-700/50'
              }`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{period}</p>
              <p className={`text-sm font-semibold ${
                period === timePeriod
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {formatBytes(getValue(period))}
              </p>
            </div>
          ))}
        </div>

        {/* Per-Server Stats */}
        {serverEntries.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Server Statistics
            </div>
            {serverEntries.map(([serverName, serverStats]) => {
              const successRate = serverStats.articles_tried > 0
                ? (serverStats.articles_success / serverStats.articles_tried * 100)
                : 100;

              const serverValue = (() => {
                switch (timePeriod) {
                  case 'day': return serverStats.day;
                  case 'week': return serverStats.week;
                  case 'month': return serverStats.month;
                  case 'total': return serverStats.total;
                  default: return serverStats.week;
                }
              })();

              return (
                <div
                  key={serverName}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[60%]">
                      {serverName}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {formatBytes(serverValue)}
                    </span>
                  </div>

                  {/* Article Success Rate */}
                  {serverStats.articles_tried > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">Article Success</span>
                        <span className={`font-medium ${
                          successRate >= 95 ? 'text-green-600 dark:text-green-400' :
                          successRate >= 80 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {successRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            successRate >= 95 ? 'bg-green-500' :
                            successRate >= 80 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(successRate, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{serverStats.articles_success.toLocaleString()} success</span>
                        <span>{serverStats.articles_tried.toLocaleString()} tried</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {serverEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400">
            <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <p className="text-sm">No server data available</p>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
