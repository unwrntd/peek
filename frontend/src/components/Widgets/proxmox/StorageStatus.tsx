import React, { useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { SortableHeader } from '../../common/SortableHeader';
import { ProxmoxStorage } from '../../../types';
import { matchesFilter } from '../../../utils/filterUtils';
import { formatBytes } from '../../../utils/formatting';
import { getUsageColor, getProgressColor } from '../../../utils/colors';

interface StorageStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface StorageData {
  storage: ProxmoxStorage[];
}

export function StorageStatus({ integrationId, config, widgetId }: StorageStatusProps) {
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<StorageData>({
    integrationId,
    metric: (config.metric as string) || 'storage',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Read sort state from config
  const configSortKey = (config.sortField as string) || 'storage';
  const configSortDirection = (config.sortDirection as SortDirection) || 'asc';

  // Callback to persist sort changes to widget config
  const handleSortChange = useCallback((key: string | null, direction: SortDirection) => {
    if (!widgetId) return;
    updateWidget(widgetId, {
      config: { ...config, sortField: key, sortDirection: direction }
    });
  }, [widgetId, config, updateWidget]);

  // Configuration options with defaults
  const showUsageBar = config.showUsageBar !== false;
  const showType = config.showType !== false;
  const showContent = config.showContent !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;

  // Apply filters (supports wildcards and comma-separated lists)
  const filteredStorage = data?.storage.filter(item => {
    const nodeFilter = config.nodeFilter as string;
    if (nodeFilter && !matchesFilter(item.node, nodeFilter)) return false;

    const storageType = config.storageType as string;
    if (storageType && item.type !== storageType) return false;

    const showDisabled = config.showDisabled as boolean;
    if (!showDisabled && !item.enabled) return false;

    const showInactive = config.showInactive as boolean;
    if (!showInactive && !item.active) return false;

    return true;
  }) || [];

  // Sorting
  type SortKey = 'storage' | 'type' | 'content' | 'used' | 'total' | 'usage';
  const getSortValue = useCallback((item: ProxmoxStorage, key: SortKey) => {
    switch (key) {
      case 'storage': return item.storage;
      case 'type': return item.type;
      case 'content': return item.content;
      case 'used': return item.used;
      case 'total': return item.total;
      case 'usage': return item.total > 0 ? (item.used / item.total) * 100 : 0;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, ProxmoxStorage>(
    filteredStorage,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {!hideLabels && (
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Storage" sortKey="storage" direction={getSortDirection('storage')} onSort={() => requestSort('storage')} compact={compactView} />
                  {showType && <SortableHeader label="Type" sortKey="type" direction={getSortDirection('type')} onSort={() => requestSort('type')} compact={compactView} />}
                  {showContent && <SortableHeader label="Content" sortKey="content" direction={getSortDirection('content')} onSort={() => requestSort('content')} compact={compactView} />}
                  <SortableHeader label="Used" sortKey="used" direction={getSortDirection('used')} onSort={() => requestSort('used')} align="right" compact={compactView} />
                  <SortableHeader label="Total" sortKey="total" direction={getSortDirection('total')} onSort={() => requestSort('total')} align="right" compact={compactView} />
                  {showUsageBar && <SortableHeader label="Usage" sortKey="usage" direction={getSortDirection('usage')} onSort={() => requestSort('usage')} compact={compactView} className="w-24" />}
                </tr>
              </thead>
            )}
            <tbody>
              {sortedData.map((storage) => {
                const usagePercent = storage.total > 0 ? (storage.used / storage.total) * 100 : 0;
                return (
                  <tr key={`${storage.node}-${storage.storage}`} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                      <div className="font-medium text-gray-900 dark:text-white">{storage.storage}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{storage.node}</div>
                    </td>
                    {showType && (
                      <td className={`${compactView ? 'py-1' : 'py-2'} text-gray-600 dark:text-gray-300`}>
                        {storage.type}
                      </td>
                    )}
                    {showContent && (
                      <td className={`${compactView ? 'py-1' : 'py-2'} text-gray-600 dark:text-gray-300 text-xs`}>
                        {storage.content}
                      </td>
                    )}
                    <td className={`${compactView ? 'py-1' : 'py-2'} text-right ${getUsageColor(usagePercent)}`}>
                      {formatBytes(storage.used)}
                    </td>
                    <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-gray-600 dark:text-gray-300`}>
                      {formatBytes(storage.total)}
                    </td>
                    {showUsageBar && (
                      <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(usagePercent)} transition-all`}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                            {usagePercent.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.storage.length === 0 ? 'No storage found' : 'No storage matches filter'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
