import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface RoutesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TailscaleRoute {
  id: string;
  deviceId: string;
  deviceName: string;
  route: string;
  type: 'subnet' | 'exit';
  enabled: boolean;
  approved: boolean;
}

interface RoutesData {
  routes: TailscaleRoute[];
}

export function Routes({ integrationId, config, widgetId }: RoutesProps) {
  const { data, loading, error } = useWidgetData<RoutesData>({
    integrationId,
    metric: 'routes',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const routeTypeFilter = config.routeType as string;
  const statusFilter = config.status as string;
  const showDevice = config.showDevice !== false;
  const showRoute = config.showRoute !== false;
  const showType = config.showType !== false;
  const showStatus = config.showStatus !== false;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'table';

  const filteredRoutes = useMemo(() => {
    let routes = data?.routes || [];

    // Filter by type
    if (routeTypeFilter === 'subnet') {
      routes = routes.filter(r => r.type === 'subnet');
    } else if (routeTypeFilter === 'exit') {
      routes = routes.filter(r => r.type === 'exit');
    }

    // Filter by status
    if (statusFilter === 'enabled') {
      routes = routes.filter(r => r.enabled);
    } else if (statusFilter === 'disabled') {
      routes = routes.filter(r => !r.enabled);
    }

    return routes;
  }, [data?.routes, routeTypeFilter, statusFilter]);

  const subnetCount = filteredRoutes.filter(r => r.type === 'subnet').length;
  const exitNodeCount = filteredRoutes.filter(r => r.type === 'exit').length;

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            {showDevice && <th className="py-2 font-medium">Device</th>}
            {showRoute && <th className="py-2 font-medium">Route</th>}
            {showType && <th className="py-2 font-medium">Type</th>}
            {showStatus && <th className="py-2 font-medium">Status</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredRoutes.map(route => (
            <tr key={route.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              {showDevice && (
                <td className="py-2">
                  <div className="font-medium text-gray-900 dark:text-white">{route.deviceName}</div>
                </td>
              )}
              {showRoute && (
                <td className="py-2 font-mono text-sm text-gray-600 dark:text-gray-300">{route.route}</td>
              )}
              {showType && (
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    route.type === 'exit'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  }`}>
                    {route.type === 'exit' ? 'Exit Node' : 'Subnet'}
                  </span>
                </td>
              )}
              {showStatus && (
                <td className="py-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    route.enabled
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${route.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {route.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCardsView = () => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {filteredRoutes.map(route => (
        <div key={route.id} className={`rounded-lg p-3 ${
          route.type === 'exit'
            ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
            : 'bg-gray-50 dark:bg-gray-700/50'
        }`}>
          <div className="flex items-start justify-between mb-2">
            <div>
              {showDevice && (
                <div className="font-medium text-gray-900 dark:text-white">{route.deviceName}</div>
              )}
              {showRoute && (
                <div className="font-mono text-sm text-gray-600 dark:text-gray-300 mt-1">{route.route}</div>
              )}
            </div>
            {showStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                route.enabled
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${route.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                {route.enabled ? 'Enabled' : 'Disabled'}
              </span>
            )}
          </div>
          {showType && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              route.type === 'exit'
                ? 'bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            }`}>
              {route.type === 'exit' ? 'Exit Node' : 'Subnet Router'}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  if (!data?.routes?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm">No routes configured</p>
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
                {filteredRoutes.length} route{filteredRoutes.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-blue-600 dark:text-blue-400">{subnetCount} subnet{subnetCount !== 1 ? 's' : ''}</span>
                <span className="text-gray-400">|</span>
                <span className="text-purple-600 dark:text-purple-400">{exitNodeCount} exit node{exitNodeCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
          {visualizationType === 'cards' ? renderCardsView() : renderTableView()}
        </div>
      )}
    </BaseWidget>
  );
}
