import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RadarrMovie } from '../../../types';

interface MovieLibraryData {
  movies: RadarrMovie[];
}

interface MovieLibraryProps {
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

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'released':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'inCinemas':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    case 'announced':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
    case 'tba':
      return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300';
    default:
      return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400';
  }
}

export function MovieLibrary({ integrationId, config, widgetId }: MovieLibraryProps) {
  const { data, loading, error } = useWidgetData<MovieLibraryData>({
    integrationId,
    metric: 'movies',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const compactView = (config.compactView as boolean) || false;
  const showPoster = config.showPoster !== false;
  const showStudio = config.showStudio !== false;
  const showRuntime = config.showRuntime !== false;
  const showQuality = config.showQuality !== false;
  const statusFilter = (config.statusFilter as string) || '';
  const fileFilter = (config.fileFilter as string) || '';

  let movies = data?.movies || [];

  // Apply filters
  if (statusFilter) {
    movies = movies.filter(m => m.status === statusFilter);
  }
  if (fileFilter === 'hasFile') {
    movies = movies.filter(m => m.hasFile);
  } else if (fileFilter === 'missing') {
    movies = movies.filter(m => !m.hasFile && m.monitored);
  }

  // Sort by title
  movies = [...movies].sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));

  if (compactView && movies.length > 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1">
          {movies.slice(0, 20).map((movie) => (
            <div
              key={movie.id}
              className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {movie.title}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({movie.year})
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(movie.status)}`}>
                  {movie.status}
                </span>
              </div>
              {movie.hasFile ? (
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
          ))}
          {movies.length > 20 && (
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
              +{movies.length - 20} more
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {movies.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No movies found
        </div>
      ) : (
        <div className="space-y-3">
          {movies.slice(0, 15).map((movie) => {
            const poster = movie.images.find(img => img.coverType === 'poster');

            return (
              <div
                key={movie.id}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
              >
                <div className="flex gap-3">
                  {showPoster && poster && (
                    <div className="flex-shrink-0">
                      <img
                        src={poster.remoteUrl || poster.url}
                        alt={movie.title}
                        className="w-12 h-18 object-cover rounded"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {movie.title} <span className="text-gray-500 dark:text-gray-400">({movie.year})</span>
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${getStatusColor(movie.status)}`}>
                        {movie.status}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {showRuntime && movie.runtime > 0 && (
                        <span>{formatRuntime(movie.runtime)}</span>
                      )}
                      {showStudio && movie.studio && (
                        <span className="bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                          {movie.studio}
                        </span>
                      )}
                      {!movie.monitored && (
                        <span className="text-amber-600 dark:text-amber-400">Unmonitored</span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      {movie.hasFile ? (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {formatBytes(movie.sizeOnDisk)}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Missing
                        </span>
                      )}
                      {showQuality && movie.movieFile?.quality?.quality?.name && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                          {movie.movieFile.quality.quality.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {movies.length > 15 && (
            <div className="text-sm text-center text-gray-500 dark:text-gray-400 pt-1">
              +{movies.length - 15} more movies
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
