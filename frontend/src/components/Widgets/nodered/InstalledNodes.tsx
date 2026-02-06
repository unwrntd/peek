import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface NodeRedNode {
  module: string;
  version: string;
  local: boolean;
  types: string[];
  enabled: boolean;
}

interface InstalledNodesData {
  nodes: NodeRedNode[];
}

interface InstalledNodesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function ModuleIcon({ local, enabled }: { local: boolean; enabled: boolean }) {
  if (!enabled) {
    return (
      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    );
  }
  if (local) {
    return (
      <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

export function InstalledNodes({ integrationId, config, widgetId }: InstalledNodesWidgetProps) {
  const { data, loading, error } = useWidgetData<InstalledNodesData>({
    integrationId,
    metric: 'nodes',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const nodes = data?.nodes || [];
  const search = (config.search as string) || '';
  const showVersion = config.showVersion !== false;
  const showTypeCount = config.showTypeCount !== false;

  // Filter nodes
  let filteredNodes = nodes;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredNodes = filteredNodes.filter(n =>
      n.module.toLowerCase().includes(searchLower) ||
      n.types.some(t => t.toLowerCase().includes(searchLower))
    );
  }

  // Count totals
  const enabledCount = nodes.filter(n => n.enabled).length;
  const totalTypes = nodes.reduce((sum, n) => sum + n.types.length, 0);
  const localCount = nodes.filter(n => n.local).length;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary header */}
        <div className="px-3 py-2 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {enabledCount} modules ({totalTypes} node types)
            </span>
            {localCount > 0 && (
              <span className="text-xs text-yellow-400/70">
                {localCount} local
              </span>
            )}
          </div>
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-800/30">
            {filteredNodes.map((node) => (
              <div
                key={node.module}
                className={`px-3 py-2 hover:bg-gray-800/20 ${!node.enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ModuleIcon local={node.local} enabled={node.enabled} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-200 truncate">
                        {node.module}
                      </div>
                      {showVersion && node.version && (
                        <div className="text-xs text-gray-500">
                          v{node.version}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {showTypeCount && node.types.length > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
                        {node.types.length} {node.types.length === 1 ? 'type' : 'types'}
                      </span>
                    )}
                    {node.local && (
                      <span className="text-xs text-yellow-500/70">Local</span>
                    )}
                    {!node.enabled && (
                      <span className="text-xs text-red-400/70">Disabled</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredNodes.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                {search ? 'No modules match your search' : 'No modules found'}
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
