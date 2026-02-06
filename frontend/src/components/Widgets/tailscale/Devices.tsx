import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface DevicesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TailscaleDevice {
  id: string;
  addresses: string[];
  name: string;
  hostname: string;
  user: string;
  os: string;
  clientVersion: string;
  created: string;
  lastSeen?: string;
  keyExpiryDisabled: boolean;
  expires: string;
  authorized: boolean;
  enabledRoutes: string[];
  advertisedRoutes: string[];
  tags?: string[];
}

interface DevicesData {
  devices: TailscaleDevice[];
}

function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return 'Online';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function isOnline(device: TailscaleDevice): boolean {
  // Device is online if lastSeen is not set
  return !device.lastSeen;
}

function matchesSearch(device: TailscaleDevice, search: string): boolean {
  const searchLower = search.toLowerCase();
  return (
    device.name.toLowerCase().includes(searchLower) ||
    device.hostname.toLowerCase().includes(searchLower) ||
    device.addresses.some(addr => addr.includes(searchLower)) ||
    device.user.toLowerCase().includes(searchLower)
  );
}

export function Devices({ integrationId, config, widgetId }: DevicesProps) {
  const { data, loading, error } = useWidgetData<DevicesData>({
    integrationId,
    metric: 'devices',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const statusFilter = config.status as string;
  const searchFilter = config.search as string;
  const tagFilter = config.tag as string;
  const maxItems = config.maxItems as number;
  const showStatus = config.showStatus !== false;
  const showAddresses = config.showAddresses !== false;
  const showOS = config.showOS !== false;
  const showUser = config.showUser !== false;
  const showLastSeen = config.showLastSeen !== false;
  const showRoutes = config.showRoutes !== false;
  const showTags = config.showTags !== false;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'table';

  const filteredDevices = useMemo(() => {
    let devices = data?.devices || [];

    // Filter by status
    if (statusFilter === 'online') {
      devices = devices.filter(d => isOnline(d));
    } else if (statusFilter === 'offline') {
      devices = devices.filter(d => !isOnline(d));
    }

    // Filter by search
    if (searchFilter) {
      devices = devices.filter(d => matchesSearch(d, searchFilter));
    }

    // Filter by tag
    if (tagFilter) {
      const tagLower = tagFilter.toLowerCase().replace('tag:', '');
      devices = devices.filter(d =>
        d.tags?.some(t => t.toLowerCase().includes(tagLower))
      );
    }

    // Limit items
    if (maxItems && maxItems > 0) {
      devices = devices.slice(0, maxItems);
    }

    return devices;
  }, [data?.devices, statusFilter, searchFilter, tagFilter, maxItems]);

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 font-medium">Name</th>
            {showStatus && <th className="py-2 font-medium">Status</th>}
            {showAddresses && <th className="py-2 font-medium">Address</th>}
            {showOS && <th className="py-2 font-medium">OS</th>}
            {showUser && <th className="py-2 font-medium">User</th>}
            {showLastSeen && <th className="py-2 font-medium">Last Seen</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredDevices.map(device => (
            <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="py-2">
                <div className="font-medium text-gray-900 dark:text-white">{device.name || device.hostname}</div>
                {device.name && device.hostname !== device.name && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">{device.hostname}</div>
                )}
                {showTags && device.tags && device.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {device.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {tag.replace('tag:', '')}
                      </span>
                    ))}
                    {device.tags.length > 3 && (
                      <span className="text-xs text-gray-400">+{device.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </td>
              {showStatus && (
                <td className="py-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                    isOnline(device)
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline(device) ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {isOnline(device) ? 'Online' : 'Offline'}
                  </span>
                </td>
              )}
              {showAddresses && (
                <td className="py-2 text-gray-600 dark:text-gray-300 font-mono text-xs">
                  {device.addresses[0]}
                </td>
              )}
              {showOS && (
                <td className="py-2 text-gray-600 dark:text-gray-300">{device.os}</td>
              )}
              {showUser && (
                <td className="py-2 text-gray-600 dark:text-gray-300">{device.user}</td>
              )}
              {showLastSeen && (
                <td className="py-2 text-gray-600 dark:text-gray-300">{formatRelativeTime(device.lastSeen)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCardsView = () => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {filteredDevices.map(device => (
        <div key={device.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{device.name || device.hostname}</div>
              {device.name && device.hostname !== device.name && (
                <div className="text-xs text-gray-500 dark:text-gray-400">{device.hostname}</div>
              )}
            </div>
            {showStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                isOnline(device)
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline(device) ? 'bg-green-500' : 'bg-gray-400'}`} />
                {isOnline(device) ? 'Online' : 'Offline'}
              </span>
            )}
          </div>

          <div className="space-y-1 text-sm">
            {showAddresses && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">IP</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{device.addresses[0]}</span>
              </div>
            )}
            {showOS && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">OS</span>
                <span className="text-gray-700 dark:text-gray-300">{device.os}</span>
              </div>
            )}
            {showUser && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">User</span>
                <span className="text-gray-700 dark:text-gray-300">{device.user}</span>
              </div>
            )}
            {showLastSeen && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Last Seen</span>
                <span className="text-gray-700 dark:text-gray-300">{formatRelativeTime(device.lastSeen)}</span>
              </div>
            )}
            {showRoutes && device.enabledRoutes && device.enabledRoutes.length > 0 && (
              <div className="pt-1">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Routes:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {device.enabledRoutes.map(route => (
                    <span key={route} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-mono">
                      {route}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {showTags && device.tags && device.tags.length > 0 && (
              <div className="pt-1">
                <div className="flex flex-wrap gap-1">
                  {device.tags.map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                      {tag.replace('tag:', '')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (!data?.devices?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No devices found</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="flex flex-col h-full">
          {!hideLabels && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {filteredDevices.filter(d => isOnline(d)).length} online
              </span>
            </div>
          )}
          {visualizationType === 'cards' ? renderCardsView() : renderTableView()}
        </div>
      )}
    </BaseWidget>
  );
}
