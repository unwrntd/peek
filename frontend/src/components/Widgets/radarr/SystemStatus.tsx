import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RadarrSystemStatus, RadarrDiskSpace, RadarrHealth } from '../../../types';

interface SystemStatusData {
  systemStatus: RadarrSystemStatus;
  diskSpace: RadarrDiskSpace[];
  health: RadarrHealth[];
}

interface SystemStatusProps {
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
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

function getHealthColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'error':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
    case 'warning':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
  }
}

export function SystemStatus({ integrationId, config, widgetId }: SystemStatusProps) {
  const { data, loading, error } = useWidgetData<SystemStatusData>({
    integrationId,
    metric: 'system-status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showDiskSpace = config.showDiskSpace !== false;
  const showHealth = config.showHealth !== false;

  const status = data?.systemStatus;
  const diskSpace = data?.diskSpace || [];
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

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* System Info Card */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-100 dark:border-orange-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Radarr v{status.version}
              </h4>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Uptime: {formatUptime(status.startTime)}
                </span>
                {status.branch && (
                  <span className="bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                    {status.branch}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Disk Space */}
        {showDiskSpace && diskSpace.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Disk Space
            </h5>
            {diskSpace.map((disk, idx) => {
              const usedPercent = Math.round(((disk.totalSpace - disk.freeSpace) / disk.totalSpace) * 100);
              const isLow = usedPercent > 90;
              const isWarning = usedPercent > 75;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                      {disk.path}
                    </span>
                    <span className={`text-xs ${isLow ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {formatBytes(disk.freeSpace)} free
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isLow ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatBytes(disk.totalSpace - disk.freeSpace)} used</span>
                    <span>{usedPercent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Health Issues */}
        {showHealth && health.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Health Issues
            </h5>
            {health.map((issue, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${getHealthColor(issue.type)}`}
              >
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {issue.type.toLowerCase() === 'error' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    )}
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{issue.source}</p>
                    <p className="text-xs mt-0.5 opacity-90">{issue.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Issues */}
        {showHealth && health.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">No health issues detected</span>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
