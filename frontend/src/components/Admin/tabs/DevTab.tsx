import React, { useState, Suspense, lazy } from 'react';
import { ApiExplorer } from '../dev';

// Lazy load feature components
const RequestHistory = lazy(() => import('../dev/RequestHistory').then(m => ({ default: m.RequestHistory })));
const DataInspector = lazy(() => import('../dev/DataInspector').then(m => ({ default: m.DataInspector })));
const CacheManager = lazy(() => import('../dev/CacheManager').then(m => ({ default: m.CacheManager })));
const ConnectionDebugger = lazy(() => import('../dev/ConnectionDebugger').then(m => ({ default: m.ConnectionDebugger })));
const WidgetPlayground = lazy(() => import('../dev/WidgetPlayground').then(m => ({ default: m.WidgetPlayground })));

type DevFeature = 'api-explorer' | 'history' | 'inspector' | 'cache' | 'debugger' | 'playground';

interface FeatureTab {
  id: DevFeature;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const DEV_FEATURES: FeatureTab[] = [
  {
    id: 'api-explorer',
    label: 'API Explorer',
    description: 'Explore integration APIs and test endpoints',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'History',
    description: 'View and replay past API requests',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'inspector',
    label: 'Inspector',
    description: 'Inspect raw widget data',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'cache',
    label: 'Cache',
    description: 'View and manage data cache',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
  {
    id: 'debugger',
    label: 'Debugger',
    description: 'Detailed connection diagnostics',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'playground',
    label: 'Playground',
    description: 'Test widgets with mock data',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
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

export function DevTab() {
  const [activeFeature, setActiveFeature] = useState<DevFeature>('api-explorer');
  const activeTab = DEV_FEATURES.find(f => f.id === activeFeature)!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dev Tools</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {activeTab.description}
          </p>
        </div>
      </div>

      {/* Feature Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex flex-wrap gap-1">
          {DEV_FEATURES.map((feature) => (
            <button
              key={feature.id}
              onClick={() => setActiveFeature(feature.id)}
              className={`flex items-center gap-2 py-2.5 px-3 border-b-2 text-sm font-medium transition-colors ${
                activeFeature === feature.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {feature.icon}
              {feature.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Feature Content */}
      <Suspense fallback={<LoadingFallback />}>
        {activeFeature === 'api-explorer' && <ApiExplorer />}
        {activeFeature === 'history' && <RequestHistory />}
        {activeFeature === 'inspector' && <DataInspector />}
        {activeFeature === 'cache' && <CacheManager />}
        {activeFeature === 'debugger' && <ConnectionDebugger />}
        {activeFeature === 'playground' && <WidgetPlayground />}
      </Suspense>
    </div>
  );
}
