import React, { useMemo, useState } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { formatBytes } from '../../../utils/formatting';

interface VPNProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface VPNTunnel {
  name: string;
  type: 'openvpn' | 'ipsec' | 'wireguard';
  mode?: string;
  status: 'up' | 'down' | 'connecting';
  remoteAddress?: string;
  localAddress?: string;
  bytesIn?: number;
  bytesOut?: number;
  connectedSince?: string;
  clients?: number;
}

interface VPNData {
  tunnels: VPNTunnel[];
  stats: {
    total: number;
    up: number;
    down: number;
    openvpn: number;
    ipsec: number;
    wireguard: number;
  };
}

export function VPN({ integrationId, config, widgetId }: VPNProps) {
  const { data, loading, error } = useWidgetData<VPNData>({
    integrationId,
    metric: 'vpn',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const vpnTypeFilter = config.vpnType as string;
  const statusFilter = config.status as string;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'list';

  const [activeTab, setActiveTab] = useState<'openvpn' | 'ipsec' | 'wireguard'>('openvpn');

  const filteredTunnels = useMemo(() => {
    let tunnels = data?.tunnels || [];

    if (vpnTypeFilter) {
      tunnels = tunnels.filter(t => t.type === vpnTypeFilter);
    }

    if (statusFilter === 'up') {
      tunnels = tunnels.filter(t => t.status === 'up');
    } else if (statusFilter === 'down') {
      tunnels = tunnels.filter(t => t.status !== 'up');
    }

    return tunnels;
  }, [data?.tunnels, vpnTypeFilter, statusFilter]);

  const tunnelsByType = useMemo(() => {
    const tunnels = data?.tunnels || [];
    return {
      openvpn: tunnels.filter(t => t.type === 'openvpn'),
      ipsec: tunnels.filter(t => t.type === 'ipsec'),
      wireguard: tunnels.filter(t => t.type === 'wireguard'),
    };
  }, [data?.tunnels]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'up':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'connecting':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'openvpn':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'ipsec':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'wireguard':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const renderListView = () => (
    <div className="space-y-2">
      {filteredTunnels.map((tunnel, idx) => (
        <div key={`${tunnel.type}-${tunnel.name}-${idx}`} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(tunnel.status)}`} />
            <div className="text-gray-500 dark:text-gray-400">
              {getTypeIcon(tunnel.type)}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">
                {tunnel.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {tunnel.type.toUpperCase()}{tunnel.mode ? ` (${tunnel.mode})` : ''}
              </div>
            </div>
          </div>
          <div className="text-right text-xs">
            {tunnel.status === 'up' && tunnel.bytesIn !== undefined && (
              <div className="text-gray-500 dark:text-gray-400">
                {formatBytes(tunnel.bytesIn)} / {formatBytes(tunnel.bytesOut || 0)}
              </div>
            )}
            {tunnel.clients !== undefined && tunnel.clients > 0 && (
              <div className="text-green-600 dark:text-green-400">
                {tunnel.clients} client{tunnel.clients !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCardsView = () => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {filteredTunnels.map((tunnel, idx) => (
        <div key={`${tunnel.type}-${tunnel.name}-${idx}`} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="text-gray-500 dark:text-gray-400">
                {getTypeIcon(tunnel.type)}
              </div>
              <span className="font-medium text-gray-900 dark:text-white">
                {tunnel.name}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(tunnel.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(tunnel.status)}`} />
              {tunnel.status}
            </span>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Type</span>
              <span className="text-xs text-gray-700 dark:text-gray-300">
                {tunnel.type.toUpperCase()}{tunnel.mode ? ` (${tunnel.mode})` : ''}
              </span>
            </div>
            {tunnel.remoteAddress && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Remote</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{tunnel.remoteAddress}</span>
              </div>
            )}
            {tunnel.status === 'up' && tunnel.bytesIn !== undefined && (
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-500 dark:text-gray-400">Traffic</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {formatBytes(tunnel.bytesIn)} / {formatBytes(tunnel.bytesOut || 0)}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTabsView = () => (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 mb-3 border-b border-gray-200 dark:border-gray-700">
        {(['openvpn', 'ipsec', 'wireguard'] as const).map(type => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeTab === type
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {type.toUpperCase()} ({tunnelsByType[type].length})
          </button>
        ))}
      </div>

      <div className="space-y-2 flex-1 overflow-auto">
        {tunnelsByType[activeTab].length === 0 ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
            No {activeTab.toUpperCase()} tunnels configured
          </div>
        ) : (
          tunnelsByType[activeTab].map((tunnel, idx) => (
            <div key={`${tunnel.name}-${idx}`} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(tunnel.status)}`} />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {tunnel.name}
                  </div>
                  {tunnel.remoteAddress && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {tunnel.remoteAddress}
                    </div>
                  )}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(tunnel.status)}`}>
                {tunnel.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (!data?.tunnels?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-sm">No VPN tunnels configured</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="flex flex-col h-full">
          {!hideLabels && visualizationType !== 'tabs' && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                VPN Tunnels
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data.stats.up}/{data.stats.total} up
              </span>
            </div>
          )}
          {visualizationType === 'cards' ? renderCardsView() :
           visualizationType === 'tabs' ? renderTabsView() : renderListView()}
        </div>
      )}
    </BaseWidget>
  );
}
