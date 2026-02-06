import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TimelineView, TimelineEvent, timelineIcons } from '../../common/TimelineView';
import { formatDuration } from '../../../utils/formatting';

interface TautulliHistoryItem {
  referenceId: number;
  rowId: number;
  id: number;
  date: number;
  started: number;
  stopped: number;
  duration: number;
  pausedCounter: number;
  user: string;
  userId: number;
  friendlyName: string;
  platform: string;
  product: string;
  player: string;
  ipAddress: string;
  mediaType: 'movie' | 'episode' | 'track' | 'photo' | 'clip';
  ratingKey: string;
  title: string;
  parentTitle?: string;
  grandparentTitle?: string;
  year?: number;
  watchedStatus: number;
  percentComplete: number;
  transcodeDecision: string;
}

interface HistoryData {
  history: TautulliHistoryItem[];
  totalCount: number;
}

interface HistoryProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today ${timeStr}`;
  if (isYesterday) return `Yesterday ${timeStr}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timeStr;
}

function getMediaIcon(mediaType: string): string {
  switch (mediaType) {
    case 'movie':
      return 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z';
    case 'episode':
      return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    case 'track':
      return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
    default:
      return 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z';
  }
}

function getDisplayTitle(item: TautulliHistoryItem): { title: string; subtitle?: string } {
  switch (item.mediaType) {
    case 'episode':
      return {
        title: item.grandparentTitle || item.title,
        subtitle: `${item.parentTitle} - ${item.title}`,
      };
    case 'track':
      return {
        title: item.grandparentTitle || item.title,
        subtitle: `${item.parentTitle} - ${item.title}`,
      };
    default:
      return { title: item.title };
  }
}

function getCompletionColor(percent: number): string {
  if (percent >= 90) return 'bg-green-500';
  if (percent >= 50) return 'bg-yellow-500';
  return 'bg-gray-400';
}

export function History({ integrationId, config, widgetId }: HistoryProps) {
  const { data, loading, error } = useWidgetData<HistoryData>({
    integrationId,
    metric: 'history',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const mediaTypeFilter = (config.mediaType as string) || '';
  const itemCount = Number(config.itemCount) || 20;
  const showUser = config.showUser !== false;
  const showDate = config.showDate !== false;
  const showDuration = config.showDuration !== false;
  const showCompletion = config.showCompletion !== false;
  const showPlatform = config.showPlatform !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'list';

  // Filter items
  const filteredItems = (data?.history || []).filter(item => {
    if (!mediaTypeFilter) return true;
    return item.mediaType === mediaTypeFilter;
  }).slice(0, itemCount);

  // Get timeline status based on watch completion
  const getTimelineStatus = (percentComplete: number): 'success' | 'warning' | 'info' => {
    if (percentComplete >= 90) return 'success';
    if (percentComplete >= 50) return 'warning';
    return 'info';
  };

  // Get timeline icon based on media type
  const getTimelineIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'movie':
        return timelineIcons.play;
      case 'episode':
        return timelineIcons.play;
      case 'track':
        return timelineIcons.motion;
      default:
        return timelineIcons.play;
    }
  };

  // Convert history items to timeline events
  const timelineEvents: TimelineEvent[] = filteredItems.map(item => {
    const { title, subtitle } = getDisplayTitle(item);
    const subtitleParts = [
      subtitle,
      showUser ? (item.friendlyName || item.user) : null,
      showDuration && item.duration > 0 ? formatDuration(item.duration) : null,
      showCompletion ? `${Math.round(item.percentComplete)}%` : null,
    ].filter(Boolean);

    return {
      id: String(item.rowId),
      title: title + (item.year ? ` (${item.year})` : ''),
      subtitle: subtitleParts.join(' • '),
      timestamp: item.started * 1000,
      status: getTimelineStatus(item.percentComplete),
      icon: getTimelineIcon(item.mediaType),
    };
  });

  // Render timeline view
  const renderTimelineView = () => (
    <TimelineView
      events={timelineEvents}
      compact={compactView}
      showLine={true}
      relativeTime={!showDate}
      emptyMessage="No watch history"
    />
  );

  if (visualizationType === 'timeline') {
    return (
      <BaseWidget loading={loading} error={error}>
        {filteredItems.length > 0 ? renderTimelineView() : (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No watch history</p>
          </div>
        )}
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {filteredItems.length > 0 ? (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {filteredItems.map((item) => {
            const { title, subtitle } = getDisplayTitle(item);

            return (
              <div
                key={item.rowId}
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
                    {item.year && (
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
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    {showUser && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {item.friendlyName || item.user}
                      </span>
                    )}
                    {showPlatform && (
                      <span>{item.platform}</span>
                    )}
                    {showDuration && item.duration > 0 && (
                      <span>{formatDuration(item.duration)}</span>
                    )}
                    {showDate && (
                      <span>{formatDateTime(item.started)}</span>
                    )}
                  </div>

                  {/* Completion indicator */}
                  {showCompletion && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden max-w-24">
                        <div
                          className={`h-full rounded-full ${getCompletionColor(item.percentComplete)}`}
                          style={{ width: `${Math.min(100, item.percentComplete)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{Math.round(item.percentComplete)}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No watch history</p>
        </div>
      )}
    </BaseWidget>
  );
}
