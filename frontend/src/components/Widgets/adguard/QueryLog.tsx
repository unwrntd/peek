import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { BaseWidget } from '../BaseWidget';
import { TimelineView, TimelineEvent, timelineIcons } from '../../common/TimelineView';
import { AdGuardQueryLogEntry } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface QueryLogProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface QueryLogData {
  entries: AdGuardQueryLogEntry[];
  oldest: string;
}

function formatTime(timeStr: string): string {
  const date = new Date(timeStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStatusColor(reason: string): string {
  if (reason === 'NotFilteredNotFound' || reason === 'NotFilteredWhiteList') {
    return 'text-green-600 dark:text-green-400';
  }
  if (reason.includes('Filtered') || reason.includes('Blocked')) {
    return 'text-red-600 dark:text-red-400';
  }
  if (reason.includes('Rewrite') || reason.includes('SafeSearch')) {
    return 'text-yellow-600 dark:text-yellow-400';
  }
  return 'text-gray-600 dark:text-gray-400';
}

function getStatusBadge(reason: string): { text: string; className: string } {
  if (reason === 'NotFilteredNotFound' || reason === 'NotFilteredWhiteList') {
    return { text: 'Allowed', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' };
  }
  if (reason.includes('FilteredBlackList') || reason.includes('FilteredBlockedService')) {
    return { text: 'Blocked', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
  }
  if (reason.includes('SafeBrowsing')) {
    return { text: 'Safe Browse', className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' };
  }
  if (reason.includes('SafeSearch')) {
    return { text: 'Safe Search', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' };
  }
  if (reason.includes('Parental')) {
    return { text: 'Parental', className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' };
  }
  if (reason.includes('Rewrite')) {
    return { text: 'Rewrite', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' };
  }
  return { text: reason, className: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
}

export function QueryLog({ integrationId, config, widgetId }: QueryLogProps) {
  const { rIP, r } = useRedact();
  const { data, loading, error } = useWidgetData<QueryLogData>({
    integrationId,
    metric: 'query-log',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const limit = (config.limit as number) || 50;
  const compactView = config.compactView === true;
  const showOnlyBlocked = config.showOnlyBlocked === true;
  const search = config.search as string;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'table';

  // Column visibility - default to true if not explicitly set to false
  const showTime = config.showTime !== false;
  const showDomain = config.showDomain !== false;
  const showType = config.showType !== false;
  const showClient = config.showClient !== false;
  const showStatus = config.showStatus !== false;
  const showResponse = config.showResponse !== false;

  // Memoize filtering for performance
  const displayEntries = useMemo(() => {
    let entries = data?.entries || [];

    if (showOnlyBlocked) {
      entries = entries.filter(e =>
        e.reason.includes('Filtered') ||
        e.reason.includes('Blocked') ||
        e.reason.includes('SafeBrowsing') ||
        e.reason.includes('Parental')
      );
    }

    if (search) {
      entries = entries.filter(e =>
        matchesAnyFilter([e.question.name, e.client], search)
      );
    }

    return entries.slice(0, limit);
  }, [data?.entries, showOnlyBlocked, search, limit]);

  // Get timeline status from reason
  const getTimelineStatus = (reason: string): 'success' | 'error' | 'warning' | 'info' => {
    if (reason === 'NotFilteredNotFound' || reason === 'NotFilteredWhiteList') return 'success';
    if (reason.includes('Filtered') || reason.includes('Blocked')) return 'error';
    if (reason.includes('Rewrite') || reason.includes('SafeSearch') || reason.includes('SafeBrowsing') || reason.includes('Parental')) return 'warning';
    return 'info';
  };

  // Get timeline icon from reason
  const getTimelineIcon = (reason: string) => {
    if (reason === 'NotFilteredNotFound' || reason === 'NotFilteredWhiteList') return timelineIcons.check;
    if (reason.includes('Filtered') || reason.includes('Blocked')) return timelineIcons.error;
    if (reason.includes('SafeBrowsing') || reason.includes('Parental')) return timelineIcons.alert;
    return timelineIcons.query;
  };

  // Convert entries to timeline events
  const timelineEvents: TimelineEvent[] = displayEntries.map((entry, index) => {
    const badge = getStatusBadge(entry.reason);
    return {
      id: String(index),
      title: r(entry.question.name) || '',
      subtitle: [badge.text, rIP(entry.client), `${entry.elapsedMs}ms`].join(' • '),
      timestamp: new Date(entry.time),
      status: getTimelineStatus(entry.reason),
      icon: getTimelineIcon(entry.reason),
    };
  });

  // Render timeline view
  const renderTimelineView = () => (
    <TimelineView
      events={timelineEvents}
      compact={compactView}
      showLine={true}
      relativeTime={true}
      emptyMessage="No query log entries"
    />
  );

  // Render table view (original)
  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        {!hideLabels && (
          <thead>
            <tr className={`border-b border-gray-200 dark:border-gray-700 ${compactView ? 'text-xs' : 'text-sm'}`}>
              {showTime && <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">Time</th>}
              {showDomain && <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">Domain</th>}
              {showType && <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">Type</th>}
              {showClient && <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">Client</th>}
              {showStatus && <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">Status</th>}
              {showResponse && <th className="pb-2 font-medium text-gray-500 dark:text-gray-400 text-right">Response</th>}
            </tr>
          </thead>
        )}
        <tbody className={compactView ? 'text-xs' : 'text-sm'}>
          {displayEntries.map((entry, index) => {
            const badge = getStatusBadge(entry.reason);
            return (
              <tr
                key={index}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                {showTime && (
                  <td className={`${compactView ? 'py-1' : 'py-2'} text-gray-500 dark:text-gray-400 whitespace-nowrap`}>
                    {formatTime(entry.time)}
                  </td>
                )}
                {showDomain && (
                  <td className={`${compactView ? 'py-1' : 'py-2'} ${getStatusColor(entry.reason)} truncate max-w-[200px]`}>
                    {r(entry.question.name)}
                  </td>
                )}
                {showType && (
                  <td className={`${compactView ? 'py-1' : 'py-2'} text-gray-500 dark:text-gray-400`}>
                    {entry.question.type}
                  </td>
                )}
                {showClient && (
                  <td className={`${compactView ? 'py-1' : 'py-2'} font-mono text-gray-600 dark:text-gray-400`}>
                    {rIP(entry.client)}
                  </td>
                )}
                {showStatus && (
                  <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                      {badge.text}
                    </span>
                  </td>
                )}
                {showResponse && (
                  <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-gray-500 dark:text-gray-400`}>
                    {entry.elapsedMs}ms
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {displayEntries.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
          No query log entries
        </p>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        visualizationType === 'timeline' ? renderTimelineView() : renderTableView()
      )}
    </BaseWidget>
  );
}
