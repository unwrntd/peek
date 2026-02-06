import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { ScaledMetric } from '../../common/ScaledMetric';
import { CircularGauge } from '../../common/visualizations';

interface StorageModel {
  name: string;
  size: number;
}

interface StorageData {
  storage: {
    totalSize: number;
    modelCount: number;
    models: StorageModel[];
  };
}

interface StorageWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function Storage({ integrationId, config, widgetId }: StorageWidgetProps) {
  const { data, loading, error } = useWidgetData<StorageData>({
    integrationId,
    metric: 'storage',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'gauge';
  const hideLabels = (config.hideLabels as boolean) || false;
  const storage = data?.storage;
  const isMetricSize = config.metricSize === true;

  // Sort models by size for the breakdown
  const sortedModels = storage?.models
    ? [...storage.models].sort((a, b) => b.size - a.size).slice(0, 5)
    : [];

  // Number visualization - large number
  if (visualization === 'number') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <ScaledMetric
              value={storage ? formatBytes(storage.totalSize) : '—'}
              className="text-purple-600 dark:text-purple-400"
            />
            {!hideLabels && <div className="text-sm text-gray-500 mt-1">{storage?.modelCount || 0} models</div>}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Bar visualization - progress bars
  if (visualization === 'bar') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {storage ? formatBytes(storage.totalSize) : '—'}
            </div>
            {!hideLabels && <div className="text-sm text-gray-500">{storage?.modelCount || 0} models</div>}
          </div>
          {sortedModels.map((model) => {
            const percentage = storage?.totalSize ? (model.size / storage.totalSize) * 100 : 0;
            return (
              <div key={model.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 truncate max-w-[60%]">{model.name}</span>
                  <span className="text-gray-500">{formatBytes(model.size)}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </BaseWidget>
    );
  }

  // Gauge visualization
  if (visualization === 'gauge') {
    // Use 100GB as max for visualization purposes
    const maxStorage = 100 * 1024 * 1024 * 1024;
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <CircularGauge
            value={storage?.totalSize || 0}
            max={maxStorage}
            size="lg"
            showValue={false}
          />
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {storage ? formatBytes(storage.totalSize) : '—'}
            </div>
            {!hideLabels && <div className="text-sm text-gray-500">{storage?.modelCount || 0} models</div>}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (isMetricSize) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <svg className="w-8 h-8 text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          <div className="text-2xl font-bold text-white">
            {storage ? formatBytes(storage.totalSize) : '—'}
          </div>
          <div className="text-sm text-gray-400">
            {storage ? `${storage.modelCount} models` : 'No data'}
          </div>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-4">
        {/* Total storage display */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-white">
              {storage ? formatBytes(storage.totalSize) : '—'}
            </div>
            <div className="text-sm text-gray-400">
              Total Storage Used
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
        </div>

        {/* Model breakdown */}
        {sortedModels.length > 0 && (
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">
              Largest Models
            </div>
            <div className="space-y-2">
              {sortedModels.map((model, index) => {
                const percentage = storage?.totalSize
                  ? (model.size / storage.totalSize) * 100
                  : 0;

                return (
                  <div key={model.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300 truncate" style={{ maxWidth: '60%' }}>
                        {model.name}
                      </span>
                      <span className="text-gray-500">{formatBytes(model.size)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          index === 0
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                            : index === 1
                            ? 'bg-purple-500/70'
                            : 'bg-purple-500/50'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Model count */}
        <div className="mt-auto pt-3 border-t border-gray-700/50">
          <div className="text-xs text-gray-500 text-center">
            {storage?.modelCount || 0} models installed
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
