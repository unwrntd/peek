import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { formatDurationMs } from '../../../utils/formatting';

interface TautulliRecentlyAddedItem {
  addedAt: number;
  mediaType: 'movie' | 'show' | 'season' | 'episode' | 'artist' | 'album' | 'track';
  ratingKey: string;
  title: string;
  parentTitle?: string;
  grandparentTitle?: string;
  year?: number;
  duration?: number;
  contentRating?: string;
  libraryName: string;
  sectionId: number;
}

interface RecentlyAddedData {
  recentlyAdded: TautulliRecentlyAddedItem[];
}

interface RecentlyAddedProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

function getMediaIcon(mediaType: string): string {
  switch (mediaType) {
    case 'movie':
      return 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z';
    case 'show':
    case 'season':
    case 'episode':
      return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    case 'artist':
    case 'album':
    case 'track':
      return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
    default:
      return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
  }
}

function getDisplayTitle(item: TautulliRecentlyAddedItem): { title: string; subtitle?: string } {
  switch (item.mediaType) {
    case 'episode':
      return {
        title: item.grandparentTitle || item.title,
        subtitle: `${item.parentTitle} - ${item.title}`,
      };
    case 'season':
      return {
        title: item.parentTitle || item.title,
        subtitle: item.title,
      };
    case 'track':
      return {
        title: item.grandparentTitle || item.title,
        subtitle: `${item.parentTitle} - ${item.title}`,
      };
    case 'album':
      return {
        title: item.parentTitle || item.title,
        subtitle: item.title,
      };
    default:
      return { title: item.title };
  }
}

export function RecentlyAdded({ integrationId, config, widgetId }: RecentlyAddedProps) {
  const { data, loading, error } = useWidgetData<RecentlyAddedData>({
    integrationId,
    metric: 'recently-added',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const mediaTypeFilter = (config.mediaType as string) || '';
  const itemCount = Number(config.itemCount) || 10;
  const showYear = config.showYear !== false;
  const showLibrary = config.showLibrary !== false;
  const showDuration = config.showDuration !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;

  // Filter items based on media type
  const filteredItems = (data?.recentlyAdded || []).filter(item => {
    if (!mediaTypeFilter) return true;
    if (mediaTypeFilter === 'movie') return item.mediaType === 'movie';
    if (mediaTypeFilter === 'show') return ['show', 'season', 'episode'].includes(item.mediaType);
    if (mediaTypeFilter === 'artist') return ['artist', 'album', 'track'].includes(item.mediaType);
    return true;
  }).slice(0, itemCount);

  return (
    <BaseWidget loading={loading} error={error}>
      {filteredItems.length > 0 ? (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {filteredItems.map((item) => {
            const { title, subtitle } = getDisplayTitle(item);

            return (
              <div
                key={item.ratingKey}
                className={`flex items-start gap-3 ${compactView ? 'py-1' : 'py-2'} border-b border-gray-100 dark:border-gray-700 last:border-0`}
              >
                {/* Media Type Icon */}
                <div className="flex-shrink-0 text-gray-500 dark:text-gray-400 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getMediaIcon(item.mediaType)} />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {title}
                    {showYear && item.year && (
                      <span className="text-gray-400 text-sm ml-1">({item.year})</span>
                    )}
                  </div>

                  {/* Subtitle */}
                  {subtitle && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {subtitle}
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {showLibrary && (
                      <span>{item.libraryName}</span>
                    )}
                    {showDuration && item.duration && (
                      <span>{formatDurationMs(item.duration)}</span>
                    )}
                    {!hideLabels && (
                      <span>{formatRelativeTime(item.addedAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p>No recently added items</p>
        </div>
      )}
    </BaseWidget>
  );
}
