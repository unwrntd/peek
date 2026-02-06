import React, { useState, useEffect, useMemo } from 'react';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { dataApi } from '../../../api/client';
import { getIntegrationConfig } from '../../../config/integrations';
import { ResponseViewer } from './ResponseViewer';

export function DataInspector() {
  const { integrations, fetchIntegrations } = useIntegrationStore();
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [availableMetrics, setAvailableMetrics] = useState<{ id: string; name: string }[]>([]);
  const [currentData, setCurrentData] = useState<unknown>(null);
  const [previousData, setPreviousData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<number | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Load metrics when integration changes
  useEffect(() => {
    if (!selectedIntegrationId) {
      setAvailableMetrics([]);
      setSelectedMetric('');
      return;
    }

    const integration = integrations.find(i => i.id === selectedIntegrationId);
    if (!integration) return;

    const config = getIntegrationConfig(integration.type);
    if (config?.widgets) {
      const metrics = config.widgets.map(w => ({
        id: w.metric,
        name: w.name,
      }));
      setAvailableMetrics(metrics);
      setSelectedMetric('');
    }
  }, [selectedIntegrationId, integrations]);

  const handleFetch = async () => {
    if (!selectedIntegrationId || !selectedMetric) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      setPreviousData(currentData);
      const data = await dataApi.getData(selectedIntegrationId, selectedMetric);
      setCurrentData(data);
      setTiming(Date.now() - startTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setCurrentData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (currentData) {
      await navigator.clipboard.writeText(JSON.stringify(currentData, null, 2));
    }
  };

  const selectedIntegration = useMemo(
    () => integrations.find(i => i.id === selectedIntegrationId),
    [integrations, selectedIntegrationId]
  );

  const dataSize = currentData ? JSON.stringify(currentData).length : 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Integration</label>
            <select
              value={selectedIntegrationId}
              onChange={(e) => setSelectedIntegrationId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
            >
              <option value="">Select integration...</option>
              {integrations.filter(i => i.enabled).map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Metric</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              disabled={!selectedIntegrationId}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 disabled:opacity-50"
            >
              <option value="">Select metric...</option>
              {availableMetrics.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.name} ({metric.id})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleFetch}
            disabled={!selectedIntegrationId || !selectedMetric || loading}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Fetching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Fetch Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Error</span>
          </div>
          <p className="mt-2 text-sm text-red-300">{error}</p>
        </div>
      )}

      {currentData !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Response header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4 text-sm">
              {timing !== null && (
                <span className="text-gray-500 dark:text-gray-400">
                  <span className="text-gray-500">Time:</span> {timing}ms
                </span>
              )}
              <span className="text-gray-500 dark:text-gray-400">
                <span className="text-gray-500">Size:</span> {(dataSize / 1024).toFixed(2)} KB
              </span>
            </div>
            <div className="flex items-center gap-2">
              {previousData !== null && (
                <button
                  onClick={() => setShowCompare(!showCompare)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    showCompare
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Compare
                </button>
              )}
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
          </div>

          {/* Response body */}
          <div className={`${showCompare ? 'grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700' : ''}`}>
            {showCompare && previousData !== null && (
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Previous</p>
                <ResponseViewer data={previousData} />
              </div>
            )}
            <div className="p-4">
              {showCompare && <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Current</p>}
              <ResponseViewer data={currentData} />
            </div>
          </div>
        </div>
      )}

      {!currentData && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Inspect Widget Data</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select an integration and metric to view raw JSON data.
          </p>
        </div>
      )}
    </div>
  );
}
