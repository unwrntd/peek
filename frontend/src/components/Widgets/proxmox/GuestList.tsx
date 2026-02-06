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

interface GuestListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface GuestData {
  guests: ProxmoxVM[];
}

// Extended type with guaranteed type field
interface GuestItem extends ProxmoxVM {
  type: 'qemu' | 'lxc';
}

// Wrapper for formatUptime to handle missing values
function formatGuestUptime(seconds: number): string {
  if (!seconds) return '-';
  return formatUptime(seconds);
}

export function GuestList({ integrationId, config, widgetId }: GuestListProps) {
  const { rHost } = useRedact();
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<GuestData>({
    integrationId,
    metric: 'guests',
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
  const filteredGuests = useMemo(() => {
    if (!data?.guests) return [];

    return (data.guests as GuestItem[]).filter(guest => {
      // Type filter (VM/LXC)
      const showType = config.showType as string;
      if (showType === 'vms' && guest.type !== 'qemu') return false;
      if (showType === 'lxcs' && guest.type !== 'lxc') return false;

      // Node filter (supports wildcards and comma-separated lists)
      const nodeFilter = config.nodeFilter as string;
      if (nodeFilter && !matchesFilter(guest.node, nodeFilter)) return false;

      // Status filter
      const status = config.status as string;
      if (status && guest.status !== status) return false;

      // Search filter (supports wildcards and comma-separated lists)
      const search = config.search as string;
      if (search && !matchesAnyFilter([guest.name, String(guest.vmid)], search)) {
        return false;
      }

      return true;
    });
  }, [data?.guests, config.showType, config.nodeFilter, config.status, config.search]);

  // Sorting
  type SortKey = 'name' | 'type' | 'status' | 'cpu' | 'memory' | 'disk' | 'uptime' | 'node';
  const getSortValue = useCallback((guest: GuestItem, key: SortKey) => {
    switch (key) {
      case 'name': return guest.name || `${guest.type === 'qemu' ? 'VM' : 'CT'} ${guest.vmid}`;
      case 'type': return guest.type;
      case 'status': return guest.status;
      case 'cpu': return guest.status === 'running' && typeof guest.cpu === 'number' ? guest.cpu : -1;
      case 'memory': return guest.mem;
      case 'disk': return guest.disk || 0;
      case 'uptime': return guest.uptime || 0;
      case 'node': return guest.node;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, GuestItem>(
    filteredGuests as GuestItem[],
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  const maxItems = (config.maxItems as number) || 30;

  // Column visibility (default to true if not set)
  const showTypeCol = config.showTypeCol !== false;
  const showStatus = config.showStatus !== false;
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showDisk = config.showDisk === true; // Default hidden
  const showUptime = config.showUptime !== false;
  const showNode = config.showNode !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'table';

  // Type badge component
  const TypeBadge = ({ type }: { type: 'qemu' | 'lxc' }) => (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
      type === 'qemu'
        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
    }`}>
      {type === 'qemu' ? 'VM' : 'LXC'}
    </span>
  );

  // Card view component
  const renderCardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sortedData.slice(0, maxItems).map(guest => (
        <div
          key={`${guest.node}-${guest.type}-${guest.vmid}`}
          className={`p-3 rounded-lg border transition-colors ${
            guest.status === 'running'
              ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {showTypeCol && <TypeBadge type={guest.type} />}
                <h4 className="font-medium text-gray-900 dark:text-white truncate">
                  {rHost(guest.name) || `${guest.type === 'qemu' ? 'VM' : 'CT'} ${guest.vmid}`}
                </h4>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">ID: {guest.vmid}</p>
            </div>
            {showStatus && <StatusIndicator status={guest.status} />}
          </div>

          {guest.status === 'running' && (showCpu || showMemory) && (
            <div className="space-y-2 mt-3">
              {showCpu && typeof guest.cpu === 'number' && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">CPU</span>
                    <span className="text-gray-700 dark:text-gray-300">{(guest.cpu * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <div
                      className={`h-full rounded-full ${
                        guest.cpu * 100 >= 90 ? 'bg-red-500' : guest.cpu * 100 >= 75 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(guest.cpu * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {showMemory && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Memory</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatBytes(guest.mem)} / {formatBytes(guest.maxmem)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <div
                      className={`h-full rounded-full ${
                        (guest.mem / guest.maxmem) * 100 >= 90 ? 'bg-red-500' : (guest.mem / guest.maxmem) * 100 >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((guest.mem / guest.maxmem) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {showUptime && guest.uptime > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatGuestUptime(guest.uptime)}
              </span>
            )}
            {showNode && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                {rHost(guest.node)}
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
              {showTypeCol && <SortableHeader label="Type" sortKey="type" direction={getSortDirection('type')} onSort={() => requestSort('type')} />}
              {showStatus && <SortableHeader label="Status" sortKey="status" direction={getSortDirection('status')} onSort={() => requestSort('status')} />}
              {showCpu && <SortableHeader label="CPU" sortKey="cpu" direction={getSortDirection('cpu')} onSort={() => requestSort('cpu')} />}
              {showMemory && <SortableHeader label="Memory" sortKey="memory" direction={getSortDirection('memory')} onSort={() => requestSort('memory')} />}
              {showDisk && <SortableHeader label="Disk" sortKey="disk" direction={getSortDirection('disk')} onSort={() => requestSort('disk')} />}
              {showUptime && <SortableHeader label="Uptime" sortKey="uptime" direction={getSortDirection('uptime')} onSort={() => requestSort('uptime')} />}
              {showNode && <SortableHeader label="Node" sortKey="node" direction={getSortDirection('node')} onSort={() => requestSort('node')} />}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {sortedData.slice(0, maxItems).map(guest => (
            <tr key={`${guest.node}-${guest.type}-${guest.vmid}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {rHost(guest.name) || `${guest.type === 'qemu' ? 'VM' : 'CT'} ${guest.vmid}`}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{guest.vmid}</span>
                </div>
              </td>
              {showTypeCol && (
                <td className="py-2">
                  <TypeBadge type={guest.type} />
                </td>
              )}
              {showStatus && (
                <td className="py-2">
                  <StatusIndicator status={guest.status} />
                </td>
              )}
              {showCpu && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {guest.status === 'running' && typeof guest.cpu === 'number' ? `${(guest.cpu * 100).toFixed(1)}%` : '-'}
                </td>
              )}
              {showMemory && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {guest.status === 'running'
                    ? `${formatBytes(guest.mem)} / ${formatBytes(guest.maxmem)}`
                    : formatBytes(guest.maxmem)}
                </td>
              )}
              {showDisk && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {guest.maxdisk > 0
                    ? `${formatBytes(guest.disk || 0)} / ${formatBytes(guest.maxdisk)}`
                    : '-'}
                </td>
              )}
              {showUptime && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatGuestUptime(guest.uptime)}
                </td>
              )}
              {showNode && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  <span className="text-xs">{rHost(guest.node)}</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Get count summary
  const summary = useMemo(() => {
    const guests = (data?.guests || []) as GuestItem[];
    return {
      vms: guests.filter(g => g.type === 'qemu').length,
      lxcs: guests.filter(g => g.type === 'lxc').length,
      running: guests.filter(g => g.status === 'running').length,
    };
  }, [data?.guests]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {visualizationType === 'cards' ? renderCardView() : renderTableView()}
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {(data.guests?.length || 0) === 0 ? 'No guests found' : 'No guests match filters'}
            </p>
          )}
          {sortedData.length > maxItems && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-xs py-2">
              Showing {maxItems} of {sortedData.length} guests ({summary.vms} VMs, {summary.lxcs} LXCs)
            </p>
          )}
        </>
      )}
    </BaseWidget>
  );
}
