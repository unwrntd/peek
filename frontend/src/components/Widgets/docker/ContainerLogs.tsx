import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface ContainerLogsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface LogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr';
  message: string;
}

interface LogsData {
  logs: LogEntry[];
  containerName?: string;
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return timestamp;
  }
}

export function ContainerLogs({ integrationId, config, widgetId }: ContainerLogsProps) {
  const containerId = config.containerId as string;
  const tailLines = (config.tailLines as number) || 100;
  const showTimestamps = config.showTimestamps !== false;
  const stream = config.stream as string;
  const filterPattern = config.filterPattern as string;
  const hideLabels = (config.hideLabels as boolean) || false;

  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, loading, error } = useWidgetData<LogsData>({
    integrationId,
    metric: 'containers',
    refreshInterval: (config.refreshInterval as number) || 5000,
    widgetId,
    enabled: !!containerId,
  });

  const filteredLogs = useMemo(() => {
    if (!data?.logs) return [];

    let logs = data.logs;

    // Filter by stream
    if (stream === 'stdout') {
      logs = logs.filter(log => log.stream === 'stdout');
    } else if (stream === 'stderr') {
      logs = logs.filter(log => log.stream === 'stderr');
    }

    // Filter by pattern
    if (filterPattern) {
      const pattern = filterPattern.toLowerCase();
      logs = logs.filter(log => log.message.toLowerCase().includes(pattern));
    }

    return logs;
  }, [data?.logs, stream, filterPattern]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const getStreamColor = (streamType: 'stdout' | 'stderr'): string => {
    return streamType === 'stderr' ? 'text-red-400' : 'text-gray-300';
  };

  if (!containerId) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Configure a container ID to view logs</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading && !data} error={error}>
      {data && (
        <div className="flex flex-col h-full">
          {/* Header */}
          {!hideLabels && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {data.containerName || containerId}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  filteredLogs.length > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {filteredLogs.length} lines
                </span>
              </div>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  autoScroll
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
              </button>
            </div>
          )}

          {/* Logs */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto bg-gray-900 rounded-lg p-3 font-mono text-xs"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                {loading ? 'Loading logs...' : 'No logs available'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredLogs.map((log, index) => (
                  <div key={index} className={`flex ${getStreamColor(log.stream)}`}>
                    {showTimestamps && (
                      <span className="text-gray-500 mr-2 flex-shrink-0">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    )}
                    {stream === '' && (
                      <span className={`mr-2 flex-shrink-0 ${log.stream === 'stderr' ? 'text-red-500' : 'text-blue-500'}`}>
                        [{log.stream}]
                      </span>
                    )}
                    <span className="break-all whitespace-pre-wrap">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

          {/* Filter info */}
          {filterPattern && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Filtering by: &quot;{filterPattern}&quot;
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
