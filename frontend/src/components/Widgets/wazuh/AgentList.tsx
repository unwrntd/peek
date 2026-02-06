import React, { useState, useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Agent {
  id: string;
  name: string;
  ip: string;
  status: string;
  os?: {
    name?: string;
    platform?: string;
    version?: string;
  };
  version: string;
  lastKeepAlive: string;
  group?: string[];
  nodeName?: string;
}

interface AgentsData {
  agents: Agent[];
  total: number;
}

interface AgentListWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-500';
    case 'disconnected':
      return 'bg-red-500';
    case 'pending':
      return 'bg-yellow-500';
    case 'never_connected':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

function getStatusTextColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'text-green-400';
    case 'disconnected':
      return 'text-red-400';
    case 'pending':
      return 'text-yellow-400';
    case 'never_connected':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

function formatStatus(status: string): string {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function AgentList({ integrationId, config, widgetId }: AgentListWidgetProps) {
  const { data, loading, error } = useWidgetData<AgentsData>({
    integrationId,
    metric: 'agents',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const searchFilter = (config.search as string) || '';
  const statusFilter = (config.statusFilter as string) || '';

  const filteredAgents = useMemo(() => {
    if (!data?.agents) return [];

    return data.agents.filter(agent => {
      // Search filter
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const matchesSearch =
          agent.name?.toLowerCase().includes(search) ||
          agent.ip?.toLowerCase().includes(search) ||
          agent.id?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter && agent.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [data?.agents, searchFilter, statusFilter]);

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">
            {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
            {(searchFilter || statusFilter) && ` (filtered)`}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredAgents.map(agent => (
            <div
              key={agent.id}
              className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                  <span className="font-medium text-white truncate max-w-[150px]">
                    {agent.name}
                  </span>
                </div>
                <span className={`text-xs ${getStatusTextColor(agent.status)}`}>
                  {formatStatus(agent.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-gray-400">
                  IP: <span className="text-gray-300">{agent.ip || 'N/A'}</span>
                </div>
                <div className="text-gray-400">
                  ID: <span className="text-gray-300">{agent.id}</span>
                </div>
                {agent.os?.platform && (
                  <div className="text-gray-400">
                    OS: <span className="text-gray-300">{agent.os.platform}</span>
                  </div>
                )}
                {agent.version && (
                  <div className="text-gray-400">
                    Version: <span className="text-gray-300">{agent.version}</span>
                  </div>
                )}
                {agent.group && agent.group.length > 0 && (
                  <div className="col-span-2 text-gray-400">
                    Groups: <span className="text-gray-300">{agent.group.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredAgents.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              {searchFilter || statusFilter ? 'No agents match filters' : 'No agents found'}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
