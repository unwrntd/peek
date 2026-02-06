import React, { useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { SortableHeader } from '../../common/SortableHeader';
import { BeszelContainerStats } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';
import { formatBytes, formatBytesPerSec } from '../../../utils/formatting';
import { getUsageColor } from '../../../utils/colors';

interface ContainerStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ContainersData {
  containers: BeszelContainerStats[];
}

export function ContainerStats({ integrationId, config, widgetId }: ContainerStatsProps) {
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<ContainersData>({
    integrationId,
    metric: (config.metric as string) || 'container-stats',
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

  // Build the base Beszel URL (containers open base dashboard, not individual pages)
  const getBeszelUrl = () => {
    if (!integrationConfig?.host) return null;
    const protocol = integrationConfig.useHttps === true ? 'https' : 'http';
    const port = integrationConfig.port || 8090;
    return `${protocol}://${integrationConfig.host}:${port}`;
  };

  // Handler to open Beszel URL
  const handleRowClick = () => {
    const url = getBeszelUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Configuration options
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showSystem = config.showSystem !== false;
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showNetwork = config.showNetwork !== false;
  const maxItems = (config.maxItems as number) || 50;

  // Apply filters
  const filteredContainers = data?.containers.filter(container => {
    const search = config.search as string;
    if (search && !matchesAnyFilter([container.name, container.system], search)) {
      return false;
    }

    const systemFilter = config.systemFilter as string;
    if (systemFilter && !matchesAnyFilter([container.system], systemFilter)) {
      return false;
    }

    return true;
  }) || [];

  // Sorting
  type SortKey = 'name' | 'system' | 'cpu' | 'mem' | 'netIn' | 'netOut';
  const getSortValue = useCallback((item: BeszelContainerStats, key: SortKey) => {
    switch (key) {
      case 'name': return item.name;
      case 'system': return item.system;
      case 'cpu': return item.cpu;
      case 'mem': return item.memUsed;
      case 'netIn': return item.netIn;
      case 'netOut': return item.netOut;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, BeszelContainerStats>(
    filteredContainers,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  const displayData = sortedData.slice(0, maxItems);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {!hideLabels && (
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Container" sortKey="name" direction={getSortDirection('name')} onSort={() => requestSort('name')} compact={compactView} />
                  {showSystem && <SortableHeader label="System" sortKey="system" direction={getSortDirection('system')} onSort={() => requestSort('system')} compact={compactView} />}
                  {showCpu && <SortableHeader label="CPU" sortKey="cpu" direction={getSortDirection('cpu')} onSort={() => requestSort('cpu')} align="right" compact={compactView} />}
                  {showMemory && <SortableHeader label="Memory" sortKey="mem" direction={getSortDirection('mem')} onSort={() => requestSort('mem')} align="right" compact={compactView} />}
                  {showNetwork && (
                    <>
                      <SortableHeader label="Net In" sortKey="netIn" direction={getSortDirection('netIn')} onSort={() => requestSort('netIn')} align="right" compact={compactView} />
                      <SortableHeader label="Net Out" sortKey="netOut" direction={getSortDirection('netOut')} onSort={() => requestSort('netOut')} align="right" compact={compactView} />
                    </>
                  )}
                </tr>
              </thead>
            )}
            <tbody>
              {displayData.map(container => {
                const beszelUrl = getBeszelUrl();
                return (
                <tr
                  key={container.id}
                  className={`border-b border-gray-100 dark:border-gray-700 last:border-0 ${beszelUrl ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors' : ''}`}
                  onClick={beszelUrl ? handleRowClick : undefined}
                  title={beszelUrl ? `Open Beszel dashboard` : undefined}
                >
                  <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                    <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]" title={container.name}>
                      {container.name}
                    </div>
                  </td>
                  {showSystem && (
                    <td className={`${compactView ? 'py-1' : 'py-2'} text-gray-600 dark:text-gray-300`}>
                      {container.system}
                    </td>
                  )}
                  {showCpu && (
                    <td className={`${compactView ? 'py-1' : 'py-2'} text-right ${getUsageColor(container.cpu)}`}>
                      {container.cpu.toFixed(1)}%
                    </td>
                  )}
                  {showMemory && (
                    <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-gray-600 dark:text-gray-300`}>
                      {formatBytes(container.memUsed)}
                    </td>
                  )}
                  {showNetwork && (
                    <>
                      <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-green-600 dark:text-green-400`}>
                        {formatBytesPerSec(container.netIn)}
                      </td>
                      <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-blue-600 dark:text-blue-400`}>
                        {formatBytesPerSec(container.netOut)}
                      </td>
                    </>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
          {displayData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.containers.length === 0 ? 'No containers found' : 'No containers match filter'}
            </p>
          )}
          {sortedData.length > maxItems && (
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
              Showing {maxItems} of {sortedData.length} containers
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
