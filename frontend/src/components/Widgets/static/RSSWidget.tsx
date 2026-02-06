import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { rssApi, RSSFeed, RSSFeedItem } from '../../../api/client';
import { WidgetRefreshContext } from '../../../contexts/WidgetRefreshContext';

interface RSSWidgetProps {
  title: string;
  config: {
    feedUrl?: string;
    maxItems?: number;
    search?: string;
    sortBy?: 'newest' | 'oldest' | 'title';
    showDescription?: boolean;
    showAuthor?: boolean;
    showDate?: boolean;
    showImage?: boolean;
    showCategories?: boolean;
    compactView?: boolean;
    visualizationType?: 'list' | 'cards' | 'headlines';
    refreshInterval?: number;
    staleThresholdDays?: number;
    staleMessage?: string;
    staleShowIcon?: boolean;
    staleShowThresholdText?: boolean;
    staleShowLastUpdate?: boolean;
    openInNewTab?: boolean;
    showFeedTitle?: boolean;
  };
  onConfigChange?: (config: Record<string, unknown>) => void;
  isEditMode?: boolean;
  widgetId?: string;
}

// Helper to format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Helper to match search patterns (supports wildcards and comma-separated lists)
function matchesSearch(text: string, pattern: string): boolean {
  if (!pattern) return true;
  const lowerText = text.toLowerCase();

  // Check for comma-separated values
  if (pattern.includes(',')) {
    return pattern.split(',').some(p => matchesSearch(text, p.trim()));
  }

  const lowerPattern = pattern.toLowerCase().trim();

  // Check for wildcard patterns
  if (lowerPattern.includes('*')) {
    const regex = new RegExp('^' + lowerPattern.replace(/\*/g, '.*') + '$', 'i');
    return regex.test(lowerText);
  }

  return lowerText.includes(lowerPattern);
}

export function RSSWidget({ title, config, widgetId }: RSSWidgetProps) {
  const [feed, setFeed] = useState<RSSFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshContext = useContext(WidgetRefreshContext);

  const {
    feedUrl = '',
    maxItems = 10,
    search = '',
    sortBy = 'newest',
    showDescription = true,
    showAuthor = true,
    showDate = true,
    showImage = true,
    showCategories = false,
    compactView = false,
    visualizationType = 'list',
    refreshInterval = 300000, // 5 minutes default
    staleThresholdDays,
    staleMessage = 'No recent updates',
    staleShowIcon = true,
    staleShowThresholdText = true,
    staleShowLastUpdate = false,
    openInNewTab = true,
    showFeedTitle = false,
  } = config || {};

  // Link target based on config
  const linkTarget = openInNewTab ? '_blank' : '_self';
  const linkRel = openInNewTab ? 'noopener noreferrer' : undefined;

  const fetchFeed = useCallback(async () => {
    if (!feedUrl) {
      setLoading(false);
      setError('No feed URL configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await rssApi.fetchFeed(feedUrl);
      setFeed(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch RSS feed:', err);
      setError('Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [feedUrl]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Auto-refresh based on config interval
  useEffect(() => {
    if (!feedUrl || !refreshInterval || refreshInterval === 0) return;

    const interval = setInterval(fetchFeed, refreshInterval);
    return () => clearInterval(interval);
  }, [feedUrl, refreshInterval, fetchFeed]);

  // Register with refresh context
  useEffect(() => {
    if (widgetId && refreshContext) {
      refreshContext.register(widgetId, fetchFeed, lastUpdated);
      return () => refreshContext.unregister(widgetId);
    }
  }, [widgetId, fetchFeed, lastUpdated, refreshContext]);

  // Update context when lastUpdated changes
  useEffect(() => {
    if (widgetId && refreshContext && lastUpdated) {
      refreshContext.updateLastUpdated(widgetId, lastUpdated);
    }
  }, [widgetId, lastUpdated, refreshContext]);

  // Filter and sort items - memoized for performance
  const { filteredItems, hasStaleContent, lastUpdateDate } = useMemo((): { filteredItems: RSSFeedItem[]; hasStaleContent: boolean; lastUpdateDate: Date | null } => {
    if (!feed?.items) return { filteredItems: [], hasStaleContent: false, lastUpdateDate: null };

    let items = [...feed.items];

    // Apply search filter
    if (search) {
      items = items.filter(item => {
        const searchText = `${item.title || ''} ${item.description || ''} ${item.author || ''} ${(item.categories || []).join(' ')}`;
        return matchesSearch(searchText, search);
      });
    }

    // Sort
    items.sort((a, b) => {
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      const dateA = new Date(a.isoDate || a.pubDate || 0).getTime();
      const dateB = new Date(b.isoDate || b.pubDate || 0).getTime();
      return sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    // Limit items
    items = items.slice(0, maxItems);

    // Check for stale content threshold
    if (staleThresholdDays && staleThresholdDays > 0) {
      const now = new Date();
      const thresholdMs = staleThresholdDays * 24 * 60 * 60 * 1000;
      const recentItems = items.filter(item => {
        const itemDate = new Date(item.isoDate || item.pubDate || 0);
        return (now.getTime() - itemDate.getTime()) <= thresholdMs;
      });

      // If we have items but none are recent, show stale message
      if (items.length > 0 && recentItems.length === 0) {
        // Find the most recent item date for display
        const mostRecentItem = items[0]; // Already sorted by newest first
        const mostRecentDate = mostRecentItem ? new Date(mostRecentItem.isoDate || mostRecentItem.pubDate || 0) : null;
        return { filteredItems: [], hasStaleContent: true, lastUpdateDate: mostRecentDate };
      }

      return { filteredItems: recentItems, hasStaleContent: false, lastUpdateDate: null };
    }

    return { filteredItems: items, hasStaleContent: false, lastUpdateDate: null };
  }, [feed?.items, search, sortBy, maxItems, staleThresholdDays]);

  // No feed URL configured
  if (!feedUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
        <p className="text-sm">No RSS feed configured</p>
        <p className="text-xs mt-1">Add a feed URL in widget settings</p>
      </div>
    );
  }

  // Loading state
  if (loading && !feed) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Error state
  if (error && !feed) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-400 p-4">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchFeed}
          className="mt-2 px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Stale content - items exist but none are recent enough
  if (hasStaleContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
        {staleShowIcon && (
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <p className="text-sm text-center">{staleMessage}</p>
        {staleShowThresholdText && staleThresholdDays && (
          <p className="text-xs mt-1">No updates in the last {staleThresholdDays} day{staleThresholdDays !== 1 ? 's' : ''}</p>
        )}
        {staleShowLastUpdate && lastUpdateDate && (
          <p className="text-xs mt-1">Last update: {lastUpdateDate.toLocaleDateString()}</p>
        )}
      </div>
    );
  }

  // No items
  if (filteredItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No items found</p>
        {search && <p className="text-xs mt-1">Try adjusting your search</p>}
      </div>
    );
  }

  // Feed title header component
  const FeedTitleHeader = () => {
    if (!showFeedTitle || !feed?.title) return null;
    return (
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {feed.title}
        </h3>
      </div>
    );
  };

  // Headlines view (compact list of titles only)
  if (visualizationType === 'headlines') {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <FeedTitleHeader />
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
          {filteredItems.map((item, index) => (
            <li key={item.link || index}>
              <a
                href={item.link}
                target={linkTarget}
                rel={linkRel}
                className="block px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 line-clamp-1">
                    {item.title}
                  </span>
                  {showDate && item.pubDate && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {formatRelativeTime(item.pubDate)}
                    </span>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Cards view
  if (visualizationType === 'cards') {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <FeedTitleHeader />
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredItems.map((item, index) => (
              <a
                key={item.link || index}
                href={item.link}
                target={linkTarget}
                rel={linkRel}
                className="block bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {showImage && item.image && (
                  <div className="aspect-video bg-gray-200 dark:bg-gray-600">
                    <img
                      src={item.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="p-3">
                  <h4 className="font-medium text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                    {item.title}
                  </h4>
                  {showDescription && item.description && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {showDate && item.pubDate && (
                      <span>{formatRelativeTime(item.pubDate)}</span>
                    )}
                    {showAuthor && item.author && (
                      <>
                        <span>•</span>
                        <span className="truncate">{item.author}</span>
                      </>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default list view
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <FeedTitleHeader />
      <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
        {filteredItems.map((item, index) => (
          <li key={item.link || index}>
            <a
              href={item.link}
              target={linkTarget}
              rel={linkRel}
              className={`block hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                compactView ? 'px-3 py-2' : 'px-3 py-3'
              }`}
            >
              <div className="flex gap-3">
                {showImage && item.image && !compactView && (
                  <div className="flex-shrink-0 w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden">
                    <img
                      src={item.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-gray-800 dark:text-gray-200 ${
                    compactView ? 'text-sm line-clamp-1' : 'text-sm line-clamp-2'
                  }`}>
                    {item.title}
                  </h4>
                  {showDescription && item.description && !compactView && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400 ${
                    compactView ? '' : 'mt-2'
                  }`}>
                    {showDate && item.pubDate && (
                      <span>{formatRelativeTime(item.pubDate)}</span>
                    )}
                    {showAuthor && item.author && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[150px]">{item.author}</span>
                      </>
                    )}
                    {showCategories && item.categories && item.categories.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="truncate">{item.categories.slice(0, 2).join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
