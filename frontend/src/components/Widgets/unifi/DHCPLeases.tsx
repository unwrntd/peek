import React, { useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useRedact } from '../../../hooks/useRedact';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { SortableHeader } from '../../common/SortableHeader';
import { UnifiClient } from '../../../types';

interface DHCPLeasesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ClientData {
  clients: UnifiClient[];
  summary: {
    total: number;
    wired: number;
    wireless: number;
  };
}

export function DHCPLeases({ integrationId, config, widgetId }: DHCPLeasesProps) {
  const { rIP, rMAC, rHost } = useRedact();
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<ClientData>({
    integrationId,
    metric: (config.metric as string) || 'clients',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Read sort state from config
  const configSortKey = (config.sortField as string) || 'hostname';
  const configSortDirection = (config.sortDirection as SortDirection) || 'asc';

  // Callback to persist sort changes to widget config
  const handleSortChange = useCallback((key: string | null, direction: SortDirection) => {
    if (!widgetId) return;
    updateWidget(widgetId, {
      config: { ...config, sortField: key, sortDirection: direction }
    });
  }, [widgetId, config, updateWidget]);

  // Sorting
  type SortKey = 'hostname' | 'ip' | 'mac' | 'type';
  const getSortValue = useCallback((client: UnifiClient, key: SortKey) => {
    switch (key) {
      case 'hostname': return client.name || client.hostname || 'Unknown';
      case 'ip': return client.ip || '';
      case 'mac': return client.mac || '';
      case 'type': return client.is_wired ? 'Wired' : 'WiFi';
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, UnifiClient>(
    data?.clients || [],
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  const hideLabels = (config.hideLabels as boolean) || false;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            {!hideLabels && (
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Hostname" sortKey="hostname" direction={getSortDirection('hostname')} onSort={() => requestSort('hostname')} />
                  <SortableHeader label="IP Address" sortKey="ip" direction={getSortDirection('ip')} onSort={() => requestSort('ip')} />
                  <SortableHeader label="MAC" sortKey="mac" direction={getSortDirection('mac')} onSort={() => requestSort('mac')} />
                  <SortableHeader label="Type" sortKey="type" direction={getSortDirection('type')} onSort={() => requestSort('type')} />
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedData.slice(0, 20).map(client => (
                <tr key={client._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {rHost(client.name || client.hostname) || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-2 text-gray-600 dark:text-gray-300 font-mono text-xs">
                    {rIP(client.ip)}
                  </td>
                  <td className="py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {rMAC(client.mac)}
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      client.is_wired
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}>
                      {client.is_wired ? 'Wired' : 'WiFi'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">No clients found</p>
          )}
          {sortedData.length > 20 && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-xs py-2">
              Showing 20 of {sortedData.length} clients
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
