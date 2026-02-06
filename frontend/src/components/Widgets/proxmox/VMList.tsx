import React, { useCallback, useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useRedact } from '../../../hooks/useRedact';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { StatusIndicator } from '../../common/StatusIndicator';
import { SortableHeader } from '../../common/SortableHeader';
import { ProxmoxVM } from '../../../types';
import { matchesFilter, matchesAnyFilter } from '../../../utils/filterUtils';
import { formatBytes, formatUptime } from '../../../utils/formatting';

interface VMListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface VMData {
  vms: ProxmoxVM[];
}

// Wrapper for formatUptime to handle missing values
function formatVmUptime(seconds: number): string {
  if (!seconds) return '-';
  return formatUptime(seconds);
}

export function VMList({ integrationId, config, widgetId }: VMListProps) {
  const { rHost } = useRedact();
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<VMData>({
    integrationId,
    metric: (config.metric as string) || 'vms',
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
  const filteredVMs = useMemo(() => {
    if (!data?.vms) return [];

    return data.vms.filter(vm => {
      // Node filter (supports wildcards and comma-separated lists)
      const nodeFilter = config.nodeFilter as string;
      if (nodeFilter && !matchesFilter(vm.node, nodeFilter)) return false;

      // Status filter
      const status = config.status as string;
      if (status && vm.status !== status) return false;

      // Search filter (supports wildcards and comma-separated lists)
      const search = config.search as string;
      if (search && !matchesAnyFilter([vm.name, String(vm.vmid)], search)) {
        return false;
      }

      return true;
    });
  }, [data?.vms, config.nodeFilter, config.status, config.search]);

  // Sorting
  type SortKey = 'name' | 'status' | 'cpu' | 'memory' | 'uptime' | 'node';
  const getSortValue = useCallback((vm: ProxmoxVM, key: SortKey) => {
    switch (key) {
      case 'name': return vm.name || `VM ${vm.vmid}`;
      case 'status': return vm.status;
      case 'cpu': return vm.status === 'running' ? vm.cpu : -1;
      case 'memory': return vm.mem;
      case 'uptime': return vm.uptime || 0;
      case 'node': return vm.node;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, ProxmoxVM>(
    filteredVMs,
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
      {sortedData.slice(0, maxItems).map(vm => (
        <div
          key={`${vm.node}-${vm.vmid}`}
          className={`p-3 rounded-lg border transition-colors ${
            vm.status === 'running'
              ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {rHost(vm.name) || `VM ${vm.vmid}`}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">ID: {vm.vmid}</p>
            </div>
            {showStatus && <StatusIndicator status={vm.status} />}
          </div>

          {vm.status === 'running' && (showCpu || showMemory) && (
            <div className="space-y-2 mt-3">
              {showCpu && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">CPU</span>
                    <span className="text-gray-700 dark:text-gray-300">{(vm.cpu * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <div
                      className={`h-full rounded-full ${
                        vm.cpu * 100 >= 90 ? 'bg-red-500' : vm.cpu * 100 >= 75 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(vm.cpu * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {showMemory && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Memory</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatBytes(vm.mem)} / {formatBytes(vm.maxmem)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <div
                      className={`h-full rounded-full ${
                        (vm.mem / vm.maxmem) * 100 >= 90 ? 'bg-red-500' : (vm.mem / vm.maxmem) * 100 >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((vm.mem / vm.maxmem) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {showUptime && vm.uptime > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatVmUptime(vm.uptime)}
              </span>
            )}
            {showNode && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                {rHost(vm.node)}
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
          {sortedData.slice(0, maxItems).map(vm => (
            <tr key={`${vm.node}-${vm.vmid}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{rHost(vm.name) || `VM ${vm.vmid}`}</span>
                  <span className="text-xs text-gray-400 ml-2">{vm.vmid}</span>
                </div>
              </td>
              {showStatus && (
                <td className="py-2">
                  <StatusIndicator status={vm.status} />
                </td>
              )}
              {showCpu && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {vm.status === 'running' ? `${(vm.cpu * 100).toFixed(1)}%` : '-'}
                </td>
              )}
              {showMemory && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {vm.status === 'running'
                    ? `${formatBytes(vm.mem)} / ${formatBytes(vm.maxmem)}`
                    : formatBytes(vm.maxmem)}
                </td>
              )}
              {showUptime && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatVmUptime(vm.uptime)}
                </td>
              )}
              {showNode && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  <span className="text-xs">{rHost(vm.node)}</span>
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
              {data.vms.length === 0 ? 'No VMs found' : 'No VMs match filters'}
            </p>
          )}
          {sortedData.length > maxItems && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-xs py-2">
              Showing {maxItems} of {sortedData.length} VMs
            </p>
          )}
        </>
      )}
    </BaseWidget>
  );
}
