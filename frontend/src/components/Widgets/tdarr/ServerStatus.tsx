import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { TdarrStatus } from '../../../types';

interface ServerStatusData {
  status: TdarrStatus;
}

interface ServerStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (60 * 60 * 24));
  const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60));
  const mins = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function ServerStatus({ integrationId, config, widgetId }: ServerStatusProps) {
  const { data, loading, error } = useWidgetData<ServerStatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
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

  const spaceSaved = Math.abs(status.sizeDiff);

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={status.totalFileCount.toLocaleString()}
                className="text-purple-600 dark:text-purple-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Files</div>}
            </div>
            <div>
              <ScaledMetric
                value={formatBytes(spaceSaved)}
                className="text-green-600 dark:text-green-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Saved</div>}
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
            <span className="text-gray-900 dark:text-white">{status.version || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Uptime</span>
            <span className="text-gray-900 dark:text-white">{formatUptime(status.uptime)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Files</span>
            <span className="text-gray-900 dark:text-white">{status.totalFileCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Space Saved</span>
            <span className="text-green-600 dark:text-green-400">{formatBytes(spaceSaved)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Transcodes</span>
            <span className="text-gray-900 dark:text-white">{status.totalTranscodeCount.toLocaleString()}</span>
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
        <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-100 dark:border-purple-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Tdarr {status.version ? `v${status.version}` : ''}
              </h4>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Uptime: {formatUptime(status.uptime)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Files</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {status.totalFileCount.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Space Saved</div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatBytes(spaceSaved)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Transcodes</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {status.totalTranscodeCount.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Health Checks</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {status.totalHealthCheckCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
