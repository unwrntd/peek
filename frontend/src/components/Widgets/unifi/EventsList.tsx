import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TimelineView, TimelineEvent, timelineIcons } from '../../common/TimelineView';
import { UnifiEvent } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon, IconType } from '../../../utils/icons';

interface EventsListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface EventsData {
  events: UnifiEvent[];
}

// Event type icons/colors based on key patterns
function getEventStyle(key: string): { color: string; iconType: IconType } {
  if (key.includes('EVT_WU') || key.includes('guest')) {
    return { color: 'text-blue-500', iconType: 'wifi' };
  }
  if (key.includes('EVT_SW') || key.includes('switch')) {
    return { color: 'text-green-500', iconType: 'plug' };
  }
  if (key.includes('EVT_GW') || key.includes('wan') || key.includes('WAN')) {
    return { color: 'text-purple-500', iconType: 'globe' };
  }
  if (key.includes('EVT_AP')) {
    return { color: 'text-cyan-500', iconType: 'sensor' };
  }
  if (key.includes('warning') || key.includes('WARN')) {
    return { color: 'text-yellow-500', iconType: 'warning' };
  }
  if (key.includes('error') || key.includes('ERROR') || key.includes('disconnect')) {
    return { color: 'text-red-500', iconType: 'error' };
  }
  return { color: 'text-gray-500', iconType: 'list' };
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function EventsList({ integrationId, config, widgetId }: EventsListProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<EventsData>({
    integrationId,
    metric: (config.metric as string) || 'events',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Subsystem visibility (default to true if not set)
  const showWlan = config.showWlan !== false;
  const showLan = config.showLan !== false;
  const showWan = config.showWan !== false;
  const showSystem = config.showSystem !== false;

  const subsystemVisibility: Record<string, boolean> = {
    wlan: showWlan,
    lan: showLan,
    wan: showWan,
    system: showSystem,
  };

  // Apply filters
  const filteredEvents = data?.events.filter(event => {
    // Subsystem filter based on checkboxes
    if (subsystemVisibility[event.subsystem] === false) return false;

    // Search filter (supports wildcards and comma-separated lists)
    const search = config.search as string;
    if (search && !matchesAnyFilter([event.msg, event.key], search)) {
      return false;
    }

    return true;
  }) || [];

  const maxItems = (config.maxItems as number) || 15;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'list';

  // Get timeline status based on event key
  const getTimelineStatus = (key: string): 'success' | 'error' | 'warning' | 'info' => {
    if (key.includes('error') || key.includes('ERROR') || key.includes('disconnect')) return 'error';
    if (key.includes('warning') || key.includes('WARN')) return 'warning';
    if (key.includes('connect') || key.includes('up')) return 'success';
    return 'info';
  };

  // Get timeline icon based on event key
  const getTimelineIcon = (key: string) => {
    if (key.includes('EVT_WU') || key.includes('guest') || key.includes('wifi')) return timelineIcons.motion;
    if (key.includes('EVT_GW') || key.includes('wan') || key.includes('WAN')) return timelineIcons.upload;
    if (key.includes('error') || key.includes('ERROR') || key.includes('disconnect')) return timelineIcons.error;
    if (key.includes('warning') || key.includes('WARN')) return timelineIcons.alert;
    return timelineIcons.task;
  };

  // Convert events to timeline format
  const timelineEvents: TimelineEvent[] = filteredEvents.slice(0, maxItems).map(event => ({
    id: event._id,
    title: event.msg,
    subtitle: event.subsystem,
    timestamp: event.time,
    status: getTimelineStatus(event.key),
    icon: getTimelineIcon(event.key),
  }));

  // Render timeline view
  const renderTimelineView = () => (
    <TimelineView
      events={timelineEvents}
      compact={hideLabels}
      showLine={true}
      relativeTime={true}
      emptyMessage={data?.events.length === 0 ? 'No recent events' : 'No events match filters'}
    />
  );

  // Render list view (original)
  const renderListView = () => (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {filteredEvents.slice(0, maxItems).map(event => {
        const style = getEventStyle(event.key);
        return (
          <div
            key={event._id}
            className={`flex items-start gap-2 p-2 ${hideLabels ? '' : 'bg-gray-50 dark:bg-gray-700'} rounded-lg`}
          >
            {!hideLabels && <span className="text-lg flex-shrink-0">{getIcon(style.iconType, iconStyle, 'w-5 h-5')}</span>}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 dark:text-white line-clamp-2">{event.msg}</div>
              {!hideLabels && (
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className={style.color}>{event.subsystem}</span>
                  <span>•</span>
                  <span>{formatTime(event.time)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {filteredEvents.length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          <p>{data?.events.length === 0 ? 'No recent events' : 'No events match filters'}</p>
          {data?.events.length === 0 && (
            <p className="text-xs mt-1">This feature requires username/password authentication</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        visualizationType === 'timeline' ? renderTimelineView() : renderListView()
      )}
    </BaseWidget>
  );
}
