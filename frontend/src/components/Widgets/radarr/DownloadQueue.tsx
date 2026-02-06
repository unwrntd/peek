import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RadarrQueueRecord } from '../../../types';

interface DownloadQueueData {
  queue: RadarrQueueRecord[];
  totalRecords: number;
}

interface DownloadQueueProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getStatusColor(status: string): string {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('download')) {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
  }
  if (statusLower.includes('pause')) {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  }
  if (statusLower.includes('queue')) {
    return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400';
  }
  if (statusLower.includes('fail') || statusLower.includes('warn')) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  }
  if (statusLower.includes('complete')) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  }
  return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400';
}

function getProtocolIcon(protocol: string): React.ReactNode {
  if (protocol === 'torrent') {
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  );
}

export function DownloadQueue({ integrationId, config, widgetId }: DownloadQueueProps) {
  const { data, loading, error } = useWidgetData<DownloadQueueData>({
    integrationId,
    metric: 'queue',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const compactView = (config.compactView as boolean) || false;
  const showProgressBar = config.showProgressBar !== false;
  const showTimeRemaining = config.showTimeRemaining !== false;
  const showQuality = config.showQuality !== false;
  const showDownloadClient = (config.showDownloadClient as boolean) || false;

  const queue = data?.queue || [];

  if (queue.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          <span className="text-sm">Queue is empty</span>
        </div>
      </BaseWidget>
    );
  }

  if (compactView) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          {queue.slice(0, 10).map((item) => {
            const progress = item.size > 0 ? Math.round(((item.size - item.sizeleft) / item.size) * 100) : 0;
            return (
              <div
                key={item.id}
                className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.movie?.title || item.title}
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {progress}%
                  </span>
                </div>
                {showProgressBar && (
                  <div className="h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {queue.slice(0, 10).map((item) => {
          const progress = item.size > 0 ? Math.round(((item.size - item.sizeleft) / item.size) * 100) : 0;
          const downloaded = item.size - item.sizeleft;

          return (
            <div
              key={item.id}
              className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  {getProtocolIcon(item.protocol)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {item.movie?.title || 'Unknown Movie'}
                      </h4>
                      {item.movie?.year && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.movie.year}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  {showProgressBar && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>{formatBytes(downloaded)} / {formatBytes(item.size)}</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">{progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {showTimeRemaining && item.timeleft && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {item.timeleft}
                      </span>
                    )}
                    {showQuality && item.quality?.quality?.name && (
                      <span className="bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                        {item.quality.quality.name}
                      </span>
                    )}
                    {showDownloadClient && item.downloadClient && (
                      <span>{item.downloadClient}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {data?.totalRecords && data.totalRecords > 10 && (
          <div className="text-sm text-center text-gray-500 dark:text-gray-400">
            +{data.totalRecords - 10} more in queue
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
