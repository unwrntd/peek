import React, { useState, useEffect, useMemo } from 'react';
import { Integration } from '../../../types';
import { dataApi, ApiCapability } from '../../../api/client';
import { getIntegrationConfig, getIntegrationDisplayName } from '../../../config/integrations';
import { CapabilityTester } from './CapabilityTester';
import { useAdminNavigationStore } from '../../../stores/adminNavigationStore';

interface IntegrationCapabilitiesProps {
  integrationType: string;
  integration?: Integration;
  connectionStatus?: 'unknown' | 'checking' | 'connected' | 'failed';
}

type ApiFilter = 'all' | 'implemented' | 'unimplemented';

export function IntegrationCapabilities({
  integrationType,
  integration,
  connectionStatus,
}: IntegrationCapabilitiesProps) {
  const [capabilities, setCapabilities] = useState<ApiCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [apiFilter, setApiFilter] = useState<ApiFilter>('all');
  const [testingCapability, setTestingCapability] = useState<ApiCapability | null>(null);

  const config = getIntegrationConfig(integrationType);
  const displayName = getIntegrationDisplayName(integrationType);
  const isDeployed = !!integration;
  const { navigateToAddIntegration } = useAdminNavigationStore();

  const handleConfigure = () => {
    navigateToAddIntegration(integrationType);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const capabilitiesData = await dataApi.getCapabilities(integrationType);
        setCapabilities(capabilitiesData);
        // Expand all categories by default
        const categories = new Set(capabilitiesData.map((c) => c.category || 'Other'));
        setExpandedCategories(categories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [integrationType]);

  // Group capabilities by category
  const groupedCapabilities = useMemo(() => {
    const filtered = apiFilter === 'all'
      ? capabilities
      : apiFilter === 'implemented'
      ? capabilities.filter((c) => c.implemented)
      : capabilities.filter((c) => !c.implemented);

    const groups: Record<string, ApiCapability[]> = {};
    filtered.forEach((cap) => {
      const category = cap.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(cap);
    });
    return groups;
  }, [capabilities, apiFilter]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const implementedCount = capabilities.filter((c) => c.implemented).length;
  const totalCount = capabilities.length;

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-400';
      case 'failed':
        return 'bg-red-400';
      case 'checking':
        return 'bg-yellow-400 animate-pulse';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'failed':
        return 'Failed';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {displayName}
              </h2>
              {isDeployed && connectionStatus && (
                <div className="flex items-center gap-1.5 text-sm text-gray-400">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                  <span>{getStatusText()}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfigure}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              title={isDeployed ? 'Add another instance' : 'Configure this integration'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {isDeployed ? 'Add Instance' : 'Configure'}
            </button>
            {config?.documentationUrl && (
              <a
                href={config.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Docs
              </a>
            )}
          </div>
        </div>

        {/* Quick info */}
        {config && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {config.description && (
              <p className="text-gray-400 w-full">{config.description}</p>
            )}
            {config.dependencies?.apis && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">APIs:</span>
                <span className="text-gray-300">{config.dependencies.apis.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Filter */}
      <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-600">
          <button
            onClick={() => setApiFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              apiFilter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Full API ({totalCount})
          </button>
          <button
            onClick={() => setApiFilter('implemented')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              apiFilter === 'implemented'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Implemented ({implementedCount})
          </button>
          <button
            onClick={() => setApiFilter('unimplemented')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              apiFilter === 'unimplemented'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Unimplemented ({totalCount - implementedCount})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading capabilities...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Failed to load capabilities</span>
            </div>
            <p className="mt-2 text-sm text-red-300">{error}</p>
          </div>
        ) : (
          /* API Capabilities View */
          <div className="space-y-2">
            {Object.entries(groupedCapabilities).map(([category, caps]) => (
              <div key={category} className="border border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedCategories.has(category) ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-white">{category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {caps.filter((c) => c.implemented).length}/{caps.length} implemented
                    </span>
                  </div>
                </button>
                {expandedCategories.has(category) && (
                  <div className="divide-y divide-gray-700">
                    {caps.map((cap) => (
                      <div
                        key={cap.id}
                        className={`p-3 ${cap.implemented ? 'bg-gray-800/30' : 'bg-gray-900/50'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-1.5 py-0.5 text-xs font-mono rounded ${
                                  cap.method === 'GET'
                                    ? 'bg-green-500/20 text-green-400'
                                    : cap.method === 'POST'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : cap.method === 'PUT'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : cap.method === 'DELETE'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}
                              >
                                {cap.method}
                              </span>
                              <code className="text-sm text-gray-300">{cap.endpoint}</code>
                              {cap.implemented && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-primary-500/20 text-primary-400 rounded">
                                  Implemented
                                </span>
                              )}
                            </div>
                            <h4 className="mt-1 text-sm font-medium text-white">{cap.name}</h4>
                            <p className="mt-0.5 text-xs text-gray-400">{cap.description}</p>
                            {cap.parameters && cap.parameters.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {cap.parameters.map((param) => (
                                  <span
                                    key={param.name}
                                    className={`px-1.5 py-0.5 text-[10px] rounded ${
                                      param.required
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-gray-700 text-gray-400'
                                    }`}
                                    title={param.description}
                                  >
                                    {param.name}: {param.type}
                                    {param.required && '*'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isDeployed && connectionStatus === 'connected' && (
                              <button
                                onClick={() => setTestingCapability(cap)}
                                className="px-2 py-1 text-xs font-medium text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 rounded transition-colors flex items-center gap-1"
                                title="Test this endpoint"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Test
                              </button>
                            )}
                            {cap.documentationUrl && (
                              <a
                                href={cap.documentationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-gray-500 hover:text-white transition-colors"
                                title="View documentation"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {Object.keys(groupedCapabilities).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">
                  {apiFilter === 'unimplemented'
                    ? 'All API endpoints are implemented'
                    : apiFilter === 'implemented'
                    ? 'No implemented endpoints'
                    : 'No API capabilities defined for this integration'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Capability Tester Modal */}
      {testingCapability && integration && (
        <CapabilityTester
          capability={testingCapability}
          integrationId={integration.id}
          integrationName={integration.name}
          onClose={() => setTestingCapability(null)}
        />
      )}
    </div>
  );
}
