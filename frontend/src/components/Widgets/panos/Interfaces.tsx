import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface PAInterface {
  name: string;
  zone: string;
  ip: string;
  state: string;
  speed: string;
  duplex: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

interface InterfacesData {
  interfaces: PAInterface[];
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

export function Interfaces({ integrationId, config, widgetId }: InterfacesWidgetProps) {
  const { data, loading, error } = useWidgetData<InterfacesData>({
    integrationId,
    metric: 'interfaces',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const statusFilter = (config.status as string) || '';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <p className="text-sm">Loading interfaces...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  const filteredInterfaces = statusFilter
    ? data.interfaces.filter((i) => i.state === statusFilter)
    : data.interfaces;

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-gray-500">{data.stats.total} interfaces</span>
            <span className="text-gray-400">
              {data.stats.up} up · {data.stats.down} down
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filteredInterfaces.map((iface) => (
              <div key={iface.name} className="p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${iface.state === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-white truncate">{iface.name}</span>
                </div>
                <div className="text-xs text-gray-500">{iface.zone}</div>
                <div className="text-xs text-gray-400 mt-1">{iface.ip}</div>
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
        <div className="h-full overflow-auto">
          <div className="space-y-2">
            {filteredInterfaces.filter((i) => i.state === 'up').map((iface) => (
              <div key={iface.name} className="p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white">{iface.name}</span>
                  <span className="text-xs text-gray-500">{iface.zone}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">RX:</span>
                    <span className="text-green-400 ml-1">{formatBytes(iface.rxBytes)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">TX:</span>
                    <span className="text-blue-400 ml-1">{formatBytes(iface.txBytes)}</span>
                  </div>
                </div>
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
          <span className="text-gray-500">{data.stats.total} interfaces</span>
          <span className="text-gray-400">
            {data.stats.up} up · {data.stats.down} down
          </span>
        </div>
        <div className="space-y-1">
          {filteredInterfaces.map((iface) => (
            <div key={iface.name} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${iface.state === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{iface.name}</div>
                <div className="text-xs text-gray-500">{iface.ip}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-cyan-400">{iface.zone}</div>
                <div className="text-xs text-gray-500">{iface.speed}</div>
              </div>
            </div>
          ))}
          {filteredInterfaces.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No interfaces found</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
