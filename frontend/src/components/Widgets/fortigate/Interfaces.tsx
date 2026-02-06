import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface FGInterface {
  name: string;
  type: string;
  alias?: string;
  ip?: string;
  status: 'up' | 'down';
  speed: number;
  duplex: string;
  txBytes: number;
  rxBytes: number;
  txPackets: number;
  rxPackets: number;
  txErrors: number;
  rxErrors: number;
}

interface InterfacesData {
  interfaces: FGInterface[];
  stats: {
    total: number;
    up: number;
    down: number;
  };
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

export function FortiGateInterfaces({ integrationId, config, widgetId }: InterfacesWidgetProps) {
  const { data, loading, error } = useWidgetData<InterfacesData>({
    integrationId,
    metric: 'interfaces',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const typeFilter = (config.type as string) || '';
  const statusFilter = (config.status as string) || '';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Loading interfaces...</p>
        </div>
      </BaseWidget>
    );
  }

  let filteredInterfaces = data.interfaces;
  if (typeFilter) {
    filteredInterfaces = filteredInterfaces.filter(i => i.type === typeFilter);
  }
  if (statusFilter) {
    filteredInterfaces = filteredInterfaces.filter(i => i.status === statusFilter);
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-3 overflow-auto">
          <div className="grid grid-cols-2 gap-2">
            {filteredInterfaces.map((iface) => (
              <div
                key={iface.name}
                className={`p-3 rounded-lg border ${
                  iface.status === 'up'
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-gray-700/50 border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white text-sm truncate">{iface.name}</span>
                  <span className={`w-2 h-2 rounded-full ${iface.status === 'up' ? 'bg-green-400' : 'bg-gray-500'}`} />
                </div>
                {iface.ip && (
                  <p className="text-xs text-gray-400 mb-1">{iface.ip}</p>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{iface.type}</span>
                  <span>{iface.speed > 0 ? `${iface.speed} Mbps` : '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'traffic') {
    const sortedByTraffic = [...filteredInterfaces]
      .filter(i => i.status === 'up')
      .sort((a, b) => (b.txBytes + b.rxBytes) - (a.txBytes + a.rxBytes));

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-3 overflow-auto">
          <div className="flex justify-between text-xs text-gray-500 mb-2 px-2">
            <span>Interface</span>
            <span>TX / RX</span>
          </div>
          <div className="space-y-2">
            {sortedByTraffic.map((iface) => (
              <div key={iface.name} className="bg-gray-700/50 rounded p-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-white">{iface.name}</span>
                  <span className="text-xs text-gray-400">
                    {formatBytes(iface.txBytes)} / {formatBytes(iface.rxBytes)}
                  </span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-400">{iface.txPackets.toLocaleString()} pkts out</span>
                  <span className="text-blue-400">{iface.rxPackets.toLocaleString()} pkts in</span>
                  {(iface.txErrors > 0 || iface.rxErrors > 0) && (
                    <span className="text-red-400">{iface.txErrors + iface.rxErrors} errors</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full p-3 overflow-auto">
        <div className="flex justify-between items-center mb-3">
          <div className="flex gap-3 text-xs">
            <span className="text-green-400">{data.stats.up} Up</span>
            <span className="text-gray-500">{data.stats.down} Down</span>
          </div>
        </div>
        <div className="space-y-1">
          {filteredInterfaces.map((iface) => (
            <div
              key={iface.name}
              className="flex items-center justify-between py-2 px-2 hover:bg-gray-700/30 rounded transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    iface.status === 'up' ? 'bg-green-400' : 'bg-gray-500'
                  }`}
                />
                <div className="min-w-0">
                  <span className="text-sm text-white font-medium block truncate">
                    {iface.name}
                    {iface.alias && <span className="text-gray-500 ml-1">({iface.alias})</span>}
                  </span>
                  {iface.ip && (
                    <span className="text-xs text-gray-500">{iface.ip}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
                <span className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">{iface.type}</span>
                {iface.speed > 0 && <span>{iface.speed} Mbps</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BaseWidget>
  );
}
