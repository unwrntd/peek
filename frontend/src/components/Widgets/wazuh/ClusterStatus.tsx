import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface ClusterNode {
  name: string;
  ip?: string;
  type?: string;
  version?: string;
}

interface ClusterData {
  cluster: {
    enabled: boolean;
    running: boolean;
    nodes: ClusterNode[];
  };
}

interface ClusterStatusWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function ClusterStatus({ integrationId, config, widgetId }: ClusterStatusWidgetProps) {
  const { data, loading, error } = useWidgetData<ClusterData>({
    integrationId,
    metric: 'cluster',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const cluster = data?.cluster;

  if (!cluster?.enabled) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <svg className="w-12 h-12 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <div className="text-gray-400 text-sm">Cluster not enabled</div>
          <div className="text-gray-500 text-xs mt-1">Running in standalone mode</div>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="font-medium text-white">Cluster</span>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            cluster.running ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {cluster.running ? 'Running' : 'Stopped'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {cluster.nodes.map((node, idx) => (
            <div
              key={node.name || idx}
              className="bg-gray-800/50 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-white">{node.name}</span>
                {node.type && (
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    node.type === 'master' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {node.type}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {node.ip && <span>IP: {node.ip}</span>}
                {node.version && <span className="ml-3">v{node.version}</span>}
              </div>
            </div>
          ))}

          {cluster.nodes.length === 0 && (
            <div className="flex items-center justify-center h-20 text-gray-500 text-sm">
              No nodes found
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
          {cluster.nodes.length} node{cluster.nodes.length !== 1 ? 's' : ''} in cluster
        </div>
      </div>
    </BaseWidget>
  );
}
