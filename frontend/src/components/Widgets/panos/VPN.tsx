import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface IPSecTunnel {
  name: string;
  gateway: string;
  state: string;
  localProxy: string;
  remoteProxy: string;
  encryptionAlgo: string;
  lifetime: number;
}

interface VPNGateway {
  name: string;
  peerAddress: string;
  localAddress: string;
  state: string;
}

interface VPNData {
  ipsecTunnels: IPSecTunnel[];
  gateways: VPNGateway[];
  stats: {
    totalTunnels: number;
    activeTunnels: number;
    totalGateways: number;
    activeGateways: number;
  };
}

interface VPNWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function VPN({ integrationId, config, widgetId }: VPNWidgetProps) {
  const { data, loading, error } = useWidgetData<VPNData>({
    integrationId,
    metric: 'vpn',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm">Loading VPN...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'summary') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <div className="p-3 bg-gray-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">{data.stats.activeTunnels}</div>
              <div className="text-xs text-gray-500">Active Tunnels</div>
              <div className="text-xs text-gray-600">{data.stats.totalTunnels} total</div>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-400">{data.stats.activeGateways}</div>
              <div className="text-xs text-gray-500">Active Gateways</div>
              <div className="text-xs text-gray-600">{data.stats.totalGateways} total</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="text-xs text-gray-500 mb-2 px-1">
            {data.stats.activeTunnels}/{data.stats.totalTunnels} tunnels active
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.ipsecTunnels.map((tunnel) => (
              <div key={tunnel.name} className="p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${tunnel.state === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-white truncate">{tunnel.name}</span>
                </div>
                <div className="text-xs text-gray-500 truncate">{tunnel.gateway}</div>
                <div className="text-xs text-gray-400 mt-1">{tunnel.encryptionAlgo}</div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <span className="text-gray-500">{data.stats.totalTunnels} tunnels</span>
          <span className="text-gray-400">{data.stats.activeTunnels} active</span>
        </div>

        {data.ipsecTunnels.length > 0 && (
          <div className="space-y-1 mb-3">
            <div className="text-xs text-gray-500 px-1">IPsec Tunnels</div>
            {data.ipsecTunnels.map((tunnel) => (
              <div key={tunnel.name} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tunnel.state === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{tunnel.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {tunnel.localProxy} → {tunnel.remoteProxy}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  tunnel.state === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                }`}>
                  {tunnel.state}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.gateways.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-gray-500 px-1">Gateways</div>
            {data.gateways.map((gw) => (
              <div key={gw.name} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${gw.state === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{gw.name}</div>
                  <div className="text-xs text-gray-500 truncate">{gw.peerAddress}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.ipsecTunnels.length === 0 && data.gateways.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">No VPN configured</p>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
