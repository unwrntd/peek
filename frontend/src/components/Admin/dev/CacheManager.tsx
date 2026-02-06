import React, { useState, useEffect } from 'react';
import { devApi } from '../../../api/client';
import { formatBytes } from '../../../utils/formatting';

interface CacheEntry {
  key: string;
  integrationId: string;
  metric: string;
  timestamp: number;
  ttlRemaining: number;
  sizeBytes: number;
}

interface CacheStats {
  entryCount: number;
  estimatedSizeBytes: number;
  entries: CacheEntry[];
}

function formatTTL(ms: number): string {
  if (ms <= 0) return 'Expired';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function CacheManager() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await devApi.getCacheStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cache stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearEntry = async (key: string) => {
    setClearing(key);
    try {
      await devApi.clearCacheEntry(key);
      await fetchStats();
    } catch (err) {
      console.error('Failed to clear cache entry:', err);
    } finally {
      setClearing(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all cached data? This will cause all widgets to refetch data.')) return;

    setClearing('all');
    try {
      await devApi.clearAllCache();
      await fetchStats();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    } finally {
      setClearing(null);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading cache stats...</span>
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
          <span className="font-medium">Error loading cache stats</span>
        </div>
        <p className="mt-2 text-sm text-red-300">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-3 px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500">Cached Entries</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{stats?.entryCount || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500">Total Size</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{formatBytes(stats?.estimatedSizeBytes || 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500">Cache TTL</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">60s</p>
        </div>
      </div>

      {/* Cache entries table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Cache Entries</h3>
          <button
            onClick={handleClearAll}
            disabled={clearing === 'all' || !stats?.entries.length}
            className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
          >
            {clearing === 'all' ? 'Clearing...' : 'Clear All'}
          </button>
        </div>

        {stats?.entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <p className="text-sm">No cached data</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Integration</th>
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">TTL</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats?.entries.map((entry) => (
                <tr key={entry.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{entry.integrationId}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{entry.metric}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatBytes(entry.sizeBytes)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={entry.ttlRemaining <= 0 ? 'text-red-400' : entry.ttlRemaining < 10000 ? 'text-yellow-400' : 'text-gray-500 dark:text-gray-400'}>
                      {formatTTL(entry.ttlRemaining)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleClearEntry(entry.key)}
                      disabled={clearing === entry.key}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                      title="Clear"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
