import React, { useState, useMemo, useEffect, useRef } from 'react';
import debounce from 'lodash/debounce';
import { Integration, WidgetDefinition } from '../../types';
import { useDashboardStore } from '../../stores/dashboardStore';
import { integrationConfigs, allStaticWidgets, crossIntegrationWidgets, crossIntegrationRequirements, getIntegrationDisplayName } from '../../config/integrations';

interface AddWidgetModalProps {
  integrations: Integration[];
  onClose: () => void;
}

/**
 * Build widget definitions from the centralized configuration registry.
 * This ensures widget metadata is always consistent with the config.
 */
function buildWidgetDefinitions(): WidgetDefinition[] {
  const definitions: WidgetDefinition[] = [];

  // Add static widgets (basic widgets that don't require integrations)
  for (const widget of allStaticWidgets) {
    // Skip cross-integration widgets - they get their own category
    if (widget.type.startsWith('cross-')) continue;

    definitions.push({
      type: widget.type,
      name: widget.name,
      description: widget.description,
      integrationTypes: ['static'],
      metric: widget.metric || '',
      defaultSize: widget.defaultSize,
      minSize: widget.minSize,
    });
  }

  // Add cross-integration widgets
  for (const widget of crossIntegrationWidgets) {
    definitions.push({
      type: widget.type,
      name: widget.name,
      description: widget.description,
      integrationTypes: ['cross-integration'],
      metric: widget.metric || '',
      defaultSize: widget.defaultSize,
      minSize: widget.minSize,
    });
  }

  // Add integration widgets with prefixed types for disambiguation
  for (const integration of integrationConfigs) {
    for (const widget of integration.widgets) {
      // Prefix widget type with integration type for beszel and adguard
      // to match existing widget type naming convention
      const widgetType = ['beszel', 'adguard'].includes(integration.type)
        ? `${integration.type}-${widget.type}`
        : widget.type;

      definitions.push({
        type: widgetType,
        name: widget.name,
        description: widget.description,
        integrationTypes: [integration.type],
        metric: widget.metric,
        defaultSize: widget.defaultSize,
        minSize: widget.minSize,
      });
    }
  }

  return definitions;
}

interface CategoryOption {
  id: string;
  name: string;
  type: 'static' | 'integration';
  integrationId?: string;
  integrationType?: string;
}

export function AddWidgetModal({ integrations, onClose }: AddWidgetModalProps) {
  const { addWidgets } = useDashboardStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('static');
  const [selectedIntegration, setSelectedIntegration] = useState<string>(integrations[0]?.id || '');
  const [selectedWidgets, setSelectedWidgets] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(''); // Immediate input value
  const [searchQuery, setSearchQuery] = useState(''); // Debounced search value
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category dropdown state
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Build category options
  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const options: CategoryOption[] = [
      { id: 'static', name: 'Basic Widgets', type: 'static' },
      { id: 'cross-integration', name: 'Cross-Integration Widgets', type: 'static' }
    ];

    for (const integration of integrations) {
      const displayName = getIntegrationDisplayName(integration.type);
      options.push({
        id: integration.id,
        name: `${integration.name} (${displayName})`,
        type: 'integration',
        integrationId: integration.id,
        integrationType: integration.type,
      });
    }

    return options;
  }, [integrations]);

  // Filter category options by search
  const filteredCategoryOptions = useMemo(() => {
    if (!categorySearch.trim()) return categoryOptions;
    const query = categorySearch.toLowerCase();
    return categoryOptions.filter(opt =>
      opt.name.toLowerCase().includes(query)
    );
  }, [categoryOptions, categorySearch]);

  // Get currently selected category option
  const selectedCategoryOption = useMemo(() => {
    if (selectedCategory === 'static') {
      return categoryOptions.find(opt => opt.id === 'static');
    }
    if (selectedCategory === 'cross-integration') {
      return categoryOptions.find(opt => opt.id === 'cross-integration');
    }
    return categoryOptions.find(opt => opt.integrationId === selectedIntegration);
  }, [selectedCategory, selectedIntegration, categoryOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
        setCategorySearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (categoryDropdownOpen && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [categoryDropdownOpen]);

  const handleCategorySelect = (option: CategoryOption) => {
    if (option.id === 'cross-integration') {
      setSelectedCategory('cross-integration');
    } else if (option.type === 'static') {
      setSelectedCategory('static');
    } else {
      setSelectedCategory('integration');
      setSelectedIntegration(option.integrationId!);
    }
    setSelectedWidgets(new Set());
    setCategoryDropdownOpen(false);
    setCategorySearch('');
  };

  // Debounced search update for performance
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setSearchQuery(value), 200),
    []
  );

  // Update debounced search when input changes
  useEffect(() => {
    debouncedSetSearch(searchInput);
    return () => debouncedSetSearch.cancel();
  }, [searchInput, debouncedSetSearch]);

  // Build widget definitions from the centralized config registry
  const widgetDefinitions = useMemo(() => buildWidgetDefinitions(), []);

  const currentIntegration = integrations.find(i => i.id === selectedIntegration);

  // Get available widgets based on selected category and search query
  const availableWidgets = useMemo(() => {
    let widgets: WidgetDefinition[];
    if (selectedCategory === 'static') {
      widgets = widgetDefinitions.filter(w => w.integrationTypes.includes('static'));
    } else if (selectedCategory === 'cross-integration') {
      widgets = widgetDefinitions.filter(w => w.integrationTypes.includes('cross-integration'));
    } else {
      widgets = widgetDefinitions.filter(
        w => currentIntegration && w.integrationTypes.includes(currentIntegration.type)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      widgets = widgets.filter(
        w =>
          w.name.toLowerCase().includes(query) ||
          w.description.toLowerCase().includes(query) ||
          w.type.toLowerCase().includes(query)
      );
    }

    return widgets;
  }, [selectedCategory, widgetDefinitions, currentIntegration, searchQuery]);

  const toggleWidgetSelection = (widgetType: string) => {
    setSelectedWidgets(prev => {
      const next = new Set(prev);
      if (next.has(widgetType)) {
        next.delete(widgetType);
      } else {
        next.add(widgetType);
      }
      return next;
    });
  };

  const selectAllWidgets = () => {
    setSelectedWidgets(new Set(availableWidgets.map(w => w.type)));
  };

  const deselectAllWidgets = () => {
    setSelectedWidgets(new Set());
  };

  const handleAdd = async () => {
    if (selectedWidgets.size === 0) return;
    if (selectedCategory !== 'static' && selectedCategory !== 'cross-integration' && !selectedIntegration) return;

    setSaving(true);
    setError(null);
    try {
      const widgetsToAdd = Array.from(selectedWidgets).map(widgetType => {
        const widgetDef = widgetDefinitions.find(w => w.type === widgetType)!;
        return {
          widget: {
            integration_id: (selectedCategory === 'static' || selectedCategory === 'cross-integration') ? null : selectedIntegration,
            widget_type: widgetDef.type,
            title: widgetDef.name,
            config: widgetDef.metric ? { metric: widgetDef.metric } : {},
          },
          layout: widgetDef.defaultSize,
        };
      });

      await addWidgets(widgetsToAdd);
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to add widgets:', errorMsg);
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Widget</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Category selector - searchable dropdown */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
            <div className="relative" ref={categoryDropdownRef}>
              <button
                type="button"
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <span className="truncate">{selectedCategoryOption?.name || 'Select category...'}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {categoryDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg">
                  {/* Search input */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="relative">
                      <input
                        ref={categoryInputRef}
                        type="text"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Search categories..."
                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md pl-8 pr-3 py-1.5 text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                      <svg
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCategoryOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No categories found
                      </div>
                    ) : (
                      filteredCategoryOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleCategorySelect(option)}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                            (option.id === 'static' && selectedCategory === 'static') ||
                            (option.id === 'cross-integration' && selectedCategory === 'cross-integration') ||
                            (option.type === 'integration' && selectedCategory === 'integration' && selectedIntegration === option.integrationId)
                              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {option.id === 'cross-integration' ? (
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            ) : option.type === 'static' ? (
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                              </svg>
                            )}
                            <span className="truncate">{option.name}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Widget selector */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Widget Type</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">{availableWidgets.length} widgets</span>
                {availableWidgets.length > 0 && (
                  <button
                    type="button"
                    onClick={selectedWidgets.size === availableWidgets.length ? deselectAllWidgets : selectAllWidgets}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {selectedWidgets.size === availableWidgets.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
            </div>
            {/* Search input with debouncing */}
            <div className="relative mb-3">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search widgets..."
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md pl-9 pr-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
              {availableWidgets.map(widget => {
                const isSelected = selectedWidgets.has(widget.type);
                const requirements = crossIntegrationRequirements[widget.type];
                return (
                  <button
                    key={widget.type}
                    onClick={() => toggleWidgetSelection(widget.type)}
                    className={`p-4 border rounded-lg text-left transition-colors relative ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    {/* Checkbox overlay */}
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-primary-500 border-primary-500'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-white pr-6">{widget.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{widget.description}</p>
                    {/* Integration requirement badges for cross-integration widgets */}
                    {requirements && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {requirements.required.map(int => (
                          <span
                            key={int}
                            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                            title="Required"
                          >
                            {getIntegrationDisplayName(int)}
                          </span>
                        ))}
                        {requirements.optional.slice(0, 3).map(int => (
                          <span
                            key={int}
                            className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                            title="Optional"
                          >
                            {getIntegrationDisplayName(int)}
                          </span>
                        ))}
                        {requirements.optional.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                            +{requirements.optional.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedWidgets.size} widget{selectedWidgets.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedWidgets.size === 0 || saving || (selectedCategory !== 'static' && selectedCategory !== 'cross-integration' && !selectedIntegration)}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : `Add ${selectedWidgets.size} Widget${selectedWidgets.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
