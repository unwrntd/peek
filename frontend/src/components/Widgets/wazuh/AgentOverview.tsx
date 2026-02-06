import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface AgentSummaryData {
  summary: {
    active: number;
    disconnected: number;
    neverConnected: number;
    pending: number;
    total: number;
  };
}

interface AgentOverviewWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function AgentOverview({ integrationId, config, widgetId }: AgentOverviewWidgetProps) {
  const { data, loading, error } = useWidgetData<AgentSummaryData>({
    integrationId,
    metric: 'agent-summary',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const summary = data?.summary;
  const isMetricSize = config.metricSize === true;

  if (isMetricSize) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-400">Active</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {summary?.active || 0}
          </div>
          <div className="text-sm text-gray-400">
            of {summary?.total || 0} agents
          </div>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-4">
        <div className="text-sm font-medium text-gray-400 mb-3">Agent Status</div>

        {summary && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-gray-400">Active</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{summary.active}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-gray-400">Disconnected</span>
              </div>
              <div className="text-2xl font-bold text-red-400">{summary.disconnected}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-gray-400">Pending</span>
              </div>
              <div className="text-2xl font-bold text-yellow-400">{summary.pending}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-xs text-gray-400">Never Connected</span>
              </div>
              <div className="text-2xl font-bold text-gray-400">{summary.neverConnected}</div>
            </div>
          </div>
        )}

        {summary && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Agents</span>
              <span className="text-lg font-semibold text-white">{summary.total}</span>
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
