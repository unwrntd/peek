import React, { useState, useMemo } from 'react';
import {
  useRequestHistory,
  RequestHistoryEntry,
  generateCurlSnippet,
  generateFetchSnippet,
  generateAxiosSnippet,
  generatePythonSnippet,
} from '../../../hooks/useRequestHistory';
import { ResponseViewer } from './ResponseViewer';

type SnippetFormat = 'curl' | 'fetch' | 'axios' | 'python';

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function formatTiming(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-green-500/20 text-green-400',
    POST: 'bg-blue-500/20 text-blue-400',
    PUT: 'bg-yellow-500/20 text-yellow-400',
    DELETE: 'bg-red-500/20 text-red-400',
    PATCH: 'bg-purple-500/20 text-purple-400',
  };
  return (
    <span className={`px-1.5 py-0.5 text-xs font-mono rounded ${colors[method] || 'bg-gray-500/20 text-gray-400'}`}>
      {method}
    </span>
  );
}

function StatusBadge({ success, statusCode }: { success: boolean; statusCode?: number }) {
  if (success) {
    return (
      <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
        {statusCode || 'OK'}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
      {statusCode || 'Error'}
    </span>
  );
}

interface CodeSnippetModalProps {
  entry: RequestHistoryEntry;
  onClose: () => void;
}

function CodeSnippetModal({ entry, onClose }: CodeSnippetModalProps) {
  const [format, setFormat] = useState<SnippetFormat>('curl');
  const [copied, setCopied] = useState(false);
  const baseUrl = window.location.origin;

  const snippet = useMemo(() => {
    switch (format) {
      case 'curl': return generateCurlSnippet(entry, baseUrl);
      case 'fetch': return generateFetchSnippet(entry, baseUrl);
      case 'axios': return generateAxiosSnippet(entry, baseUrl);
      case 'python': return generatePythonSnippet(entry, baseUrl);
    }
  }, [format, entry, baseUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Code Snippet</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 w-fit">
            {(['curl', 'fetch', 'axios', 'python'] as SnippetFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  format === f
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto">
            {snippet}
          </pre>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy to Clipboard
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DetailModalProps {
  entry: RequestHistoryEntry;
  onClose: () => void;
}

function DetailModal({ entry, onClose }: DetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{entry.capabilityName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <MethodBadge method={entry.method} />
              <code className="text-sm text-gray-500 dark:text-gray-400">{entry.endpoint}</code>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Integration:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{entry.integrationName}</span>
            </div>
            <div>
              <span className="text-gray-500">Time:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{formatTimestamp(entry.timestamp)}</span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <span className="ml-2"><StatusBadge success={entry.response.success} statusCode={entry.response.statusCode} /></span>
            </div>
            <div>
              <span className="text-gray-500">Timing:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{formatTiming(entry.response.timing)}</span>
            </div>
          </div>

          {entry.parameters && Object.keys(entry.parameters).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Parameters</h4>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-300 font-mono overflow-x-auto">
                {JSON.stringify(entry.parameters, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Response</h4>
            {entry.response.error ? (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400">{entry.response.error}</p>
              </div>
            ) : (
              <ResponseViewer data={entry.response.data} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RequestHistory() {
  const { entries, removeEntry, clearAll } = useRequestHistory();
  const [selectedEntry, setSelectedEntry] = useState<RequestHistoryEntry | null>(null);
  const [snippetEntry, setSnippetEntry] = useState<RequestHistoryEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.integrationName.toLowerCase().includes(query) ||
        e.capabilityName.toLowerCase().includes(query) ||
        e.endpoint.toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);

  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Request History</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Execute API calls from the API Explorer to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requests..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{entries.length} requests</span>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Request list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Integration</th>
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Timing</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatTimestamp(entry.timestamp)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {entry.integrationName}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MethodBadge method={entry.method} />
                    <code className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[200px]" title={entry.endpoint}>
                      {entry.endpoint}
                    </code>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge success={entry.response.success} statusCode={entry.response.statusCode} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatTiming(entry.response.timing)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="View Details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSnippetEntry(entry)}
                      className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Generate Code"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {selectedEntry && <DetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
      {snippetEntry && <CodeSnippetModal entry={snippetEntry} onClose={() => setSnippetEntry(null)} />}
    </div>
  );
}
