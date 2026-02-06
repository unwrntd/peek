import React, { useCallback, useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useRedact } from '../../../hooks/useRedact';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { SortableHeader } from '../../common/SortableHeader';
import { UnifiClient } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface ClientListProps {
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

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m`;
}

export function ClientList({ integrationId, config, widgetId }: ClientListProps) {
  const { rIP, rMAC, rHost } = useRedact();
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<ClientData>({
    integrationId,
    metric: (config.metric as string) || 'clients',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Read sort state from config
  const configSortKey = (config.sortField as string) || 'client';
  const configSortDirection = (config.sortDirection as SortDirection) || 'asc';

  // Callback to persist sort changes to widget config
  const handleSortChange = useCallback((key: string | null, direction: SortDirection) => {
    if (!widgetId) return;
    updateWidget(widgetId, {
      config: { ...config, sortField: key, sortDirection: direction }
    });
  }, [widgetId, config, updateWidget]);

  // Apply filters - memoized for performance
  const filteredClients = useMemo(() => {
    if (!data?.clients) return [];

    return data.clients.filter(client => {
      // Connection type filter
      const connectionType = config.connectionType as string;
      if (connectionType === 'wired' && !client.is_wired) return false;
      if (connectionType === 'wireless' && client.is_wired) return false;

      // Search filter (supports wildcards and comma-separated lists)
      const search = config.search as string;
      if (search && !matchesAnyFilter([client.name, client.hostname, client.ip, client.mac], search)) {
        return false;
      }

      return true;
    });
  }, [data?.clients, config.connectionType, config.search]);

  // Sorting
  type SortKey = 'client' | 'ip' | 'type' | 'traffic' | 'uptime' | 'mac';
  const getSortValue = useCallback((client: UnifiClient, key: SortKey) => {
    switch (key) {
      case 'client': return client.name || client.hostname || 'Unknown';
      case 'ip': return client.ip || '';
      case 'type': return client.is_wired ? 'Wired' : 'WiFi';
      case 'traffic': return (client.rx_bytes || 0) + (client.tx_bytes || 0);
      case 'uptime': return client.uptime || 0;
      case 'mac': return client.mac || '';
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, UnifiClient>(
    filteredClients,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  const maxItems = (config.maxItems as number) || 20;

  // Column visibility (default to true if not set)
  const showIp = config.showIp !== false;
  const showType = config.showType !== false;
  const showTraffic = config.showTraffic !== false;
  const showUptime = config.showUptime !== false;
  const showMac = config.showMac !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';

  // Metric size classes
  const metricSizeClasses: Record<string, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };
  const metricClass = metricSizeClasses[metricSize] || 'text-base';

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            {!hideLabels && (
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Client" sortKey="client" direction={getSortDirection('client')} onSort={() => requestSort('client')} />
                  {showIp && <SortableHeader label="IP" sortKey="ip" direction={getSortDirection('ip')} onSort={() => requestSort('ip')} />}
                  {showType && <SortableHeader label="Type" sortKey="type" direction={getSortDirection('type')} onSort={() => requestSort('type')} />}
                  {showTraffic && <SortableHeader label="Traffic" sortKey="traffic" direction={getSortDirection('traffic')} onSort={() => requestSort('traffic')} align="right" />}
                  {showUptime && <SortableHeader label="Uptime" sortKey="uptime" direction={getSortDirection('uptime')} onSort={() => requestSort('uptime')} align="right" />}
                  {showMac && <SortableHeader label="MAC" sortKey="mac" direction={getSortDirection('mac')} onSort={() => requestSort('mac')} />}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedData.slice(0, maxItems).map(client => (
                <tr key={client._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {rHost(client.name || client.hostname) || 'Unknown'}
                    </div>
                  </td>
                  {showIp && (
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      {rIP(client.ip)}
                    </td>
                  )}
                  {showType && (
                    <td className="py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        client.is_wired
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}>
                        {client.is_wired ? 'Wired' : 'WiFi'}
                      </span>
                    </td>
                  )}
                  {showTraffic && (
                    <td className={`py-2 text-right text-gray-600 dark:text-gray-300 ${metricClass}`}>
                      <div className={hideLabels ? '' : 'text-xs'}>
                        <span className="text-green-600 dark:text-green-400">{hideLabels ? '' : '↓'}{formatBytes(client.rx_bytes)}</span>
                        {' / '}
                        <span className="text-blue-600 dark:text-blue-400">{hideLabels ? '' : '↑'}{formatBytes(client.tx_bytes)}</span>
                      </div>
                    </td>
                  )}
                  {showUptime && (
                    <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                      {formatUptime(client.uptime)}
                    </td>
                  )}
                  {showMac && (
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      <span className="text-xs">{rMAC(client.mac)}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.clients.length === 0 ? 'No clients connected' : 'No clients match filters'}
            </p>
          )}
          {sortedData.length > maxItems && !hideLabels && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-xs py-2">
              Showing {maxItems} of {sortedData.length} clients
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
