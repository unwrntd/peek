import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StaticWidgetConfig } from '../../config/integrations';
import { crossIntegrationRequirements, getIntegrationDisplayName } from '../../config/integrations';

interface WidgetDetailProps {
  config: StaticWidgetConfig;
  category: 'basic' | 'cross-integration';
  onClose?: () => void;
}

export function WidgetDetail({ config, category, onClose }: WidgetDetailProps) {
  const navigate = useNavigate();
  const requirements = crossIntegrationRequirements[config.type];
  const isCrossIntegration = category === 'cross-integration';

  const handleAddWidget = () => {
    // Navigate to dashboard and trigger add widget modal
    navigate('/', { state: { addWidget: config.type, widgetCategory: category } });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {config.name}
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isCrossIntegration
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              }`}>
                {isCrossIntegration ? 'Multi-Source' : 'Standalone'}
              </span>
            </div>
            <span className="inline-block text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
              {isCrossIntegration ? 'Cross-Integration Tool' : 'Basic Widget'}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Description */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Description</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{config.description}</p>
        </div>

        {/* Size Info */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Widget Size</h3>
          <div className="flex gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="text-gray-500 dark:text-gray-500">Default:</span>{' '}
              {config.defaultSize.w} x {config.defaultSize.h}
            </div>
            {config.minSize && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="text-gray-500 dark:text-gray-500">Minimum:</span>{' '}
                {config.minSize.w} x {config.minSize.h}
              </div>
            )}
          </div>
        </div>

        {/* Integration Requirements for Cross-Integration Tools */}
        {requirements && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Integration Requirements</h3>
            <div className="space-y-3">
              {requirements.required.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Required Integrations:</p>
                  <div className="flex flex-wrap gap-1">
                    {requirements.required.map((int) => (
                      <span
                        key={int}
                        className="px-2 py-1 text-xs font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                      >
                        {getIntegrationDisplayName(int)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {requirements.optional.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Optional Integrations (enhanced features):</p>
                  <div className="flex flex-wrap gap-1">
                    {requirements.optional.map((int) => (
                      <span
                        key={int}
                        className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                      >
                        {getIntegrationDisplayName(int)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {requirements.description && (
                <p className="text-xs text-gray-500 dark:text-gray-500 italic mt-2">
                  {requirements.description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Configuration Options */}
        {config.filters && config.filters.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Configuration Options ({config.filters.length})
            </h3>
            <div className="space-y-2">
              {config.filters.map((filter) => (
                <div
                  key={filter.key}
                  className="flex items-start gap-3 p-2 rounded bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {filter.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Type: {filter.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visualizations */}
        {config.visualizations && config.visualizations.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Visualizations
            </h3>
            <div className="flex flex-wrap gap-2">
              {config.visualizations.map((viz) => (
                <span
                  key={viz.value}
                  className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded"
                >
                  {viz.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <button
          onClick={handleAddWidget}
          className="w-full py-2 px-4 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
        >
          Add to Dashboard
        </button>
      </div>
    </div>
  );
}
