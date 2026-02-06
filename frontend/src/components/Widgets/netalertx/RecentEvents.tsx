import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { BaseWidget } from '../BaseWidget';
import { NetAlertXEvent } from '../../../types';

interface RecentEventsData {
  events: NetAlertXEvent[];
}

interface RecentEventsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function RecentEvents({ integrationId, config, widgetId }: RecentEventsProps) {
  const { rIP, rMAC } = useRedact();
  const { data, loading, error } = useWidgetData<RecentEventsData>({
    integrationId,
    metric: 'recent-events',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const eventTypeFilter = (config.eventType as string) || '';
  const searchFilter = (config.search as string) || '';
  const maxItems = (config.maxItems as number) || 20;
  const hideLabels = config.hideLabels === true;

  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];

    let events = data.events;

    // Apply event type filter
    if (eventTypeFilter) {
      events = events.filter(event =>
        event.eve_EventType?.includes(eventTypeFilter)
      );
    }

    // Apply search filter
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      events = events.filter(event =>
        event.eve_MAC?.toLowerCase().includes(search) ||
        event.eve_IP?.toLowerCase().includes(search)
      );
    }

    return events.slice(0, maxItems);
  }, [data?.events, eventTypeFilter, searchFilter, maxItems]);

  const getEventIcon = (eventType: string) => {
    if (eventType?.includes('Connected')) {
      return (
        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    if (eventType?.includes('Disconnected')) {
      return (
        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
      );
    }
    if (eventType?.includes('Down')) {
      return (
        <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    }
    if (eventType?.includes('New')) {
      return (
        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            No recent events
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <div
              key={`${event.eve_MAC}-${event.eve_DateTime}-${index}`}
              className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              {getEventIcon(event.eve_EventType)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {event.eve_EventType}
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {formatTime(event.eve_DateTime)}
                  </span>
                </div>
                {!hideLabels && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                      {rIP(event.eve_IP)}
                    </p>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                      {rMAC(event.eve_MAC)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </BaseWidget>
  );
}
