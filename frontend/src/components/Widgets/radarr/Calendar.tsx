import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RadarrMovie } from '../../../types';

interface CalendarData {
  movies: RadarrMovie[];
}

interface CalendarProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function getReleaseDate(movie: RadarrMovie): string | null {
  return movie.digitalRelease || movie.physicalRelease || movie.inCinemas || null;
}

function isUpcoming(dateStr: string): boolean {
  return new Date(dateStr) > new Date();
}

export function Calendar({ integrationId, config, widgetId }: CalendarProps) {
  const { data, loading, error } = useWidgetData<CalendarData>({
    integrationId,
    metric: 'calendar',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const compactView = (config.compactView as boolean) || false;
  const showPoster = config.showPoster !== false;
  const showOverview = (config.showOverview as boolean) || false;
  const showStudio = config.showStudio !== false;
  const timeFilter = (config.timeFilter as string) || '';

  let movies = data?.movies || [];

  // Sort by release date
  movies = [...movies].sort((a, b) => {
    const dateA = new Date(getReleaseDate(a) || '');
    const dateB = new Date(getReleaseDate(b) || '');
    return dateA.getTime() - dateB.getTime();
  });

  // Apply filter
  if (timeFilter === 'upcoming') {
    movies = movies.filter(m => {
      const releaseDate = getReleaseDate(m);
      return releaseDate && isUpcoming(releaseDate);
    });
  } else if (timeFilter === 'recent') {
    movies = movies.filter(m => {
      const releaseDate = getReleaseDate(m);
      return releaseDate && !isUpcoming(releaseDate);
    });
  }

  if (compactView && movies.length > 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1">
          {movies.slice(0, 15).map((movie) => {
            const releaseDate = getReleaseDate(movie);
            const upcoming = releaseDate ? isUpcoming(releaseDate) : false;
            return (
              <div
                key={movie.id}
                className={`flex items-center justify-between py-1.5 px-2 rounded ${upcoming ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-900 dark:text-white truncate">
                    <span className="font-medium">{movie.title}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      ({movie.year})
                    </span>
                  </span>
                </div>
                <span className={`text-xs flex-shrink-0 ${upcoming ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {releaseDate ? formatDate(releaseDate) : 'TBA'}
                </span>
              </div>
            );
          })}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm">No releases scheduled</span>
        </div>
      ) : (
        <div className="space-y-3">
          {movies.slice(0, 10).map((movie) => {
            const releaseDate = getReleaseDate(movie);
            const upcoming = releaseDate ? isUpcoming(releaseDate) : false;
            const poster = movie.images.find(img => img.coverType === 'poster');

            return (
              <div
                key={movie.id}
                className={`p-3 rounded-lg border ${upcoming ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'}`}
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
                          {movie.year} {showStudio && movie.studio && `• ${movie.studio}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-sm font-medium ${upcoming ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          {releaseDate ? formatDate(releaseDate) : 'TBA'}
                        </div>
                      </div>
                    </div>

                    {showOverview && movie.overview && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {movie.overview}
                      </p>
                    )}

                    <div className="mt-1 flex items-center gap-2">
                      {movie.hasFile && (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Downloaded
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {movies.length > 10 && (
            <div className="text-sm text-center text-gray-500 dark:text-gray-400">
              +{movies.length - 10} more movies
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
