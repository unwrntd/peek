import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { SonarrSeries } from '../../../types';

interface SeriesLibraryData {
  series: SonarrSeries[];
}

interface SeriesLibraryProps {
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
  switch (status) {
    case 'continuing':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'ended':
      return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300';
    case 'upcoming':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    default:
      return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400';
  }
}

export function SeriesLibrary({ integrationId, config, widgetId }: SeriesLibraryProps) {
  const { data, loading, error } = useWidgetData<SeriesLibraryData>({
    integrationId,
    metric: 'series',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const compactView = (config.compactView as boolean) || false;
  const showPoster = config.showPoster !== false;
  const showNetwork = config.showNetwork !== false;
  const showEpisodeCount = config.showEpisodeCount !== false;
  const showProgressBar = config.showProgressBar !== false;
  const statusFilter = (config.statusFilter as string) || '';
  const monitoredFilter = (config.monitoredFilter as string) || '';

  let series = data?.series || [];

  // Apply filters
  if (statusFilter) {
    series = series.filter(s => s.status === statusFilter);
  }
  if (monitoredFilter === 'monitored') {
    series = series.filter(s => s.monitored);
  } else if (monitoredFilter === 'unmonitored') {
    series = series.filter(s => !s.monitored);
  }

  // Sort by title
  series = [...series].sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));

  if (compactView && series.length > 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1">
          {series.slice(0, 20).map((s) => {
            const stats = s.statistics;
            const progress = stats ? Math.round((stats.episodeFileCount / stats.episodeCount) * 100) || 0 : 0;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-700/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {s.title}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(s.status)}`}>
                    {s.status}
                  </span>
                </div>
                {showEpisodeCount && stats && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {stats.episodeFileCount}/{stats.episodeCount}
                  </span>
                )}
              </div>
            );
          })}
          {series.length > 20 && (
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
              +{series.length - 20} more
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {series.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No series found
        </div>
      ) : (
        <div className="space-y-3">
          {series.slice(0, 15).map((s) => {
            const stats = s.statistics;
            const progress = stats && stats.episodeCount > 0
              ? Math.round((stats.episodeFileCount / stats.episodeCount) * 100)
              : 0;
            const poster = s.images.find(img => img.coverType === 'poster');

            return (
              <div
                key={s.id}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
              >
                <div className="flex gap-3">
                  {showPoster && poster && (
                    <div className="flex-shrink-0">
                      <img
                        src={poster.remoteUrl || poster.url}
                        alt={s.title}
                        className="w-12 h-18 object-cover rounded"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {s.title}
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${getStatusColor(s.status)}`}>
                        {s.status}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {s.year && <span>{s.year}</span>}
                      {showNetwork && s.network && (
                        <span className="bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                          {s.network}
                        </span>
                      )}
                      {!s.monitored && (
                        <span className="text-amber-600 dark:text-amber-400">Unmonitored</span>
                      )}
                    </div>

                    {showEpisodeCount && stats && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>
                            {stats.episodeFileCount} / {stats.episodeCount} episodes
                          </span>
                          <span>{formatBytes(stats.sizeOnDisk)}</span>
                        </div>
                        {showProgressBar && (
                          <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {series.length > 15 && (
            <div className="text-sm text-center text-gray-500 dark:text-gray-400 pt-1">
              +{series.length - 15} more series
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
