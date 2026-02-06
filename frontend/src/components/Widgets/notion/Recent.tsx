import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Page {
  id: string;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  parent: { type: string; id?: string };
  createdTime: string;
  lastEditedTime: string;
  createdBy: string;
  lastEditedBy: string;
  url: string;
}

interface RecentData {
  pages: Page[];
  total: number;
}

interface RecentWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function renderIcon(icon: string | null): React.ReactNode {
  if (!icon) {
    return (
      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (icon.length <= 2) {
    return <span className="text-base">{icon}</span>;
  }
  return <img src={icon} alt="" className="w-4 h-4 rounded" />;
}

function getParentLabel(parent: { type: string; id?: string }): string {
  switch (parent.type) {
    case 'database':
      return 'Database';
    case 'page':
      return 'Page';
    case 'workspace':
      return 'Workspace';
    default:
      return parent.type;
  }
}

export function Recent({ integrationId, config, widgetId }: RecentWidgetProps) {
  const { data, loading, error } = useWidgetData<RecentData>({
    integrationId,
    metric: 'recent',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const filters = (config.filters as Record<string, string>) || {};
  const maxItems = parseInt(filters.maxItems || '10', 10);

  const displayPages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.slice(0, maxItems);
  }, [data, maxItems]);

  if (!data?.pages?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No recent pages</p>
            <p className="text-xs text-gray-500 mt-1">Share pages with your integration</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          <div className="space-y-1">
            {displayPages.map(page => (
              <div
                key={page.id}
                className="flex items-center gap-2 p-1 rounded hover:bg-gray-800"
              >
                <div className="flex-shrink-0">{renderIcon(page.icon)}</div>
                <span className="text-sm text-gray-300 truncate flex-1">{page.title || 'Untitled'}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">{formatTimeAgo(page.lastEditedTime)}</span>
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
          {displayPages.map(page => (
            <div key={page.id} className="p-3 hover:bg-gray-800/50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{renderIcon(page.icon)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{page.title || 'Untitled'}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span className="px-1.5 py-0.5 rounded bg-gray-800">
                      {getParentLabel(page.parent)}
                    </span>
                    <span>Edited {formatTimeAgo(page.lastEditedTime)}</span>
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
