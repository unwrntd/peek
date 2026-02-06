import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { formatBytes } from '../../../utils/formatting';

interface InterfacesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface OPNsenseInterface {
  name: string;
  description: string;
  device: string;
  status: 'up' | 'down' | 'no carrier';
  ipv4?: string;
  ipv6?: string;
  mac: string;
  mtu: number;
  media: string;
  inBytes: number;
  outBytes: number;
  inPackets: number;
  outPackets: number;
  inErrors: number;
  outErrors: number;
}

interface InterfacesData {
  interfaces: OPNsenseInterface[];
  stats: {
    total: number;
    up: number;
    down: number;
  };
}

export function Interfaces({ integrationId, config, widgetId }: InterfacesProps) {
  const { data, loading, error } = useWidgetData<InterfacesData>({
    integrationId,
    metric: 'interfaces',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const statusFilter = config.status as string;
  const showStatus = config.showStatus !== false;
  const showIP = config.showIP !== false;
  const showMAC = config.showMAC !== false;
  const showTraffic = config.showTraffic !== false;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'list';

  const filteredInterfaces = useMemo(() => {
    let interfaces = data?.interfaces || [];

    if (statusFilter === 'up') {
      interfaces = interfaces.filter(i => i.status === 'up');
    } else if (statusFilter === 'down') {
      interfaces = interfaces.filter(i => i.status !== 'up');
    }

    return interfaces;
  }, [data?.interfaces, statusFilter]);

  const renderListView = () => (
    <div className="space-y-2">
      {filteredInterfaces.map(iface => (
        <div key={iface.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            {showStatus && (
              <div className={`w-2 h-2 rounded-full ${iface.status === 'up' ? 'bg-green-500' : 'bg-gray-400'}`} />
            )}
            <div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">
                {iface.description || iface.name}
              </div>
              {showIP && iface.ipv4 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{iface.ipv4}</div>
              )}
            </div>
          </div>
          {showTraffic && (
            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
              <div>In: {formatBytes(iface.inBytes)}</div>
              <div>Out: {formatBytes(iface.outBytes)}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderCardsView = () => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {filteredInterfaces.map(iface => (
        <div key={iface.name} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-gray-900 dark:text-white">
              {iface.description || iface.name}
            </div>
            {showStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                iface.status === 'up'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${iface.status === 'up' ? 'bg-green-500' : 'bg-gray-400'}`} />
                {iface.status === 'up' ? 'Up' : 'Down'}
              </span>
            )}
          </div>

          <div className="space-y-1 text-sm">
            {showIP && iface.ipv4 && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">IP</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{iface.ipv4}</span>
              </div>
            )}
            {showMAC && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">MAC</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{iface.mac}</span>
              </div>
            )}
            {showTraffic && (
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-500 dark:text-gray-400">Traffic</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {formatBytes(iface.inBytes)} / {formatBytes(iface.outBytes)}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTrafficView = () => (
    <div className="space-y-3">
      {filteredInterfaces.filter(i => i.status === 'up').map(iface => (
        <div key={iface.name}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {iface.description || iface.name}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
              <div className="text-green-600 dark:text-green-400 font-medium">
                {formatBytes(iface.inBytes)}
              </div>
              <div className="text-gray-500 dark:text-gray-400">In</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
              <div className="text-blue-600 dark:text-blue-400 font-medium">
                {formatBytes(iface.outBytes)}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Out</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!data?.interfaces?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <p className="text-sm">No interfaces found</p>
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
                {filteredInterfaces.length} interface{filteredInterfaces.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data.stats.up} up / {data.stats.down} down
              </span>
            </div>
          )}
          {visualizationType === 'cards' ? renderCardsView() :
           visualizationType === 'traffic' ? renderTrafficView() : renderListView()}
        </div>
      )}
    </BaseWidget>
  );
}
