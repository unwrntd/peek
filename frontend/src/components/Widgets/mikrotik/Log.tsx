import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface LogEntry {
  id: string;
  time: string;
  topics: string;
  message: string;
}

interface LogWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getTopicColor(topics: string): string {
  const topicList = topics.toLowerCase();
  if (topicList.includes('error') || topicList.includes('critical')) {
    return 'bg-red-500/20 text-red-400';
  }
  if (topicList.includes('warning')) {
    return 'bg-yellow-500/20 text-yellow-400';
  }
  if (topicList.includes('firewall')) {
    return 'bg-orange-500/20 text-orange-400';
  }
  if (topicList.includes('wireless')) {
    return 'bg-purple-500/20 text-purple-400';
  }
  if (topicList.includes('dhcp')) {
    return 'bg-blue-500/20 text-blue-400';
  }
  if (topicList.includes('system')) {
    return 'bg-green-500/20 text-green-400';
  }
  return 'bg-gray-500/20 text-gray-400';
}

function getTopicIcon(topics: string): React.ReactNode {
  const topicList = topics.toLowerCase();
  if (topicList.includes('error') || topicList.includes('critical')) {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (topicList.includes('warning')) {
    return (
      <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  if (topicList.includes('firewall')) {
    return (
      <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function Log({ integrationId, config, widgetId }: LogWidgetProps) {
  const { data, loading, error } = useWidgetData<{ logEntries: LogEntry[] }>({
    integrationId,
    metric: 'log',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const filters = (config.filters as Record<string, string>) || {};
  const maxItems = parseInt(filters.maxItems || '50', 10);

  const filteredEntries = useMemo(() => {
    if (!data?.logEntries) return [];

    let result = data.logEntries;

    if (filters.topic) {
      result = result.filter(entry =>
        entry.topics.toLowerCase().includes(filters.topic.toLowerCase())
      );
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(entry =>
        entry.message.toLowerCase().includes(search) ||
        entry.topics.toLowerCase().includes(search)
      );
    }

    return result.slice(0, maxItems);
  }, [data, filters, maxItems]);

  if (!data?.logEntries?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No log entries found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          <div className="space-y-1 font-mono text-xs">
            {filteredEntries.map(entry => (
              <div
                key={entry.id}
                className="flex items-start gap-2 p-1 hover:bg-gray-800 rounded"
              >
                <span className="text-gray-500 whitespace-nowrap">{entry.time}</span>
                <span className="text-gray-300">{entry.message}</span>
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
          {filteredEntries.map(entry => (
            <div key={entry.id} className="p-3 hover:bg-gray-800/50">
              <div className="flex items-start gap-3">
                {getTopicIcon(entry.topics)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">{entry.time}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getTopicColor(entry.topics)}`}>
                      {entry.topics}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 break-words">{entry.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BaseWidget>
  );
}
