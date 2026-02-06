import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface StatsData {
  stats: {
    totalEvents: number;
    totalAlerts: number;
    totalFirewallEvents: number;
    totalSyscheck: number;
    hourly: Array<{
      hour?: number;
      events?: number;
      alerts?: number;
    }>;
    raw: Array<{
      total_events?: number;
      alerts?: number;
    }>;
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
    metric: 'stats',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const stats = data?.stats;
  const isMetricSize = config.metricSize === true;

  if (isMetricSize) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-3xl font-bold text-white mb-1">
            {formatNumber(stats?.totalEvents || 0)}
          </div>
          <div className="text-sm text-gray-400">total events</div>
          {stats && (
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-yellow-400">{formatNumber(stats.totalAlerts)} alerts</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-4">
        <div className="text-sm font-medium text-gray-400 mb-3">Manager Statistics</div>

        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs text-gray-400">Events</span>
              </div>
              <div className="text-xl font-bold text-white">{formatNumber(stats.totalEvents)}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs text-gray-400">Alerts</span>
              </div>
              <div className="text-xl font-bold text-yellow-400">{formatNumber(stats.totalAlerts)}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                <span className="text-xs text-gray-400">Firewall</span>
              </div>
              <div className="text-xl font-bold text-orange-400">{formatNumber(stats.totalFirewallEvents)}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-gray-400">Syscheck</span>
              </div>
              <div className="text-xl font-bold text-green-400">{formatNumber(stats.totalSyscheck)}</div>
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
