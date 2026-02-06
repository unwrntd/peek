import React, { useState, useRef } from 'react';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface ImportResult {
  success: boolean;
  message: string;
  results: {
    integrations: { imported: number; skipped: number; errors: string[] };
    dashboards: { imported: number; skipped: number; errors: string[] };
    widgets: { imported: number; errors: string[] };
    groups: { imported: number; errors: string[] };
    branding: { imported: boolean };
    portConnections?: { imported: number };
    networkDevices?: { imported: number };
  };
}

interface ImportConfigModalProps {
  onClose: () => void;
}

export function ImportConfigModal({ onClose }: ImportConfigModalProps) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const text = await selectedFile.text();
      const config = JSON.parse(text);

      const { settingsApi } = await import('../../../api/client');
      const importResult = await settingsApi.importConfig(config);

      // Import port connections and port mappings to localStorage
      let portConnectionsImported = 0;
      if (Array.isArray(config.portConnections) && config.portConnections.length > 0) {
        const existingRaw = localStorage.getItem('peek-port-connections');
        let existing = { state: { connections: [], portMappings: [] }, version: 0 };
        if (existingRaw) {
          try {
            existing = JSON.parse(existingRaw);
          } catch {
            // Use default
          }
        }

        // Merge connections (avoid duplicates)
        const existingConnections = existing.state?.connections || [];
        const newConnections = config.portConnections.filter((c: { localWidgetId: string; localPort: number }) =>
          !existingConnections.some((e: { localWidgetId: string; localPort: number }) =>
            e.localWidgetId === c.localWidgetId && e.localPort === c.localPort
          )
        );
        portConnectionsImported = newConnections.length;

        // Merge port mappings
        const existingMappings = existing.state?.portMappings || [];
        const newMappings = (config.portMappings || []).filter((m: { widgetId: string; port: number }) =>
          !existingMappings.some((e: { widgetId: string; port: number }) =>
            e.widgetId === m.widgetId && e.port === m.port
          )
        );

        localStorage.setItem('peek-port-connections', JSON.stringify({
          state: {
            connections: [...existingConnections, ...newConnections],
            portMappings: [...existingMappings, ...newMappings],
          },
          version: existing.version || 0,
        }));
      }

      // Import network devices to localStorage
      let networkDevicesImported = 0;
      if (Array.isArray(config.networkDevices) && config.networkDevices.length > 0) {
        const existingRaw = localStorage.getItem('peek-network-devices');
        let existing = { state: { devices: [] }, version: 0 };
        if (existingRaw) {
          try {
            existing = JSON.parse(existingRaw);
          } catch {
            // Use default
          }
        }

        // Merge devices (avoid duplicates by hostname)
        const existingDevices = existing.state?.devices || [];
        const existingHostnames = new Set(existingDevices.map((d: { hostname: string }) => d.hostname.toLowerCase()));
        const newDevices = config.networkDevices.filter((d: { hostname: string }) =>
          !existingHostnames.has(d.hostname.toLowerCase())
        );
        networkDevicesImported = newDevices.length;

        localStorage.setItem('peek-network-devices', JSON.stringify({
          state: {
            devices: [...existingDevices, ...newDevices],
          },
          version: existing.version || 0,
        }));
      }

      // Add localStorage import results
      (importResult.results as ImportResult['results'] & {
        portConnections?: { imported: number };
        networkDevices?: { imported: number };
      }).portConnections = { imported: portConnectionsImported };
      (importResult.results as ImportResult['results'] & {
        portConnections?: { imported: number };
        networkDevices?: { imported: number };
      }).networkDevices = { imported: networkDevicesImported };

      setResult(importResult);

      if (importResult.success) {
        // Reload after a short delay to show results
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file. Please select a valid configuration export.');
      } else {
        setError('Failed to import configuration. Please try again.');
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import Configuration</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Restore from a previous export</p>
            </div>
          </div>

          {!result && (
            <>
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">Important notes:</p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1">
                  <li>Existing items with the same name will be skipped</li>
                  <li>Credentials (passwords/API keys) are redacted in exports</li>
                  <li>You may need to re-enter credentials after import</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select configuration file
                </label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-center"
                  >
                    {selectedFile ? (
                      <span className="text-gray-900 dark:text-white">{selectedFile.name}</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Click to select a .json file</span>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className={`mb-4 p-4 rounded-md ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <p className={`font-medium mb-3 ${result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {result.message}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Integrations:</span>
                  <span className="text-gray-900 dark:text-white">
                    {result.results.integrations.imported} imported, {result.results.integrations.skipped} skipped
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Dashboards:</span>
                  <span className="text-gray-900 dark:text-white">
                    {result.results.dashboards.imported} imported, {result.results.dashboards.skipped} skipped
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Widgets:</span>
                  <span className="text-gray-900 dark:text-white">{result.results.widgets.imported} imported</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Groups:</span>
                  <span className="text-gray-900 dark:text-white">{result.results.groups.imported} imported</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Branding:</span>
                  <span className="text-gray-900 dark:text-white">{result.results.branding.imported ? 'Updated' : 'Skipped'}</span>
                </div>
                {result.results.portConnections && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Port Connections:</span>
                    <span className="text-gray-900 dark:text-white">{result.results.portConnections.imported} imported</span>
                  </div>
                )}
                {result.results.networkDevices && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Network Devices:</span>
                    <span className="text-gray-900 dark:text-white">{result.results.networkDevices.imported} imported</span>
                  </div>
                )}
              </div>
              {result.success && (
                <p className="mt-3 text-sm text-green-700 dark:text-green-300">
                  Page will reload in 3 seconds...
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {result?.success ? 'Close' : 'Cancel'}
          </button>
          {!result?.success && (
            <button
              onClick={handleImport}
              disabled={!selectedFile || importing}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <LoadingSpinner size="sm" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
