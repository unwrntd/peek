import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface FirewallRule {
  id: string;
  chain: string;
  action: string;
  protocol: string | null;
  srcAddress: string | null;
  dstAddress: string | null;
  srcPort: string | null;
  dstPort: string | null;
  inInterface: string | null;
  outInterface: string | null;
  bytes: number;
  packets: number;
  disabled: boolean;
  dynamic: boolean;
  comment: string | null;
}

interface FirewallWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getActionColor(action: string): string {
  switch (action) {
    case 'accept':
      return 'bg-green-500/20 text-green-400';
    case 'drop':
      return 'bg-red-500/20 text-red-400';
    case 'reject':
      return 'bg-orange-500/20 text-orange-400';
    default:
      return 'bg-blue-500/20 text-blue-400';
  }
}

function getChainColor(chain: string): string {
  switch (chain) {
    case 'input':
      return 'bg-purple-500/20 text-purple-400';
    case 'forward':
      return 'bg-blue-500/20 text-blue-400';
    case 'output':
      return 'bg-cyan-500/20 text-cyan-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export function Firewall({ integrationId, config, widgetId }: FirewallWidgetProps) {
  const { data, loading, error } = useWidgetData<{ firewallRules: FirewallRule[] }>({
    integrationId,
    metric: 'firewall',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredRules = useMemo(() => {
    if (!data?.firewallRules) return [];

    return data.firewallRules.filter(rule => {
      if (filters.chain && rule.chain !== filters.chain) return false;
      if (filters.action && rule.action !== filters.action) return false;
      return true;
    });
  }, [data, filters]);

  if (!data?.firewallRules?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm">No firewall rules found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    const stats = useMemo(() => {
      const byAction: Record<string, { count: number; packets: number }> = {};
      filteredRules.forEach(rule => {
        if (!byAction[rule.action]) {
          byAction[rule.action] = { count: 0, packets: 0 };
        }
        byAction[rule.action].count++;
        byAction[rule.action].packets += rule.packets;
      });
      return byAction;
    }, [filteredRules]);

    const totalPackets = Object.values(stats).reduce((sum, s) => sum + s.packets, 0);

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-4">
          <div className="space-y-4">
            {Object.entries(stats).map(([action, stat]) => {
              const percentage = totalPackets > 0 ? (stat.packets / totalPackets) * 100 : 0;

              return (
                <div key={action} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${getActionColor(action)}`}>
                        {action}
                      </span>
                      <span className="text-xs text-gray-500">({stat.count} rules)</span>
                    </div>
                    <span className="font-medium text-white">{formatNumber(stat.packets)} pkts</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${action === 'accept' ? 'bg-green-500' : action === 'drop' ? 'bg-red-500' : 'bg-orange-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Total: {filteredRules.length} rules, {formatNumber(totalPackets)} packets
            </p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-2">
            {filteredRules.map((rule, index) => (
              <div
                key={rule.id}
                className={`p-3 rounded-lg border border-gray-700 ${rule.disabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">#{index + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getChainColor(rule.chain)}`}>
                      {rule.chain}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getActionColor(rule.action)}`}>
                      {rule.action}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{formatNumber(rule.packets)} pkts</div>
                </div>

                <div className="text-xs space-y-1 text-gray-500">
                  {rule.protocol && <p>Protocol: {rule.protocol}</p>}
                  {rule.srcAddress && <p>Src: {rule.srcAddress}{rule.srcPort ? `:${rule.srcPort}` : ''}</p>}
                  {rule.dstAddress && <p>Dst: {rule.dstAddress}{rule.dstPort ? `:${rule.dstPort}` : ''}</p>}
                </div>

                {rule.comment && (
                  <p className="text-xs text-gray-500 mt-2 italic">{rule.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default table view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left p-2 font-medium">#</th>
              <th className="text-left p-2 font-medium">Chain</th>
              <th className="text-left p-2 font-medium">Action</th>
              <th className="text-left p-2 font-medium">Protocol</th>
              <th className="text-left p-2 font-medium">Source</th>
              <th className="text-left p-2 font-medium">Destination</th>
              <th className="text-right p-2 font-medium">Packets</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule, index) => (
              <tr
                key={rule.id}
                className={`border-t border-gray-700/50 hover:bg-gray-800/50 ${rule.disabled ? 'opacity-50' : ''}`}
              >
                <td className="p-2 text-gray-500">{index + 1}</td>
                <td className="p-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getChainColor(rule.chain)}`}>
                    {rule.chain}
                  </span>
                </td>
                <td className="p-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getActionColor(rule.action)}`}>
                    {rule.action}
                  </span>
                </td>
                <td className="p-2 text-xs text-gray-400">{rule.protocol || 'any'}</td>
                <td className="p-2 text-xs font-mono text-gray-400">
                  {rule.srcAddress || 'any'}{rule.srcPort && `:${rule.srcPort}`}
                </td>
                <td className="p-2 text-xs font-mono text-gray-400">
                  {rule.dstAddress || 'any'}{rule.dstPort && `:${rule.dstPort}`}
                </td>
                <td className="p-2 text-right text-xs text-white">{formatNumber(rule.packets)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
