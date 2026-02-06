import React, { useCallback, useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useRedact } from '../../../hooks/useRedact';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { SortableHeader } from '../../common/SortableHeader';
import { StatusIndicator } from '../../common/StatusIndicator';
import { BeszelSystem } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface SystemListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SystemsData {
  systems: BeszelSystem[];
}

function formatUptime(seconds?: number): string {
  if (!seconds) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function SystemList({ integrationId, config, widgetId }: SystemListProps) {
  const { rHost } = useRedact();
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<SystemsData>({
    integrationId,
    metric: (config.metric as string) || 'systems',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Read sort state from config
  const configSortKey = (config.sortField as string) || 'name';
  const configSortDirection = (config.sortDirection as SortDirection) || 'asc';

  // Callback to persist sort changes to widget config
  const handleSortChange = useCallback((key: string | null, direction: SortDirection) => {
    if (!widgetId) return;
    updateWidget(widgetId, {
      config: { ...config, sortField: key, sortDirection: direction }
    });
  }, [widgetId, config, updateWidget]);

  // Get integration config to build URL to Beszel
  const integration = useIntegrationStore(state =>
    state.integrations.find(i => i.id === integrationId)
  );
  const integrationConfig = integration?.config as { host?: string; port?: number; useHttps?: boolean } | undefined;

  // Build the base Beszel URL
  const getBeszelUrl = (hostname?: string) => {
    if (!integrationConfig?.host) return null;
    const protocol = integrationConfig.useHttps === true ? 'https' : 'http';
    const port = integrationConfig.port || 8090;
    const baseUrl = `${protocol}://${integrationConfig.host}:${port}`;
    if (hostname) {
      return `${baseUrl}/system/${hostname}`;
    }
    return baseUrl;
  };

  // Handler to open Beszel URL
  const handleRowClick = (hostname: string) => {
    const url = getBeszelUrl(hostname);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Configuration options
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showHost = config.showHost !== false;
  const showUptime = config.showUptime !== false;
  const showInfo = config.showInfo !== false;

  // Status filter
  const showUp = config.showUp !== false;
  const showDown = config.showDown !== false;
  const showPaused = config.showPaused !== false;
  const showPending = config.showPending !== false;

  // Apply filters - memoized for performance
  const filteredSystems = useMemo(() => {
    if (!data?.systems) return [];

    return data.systems.filter(system => {
      // Status filter
      if (system.status === 'up' && !showUp) return false;
      if (system.status === 'down' && !showDown) return false;
      if (system.status === 'paused' && !showPaused) return false;
      if (system.status === 'pending' && !showPending) return false;

      // Search filter
      const search = config.search as string;
      if (search && !matchesAnyFilter([system.name, system.host, system.info?.hostname], search)) {
        return false;
      }

      return true;
    });
  }, [data?.systems, showUp, showDown, showPaused, showPending, config.search]);

  // Sorting
  type SortKey = 'name' | 'host' | 'status' | 'uptime';
  const getSortValue = useCallback((item: BeszelSystem, key: SortKey) => {
    switch (key) {
      case 'name': return item.name;
      case 'host': return item.host;
      case 'status': return item.status;
      case 'uptime': return item.info?.uptime || 0;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, BeszelSystem>(
    filteredSystems,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  const getStatusForIndicator = (status: string): string => {
    switch (status) {
      case 'up': return 'ok';
      case 'down': return 'error';
      case 'paused': return 'warning';
      case 'pending': return 'unknown';
      default: return 'unknown';
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {!hideLabels && (
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Name" sortKey="name" direction={getSortDirection('name')} onSort={() => requestSort('name')} compact={compactView} />
                  {showHost && <SortableHeader label="Host" sortKey="host" direction={getSortDirection('host')} onSort={() => requestSort('host')} compact={compactView} />}
                  <SortableHeader label="Status" sortKey="status" direction={getSortDirection('status')} onSort={() => requestSort('status')} compact={compactView} />
                  {showUptime && <SortableHeader label="Uptime" sortKey="uptime" direction={getSortDirection('uptime')} onSort={() => requestSort('uptime')} align="right" compact={compactView} />}
                </tr>
              </thead>
            )}
            <tbody>
              {sortedData.map(system => {
                const systemUrl = getBeszelUrl(system.name);
                return (
                <tr
                  key={system.id}
                  className={`border-b border-gray-100 dark:border-gray-700 last:border-0 ${systemUrl ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors' : ''}`}
                  onClick={systemUrl ? () => handleRowClick(system.name) : undefined}
                  title={systemUrl ? `Open ${system.name} in Beszel` : undefined}
                >
                  <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                    <div className="font-medium text-gray-900 dark:text-white">{rHost(system.name)}</div>
                    {showInfo && system.info?.os && !hideLabels && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{system.info.os}</div>
                    )}
                  </td>
                  {showHost && (
                    <td className={`${compactView ? 'py-1' : 'py-2'} text-gray-600 dark:text-gray-300`}>
                      {rHost(system.host)}:{system.port}
                    </td>
                  )}
                  <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                    <StatusIndicator status={getStatusForIndicator(system.status)} label={hideLabels ? undefined : system.status} />
                  </td>
                  {showUptime && (
                    <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-gray-600 dark:text-gray-300`}>
                      {formatUptime(system.info?.uptime)}
                    </td>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.systems.length === 0 ? 'No systems found' : 'No systems match filter'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
