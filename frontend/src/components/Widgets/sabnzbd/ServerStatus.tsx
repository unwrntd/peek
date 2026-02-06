import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { SABnzbdStatus, SABnzbdQueue, SABnzbdWarning } from '../../../types';

interface ServerStatusData {
  status: SABnzbdStatus;
  warnings: SABnzbdWarning[];
  queue: SABnzbdQueue;
}

interface ServerStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatSpeed(speed: string): string {
  const num = parseFloat(speed);
  if (isNaN(num) || num === 0) return '0 B/s';
  if (num >= 1024) return `${(num / 1024).toFixed(1)} GB/s`;
  return `${num.toFixed(1)} MB/s`;
}

function formatDiskSpace(used: string, total: string): { usedNum: number; totalNum: number; percent: number } {
  const usedNum = parseFloat(used) || 0;
  const totalNum = parseFloat(total) || 1;
  const percent = totalNum > 0 ? (usedNum / totalNum) * 100 : 0;
  return { usedNum, totalNum, percent };
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

  const status = data?.status;
  const warnings = data?.warnings || [];
  const queue = data?.queue;

  if (!status) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No status data available
        </div>
      </BaseWidget>
    );
  }

  const diskSpace1 = formatDiskSpace(
    status.diskspace1,
    status.diskspacetotal1
  );
  const freePercent1 = 100 - diskSpace1.percent;
  const warningCount = warnings.length;
  const currentSpeed = queue?.speed || status.speedlimit_abs || '0';
  const isPaused = queue?.paused || status.paused;

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <ScaledMetric
              value={formatSpeed(currentSpeed)}
              className={isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}
            />
            {!hideLabels && (
              <div className="text-sm text-gray-500 mt-1">
                {isPaused ? 'Paused' : 'Download Speed'}
              </div>
            )}
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
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <span className={isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
              {isPaused ? 'Paused' : 'Active'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Speed</span>
            <span className="text-gray-900 dark:text-white">{formatSpeed(currentSpeed)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Queue</span>
            <span className="text-gray-900 dark:text-white">{queue?.noofslots_total || 0} items</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">ETA</span>
            <span className="text-gray-900 dark:text-white">{queue?.timeleft || '0:00:00'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Disk Free</span>
            <span className={`${freePercent1 < 10 ? 'text-red-600 dark:text-red-400' : freePercent1 < 25 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
              {diskSpace1.usedNum.toFixed(1)} GB
            </span>
          </div>
          {warningCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Warnings</span>
              <span className="text-yellow-600 dark:text-yellow-400">{warningCount}</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Server Info Card */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-100 dark:border-yellow-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/40">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                SABnzbd v{status.version}
              </h4>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className={`px-1.5 py-0.5 rounded ${
                  isPaused
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}>
                  {isPaused ? 'Paused' : 'Active'}
                </span>
                {queue && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {queue.noofslots_total} in queue
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Speed and Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Speed</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatSpeed(currentSpeed)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ETA</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {queue?.timeleft || '0:00:00'}
            </p>
          </div>
        </div>

        {/* Disk Space */}
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Disk Space</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {diskSpace1.usedNum.toFixed(1)} / {diskSpace1.totalNum.toFixed(1)} GB free
            </p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                freePercent1 < 10 ? 'bg-red-500' : freePercent1 < 25 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(freePercent1, 100)}%` }}
            />
          </div>
        </div>

        {/* Warnings */}
        {warningCount > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Warnings ({warningCount})
            </div>
            {warnings.slice(0, 2).map((warning, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 rounded-lg text-sm bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
              >
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="line-clamp-2">{warning.text}</span>
              </div>
            ))}
            {warningCount > 2 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                +{warningCount - 2} more warnings
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">No warnings</span>
          </div>
        )}

        {/* Servers */}
        {status.servers && status.servers.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Servers</div>
            {status.servers.map((server, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                  server.serveractive
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    server.serveractive ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                    {server.servername}
                  </span>
                  {server.serverssl && (
                    <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {server.serveractiveconn}/{server.servertotalconn}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
