import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Task {
  id: string;
  title: string;
  notes?: string;
  status: string;
  due?: string;
  completed?: string;
  parent?: string;
  position: string;
}

interface TaskList {
  id: string;
  title: string;
  tasks: Task[];
}

interface TasksData {
  taskLists: TaskList[];
  stats: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
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

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm">Loading Tasks...</p>
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
          {data.stats.overdue > 0 && (
            <div className="text-xs text-red-400">{data.stats.overdue} overdue</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'by-list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="space-y-4">
            {data.taskLists.map((list) => {
              let tasks = list.tasks;
              if (statusFilter === 'pending') {
                tasks = tasks.filter((t) => t.status === 'needsAction');
              } else if (statusFilter === 'completed') {
                tasks = tasks.filter((t) => t.status === 'completed');
              }

              if (tasks.length === 0 && statusFilter) return null;

              return (
                <div key={list.id}>
                  <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {list.title}
                    <span className="text-gray-600">({tasks.length})</span>
                  </div>
                  <div className="space-y-1 pl-5">
                    {tasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-start gap-2 p-1.5 rounded ${
                          task.status === 'completed' ? 'opacity-50' : ''
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            task.status === 'completed' ? 'border-green-400 bg-green-400' : 'border-gray-500'
                          }`}
                        >
                          {task.status === 'completed' && (
                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                          )}
                        </div>
                        <span
                          className={`text-xs ${
                            task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-300'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                    ))}
                    {tasks.length > 5 && <div className="text-xs text-gray-500 pl-5">+{tasks.length - 5} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view - flatten all tasks
  let allTasks: (Task & { listName: string })[] = [];
  data.taskLists.forEach((list) => {
    allTasks = allTasks.concat(list.tasks.map((t) => ({ ...t, listName: list.title })));
  });

  // Apply status filter
  if (statusFilter === 'pending') {
    allTasks = allTasks.filter((t) => t.status === 'needsAction');
  } else if (statusFilter === 'completed') {
    allTasks = allTasks.filter((t) => t.status === 'completed');
  }

  // Sort: overdue first, then by due date, then pending before completed
  allTasks.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        {data.stats.overdue > 0 && (
          <div className="mb-3 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
            {data.stats.overdue} overdue tasks
          </div>
        )}
        <div className="space-y-1">
          {allTasks.slice(0, 20).map((task) => (
            <div
              key={task.id}
              className={`flex items-start gap-2 p-2 rounded-lg ${
                task.status === 'completed' ? 'bg-gray-800/50' : 'bg-gray-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  task.status === 'completed' ? 'border-green-400 bg-green-400' : 'border-gray-500'
                }`}
              >
                {task.status === 'completed' && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'}`}>
                  {task.title}
                </div>
                {task.due && task.status !== 'completed' && (
                  <span className={`text-xs ${formatDueDate(task.due).color}`}>{formatDueDate(task.due).text}</span>
                )}
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
