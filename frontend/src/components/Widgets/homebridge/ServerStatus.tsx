import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { HomebridgeCombinedStatus } from '../../../types';
import { formatBytes } from '../../../utils/formatting';

interface ServerStatusData {
  status: HomebridgeCombinedStatus;
}

interface ServerStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function ServerStatus({ integrationId, config, widgetId }: ServerStatusProps) {
  const { data, loading, error } = useWidgetData<ServerStatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const showCpu = config.showCpu !== false;
  const showRam = config.showRam !== false;
  const showNodeVersion = config.showNodeVersion !== false;

  const status = data?.status;

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          {status ? (
            <div className="text-center">
              <ScaledMetric
                value={status.status.status === 'up' ? 'Online' : status.status.status}
                className={status.status.status === 'up' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}
              />
              {!hideLabels && (
                <div className="text-sm text-gray-500 mt-1">v{status.status.packageVersion || '?'}</div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No data</div>
          )}
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
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <span className={status?.status.status === 'up' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
              {status?.status.status || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Version</span>
            <span className="text-gray-900 dark:text-white">v{status?.status.packageVersion || '?'}</span>
          </div>
          {showNodeVersion && status?.serverInfo.nodeVersion && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Node.js</span>
              <span className="text-gray-900 dark:text-white">{status.serverInfo.nodeVersion}</span>
            </div>
          )}
          {showCpu && status?.cpu && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">CPU</span>
              <span className="text-gray-900 dark:text-white">
                {status.cpu.currentLoad?.toFixed(0) || 0}%
                {status.cpu.cpuTemperature?.main && ` (${status.cpu.cpuTemperature.main.toFixed(0)}°C)`}
              </span>
            </div>
          )}
          {showRam && status?.ram?.mem && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">RAM</span>
              <span className="text-gray-900 dark:text-white">
                {formatBytes(status.ram.mem.used)} / {formatBytes(status.ram.mem.total)}
              </span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Status and Version Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Homebridge Icon */}
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {status?.status.name || 'Homebridge'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                v{status?.status.packageVersion || '?'}
              </p>
            </div>
          </div>
          {/* Status Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status?.status.status === 'up'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : status?.status.status === 'pending'
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {status?.status.status || 'Unknown'}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {showNodeVersion && status?.serverInfo.nodeVersion && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Node.js</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {status.serverInfo.nodeVersion}
              </p>
            </div>
          )}

          {showCpu && status?.cpu && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">CPU</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {status.cpu.currentLoad?.toFixed(0) || 0}%
                </p>
                {status.cpu.cpuTemperature?.main && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {status.cpu.cpuTemperature.main.toFixed(0)}°C
                  </span>
                )}
              </div>
            </div>
          )}

          {showRam && status?.ram?.mem && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">RAM</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatBytes(status.ram.mem.used)} / {formatBytes(status.ram.mem.total)}
              </p>
            </div>
          )}
        </div>

        {/* Insecure Mode Indicator */}
        {status?.insecureMode !== undefined && (
          <div className={`flex items-center gap-2 text-xs ${
            status.insecureMode
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {status.insecureMode ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              )}
            </svg>
            <span>
              {status.insecureMode ? 'Insecure mode enabled' : 'Insecure mode disabled'}
            </span>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
