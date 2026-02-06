import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { PlexMediaItem } from '../../../types';
import { formatDurationMs } from '../../../utils/formatting';

interface RecentlyAddedProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface RecentData {
  recentlyAdded: PlexMediaItem[];
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'movie': return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
    case 'show': return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    case 'season': return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    case 'episode': return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    case 'track': return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
    case 'photo': return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
    default: return 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10';
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'movie': return 'text-orange-500';
    case 'show': return 'text-blue-500';
    case 'season': return 'text-blue-500';
    case 'episode': return 'text-blue-500';
    case 'track': return 'text-purple-500';
    case 'photo': return 'text-green-500';
    default: return 'text-gray-500';
  }
}

function getMediaTitle(item: PlexMediaItem): string {
  // For seasons: parentTitle is the show name, title is "Season X"
  if (item.type === 'season' && item.parentTitle) {
    return `${item.parentTitle} - ${item.title}`;
  }
  // For episodes: grandparentTitle is show name, title is episode name
  if (item.type === 'episode' && item.grandparentTitle) {
    return `${item.grandparentTitle} - ${item.title}`;
  }
  // For tracks: grandparentTitle is artist, title is track name
  if (item.type === 'track' && item.grandparentTitle) {
    return `${item.grandparentTitle} - ${item.title}`;
  }
  return item.title;
}

function getMediaSubtitle(item: PlexMediaItem): string | null {
  // For episodes: parentTitle is the season name
  if (item.type === 'episode' && item.parentTitle) {
    return item.parentTitle;
  }
  // For tracks: parentTitle is the album name
  if (item.type === 'track' && item.parentTitle) {
    return item.parentTitle;
  }
  // For seasons: no subtitle needed (show name is in title)
  return null;
}

export function RecentlyAdded({ integrationId, config, widgetId }: RecentlyAddedProps) {
  const { data, loading, error } = useWidgetData<RecentData>({
    integrationId,
    metric: (config.metric as string) || 'recently-added',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'posters';
  const mediaType = (config.mediaType as string) || '';
  const itemCount = (config.itemCount as number) || 10;
  const showYear = config.showYear !== false;
  const showRating = config.showRating !== false;
  const showDuration = config.showDuration !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;

  // Filter by media type if specified
  // When filtering for 'episode' (TV), include both episodes and seasons
  const filteredItems = data?.recentlyAdded
    .filter(item => {
      if (!mediaType) return true;
      if (mediaType === 'episode') {
        return item.type === 'episode' || item.type === 'season' || item.type === 'show';
      }
      return item.type === mediaType;
    })
    .slice(0, itemCount) || [];

  // Posters visualization - compact grid
  if (visualization === 'posters') {
    return (
      <BaseWidget loading={loading} error={error}>
        {data && (
          <div className="grid grid-cols-2 gap-2">
            {filteredItems.length > 0 ? (
              filteredItems.slice(0, 8).map((item) => (
                <div
                  key={item.ratingKey}
                  className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`${getTypeColor(item.type)}`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTypeIcon(item.type)} />
                      </svg>
                    </span>
                    {!hideLabels && item.year && (
                      <span className="text-xs text-gray-400">{item.year}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {getMediaTitle(item)}
                  </p>
                  {getMediaSubtitle(item) && (
                    <p className="text-xs text-gray-500 truncate">{getMediaSubtitle(item)}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-4 text-gray-500 text-sm">No items</div>
            )}
          </div>
        )}
      </BaseWidget>
    );
  }

  // Cards visualization - more detailed cards
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        {data && (
          <div className="space-y-2">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  key={item.ratingKey}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                >
                  <div className={`flex-shrink-0 p-2 rounded ${getTypeColor(item.type).replace('text-', 'bg-').replace('500', '100')} dark:bg-opacity-20`}>
                    <svg className={`w-5 h-5 ${getTypeColor(item.type)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTypeIcon(item.type)} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{getMediaTitle(item)}</p>
                    {getMediaSubtitle(item) && (
                      <p className="text-sm text-gray-500 truncate">{getMediaSubtitle(item)}</p>
                    )}
                    {!hideLabels && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        {showYear && item.year && <span>{item.year}</span>}
                        {showRating && item.contentRating && (
                          <span className="px-1 py-0.5 bg-gray-100 dark:bg-gray-600 rounded">{item.contentRating}</span>
                        )}
                        {showDuration && item.duration && <span>{formatDurationMs(item.duration)}</span>}
                      </div>
                    )}
                  </div>
                  {!hideLabels && (
                    <span className="flex-shrink-0 text-xs text-gray-400">{formatDate(item.addedAt)}</span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">No recently added items</div>
            )}
          </div>
        )}
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={compactView ? 'space-y-1.5' : 'space-y-2'}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div
                key={item.ratingKey}
                className={`flex items-start gap-3 ${compactView ? 'py-1' : 'py-2'} ${
                  !compactView ? 'border-b border-gray-100 dark:border-gray-700 last:border-0' : ''
                }`}
              >
                {/* Type Icon */}
                <div className={`flex-shrink-0 mt-0.5 ${getTypeColor(item.type)}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTypeIcon(item.type)} />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <div className="font-medium text-gray-900 dark:text-white truncate text-sm">
                    {getMediaTitle(item)}
                  </div>

                  {/* Subtitle (Season/Album) */}
                  {getMediaSubtitle(item) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {getMediaSubtitle(item)}
                    </div>
                  )}

                  {/* Metadata */}
                  {!hideLabels && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {showYear && item.year && <span>{item.year}</span>}
                      {showRating && item.contentRating && (
                        <span className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">
                          {item.contentRating}
                        </span>
                      )}
                      {showDuration && item.duration && (
                        <span>{formatDurationMs(item.duration)}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Added date */}
                {!hideLabels && (
                  <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(item.addedAt)}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>No recently added items</p>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
