import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { BazarrStatus } from '../../../types';
import { ScaledMetric } from '../../common/ScaledMetric';

interface SystemStatusData {
  status: BazarrStatus;
}

interface SystemStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatUptime(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function SystemStatus({ integrationId, config, widgetId }: SystemStatusProps) {
  const { data, loading, error } = useWidgetData<SystemStatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const showVersion = config.showVersion !== false;
  const showUptime = config.showUptime !== false;
  const showProviders = config.showProviders !== false;
  const status = data?.status;

  if (!status) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No status data available
        </div>
      </BaseWidget>
    );
  }

  const uptime = formatUptime(status.startTime);

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          {showVersion && showUptime ? (
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">v{status.version}</div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Version</div>}
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{uptime}</div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Uptime</div>}
              </div>
            </div>
          ) : showVersion ? (
            <ScaledMetric value={`v${status.version}`} className="text-yellow-600 dark:text-yellow-400" />
          ) : showUptime ? (
            <ScaledMetric value={uptime} className="text-green-600 dark:text-green-400" />
          ) : (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xl font-bold">Online</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization - minimal list
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          {showVersion && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Version</span>
              <span className="font-medium text-gray-900 dark:text-white">v{status.version}</span>
            </div>
          )}
          {showUptime && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Uptime</span>
              <span className="font-medium text-green-600 dark:text-green-400">{uptime}</span>
            </div>
          )}
          {showProviders && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Python</span>
                <span className="font-medium text-gray-900 dark:text-white">{status.pythonVersion}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Timezone</span>
                <span className="font-medium text-gray-900 dark:text-white">{status.timezone}</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Online</span>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* System Info Card */}
        {showVersion && (
          <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-100 dark:border-yellow-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/40">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Bazarr v{status.version}
                </h4>
                {showUptime && !hideLabels && (
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Uptime: {uptime}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        {showProviders && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
              {!hideLabels && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Python</p>}
              <p className="text-sm font-medium text-gray-900 dark:text-white">{status.pythonVersion}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
              {!hideLabels && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timezone</p>}
              <p className="text-sm font-medium text-gray-900 dark:text-white">{status.timezone}</p>
            </div>
          </div>
        )}

        {/* Online Status */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {!hideLabels && <span className="text-sm">System online and running</span>}
        </div>
      </div>
    </BaseWidget>
  );
}
