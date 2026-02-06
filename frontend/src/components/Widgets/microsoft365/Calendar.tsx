import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: string;
  isAllDay: boolean;
  showAs: string;
  organizer?: { name: string; email: string };
  attendees?: Array<{ name: string; email: string; response: string }>;
  isOnlineMeeting: boolean;
  onlineMeetingUrl?: string;
}

interface CalendarData {
  todayEvents: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  stats: {
    todayCount: number;
    weekCount: number;
    nextMeeting?: CalendarEvent;
  };
}

interface CalendarWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeRange(start: string, end: string, isAllDay: boolean): string {
  if (isAllDay) return 'All day';
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function getShowAsColor(showAs: string): string {
  switch (showAs) {
    case 'busy': return 'bg-red-500';
    case 'tentative': return 'bg-yellow-500';
    case 'free': return 'bg-green-500';
    case 'oof': return 'bg-purple-500';
    case 'workingElsewhere': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
}

export function Calendar({ integrationId, config, widgetId }: CalendarWidgetProps) {
  const { data, loading, error } = useWidgetData<CalendarData>({
    integrationId,
    metric: 'calendar',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'agenda';
  const view = (config.view as string) || 'week';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Loading calendar...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{data.stats.todayCount}</div>
              <div className="text-xs text-gray-400">Today</div>
            </div>
            <div className="text-center p-3 bg-purple-500/10 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{data.stats.weekCount}</div>
              <div className="text-xs text-gray-400">This Week</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'next-meeting' && data.stats.nextMeeting) {
    const event = data.stats.nextMeeting;
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-xs text-gray-500 mb-2">Next Meeting</div>
          <div className="text-lg font-medium text-white text-center mb-2">{event.subject}</div>
          <div className="text-sm text-gray-400 mb-2">
            {formatTimeRange(event.start.dateTime, event.end.dateTime, event.isAllDay)}
          </div>
          {event.location && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {event.location}
            </div>
          )}
          {event.isOnlineMeeting && (
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Online
              </span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'today') {
    const events = data.todayEvents;
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="text-xs text-gray-500 mb-2 px-1">Today</div>
          {events.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No events today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map(event => (
                <div key={event.id} className="flex gap-2 p-2 bg-gray-800 rounded-lg">
                  <div className={`w-1 rounded-full ${getShowAsColor(event.showAs)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{event.subject}</div>
                    <div className="text-xs text-gray-400">
                      {formatTimeRange(event.start.dateTime, event.end.dateTime, event.isAllDay)}
                    </div>
                    {event.location && (
                      <div className="text-xs text-gray-500 truncate">{event.location}</div>
                    )}
                  </div>
                  {event.isOnlineMeeting && (
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default agenda view
  const events = view === 'today' ? data.todayEvents : data.upcomingEvents;

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = formatDate(event.start.dateTime);
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                <div className="text-xs font-medium text-gray-500 mb-1 px-1">{date}</div>
                <div className="space-y-1">
                  {dateEvents.map(event => (
                    <div key={event.id} className="flex gap-2 p-2 bg-gray-800 rounded-lg">
                      <div className={`w-1 rounded-full ${getShowAsColor(event.showAs)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{event.subject}</div>
                        <div className="text-xs text-gray-400">
                          {formatTimeRange(event.start.dateTime, event.end.dateTime, event.isAllDay)}
                        </div>
                      </div>
                      {event.isOnlineMeeting && (
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
