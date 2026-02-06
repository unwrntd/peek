import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';

interface Device {
  pk: string;
  name: string;
  description: string;
  deviceId: string;
  status: number;
  statusLabel: string;
  learnIp: boolean;
  restricted: boolean;
  analyticsLevel: number;
  icon: string;
  profile: {
    pk: string;
    name: string;
  };
  resolvers: {
    uid: string;
    doh: string;
    dot: string;
    ipv4: string[];
    ipv6: string[];
  };
  ddns: {
    hostname: string;
    subdomain: string;
  } | null;
  created: number;
}

interface DevicesData {
  devices: Device[];
  total: number;
}

interface DevicesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getStatusColor(status: number): string {
  switch (status) {
    case 1:
      return 'bg-green-500/20 text-green-400';
    case 0:
      return 'bg-yellow-500/20 text-yellow-400';
    case 2:
    case 3:
      return 'bg-gray-500/20 text-gray-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

function getStatusDot(status: number): string {
  switch (status) {
    case 1:
      return 'bg-green-400';
    case 0:
      return 'bg-yellow-400';
    default:
      return 'bg-gray-500';
  }
}

export function Devices({ integrationId, config, widgetId }: DevicesWidgetProps) {
  const { rHost, r } = useRedact();
  const { data, loading, error } = useWidgetData<DevicesData>({
    integrationId,
    metric: 'devices',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredDevices = useMemo(() => {
    if (!data?.devices) return [];

    return data.devices.filter(device => {
      if (filters.status && device.status.toString() !== filters.status) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!device.name.toLowerCase().includes(search) &&
            !device.description.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  if (!data?.devices?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No devices found</p>
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
            {filteredDevices.map(device => (
              <div
                key={device.pk}
                className={`p-3 rounded-lg border border-gray-700 ${device.status !== 1 ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusDot(device.status)}`} />
                    <span className="font-medium text-white">{rHost(device.name)}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(device.status)}`}>
                    {device.statusLabel}
                  </span>
                </div>

                {device.description && (
                  <p className="text-xs text-gray-500 mb-2">{device.description}</p>
                )}

                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Profile</span>
                    <span className="text-purple-400">{device.profile.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">DoH</span>
                    <span className="text-gray-300 font-mono text-[10px] truncate max-w-[150px]">
                      {r(device.resolvers.doh)}
                    </span>
                  </div>
                </div>
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
              <th className="text-left p-2 font-medium">Device</th>
              <th className="text-left p-2 font-medium">Profile</th>
              <th className="text-center p-2 font-medium">Status</th>
              <th className="text-left p-2 font-medium">Resolver</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(device => (
              <tr
                key={device.pk}
                className={`border-t border-gray-700/50 hover:bg-gray-800/50 ${device.status !== 1 ? 'opacity-60' : ''}`}
              >
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusDot(device.status)}`} />
                    <div>
                      <div className="text-white font-medium">{rHost(device.name)}</div>
                      {device.description && (
                        <div className="text-xs text-gray-500">{r(device.description)}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                    {device.profile.name}
                  </span>
                </td>
                <td className="p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(device.status)}`}>
                    {device.statusLabel}
                  </span>
                </td>
                <td className="p-2 text-xs font-mono text-gray-400 truncate max-w-[200px]">
                  {r(device.resolvers.uid)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
