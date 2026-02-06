import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TdarrNode } from '../../../types';

interface NodeStatusData {
  nodes: TdarrNode[];
}

interface NodeStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function NodeStatus({ integrationId, config, widgetId }: NodeStatusProps) {
  const { data, loading, error } = useWidgetData<NodeStatusData>({
    integrationId,
    metric: 'nodes',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const nodes = data?.nodes || [];

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {nodes.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">No nodes connected</div>
          ) : (
            nodes.map((node) => {
              const activeWorkers = node.workers.filter(w => w.status !== 'idle').length;
              return (
                <div key={node._id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${node.nodePaused ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <span className="flex-1 truncate text-gray-200">{node.nodeName}</span>
                  <span className="text-xs text-gray-500">{activeWorkers}/{node.workers.length}</span>
                </div>
              );
            })
          )}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">No nodes connected</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {nodes.map((node) => {
              const activeWorkers = node.workers.filter(w => w.status !== 'idle').length;
              return (
                <div
                  key={node._id}
                  className={`p-2 rounded-lg border ${node.nodePaused ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/50' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${node.nodePaused ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{node.nodeName}</span>
                  </div>
                  {!hideLabels && (
                    <div className="text-xs text-gray-500">
                      Workers: {activeWorkers}/{node.workers.length} • CPU: {Math.round(node.resources.cpuPercent)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <span className="text-sm">No nodes connected</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {nodes.map((node) => {
              const activeWorkers = node.workers.filter(w => w.status !== 'idle').length;
              const totalWorkers = node.workers.length;

              return (
                <div
                  key={node._id}
                  className={`p-3 rounded-lg border ${
                    node.nodePaused
                      ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/50'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        node.nodePaused ? 'bg-yellow-500' : 'bg-green-500'
                      }`} />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {node.nodeName}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      node.nodePaused
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}>
                      {node.nodePaused ? 'Paused' : 'Active'}
                    </span>
                  </div>

                  {/* Workers */}
                  <div className="flex items-center gap-4 mb-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Workers: <span className="font-medium text-gray-900 dark:text-white">{activeWorkers}/{totalWorkers}</span>
                    </span>
                  </div>

                  {/* Resource Usage */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">CPU</span>
                        <span className="text-gray-700 dark:text-gray-300">{Math.round(node.resources.cpuPercent)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${node.resources.cpuPercent}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">RAM</span>
                        <span className="text-gray-700 dark:text-gray-300">{Math.round(node.resources.memPercent)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${node.resources.memPercent}%` }}
                        />
                      </div>
                    </div>
                    {node.resources.gpuPercent !== undefined && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500 dark:text-gray-400">GPU</span>
                          <span className="text-gray-700 dark:text-gray-300">{Math.round(node.resources.gpuPercent)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 rounded-full"
                            style={{ width: `${node.resources.gpuPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
