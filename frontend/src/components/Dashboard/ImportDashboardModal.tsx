import React, { useState, useRef } from 'react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useIntegrations } from '../../hooks/useIntegrations';
import { DashboardExport, IntegrationMapping } from '../../types';

interface ImportDashboardModalProps {
  onClose: () => void;
}

export function ImportDashboardModal({ onClose }: ImportDashboardModalProps) {
  const { importDashboard, setCurrentDashboard } = useDashboardStore();
  const { integrations } = useIntegrations();

  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [importData, setImportData] = useState<DashboardExport | null>(null);
  const [mappings, setMappings] = useState<IntegrationMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unique integration types from the import data (excluding static)
  const getRequiredIntegrationTypes = (): string[] => {
    if (!importData) return [];
    const types = new Set<string>();
    importData.widgets.forEach(w => {
      // Skip static widgets - they don't need integration mapping
      if (w.integration_type !== 'static') {
        types.add(w.integration_type);
      }
    });
    return Array.from(types);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as DashboardExport;

      // Validate structure
      if (!data.version || !data.dashboard || !Array.isArray(data.widgets)) {
        throw new Error('Invalid dashboard export format');
      }

      setImportData(data);
      setError(null);

      // Initialize mappings (skip static widgets)
      const types = new Set<string>();
      data.widgets.forEach(w => {
        if (w.integration_type !== 'static') {
          types.add(w.integration_type);
        }
      });

      const initialMappings: IntegrationMapping = {};
      types.forEach(type => {
        // Try to find a matching integration
        const matchingIntegration = integrations.find(i => i.type === type && i.enabled);
        if (matchingIntegration) {
          initialMappings[type] = matchingIntegration.id;
        }
      });
      setMappings(initialMappings);

      // Skip mapping step if all widgets are static or all integrations auto-mapped
      const requiredTypes = Array.from(types);
      if (requiredTypes.length === 0 || requiredTypes.every(t => initialMappings[t])) {
        setStep('preview');
      } else {
        setStep('mapping');
      }
    } catch (err) {
      setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handlePasteJson = () => {
    const jsonText = prompt('Paste the dashboard JSON:');
    if (!jsonText) return;

    try {
      const data = JSON.parse(jsonText) as DashboardExport;

      if (!data.version || !data.dashboard || !Array.isArray(data.widgets)) {
        throw new Error('Invalid dashboard export format');
      }

      setImportData(data);
      setError(null);

      // Initialize mappings (skip static widgets)
      const types = new Set<string>();
      data.widgets.forEach(w => {
        if (w.integration_type !== 'static') {
          types.add(w.integration_type);
        }
      });

      const initialMappings: IntegrationMapping = {};
      types.forEach(type => {
        const matchingIntegration = integrations.find(i => i.type === type && i.enabled);
        if (matchingIntegration) {
          initialMappings[type] = matchingIntegration.id;
        }
      });
      setMappings(initialMappings);

      // Skip mapping step if all widgets are static or all integrations auto-mapped
      const requiredTypes = Array.from(types);
      if (requiredTypes.length === 0 || requiredTypes.every(t => initialMappings[t])) {
        setStep('preview');
      } else {
        setStep('mapping');
      }
    } catch (err) {
      setError(`Failed to parse JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleMappingChange = (integrationType: string, integrationId: string) => {
    setMappings(prev => ({
      ...prev,
      [integrationType]: integrationId,
    }));
  };

  const canProceedToPreview = () => {
    const requiredTypes = getRequiredIntegrationTypes();
    return requiredTypes.every(type => mappings[type]);
  };

  const handleImport = async () => {
    if (!importData) return;

    setImporting(true);
    setError(null);

    try {
      const dashboard = await importDashboard(importData, mappings);

      // Import port connections and port mappings to localStorage if present
      const extendedImportData = importData as DashboardExport & {
        portConnections?: Array<{ localWidgetId: string; localPort: number }>;
        portMappings?: Array<{ widgetId: string; port: number }>;
        networkDevices?: Array<{ hostname: string }>;
      };

      if (Array.isArray(extendedImportData.portConnections) && extendedImportData.portConnections.length > 0) {
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
        const newConnections = extendedImportData.portConnections.filter(c =>
          !existingConnections.some((e: { localWidgetId: string; localPort: number }) =>
            e.localWidgetId === c.localWidgetId && e.localPort === c.localPort
          )
        );

        // Merge port mappings
        const existingMappings = existing.state?.portMappings || [];
        const newMappings = (extendedImportData.portMappings || []).filter(m =>
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

      // Import network devices to localStorage if present
      if (Array.isArray(extendedImportData.networkDevices) && extendedImportData.networkDevices.length > 0) {
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
        const newDevices = extendedImportData.networkDevices.filter(d =>
          !existingHostnames.has(d.hostname.toLowerCase())
        );

        localStorage.setItem('peek-network-devices', JSON.stringify({
          state: {
            devices: [...existingDevices, ...newDevices],
          },
          version: existing.version || 0,
        }));
      }

      await setCurrentDashboard(dashboard.id);
      onClose();
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setImporting(false);
    }
  };

  const enabledIntegrations = integrations.filter(i => i.enabled);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded text-sm mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Import a dashboard from a previously exported JSON file.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
              >
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400">Click to select a file or drag and drop</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">JSON files only</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                <span className="text-sm text-gray-500">or</span>
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
              </div>

              <button
                onClick={handlePasteJson}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Paste JSON
              </button>
            </div>
          )}

          {/* Step 2: Integration Mapping */}
          {step === 'mapping' && importData && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Map the integration types from the exported dashboard to your local integrations.
              </p>

              {getRequiredIntegrationTypes().map(integrationType => {
                const compatibleIntegrations = enabledIntegrations.filter(i => i.type === integrationType);

                return (
                  <div key={integrationType}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {integrationType.charAt(0).toUpperCase() + integrationType.slice(1)} Integration
                    </label>
                    <select
                      value={mappings[integrationType] || ''}
                      onChange={(e) => handleMappingChange(integrationType, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select integration...</option>
                      {compatibleIntegrations.map(integration => (
                        <option key={integration.id} value={integration.id}>
                          {integration.name}
                        </option>
                      ))}
                    </select>
                    {compatibleIntegrations.length === 0 && (
                      <p className="text-sm text-red-500 mt-1">
                        No compatible {integrationType} integrations found. Please add one first.
                      </p>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => setStep('preview')}
                disabled={!canProceedToPreview()}
                className="w-full px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Preview
              </button>

              <button
                onClick={() => {
                  setStep('upload');
                  setImportData(null);
                  setMappings({});
                }}
                className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                Back
              </button>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && importData && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  {importData.dashboard.name}
                </h3>
                {importData.dashboard.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {importData.dashboard.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Widgets:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {importData.widgets.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Groups:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {importData.groups.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Exported:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {new Date(importData.exported_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Version:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {importData.version}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Widget Types
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(importData.widgets.map(w => w.widget_type))).map(type => (
                    <span
                      key={type}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import Dashboard'}
              </button>

              <button
                onClick={() => setStep('mapping')}
                disabled={importing}
                className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
