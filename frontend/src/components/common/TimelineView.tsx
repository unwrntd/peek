import React from 'react';

export interface TimelineEvent {
  id: string;
  title: string;
  subtitle?: string;
  timestamp: Date | string | number;
  status?: 'success' | 'error' | 'warning' | 'info' | 'pending';
  icon?: React.ReactNode;
  details?: React.ReactNode;
}

interface TimelineViewProps {
  events: TimelineEvent[];
  /** Show relative time (e.g., "5 min ago") vs absolute time */
  relativeTime?: boolean;
  /** Show the connecting line between events */
  showLine?: boolean;
  /** Compact mode with less spacing */
  compact?: boolean;
  /** Maximum items to display */
  maxItems?: number;
  /** Empty state message */
  emptyMessage?: string;
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'info':
      return 'bg-blue-500';
    case 'pending':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

function getStatusRingColor(status?: string): string {
  switch (status) {
    case 'success':
      return 'ring-green-200 dark:ring-green-900';
    case 'error':
      return 'ring-red-200 dark:ring-red-900';
    case 'warning':
      return 'ring-yellow-200 dark:ring-yellow-900';
    case 'info':
      return 'ring-blue-200 dark:ring-blue-900';
    case 'pending':
      return 'ring-gray-200 dark:ring-gray-700';
    default:
      return 'ring-gray-200 dark:ring-gray-700';
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatAbsoluteTime(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
}

function parseTimestamp(timestamp: Date | string | number): Date {
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') {
    // Handle Unix timestamps (seconds vs milliseconds)
    return new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
  }
  return new Date(timestamp);
}

/**
 * A reusable timeline view component for displaying chronological events.
 * Ideal for history, activity logs, and event lists.
 */
export function TimelineView({
  events,
  relativeTime = true,
  showLine = true,
  compact = false,
  maxItems,
  emptyMessage = 'No events to display',
}: TimelineViewProps) {
  const displayEvents = maxItems ? events.slice(0, maxItems) : events;

  if (displayEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
        <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {displayEvents.map((event, index) => {
        const date = parseTimestamp(event.timestamp);
        const timeString = relativeTime ? formatRelativeTime(date) : formatAbsoluteTime(date);
        const isLast = index === displayEvents.length - 1;

        return (
          <div
            key={event.id}
            className={`relative flex gap-3 ${compact ? 'pb-3' : 'pb-4'} ${isLast ? '' : ''}`}
          >
            {/* Timeline dot and line */}
            <div className="relative flex flex-col items-center">
              {/* Dot */}
              <div
                className={`w-3 h-3 rounded-full ${getStatusColor(event.status)} ring-2 ${getStatusRingColor(event.status)} flex-shrink-0 z-10`}
              />
              {/* Connecting line */}
              {showLine && !isLast && (
                <div className="w-0.5 bg-gray-200 dark:bg-gray-700 flex-1 mt-1" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 min-w-0 ${compact ? '-mt-0.5' : '-mt-1'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {event.icon && (
                      <span className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                        {event.icon}
                      </span>
                    )}
                    <h4 className={`font-medium text-gray-900 dark:text-white truncate ${compact ? 'text-sm' : ''}`}>
                      {event.title}
                    </h4>
                  </div>
                  {event.subtitle && (
                    <p className={`text-gray-500 dark:text-gray-400 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                      {event.subtitle}
                    </p>
                  )}
                </div>
                <span className={`flex-shrink-0 text-gray-500 dark:text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {timeString}
                </span>
              </div>
              {event.details && (
                <div className={`mt-1 text-gray-600 dark:text-gray-300 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {event.details}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {maxItems && events.length > maxItems && (
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-1">
          +{events.length - maxItems} more events
        </div>
      )}
    </div>
  );
}

/**
 * Predefined icons for common event types
 */
export const timelineIcons = {
  task: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  upload: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  play: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alert: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  motion: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  query: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
};
