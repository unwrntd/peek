import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { BaseWidget } from '../BaseWidget';
import { RingDevice } from '../../../types';

interface DeviceListData {
  devices: RingDevice[];
  total: number;
  online: number;
  offline: number;
}

interface DeviceListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getDeviceIcon(deviceType: string): React.ReactNode {
  if (deviceType.includes('doorbell')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function getSignalIcon(category: string): { color: string; bars: number } {
  switch (category) {
    case 'excellent': return { color: 'text-green-500', bars: 4 };
    case 'good': return { color: 'text-green-400', bars: 3 };
    case 'fair': return { color: 'text-yellow-500', bars: 2 };
    default: return { color: 'text-red-500', bars: 1 };
  }
}

export function DeviceList({ integrationId, config, widgetId }: DeviceListProps) {
  const { rHost } = useRedact();
  const { data, loading, error } = useWidgetData<DeviceListData>({
    integrationId,
    metric: 'devices',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const devices = data?.devices || [];
  const deviceType = (config.deviceType as string) || '';
  const showBattery = config.showBattery !== false;
  const showWifi = config.showWifi !== false;
  const showLastEvent = config.showLastEvent !== false;

  // Filter devices
  let filteredDevices = devices;
  if (deviceType === 'doorbell') {
    filteredDevices = devices.filter(d => d.deviceType.includes('doorbell'));
  } else if (deviceType === 'camera') {
    filteredDevices = devices.filter(d => !d.deviceType.includes('doorbell'));
  }

  if (filteredDevices.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>No devices found</span>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {filteredDevices.map((device) => {
          const signal = getSignalIcon(device.wifiSignalCategory);
          return (
            <div
              key={device.id}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={device.isOnline ? 'text-green-500' : 'text-gray-400'}>
                    {getDeviceIcon(device.deviceType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {rHost(device.name)}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{device.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {showBattery && device.batteryLife !== null && (
                    <div className={`flex items-center gap-1 text-xs ${device.batteryLife < 20 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2zm-1 10H8v-2h8v2zm0-4H8V9h8v2zm4-3h-1V5h-1V3H6v2H5v3H4v6h1v3h1v2h12v-2h1v-3h1V8z" />
                      </svg>
                      <span>{device.batteryLife}%</span>
                    </div>
                  )}
                  {showWifi && (
                    <div className={`flex items-center ${signal.color}`}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 18c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0-4c2.2 0 4 1.8 4 4h-2c0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.2 1.8-4 4-4zm0-4c3.3 0 6 2.7 6 6h-2c0-2.2-1.8-4-4-4s-4 1.8-4 4H6c0-3.3 2.7-6 6-6zm0-4c4.4 0 8 3.6 8 8h-2c0-3.3-2.7-6-6-6s-6 2.7-6 6H4c0-4.4 3.6-8 8-8z" />
                      </svg>
                    </div>
                  )}
                  <span className={`px-2 py-0.5 text-xs rounded-full ${device.isOnline ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                    {device.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              {showLastEvent && (device.lastMotion || device.lastDing) && (
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {device.lastMotion && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Motion: {formatTimestamp(device.lastMotion)}
                    </span>
                  )}
                  {device.lastDing && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Ring: {formatTimestamp(device.lastDing)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Summary */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{filteredDevices.length} devices</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {data?.online || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                {data?.offline || 0}
              </span>
            </span>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
