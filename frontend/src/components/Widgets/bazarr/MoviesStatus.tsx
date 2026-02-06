import React, { useState } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { BazarrMovieItem } from '../../../types';

interface MoviesData {
  movies: BazarrMovieItem[];
  totalRecords: number;
}

interface MoviesStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

type FilterType = 'all' | 'missing' | 'complete';

export function MoviesStatus({ integrationId, config, widgetId }: MoviesStatusProps) {
  const [filter, setFilter] = useState<FilterType>((config.statusFilter as FilterType) || 'missing');

  const { data, loading, error } = useWidgetData<MoviesData>({
    integrationId,
    metric: 'movies',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const movies = data?.movies || [];
  const maxItems = (config.maxItems as number) || 15;

  const filteredMovies = movies.filter(m => {
    if (filter === 'missing') return m.missingSubtitles.length > 0;
    if (filter === 'complete') return m.missingSubtitles.length === 0;
    return true;
  });

  if (movies.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No movies data available
        </div>
      </BaseWidget>
    );
  }

  const renderFilterButtons = () => (
    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
      <button
        onClick={() => setFilter('missing')}
        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          filter === 'missing'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        Missing ({movies.filter(m => m.missingSubtitles.length > 0).length})
      </button>
      <button
        onClick={() => setFilter('complete')}
        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          filter === 'complete'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        Complete ({movies.filter(m => m.missingSubtitles.length === 0).length})
      </button>
      <button
        onClick={() => setFilter('all')}
        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          filter === 'all'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        All ({movies.length})
      </button>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm">
        {filter === 'missing' ? 'No movies with missing subtitles' : 'No movies found'}
      </p>
    </div>
  );

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-3">
          {!hideLabels && renderFilterButtons()}
          {filteredMovies.length === 0 ? renderEmptyState() : (
            <div className="space-y-1">
              {filteredMovies.slice(0, maxItems).map((item) => (
                <div key={item.radarrId} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.missingSubtitles.length > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
                  <span className="flex-1 truncate text-gray-900 dark:text-white">{item.title}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {item.missingSubtitles.length > 0 ? `${item.missingSubtitles.length} missing` : 'Complete'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Poster Grid visualization
  if (visualization === 'posters') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-3">
          {!hideLabels && renderFilterButtons()}
          {filteredMovies.length === 0 ? renderEmptyState() : (
            <div className="grid grid-cols-4 gap-2">
              {filteredMovies.slice(0, maxItems).map((item) => (
                <div key={item.radarrId} className="relative group">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="w-full aspect-[2/3] object-cover rounded"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className={`absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center text-xs font-medium ${
                    item.missingSubtitles.length > 0
                      ? 'bg-amber-500/90 text-white'
                      : 'bg-green-500/90 text-white'
                  }`}>
                    {item.missingSubtitles.length > 0 ? item.missingSubtitles.length : '✓'}
                  </div>
                  {!hideLabels && (
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                      <span className="text-white text-xs text-center line-clamp-3">{item.title}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {!hideLabels && renderFilterButtons()}
        {filteredMovies.length === 0 ? renderEmptyState() : (
          <div className="space-y-2">
            {filteredMovies.slice(0, maxItems).map((item) => (
              <div
                key={item.radarrId}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-10 h-14 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.title}
                  </p>
                  {!hideLabels && (
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span>{item.year}</span>
                      {!item.monitored && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                          <span className="text-gray-400">Unmonitored</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {item.missingSubtitles.length > 0 ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                        {item.missingSubtitles.length} missing
                      </span>
                      {!hideLabels && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
                          {item.missingSubtitles.join(', ')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                      Complete
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredMovies.length > maxItems && (
          <div className="text-center pt-2 text-xs text-gray-500 dark:text-gray-400">
            Showing {maxItems} of {filteredMovies.length} movies
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
