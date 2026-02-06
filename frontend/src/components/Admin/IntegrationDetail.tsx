import React from 'react';
import { IntegrationConfig, getCategoryConfig } from '../../config/integrations';
import { useAdminNavigationStore } from '../../stores/adminNavigationStore';

interface IntegrationDetailProps {
  config: IntegrationConfig;
  instanceCount?: number;
  onAdd?: () => void;
  onClose?: () => void;
}

export function IntegrationDetail({ config, instanceCount = 0, onAdd, onClose }: IntegrationDetailProps) {
  const category = getCategoryConfig(config.category);
  const { navigateToApiExplorer } = useAdminNavigationStore();

  const handleViewApi = () => {
    navigateToApiExplorer(config.type);
    onClose?.();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {config.displayName}
              </h2>
              {instanceCount > 0 && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                  {instanceCount} deployed
                </span>
              )}
            </div>
            {category && (
              <span className="inline-block text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                {category.name}
              </span>
            )}
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

        {/* Documentation */}
        {config.documentationUrl && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Documentation</h3>
            <a
              href={config.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              {config.documentationUrl}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {/* Dependencies */}
        {config.dependencies && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Dependencies</h3>
            <div className="space-y-2">
              {config.dependencies.apis && config.dependencies.apis.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-500 w-16 flex-shrink-0">APIs:</span>
                  <div className="flex flex-wrap gap-1">
                    {config.dependencies.apis.map((api) => (
                      <span
                        key={api}
                        className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded"
                      >
                        {api}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {config.dependencies.packages && config.dependencies.packages.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-500 w-16 flex-shrink-0">Packages:</span>
                  <div className="flex flex-wrap gap-1">
                    {config.dependencies.packages.map((pkg) => (
                      <span
                        key={pkg}
                        className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded font-mono"
                      >
                        {pkg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {config.dependencies.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                  {config.dependencies.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Auth Info */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Authentication</h3>
          <div className="flex flex-wrap gap-2">
            {config.auth.methods.map((method) => (
              <span
                key={method.method}
                className={`text-xs px-2 py-0.5 rounded ${
                  method.method === config.auth.defaultMethod
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {method.label}
                {method.method === config.auth.defaultMethod && ' (default)'}
              </span>
            ))}
          </div>
          {config.defaultPort > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Default port: {config.defaultPort}
            </p>
          )}
        </div>

        {/* Widgets */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Available Widgets ({config.widgets.length})
          </h3>
          <div className="space-y-2">
            {config.widgets.map((widget) => (
              <div
                key={widget.type}
                className="flex items-start gap-3 p-2 rounded bg-gray-50 dark:bg-gray-700/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {widget.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {widget.description}
                  </p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {widget.defaultSize.w}x{widget.defaultSize.h}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex gap-3">
          <button
            onClick={handleViewApi}
            className="flex-1 py-2 px-4 rounded-lg font-medium transition-colors border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            View API
          </button>
          <button
            onClick={onAdd}
            className="flex-1 py-2 px-4 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
          >
            {instanceCount > 0 ? 'Add Another Instance' : 'Add Integration'}
          </button>
        </div>
      </div>
    </div>
  );
}
