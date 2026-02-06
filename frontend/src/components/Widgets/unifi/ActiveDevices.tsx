import React, { useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useRedact } from '../../../hooks/useRedact';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { StatusIndicator } from '../../common/StatusIndicator';
import { SortableHeader } from '../../common/SortableHeader';
import { UnifiDevice } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface ActiveDevicesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DeviceData {
  devices: UnifiDevice[];
}

const deviceTypeIcons: Record<string, string> = {
  ugw: 'Gateway',
  usw: 'Switch',
  uap: 'Access Point',
  udm: 'Dream Machine',
  uxg: 'Gateway',
};

function formatUptime(seconds: number): string {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function getDeviceStatus(state: number): string {
  switch (state) {
    case 1:
      return 'online';
    case 0:
      return 'offline';
    default:
      return 'unknown';
  }
}

export function ActiveDevices({ integrationId, config, widgetId }: ActiveDevicesProps) {
  const { rHost } = useRedact();
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<DeviceData>({
    integrationId,
    metric: (config.metric as string) || 'devices',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Read sort state from config
  const configSortKey = (config.sortField as string) || 'device';
  const configSortDirection = (config.sortDirection as SortDirection) || 'asc';

  // Callback to persist sort changes to widget config
  const handleSortChange = useCallback((key: string | null, direction: SortDirection) => {
    if (!widgetId) return;
    updateWidget(widgetId, {
      config: { ...config, sortField: key, sortDirection: direction }
    });
  }, [widgetId, config, updateWidget]);

  // Apply filters
  const filteredDevices = data?.devices.filter(device => {
    // Device type filter
    const deviceType = config.deviceType as string;
    if (deviceType && device.type !== deviceType) return false;

    // Status filter
    const status = config.status as string;
    if (status === 'online' && device.state !== 1) return false;
    if (status === 'offline' && device.state !== 0) return false;

    // Search filter (supports wildcards and comma-separated lists)
    const search = config.search as string;
    if (search && !matchesAnyFilter([device.name, device.model], search)) {
      return false;
    }

    return true;
  }) || [];

  // Sorting
  type SortKey = 'device' | 'type' | 'status' | 'uptime' | 'model';
  const getSortValue = useCallback((device: UnifiDevice, key: SortKey) => {
    switch (key) {
      case 'device': return device.name || 'Unknown';
      case 'type': return deviceTypeIcons[device.type] || device.type;
      case 'status': return device.state;
      case 'uptime': return device.uptime || 0;
      case 'model': return device.model || '';
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, UnifiDevice>(
    filteredDevices,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  // Column visibility (default to true if not set)
  const showType = config.showType !== false;
  const showStatus = config.showStatus !== false;
  const showUptime = config.showUptime !== false;
  const showModel = config.showModel !== false;
  const hideLabels = (config.hideLabels as boolean) || false;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            {!hideLabels && (
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Device" sortKey="device" direction={getSortDirection('device')} onSort={() => requestSort('device')} />
                  {showType && <SortableHeader label="Type" sortKey="type" direction={getSortDirection('type')} onSort={() => requestSort('type')} />}
                  {showStatus && <SortableHeader label="Status" sortKey="status" direction={getSortDirection('status')} onSort={() => requestSort('status')} />}
                  {showUptime && <SortableHeader label="Uptime" sortKey="uptime" direction={getSortDirection('uptime')} onSort={() => requestSort('uptime')} />}
                  {showModel && <SortableHeader label="Model" sortKey="model" direction={getSortDirection('model')} onSort={() => requestSort('model')} />}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedData.map(device => (
                <tr key={device._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2">
                    <div className="font-medium text-gray-900 dark:text-white">{rHost(device.name) || 'Unknown'}</div>
                  </td>
                  {showType && (
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      {deviceTypeIcons[device.type] || device.type}
                    </td>
                  )}
                  {showStatus && (
                    <td className="py-2">
                      <StatusIndicator status={getDeviceStatus(device.state)} />
                    </td>
                  )}
                  {showUptime && (
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      {formatUptime(device.uptime)}
                    </td>
                  )}
                  {showModel && (
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      <span className="text-xs">{device.model}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.devices.length === 0 ? 'No devices found' : 'No devices match filters'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
