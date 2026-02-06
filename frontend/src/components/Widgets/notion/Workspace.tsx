import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface RecentItem {
  id: string;
  type: string;
  title: string;
  icon: string | null;
  lastEdited: string;
  url: string;
}

interface WorkspaceData {
  bot: {
    id: string;
    name: string;
    type: string;
    avatarUrl: string | null;
  };
  counts: {
    databases: number;
    pages: number;
    total: number;
  };
  recentActivity: RecentItem[];
}

interface WorkspaceWidgetProps {
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
  // If it's an emoji (short string)
  if (icon.length <= 2) {
    return <span className="text-base">{icon}</span>;
  }
  // If it's a URL
  return <img src={icon} alt="" className="w-4 h-4 rounded" />;
}

export function Workspace({ integrationId, config, widgetId }: WorkspaceWidgetProps) {
  const { data, loading, error } = useWidgetData<WorkspaceData>({
    integrationId,
    metric: 'workspace',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm">Loading workspace...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{data.counts.databases}</div>
              <div className="text-xs text-gray-400">Databases</div>
            </div>
            <div className="text-center p-3 bg-purple-500/10 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{data.counts.pages}</div>
              <div className="text-xs text-gray-400">Pages</div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Connected as {data.bot.name}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default card view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
            {data.bot.avatarUrl ? (
              <img src={data.bot.avatarUrl} alt="" className="w-8 h-8 rounded" />
            ) : (
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div>
            <div className="text-sm text-white font-medium">{data.bot.name}</div>
            <div className="text-xs text-gray-500">Notion Integration</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-2 bg-gray-800 rounded">
            <div className="text-lg font-semibold text-white">{data.counts.databases}</div>
            <div className="text-xs text-gray-500">Databases</div>
          </div>
          <div className="text-center p-2 bg-gray-800 rounded">
            <div className="text-lg font-semibold text-white">{data.counts.pages}</div>
            <div className="text-xs text-gray-500">Pages</div>
          </div>
        </div>

        {data.recentActivity.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-2">Recent Activity</div>
            <div className="space-y-1">
              {data.recentActivity.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  {renderIcon(item.icon)}
                  <span className="text-gray-300 truncate flex-1">{item.title || 'Untitled'}</span>
                  <span className="text-gray-500">{formatTimeAgo(item.lastEdited)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
