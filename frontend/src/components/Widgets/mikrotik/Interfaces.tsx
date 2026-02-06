import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface InterfaceData {
  id: string;
  name: string;
  type: string;
  mtu: number;
  actualMtu: number;
  macAddress: string;
  running: boolean;
  disabled: boolean;
  comment: string | null;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDrops: number;
  txDrops: number;
  linkDowns: number;
}

interface InterfacesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'ether':
      return 'bg-blue-500/20 text-blue-400';
    case 'wlan':
      return 'bg-purple-500/20 text-purple-400';
    case 'bridge':
      return 'bg-green-500/20 text-green-400';
    case 'vlan':
      return 'bg-yellow-500/20 text-yellow-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export function Interfaces({ integrationId, config, widgetId }: InterfacesWidgetProps) {
  const { data, loading, error } = useWidgetData<{ interfaces: InterfaceData[] }>({
    integrationId,
    metric: 'interfaces',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredInterfaces = useMemo(() => {
    if (!data?.interfaces) return [];

    return data.interfaces.filter(iface => {
      if (filters.type && iface.type !== filters.type) return false;
      if (filters.status === 'running' && !iface.running) return false;
      if (filters.status === 'disabled' && !iface.disabled) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!iface.name.toLowerCase().includes(search) &&
            !iface.macAddress?.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredInterfaces.map(iface => (
              <div
                key={iface.id}
                className={`p-3 rounded-lg border ${
                  iface.running
                    ? 'border-green-500/30 bg-green-500/5'
                    : iface.disabled
                    ? 'border-gray-600 bg-gray-800/50'
                    : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-white">{iface.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(iface.type)}`}>
                    {iface.type}
                  </span>
                </div>

                <div className="text-xs text-gray-500 mb-2">
                  {iface.macAddress}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="text-green-400">
                    RX: {formatBytes(iface.rxBytes)}
                  </div>
                  <div className="text-blue-400">
                    TX: {formatBytes(iface.txBytes)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'traffic') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-2">
            {filteredInterfaces
              .filter(i => i.running)
              .sort((a, b) => (b.rxBytes + b.txBytes) - (a.rxBytes + a.txBytes))
              .map(iface => {
                const total = iface.rxBytes + iface.txBytes;
                const rxPercent = total > 0 ? (iface.rxBytes / total) * 100 : 50;

                return (
                  <div key={iface.id} className="p-2 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{iface.name}</span>
                      <span className="text-xs text-gray-400">{formatBytes(total)}</span>
                    </div>
                    <div className="h-2 flex rounded-full overflow-hidden">
                      <div className="bg-green-500" style={{ width: `${rxPercent}%` }} />
                      <div className="bg-blue-500" style={{ width: `${100 - rxPercent}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>RX: {formatBytes(iface.rxBytes)}</span>
                      <span>TX: {formatBytes(iface.txBytes)}</span>
                    </div>
                  </div>
                );
              })}
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
              <th className="text-left p-2 font-medium">Name</th>
              <th className="text-left p-2 font-medium">Type</th>
              <th className="text-left p-2 font-medium">Status</th>
              <th className="text-right p-2 font-medium">RX</th>
              <th className="text-right p-2 font-medium">TX</th>
            </tr>
          </thead>
          <tbody>
            {filteredInterfaces.map(iface => (
              <tr
                key={iface.id}
                className="border-t border-gray-700/50 hover:bg-gray-800/50"
              >
                <td className="p-2">
                  <div className="font-medium text-white">{iface.name}</div>
                  <div className="text-xs text-gray-500">{iface.macAddress}</div>
                </td>
                <td className="p-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(iface.type)}`}>
                    {iface.type}
                  </span>
                </td>
                <td className="p-2">
                  {iface.running ? (
                    <span className="text-green-400 text-xs">Running</span>
                  ) : iface.disabled ? (
                    <span className="text-gray-500 text-xs">Disabled</span>
                  ) : (
                    <span className="text-red-400 text-xs">Down</span>
                  )}
                </td>
                <td className="p-2 text-right text-green-400 text-xs">
                  {formatBytes(iface.rxBytes)}
                </td>
                <td className="p-2 text-right text-blue-400 text-xs">
                  {formatBytes(iface.txBytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
