import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { NetAlertXInterface } from '../../../types';

interface InterfacesData {
  interfaces: NetAlertXInterface[];
}

interface InterfacesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Interfaces({ integrationId, config, widgetId }: InterfacesProps) {
  const { data, loading, error } = useWidgetData<InterfacesData>({
    integrationId,
    metric: 'interfaces',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const interfaceFilter = (config.interfaceFilter as string) || '';
  const hideLabels = config.hideLabels === true;
  const showMac = config.showMac !== false;
  const showMtu = config.showMtu !== false;
  const showIpv6 = config.showIpv6 === true;

  const filteredInterfaces = useMemo(() => {
    if (!data?.interfaces) return [];

    let interfaces = data.interfaces;

    // Apply name filter
    if (interfaceFilter) {
      const filter = interfaceFilter.toLowerCase();
      interfaces = interfaces.filter(iface =>
        iface.name?.toLowerCase().includes(filter)
      );
    }

    return interfaces;
  }, [data?.interfaces, interfaceFilter]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {filteredInterfaces.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            No interfaces found
          </div>
        ) : (
          filteredInterfaces.map((iface, index) => (
            <div
              key={iface.name || index}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {iface.name}
                    </p>
                  </div>
                  {iface.ipv4 && iface.ipv4.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono ml-8">
                      {iface.ipv4[0]}
                    </p>
                  )}
                </div>
                {iface.state && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    iface.state === 'UP' || iface.state === 'up'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {iface.state}
                  </span>
                )}
              </div>

              {!hideLabels && (
                <div className="mt-2 ml-8 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {showMac && iface.mac && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">MAC:</span>
                      <span className="text-gray-600 dark:text-gray-300 font-mono">{iface.mac}</span>
                    </div>
                  )}
                  {showMtu && iface.mtu && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">MTU:</span>
                      <span className="text-gray-600 dark:text-gray-300">{iface.mtu}</span>
                    </div>
                  )}
                  {showIpv6 && iface.ipv6 && iface.ipv6.length > 0 && (
                    <div className="flex items-center gap-1 col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">IPv6:</span>
                      <span className="text-gray-600 dark:text-gray-300 font-mono truncate">{iface.ipv6[0]}</span>
                    </div>
                  )}
                  {(iface.rx_bytes !== undefined || iface.tx_bytes !== undefined) && (
                    <>
                      {iface.rx_bytes !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 dark:text-gray-400">RX:</span>
                          <span className="text-gray-600 dark:text-gray-300">{formatBytes(iface.rx_bytes)}</span>
                        </div>
                      )}
                      {iface.tx_bytes !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 dark:text-gray-400">TX:</span>
                          <span className="text-gray-600 dark:text-gray-300">{formatBytes(iface.tx_bytes)}</span>
                        </div>
                      )}
                    </>
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
