import React, { useMemo, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { useDashboardStore } from '../../../stores/dashboardStore';

interface InterfaceListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface CiscoInterface {
  name: string;
  operStatus: 'up' | 'down' | 'testing' | 'dormant' | 'notPresent' | 'lowerLayerDown' | 'unknown';
  adminStatus: 'up' | 'down';
  speed: number;
  inOctets: number;
  outOctets: number;
  inErrors: number;
  outErrors: number;
  description?: string;
}

interface InterfaceData {
  interfaces: CiscoInterface[];
}

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return '0 B';
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function InterfaceList({ integrationId, config, widgetId }: InterfaceListProps) {
  const { data, loading, error } = useWidgetData<InterfaceData>({
    integrationId,
    metric: (config.metric as string) || 'interfaces',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const { updateWidget } = useDashboardStore();

  // Read sort state from config with defaults
  const sortField = (config.sortField as string) || 'name';
  const sortDirection = (config.sortDirection as 'asc' | 'desc') || 'asc';

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const statusFilter = (config.statusFilter as string) || '';
  const search = (config.search as string) || '';
  const showStatus = config.showStatus !== false;
  const showSpeed = config.showSpeed !== false;
  const showInBytes = config.showInBytes !== false;
  const showOutBytes = config.showOutBytes !== false;
  const showErrors = config.showErrors !== false;

  const filteredInterfaces = useMemo(() => {
    if (!data?.interfaces) return [];

    let filtered = data.interfaces;

    if (statusFilter) {
      filtered = filtered.filter(iface => iface.operStatus === statusFilter);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(iface =>
        iface.name.toLowerCase().includes(searchLower) ||
        (iface.description?.toLowerCase().includes(searchLower))
      );
    }

    filtered.sort((a, b) => {
      let aVal: string | number = a[sortField as keyof CiscoInterface] as string | number;
      let bVal: string | number = b[sortField as keyof CiscoInterface] as string | number;

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data?.interfaces, statusFilter, search, sortField, sortDirection]);

  const formatSpeed = (speed: number): string => {
    if (!speed || speed === 0) return '-';
    if (speed >= 1000000000) return `${(speed / 1000000000).toFixed(0)} Gbps`;
    if (speed >= 1000000) return `${(speed / 1000000).toFixed(0)} Mbps`;
    if (speed >= 1000) return `${(speed / 1000).toFixed(0)} Kbps`;
    return `${speed} bps`;
  };

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
                <th
                  className="text-left py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('name')}
                >
                  Interface<SortIcon field="name" />
                </th>
                {showStatus && (
                  <th
                    className="text-center py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('operStatus')}
                  >
                    Status<SortIcon field="operStatus" />
                  </th>
                )}
                {showSpeed && (
                  <th
                    className="text-right py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('speed')}
                  >
                    Speed<SortIcon field="speed" />
                  </th>
                )}
                {showInBytes && (
                  <th
                    className="text-right py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('inOctets')}
                  >
                    In<SortIcon field="inOctets" />
                  </th>
                )}
                {showOutBytes && (
                  <th
                    className="text-right py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('outOctets')}
                  >
                    Out<SortIcon field="outOctets" />
                  </th>
                )}
                {showErrors && (
                  <th
                    className="text-right py-2 px-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => handleSort('inErrors')}
                  >
                    Errors<SortIcon field="inErrors" />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredInterfaces.map((iface) => (
                <tr
                  key={iface.name}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="py-2 px-2">
                    <div className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                      {iface.name}
                    </div>
                    {iface.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                        {iface.description}
                      </div>
                    )}
                  </td>
                  {showStatus && (
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        iface.operStatus === 'up'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {iface.operStatus}
                      </span>
                    </td>
                  )}
                  {showSpeed && (
                    <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                      {formatSpeed(iface.speed)}
                    </td>
                  )}
                  {showInBytes && (
                    <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                      {formatBytes(iface.inOctets || 0)}
                    </td>
                  )}
                  {showOutBytes && (
                    <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                      {formatBytes(iface.outOctets || 0)}
                    </td>
                  )}
                  {showErrors && (
                    <td className="py-2 px-2 text-right">
                      <span className={`${
                        ((iface.inErrors || 0) + (iface.outErrors || 0)) > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {(iface.inErrors || 0) + (iface.outErrors || 0)}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredInterfaces.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No interfaces found
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
