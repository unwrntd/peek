import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TimelineView, TimelineEvent, timelineIcons } from '../../common/TimelineView';
import { RadarrHistoryRecord } from '../../../types';

interface HistoryData {
  records: RadarrHistoryRecord[];
  totalRecords: number;
}

interface ActivityHistoryProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffTime / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getEventIcon(eventType: string): React.ReactNode {
  switch (eventType) {
    case 'grabbed':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      );
    case 'downloadFolderImported':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'downloadFailed':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'movieFileDeleted':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      );
    case 'movieFileRenamed':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case 'grabbed':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
    case 'downloadFolderImported':
      return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
    case 'downloadFailed':
      return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    case 'movieFileDeleted':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
    case 'movieFileRenamed':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
    default:
      return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400';
  }
}

function getEventLabel(eventType: string): string {
  switch (eventType) {
    case 'grabbed':
      return 'Grabbed';
    case 'downloadFolderImported':
      return 'Imported';
    case 'downloadFailed':
      return 'Failed';
    case 'movieFileDeleted':
      return 'Deleted';
    case 'movieFileRenamed':
      return 'Renamed';
    default:
      return eventType;
  }
}

export function ActivityHistory({ integrationId, config, widgetId }: ActivityHistoryProps) {
  const { data, loading, error } = useWidgetData<HistoryData>({
    integrationId,
    metric: 'history',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showQuality = config.showQuality !== false;
  const eventFilter = (config.eventTypeFilter as string) || '';
  const itemCount = (config.itemCount as number) || 15;
  const visualizationType = (config.visualization as string) || 'list';

  let records = data?.records || [];

  // Apply event filter
  if (eventFilter) {
    records = records.filter(r => r.eventType === eventFilter);
  }

  // Get timeline status from event type
  const getTimelineStatus = (eventType: string): 'success' | 'error' | 'warning' | 'info' => {
    switch (eventType) {
      case 'downloadFolderImported':
        return 'success';
      case 'downloadFailed':
        return 'error';
      case 'grabbed':
        return 'info';
      default:
        return 'info';
    }
  };

  // Get timeline icon from event type
  const getTimelineIcon = (eventType: string) => {
    switch (eventType) {
      case 'grabbed':
        return timelineIcons.download;
      case 'downloadFolderImported':
        return timelineIcons.check;
      case 'downloadFailed':
        return timelineIcons.error;
      case 'movieFileDeleted':
        return timelineIcons.error;
      case 'movieFileRenamed':
        return timelineIcons.task;
      default:
        return timelineIcons.task;
    }
  };

  // Convert records to timeline events
  const timelineEvents: TimelineEvent[] = records.slice(0, itemCount).map(record => ({
    id: String(record.id),
    title: record.movie?.title || 'Unknown Movie',
    subtitle: [
      getEventLabel(record.eventType),
      record.movie?.year ? `(${record.movie.year})` : null,
      showQuality && record.quality?.quality?.name ? record.quality.quality.name : null,
    ].filter(Boolean).join(' • '),
    timestamp: new Date(record.date),
    status: getTimelineStatus(record.eventType),
    icon: getTimelineIcon(record.eventType),
  }));

  // Render timeline view
  const renderTimelineView = () => (
    <TimelineView
      events={timelineEvents}
      compact={false}
      showLine={true}
      relativeTime={true}
      emptyMessage="No recent activity"
    />
  );

  if (records.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">No recent activity</span>
        </div>
      </BaseWidget>
    );
  }

  if (visualizationType === 'timeline') {
    return (
      <BaseWidget loading={loading} error={error}>
        {renderTimelineView()}
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {records.slice(0, itemCount).map((record) => (
          <div
            key={record.id}
            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getEventColor(record.eventType)}`}>
                {getEventIcon(record.eventType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {record.movie?.title || 'Unknown Movie'}
                    </h4>
                    {record.movie?.year && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {record.movie.year}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${getEventColor(record.eventType)}`}>
                    {getEventLabel(record.eventType)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDate(record.date)}
                  </span>
                  {showQuality && record.quality?.quality?.name && (
                    <span className="bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                      {record.quality.quality.name}
                    </span>
                  )}
                </div>

                {record.sourceTitle && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {record.sourceTitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {data?.totalRecords && data.totalRecords > itemCount && (
          <div className="text-sm text-center text-gray-500 dark:text-gray-400">
            +{data.totalRecords - itemCount} more records
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
