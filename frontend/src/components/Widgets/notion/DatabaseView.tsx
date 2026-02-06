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

interface DatabaseViewData {
  database: DatabaseInfo | null;
  items: Array<Record<string, unknown>>;
  total: number;
  hasMore: boolean;
  message?: string;
}

interface DatabaseViewWidgetProps {
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

function formatPropertyValue(value: unknown, type?: string): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-gray-600">-</span>;

  if (typeof value === 'boolean') {
    return value ? (
      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }

  if (typeof value === 'string') {
    return <span className="truncate">{value}</span>;
  }

  if (typeof value === 'number') {
    return <span>{value.toLocaleString()}</span>;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Select/Status
    if ('name' in obj && 'color' in obj) {
      const colorMap: Record<string, string> = {
        default: 'bg-gray-500/20 text-gray-400',
        gray: 'bg-gray-500/20 text-gray-400',
        brown: 'bg-amber-500/20 text-amber-400',
        orange: 'bg-orange-500/20 text-orange-400',
        yellow: 'bg-yellow-500/20 text-yellow-400',
        green: 'bg-green-500/20 text-green-400',
        blue: 'bg-blue-500/20 text-blue-400',
        purple: 'bg-purple-500/20 text-purple-400',
        pink: 'bg-pink-500/20 text-pink-400',
        red: 'bg-red-500/20 text-red-400',
      };
      const color = colorMap[obj.color as string] || colorMap.default;
      return (
        <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>
          {obj.name as string}
        </span>
      );
    }

    // Date
    if ('start' in obj) {
      const date = obj as { start: string; end?: string };
      const startDate = new Date(date.start).toLocaleDateString();
      if (date.end) {
        return <span className="text-xs">{startDate} → {new Date(date.end).toLocaleDateString()}</span>;
      }
      return <span className="text-xs">{startDate}</span>;
    }

    // Multi-select (array)
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 3).map((item, i) => {
            if (typeof item === 'object' && item && 'name' in item) {
              return (
                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                  {(item as { name: string }).name}
                </span>
              );
            }
            return null;
          })}
          {value.length > 3 && (
            <span className="text-xs text-gray-500">+{value.length - 3}</span>
          )}
        </div>
      );
    }
  }

  return <span className="text-gray-500">-</span>;
}

export function DatabaseView({ integrationId, config, widgetId }: DatabaseViewWidgetProps) {
  const filters = (config.filters as Record<string, string>) || {};

  const { data, loading, error } = useWidgetData<DatabaseViewData>({
    integrationId,
    metric: filters.databaseId ? `database-items:${filters.databaseId}` : 'database-items',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const maxItems = parseInt(filters.maxItems || '25', 10);

  const displayItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.slice(0, maxItems);
  }, [data, maxItems]);

  // Find title property
  const titleProperty = useMemo(() => {
    if (!data?.database?.properties) return null;
    return data.database.properties.find(p => p.type === 'title');
  }, [data]);

  // Get display properties (exclude title, limit to 4)
  const displayProperties = useMemo(() => {
    if (!data?.database?.properties) return [];
    return data.database.properties
      .filter(p => p.type !== 'title')
      .slice(0, 4);
  }, [data]);

  if (!filters.databaseId) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No items in database</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          {data.database && (
            <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700 flex items-center gap-2">
              {renderIcon(data.database.icon)}
              <span className="text-sm font-medium text-white">{data.database.title}</span>
              <span className="text-xs text-gray-500">({data.total} items)</span>
            </div>
          )}
          <div className="divide-y divide-gray-700/50">
            {displayItems.map(item => (
              <div key={item.id as string} className="p-3 hover:bg-gray-800/50">
                <div className="flex items-center gap-2 mb-1">
                  {renderIcon(item.icon as string | null)}
                  <span className="font-medium text-white">
                    {titleProperty ? formatPropertyValue(item[titleProperty.name]) : 'Untitled'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {displayProperties.map(prop => {
                    const value = item[prop.name];
                    if (value === null || value === undefined) return null;
                    return (
                      <div key={prop.id} className="flex items-center gap-1">
                        <span className="text-gray-500">{prop.name}:</span>
                        {formatPropertyValue(value, prop.type)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default table view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        {data.database && (
          <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700 flex items-center gap-2 z-10">
            {renderIcon(data.database.icon)}
            <span className="text-sm font-medium text-white">{data.database.title}</span>
            <span className="text-xs text-gray-500">({data.total} items)</span>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="sticky top-10 bg-gray-800 text-gray-400 z-10">
            <tr>
              <th className="text-left p-2 font-medium">
                {titleProperty?.name || 'Title'}
              </th>
              {displayProperties.map(prop => (
                <th key={prop.id} className="text-left p-2 font-medium">
                  {prop.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayItems.map(item => (
              <tr key={item.id as string} className="border-t border-gray-700/50 hover:bg-gray-800/50">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {renderIcon(item.icon as string | null)}
                    <span className="text-white">
                      {titleProperty ? formatPropertyValue(item[titleProperty.name]) : 'Untitled'}
                    </span>
                  </div>
                </td>
                {displayProperties.map(prop => (
                  <td key={prop.id} className="p-2 text-gray-400">
                    {formatPropertyValue(item[prop.name], prop.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
