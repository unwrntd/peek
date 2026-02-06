import React, { useCallback, useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { StatusIndicator } from '../../common/StatusIndicator';
import { SortableHeader } from '../../common/SortableHeader';
import { ProxmoxVM } from '../../../types';
import { matchesFilter, matchesAnyFilter } from '../../../utils/filterUtils';
import { formatBytes, formatUptime } from '../../../utils/formatting';

interface ContainerListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ContainerData {
  containers: ProxmoxVM[];
}

// Wrapper for formatUptime to handle missing values
function formatContainerUptime(seconds: number): string {
  if (!seconds) return '-';
  return formatUptime(seconds);
}

export function ContainerList({ integrationId, config, widgetId }: ContainerListProps) {
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<ContainerData>({
    integrationId,
    metric: (config.metric as string) || 'containers',
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

  // Apply filters - memoized for performance
  const filteredContainers = useMemo(() => {
    if (!data?.containers) return [];

    return data.containers.filter(ct => {
      // Node filter (supports wildcards and comma-separated lists)
      const nodeFilter = config.nodeFilter as string;
      if (nodeFilter && !matchesFilter(ct.node, nodeFilter)) return false;

      // Status filter
      const status = config.status as string;
      if (status && ct.status !== status) return false;

      // Search filter (supports wildcards and comma-separated lists)
      const search = config.search as string;
      if (search && !matchesAnyFilter([ct.name, String(ct.vmid)], search)) {
        return false;
      }

      return true;
    });
  }, [data?.containers, config.nodeFilter, config.status, config.search]);

  // Sorting
  type SortKey = 'name' | 'status' | 'cpu' | 'memory' | 'uptime' | 'node';
  const getSortValue = useCallback((ct: ProxmoxVM, key: SortKey) => {
    switch (key) {
      case 'name': return ct.name || `CT ${ct.vmid}`;
      case 'status': return ct.status;
      case 'cpu': return ct.status === 'running' && typeof ct.cpu === 'number' ? ct.cpu : -1;
      case 'memory': return ct.mem;
      case 'uptime': return ct.uptime || 0;
      case 'node': return ct.node;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, ProxmoxVM>(
    filteredContainers,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  const maxItems = (config.maxItems as number) || 20;

  // Column visibility (default to true if not set)
  const showStatus = config.showStatus !== false;
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showUptime = config.showUptime !== false;
  const showNode = config.showNode !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'table';

  // Card view component
  const renderCardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sortedData.slice(0, maxItems).map(ct => (
        <div
          key={`${ct.node}-${ct.vmid}`}
          className={`p-3 rounded-lg border transition-colors ${
            ct.status === 'running'
              ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {ct.name || `CT ${ct.vmid}`}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">ID: {ct.vmid}</p>
            </div>
            {showStatus && <StatusIndicator status={ct.status} />}
          </div>

          {ct.status === 'running' && (showCpu || showMemory) && (
            <div className="space-y-2 mt-3">
              {showCpu && typeof ct.cpu === 'number' && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">CPU</span>
                    <span className="text-gray-700 dark:text-gray-300">{(ct.cpu * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <div
                      className={`h-full rounded-full ${
                        ct.cpu * 100 >= 90 ? 'bg-red-500' : ct.cpu * 100 >= 75 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(ct.cpu * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {showMemory && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Memory</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatBytes(ct.mem)} / {formatBytes(ct.maxmem)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <div
                      className={`h-full rounded-full ${
                        (ct.mem / ct.maxmem) * 100 >= 90 ? 'bg-red-500' : (ct.mem / ct.maxmem) * 100 >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((ct.mem / ct.maxmem) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {showUptime && ct.uptime > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatContainerUptime(ct.uptime)}
              </span>
            )}
            {showNode && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                {ct.node}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Table view component
  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        {!hideLabels && (
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <SortableHeader label="Name" sortKey="name" direction={getSortDirection('name')} onSort={() => requestSort('name')} />
              {showStatus && <SortableHeader label="Status" sortKey="status" direction={getSortDirection('status')} onSort={() => requestSort('status')} />}
              {showCpu && <SortableHeader label="CPU" sortKey="cpu" direction={getSortDirection('cpu')} onSort={() => requestSort('cpu')} />}
              {showMemory && <SortableHeader label="Memory" sortKey="memory" direction={getSortDirection('memory')} onSort={() => requestSort('memory')} />}
              {showUptime && <SortableHeader label="Uptime" sortKey="uptime" direction={getSortDirection('uptime')} onSort={() => requestSort('uptime')} />}
              {showNode && <SortableHeader label="Node" sortKey="node" direction={getSortDirection('node')} onSort={() => requestSort('node')} />}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {sortedData.slice(0, maxItems).map(ct => (
            <tr key={`${ct.node}-${ct.vmid}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{ct.name || `CT ${ct.vmid}`}</span>
                  <span className="text-xs text-gray-400 ml-2">{ct.vmid}</span>
                </div>
              </td>
              {showStatus && (
                <td className="py-2">
                  <StatusIndicator status={ct.status} />
                </td>
              )}
              {showCpu && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {ct.status === 'running' && typeof ct.cpu === 'number' ? `${(ct.cpu * 100).toFixed(1)}%` : '-'}
                </td>
              )}
              {showMemory && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {ct.status === 'running'
                    ? `${formatBytes(ct.mem)} / ${formatBytes(ct.maxmem)}`
                    : formatBytes(ct.maxmem)}
                </td>
              )}
              {showUptime && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatContainerUptime(ct.uptime)}
                </td>
              )}
              {showNode && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  <span className="text-xs">{ct.node}</span>
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
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.containers.length === 0 ? 'No containers found' : 'No containers match filters'}
            </p>
          )}
          {sortedData.length > maxItems && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-xs py-2">
              Showing {maxItems} of {sortedData.length} containers
            </p>
          )}
        </>
      )}
    </BaseWidget>
  );
}
