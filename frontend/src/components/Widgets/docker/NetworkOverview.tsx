import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface NetworkOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  ipam: {
    driver: string;
    config: Array<{
      subnet?: string;
      gateway?: string;
    }>;
  };
  containers: Record<string, {
    Name: string;
    IPv4Address: string;
    IPv6Address: string;
  }>;
  created: string;
}

interface NetworkData {
  networks: DockerNetwork[];
}

const BUILTIN_NETWORKS = ['bridge', 'host', 'none'];

export function NetworkOverview({ integrationId, config, widgetId }: NetworkOverviewProps) {
  const { data, loading, error } = useWidgetData<NetworkData>({
    integrationId,
    metric: 'networks',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const filteredNetworks = useMemo(() => {
    if (!data?.networks) return [];

    return data.networks.filter(network => {
      const driverFilter = config.driver as string;
      if (driverFilter && network.driver !== driverFilter) return false;

      const showBuiltin = config.showBuiltin as boolean;
      if (!showBuiltin && BUILTIN_NETWORKS.includes(network.name)) return false;

      const search = config.search as string;
      if (search && !matchesAnyFilter([network.name, network.driver], search)) {
        return false;
      }

      return true;
    });
  }, [data?.networks, config.driver, config.showBuiltin, config.search]);

  const showDriver = config.showDriver !== false;
  const showSubnet = config.showSubnet !== false;
  const showGateway = config.showGateway !== false;
  const showContainers = config.showContainers !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'table';

  const getSubnet = (network: DockerNetwork): string => {
    if (network.ipam?.config?.[0]?.subnet) {
      return network.ipam.config[0].subnet;
    }
    return '-';
  };

  const getGateway = (network: DockerNetwork): string => {
    if (network.ipam?.config?.[0]?.gateway) {
      return network.ipam.config[0].gateway;
    }
    return '-';
  };

  const getContainerCount = (network: DockerNetwork): number => {
    return Object.keys(network.containers || {}).length;
  };

  const getDriverBadgeColor = (driver: string): string => {
    switch (driver) {
      case 'bridge': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'host': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'overlay': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      case 'macvlan': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const renderCardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {filteredNetworks.map(network => (
        <div
          key={network.id}
          className={`p-3 rounded-lg border transition-colors ${
            network.internal
              ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {network.name}
              </h4>
              {showDriver && (
                <span className={`inline-flex items-center px-1.5 py-0.5 mt-1 rounded text-xs font-medium ${getDriverBadgeColor(network.driver)}`}>
                  {network.driver}
                </span>
              )}
            </div>
            {showContainers && (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {getContainerCount(network)} container{getContainerCount(network) !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="space-y-1 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {showSubnet && getSubnet(network) !== '-' && (
              <div className="flex justify-between">
                <span>Subnet</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{getSubnet(network)}</span>
              </div>
            )}
            {showGateway && getGateway(network) !== '-' && (
              <div className="flex justify-between">
                <span>Gateway</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{getGateway(network)}</span>
              </div>
            )}
            {network.internal && (
              <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Internal network
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        {!hideLabels && (
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 font-medium">Name</th>
              {showDriver && <th className="py-2 font-medium">Driver</th>}
              {showSubnet && <th className="py-2 font-medium">Subnet</th>}
              {showGateway && <th className="py-2 font-medium">Gateway</th>}
              {showContainers && <th className="py-2 font-medium">Containers</th>}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredNetworks.map(network => (
            <tr key={network.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {network.name}
                  </span>
                  {network.internal && (
                    <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
              </td>
              {showDriver && (
                <td className="py-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getDriverBadgeColor(network.driver)}`}>
                    {network.driver}
                  </span>
                </td>
              )}
              {showSubnet && (
                <td className="py-2 text-gray-600 dark:text-gray-300 font-mono text-xs">
                  {getSubnet(network)}
                </td>
              )}
              {showGateway && (
                <td className="py-2 text-gray-600 dark:text-gray-300 font-mono text-xs">
                  {getGateway(network)}
                </td>
              )}
              {showContainers && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {getContainerCount(network)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {visualizationType === 'cards' ? renderCardView() : renderTableView()}
          {filteredNetworks.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {(data.networks?.length || 0) === 0 ? 'No networks found' : 'No networks match filters'}
            </p>
          )}
        </>
      )}
    </BaseWidget>
  );
}
