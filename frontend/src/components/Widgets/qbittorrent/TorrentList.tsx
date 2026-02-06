import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { QBittorrentTorrent, QBittorrentTorrentState } from '../../../types';
import { formatBytes, formatSpeed } from '../../../utils/formatting';

interface TorrentListData {
  torrents: QBittorrentTorrent[];
  downloading: number;
  seeding: number;
  paused: number;
  total: number;
}

interface TorrentListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatEta(seconds: number): string {
  if (seconds < 0 || seconds === 8640000) return '\u221e'; // infinity symbol
  if (seconds === 0) return '-';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getStateInfo(state: QBittorrentTorrentState): { label: string; color: string; icon: string } {
  switch (state) {
    case 'downloading':
    case 'forcedDL':
      return { label: 'Downloading', color: 'text-green-600 dark:text-green-400', icon: 'download' };
    case 'metaDL':
      return { label: 'Metadata', color: 'text-blue-600 dark:text-blue-400', icon: 'search' };
    case 'stalledDL':
      return { label: 'Stalled', color: 'text-yellow-600 dark:text-yellow-400', icon: 'pause' };
    case 'queuedDL':
    case 'queuedUP':
      return { label: 'Queued', color: 'text-gray-600 dark:text-gray-400', icon: 'queue' };
    case 'checkingDL':
    case 'checkingUP':
    case 'checkingResumeData':
      return { label: 'Checking', color: 'text-purple-600 dark:text-purple-400', icon: 'check' };
    case 'uploading':
    case 'forcedUP':
      return { label: 'Seeding', color: 'text-blue-600 dark:text-blue-400', icon: 'upload' };
    case 'stalledUP':
      return { label: 'Seeding', color: 'text-blue-500 dark:text-blue-300', icon: 'upload' };
    case 'pausedDL':
    case 'pausedUP':
      return { label: 'Paused', color: 'text-gray-500 dark:text-gray-400', icon: 'pause' };
    case 'allocating':
      return { label: 'Allocating', color: 'text-orange-600 dark:text-orange-400', icon: 'disk' };
    case 'moving':
      return { label: 'Moving', color: 'text-orange-600 dark:text-orange-400', icon: 'move' };
    case 'error':
    case 'missingFiles':
      return { label: 'Error', color: 'text-red-600 dark:text-red-400', icon: 'error' };
    default:
      return { label: state, color: 'text-gray-600 dark:text-gray-400', icon: 'unknown' };
  }
}

function isDownloading(state: QBittorrentTorrentState): boolean {
  return ['downloading', 'forcedDL', 'metaDL', 'stalledDL', 'queuedDL', 'checkingDL', 'allocating'].includes(state);
}

function isSeeding(state: QBittorrentTorrentState): boolean {
  return ['uploading', 'forcedUP', 'stalledUP', 'queuedUP', 'checkingUP'].includes(state);
}

function isPaused(state: QBittorrentTorrentState): boolean {
  return ['pausedDL', 'pausedUP'].includes(state);
}

export function TorrentList({ integrationId, config, widgetId }: TorrentListProps) {
  const { data, loading, error } = useWidgetData<TorrentListData>({
    integrationId,
    metric: 'torrents',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const torrents = data?.torrents || [];
  const statusFilter = (config.statusFilter as string) || '';
  const itemCount = (config.itemCount as number) || 10;
  const showProgressBar = config.showProgressBar !== false;
  const showEta = config.showEta !== false;
  const showCategory = config.showCategory !== false;
  const showPeers = config.showPeers !== false;

  // Filter torrents
  let filteredTorrents = torrents;
  if (statusFilter === 'downloading') {
    filteredTorrents = torrents.filter(t => isDownloading(t.state));
  } else if (statusFilter === 'seeding') {
    filteredTorrents = torrents.filter(t => isSeeding(t.state));
  } else if (statusFilter === 'paused') {
    filteredTorrents = torrents.filter(t => isPaused(t.state));
  }

  // Sort by: active downloads first, then seeding, then paused
  filteredTorrents = [...filteredTorrents].sort((a, b) => {
    const aDownloading = isDownloading(a.state);
    const bDownloading = isDownloading(b.state);
    if (aDownloading && !bDownloading) return -1;
    if (!aDownloading && bDownloading) return 1;

    // If both are downloading, sort by speed
    if (aDownloading && bDownloading) {
      return b.dlspeed - a.dlspeed;
    }

    const aSeeding = isSeeding(a.state);
    const bSeeding = isSeeding(b.state);
    if (aSeeding && !bSeeding) return -1;
    if (!aSeeding && bSeeding) return 1;

    return 0;
  });

  // Limit items
  const displayTorrents = filteredTorrents.slice(0, itemCount);

  if (displayTorrents.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <span>No torrents</span>
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {displayTorrents.map((torrent) => {
            const stateInfo = getStateInfo(torrent.state);
            const progress = torrent.progress * 100;
            return (
              <div key={torrent.hash} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stateInfo.color.replace('text-', 'bg-')}`} />
                <span className="flex-1 truncate text-gray-200">{torrent.name}</span>
                <span className="flex-shrink-0 text-xs text-gray-500">{progress.toFixed(0)}%</span>
                {torrent.dlspeed > 0 && (
                  <span className="flex-shrink-0 text-xs text-green-500">{formatSpeed(torrent.dlspeed)}</span>
                )}
              </div>
            );
          })}
        </div>
      </BaseWidget>
    );
  }

  // Progress visualization - focused on progress bars
  if (visualization === 'progress') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-3">
          {displayTorrents.map((torrent) => {
            const progress = torrent.progress * 100;
            return (
              <div key={torrent.hash}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-900 dark:text-white truncate flex-1">{torrent.name}</span>
                  <span className="text-gray-500 ml-2">{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isDownloading(torrent.state) ? 'bg-green-500' :
                      isSeeding(torrent.state) ? 'bg-blue-500' :
                      isPaused(torrent.state) ? 'bg-gray-400' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                {!hideLabels && (
                  <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                    <span>{formatBytes(torrent.size)}</span>
                    <div className="flex gap-2">
                      {torrent.dlspeed > 0 && <span className="text-green-500">{formatSpeed(torrent.dlspeed)}</span>}
                      {torrent.upspeed > 0 && <span className="text-blue-500">{formatSpeed(torrent.upspeed)}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {displayTorrents.map((torrent) => {
          const stateInfo = getStateInfo(torrent.state);
          const progress = torrent.progress * 100;

          return (
            <div
              key={torrent.hash}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate" title={torrent.name}>
                    {torrent.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs ${stateInfo.color}`}>{stateInfo.label}</span>
                    {showCategory && torrent.category && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                        {torrent.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                  <div>{formatBytes(torrent.size)}</div>
                  {showPeers && (
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <span className="text-green-600 dark:text-green-400">{torrent.num_seeds}</span>
                      <span>/</span>
                      <span className="text-blue-600 dark:text-blue-400">{torrent.num_leechs}</span>
                    </div>
                  )}
                </div>
              </div>

              {showProgressBar && (
                <div className="mb-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isDownloading(torrent.state)
                          ? 'bg-green-500'
                          : isSeeding(torrent.state)
                          ? 'bg-blue-500'
                          : isPaused(torrent.state)
                          ? 'bg-gray-400'
                          : 'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  {torrent.dlspeed > 0 && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      {formatSpeed(torrent.dlspeed)}
                    </span>
                  )}
                  {torrent.upspeed > 0 && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      {formatSpeed(torrent.upspeed)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <span>{progress.toFixed(1)}%</span>
                  {showEta && isDownloading(torrent.state) && torrent.eta > 0 && (
                    <span>ETA: {formatEta(torrent.eta)}</span>
                  )}
                  {torrent.ratio > 0 && (
                    <span>R: {torrent.ratio.toFixed(2)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredTorrents.length > itemCount && (
          <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
            +{filteredTorrents.length - itemCount} more torrents
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
