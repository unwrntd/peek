import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { CircularGauge } from '../../common/visualizations';
import { QBittorrentStatus, QBittorrentTorrent, QBittorrentCategory } from '../../../types';
import { formatBytes, formatSpeed } from '../../../utils/formatting';

interface TransferStatsData {
  status: QBittorrentStatus;
  torrents: QBittorrentTorrent[];
  categories: Record<string, QBittorrentCategory>;
}

interface TransferStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function TransferStats({ integrationId, config, widgetId }: TransferStatsProps) {
  const { data, loading, error } = useWidgetData<TransferStatsData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'numbers';
  const hideLabels = (config.hideLabels as boolean) || false;
  const status = data?.status;
  const showAllTime = config.showAllTime !== false;
  const showLimits = config.showLimits !== false;

  if (!status) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No transfer data available
        </div>
      </BaseWidget>
    );
  }

  // Numbers visualization - large metrics
  if (visualization === 'numbers') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={formatSpeed(status.downloadSpeed)}
                className="text-green-600 dark:text-green-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Download</div>}
            </div>
            <div>
              <ScaledMetric
                value={formatSpeed(status.uploadSpeed)}
                className="text-blue-600 dark:text-blue-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Upload</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Gauges visualization
  if (visualization === 'gauges') {
    const maxSpeed = Math.max(status.downloadSpeedLimit || 10000000, status.uploadSpeedLimit || 10000000);
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full gap-8">
          <div className="flex flex-col items-center">
            <CircularGauge
              value={status.downloadSpeed}
              max={status.downloadSpeedLimit || maxSpeed}
              size="md"
              showValue={false}
            />
            <div className="mt-2 text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatSpeed(status.downloadSpeed)}</div>
              {!hideLabels && <div className="text-xs text-gray-500">Download</div>}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <CircularGauge
              value={status.uploadSpeed}
              max={status.uploadSpeedLimit || maxSpeed}
              size="md"
              showValue={false}
            />
            <div className="mt-2 text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatSpeed(status.uploadSpeed)}</div>
              {!hideLabels && <div className="text-xs text-gray-500">Upload</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Bars visualization - progress bars
  if (visualization === 'bars') {
    const maxSpeed = Math.max(
      status.downloadSpeedLimit || status.downloadSpeed || 1,
      status.uploadSpeedLimit || status.uploadSpeed || 1
    );
    const dlPercent = (status.downloadSpeed / maxSpeed) * 100;
    const ulPercent = (status.uploadSpeed / maxSpeed) * 100;

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500 dark:text-gray-400">Download</span>
              <span className="text-green-600 dark:text-green-400 font-medium">{formatSpeed(status.downloadSpeed)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.min(dlPercent, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500 dark:text-gray-400">Upload</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">{formatSpeed(status.uploadSpeed)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(ulPercent, 100)}%` }}
              />
            </div>
          </div>
          {showAllTime && !hideLabels && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700 text-sm">
              <div>
                <span className="text-gray-500">All-time DL:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{formatBytes(status.allTimeDownload)}</span>
              </div>
              <div>
                <span className="text-gray-500">All-time UL:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{formatBytes(status.allTimeUpload)}</span>
              </div>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default fallback
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Current Speed */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-100 dark:border-green-800/50">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-sm text-green-600 dark:text-green-400">Download</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatSpeed(status.downloadSpeed)}
            </p>
            {showLimits && status.downloadSpeedLimit > 0 && (
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                Limit: {formatSpeed(status.downloadSpeedLimit)}
              </p>
            )}
          </div>

          <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-100 dark:border-blue-800/50">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="text-sm text-blue-600 dark:text-blue-400">Upload</span>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatSpeed(status.uploadSpeed)}
            </p>
            {showLimits && status.uploadSpeedLimit > 0 && (
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                Limit: {formatSpeed(status.uploadSpeedLimit)}
              </p>
            )}
          </div>
        </div>

        {/* All-time Stats */}
        {showAllTime && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">All-time Statistics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Downloaded</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatBytes(status.allTimeDownload)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Uploaded</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatBytes(status.allTimeUpload)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Additional Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.globalRatio}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ratio</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.dhtNodes}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">DHT</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.totalPeerConnections}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Peers</p>
          </div>
        </div>

        {/* Alt Speed Indicator */}
        {status.useAltSpeedLimits && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Alternative speed limits active</span>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
