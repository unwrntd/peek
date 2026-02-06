import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Task {
  id: number;
  task_id: string;
  task_file_name: string;
  date_created: string;
  date_done: string | null;
  type: string;
  status: string;
  result: string | null;
  acknowledged: boolean;
  related_document: string | null;
}

interface TasksData {
  tasks: Task[];
  total: number;
  pending: number;
  failed: number;
  success: number;
}

interface TasksWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getStatusColor(status: string): string {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
      return 'bg-green-500';
    case 'FAILURE':
      return 'bg-red-500';
    case 'PENDING':
    case 'STARTED':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
}

function getStatusTextColor(status: string): string {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
      return 'text-green-400';
    case 'FAILURE':
      return 'text-red-400';
    case 'PENDING':
    case 'STARTED':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Tasks({ integrationId, config, widgetId }: TasksWidgetProps) {
  const { data, loading, error } = useWidgetData<TasksData>({
    integrationId,
    metric: 'tasks',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const tasks = data?.tasks || [];

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-xs text-gray-400">{data?.pending || 0} pending</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-400">{data?.success || 0} done</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-gray-400">{data?.failed || 0} failed</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                  <span className="font-medium text-white truncate max-w-[200px]" title={task.task_file_name}>
                    {task.task_file_name || task.type || 'Unknown Task'}
                  </span>
                </div>
                <span className={`text-xs ${getStatusTextColor(task.status)}`}>
                  {task.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{task.type}</span>
                <span>{formatDate(task.date_created)}</span>
              </div>
              {task.result && task.status === 'FAILURE' && (
                <div className="mt-2 text-xs text-red-400 truncate" title={task.result}>
                  {task.result}
                </div>
              )}
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <svg className="w-8 h-8 mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>No recent tasks</span>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
