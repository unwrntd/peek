import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Database {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  coverUrl: string | null;
  propertyCount: number;
  properties: Array<{ name: string; type: string }>;
  createdTime: string;
  lastEditedTime: string;
  url: string;
}

interface DatabasesData {
  databases: Database[];
  total: number;
}

interface DatabasesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

function renderIcon(icon: string | null): React.ReactNode {
  if (!icon) {
    return (
      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11h6M9 15h6" />
      </svg>
    );
  }
  if (icon.length <= 2) {
    return <span className="text-lg">{icon}</span>;
  }
  return <img src={icon} alt="" className="w-5 h-5 rounded" />;
}

export function Databases({ integrationId, config, widgetId }: DatabasesWidgetProps) {
  const { data, loading, error } = useWidgetData<DatabasesData>({
    integrationId,
    metric: 'databases',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const filters = (config.filters as Record<string, string>) || {};
  const maxItems = parseInt(filters.maxItems || '10', 10);

  const filteredDatabases = useMemo(() => {
    if (!data?.databases) return [];

    let result = data.databases;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(db =>
        db.title.toLowerCase().includes(search) ||
        db.description.toLowerCase().includes(search)
      );
    }

    return result.slice(0, maxItems);
  }, [data, filters, maxItems]);

  if (!data?.databases?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
            </svg>
            <p className="text-sm">No databases found</p>
            <p className="text-xs text-gray-500 mt-1">Share databases with your integration</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="grid grid-cols-1 gap-3">
            {filteredDatabases.map(db => (
              <div
                key={db.id}
                className="p-3 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
              >
                {db.coverUrl && (
                  <div className="h-20 -mx-3 -mt-3 mb-3 rounded-t-lg overflow-hidden">
                    <img src={db.coverUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">{renderIcon(db.icon)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white truncate">{db.title || 'Untitled'}</div>
                    {db.description && (
                      <div className="text-xs text-gray-500 line-clamp-2 mt-1">{db.description}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{db.propertyCount} properties</span>
                      <span>Edited {formatDate(db.lastEditedTime)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="divide-y divide-gray-700/50">
          {filteredDatabases.map(db => (
            <div key={db.id} className="p-3 hover:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">{renderIcon(db.icon)}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white truncate">{db.title || 'Untitled'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{db.propertyCount} properties</span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500">Edited {formatDate(db.lastEditedTime)}</span>
                  </div>
                </div>
                <div className="text-xs font-mono text-gray-600 truncate max-w-[80px]">
                  {db.id.slice(0, 8)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BaseWidget>
  );
}
