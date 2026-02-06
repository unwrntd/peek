import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface EventListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ProtectEvent {
  id: string;
  type: string;
  start: number;
  end: number | null;
  camera: string | null;
  sensor: string | null;
  smartDetectTypes: string[];
}

interface EventData {
  events: ProtectEvent[];
}

const eventTypeLabels: Record<string, string> = {
  motion: 'Motion',
  smartDetectZone: 'Smart Detection',
  smartDetectLine: 'Line Crossing',
  ring: 'Doorbell Ring',
  sensorMotion: 'Sensor Motion',
  sensorOpened: 'Opened',
  sensorClosed: 'Closed',
  lightMotion: 'Light Motion',
};

const eventTypeIcons: Record<string, React.ReactNode> = {
  motion: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  smartDetectZone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  ring: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  sensorOpened: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  ),
  sensorClosed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
};

function formatEventTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  // Show date for older events
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getSmartDetectLabel(types: string[]): string {
  if (types.length === 0) return '';
  return types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
}

export function EventList({ integrationId, config, widgetId }: EventListProps) {
  const { data, loading, error } = useWidgetData<EventData>({
    integrationId,
    metric: 'events',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const maxItems = (config.maxItems as number) || 20;
  const eventType = config.eventType as string;
  const showTime = config.showTime !== false;
  const showDevice = config.showDevice !== false;
  const showDetectionTypes = config.showDetectionTypes !== false;
  const hideLabels = (config.hideLabels as boolean) || false;

  // Filter and limit events
  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];

    let events = data.events;

    // Filter by event type
    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }

    // Sort by start time (newest first) and limit
    return events
      .sort((a, b) => b.start - a.start)
      .slice(0, maxItems);
  }, [data?.events, eventType, maxItems]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-2">
          {filteredEvents.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No events found
            </p>
          ) : (
            filteredEvents.map(event => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Event Icon */}
                <div className={`p-2 rounded-full ${
                  event.type === 'ring' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                  event.type.includes('smartDetect') ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                  event.type.includes('sensor') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {eventTypeIcons[event.type] || eventTypeIcons.motion}
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {eventTypeLabels[event.type] || event.type}
                    </span>
                    {showTime && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatEventTime(event.start)}
                      </span>
                    )}
                  </div>

                  {/* Smart detect types */}
                  {showDetectionTypes && event.smartDetectTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.smartDetectTypes.map(type => (
                        <span
                          key={type}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Device info */}
                  {showDevice && (event.camera || event.sensor) && !hideLabels && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {event.camera || event.sensor}
                    </p>
                  )}
                </div>

                {/* Duration indicator for ongoing events */}
                {!event.end && (
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Ongoing" />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </BaseWidget>
  );
}
