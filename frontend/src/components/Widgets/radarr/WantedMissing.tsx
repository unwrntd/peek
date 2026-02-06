import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RadarrMovie } from '../../../types';

interface WantedMissingData {
  missing: RadarrMovie[];
  totalRecords: number;
}

interface WantedMissingProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `In ${Math.abs(diffDays)} days`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function getReleaseDate(movie: RadarrMovie): string | null {
  return movie.digitalRelease || movie.physicalRelease || movie.inCinemas || null;
}

export function WantedMissing({ integrationId, config, widgetId }: WantedMissingProps) {
  const { data, loading, error } = useWidgetData<WantedMissingData>({
    integrationId,
    metric: 'wanted',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const compactView = (config.compactView as boolean) || false;
  const showPoster = config.showPoster !== false;
  const showReleaseDate = config.showReleaseDate !== false;
  const showOverview = (config.showOverview as boolean) || false;
  const itemCount = (config.itemCount as number) || 10;

  const missing = data?.missing || [];

  if (missing.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">No missing movies</span>
        </div>
      </BaseWidget>
    );
  }

  if (compactView) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1">
          {missing.slice(0, itemCount).map((movie) => {
            const releaseDate = getReleaseDate(movie);
            return (
              <div
                key={movie.id}
                className="flex items-center justify-between py-1.5 px-2 rounded bg-amber-50 dark:bg-amber-900/20"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-gray-900 dark:text-white truncate">
                    <span className="font-medium">{movie.title}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      ({movie.year})
                    </span>
                  </span>
                </div>
                {showReleaseDate && releaseDate && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {getDaysAgo(releaseDate)}
                  </span>
                )}
              </div>
            );
          })}
          {data?.totalRecords && data.totalRecords > itemCount && (
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
              +{data.totalRecords - itemCount} more missing
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {missing.slice(0, itemCount).map((movie) => {
          const poster = movie.images.find(img => img.coverType === 'poster');
          const releaseDate = getReleaseDate(movie);

          return (
            <div
              key={movie.id}
              className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50"
            >
              <div className="flex gap-3">
                {showPoster && poster && (
                  <div className="flex-shrink-0">
                    <img
                      src={poster.remoteUrl || poster.url}
                      alt={movie.title}
                      className="w-10 h-15 object-cover rounded"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {movie.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {movie.year} {movie.studio && `• ${movie.studio}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  </div>

                  {showOverview && movie.overview && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {movie.overview}
                    </p>
                  )}

                  {showReleaseDate && releaseDate && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Released {formatDate(releaseDate)}</span>
                      <span className="text-amber-600 dark:text-amber-400">
                        ({getDaysAgo(releaseDate)})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {data?.totalRecords && data.totalRecords > itemCount && (
          <div className="text-sm text-center text-gray-500 dark:text-gray-400">
            +{data.totalRecords - itemCount} more missing movies
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
