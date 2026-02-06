import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RingEvent } from '../../../types';

interface EventListData {
  events: RingEvent[];
  total: number;
  motionCount: number;
  dingCount: number;
}

interface EventListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getEventIcon(kind: string): React.ReactNode {
  switch (kind) {
    case 'ding':
      return (
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
    case 'motion':
      return (
        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
  }
}

function getEventLabel(kind: string): string {
  switch (kind) {
    case 'ding': return 'Doorbell';
    case 'motion': return 'Motion';
    case 'on_demand': return 'Live View';
    default: return kind;
  }
}

export function EventList({ integrationId, config, widgetId }: EventListProps) {
  const { data, loading, error } = useWidgetData<EventListData>({
    integrationId,
    metric: 'events',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const events = data?.events || [];
  const eventType = (config.eventType as string) || '';
  const itemCount = (config.itemCount as number) || 20;
  const showDeviceName = config.showDeviceName !== false;
  const showTime = config.showTime !== false;
  const showAnswered = config.showAnswered !== false;

  // Filter events
  let filteredEvents = events;
  if (eventType) {
    filteredEvents = events.filter(e => e.kind === eventType);
  }

  // Limit items
  const displayEvents = filteredEvents.slice(0, itemCount);

  if (displayEvents.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>No events</span>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {displayEvents.map((event) => (
          <div
            key={event.id}
            className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
          >
            <div className="flex items-center gap-2">
              {getEventIcon(event.kind)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${event.kind === 'ding' ? 'text-blue-600 dark:text-blue-400' : event.kind === 'motion' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {getEventLabel(event.kind)}
                  </span>
                  {showAnswered && event.kind === 'ding' && (
                    <span className={`px-1.5 py-0.5 text-xs rounded ${event.answered ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                      {event.answered ? 'Answered' : 'Missed'}
                    </span>
                  )}
                </div>
                {showDeviceName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{event.deviceName}</p>
                )}
              </div>
              {showTime && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {formatTimestamp(event.createdAt)}
                </span>
              )}
            </div>
          </div>
        ))}

        {filteredEvents.length > itemCount && (
          <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
            +{filteredEvents.length - itemCount} more events
          </div>
        )}

        {/* Summary */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{filteredEvents.length} events</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {data?.motionCount || 0}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {data?.dingCount || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
