import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Task {
  id: string;
  title: string;
  status: string;
  importance: string;
  dueDateTime?: string;
  reminderDateTime?: string;
  createdDateTime: string;
  completedDateTime?: string;
}

interface TaskList {
  id: string;
  displayName: string;
  isOwner: boolean;
  isShared: boolean;
  tasks: Task[];
}

interface TasksData {
  todoLists: TaskList[];
  stats: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    dueToday: number;
  };
  error?: string;
}

interface TasksWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDueDate(dateStr: string): { text: string; color: string } {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: 'Overdue', color: 'text-red-400' };
  if (diffDays === 0) return { text: 'Today', color: 'text-yellow-400' };
  if (diffDays === 1) return { text: 'Tomorrow', color: 'text-blue-400' };
  if (diffDays <= 7) return { text: date.toLocaleDateString([], { weekday: 'short' }), color: 'text-gray-400' };
  return { text: date.toLocaleDateString([], { month: 'short', day: 'numeric' }), color: 'text-gray-500' };
}

export function Tasks({ integrationId, config, widgetId }: TasksWidgetProps) {
  const { data, loading, error } = useWidgetData<TasksData>({
    integrationId,
    metric: 'tasks',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const statusFilter = (config.status as string) || '';
  const listId = (config.listId as string) || '';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm">Loading tasks...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-4">
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{data.stats.pending}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{data.stats.completed}</div>
              <div className="text-xs text-gray-400">Completed</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {data.stats.overdue > 0 && (
              <span className="text-red-400">{data.stats.overdue} overdue</span>
            )}
            {data.stats.dueToday > 0 && (
              <span className="text-yellow-400">{data.stats.dueToday} due today</span>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Get all tasks, optionally filtered by list
  let allTasks: Task[] = [];
  const lists = listId
    ? data.todoLists.filter(l => l.id === listId)
    : data.todoLists;

  lists.forEach(list => {
    allTasks = allTasks.concat(list.tasks.map(t => ({ ...t, listName: list.displayName })));
  });

  // Apply status filter
  if (statusFilter === 'pending') {
    allTasks = allTasks.filter(t => t.status !== 'completed');
  } else if (statusFilter === 'completed') {
    allTasks = allTasks.filter(t => t.status === 'completed');
  }

  // Sort: overdue first, then by due date
  allTasks.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (!a.dueDateTime && !b.dueDateTime) return 0;
    if (!a.dueDateTime) return 1;
    if (!b.dueDateTime) return -1;
    return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();
  });

  if (visualization === 'kanban') {
    const pendingTasks = allTasks.filter(t => t.status !== 'completed').slice(0, 5);
    const completedTasks = allTasks.filter(t => t.status === 'completed').slice(0, 5);

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="grid grid-cols-2 gap-3 h-full">
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full" />
                To Do ({data.stats.pending})
              </div>
              <div className="space-y-1">
                {pendingTasks.map(task => (
                  <div key={task.id} className="p-2 bg-gray-800 rounded text-xs">
                    <div className="text-gray-200 truncate">{task.title}</div>
                    {task.dueDateTime && (
                      <div className={formatDueDate(task.dueDateTime).color}>
                        {formatDueDate(task.dueDateTime).text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                Done ({data.stats.completed})
              </div>
              <div className="space-y-1">
                {completedTasks.map(task => (
                  <div key={task.id} className="p-2 bg-gray-800 rounded text-xs">
                    <div className="text-gray-400 line-through truncate">{task.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        {(data.stats.overdue > 0 || data.stats.dueToday > 0) && (
          <div className="flex items-center gap-3 mb-3 text-xs">
            {data.stats.overdue > 0 && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">
                {data.stats.overdue} overdue
              </span>
            )}
            {data.stats.dueToday > 0 && (
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                {data.stats.dueToday} due today
              </span>
            )}
          </div>
        )}
        <div className="space-y-1">
          {allTasks.slice(0, 20).map(task => (
            <div
              key={task.id}
              className={`flex items-start gap-2 p-2 rounded-lg ${
                task.status === 'completed' ? 'bg-gray-800/50' : 'bg-gray-800'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                task.status === 'completed'
                  ? 'border-green-400 bg-green-400'
                  : 'border-gray-500'
              }`}>
                {task.status === 'completed' && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${
                  task.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'
                }`}>
                  {task.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.dueDateTime && task.status !== 'completed' && (
                    <span className={`text-xs ${formatDueDate(task.dueDateTime).color}`}>
                      {formatDueDate(task.dueDateTime).text}
                    </span>
                  )}
                  {task.importance === 'high' && task.status !== 'completed' && (
                    <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
          {allTasks.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No tasks</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
