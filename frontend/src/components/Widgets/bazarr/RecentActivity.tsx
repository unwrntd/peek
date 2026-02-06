import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { BazarrHistoryItem } from '../../../types';

interface HistoryData {
  history: BazarrHistoryItem[];
  totalRecords: number;
}

interface RecentActivityProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getActionIcon(action: string): { icon: React.ReactNode; color: string } {
  switch (action) {
    case 'downloaded':
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        ),
        color: 'text-green-500',
      };
    case 'upgraded':
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        color: 'text-blue-500',
      };
    case 'manual':
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
        color: 'text-purple-500',
      };
    case 'deleted':
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        color: 'text-red-500',
      };
    case 'synced':
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        ),
        color: 'text-gray-500',
      };
    default:
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'text-gray-500',
      };
  }
}

export function RecentActivity({ integrationId, config, widgetId }: RecentActivityProps) {
  const { data, loading, error } = useWidgetData<HistoryData>({
    integrationId,
    metric: 'history',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const showProvider = config.showProvider !== false;
  const showLanguage = config.showLanguage !== false;
  const showDate = config.showDate !== false;
  const history = data?.history || [];
  const maxItems = (config.maxItems as number) || 10;

  if (history.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No recent activity
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1">
          {history.slice(0, maxItems).map((item) => {
            const { color } = getActionIcon(item.action);
            return (
              <div
                key={`${item.id}-${item.timestamp}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
                <span className="flex-1 truncate text-gray-900 dark:text-white">{item.title}</span>
                {showLanguage && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{item.language}</span>
                )}
                {showDate && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{formatTimeAgo(item.timestamp)}</span>
                )}
              </div>
            );
          })}
        </div>
      </BaseWidget>
    );
  }

  // Timeline visualization
  if (visualization === 'timeline') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-3">
            {history.slice(0, maxItems).map((item) => {
              const { icon, color } = getActionIcon(item.action);
              return (
                <div key={`${item.id}-${item.timestamp}`} className="relative pl-8">
                  <div className={`absolute left-1.5 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 ${color.replace('text-', 'border-')} flex items-center justify-center`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{item.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ml-2 ${
                        item.type === 'series'
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                      }`}>
                        {item.type === 'series' ? 'TV' : 'Movie'}
                      </span>
                    </div>
                    {!hideLabels && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {showLanguage && <span>{item.language}</span>}
                        {showProvider && <span>{item.provider}</span>}
                        {showDate && <span>{formatTimeAgo(item.timestamp)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {history.slice(0, maxItems).map((item) => {
          const { icon, color } = getActionIcon(item.action);
          return (
            <div
              key={`${item.id}-${item.timestamp}`}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className={`flex-shrink-0 mt-0.5 ${color}`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">
                  {item.title}
                </p>
                {!hideLabels && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {showLanguage && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                        {item.language}
                      </span>
                    )}
                    {showProvider && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.provider}
                      </span>
                    )}
                    {item.score !== undefined && item.score > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Score: {item.score}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex flex-col items-end">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  item.type === 'series'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                }`}>
                  {item.type === 'series' ? 'TV' : 'Movie'}
                </span>
                {showDate && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatTimeAgo(item.timestamp)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </BaseWidget>
  );
}
