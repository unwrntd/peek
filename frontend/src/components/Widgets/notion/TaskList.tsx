import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface DatabaseProperty {
  name: string;
  type: string;
  id: string;
}

interface DatabaseInfo {
  id: string;
  title: string;
  icon: string | null;
  properties: DatabaseProperty[];
}

interface TaskListData {
  database: DatabaseInfo | null;
  items: Array<Record<string, unknown>>;
  total: number;
  hasMore: boolean;
  message?: string;
}

interface TaskListWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function renderIcon(icon: string | null): React.ReactNode {
  if (!icon) return null;
  if (icon.length <= 2) {
    return <span>{icon}</span>;
  }
  return <img src={icon} alt="" className="w-4 h-4 rounded" />;
}

function isTaskComplete(item: Record<string, unknown>, statusProperty: string): boolean {
  const value = item[statusProperty];

  // Checkbox
  if (typeof value === 'boolean') return value;

  // Status object
  if (typeof value === 'object' && value && 'name' in value) {
    const name = ((value as { name: string }).name || '').toLowerCase();
    return name === 'done' || name === 'complete' || name === 'completed';
  }

  return false;
}

function getStatusColor(item: Record<string, unknown>, statusProperty: string): string {
  const value = item[statusProperty];

  if (typeof value === 'object' && value && 'color' in value) {
    const colorMap: Record<string, string> = {
      green: 'text-green-400',
      blue: 'text-blue-400',
      yellow: 'text-yellow-400',
      red: 'text-red-400',
      default: 'text-gray-400',
    };
    return colorMap[(value as { color: string }).color] || colorMap.default;
  }

  return 'text-gray-400';
}

export function TaskList({ integrationId, config, widgetId }: TaskListWidgetProps) {
  const filters = (config.filters as Record<string, string>) || {};
  const statusProperty = filters.statusProperty || 'Status';

  const { data, loading, error } = useWidgetData<TaskListData>({
    integrationId,
    metric: filters.databaseId ? `database-items:${filters.databaseId}` : 'database-items',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const maxItems = parseInt(filters.maxItems || '20', 10);

  // Find title property
  const titleProperty = useMemo(() => {
    if (!data?.database?.properties) return null;
    return data.database.properties.find(p => p.type === 'title');
  }, [data]);

  // Find date property for due dates
  const dateProperty = useMemo(() => {
    if (!data?.database?.properties) return null;
    return data.database.properties.find(p => p.type === 'date');
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    let items = data.items;

    // Filter by completion status
    if (filters.showCompleted === 'incomplete') {
      items = items.filter(item => !isTaskComplete(item, statusProperty));
    } else if (filters.showCompleted === 'complete') {
      items = items.filter(item => isTaskComplete(item, statusProperty));
    }

    return items.slice(0, maxItems);
  }, [data, filters, statusProperty, maxItems]);

  const completedCount = useMemo(() => {
    if (!data?.items) return 0;
    return data.items.filter(item => isTaskComplete(item, statusProperty)).length;
  }, [data, statusProperty]);

  if (!filters.databaseId) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No database selected</p>
            <p className="text-xs text-gray-500 mt-1">Configure the Database ID in widget settings</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (!data?.items?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm">No tasks found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {data.database && renderIcon(data.database.icon)}
              <span className="text-sm font-medium text-white">{data.database?.title || 'Tasks'}</span>
            </div>
            <span className="text-xs text-gray-500">{completedCount}/{data.total} done</span>
          </div>
          <div className="p-2 space-y-1">
            {filteredItems.map(item => {
              const complete = isTaskComplete(item, statusProperty);
              const title = titleProperty ? String(item[titleProperty.name] || 'Untitled') : 'Untitled';

              return (
                <div
                  key={item.id as string}
                  className={`flex items-center gap-2 p-1 rounded hover:bg-gray-800 ${complete ? 'opacity-50' : ''}`}
                >
                  {complete ? (
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className="w-4 h-4 rounded border border-gray-600 flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate ${complete ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                    {title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.database && renderIcon(data.database.icon)}
            <span className="text-sm font-medium text-white">{data.database?.title || 'Tasks'}</span>
          </div>
          <span className="text-xs text-gray-500">{completedCount}/{data.total} done</span>
        </div>
        <div className="divide-y divide-gray-700/50">
          {filteredItems.map(item => {
            const complete = isTaskComplete(item, statusProperty);
            const title = titleProperty ? String(item[titleProperty.name] || 'Untitled') : 'Untitled';
            const status = item[statusProperty];
            const dueDate = dateProperty ? item[dateProperty.name] as { start: string } | null : null;

            return (
              <div
                key={item.id as string}
                className={`p-3 hover:bg-gray-800/50 ${complete ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {complete ? (
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${complete ? 'line-through text-gray-500' : 'text-white'}`}>
                      {title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {typeof status === 'object' && status && 'name' in status && (
                        <span className={`text-xs ${getStatusColor(item, statusProperty)}`}>
                          {(status as { name: string }).name}
                        </span>
                      )}
                      {dueDate && (
                        <span className="text-xs text-gray-500">
                          Due {new Date(dueDate.start).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BaseWidget>
  );
}
