import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { SABnzbdHistory, SABnzbdHistorySlot } from '../../../types';

interface HistoryData {
  history: SABnzbdHistory;
  slots: SABnzbdHistorySlot[];
}

interface HistoryProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getStatusIcon(status: string): { icon: React.ReactNode; color: string } {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === 'completed' || lowerStatus === 'finished') {
    return {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-500',
    };
  }
  if (lowerStatus === 'failed' || lowerStatus === 'queued') {
    return {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-red-500',
    };
  }
  return {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-gray-500',
  };
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
  const history = data?.history;
  const slots = data?.slots || [];
  const itemCount = (config.itemCount as number) || 20;
  const statusFilter = (config.statusFilter as string) || '';

  if (!history) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No history data available
        </div>
      </BaseWidget>
    );
  }

  // Filter slots by status if needed
  let filteredSlots = slots;
  if (statusFilter === 'completed') {
    filteredSlots = slots.filter(s => s.status.toLowerCase() === 'completed' || s.status.toLowerCase() === 'finished');
  } else if (statusFilter === 'failed') {
    filteredSlots = slots.filter(s => s.status.toLowerCase() === 'failed' || s.status.toLowerCase() === 'queued');
  }

  const displaySlots = filteredSlots.slice(0, itemCount);
  const completedCount = slots.filter(s => s.status.toLowerCase() === 'completed' || s.status.toLowerCase() === 'finished').length;
  const failedCount = slots.filter(s => s.status.toLowerCase() === 'failed').length;

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {displaySlots.length > 0 ? (
            displaySlots.map((slot) => {
              const { color } = getStatusIcon(slot.status);
              return (
                <div key={slot.nzo_id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
                  <span className="flex-1 truncate text-gray-200">{slot.name}</span>
                  <span className="flex-shrink-0 text-xs text-gray-500">{formatBytes(slot.bytes)}</span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">No history</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Timeline visualization
  if (visualization === 'timeline') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="relative overflow-y-auto h-full">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-3">
            {displaySlots.length > 0 ? (
              displaySlots.map((slot) => {
                const { icon, color } = getStatusIcon(slot.status);
                const isFailed = slot.status.toLowerCase() === 'failed';
                return (
                  <div key={slot.nzo_id} className="relative pl-8">
                    <div className={`absolute left-1.5 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 ${color.replace('text-', 'border-')} flex items-center justify-center`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />
                    </div>
                    <div className={`p-2 rounded-lg ${isFailed ? 'bg-red-50 dark:bg-red-900/10' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{slot.name}</span>
                      </div>
                      {!hideLabels && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>{formatBytes(slot.bytes)}</span>
                          <span>{formatTime(slot.download_time)}</span>
                          <span>{formatDate(slot.completed)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm pl-8">No history</div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{history.day_size}</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Week</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{history.week_size}</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Month</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{history.month_size}</p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{history.total_size}</p>
          </div>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {completedCount} completed
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {failedCount} failed
            </span>
          )}
        </div>

        {/* History Items */}
        {displaySlots.length > 0 ? (
          <div className="space-y-2">
            {displaySlots.map((slot) => {
              const { icon, color } = getStatusIcon(slot.status);
              const isFailed = slot.status.toLowerCase() === 'failed';

              return (
                <div
                  key={slot.nzo_id}
                  className={`p-3 rounded-lg border ${
                    isFailed
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/50'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`flex-shrink-0 mt-0.5 ${color}`}>{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {slot.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatBytes(slot.bytes)}</span>
                        <span>{formatTime(slot.download_time)}</span>
                        <span>{formatDate(slot.completed)}</span>
                        {slot.category && slot.category !== '*' && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600">
                            {slot.category}
                          </span>
                        )}
                      </div>
                      {isFailed && slot.fail_message && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 line-clamp-2">
                          {slot.fail_message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSlots.length > itemCount && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                +{filteredSlots.length - itemCount} more items
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No history available</p>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
