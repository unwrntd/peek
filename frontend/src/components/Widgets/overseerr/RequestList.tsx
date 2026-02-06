import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { OverseerrRequest } from '../../../types';

interface RequestListData {
  requests: OverseerrRequest[];
  totalCount: number;
}

interface RequestListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

// Map numeric status to display values
const REQUEST_STATUS_MAP: Record<number, { label: string; colorClass: string }> = {
  1: { label: 'Pending', colorClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  2: { label: 'Approved', colorClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  3: { label: 'Declined', colorClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const MEDIA_STATUS_MAP: Record<number, { label: string; colorClass: string }> = {
  1: { label: 'Unknown', colorClass: 'text-gray-500 dark:text-gray-400' },
  2: { label: 'Pending', colorClass: 'text-yellow-500' },
  3: { label: 'Processing', colorClass: 'text-blue-500' },
  4: { label: 'Partial', colorClass: 'text-orange-500' },
  5: { label: 'Available', colorClass: 'text-green-500' },
  6: { label: 'Deleted', colorClass: 'text-red-500' },
};

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

export function RequestList({ integrationId, config, widgetId }: RequestListProps) {
  const { data, loading, error } = useWidgetData<RequestListData>({
    integrationId,
    metric: 'requests',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Filter options
  const mediaTypeFilter = (config.mediaType as string) || '';
  const requestStatusFilter = (config.requestStatus as string) || '';
  const itemCount = (config.itemCount as number) || 10;
  const compactView = (config.compactView as boolean) || false;

  // Display options
  const showPoster = config.showPoster !== false;
  const showRequester = config.showRequester !== false;
  const showDate = config.showDate !== false;
  const showMediaStatus = config.showMediaStatus !== false;

  let requests = data?.requests || [];

  // Apply filters
  if (mediaTypeFilter) {
    requests = requests.filter(req => req.media.mediaType === mediaTypeFilter);
  }
  if (requestStatusFilter) {
    const statusNum = requestStatusFilter === 'pending' ? 1 : requestStatusFilter === 'approved' ? 2 : 3;
    requests = requests.filter(req => req.status === statusNum);
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
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
          No requests found
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {requests.map((request) => {
            const requestStatus = REQUEST_STATUS_MAP[request.status] || REQUEST_STATUS_MAP[1];
            const mediaStatus = MEDIA_STATUS_MAP[request.media.status] || MEDIA_STATUS_MAP[1];

            return (
              <div
                key={request.id}
                className={`flex gap-3 ${compactView ? 'py-1' : 'p-2'} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
              >
                {/* Poster */}
                {showPoster && (
                  <div className={`flex-shrink-0 ${compactView ? 'w-8 h-12' : 'w-12 h-18'} rounded overflow-hidden bg-gray-100 dark:bg-gray-700`}>
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
                        <span className={`text-xs px-1.5 py-0.5 rounded ${requestStatus.colorClass}`}>
                          {requestStatus.label}
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
                      {showMediaStatus && request.media.status > 1 && (
                        <span className={mediaStatus.colorClass}>
                          {mediaStatus.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BaseWidget>
  );
}
