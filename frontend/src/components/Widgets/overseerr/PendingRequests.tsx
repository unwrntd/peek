import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { OverseerrRequest } from '../../../types';

interface RequestListData {
  requests: OverseerrRequest[];
  totalCount: number;
}

interface PendingRequestsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PendingRequests({ integrationId, config, widgetId }: PendingRequestsProps) {
  const { data, loading, error } = useWidgetData<RequestListData>({
    integrationId,
    metric: 'requests',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Filter options
  const mediaTypeFilter = (config.mediaType as string) || '';
  const itemCount = (config.itemCount as number) || 5;
  const compactView = (config.compactView as boolean) || false;

  // Display options
  const showPoster = config.showPoster !== false;
  const showRequester = config.showRequester !== false;
  const showDate = config.showDate !== false;

  // Filter to pending requests only (status = 1)
  let requests = (data?.requests || []).filter(req => req.status === 1);

  // Apply media type filter
  if (mediaTypeFilter) {
    requests = requests.filter(req => req.media.mediaType === mediaTypeFilter);
  }

  // Limit items
  requests = requests.slice(0, itemCount);

  const getPosterUrl = (posterPath: string | undefined): string => {
    if (!posterPath) return '';
    return `https://image.tmdb.org/t/p/w92${posterPath}`;
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-8 h-8 mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">No pending requests</span>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Awaiting Approval
            </span>
            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
              {requests.length}
            </span>
          </div>

          {requests.map((request) => (
            <div
              key={request.id}
              className={`flex gap-3 ${compactView ? 'py-1' : 'p-2'} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
            >
              {/* Poster */}
              {showPoster && (
                <div className={`flex-shrink-0 ${compactView ? 'w-8 h-12' : 'w-10 h-15'} rounded overflow-hidden bg-gray-100 dark:bg-gray-700`}>
                  {request.media.posterPath ? (
                    <img
                      src={getPosterUrl(request.media.posterPath)}
                      alt={request.media.title || 'Poster'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                    </div>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className={`font-medium text-gray-900 dark:text-white truncate ${compactView ? 'text-xs' : 'text-sm'}`}>
                      {request.media.title || 'Unknown Title'}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${request.media.mediaType === 'movie' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                        {request.media.mediaType === 'movie' ? 'Movie' : 'TV'}
                      </span>
                    </div>
                  </div>
                </div>

                {!compactView && (
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {showRequester && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {request.requestedBy.displayName}
                      </span>
                    )}
                    {showDate && (
                      <span>{formatDate(request.createdAt)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
