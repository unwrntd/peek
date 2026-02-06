import React, { useState, useMemo } from 'react';

interface ResponseViewerProps {
  data: unknown;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  maxHeight?: string;
}

type ViewMode = 'pretty' | 'compact' | 'raw';

function JsonNode({
  data,
  depth = 0,
  expanded: initialExpanded = true,
  keyName,
}: {
  data: unknown;
  depth?: number;
  expanded?: boolean;
  keyName?: string;
}) {
  const [expanded, setExpanded] = useState(initialExpanded && depth < 2);
  const indent = depth * 16;

  if (data === null) {
    return (
      <span className="text-gray-500">
        {keyName && <span className="text-purple-400">"{keyName}"</span>}
        {keyName && ': '}
        <span className="text-gray-500">null</span>
      </span>
    );
  }

  if (typeof data === 'undefined') {
    return (
      <span className="text-gray-500">
        {keyName && <span className="text-purple-400">"{keyName}"</span>}
        {keyName && ': '}
        <span className="text-gray-500">undefined</span>
      </span>
    );
  }

  if (typeof data === 'boolean') {
    return (
      <span>
        {keyName && <span className="text-purple-400">"{keyName}"</span>}
        {keyName && ': '}
        <span className="text-orange-400">{data ? 'true' : 'false'}</span>
      </span>
    );
  }

  if (typeof data === 'number') {
    return (
      <span>
        {keyName && <span className="text-purple-400">"{keyName}"</span>}
        {keyName && ': '}
        <span className="text-blue-400">{data}</span>
      </span>
    );
  }

  if (typeof data === 'string') {
    // Check if it's a URL
    const isUrl = data.startsWith('http://') || data.startsWith('https://');
    return (
      <span>
        {keyName && <span className="text-purple-400">"{keyName}"</span>}
        {keyName && ': '}
        {isUrl ? (
          <a
            href={data}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 hover:underline"
          >
            "{data}"
          </a>
        ) : (
          <span className="text-green-400">"{data}"</span>
        )}
      </span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <span>
          {keyName && <span className="text-purple-400">"{keyName}"</span>}
          {keyName && ': '}
          <span className="text-gray-400">[]</span>
        </span>
      );
    }

    return (
      <div style={{ marginLeft: keyName ? 0 : indent }}>
        <span
          className="cursor-pointer hover:text-primary-400"
          onClick={() => setExpanded(!expanded)}
        >
          {keyName && <span className="text-purple-400">"{keyName}"</span>}
          {keyName && ': '}
          <span className="text-gray-400">
            {expanded ? '[' : `[...] (${data.length} items)`}
          </span>
        </span>
        {expanded && (
          <>
            <div className="ml-4">
              {data.map((item, index) => (
                <div key={index} className="py-0.5">
                  <JsonNode data={item} depth={depth + 1} />
                  {index < data.length - 1 && <span className="text-gray-500">,</span>}
                </div>
              ))}
            </div>
            <span className="text-gray-400">]</span>
          </>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <span>
          {keyName && <span className="text-purple-400">"{keyName}"</span>}
          {keyName && ': '}
          <span className="text-gray-400">{'{}'}</span>
        </span>
      );
    }

    return (
      <div style={{ marginLeft: keyName ? 0 : indent }}>
        <span
          className="cursor-pointer hover:text-primary-400"
          onClick={() => setExpanded(!expanded)}
        >
          {keyName && <span className="text-purple-400">"{keyName}"</span>}
          {keyName && ': '}
          <span className="text-gray-400">
            {expanded ? '{' : `{...} (${entries.length} keys)`}
          </span>
        </span>
        {expanded && (
          <>
            <div className="ml-4">
              {entries.map(([key, value], index) => (
                <div key={key} className="py-0.5">
                  <JsonNode data={value} depth={depth + 1} keyName={key} />
                  {index < entries.length - 1 && <span className="text-gray-500">,</span>}
                </div>
              ))}
            </div>
            <span className="text-gray-400">{'}'}</span>
          </>
        )}
      </div>
    );
  }

  return <span className="text-gray-400">{String(data)}</span>;
}

export function ResponseViewer({
  data,
  loading,
  error,
  onRefresh,
  maxHeight = '400px',
}: ResponseViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('pretty');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const formattedJson = useMemo(() => {
    if (!data) return '';
    try {
      return viewMode === 'compact'
        ? JSON.stringify(data)
        : JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data, viewMode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const dataSize = useMemo(() => {
    const bytes = new Blob([formattedJson]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [formattedJson]);

  if (loading) {
    return (
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center" style={{ minHeight: '100px' }}>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Error</span>
        </div>
        <p className="mt-2 text-sm text-red-300">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (data === undefined || data === null) {
    return (
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 text-center text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {/* View mode buttons */}
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
            {(['pretty', 'compact', 'raw'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-32 px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{dataSize}</span>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className="p-3 overflow-auto font-mono text-sm"
        style={{ maxHeight }}
      >
        {viewMode === 'pretty' ? (
          <JsonNode data={data} />
        ) : (
          <pre className={`text-gray-700 dark:text-gray-300 whitespace-${viewMode === 'compact' ? 'nowrap' : 'pre-wrap'}`}>
            {formattedJson}
          </pre>
        )}
      </div>
    </div>
  );
}
