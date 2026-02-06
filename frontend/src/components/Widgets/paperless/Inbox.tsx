import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface InboxDocument {
  id: number;
  title: string;
  created: string;
  added: string;
}

interface InboxData {
  inbox: InboxDocument[];
  count: number;
}

interface InboxWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateStr);
}

export function Inbox({ integrationId, config, widgetId }: InboxWidgetProps) {
  const { data, loading, error } = useWidgetData<InboxData>({
    integrationId,
    metric: 'inbox',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const inbox = data?.inbox || [];
  const count = data?.count || 0;

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {!hideLabels && count > 0 && (
            <div className="text-xs text-yellow-500 mb-2">{count} awaiting processing</div>
          )}
          {inbox.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-gray-200">{doc.title}</span>
              <span className="text-xs text-gray-500">{formatTimeAgo(doc.added)}</span>
            </div>
          ))}
          {inbox.length === 0 && (
            <div className="text-center py-4 text-green-500 text-sm">Inbox empty</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          {!hideLabels && (
            <div className="flex items-center gap-2 text-sm text-yellow-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              {count} awaiting processing
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {inbox.map(doc => (
              <div
                key={doc.id}
                className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50"
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.title}</div>
                <div className="text-xs text-gray-500 mt-1">{formatTimeAgo(doc.added)}</div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <span className="text-sm text-gray-400">
              {count} document{count !== 1 ? 's' : ''} awaiting processing
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {inbox.map(doc => (
            <div
              key={doc.id}
              className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate" title={doc.title}>
                    {doc.title}
                  </div>
                </div>
                <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                  {formatTimeAgo(doc.added)}
                </span>
              </div>
            </div>
          ))}

          {inbox.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <svg className="w-8 h-8 mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Inbox is empty</span>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
