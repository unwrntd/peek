import React, { useMemo, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { useDashboardStore } from '../../../stores/dashboardStore';

interface VlanListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface CiscoVlan {
  id: number;
  name: string;
  status: 'active' | 'suspended';
  ports: string[];
}

interface VlanData {
  vlans: CiscoVlan[];
}

export function VlanList({ integrationId, config, widgetId }: VlanListProps) {
  const { data, loading, error } = useWidgetData<VlanData>({
    integrationId,
    metric: (config.metric as string) || 'vlans',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const { updateWidget } = useDashboardStore();

  // Read sort state from config with defaults
  const sortField = (config.sortField as string) || 'id';
  const sortDirection = (config.sortDirection as 'asc' | 'desc') || 'asc';

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const statusFilter = (config.statusFilter as string) || '';
  const search = (config.search as string) || '';
  const showId = config.showId !== false;
  const showName = config.showName !== false;
  const showStatus = config.showStatus !== false;
  const showPorts = config.showPorts !== false;

  const filteredVlans = useMemo(() => {
    if (!data?.vlans) return [];

    let filtered = data.vlans;

    if (statusFilter) {
      filtered = filtered.filter(vlan => vlan.status === statusFilter);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(vlan =>
        vlan.id.toString().includes(searchLower) ||
        vlan.name.toLowerCase().includes(searchLower)
      );
    }

    filtered.sort((a, b) => {
      let aVal: string | number = a[sortField as keyof CiscoVlan] as string | number;
      let bVal: string | number = b[sortField as keyof CiscoVlan] as string | number;

      if (sortField === 'ports') {
        aVal = a.ports.length;
        bVal = b.ports.length;
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data?.vlans, statusFilter, search, sortField, sortDirection]);

  const handleSort = useCallback((field: string) => {
    if (!widgetId) return;

    const newDirection = sortField === field
      ? (sortDirection === 'asc' ? 'desc' : 'asc')
      : 'asc';
    const newField = field;

    updateWidget(widgetId, {
      config: { ...config, sortField: newField, sortDirection: newDirection }
    });
  }, [widgetId, sortField, sortDirection, config, updateWidget]);

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`${compactView ? 'p-1' : 'p-2'} overflow-auto h-full`}>
          <table className="w-full text-sm">
            <thead className={`${hideLabels ? 'hidden' : ''}`}>
              <tr className="text-gray-500 dark:text-gray-400 text-xs border-b border-gray-200 dark:border-gray-700">
                {showId && (
                  <th
                    className="text-left py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('id')}
                  >
                    VLAN<SortIcon field="id" />
                  </th>
                )}
                {showName && (
                  <th
                    className="text-left py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('name')}
                  >
                    Name<SortIcon field="name" />
                  </th>
                )}
                {showStatus && (
                  <th
                    className="text-center py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('status')}
                  >
                    Status<SortIcon field="status" />
                  </th>
                )}
                {showPorts && (
                  <th
                    className="text-right py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('ports')}
                  >
                    Ports<SortIcon field="ports" />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredVlans.map((vlan) => (
                <tr
                  key={vlan.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  {showId && (
                    <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">
                      {vlan.id}
                    </td>
                  )}
                  {showName && (
                    <td className="py-2 px-2 text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                      {vlan.name}
                    </td>
                  )}
                  {showStatus && (
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        vlan.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {vlan.status}
                      </span>
                    </td>
                  )}
                  {showPorts && (
                    <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                      {vlan.ports.length}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVlans.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No VLANs found
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
