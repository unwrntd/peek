import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface HomeAssistantLogEntry {
  when: string;
  name: string;
  message?: string;
  entity_id?: string;
  domain?: string;
  state?: string;
  icon?: string;
}

interface LogbookData {
  entries: HomeAssistantLogEntry[];
}

interface LogbookProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function getDomainIcon(domain?: string): React.ReactNode {
  switch (domain) {
    case 'light':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'switch':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'automation':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'scene':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function getStateColor(state?: string): string {
  if (!state) return 'text-gray-500 dark:text-gray-400';
  switch (state.toLowerCase()) {
    case 'on':
    case 'triggered':
      return 'text-green-600 dark:text-green-400';
    case 'off':
      return 'text-gray-500 dark:text-gray-400';
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
}

export function Logbook({ integrationId, config, widgetId }: LogbookProps) {
  const { data, loading, error } = useWidgetData<LogbookData>({
    integrationId,
    metric: 'logbook',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const domainFilter = (config.domain as string) || '';
  const search = (config.search as string) || '';
  const maxItems = (config.maxItems as number) || 50;
  const showTime = config.showTime !== false;
  const showEntityId = config.showEntityId === true;
  const showState = config.showState !== false;

  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];

    let filtered = data.entries;

    // Filter by domain
    if (domainFilter) {
      filtered = filtered.filter(e => e.domain === domainFilter || e.entity_id?.startsWith(`${domainFilter}.`));
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        (e.entity_id || '').toLowerCase().includes(searchLower) ||
        (e.message || '').toLowerCase().includes(searchLower)
      );
    }

    // Sort by time (most recent first)
    filtered.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

    return filtered.slice(0, maxItems);
  }, [data?.entries, domainFilter, search, maxItems]);

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">No entries</div>
          ) : (
            filteredEntries.map((entry, index) => (
              <div key={`${entry.when}-${index}`} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStateColor(entry.state).replace('text-', 'bg-')}`} />
                <span className="flex-1 truncate text-gray-200">{entry.name}</span>
                {showState && entry.state && (
                  <span className={`flex-shrink-0 text-xs ${getStateColor(entry.state)}`}>{entry.state}</span>
                )}
                {showTime && (
                  <span className="flex-shrink-0 text-xs text-gray-500">{formatRelativeTime(entry.when)}</span>
                )}
              </div>
            ))
          )}
        </div>
      </BaseWidget>
    );
  }

  // Timeline visualization
  if (visualization === 'timeline') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="relative overflow-y-auto h-full">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-3">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm pl-8">No entries</div>
            ) : (
              filteredEntries.map((entry, index) => {
                const domain = entry.domain || entry.entity_id?.split('.')[0];
                return (
                  <div key={`${entry.when}-${index}`} className="relative pl-8">
                    <div className={`absolute left-1.5 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 ${getStateColor(entry.state).replace('text-', 'border-')} flex items-center justify-center`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${getStateColor(entry.state).replace('text-', 'bg-')}`} />
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.name}</span>
                        {showState && entry.state && (
                          <span className={`text-xs font-medium ml-2 ${getStateColor(entry.state)}`}>{entry.state}</span>
                        )}
                      </div>
                      {!hideLabels && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          {showTime && <span>{formatTime(entry.when)} ({formatRelativeTime(entry.when)})</span>}
                          {showEntityId && entry.entity_id && <span>{entry.entity_id}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-1">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            No log entries found
          </div>
        ) : (
          filteredEntries.map((entry, index) => {
            const domain = entry.domain || entry.entity_id?.split('.')[0];

            return (
              <div
                key={`${entry.when}-${index}`}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Domain Icon */}
                <div className="flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400">
                  {getDomainIcon(domain)}
                </div>

                {/* Entry Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {entry.name}
                    </p>
                    {showState && entry.state && (
                      <span className={`text-xs font-medium ${getStateColor(entry.state)}`}>
                        {entry.state}
                      </span>
                    )}
                  </div>
                  {!hideLabels && entry.message && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                      {entry.message}
                    </p>
                  )}
                  {showEntityId && !hideLabels && entry.entity_id && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {entry.entity_id}
                    </p>
                  )}
                </div>

                {/* Time */}
                {showTime && (
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(entry.when)}
                    </p>
                    {!hideLabels && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(entry.when)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </BaseWidget>
  );
}
