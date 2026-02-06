import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface RouteEntry {
  id: string;
  dstAddress: string;
  gateway: string;
  gatewayStatus: string | null;
  distance: number;
  scope: number;
  targetScope: number;
  active: boolean;
  dynamic: boolean;
  disabled: boolean;
  comment: string | null;
}

interface RoutesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Routes({ integrationId, config, widgetId }: RoutesWidgetProps) {
  const { data, loading, error } = useWidgetData<{ routes: RouteEntry[] }>({
    integrationId,
    metric: 'routes',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredRoutes = useMemo(() => {
    if (!data?.routes) return [];

    return data.routes.filter(route => {
      if (filters.status === 'active' && !route.active) return false;
      if (filters.status === 'disabled' && !route.disabled) return false;
      if (filters.type === 'static' && route.dynamic) return false;
      if (filters.type === 'dynamic' && !route.dynamic) return false;
      return true;
    });
  }, [data, filters]);

  if (!data?.routes?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-sm">No routes found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-2">
            {filteredRoutes.map(route => (
              <div
                key={route.id}
                className={`p-3 rounded-lg border ${
                  route.active
                    ? 'border-green-500/30 bg-green-500/5'
                    : route.disabled
                    ? 'border-gray-600 bg-gray-800/50 opacity-50'
                    : 'border-yellow-500/30 bg-yellow-500/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {route.dstAddress === '0.0.0.0/0' ? (
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    )}
                    <span className="font-mono font-medium text-white">{route.dstAddress}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${route.active ? 'bg-green-400' : 'bg-gray-500'}`} />
                </div>

                <div className="text-xs space-y-1 text-gray-400">
                  <div className="flex justify-between">
                    <span>Gateway</span>
                    <span className="font-mono text-gray-300">{route.gateway}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance</span>
                    <span className="text-gray-300">{route.distance}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      route.dynamic
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {route.dynamic ? 'Dynamic' : 'Static'}
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
              <th className="text-left p-2 font-medium">Destination</th>
              <th className="text-left p-2 font-medium">Gateway</th>
              <th className="text-center p-2 font-medium">Distance</th>
              <th className="text-center p-2 font-medium">Type</th>
              <th className="text-center p-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoutes.map(route => (
              <tr
                key={route.id}
                className={`border-t border-gray-700/50 hover:bg-gray-800/50 ${route.disabled ? 'opacity-50' : ''}`}
              >
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {route.dstAddress === '0.0.0.0/0' && (
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span className="font-mono text-white">{route.dstAddress}</span>
                  </div>
                </td>
                <td className="p-2 font-mono text-xs text-gray-400">{route.gateway}</td>
                <td className="p-2 text-center text-gray-300">{route.distance}</td>
                <td className="p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    route.dynamic
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {route.dynamic ? 'Dynamic' : 'Static'}
                  </span>
                </td>
                <td className="p-2 text-center">
                  {route.active ? (
                    <span className="text-green-400 text-xs">Active</span>
                  ) : route.disabled ? (
                    <span className="text-gray-500 text-xs">Disabled</span>
                  ) : (
                    <span className="text-yellow-400 text-xs">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
