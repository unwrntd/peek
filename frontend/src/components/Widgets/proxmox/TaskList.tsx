import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TimelineView, TimelineEvent, timelineIcons } from '../../common/TimelineView';
import { ProxmoxTask } from '../../../types';
import { matchesFilter, matchesAnyFilter } from '../../../utils/filterUtils';
import { formatDuration } from '../../../utils/formatting';

interface TaskListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TaskData {
  tasks: ProxmoxTask[];
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

function formatTaskDuration(start: number, end?: number): string {
  const endTime = end || Math.floor(Date.now() / 1000);
  const duration = endTime - start;
  return formatDuration(duration);
}

function getStatusColor(status: string): string {
  if (status === 'OK' || status === 'running') return 'text-green-600 dark:text-green-400';
  if (status.includes('WARNINGS')) return 'text-yellow-600 dark:text-yellow-400';
  if (status.includes('ERROR') || status === 'failed') return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

function getStatusBadge(status: string): string {
  if (status === 'OK' || status === 'running') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (status.includes('WARNINGS')) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  if (status.includes('ERROR') || status === 'failed') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400';
}

export function TaskList({ integrationId, config, widgetId }: TaskListProps) {
  const { data, loading, error } = useWidgetData<TaskData>({
    integrationId,
    metric: (config.metric as string) || 'tasks',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const showUser = config.showUser !== false;
  const showDuration = config.showDuration !== false;
  const compactView = config.compactView === true;
  const maxItems = (config.maxItems as number) || 15;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'table';

  // Apply filters (supports wildcards and comma-separated lists)
  const filteredTasks = data?.tasks.filter(task => {
    const nodeFilter = config.nodeFilter as string;
    if (nodeFilter && !matchesFilter(task.node, nodeFilter)) return false;

    const taskType = config.taskType as string;
    if (taskType && task.type !== taskType) return false;

    const statusFilter = config.status as string;
    if (statusFilter === 'running' && task.endtime) return false;
    if (statusFilter === 'completed' && !task.endtime) return false;
    if (statusFilter === 'failed' && !task.status.includes('ERROR')) return false;

    // Search filter (supports wildcards and comma-separated lists)
    const search = config.search as string;
    if (search && !matchesAnyFilter([task.type, task.user, task.id], search)) {
      return false;
    }

    return true;
  }).slice(0, maxItems) || [];

  // Helper to get timeline status from task status
  const getTimelineStatus = (task: ProxmoxTask): 'success' | 'error' | 'warning' | 'pending' => {
    if (!task.endtime) return 'pending';
    if (task.status === 'OK') return 'success';
    if (task.status.includes('WARNINGS')) return 'warning';
    if (task.status.includes('ERROR')) return 'error';
    return 'success';
  };

  // Helper to get task icon based on type
  const getTaskIcon = (taskType: string) => {
    if (taskType.includes('vzdump') || taskType.includes('backup')) return timelineIcons.download;
    if (taskType.includes('restore')) return timelineIcons.upload;
    if (taskType.includes('start') || taskType.includes('qmstart')) return timelineIcons.play;
    if (taskType.includes('stop') || taskType.includes('qmstop')) return timelineIcons.error;
    return timelineIcons.task;
  };

  // Convert tasks to timeline events
  const timelineEvents: TimelineEvent[] = filteredTasks.map(task => ({
    id: task.upid,
    title: task.type + (task.id ? ` (${task.id})` : ''),
    subtitle: [task.node, showUser ? task.user : null, showDuration ? formatTaskDuration(task.starttime, task.endtime) : null]
      .filter(Boolean)
      .join(' • '),
    timestamp: task.starttime * 1000,
    status: getTimelineStatus(task),
    icon: getTaskIcon(task.type),
  }));

  // Render timeline view
  const renderTimelineView = () => (
    <TimelineView
      events={timelineEvents}
      compact={compactView}
      showLine={true}
      relativeTime={true}
      emptyMessage={data?.tasks.length === 0 ? 'No tasks found' : 'No tasks match filter'}
    />
  );

  // Render table view (original)
  const renderTableView = () => (
    <div className={`space-y-${compactView ? '1' : '2'}`}>
      {filteredTasks.map((task) => (
        <div
          key={task.upid}
          className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {task.type}
                </span>
                {task.id && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({task.id})
                  </span>
                )}
              </div>
              {!hideLabels && (
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>{task.node}</span>
                  {showUser && (
                    <>
                      <span>•</span>
                      <span>{task.user}</span>
                    </>
                  )}
                  {showDuration && (
                    <>
                      <span>•</span>
                      <span>{formatTaskDuration(task.starttime, task.endtime)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(task.status)}`}>
              {task.endtime ? task.status : 'running'}
            </span>
          </div>
          {!compactView && !hideLabels && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Started: {formatDate(task.starttime)}
              {task.endtime && ` • Ended: ${formatDate(task.endtime)}`}
            </div>
          )}
        </div>
      ))}
      {filteredTasks.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          {data?.tasks.length === 0 ? 'No tasks found' : 'No tasks match filter'}
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
