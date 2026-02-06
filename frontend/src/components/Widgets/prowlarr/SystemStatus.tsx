import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { ProwlarrSystemStatus, ProwlarrHealth } from '../../../types';

interface SystemStatusData {
  systemStatus: ProwlarrSystemStatus;
  health: ProwlarrHealth[];
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
    metric: 'system-status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const status = data?.systemStatus;
  const health = data?.health || [];

  if (!status) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No status data available
        </div>
      </BaseWidget>
    );
  }

  const errorCount = health.filter(h => h.type === 'error').length;
  const warningCount = health.filter(h => h.type === 'warning').length;

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={data?.health?.length === 0 ? 'Healthy' : `${errorCount + warningCount}`}
                className={errorCount > 0 ? 'text-red-600 dark:text-red-400' : warningCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Health</div>}
            </div>
            <div>
              <ScaledMetric
                value={formatUptime(status.startTime)}
                className="text-blue-600 dark:text-blue-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Uptime</div>}
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
            <span className="text-gray-500 dark:text-gray-400">Version</span>
            <span className="text-gray-900 dark:text-white">{status.version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Uptime</span>
            <span className="text-gray-900 dark:text-white">{formatUptime(status.startTime)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Branch</span>
            <span className="text-gray-900 dark:text-white">{status.branch}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Health</span>
            <span className={errorCount > 0 ? 'text-red-600 dark:text-red-400' : warningCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
              {errorCount > 0 ? `${errorCount} error${errorCount !== 1 ? 's' : ''}` : warningCount > 0 ? `${warningCount} warning${warningCount !== 1 ? 's' : ''}` : 'OK'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">OS</span>
            <span className="text-gray-900 dark:text-white truncate max-w-[50%]">{status.osName}</span>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Server Info Card */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-100 dark:border-orange-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Prowlarr v{status.version}
              </h4>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Uptime: {formatUptime(status.startTime)}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {status.branch}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Health Status */}
        {health.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Health Issues</div>
            {health.slice(0, 3).map((item, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                  item.type === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                }`}
              >
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {item.type === 'error' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  )}
                </svg>
                <span className="line-clamp-2">{item.message}</span>
              </div>
            ))}
            {health.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                +{health.length - 3} more issues
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">No health issues</span>
          </div>
        )}

        {/* OS Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">OS</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{status.osName}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Issues</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {errorCount > 0 && <span className="text-red-600 dark:text-red-400">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
              {errorCount > 0 && warningCount > 0 && ', '}
              {warningCount > 0 && <span className="text-yellow-600 dark:text-yellow-400">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
              {errorCount === 0 && warningCount === 0 && <span className="text-green-600 dark:text-green-400">None</span>}
            </p>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
