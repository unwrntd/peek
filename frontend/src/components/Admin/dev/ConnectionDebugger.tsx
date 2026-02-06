import React, { useState, useEffect } from 'react';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { devApi } from '../../../api/client';

interface TimingBreakdown {
  dnsLookup: number;
  tcpConnect: number;
  tlsHandshake: number;
  firstByte: number;
  total: number;
}

interface SSLInfo {
  issuer: string;
  validFrom: string;
  validUntil: string;
  daysRemaining: number;
  protocol: string;
}

interface DetailedConnectionResult {
  success: boolean;
  message: string;
  timing: TimingBreakdown;
  ssl?: SSLInfo;
  headers?: Record<string, string>;
}

function TimingBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-24">{label}</span>
      <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-300 w-16 text-right">{value}ms</span>
    </div>
  );
}

export function ConnectionDebugger() {
  const { integrations, fetchIntegrations } = useIntegrationStore();
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [result, setResult] = useState<DetailedConnectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleTest = async () => {
    if (!selectedIntegrationId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await devApi.testConnectionDetailed(selectedIntegrationId);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId);
  const enabledIntegrations = integrations.filter(i => i.enabled);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Integration</label>
            <select
              value={selectedIntegrationId}
              onChange={(e) => {
                setSelectedIntegrationId(e.target.value);
                setResult(null);
                setError(null);
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
            >
              <option value="">Select integration...</option>
              {enabledIntegrations.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleTest}
            disabled={!selectedIntegrationId || loading}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Testing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Diagnostics
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Connection Test Failed</span>
          </div>
          <p className="mt-2 text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Status */}
          <div className={`rounded-lg border p-4 ${result.success ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={`font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Connection Successful' : 'Connection Failed'}
              </span>
            </div>
            <p className={`mt-1 text-sm ${result.success ? 'text-green-300' : 'text-red-300'}`}>
              {result.message}
            </p>
          </div>

          {/* Timing Waterfall */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Timing Breakdown</h3>
            <div className="space-y-2">
              <TimingBar label="DNS Lookup" value={result.timing.dnsLookup} max={result.timing.total} color="bg-blue-500" />
              <TimingBar label="TCP Connect" value={result.timing.tcpConnect} max={result.timing.total} color="bg-green-500" />
              <TimingBar label="TLS Handshake" value={result.timing.tlsHandshake} max={result.timing.total} color="bg-yellow-500" />
              <TimingBar label="First Byte" value={result.timing.firstByte} max={result.timing.total} color="bg-purple-500" />
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <TimingBar label="Total" value={result.timing.total} max={result.timing.total} color="bg-primary-500" />
              </div>
            </div>
          </div>

          {/* SSL Certificate */}
          {result.ssl && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">SSL Certificate</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Issuer</span>
                  <p className="text-gray-900 dark:text-white mt-0.5">{result.ssl.issuer}</p>
                </div>
                <div>
                  <span className="text-gray-500">Protocol</span>
                  <p className="text-gray-900 dark:text-white mt-0.5">{result.ssl.protocol}</p>
                </div>
                <div>
                  <span className="text-gray-500">Valid From</span>
                  <p className="text-gray-900 dark:text-white mt-0.5">{result.ssl.validFrom}</p>
                </div>
                <div>
                  <span className="text-gray-500">Valid Until</span>
                  <p className="text-gray-900 dark:text-white mt-0.5">{result.ssl.validUntil}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Days Remaining</span>
                  <p className={`mt-0.5 ${result.ssl.daysRemaining < 30 ? 'text-yellow-400' : result.ssl.daysRemaining < 7 ? 'text-red-400' : 'text-green-400'}`}>
                    {result.ssl.daysRemaining} days
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Response Headers */}
          {result.headers && Object.keys(result.headers).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Response Headers</h3>
              <div className="space-y-1 font-mono text-xs">
                {Object.entries(result.headers).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="text-primary-400 w-48 flex-shrink-0">{key}:</span>
                    <span className="text-gray-600 dark:text-gray-300 break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Connection Debugger</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select an integration and run diagnostics to see detailed connection timing and SSL information.
          </p>
        </div>
      )}
    </div>
  );
}
