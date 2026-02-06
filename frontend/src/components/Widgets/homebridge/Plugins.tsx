import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HomebridgePlugin } from '../../../types';

interface PluginsData {
  plugins: HomebridgePlugin[];
}

interface PluginsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Plugins({ integrationId, config, widgetId }: PluginsProps) {
  const { data, loading, error } = useWidgetData<PluginsData>({
    integrationId,
    metric: 'plugins',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const updatesOnly = config.updatesOnly === true;
  const showVersion = config.showVersion !== false;
  const showDescription = config.showDescription !== false;
  const showUpdateBadge = config.showUpdateBadge !== false;

  // Filter plugins
  let plugins = data?.plugins || [];
  if (updatesOnly) {
    plugins = plugins.filter(p => p.updateAvailable);
  }

  // No plugins
  if (plugins.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-sm">
            {updatesOnly ? 'All plugins up to date' : 'No plugins installed'}
          </span>
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {plugins.map((plugin) => (
            <div key={plugin.name} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${plugin.updateAvailable ? 'bg-blue-500' : 'bg-gray-400'}`} />
              <span className="flex-1 truncate text-gray-200">{plugin.displayName || plugin.name}</span>
              {showVersion && (
                <span className="flex-shrink-0 text-xs text-gray-500">v{plugin.installedVersion}</span>
              )}
              {showUpdateBadge && plugin.updateAvailable && (
                <span className="flex-shrink-0 text-xs text-blue-600 dark:text-blue-400">Update</span>
              )}
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization (grid layout)
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="grid grid-cols-2 gap-2">
          {plugins.map((plugin) => (
            <div
              key={plugin.name}
              className={`p-2 rounded-lg border ${
                plugin.updateAvailable
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg className={`w-4 h-4 ${plugin.updateAvailable ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                {showUpdateBadge && plugin.updateAvailable && (
                  <span className="px-1 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                    Update
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {plugin.displayName || plugin.name}
              </p>
              {showVersion && !hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  v{plugin.installedVersion}
                  {plugin.updateAvailable && plugin.latestVersion && ` → v${plugin.latestVersion}`}
                </p>
              )}
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {plugins.map((plugin) => (
          <div
            key={plugin.name}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {plugin.displayName || plugin.name}
                  </p>
                  {showUpdateBadge && plugin.updateAvailable && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                      Update
                    </span>
                  )}
                </div>
                {showVersion && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      v{plugin.installedVersion}
                    </span>
                    {plugin.updateAvailable && plugin.latestVersion && (
                      <>
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          v{plugin.latestVersion}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {showDescription && plugin.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {plugin.description}
                  </p>
                )}
              </div>
              {/* Plugin icon */}
              <div className={`p-2 rounded-lg ${
                plugin.updateAvailable
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </BaseWidget>
  );
}
