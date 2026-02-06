import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { logsApi } from '../../api/client';
import { LogEntry } from '../../types';

const levelColors: Record<string, string> = {
  debug: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
  info: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  warn: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
  error: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
};

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ level?: string; source?: string }>({});
  const [limit] = useState(100);
  const [copied, setCopied] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await logsApi.getLogs({ ...filter, limit });
      setLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filter, limit]);

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      await logsApi.clearLogs();
      fetchLogs();
    }
  };

  const handleCopyAll = async () => {
    const logText = logs.map(log => {
      let text = `[${log.created_at}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;
      if (log.details) {
        text += `\n  Details: ${JSON.stringify(log.details, null, 2).replace(/\n/g, '\n  ')}`;
      }
      return text;
    }).join('\n\n');

    const fullText = `=== Dashboard Logs (${logs.length} entries) ===\nExported: ${new Date().toISOString()}\n\n${logText}`;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const uniqueSources = [...new Set(logs.map(l => l.source))];

  return (
    <Card
      title="Logs"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            disabled={logs.length === 0}
            className={`px-3 py-1.5 text-sm border rounded-md ${
              copied
                ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                : 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {copied ? 'Copied!' : 'Copy All'}
          </button>
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Refresh
          </button>
          <button
            onClick={handleClearLogs}
            className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Clear Logs
          </button>
        </div>
      }
    >
      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Level</label>
          <select
            value={filter.level || ''}
            onChange={(e) => setFilter(f => ({ ...f, level: e.target.value || undefined }))}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">All</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Source</label>
          <select
            value={filter.source || ''}
            onChange={(e) => setFilter(f => ({ ...f, source: e.target.value || undefined }))}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">All</option>
            {uniqueSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <LoadingSpinner className="py-8" />
      ) : logs.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No logs found</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map(log => (
            <div
              key={log.id}
              className="border border-gray-200 dark:border-gray-700 rounded p-3 text-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors[log.level]}`}>
                  {log.level.toUpperCase()}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{log.source}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto">{formatDate(log.created_at)}</span>
              </div>
              <p className="text-gray-800 dark:text-gray-200">{log.message}</p>
              {log.details && (
                <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200 p-2 rounded overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
