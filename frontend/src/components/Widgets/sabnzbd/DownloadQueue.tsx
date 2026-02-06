import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { SABnzbdQueue, SABnzbdQueueSlot } from '../../../types';

interface DownloadQueueData {
  queue: SABnzbdQueue;
  slots: SABnzbdQueueSlot[];
}

interface DownloadQueueProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatSpeed(speed: string): string {
  const num = parseFloat(speed);
  if (isNaN(num) || num === 0) return '0 B/s';
  if (num >= 1024) return `${(num / 1024).toFixed(1)} GB/s`;
  return `${num.toFixed(1)} MB/s`;
}

function formatSize(mb: string): string {
  const num = parseFloat(mb);
  if (isNaN(num)) return '0 MB';
  if (num >= 1024) return `${(num / 1024).toFixed(2)} GB`;
  return `${num.toFixed(1)} MB`;
}

function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'force':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'high':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'low':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
}

export function DownloadQueue({ integrationId, config, widgetId }: DownloadQueueProps) {
  const { data, loading, error } = useWidgetData<DownloadQueueData>({
    integrationId,
    metric: 'queue',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const queue = data?.queue;
  const slots = data?.slots || [];
  const itemCount = (config.itemCount as number) || 10;

  if (!queue) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No queue data available
        </div>
      </BaseWidget>
    );
  }

  const isPaused = queue.paused;
  const displaySlots = slots.slice(0, itemCount);

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {!hideLabels && (
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{formatSpeed(queue.speed)}</span>
              <span>{queue.noofslots_total} items</span>
              <span>ETA: {queue.timeleft}</span>
            </div>
          )}
          {displaySlots.length > 0 ? (
            displaySlots.map((slot) => {
              const progress = parseFloat(slot.percentage) || 0;
              return (
                <div key={slot.nzo_id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${slot.status === 'Downloading' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                  <span className="flex-1 truncate text-gray-200">{slot.filename}</span>
                  <span className="flex-shrink-0 text-xs text-gray-500">{progress.toFixed(0)}%</span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">Queue empty</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Progress visualization - focused on progress bars
  if (visualization === 'progress') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-3">
          {displaySlots.length > 0 ? (
            displaySlots.map((slot) => {
              const progress = parseFloat(slot.percentage) || 0;
              return (
                <div key={slot.nzo_id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-900 dark:text-white truncate flex-1">{slot.filename}</span>
                    <span className="text-gray-500 ml-2">{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${slot.status === 'Downloading' ? 'bg-blue-500' : 'bg-gray-400'}`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  {!hideLabels && (
                    <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                      <span>{formatSize(slot.mbleft)} left</span>
                      <span>{slot.timeleft}</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">Queue is empty</p>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Queue Summary */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPaused ? 'bg-yellow-100 dark:bg-yellow-900/40' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
              {isPaused ? (
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatSpeed(queue.speed)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {queue.noofslots_total} item{queue.noofslots_total !== 1 ? 's' : ''} in queue
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatSize(queue.mbleft)} left
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ETA: {queue.timeleft}
            </div>
          </div>
        </div>

        {/* Download Slots */}
        {displaySlots.length > 0 ? (
          <div className="space-y-3">
            {displaySlots.map((slot) => {
              const progress = parseFloat(slot.percentage) || 0;
              const totalMb = parseFloat(slot.mb) || 0;
              const leftMb = parseFloat(slot.mbleft) || 0;
              const downloadedMb = totalMb - leftMb;

              return (
                <div
                  key={slot.nzo_id}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {slot.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {slot.cat && slot.cat !== '*' && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                            {slot.cat}
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 text-xs rounded ${getPriorityColor(slot.priority)}`}>
                          {slot.priority}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {progress.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {slot.timeleft}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        slot.status === 'Downloading' ? 'bg-blue-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatSize(downloadedMb.toString())} / {formatSize(slot.mb)}</span>
                    <span>{slot.status}</span>
                  </div>
                </div>
              );
            })}

            {slots.length > itemCount && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                +{slots.length - itemCount} more in queue
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">Queue is empty</p>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
