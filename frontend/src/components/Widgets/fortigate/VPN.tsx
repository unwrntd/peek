import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { formatBytes, formatUptime } from '../../../utils/formatting';

interface IPSecTunnel {
  name: string;
  phase1Name: string;
  status: 'up' | 'down';
  proxyId: {
    localSubnet: string;
    remoteSubnet: string;
    status: string;
  }[];
  inBytes: number;
  outBytes: number;
  uptime: number;
}

interface SSLVPNUser {
  username: string;
  remoteHost: string;
  tunnelIp: string;
  loginTime: number;
  duration: number;
}

interface VPNData {
  ipsec: IPSecTunnel[];
  sslvpn: {
    users: SSLVPNUser[];
    stats: {
      maxUsers: number;
      currentUsers: number;
      totalTunnels: number;
    };
  };
  stats: {
    ipsecTunnels: number;
    ipsecUp: number;
    sslvpnUsers: number;
  };
}

interface VPNWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function FortiGateVPN({ integrationId, config, widgetId }: VPNWidgetProps) {
  const { data, loading, error } = useWidgetData<VPNData>({
    integrationId,
    metric: 'vpn',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Loading VPN status...</p>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-3 overflow-auto">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{data.stats.ipsecUp}</div>
              <div className="text-xs text-gray-400">IPsec Up</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-400">{data.stats.ipsecTunnels - data.stats.ipsecUp}</div>
              <div className="text-xs text-gray-400">IPsec Down</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{data.stats.sslvpnUsers}</div>
              <div className="text-xs text-gray-400">SSL Users</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {data.ipsec.map((tunnel) => (
              <div
                key={tunnel.name}
                className={`p-3 rounded-lg border ${
                  tunnel.status === 'up'
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-gray-700/50 border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white text-sm truncate">{tunnel.name}</span>
                  <span className={`w-2 h-2 rounded-full ${tunnel.status === 'up' ? 'bg-green-400' : 'bg-gray-500'}`} />
                </div>
                {tunnel.proxyId.length > 0 && (
                  <p className="text-xs text-gray-400 truncate">
                    {tunnel.proxyId[0].localSubnet} &harr; {tunnel.proxyId[0].remoteSubnet}
                  </p>
                )}
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>In: {formatBytes(tunnel.inBytes)}</span>
                  <span>Out: {formatBytes(tunnel.outBytes)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'users') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-3 overflow-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-white">SSL VPN Users</h3>
            <span className="text-xs text-blue-400">{data.stats.sslvpnUsers} connected</span>
          </div>

          {data.sslvpn.users.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No SSL VPN users connected
            </div>
          ) : (
            <div className="space-y-2">
              {data.sslvpn.users.map((user, index) => (
                <div key={`${user.username}-${index}`} className="bg-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">{user.username}</span>
                    <span className="text-xs text-green-400">
                      {formatUptime(user.duration)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>From: {user.remoteHost}</span>
                    {user.tunnelIp && <span>Tunnel: {user.tunnelIp}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default list visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full p-3 overflow-auto">
        <div className="flex justify-between items-center mb-3 text-xs">
          <span className="text-gray-400">
            IPsec: <span className="text-green-400">{data.stats.ipsecUp}</span> / {data.stats.ipsecTunnels}
          </span>
          <span className="text-gray-400">
            SSL VPN: <span className="text-blue-400">{data.stats.sslvpnUsers}</span> users
          </span>
        </div>

        <div className="space-y-1">
          {data.ipsec.map((tunnel) => (
            <div
              key={tunnel.name}
              className="flex items-center justify-between py-2 px-2 hover:bg-gray-700/30 rounded transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    tunnel.status === 'up' ? 'bg-green-400' : 'bg-gray-500'
                  }`}
                />
                <div className="min-w-0">
                  <span className="text-sm text-white font-medium block truncate">{tunnel.name}</span>
                  {tunnel.proxyId.length > 0 && (
                    <span className="text-xs text-gray-500 truncate block">
                      {tunnel.proxyId[0].localSubnet} &harr; {tunnel.proxyId[0].remoteSubnet}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
                <span className="text-green-400">{formatBytes(tunnel.inBytes)}</span>
                <span className="text-blue-400">{formatBytes(tunnel.outBytes)}</span>
              </div>
            </div>
          ))}
        </div>

        {data.sslvpn.users.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-2">SSL VPN Users</div>
            {data.sslvpn.users.slice(0, 5).map((user, index) => (
              <div key={`${user.username}-${index}`} className="flex justify-between text-xs py-1">
                <span className="text-white">{user.username}</span>
                <span className="text-gray-500">{user.remoteHost}</span>
              </div>
            ))}
            {data.sslvpn.users.length > 5 && (
              <div className="text-xs text-gray-500 mt-1">+{data.sslvpn.users.length - 5} more</div>
            )}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
