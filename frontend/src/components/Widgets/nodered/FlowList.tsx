import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface NodeRedFlow {
  id: string;
  label: string;
  disabled: boolean;
  info: string;
  nodeCount: number;
}

interface FlowListData {
  flows: NodeRedFlow[];
}

interface FlowListWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function FlowIcon({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export function FlowList({ integrationId, config, widgetId }: FlowListWidgetProps) {
  const { data, loading, error } = useWidgetData<FlowListData>({
    integrationId,
    metric: 'flows',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const flows = data?.flows || [];
  const search = (config.search as string) || '';
  const showDisabled = config.showDisabled !== false;
  const showNodeCount = config.showNodeCount !== false;

  // Filter flows
  let filteredFlows = flows;

  if (!showDisabled) {
    filteredFlows = filteredFlows.filter(f => !f.disabled);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredFlows = filteredFlows.filter(f =>
      f.label.toLowerCase().includes(searchLower) ||
      f.info?.toLowerCase().includes(searchLower)
    );
  }

  // Sort: enabled first, then alphabetically
  filteredFlows.sort((a, b) => {
    if (a.disabled !== b.disabled) {
      return a.disabled ? 1 : -1;
    }
    return a.label.localeCompare(b.label);
  });

  const enabledCount = flows.filter(f => !f.disabled).length;
  const totalNodes = flows.reduce((sum, f) => sum + f.nodeCount, 0);

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary header */}
        <div className="px-3 py-2 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {enabledCount} of {flows.length} flows enabled
            </span>
            <span className="text-sm text-gray-500">
              {totalNodes} total nodes
            </span>
          </div>
        </div>

        {/* Flow list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-800/30">
            {filteredFlows.map((flow) => (
              <div
                key={flow.id}
                className={`px-3 py-2 hover:bg-gray-800/20 ${flow.disabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FlowIcon disabled={flow.disabled} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-200 truncate">
                        {flow.label}
                      </div>
                      {flow.info && (
                        <div className="text-xs text-gray-500 truncate">
                          {flow.info}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {showNodeCount && (
                      <span className="text-xs text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
                        {flow.nodeCount} nodes
                      </span>
                    )}
                    {flow.disabled && (
                      <span className="text-xs text-yellow-500/70">Disabled</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredFlows.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                {search ? 'No flows match your search' : 'No flows found'}
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
