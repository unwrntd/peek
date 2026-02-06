import React, { useState, useMemo, useCallback } from 'react';
import { integrationConfigs } from '../../../config/integrations';

// Sample mock data for demonstration
const SAMPLE_MOCK_DATA: Record<string, unknown> = {
  status: {
    success: true,
    uptime: 123456,
    version: '1.0.0',
  },
  devices: [
    { id: '1', name: 'Device 1', status: 'online' },
    { id: '2', name: 'Device 2', status: 'offline' },
  ],
  metrics: {
    cpu: 45,
    memory: 60,
    disk: 75,
  },
};

interface WidgetOption {
  type: string;
  name: string;
  integrationName: string;
  metric: string;
}

export function WidgetPlayground() {
  const [selectedWidget, setSelectedWidget] = useState<string>('');
  const [mockDataJson, setMockDataJson] = useState<string>(JSON.stringify(SAMPLE_MOCK_DATA, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Build widget options from all integration configs
  const widgetOptions = useMemo((): WidgetOption[] => {
    const options: WidgetOption[] = [];
    integrationConfigs.forEach((config) => {
      config.widgets.forEach((widget) => {
        options.push({
          type: widget.type,
          name: widget.name,
          integrationName: config.displayName,
          metric: widget.metric,
        });
      });
    });
    return options.sort((a, b) => a.integrationName.localeCompare(b.integrationName));
  }, []);

  // Group widgets by integration
  const groupedWidgets = useMemo(() => {
    const groups: Record<string, WidgetOption[]> = {};
    widgetOptions.forEach((widget) => {
      if (!groups[widget.integrationName]) {
        groups[widget.integrationName] = [];
      }
      groups[widget.integrationName].push(widget);
    });
    return groups;
  }, [widgetOptions]);

  const handleJsonChange = useCallback((value: string) => {
    setMockDataJson(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, []);

  const parsedMockData = useMemo(() => {
    try {
      return JSON.parse(mockDataJson);
    } catch {
      return null;
    }
  }, [mockDataJson]);

  const selectedWidgetInfo = widgetOptions.find(w => w.type === selectedWidget);

  return (
    <div className="space-y-4">
      {/* Widget Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Widget Type</label>
            <select
              value={selectedWidget}
              onChange={(e) => setSelectedWidget(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
            >
              <option value="">Select a widget...</option>
              {Object.entries(groupedWidgets).map(([integrationName, widgets]) => (
                <optgroup key={integrationName} label={integrationName}>
                  {widgets.map((widget) => (
                    <option key={widget.type} value={widget.type}>
                      {widget.name} ({widget.metric})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* JSON Editor */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Mock Data (JSON)</h3>
            {jsonError && (
              <span className="text-xs text-red-400">{jsonError}</span>
            )}
          </div>
          <div className="flex-1 min-h-[400px]">
            <textarea
              value={mockDataJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full h-full p-4 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 font-mono resize-none focus:outline-none"
              placeholder="Enter JSON mock data..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* Preview Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Widget Preview</h3>
            {selectedWidgetInfo && (
              <span className="text-xs text-gray-500">
                {selectedWidgetInfo.integrationName} / {selectedWidgetInfo.name}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-[400px] p-4 flex items-center justify-center">
            {!selectedWidget ? (
              <div className="text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <p className="text-sm">Select a widget to preview</p>
              </div>
            ) : jsonError ? (
              <div className="text-center text-red-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">Fix JSON errors to see preview</p>
              </div>
            ) : (
              <div className="w-full h-full bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {selectedWidgetInfo?.name}
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Widget preview with mock data injection is coming soon.
                  </p>
                  <div className="text-xs text-gray-600">
                    <p>Selected: {selectedWidget}</p>
                    <p>Metric: {selectedWidgetInfo?.metric}</p>
                    <p>Data keys: {parsedMockData ? Object.keys(parsedMockData).join(', ') : 'none'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help text */}
      <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">How to use</h4>
        <ol className="text-sm text-gray-500 space-y-1 list-decimal list-inside">
          <li>Select a widget type from the dropdown</li>
          <li>Edit the JSON mock data in the editor to match the widget&apos;s expected data structure</li>
          <li>The widget preview will update automatically with your mock data</li>
          <li>Use this to test edge cases, empty states, and error handling</li>
        </ol>
      </div>
    </div>
  );
}
