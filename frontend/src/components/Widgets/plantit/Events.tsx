import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface PlantEvent {
  id: number;
  type: string;
  plantId: number;
  plantName: string;
  date: string;
  notes?: string;
}

interface EventsData {
  events: PlantEvent[];
  total: number;
}

interface EventsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getEventTypeInfo(type: string): { icon: string; label: string; color: string } {
  switch (type) {
    case 'WATERING':
      return { icon: '💧', label: 'Watered', color: 'text-blue-400' };
    case 'FERTILIZING':
      return { icon: '🧪', label: 'Fertilized', color: 'text-green-400' };
    case 'PRUNING':
      return { icon: '✂️', label: 'Pruned', color: 'text-yellow-400' };
    case 'TRANSPLANTING':
      return { icon: '🪴', label: 'Repotted', color: 'text-orange-400' };
    case 'MISTING':
      return { icon: '💨', label: 'Misted', color: 'text-cyan-400' };
    case 'PROPAGATING':
      return { icon: '🌱', label: 'Propagated', color: 'text-lime-400' };
    case 'TREATMENT':
      return { icon: '💊', label: 'Treated', color: 'text-purple-400' };
    case 'BIOSTIMULATING':
      return { icon: '⚡', label: 'Biostimulated', color: 'text-amber-400' };
    default:
      return { icon: '📝', label: type, color: 'text-gray-400' };
  }
}

export function Events({ integrationId, config, widgetId }: EventsWidgetProps) {
  const { data, loading, error } = useWidgetData<EventsData>({
    integrationId,
    metric: 'events',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'timeline';
  const maxItems = (config.maxItems as number) || 20;
  const eventTypeFilter = (config.eventType as string) || '';
  const displayOptions = config.displayOptions as Record<string, boolean> | undefined;
  const showPlantName = displayOptions?.showPlantName !== false;
  const showNotes = displayOptions?.showNotes !== false;
  const showDate = displayOptions?.showDate !== false;

  let events = data?.events || [];

  // Apply event type filter
  if (eventTypeFilter) {
    events = events.filter(e => e.type === eventTypeFilter);
  }

  // Limit items
  events = events.slice(0, maxItems);

  // Timeline visualization
  if (visualization === 'timeline') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No events found
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

              <div className="space-y-3">
                {events.map((event) => {
                  const eventInfo = getEventTypeInfo(event.type);
                  return (
                    <div key={event.id} className="relative flex items-start gap-3 pl-8">
                      {/* Timeline dot */}
                      <div className="absolute left-2.5 w-3 h-3 bg-gray-800 border-2 border-gray-600 rounded-full" />

                      <div className="flex-1 bg-gray-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{eventInfo.icon}</span>
                          <span className={`font-medium text-sm ${eventInfo.color}`}>
                            {eventInfo.label}
                          </span>
                          {showDate && (
                            <span className="text-xs text-gray-500 ml-auto">
                              {formatDate(event.date)}
                            </span>
                          )}
                        </div>
                        {showPlantName && (
                          <div className="text-sm text-white">{event.plantName}</div>
                        )}
                        {showNotes && event.notes && (
                          <div className="text-xs text-gray-400 mt-1 line-clamp-2">{event.notes}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // List visualization
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          {events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No events found
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {events.map((event) => {
                const eventInfo = getEventTypeInfo(event.type);
                return (
                  <div key={event.id} className="p-3 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{eventInfo.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${eventInfo.color}`}>
                            {eventInfo.label}
                          </span>
                          {showPlantName && (
                            <span className="text-sm text-white truncate">- {event.plantName}</span>
                          )}
                        </div>
                        {showNotes && event.notes && (
                          <div className="text-xs text-gray-400 truncate">{event.notes}</div>
                        )}
                      </div>
                      {showDate && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatDate(event.date)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="text-xs text-gray-400 mb-2 px-2">{data?.total || 0} events</div>
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No events found
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => {
              const eventInfo = getEventTypeInfo(event.type);
              return (
                <div
                  key={event.id}
                  className="px-2 py-1 hover:bg-gray-800/50 rounded flex items-center gap-2 text-sm"
                >
                  <span>{eventInfo.icon}</span>
                  <span className={eventInfo.color}>{eventInfo.label}</span>
                  {showPlantName && (
                    <span className="text-gray-400 truncate flex-1">- {event.plantName}</span>
                  )}
                  {showDate && (
                    <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(event.date)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
