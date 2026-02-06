import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProwlarrHistoryRecord } from '../../../types';

interface HistoryData {
  history: ProwlarrHistoryRecord[];
  totalRecords: number;
}

interface HistoryProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getEventIcon(eventType: string): JSX.Element {
  const iconClass = "w-4 h-4";

  switch (eventType.toLowerCase()) {
    case 'grabbed':
    case 'releasegrabed':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      );
    case 'indexerquery':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'indexerrss':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function getEventColor(eventType: string, successful: boolean): string {
  if (!successful) {
    return 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400';
  }

  switch (eventType.toLowerCase()) {
    case 'grabbed':
    case 'releasegrabed':
      return 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400';
    case 'indexerquery':
      return 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400';
    case 'indexerrss':
      return 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400';
    default:
      return 'bg-gray-100 dark:bg-gray-900/40 text-gray-600 dark:text-gray-400';
  }
}

function getEventLabel(eventType: string): string {
  switch (eventType.toLowerCase()) {
    case 'grabbed':
    case 'releasegrabed':
      return 'Grabbed';
    case 'indexerquery':
      return 'Query';
    case 'indexerrss':
      return 'RSS';
    default:
      return eventType;
  }
}

export function History({ integrationId, config, widgetId }: HistoryProps) {
  const { data, loading, error } = useWidgetData<HistoryData>({
    integrationId,
    metric: 'history',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const eventTypeFilter = config.eventTypeFilter as string || '';
  const statusFilter = config.statusFilter as string || '';
  const itemCount = (config.itemCount as number) || 20;

  const history = data?.history || [];

  // Apply filters
  const filteredHistory = history.filter(record => {
    if (eventTypeFilter && record.eventType.toLowerCase() !== eventTypeFilter.toLowerCase()) return false;
    if (statusFilter === 'successful' && !record.successful) return false;
    if (statusFilter === 'failed' && record.successful) return false;
    return true;
  }).slice(0, itemCount);

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No history data available
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {filteredHistory.map(record => (
            <div key={record.id} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${record.successful ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="flex-1 truncate text-gray-200">
                {record.data?.title || record.data?.query || record.indexer}
              </span>
              <span className="text-xs text-gray-500">{formatTimeAgo(record.date)}</span>
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Timeline visualization
  if (visualization === 'timeline') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="relative overflow-y-auto h-full">
          {!hideLabels && (
            <div className="text-xs text-gray-500 mb-3">{data.totalRecords.toLocaleString()} total records</div>
          )}
          <div className="space-y-0">
            {filteredHistory.map((record, idx) => (
              <div key={record.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${getEventColor(record.eventType, record.successful)}`} />
                  {idx < filteredHistory.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
                  )}
                </div>
                <div className="flex-1 pb-3 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-white truncate">
                    {record.data?.title || record.data?.query || record.indexer}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>{getEventLabel(record.eventType)}</span>
                    <span>·</span>
                    <span>{formatTimeAgo(record.date)}</span>
                    {!record.successful && <span className="text-red-500">Failed</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Summary */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {data.totalRecords.toLocaleString()} total records
        </div>

        {/* History List */}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No history records match the current filters
            </div>
          ) : (
            filteredHistory.map(record => (
              <div
                key={record.id}
                className={`flex items-start gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 ${
                  !record.successful ? 'border-l-2 border-l-red-500' : ''
                }`}
              >
                {/* Event Icon */}
                <div className={`p-1.5 rounded ${getEventColor(record.eventType, record.successful)}`}>
                  {getEventIcon(record.eventType)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {record.data?.title || record.data?.query || record.indexer}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${getEventColor(record.eventType, record.successful)}`}>
                      {getEventLabel(record.eventType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{record.indexer}</span>
                    <span>·</span>
                    <span>{formatTimeAgo(record.date)}</span>
                    {!record.successful && (
                      <>
                        <span>·</span>
                        <span className="text-red-600 dark:text-red-400">Failed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
