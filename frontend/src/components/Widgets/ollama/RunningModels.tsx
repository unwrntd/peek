import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    parameter_size: string;
    quantization_level: string;
    family: string;
  };
  expires_at: string;
  size_vram: number;
}

interface RunningData {
  running: OllamaRunningModel[];
}

interface RunningModelsWidgetProps {
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

function formatTimeRemaining(expiresAt: string): string {
  const expires = new Date(expiresAt);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expiring...';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Less than 1 min';
  if (diffMins < 60) return `${diffMins} min`;
  return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
}

export function RunningModels({ integrationId, config, widgetId }: RunningModelsWidgetProps) {
  const { data, loading, error } = useWidgetData<RunningData>({
    integrationId,
    metric: 'running',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const running = data?.running || [];
  const totalVram = running.reduce((sum, m) => sum + (m.size_vram || 0), 0);

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {running.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">No models loaded</div>
          ) : (
            <>
              {!hideLabels && (
                <div className="text-xs text-gray-500 mb-2">{running.length} loaded • {formatBytes(totalVram)} VRAM</div>
              )}
              {running.map((model) => (
                <div key={model.digest} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
                  <span className="flex-1 truncate text-gray-200">{model.name}</span>
                  <span className="text-xs text-gray-500">{formatBytes(model.size_vram)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </BaseWidget>
    );
  }

  // List visualization
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          {running.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">No models loaded</div>
          ) : (
            <>
              {!hideLabels && (
                <div className="text-sm text-gray-500 mb-2">{running.length} loaded • {formatBytes(totalVram)} VRAM</div>
              )}
              {running.map((model) => (
                <div key={model.digest} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-200">{model.name}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatBytes(model.size_vram)} • {formatTimeRemaining(model.expires_at)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary header */}
        <div className="px-3 py-2 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${running.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm text-gray-400">
                {running.length} {running.length === 1 ? 'model' : 'models'} loaded
              </span>
            </div>
            {totalVram > 0 && (
              <span className="text-xs text-gray-500">
                {formatBytes(totalVram)} VRAM
              </span>
            )}
          </div>
        </div>

        {/* Running models list */}
        <div className="flex-1 overflow-y-auto">
          {running.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <div className="text-sm text-gray-500">No models currently loaded</div>
              <div className="text-xs text-gray-600 mt-1">Models are loaded on first use</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/30">
              {running.map((model) => (
                <div
                  key={model.digest}
                  className="px-3 py-3 hover:bg-gray-800/20"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {model.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-4">
                        {model.details?.parameter_size && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                            {model.details.parameter_size}
                          </span>
                        )}
                        {model.details?.quantization_level && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                            {model.details.quantization_level}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      {model.size_vram > 0 && (
                        <div className="text-sm text-gray-300">
                          {formatBytes(model.size_vram)}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {formatTimeRemaining(model.expires_at)}
                      </div>
                    </div>
                  </div>

                  {/* VRAM usage bar */}
                  {model.size_vram > 0 && totalVram > 0 && (
                    <div className="mt-2 ml-4">
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                          style={{ width: `${Math.min((model.size_vram / totalVram) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
