import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProxmoxNetwork } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon, IconType } from '../../../utils/icons';

interface NetworkStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface NetworkData {
  networks: ProxmoxNetwork[];
}

function getInterfaceIconType(type: string): IconType {
  switch (type) {
    case 'bridge':
      return 'bridge';
    case 'bond':
      return 'link';
    case 'vlan':
      return 'tag';
    case 'eth':
      return 'ethernet';
    case 'OVSBridge':
    case 'OVSPort':
    case 'OVSIntPort':
      return 'switch';
    default:
      return 'sensor';
  }
}

export function NetworkStatus({ integrationId, config, widgetId }: NetworkStatusProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<NetworkData>({
    integrationId,
    metric: (config.metric as string) || 'network',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const showAddress = config.showAddress !== false;
  const showGateway = config.showGateway !== false;
  const showBridgePorts = config.showBridgePorts !== false;
  const compactView = config.compactView === true;

  // Apply filters
  const filteredNetworks = data?.networks.filter(iface => {
    const interfaceType = config.interfaceType as string;
    if (interfaceType && iface.type !== interfaceType) return false;

    const statusFilter = config.status as string;
    if (statusFilter === 'active' && !iface.active) return false;
    if (statusFilter === 'inactive' && iface.active) return false;

    // Search filter (supports wildcards and comma-separated lists)
    const search = config.search as string;
    if (search && !matchesAnyFilter([iface.iface, iface.address, iface.cidr], search)) {
      return false;
    }

    return true;
  }) || [];

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`space-y-${compactView ? '2' : '3'}`}>
          {filteredNetworks.map((iface) => (
            <div
              key={iface.iface}
              className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getIcon(getInterfaceIconType(iface.type), iconStyle, 'w-5 h-5')}</span>
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {iface.iface}
                    </span>
                    <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                      {iface.type}
                    </span>
                  </div>
                  {showAddress && iface.address && (
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {iface.cidr || `${iface.address}/${iface.netmask}`}
                    </div>
                  )}
                  {showGateway && iface.gateway && (
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Gateway: {iface.gateway}
                    </div>
                  )}
                  {showBridgePorts && iface.bridge_ports && (
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Ports: {iface.bridge_ports}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    iface.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {iface.active ? 'Active' : 'Inactive'}
                  </span>
                  {iface.autostart && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Autostart
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredNetworks.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.networks.length === 0 ? 'No network interfaces found' : 'No interfaces match filter'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
