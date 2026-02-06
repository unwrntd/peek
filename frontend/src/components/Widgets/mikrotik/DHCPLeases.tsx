import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';

interface DHCPLease {
  id: string;
  address: string;
  macAddress: string;
  clientId: string | null;
  hostName: string | null;
  server: string;
  status: string;
  lastSeen: string | null;
  expiresAfter: string | null;
  activeAddress: string | null;
  activeMacAddress: string | null;
  dynamic: boolean;
  disabled: boolean;
  comment: string | null;
}

interface DHCPLeasesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'bound':
      return 'bg-green-500/20 text-green-400';
    case 'waiting':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'offered':
      return 'bg-blue-500/20 text-blue-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export function DHCPLeases({ integrationId, config, widgetId }: DHCPLeasesWidgetProps) {
  const { rIP, rMAC, rHost } = useRedact();
  const { data, loading, error } = useWidgetData<{ dhcpLeases: DHCPLease[]; message?: string }>({
    integrationId,
    metric: 'dhcp-leases',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredLeases = useMemo(() => {
    if (!data?.dhcpLeases) return [];

    return data.dhcpLeases.filter(lease => {
      if (filters.status && lease.status !== filters.status) return false;
      if (filters.type === 'dynamic' && !lease.dynamic) return false;
      if (filters.type === 'static' && lease.dynamic) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!lease.address.toLowerCase().includes(search) &&
            !lease.macAddress.toLowerCase().includes(search) &&
            !(lease.hostName?.toLowerCase().includes(search))) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  if (!data?.dhcpLeases?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <p className="text-sm">{data?.message || 'No DHCP leases found'}</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredLeases.map(lease => (
              <div
                key={lease.id}
                className={`p-3 rounded-lg border ${
                  lease.status === 'bound'
                    ? 'border-green-500/30'
                    : 'border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-medium text-white">{rIP(lease.address)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(lease.status)}`}>
                    {lease.status}
                  </span>
                </div>

                {lease.hostName && (
                  <p className="text-sm font-medium text-gray-300 mb-1">{rHost(lease.hostName)}</p>
                )}

                <p className="text-xs font-mono text-gray-500 mb-2">{rMAC(lease.macAddress)}</p>

                <div className="flex items-center justify-between text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${
                    lease.dynamic ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {lease.dynamic ? 'Dynamic' : 'Static'}
                  </span>
                  {lease.expiresAfter && (
                    <span className="text-gray-400">Expires: {lease.expiresAfter}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-1">
            {filteredLeases.map(lease => (
              <div
                key={lease.id}
                className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    lease.status === 'bound' ? 'bg-green-400' : 'bg-yellow-400'
                  }`} />
                  <span className="font-mono text-white">{rIP(lease.address)}</span>
                  {lease.hostName && (
                    <span className="text-gray-400">({rHost(lease.hostName)})</span>
                  )}
                </div>
                <span className="font-mono text-xs text-gray-500">{rMAC(lease.macAddress)}</span>
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
              <th className="text-left p-2 font-medium">IP Address</th>
              <th className="text-left p-2 font-medium">Hostname</th>
              <th className="text-left p-2 font-medium">MAC Address</th>
              <th className="text-center p-2 font-medium">Status</th>
              <th className="text-left p-2 font-medium">Expires</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeases.map(lease => (
              <tr key={lease.id} className="border-t border-gray-700/50 hover:bg-gray-800/50">
                <td className="p-2">
                  <div className="font-mono text-white">{rIP(lease.address)}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    lease.dynamic ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {lease.dynamic ? 'Dynamic' : 'Static'}
                  </span>
                </td>
                <td className="p-2 text-gray-300">
                  {rHost(lease.hostName) || <span className="text-gray-500">-</span>}
                </td>
                <td className="p-2 font-mono text-xs text-gray-400">{rMAC(lease.macAddress)}</td>
                <td className="p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(lease.status)}`}>
                    {lease.status}
                  </span>
                </td>
                <td className="p-2 text-xs text-gray-400">{lease.expiresAfter || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
