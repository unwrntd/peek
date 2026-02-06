import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { ScaledMetric } from '../../common/ScaledMetric';

interface OllamaStatus {
  version: string;
  modelCount: number;
  runningCount: number;
}

interface StatusData {
  status: OllamaStatus;
}

interface StatusWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Status({ integrationId, config, widgetId }: StatusWidgetProps) {
  const { data, loading, error } = useWidgetData<StatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const status = data?.status;
  const isMetricSize = config.metricSize === true;

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={status ? `v${status.version}` : '—'}
                className="text-purple-600 dark:text-purple-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Version</div>}
            </div>
            <div>
              <ScaledMetric
                value={status?.modelCount?.toString() || '0'}
                className="text-pink-600 dark:text-pink-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Models</div>}
            </div>
          </div>
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
            <span className={status ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
              {status ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Version</span>
            <span className="text-gray-900 dark:text-white">{status ? `v${status.version}` : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Models</span>
            <span className="text-gray-900 dark:text-white">{status?.modelCount || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Running</span>
            <span className="text-gray-900 dark:text-white">{status?.runningCount || 0}</span>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (isMetricSize) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${status ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-sm text-gray-400">
              {status ? 'Online' : 'Offline'}
            </span>
          </div>
          {status && (
            <>
              <div className="text-2xl font-bold text-white mb-1">
                v{status.version}
              </div>
              <div className="text-sm text-gray-400">
                {status.modelCount} models
              </div>
            </>
          )}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold text-white">Ollama</div>
            {status && (
              <div className="text-sm text-gray-400">v{status.version}</div>
            )}
          </div>
          <div className="ml-auto">
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              status ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {status ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        {status && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{status.modelCount}</div>
              <div className="text-xs text-gray-400">Available Models</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{status.runningCount}</div>
              <div className="text-xs text-gray-400">Running</div>
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
