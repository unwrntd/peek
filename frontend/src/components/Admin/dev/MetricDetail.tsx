import React, { useState, useCallback } from 'react';
import { MetricInfo } from '../../../types';
import { dataApi } from '../../../api/client';
import { ResponseViewer } from './ResponseViewer';

interface MetricDetailProps {
  metric: MetricInfo;
  integrationId?: string;
  integrationName?: string;
  isDeployed: boolean;
}

export function MetricDetail({
  metric,
  integrationId,
  integrationName,
  isDeployed,
}: MetricDetailProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTime, setFetchTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const endpoint = integrationId
    ? `/api/data/${integrationId}/${metric.id}`
    : `/api/data/{integrationId}/${metric.id}`;

  const fetchData = useCallback(async () => {
    if (!integrationId) return;

    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      const result = await dataApi.getData(integrationId, metric.id);
      setData(result);
      setFetchTime(Math.round(performance.now() - startTime));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [integrationId, metric.id]);

  const handleTryIt = () => {
    if (!expanded) {
      setExpanded(true);
    }
    fetchData();
  };

  const handleCopyEndpoint = async () => {
    const fullEndpoint = window.location.origin + endpoint;
    try {
      await navigator.clipboard.writeText(fullEndpoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <div
        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
          expanded ? 'bg-gray-800' : 'bg-gray-800/50 hover:bg-gray-800'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-primary-400">{metric.id}</code>
              <span className="text-sm text-gray-300">{metric.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {metric.widgetTypes.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
              {metric.widgetTypes.length} widget{metric.widgetTypes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 border-t border-gray-700 space-y-4">
          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </label>
            <p className="mt-1 text-sm text-gray-300">{metric.description}</p>
          </div>

          {/* Endpoint */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Endpoint
            </label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-900 rounded text-sm font-mono text-gray-300">
                <span className="text-green-400">GET</span> {endpoint}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyEndpoint();
                }}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Compatible Widgets */}
          {metric.widgetTypes.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Compatible Widgets
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                {metric.widgetTypes.map((widgetType) => (
                  <span
                    key={widgetType}
                    className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded font-mono"
                  >
                    {widgetType}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            {isDeployed && integrationId ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTryIt();
                }}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 text-white text-sm font-medium rounded transition-colors"
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Try It
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Deploy an integration to test this endpoint</span>
              </div>
            )}

            {fetchTime !== null && (
              <span className="text-xs text-gray-500">
                Response time: {fetchTime}ms
              </span>
            )}
          </div>

          {/* Response viewer */}
          {(data || loading || error) && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Response {integrationName && <span className="text-gray-600">from {integrationName}</span>}
              </label>
              <ResponseViewer
                data={data}
                loading={loading}
                error={error}
                onRefresh={fetchData}
                maxHeight="350px"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
