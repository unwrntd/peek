import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Tag {
  id: number;
  name: string;
  color: string;
  is_inbox_tag: boolean;
  document_count: number;
  matching_algorithm: number;
}

interface TagsData {
  tags: Tag[];
  total: number;
}

interface TagsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Tags({ integrationId, config, widgetId }: TagsWidgetProps) {
  const { data, loading, error } = useWidgetData<TagsData>({
    integrationId,
    metric: 'tags',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cloud';
  const hideLabels = (config.hideLabels as boolean) || false;
  const tags = data?.tags || [];
  const sortedTags = [...tags].sort((a, b) => (b.document_count || 0) - (a.document_count || 0));

  // List visualization
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {!hideLabels && <div className="text-xs text-gray-500 mb-2">{data?.total || 0} tags</div>}
          {sortedTags.map(tag => (
            <div key={tag.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#6b7280' }} />
                <span className="text-sm text-gray-200">{tag.name}</span>
              </div>
              <span className="text-xs text-gray-500">{tag.document_count || 0}</span>
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Bars visualization
  if (visualization === 'bars') {
    const maxCount = Math.max(...sortedTags.map(t => t.document_count || 0), 1);
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2 overflow-y-auto h-full">
          {sortedTags.slice(0, 10).map(tag => (
            <div key={tag.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-200">{tag.name}</span>
                <span className="text-xs text-gray-500">{tag.document_count || 0}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${((tag.document_count || 0) / maxCount) * 100}%`,
                    backgroundColor: tag.color || '#6b7280',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cloud visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="text-sm text-gray-400">{data?.total || 0} tags</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {sortedTags.map(tag => (
              <div
                key={tag.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors"
                style={{
                  borderLeft: `3px solid ${tag.color || '#6b7280'}`,
                }}
              >
                <span className="text-sm text-white">{tag.name}</span>
                <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
                  {tag.document_count || 0}
                </span>
                {tag.is_inbox_tag && (
                  <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          {tags.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              No tags found
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
