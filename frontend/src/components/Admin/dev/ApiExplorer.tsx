import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useIntegrationStore, ConnectionStatus } from '../../../stores/integrationStore';
import { useAdminNavigationStore } from '../../../stores/adminNavigationStore';
import { Integration, IntegrationType } from '../../../types';
import { getIntegrationDisplayName, integrationConfigs } from '../../../config/integrations';
import { IntegrationCategory } from '../../../config/integrations/types';
import { IntegrationCapabilities } from './IntegrationCapabilities';

type ViewMode = 'deployed' | 'catalog';

interface CategoryGroup {
  category: IntegrationCategory;
  label: string;
  items: Array<{ type: string; name: string; integration?: Integration }>;
}

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  infrastructure: 'Infrastructure',
  networking: 'Networking',
  'media-servers': 'Media Servers',
  'media-management': 'Media Management',
  'download-clients': 'Download Clients',
  'smart-home': 'Smart Home',
  storage: 'Storage',
  monitoring: 'Monitoring',
  security: 'Security',
  utilities: 'Utilities',
};

const CATEGORY_ORDER: IntegrationCategory[] = [
  'infrastructure',
  'networking',
  'security',
  'monitoring',
  'media-servers',
  'media-management',
  'download-clients',
  'smart-home',
  'storage',
  'utilities',
];

export function ApiExplorer() {
  const {
    integrations,
    integrationTypes,
    connectionStatuses,
    fetchIntegrations,
    fetchIntegrationTypes,
    checkAllConnections,
  } = useIntegrationStore();

  const { apiExplorerType, clearNavigation } = useAdminNavigationStore();

  const [viewMode, setViewMode] = useState<ViewMode>('deployed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));

  // Ref to track if we've handled external navigation (synchronous communication between effects)
  const externalNavTypeRef = useRef<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchIntegrations();
    fetchIntegrationTypes();
  }, [fetchIntegrations, fetchIntegrationTypes]);

  // Handle navigation from other components (e.g., Integration Catalog)
  // This runs when apiExplorerType is set from external navigation
  useEffect(() => {
    if (apiExplorerType) {
      // Store in ref BEFORE any state updates (synchronous)
      externalNavTypeRef.current = apiExplorerType;
      // Switch to catalog view to show all integration types
      setViewMode('catalog');
      // Find if there's a deployed integration of this type
      const deployedIntegration = integrations.find((i) => i.type === apiExplorerType);
      setSelectedType(apiExplorerType);
      setSelectedIntegration(deployedIntegration || null);
      // Clear the navigation state after processing
      clearNavigation();
    }
  }, [apiExplorerType, integrations, clearNavigation]);

  // Check connections when integrations load (only once)
  const [hasCheckedConnections, setHasCheckedConnections] = useState(false);
  useEffect(() => {
    if (integrations.length > 0 && !hasCheckedConnections) {
      setHasCheckedConnections(true);
      checkAllConnections();
    }
  }, [integrations, hasCheckedConnections, checkAllConnections]);

  // Auto-select first deployed integration only on initial load
  // Check the ref to see if external navigation is being handled (effects run in same cycle)
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    // Skip if external navigation is being handled (ref is set synchronously before this runs)
    if (externalNavTypeRef.current) {
      return;
    }
    // Only auto-select once, in deployed mode, when integrations load
    if (viewMode === 'deployed' && integrations.length > 0 && !selectedType && !hasAutoSelectedRef.current) {
      hasAutoSelectedRef.current = true;
      const firstEnabled = integrations.find((i) => i.enabled);
      if (firstEnabled) {
        setSelectedIntegration(firstEnabled);
        setSelectedType(firstEnabled.type);
      }
    }
  }, [viewMode, integrations, selectedType]);

  // Group items by category
  const categoryGroups = useMemo((): CategoryGroup[] => {
    const groups: Record<IntegrationCategory, CategoryGroup['items']> = {
      infrastructure: [],
      networking: [],
      'media-servers': [],
      'media-management': [],
      'download-clients': [],
      'smart-home': [],
      storage: [],
      monitoring: [],
      security: [],
      utilities: [],
    };

    if (viewMode === 'deployed') {
      // Group deployed integrations
      integrations.forEach((integration) => {
        const config = integrationConfigs.find((c) => c.type === integration.type);
        const category = config?.category || 'utilities';
        groups[category].push({
          type: integration.type,
          name: config?.displayName || integration.type,
          integration,
        });
      });
    } else {
      // Group all integration types from configs
      integrationConfigs.forEach((config) => {
        const deployedIntegration = integrations.find((i) => i.type === config.type);
        groups[config.category].push({
          type: config.type,
          name: config.displayName,
          integration: deployedIntegration,
        });
      });
    }

    // Filter by search and convert to array
    const searchLower = searchQuery.toLowerCase();
    return CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: groups[category].filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.type.toLowerCase().includes(searchLower)
      ),
    })).filter((group) => group.items.length > 0);
  }, [viewMode, integrations, integrationTypes, searchQuery]);

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

  const handleSelectItem = (type: string, integration?: Integration) => {
    setSelectedType(type);
    setSelectedIntegration(integration || null);
  };

  const getConnectionStatus = (integrationId?: string): ConnectionStatus | undefined => {
    if (!integrationId) return undefined;
    return connectionStatuses[integrationId];
  };

  const totalItems = categoryGroups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-transparent">
      {/* Sidebar - Integration Selector */}
      <div className="w-72 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* View mode toggle */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => {
                setViewMode('deployed');
                setSelectedType(null);
                setSelectedIntegration(null);
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'deployed'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Deployed ({integrations.length})
            </button>
            <button
              onClick={() => {
                setViewMode('catalog');
                setSelectedType(null);
                setSelectedIntegration(null);
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'catalog'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All Types ({integrationConfigs.length})
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search integrations..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-xs text-gray-500">
              {totalItems} result{totalItems !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {/* Integration list */}
        <div className="flex-1 overflow-auto">
          {categoryGroups.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">
                {viewMode === 'deployed'
                  ? 'No integrations configured'
                  : 'No matching integrations'}
              </p>
            </div>
          ) : (
            <div className="py-2">
              {categoryGroups.map((group) => (
                <div key={group.category} className="mb-1">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span>{group.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">({group.items.length})</span>
                      <svg
                        className={`w-3 h-3 transition-transform ${
                          expandedCategories.has(group.category) ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Category items */}
                  {expandedCategories.has(group.category) && (
                    <div className="pb-1">
                      {group.items.map((item) => {
                        const isSelected =
                          selectedType === item.type &&
                          (viewMode === 'catalog' || selectedIntegration?.id === item.integration?.id);
                        const status = getConnectionStatus(item.integration?.id);

                        return (
                          <button
                            key={item.integration?.id || item.type}
                            onClick={() => handleSelectItem(item.type, item.integration)}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                              isSelected
                                ? 'bg-primary-500/20 text-primary-400'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            {/* Status indicator */}
                            {item.integration && (
                              <div
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  status?.status === 'connected'
                                    ? 'bg-green-400'
                                    : status?.status === 'failed'
                                    ? 'bg-red-400'
                                    : status?.status === 'checking'
                                    ? 'bg-yellow-400 animate-pulse'
                                    : 'bg-gray-500'
                                }`}
                              />
                            )}
                            {!item.integration && viewMode === 'catalog' && (
                              <div className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-600" />
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.name}</div>
                            </div>

                            {/* Deployed badge */}
                            {viewMode === 'catalog' && item.integration && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">
                                Deployed
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content - Capabilities Panel */}
      <div className="flex-1 overflow-hidden">
        {selectedType ? (
          <IntegrationCapabilities
            key={selectedType}
            integrationType={selectedType}
            integration={selectedIntegration || undefined}
            connectionStatus={
              selectedIntegration ? connectionStatuses[selectedIntegration.id]?.status : undefined
            }
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">Select an Integration</p>
              <p className="text-sm mt-1">
                Choose an integration from the list to explore its API capabilities
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
