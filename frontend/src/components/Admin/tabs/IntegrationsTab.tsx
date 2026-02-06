import React, { useState, useEffect, useMemo } from 'react';
import { useIntegrations } from '../../../hooks/useIntegrations';
import { useIntegrationStore, ConnectionStatus } from '../../../stores/integrationStore';
import { useAdminNavigationStore } from '../../../stores/adminNavigationStore';
import { Integration } from '../../../types';
import { Card } from '../../common/Card';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { IntegrationForm } from '../IntegrationForm';
import { CategoryNav, WidgetCategoryType } from '../CategoryNav';
import { IntegrationCard } from '../IntegrationCard';
import { IntegrationDetail } from '../IntegrationDetail';
import { WidgetCard } from '../WidgetCard';
import { WidgetDetail } from '../WidgetDetail';
import {
  getIntegrationDisplayName,
  IntegrationCategory,
  IntegrationConfig,
  StaticWidgetConfig,
  integrationConfigs,
  searchIntegrations,
  getIntegrationsForCategory,
  staticWidgets,
  crossIntegrationWidgets,
} from '../../../config/integrations';

type StatusFilter = 'all' | 'connected' | 'failed' | 'pending' | 'disabled';

export function IntegrationsTab() {
  const { integrations, loading, error, deleteIntegration, updateIntegration, refetch } = useIntegrations();
  const { connectionStatuses, checkConnection, checkAllConnections } = useIntegrationStore();
  const { addIntegrationType, clearNavigation } = useAdminNavigationStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [hasCheckedConnections, setHasCheckedConnections] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [deployedSearchQuery, setDeployedSearchQuery] = useState('');

  // Catalog view state
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | WidgetCategoryType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatalogIntegration, setSelectedCatalogIntegration] = useState<IntegrationConfig | null>(null);
  const [selectedCatalogWidget, setSelectedCatalogWidget] = useState<{ config: StaticWidgetConfig; category: 'basic' | 'cross-integration' } | null>(null);
  const [addFormDefaultType, setAddFormDefaultType] = useState<string | undefined>(undefined);

  // Handle navigation from other components (e.g., API Explorer)
  useEffect(() => {
    if (addIntegrationType) {
      // Open the add form with the specified integration type
      setAddFormDefaultType(addIntegrationType);
      setShowAddForm(true);
      // Clear the navigation state
      clearNavigation();
    }
  }, [addIntegrationType, clearNavigation]);

  // Get counts of deployed integration instances by type
  const instanceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    integrations.forEach((i) => {
      counts.set(i.type, (counts.get(i.type) || 0) + 1);
    });
    return counts;
  }, [integrations]);

  // Check if a widget category is selected
  const isWidgetCategory = selectedCategory === 'basic-widgets' || selectedCategory === 'cross-integration-widgets';

  // Filter catalog integrations based on category and search
  const filteredCatalogIntegrations = useMemo(() => {
    // If widget category is selected, return empty array for integrations
    if (isWidgetCategory) {
      return [];
    }

    let results: IntegrationConfig[];

    if (searchQuery.trim()) {
      results = searchIntegrations(searchQuery);
    } else if (selectedCategory === 'all') {
      results = [...integrationConfigs];
    } else {
      results = getIntegrationsForCategory(selectedCategory as IntegrationCategory);
    }

    return results.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [selectedCategory, searchQuery, isWidgetCategory]);

  // Filter catalog widgets based on category and search
  const filteredCatalogWidgets = useMemo(() => {
    let basicResults: StaticWidgetConfig[] = [];
    let crossResults: StaticWidgetConfig[] = [];

    // Show basic widgets when basic-widgets category is selected
    if (selectedCategory === 'basic-widgets') {
      basicResults = [...staticWidgets];
    }

    // Show cross-integration widgets when cross-integration-widgets category is selected
    if (selectedCategory === 'cross-integration-widgets') {
      crossResults = [...crossIntegrationWidgets];
    }

    // When searching, include widgets and filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (selectedCategory !== 'cross-integration-widgets') {
        basicResults = staticWidgets.filter(
          w => w.name.toLowerCase().includes(query) || w.description.toLowerCase().includes(query)
        );
      }
      if (selectedCategory !== 'basic-widgets') {
        crossResults = crossIntegrationWidgets.filter(
          w => w.name.toLowerCase().includes(query) || w.description.toLowerCase().includes(query)
        );
      }
    }

    return {
      basic: basicResults.sort((a, b) => a.name.localeCompare(b.name)),
      crossIntegration: crossResults.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [selectedCategory, searchQuery]);

  const handleAddFromCatalog = (config: IntegrationConfig) => {
    setSelectedCatalogIntegration(null);
    setShowCatalog(false);
    setAddFormDefaultType(config.type);
    setShowAddForm(true);
  };

  // Check all connections on mount (once integrations are loaded)
  useEffect(() => {
    if (integrations.length > 0 && !hasCheckedConnections) {
      setHasCheckedConnections(true);
      checkAllConnections();
    }
  }, [integrations, hasCheckedConnections, checkAllConnections]);

  const handleTestConnection = async (id: string) => {
    await checkConnection(id);
  };

  const handleTestAllConnections = async () => {
    setIsTestingAll(true);
    try {
      await checkAllConnections();
    } finally {
      setIsTestingAll(false);
    }
  };

  const getConnectionStatusDisplay = (status: ConnectionStatus | undefined) => {
    if (!status || status.status === 'unknown') {
      return { statusType: 'unknown' as const, label: 'Unknown' };
    }
    if (status.status === 'checking') {
      return { statusType: 'warning' as const, label: 'Checking...' };
    }
    if (status.status === 'connected') {
      return { statusType: 'online' as const, label: 'Connected' };
    }
    return { statusType: 'offline' as const, label: 'Failed' };
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this integration?')) {
      await deleteIntegration(id);
    }
  };

  const handleToggleEnabled = async (integration: Integration) => {
    await updateIntegration(integration.id, { enabled: !integration.enabled });
  };

  if (loading && integrations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Calculate connection stats
  const disabledCount = integrations.filter(i => !i.enabled).length;
  const enabledIntegrations = integrations.filter(i => i.enabled);
  const connectedCount = enabledIntegrations.filter(i => connectionStatuses[i.id]?.status === 'connected').length;
  const disconnectedCount = enabledIntegrations.filter(i => connectionStatuses[i.id]?.status === 'failed').length;
  const pendingCount = enabledIntegrations.length - connectedCount - disconnectedCount;

  // Filter integrations based on status and search query
  const filteredIntegrations = integrations.filter(integration => {
    // First apply status filter
    let passesStatusFilter = true;
    if (statusFilter === 'disabled') {
      passesStatusFilter = !integration.enabled;
    } else if (statusFilter !== 'all') {
      if (!integration.enabled) passesStatusFilter = false;
      else {
        const status = connectionStatuses[integration.id]?.status;
        if (statusFilter === 'connected') passesStatusFilter = status === 'connected';
        else if (statusFilter === 'failed') passesStatusFilter = status === 'failed';
        else if (statusFilter === 'pending') passesStatusFilter = status !== 'connected' && status !== 'failed';
      }
    }

    if (!passesStatusFilter) return false;

    // Then apply search filter
    if (deployedSearchQuery.trim()) {
      const query = deployedSearchQuery.toLowerCase();
      const displayName = getIntegrationDisplayName(integration.type).toLowerCase();
      return (
        integration.name.toLowerCase().includes(query) ||
        integration.type.toLowerCase().includes(query) ||
        displayName.includes(query)
      );
    }

    return true;
  });

  return (
    <>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Summary Stats and Filters */}
      {integrations.length > 0 && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                value={deployedSearchQuery}
                onChange={(e) => setDeployedSearchQuery(e.target.value)}
                placeholder="Search integrations..."
                className="w-48 pl-8 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <svg
                className="absolute left-2.5 top-2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {deployedSearchQuery && (
                <button
                  onClick={() => setDeployedSearchQuery('')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All ({integrations.length})
            </button>
            <button
              onClick={() => setStatusFilter('connected')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                statusFilter === 'connected'
                  ? 'bg-green-600 text-white font-medium'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-current opacity-70" />
              Connected ({connectedCount})
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                statusFilter === 'failed'
                  ? 'bg-red-600 text-white font-medium'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-current opacity-70" />
              Failed ({disconnectedCount})
            </button>
            {pendingCount > 0 && (
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-gray-600 text-white font-medium'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-current opacity-70" />
                Pending ({pendingCount})
              </button>
            )}
            {disabledCount > 0 && (
              <button
                onClick={() => setStatusFilter('disabled')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'disabled'
                    ? 'bg-yellow-600 text-white font-medium'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-current opacity-70" />
                Disabled ({disabledCount})
              </button>
            )}
          </div>

          {/* Test All Button */}
          <button
            onClick={handleTestAllConnections}
            disabled={isTestingAll}
            className={`px-4 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-2 ${
              isTestingAll
                ? 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <svg className={`w-4 h-4 ${isTestingAll ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isTestingAll ? 'Testing...' : 'Test All'}
          </button>
        </div>
      )}

      <Card title={showCatalog ? "Integration Catalog" : "Integrations"} actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowCatalog(!showCatalog);
              if (!showCatalog) {
                setSearchQuery('');
                setSelectedCategory('all');
              }
            }}
            className={`px-4 py-2 border rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
              showCatalog
                ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showCatalog ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              )}
            </svg>
            {showCatalog ? 'Close Catalog' : 'Browse Catalog'}
          </button>
          {!showCatalog && (
            <button
              onClick={() => {
                setAddFormDefaultType(undefined);
                setShowAddForm(true);
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Integration
            </button>
          )}
        </div>
      }>
        {showCatalog ? (
          /* Catalog View */
          <div className="flex gap-6">
            {/* Category Sidebar */}
            <div className="w-48 flex-shrink-0">
              <CategoryNav
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  setSearchQuery('');
                }}
              />
            </div>

            {/* Catalog Content */}
            <div className="flex-1 min-w-0">
              {/* Search */}
              <div className="mb-4">
                <div className="relative max-w-md">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search integrations..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg
                    className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {isWidgetCategory ? (
                    <>
                      {filteredCatalogWidgets.basic.length + filteredCatalogWidgets.crossIntegration.length} tool
                      {filteredCatalogWidgets.basic.length + filteredCatalogWidgets.crossIntegration.length !== 1 ? 's' : ''}
                    </>
                  ) : (
                    <>
                      {filteredCatalogIntegrations.length} integration{filteredCatalogIntegrations.length !== 1 ? 's' : ''}
                      {searchQuery && (filteredCatalogWidgets.basic.length + filteredCatalogWidgets.crossIntegration.length) > 0 && (
                        <>, {filteredCatalogWidgets.basic.length + filteredCatalogWidgets.crossIntegration.length} tool
                        {filteredCatalogWidgets.basic.length + filteredCatalogWidgets.crossIntegration.length !== 1 ? 's' : ''}</>
                      )}
                    </>
                  )}
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              </div>

              {/* Integrations */}
              {filteredCatalogIntegrations.length > 0 && (
                <>
                  {searchQuery && (filteredCatalogWidgets.basic.length + filteredCatalogWidgets.crossIntegration.length) > 0 && (
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Integrations</h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {filteredCatalogIntegrations.map((config) => (
                      <IntegrationCard
                        key={config.type}
                        config={config}
                        instanceCount={instanceCounts.get(config.type) || 0}
                        onClick={() => setSelectedCatalogIntegration(config)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Basic Widgets */}
              {filteredCatalogWidgets.basic.length > 0 && (
                <>
                  {(filteredCatalogIntegrations.length > 0 || filteredCatalogWidgets.crossIntegration.length > 0) && (
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Basic Widgets</h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {filteredCatalogWidgets.basic.map((config) => (
                      <WidgetCard
                        key={config.type}
                        config={config}
                        category="basic"
                        onClick={() => setSelectedCatalogWidget({ config, category: 'basic' })}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Cross-Integration Tools */}
              {filteredCatalogWidgets.crossIntegration.length > 0 && (
                <>
                  {(filteredCatalogIntegrations.length > 0 || filteredCatalogWidgets.basic.length > 0) && (
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Cross-Integration Tools</h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCatalogWidgets.crossIntegration.map((config) => (
                      <WidgetCard
                        key={config.type}
                        config={config}
                        category="cross-integration"
                        onClick={() => setSelectedCatalogWidget({ config, category: 'cross-integration' })}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Empty state */}
              {filteredCatalogIntegrations.length === 0 &&
               filteredCatalogWidgets.basic.length === 0 &&
               filteredCatalogWidgets.crossIntegration.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">
                    No {isWidgetCategory ? 'tools' : 'integrations'} found
                    {searchQuery && ` matching "${searchQuery}"`}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Deployed Integrations View */
          <>
            {integrations.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No integrations configured. Add one to get started.
              </p>
            ) : filteredIntegrations.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No integrations match {deployedSearchQuery ? `"${deployedSearchQuery}"` : 'the selected filter'}.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredIntegrations.map(integration => {
                  const connStatus = connectionStatuses[integration.id];
                  const { statusType, label } = getConnectionStatusDisplay(connStatus);
                  const isChecking = connStatus?.status === 'checking';

                  return (
                    <div
                      key={integration.id}
                      className="group relative border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all bg-white dark:bg-gray-800"
                    >
                      {/* Header with icon, name, and status */}
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                          statusType === 'online'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : statusType === 'offline'
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <svg className={`w-4 h-4 ${
                            statusType === 'online'
                              ? 'text-green-600 dark:text-green-400'
                              : statusType === 'offline'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {integration.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {getIntegrationDisplayName(integration.type)}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          integration.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {integration.enabled ? 'On' : 'Off'}
                        </span>
                      </div>

                      {/* Connection status */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          statusType === 'online' ? 'bg-green-500' :
                          statusType === 'offline' ? 'bg-red-500' :
                          statusType === 'warning' ? 'bg-yellow-500 animate-pulse' :
                          'bg-gray-400'
                        }`} />
                        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={() => handleTestConnection(integration.id)}
                          disabled={isChecking}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-200 transition-colors"
                        >
                          {isChecking ? '...' : 'Test'}
                        </button>
                        <button
                          onClick={() => setEditingIntegration(integration)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleEnabled(integration)}
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                          title={integration.enabled ? 'Disable' : 'Enable'}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {integration.enabled ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(integration.id)}
                          className="px-2 py-1 text-xs border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Catalog Integration Detail Modal */}
      {selectedCatalogIntegration && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedCatalogIntegration(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <IntegrationDetail
              key={selectedCatalogIntegration.type}
              config={selectedCatalogIntegration}
              instanceCount={instanceCounts.get(selectedCatalogIntegration.type) || 0}
              onAdd={() => handleAddFromCatalog(selectedCatalogIntegration)}
              onClose={() => setSelectedCatalogIntegration(null)}
            />
          </div>
        </div>
      )}

      {/* Catalog Widget Detail Modal */}
      {selectedCatalogWidget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedCatalogWidget(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <WidgetDetail
              config={selectedCatalogWidget.config}
              category={selectedCatalogWidget.category}
              onClose={() => setSelectedCatalogWidget(null)}
            />
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {(showAddForm || editingIntegration) && (
        <IntegrationForm
          integration={editingIntegration}
          defaultType={addFormDefaultType}
          onClose={() => {
            setShowAddForm(false);
            setEditingIntegration(null);
            setAddFormDefaultType(undefined);
          }}
          onSaved={() => {
            setShowAddForm(false);
            setEditingIntegration(null);
            setAddFormDefaultType(undefined);
            refetch();
          }}
        />
      )}
    </>
  );
}
