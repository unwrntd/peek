import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface DetectedDevice {
  mac: string;
  ip?: string;
  hostname?: string;
  os?: string;
  type?: string;
  interface: string;
  lastSeen: number;
  isOnline: boolean;
}

interface DevicesData {
  devices: DetectedDevice[];
  stats: {
    total: number;
    online: number;
    offline: number;
  };
}

interface DevicesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function FortiGateDevices({ integrationId, config, widgetId }: DevicesWidgetProps) {
  const { data, loading, error } = useWidgetData<DevicesData>({
    integrationId,
    metric: 'devices',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'grid';
  const statusFilter = (config.status as string) || '';

  const formatLastSeen = (timestamp: number) => {
    const diff = Date.now() / 1000 - timestamp;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getDeviceIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'computer':
      case 'laptop':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'phone':
      case 'mobile':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'printer':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
    }
  };

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Loading devices...</p>
        </div>
      </BaseWidget>
    );
  }

  let filteredDevices = data.devices;
  if (statusFilter === 'online') {
    filteredDevices = filteredDevices.filter(d => d.isOnline);
  } else if (statusFilter === 'offline') {
    filteredDevices = filteredDevices.filter(d => !d.isOnline);
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-4 flex flex-col justify-center">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-white">{data.stats.total}</div>
              <div className="text-xs text-gray-500">Total Devices</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{data.stats.online}</div>
              <div className="text-xs text-gray-500">Online</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-400">{data.stats.offline}</div>
              <div className="text-xs text-gray-500">Offline</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-2">By Interface</div>
            <div className="space-y-1">
              {Object.entries(
                data.devices.reduce((acc, d) => {
                  acc[d.interface] = (acc[d.interface] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([iface, count]) => (
                  <div key={iface} className="flex justify-between text-sm">
                    <span className="text-gray-400">{iface}</span>
                    <span className="text-white">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="p-3">
            <div className="flex justify-between items-center mb-3 text-xs">
              <span className="text-gray-400">{filteredDevices.length} devices</span>
              <div className="flex gap-2">
                <span className="text-green-400">{data.stats.online} online</span>
                <span className="text-gray-500">{data.stats.offline} offline</span>
              </div>
            </div>

            <div className="space-y-1">
              {filteredDevices.map((device) => (
                <div
                  key={device.mac}
                  className="flex items-center justify-between py-2 px-2 hover:bg-gray-700/30 rounded transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        device.isOnline ? 'bg-green-400' : 'bg-gray-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="text-sm text-white block truncate">
                        {device.hostname || device.ip || device.mac}
                      </span>
                      <span className="text-xs text-gray-500">
                        {device.ip && device.hostname && device.ip}
                        {!device.hostname && device.mac}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {device.interface}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default grid visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full p-3 overflow-auto">
        <div className="flex justify-between items-center mb-3 text-xs">
          <span className="text-gray-400">{filteredDevices.length} devices</span>
          <div className="flex gap-2">
            <span className="text-green-400">{data.stats.online} online</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {filteredDevices.slice(0, 20).map((device) => (
            <div
              key={device.mac}
              className={`p-3 rounded-lg border ${
                device.isOnline
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-gray-700/50 border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={device.isOnline ? 'text-green-400' : 'text-gray-500'}>
                  {getDeviceIcon(device.type)}
                </span>
                <span className="font-medium text-white text-sm truncate">
                  {device.hostname || device.ip || 'Unknown'}
                </span>
              </div>
              {device.ip && device.hostname && (
                <p className="text-xs text-gray-400 mb-1">{device.ip}</p>
              )}
              <div className="flex justify-between text-xs text-gray-500">
                <span>{device.interface}</span>
                <span>{formatLastSeen(device.lastSeen)}</span>
              </div>
            </div>
          ))}
        </div>
        {filteredDevices.length > 20 && (
          <div className="text-center text-xs text-gray-500 mt-3">
            +{filteredDevices.length - 20} more devices
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
