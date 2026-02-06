import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { BaseWidget } from '../BaseWidget';
import { NetAlertXDevice } from '../../../types';

interface DeviceListData {
  devices: NetAlertXDevice[];
}

interface DeviceListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function DeviceList({ integrationId, config, widgetId }: DeviceListProps) {
  const { rIP, rMAC, rHost } = useRedact();
  const statusFilter = (config.status as string) || 'all';

  // Map filter values to backend metric
  const metricMap: Record<string, string> = {
    all: 'devices',
    online: 'devices-online',
    offline: 'devices-offline',
    down: 'devices-down',
    new: 'devices-new',
    favorites: 'devices-favorites',
  };

  const metric = metricMap[statusFilter] || 'devices';

  const { data, loading, error } = useWidgetData<DeviceListData>({
    integrationId,
    metric,
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const searchFilter = (config.search as string) || '';
  const maxItems = (config.maxItems as number) || 50;
  const showVendor = config.showVendor !== false;
  const showLastConnection = config.showLastConnection !== false;
  const showSessions = config.showSessions !== false;
  const hideLabels = config.hideLabels === true;

  const filteredDevices = useMemo(() => {
    if (!data?.devices) return [];

    let devices = data.devices;

    // Apply search filter
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      devices = devices.filter(device =>
        device.devName?.toLowerCase().includes(search) ||
        device.devMac?.toLowerCase().includes(search) ||
        device.devIP?.toLowerCase().includes(search)
      );
    }

    return devices.slice(0, maxItems);
  }, [data?.devices, searchFilter, maxItems]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'On-line':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'Off-line':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
      case 'Down':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'Archived':
        return 'bg-gray-200 text-gray-500 dark:bg-gray-700/50 dark:text-gray-500';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {filteredDevices.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            No devices found
          </div>
        ) : (
          filteredDevices.map((device) => (
            <div
              key={device.devMac}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {device.devFavorite === 1 && (
                      <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    )}
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {rHost(device.devName) || rMAC(device.devMac)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {rIP(device.devIP)}
                  </p>
                  {!hideLabels && showVendor && device.devVendor && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {device.devVendor}
                    </p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusColor(device.devStatus)}`}>
                  {device.devStatus}
                </span>
              </div>

              {!hideLabels && (showLastConnection || showSessions) && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {showLastConnection && (
                    <span>Last: {formatDate(device.devLastConnection)}</span>
                  )}
                  {showSessions && (
                    <span>{device.devSessions} sessions</span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </BaseWidget>
  );
}
