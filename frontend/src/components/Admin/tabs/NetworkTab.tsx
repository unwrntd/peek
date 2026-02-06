import React, { useState, Suspense, lazy } from 'react';
import { DevicesManager } from '../network/DevicesManager';
import { ConnectionsManager } from '../network/ConnectionsManager';

// Lazy load heavier components
const TemplateEditor = lazy(() => import('../dev/TemplateEditor').then(m => ({ default: m.TemplateEditor })));
const DeviceTemplateEditor = lazy(() => import('../dev/DeviceTemplateEditor').then(m => ({ default: m.DeviceTemplateEditor })));
const AutoDetect = lazy(() => import('../network/AutoDetect').then(m => ({ default: m.AutoDetect })));
const SwitchesManager = lazy(() => import('../network/SwitchesManager').then(m => ({ default: m.SwitchesManager })));

type NetworkSubTab = 'switches' | 'devices' | 'connections' | 'templates' | 'auto-detect';
type TemplateType = 'switch' | 'device';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-2 text-gray-400">
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Loading...</span>
      </div>
    </div>
  );
}

export function NetworkTab() {
  const [activeSubTab, setActiveSubTab] = useState<NetworkSubTab>('switches');
  const [templateType, setTemplateType] = useState<TemplateType>('switch');

  const subTabs: { id: NetworkSubTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'switches',
      label: 'Switches',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
    },
    {
      id: 'devices',
      label: 'Devices',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
    },
    {
      id: 'connections',
      label: 'Connections',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
    },
    {
      id: 'auto-detect',
      label: 'Auto-Detect',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10h-2m0 0H9m2 0v2m0-2V8" />
        </svg>
      ),
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Network Map</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage switches, network devices, connections, templates, and auto-discovery
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeSubTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sub-tab Content */}
      <div>
        <Suspense fallback={<LoadingFallback />}>
          {activeSubTab === 'switches' && <SwitchesManager />}
        </Suspense>
        {activeSubTab === 'devices' && <DevicesManager />}
        {activeSubTab === 'connections' && <ConnectionsManager />}
        <Suspense fallback={<LoadingFallback />}>
          {activeSubTab === 'auto-detect' && <AutoDetect />}
          {activeSubTab === 'templates' && (
            <div className="space-y-4">
              {/* Template Type Toggle */}
              <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
                <button
                  onClick={() => setTemplateType('switch')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    templateType === 'switch'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                    Switch Templates
                  </div>
                </button>
                <button
                  onClick={() => setTemplateType('device')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    templateType === 'device'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                    Device Templates
                  </div>
                </button>
              </div>

              {/* Template Editor */}
              {templateType === 'switch' ? <TemplateEditor /> : <DeviceTemplateEditor />}
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}
