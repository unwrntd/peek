import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { QBittorrentStatus, QBittorrentTorrent, QBittorrentCategory } from '../../../types';
import { formatBytes, formatSpeed } from '../../../utils/formatting';

interface ServerStatusData {
  status: QBittorrentStatus;
  torrents: QBittorrentTorrent[];
  categories: Record<string, QBittorrentCategory>;
}

interface ServerStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getConnectionStatusColor(status: string): string {
  switch (status) {
    case 'connected':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'firewalled':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    case 'disconnected':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  }
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

  // Configurable disk space thresholds (in GB) with defaults
  const diskWarningGB = (config.diskWarningGB as number) || 50;
  const diskCriticalGB = (config.diskCriticalGB as number) || 10;

  const getDiskSpaceColor = (freeSpaceGB: number): string => {
    if (freeSpaceGB <= diskCriticalGB) return 'text-red-600 dark:text-red-400';
    if (freeSpaceGB <= diskWarningGB) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-900 dark:text-white';
  };

  const getDiskSpaceBgColor = (freeSpaceGB: number): string => {
    if (freeSpaceGB <= diskCriticalGB) return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50';
    if (freeSpaceGB <= diskWarningGB) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800/50';
    return 'bg-gray-50 dark:bg-gray-700/50';
  };

  const status = data?.status;
  const torrents = data?.torrents || [];

  if (!status) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No status data available
        </div>
      </BaseWidget>
    );
  }

  const downloading = torrents.filter(t =>
    ['downloading', 'forcedDL', 'metaDL', 'stalledDL', 'queuedDL', 'checkingDL', 'allocating'].includes(t.state)
  ).length;
  const seeding = torrents.filter(t =>
    ['uploading', 'forcedUP', 'stalledUP', 'queuedUP', 'checkingUP'].includes(t.state)
  ).length;

  const freeSpaceGB = status.freeSpaceOnDisk / (1024 * 1024 * 1024);

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <ScaledMetric
                value={formatSpeed(status.downloadSpeed)}
                className="text-green-600 dark:text-green-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500">Download</div>}
            </div>
            <div>
              <ScaledMetric
                value={formatSpeed(status.uploadSpeed)}
                className="text-blue-600 dark:text-blue-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500">Upload</div>}
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
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <span className={getConnectionStatusColor(status.connectionStatus).replace('bg-', 'text-').replace('-100', '-600').replace('-700', '-400')}>
              {status.connectionStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Download</span>
            <span className="text-green-600 dark:text-green-400">{formatSpeed(status.downloadSpeed)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Upload</span>
            <span className="text-blue-600 dark:text-blue-400">{formatSpeed(status.uploadSpeed)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Torrents</span>
            <span className="text-gray-900 dark:text-white">{torrents.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Ratio</span>
            <span className="text-gray-900 dark:text-white">{status.globalRatio}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Free Space</span>
            <span className={getDiskSpaceColor(freeSpaceGB)}>{freeSpaceGB.toFixed(1)} GB</span>
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
        <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-100 dark:border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                qBittorrent {status.version}
              </h4>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className={`px-1.5 py-0.5 rounded ${getConnectionStatusColor(status.connectionStatus)}`}>
                  {status.connectionStatus}
                </span>
                {status.useAltSpeedLimits && (
                  <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                    Alt Speed
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {torrents.length} torrents
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Speed Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <p className="text-xs text-gray-500 dark:text-gray-400">Download</p>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatSpeed(status.downloadSpeed)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <p className="text-xs text-gray-500 dark:text-gray-400">Upload</p>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatSpeed(status.uploadSpeed)}
            </p>
          </div>
        </div>

        {/* Torrent Counts */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
            <p className="text-lg font-semibold text-green-700 dark:text-green-400">{downloading}</p>
            <p className="text-xs text-green-600 dark:text-green-500">Downloading</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
            <p className="text-lg font-semibold text-blue-700 dark:text-blue-400">{seeding}</p>
            <p className="text-xs text-blue-600 dark:text-blue-500">Seeding</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">{status.totalPeerConnections}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Peers</p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className={`flex items-center justify-between p-2 rounded-lg border ${getDiskSpaceBgColor(freeSpaceGB)}`}>
            <span className="text-gray-500 dark:text-gray-400">Free Space</span>
            <span className={`font-medium ${getDiskSpaceColor(freeSpaceGB)}`}>{freeSpaceGB.toFixed(1)} GB</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <span className="text-gray-500 dark:text-gray-400">DHT Nodes</span>
            <span className="font-medium text-gray-900 dark:text-white">{status.dhtNodes}</span>
          </div>
        </div>

        {/* Global Ratio */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Global Ratio</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.globalRatio}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">All-time</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {formatBytes(status.allTimeDownload)} / {formatBytes(status.allTimeUpload)}
            </p>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
