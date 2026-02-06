import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaModelDetails;
}

interface ModelsData {
  models: OllamaModel[];
}

interface ModelListWidgetProps {
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function ModelIcon({ family }: { family: string }) {
  const colors: Record<string, string> = {
    llama: 'from-orange-500 to-red-500',
    mistral: 'from-blue-500 to-cyan-500',
    qwen: 'from-green-500 to-emerald-500',
    gemma: 'from-purple-500 to-pink-500',
    phi: 'from-yellow-500 to-orange-500',
    deepseek: 'from-indigo-500 to-purple-500',
  };

  const gradient = colors[family.toLowerCase()] || 'from-gray-500 to-gray-600';

  return (
    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

export function ModelList({ integrationId, config, widgetId }: ModelListWidgetProps) {
  const { data, loading, error } = useWidgetData<ModelsData>({
    integrationId,
    metric: 'models',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const hideLabels = (config.hideLabels as boolean) || false;
  const models = data?.models || [];
  const search = (config.search as string) || '';
  const sortBy = (config.sortBy as string) || 'name';

  const filteredAndSortedModels = useMemo(() => {
    let result = [...models];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        m.details?.family?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'size':
          return b.size - a.size;
        case 'modified':
          return new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [models, search, sortBy]);

  const totalSize = models.reduce((sum, m) => sum + m.size, 0);

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {!hideLabels && (
            <div className="text-xs text-gray-500 mb-2">{models.length} models • {formatBytes(totalSize)}</div>
          )}
          {filteredAndSortedModels.map((model) => (
            <div key={model.digest} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-gray-200">{model.name}</span>
              <span className="text-xs text-gray-500">{formatBytes(model.size)}</span>
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          {!hideLabels && (
            <div className="text-sm text-gray-500">{models.length} models • {formatBytes(totalSize)}</div>
          )}
          <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-72">
            {filteredAndSortedModels.map((model) => (
              <div
                key={model.digest}
                className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ModelIcon family={model.details?.family || 'unknown'} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{model.name}</span>
                </div>
                {!hideLabels && (
                  <div className="text-xs text-gray-500">
                    {formatBytes(model.size)} • {model.details?.family || 'unknown'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: Table visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary header */}
        <div className="px-3 py-2 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {models.length} models
            </span>
            <span className="text-xs text-gray-500">
              {formatBytes(totalSize)} total
            </span>
          </div>
        </div>

        {/* Model list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-800/30">
            {filteredAndSortedModels.map((model) => (
              <div
                key={model.digest}
                className="px-3 py-3 hover:bg-gray-800/20"
              >
                <div className="flex items-start gap-3">
                  <ModelIcon family={model.details?.family || 'unknown'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {model.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
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
                      <span className="text-xs text-gray-500">
                        {model.details?.family}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{formatBytes(model.size)}</span>
                      <span>{formatDate(model.modified_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredAndSortedModels.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                {search ? 'No models match your search' : 'No models found'}
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
