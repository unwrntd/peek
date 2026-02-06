import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';

interface HomeAssistantSystemConfig {
  location_name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  unit_system: {
    length: string;
    mass: string;
    temperature: string;
    volume: string;
  };
  time_zone: string;
  version: string;
  config_dir: string;
  components: string[];
  state: string;
}

interface HomeAssistantCombinedStatus {
  config: HomeAssistantSystemConfig;
  entityCount: number;
  domainCounts: Record<string, number>;
}

interface SystemStatusData {
  status: HomeAssistantCombinedStatus;
}

interface SystemStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function SystemStatus({ integrationId, config, widgetId }: SystemStatusProps) {
  const { data, loading, error } = useWidgetData<SystemStatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const showLocation = config.showLocation !== false;
  const showTimezone = config.showTimezone !== false;
  const showEntityCount = config.showEntityCount !== false;
  const showComponents = config.showComponents !== false;

  const status = data?.status;
  const haConfig = status?.config;

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          {showEntityCount && status?.entityCount !== undefined ? (
            <div className="text-center">
              <ScaledMetric
                value={status.entityCount.toLocaleString()}
                className="text-blue-600 dark:text-blue-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Entities</div>}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {haConfig?.state || 'Unknown'}
              </div>
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">v{haConfig?.version}</div>}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <span className={haConfig?.state === 'RUNNING' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
              {haConfig?.state || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Version</span>
            <span className="text-gray-900 dark:text-white">v{haConfig?.version || '?'}</span>
          </div>
          {showEntityCount && status?.entityCount !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Entities</span>
              <span className="text-blue-600 dark:text-blue-400">{status.entityCount.toLocaleString()}</span>
            </div>
          )}
          {showComponents && haConfig?.components && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Components</span>
              <span className="text-gray-900 dark:text-white">{haConfig.components.length}</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Status and Version Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Home Assistant Icon */}
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 12h3v9h6v-6h2v6h6v-9h3L12 2zm0 2.84L18.5 11H18v8h-4v-6H10v6H6v-8h-.5L12 4.84z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {haConfig?.location_name || 'Home Assistant'}
              </p>
              {!hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  v{haConfig?.version || '?'}
                </p>
              )}
            </div>
          </div>
          {/* Status Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            haConfig?.state === 'RUNNING'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>
            {haConfig?.state || 'Unknown'}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {showLocation && haConfig?.location_name && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>}
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {haConfig.location_name}
              </p>
            </div>
          )}

          {showTimezone && haConfig?.time_zone && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && <p className="text-xs text-gray-500 dark:text-gray-400">Timezone</p>}
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {haConfig.time_zone}
              </p>
            </div>
          )}

          {showEntityCount && status?.entityCount !== undefined && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && <p className="text-xs text-gray-500 dark:text-gray-400">Entities</p>}
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {status.entityCount.toLocaleString()}
              </p>
            </div>
          )}

          {showComponents && haConfig?.components && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && <p className="text-xs text-gray-500 dark:text-gray-400">Components</p>}
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {haConfig.components.length.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Domain breakdown (top 5) */}
        {!hideLabels && status?.domainCounts && Object.keys(status.domainCounts).length > 0 && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Top Domains</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(status.domainCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([domain, count]) => (
                  <span
                    key={domain}
                    className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    {domain}: {count}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
