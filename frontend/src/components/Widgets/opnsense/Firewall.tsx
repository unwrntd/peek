import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface FirewallProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface OPNsenseFirewallRule {
  id: string;
  interface: string;
  type: 'pass' | 'block' | 'reject';
  direction: 'in' | 'out';
  protocol: string;
  source: string;
  destination: string;
  destinationPort?: string;
  description: string;
  enabled: boolean;
  log: boolean;
  evaluations?: number;
  packets?: number;
  bytes?: number;
}

interface FirewallData {
  rules: OPNsenseFirewallRule[];
  stats: {
    total: number;
    enabled: number;
    disabled: number;
    pass: number;
    block: number;
    reject: number;
  };
}

export function Firewall({ integrationId, config, widgetId }: FirewallProps) {
  const { data, loading, error } = useWidgetData<FirewallData>({
    integrationId,
    metric: 'firewall',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const interfaceFilter = config.interface as string;
  const actionFilter = config.action as string;
  const enabledFilter = config.enabled as string;
  const maxItems = (config.maxItems as number) || 50;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'table';

  const filteredRules = useMemo(() => {
    let rules = data?.rules || [];

    if (interfaceFilter) {
      rules = rules.filter(r => r.interface.toLowerCase().includes(interfaceFilter.toLowerCase()));
    }

    if (actionFilter) {
      rules = rules.filter(r => r.type === actionFilter);
    }

    if (enabledFilter === 'true') {
      rules = rules.filter(r => r.enabled);
    } else if (enabledFilter === 'false') {
      rules = rules.filter(r => !r.enabled);
    }

    return rules.slice(0, maxItems);
  }, [data?.rules, interfaceFilter, actionFilter, enabledFilter, maxItems]);

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'pass':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'block':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'reject':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    }
  };

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Action</th>
            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Interface</th>
            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Proto</th>
            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Source</th>
            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Destination</th>
            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Description</th>
          </tr>
        </thead>
        <tbody>
          {filteredRules.map((rule, idx) => (
            <tr
              key={rule.id || idx}
              className={`border-b border-gray-100 dark:border-gray-800 ${!rule.enabled ? 'opacity-50' : ''}`}
            >
              <td className="py-2 px-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getActionBadge(rule.type)}`}>
                  {rule.type}
                </span>
              </td>
              <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{rule.interface}</td>
              <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{rule.protocol}</td>
              <td className="py-2 px-2 font-mono text-gray-700 dark:text-gray-300 truncate max-w-[100px]" title={rule.source}>
                {rule.source}
              </td>
              <td className="py-2 px-2 font-mono text-gray-700 dark:text-gray-300 truncate max-w-[100px]" title={`${rule.destination}${rule.destinationPort ? ':' + rule.destinationPort : ''}`}>
                {rule.destination}{rule.destinationPort ? `:${rule.destinationPort}` : ''}
              </td>
              <td className="py-2 px-2 text-gray-500 dark:text-gray-400 truncate max-w-[150px]" title={rule.description}>
                {rule.description || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      {filteredRules.map((rule, idx) => (
        <div
          key={rule.id || idx}
          className={`p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg ${!rule.enabled ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getActionBadge(rule.type)}`}>
                {rule.type}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{rule.interface}</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{rule.protocol}</span>
          </div>
          <div className="text-xs font-mono text-gray-700 dark:text-gray-300">
            {rule.source} → {rule.destination}{rule.destinationPort ? `:${rule.destinationPort}` : ''}
          </div>
          {rule.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {rule.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderStatsView = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data?.stats.pass || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Pass</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {data?.stats.block || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Block</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {data?.stats.reject || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Reject</div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Total Rules</span>
          <span className="font-medium text-gray-900 dark:text-white">{data?.stats.total || 0}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-gray-500 dark:text-gray-400">Enabled</span>
          <span className="font-medium text-green-600 dark:text-green-400">{data?.stats.enabled || 0}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-gray-500 dark:text-gray-400">Disabled</span>
          <span className="font-medium text-gray-500 dark:text-gray-400">{data?.stats.disabled || 0}</span>
        </div>
      </div>
    </div>
  );

  if (!data?.rules?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm">No firewall rules found</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="flex flex-col h-full">
          {!hideLabels && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Firewall Rules
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {filteredRules.length} of {data.stats.total}
              </span>
            </div>
          )}
          {visualizationType === 'list' ? renderListView() :
           visualizationType === 'stats' ? renderStatsView() : renderTableView()}
        </div>
      )}
    </BaseWidget>
  );
}
