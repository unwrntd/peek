import React, { useCallback, useMemo, useState } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { SortableHeader } from '../../common/SortableHeader';
import { QnapVolume } from '../../../types';
import { formatBytes } from '../../../utils/formatting';

interface VolumeStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface VolumeData {
  volumes: QnapVolume[];
}

function getStatusBadge(status: string): string {
  const statusLower = status.toLowerCase();
  if (statusLower === 'ready' || statusLower === 'active') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  }
  if (statusLower === 'degraded') {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  }
  if (statusLower === 'rebuilding' || statusLower === 'syncing') {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
  }
  if (statusLower === 'error' || statusLower === 'failed') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

function getUsageColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-yellow-500';
  return 'bg-blue-500';
}

function getUsageTextColor(percent: number): string {
  if (percent >= 90) return 'text-red-600 dark:text-red-400';
  if (percent >= 75) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-900 dark:text-white';
}

function getRaidBadge(raidType: string): string {
  const raid = raidType.toUpperCase();
  if (raid.includes('RAID0')) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
  if (raid.includes('RAID1')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
  if (raid.includes('RAID5')) return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
  if (raid.includes('RAID6')) return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400';
  if (raid.includes('RAID10')) return 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

export function VolumeStatus({ integrationId, config, widgetId }: VolumeStatusProps) {
  const { updateWidget } = useDashboardStore();
  const [showVolumeSelector, setShowVolumeSelector] = useState(false);

  const { data, loading, error } = useWidgetData<VolumeData>({
    integrationId,
    metric: (config.metric as string) || 'volumes',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  // Configuration options
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showStatus = config.showStatus !== false;
  const showRaidType = config.showRaidType !== false;
  const showUsageBar = config.showUsageBar !== false;
  const showCapacity = config.showCapacity !== false;
  const showSummary = config.showSummary !== false;
  const visualization = (config.visualization as string) || 'cards';

  // Volume selection - stored as array of enabled volume IDs
  // If empty or undefined, all volumes are shown
  const enabledVolumes = (config.enabledVolumes as string[]) || [];
  const hasVolumeSelection = enabledVolumes.length > 0;

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

  // Toggle volume selection
  const handleVolumeToggle = useCallback((volumeId: string) => {
    if (!widgetId) return;

    const currentEnabled = (config.enabledVolumes as string[]) || [];
    const allVolumeIds = data?.volumes.map(v => v.id) || [];

    let newEnabled: string[];

    if (currentEnabled.length === 0) {
      // First time selecting - start with all volumes except the one being unchecked
      newEnabled = allVolumeIds.filter(id => id !== volumeId);
    } else if (currentEnabled.includes(volumeId)) {
      // Remove from enabled
      newEnabled = currentEnabled.filter(id => id !== volumeId);
    } else {
      // Add to enabled
      newEnabled = [...currentEnabled, volumeId];
    }

    // If all volumes are now enabled, clear the selection (show all)
    if (newEnabled.length === allVolumeIds.length) {
      newEnabled = [];
    }

    updateWidget(widgetId, {
      config: { ...config, enabledVolumes: newEnabled }
    });
  }, [widgetId, config, data?.volumes, updateWidget]);

  // Select/deselect all volumes
  const handleSelectAll = useCallback((selectAll: boolean) => {
    if (!widgetId) return;

    if (selectAll) {
      // Clear selection to show all
      updateWidget(widgetId, {
        config: { ...config, enabledVolumes: [] }
      });
    } else {
      // Deselect all - set to empty array but with a marker
      updateWidget(widgetId, {
        config: { ...config, enabledVolumes: ['__none__'] }
      });
    }
  }, [widgetId, config, updateWidget]);

  // Check if a volume is enabled
  const isVolumeEnabled = useCallback((volumeId: string) => {
    if (enabledVolumes.length === 0) return true; // All enabled when no selection
    if (enabledVolumes.includes('__none__')) return false; // None selected
    return enabledVolumes.includes(volumeId);
  }, [enabledVolumes]);

  // Apply filters
  const filteredVolumes = useMemo(() => {
    if (!data?.volumes) return [];

    return data.volumes.filter(volume => {
      // Status filter
      const statusFilter = config.status as string;
      if (statusFilter && volume.status.toLowerCase() !== statusFilter.toLowerCase()) return false;

      // Volume selection filter (checkboxes)
      if (!isVolumeEnabled(volume.id)) return false;

      return true;
    });
  }, [data?.volumes, config.status, isVolumeEnabled]);

  // Sorting
  type SortKey = 'name' | 'status' | 'raidType' | 'usagePercent' | 'totalSize' | 'usedSize' | 'freeSize';
  const getSortValue = useCallback((volume: QnapVolume, key: SortKey) => {
    switch (key) {
      case 'name': return volume.name;
      case 'status': return volume.status;
      case 'raidType': return volume.raidType;
      case 'usagePercent': return volume.usagePercent;
      case 'totalSize': return volume.totalSize;
      case 'usedSize': return volume.usedSize;
      case 'freeSize': return volume.freeSize;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, QnapVolume>(
    filteredVolumes,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  // Count enabled volumes for the badge
  const enabledCount = useMemo(() => {
    if (!data?.volumes) return 0;
    if (enabledVolumes.length === 0) return data.volumes.length;
    if (enabledVolumes.includes('__none__')) return 0;
    return enabledVolumes.length;
  }, [data?.volumes, enabledVolumes]);

  // Calculate totals for summary
  const totals = useMemo(() => {
    const totalUsed = sortedData.reduce((sum, v) => sum + v.usedSize, 0);
    const totalFree = sortedData.reduce((sum, v) => sum + v.freeSize, 0);
    const totalSize = sortedData.reduce((sum, v) => sum + v.totalSize, 0);
    const avgUsage = totalSize > 0 ? (totalUsed / totalSize) * 100 : 0;
    return { totalUsed, totalFree, totalSize, avgUsage };
  }, [sortedData]);

  // Volume selector panel
  const renderVolumeSelector = () => {
    if (!data?.volumes || data.volumes.length === 0) return null;

    const allSelected = enabledVolumes.length === 0;
    const noneSelected = enabledVolumes.includes('__none__');

    return (
      <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Select Volumes</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleSelectAll(true)}
              className={`text-xs px-2 py-0.5 rounded ${
                allSelected
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleSelectAll(false)}
              className={`text-xs px-2 py-0.5 rounded ${
                noneSelected
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              None
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.volumes.map(volume => (
            <label
              key={volume.id}
              className="flex items-center gap-1.5 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={isVolumeEnabled(volume.id)}
                onChange={() => handleVolumeToggle(volume.id)}
                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                {volume.name}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  // Table View
  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {!hideLabels && (
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <SortableHeader
                label="Volume"
                sortKey="name"
                direction={getSortDirection('name')}
                onSort={() => requestSort('name')}
                compact={compactView}
              />
              {showStatus && (
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  direction={getSortDirection('status')}
                  onSort={() => requestSort('status')}
                  compact={compactView}
                />
              )}
              {showRaidType && (
                <SortableHeader
                  label="RAID"
                  sortKey="raidType"
                  direction={getSortDirection('raidType')}
                  onSort={() => requestSort('raidType')}
                  compact={compactView}
                />
              )}
              {showUsageBar && (
                <SortableHeader
                  label="Usage"
                  sortKey="usagePercent"
                  direction={getSortDirection('usagePercent')}
                  onSort={() => requestSort('usagePercent')}
                  compact={compactView}
                  className="w-32"
                />
              )}
              {showCapacity && (
                <>
                  <SortableHeader
                    label="Used"
                    sortKey="usedSize"
                    direction={getSortDirection('usedSize')}
                    onSort={() => requestSort('usedSize')}
                    align="right"
                    compact={compactView}
                  />
                  <SortableHeader
                    label="Free"
                    sortKey="freeSize"
                    direction={getSortDirection('freeSize')}
                    onSort={() => requestSort('freeSize')}
                    align="right"
                    compact={compactView}
                  />
                  <SortableHeader
                    label="Total"
                    sortKey="totalSize"
                    direction={getSortDirection('totalSize')}
                    onSort={() => requestSort('totalSize')}
                    align="right"
                    compact={compactView}
                  />
                </>
              )}
            </tr>
          </thead>
        )}
        <tbody>
          {sortedData.map((volume) => (
            <tr key={volume.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className={`${compactView ? 'py-1' : 'py-2'} font-medium text-gray-900 dark:text-white`}>
                {volume.name}
              </td>
              {showStatus && (
                <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusBadge(volume.status)}`}>
                    {volume.status}
                  </span>
                </td>
              )}
              {showRaidType && (
                <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getRaidBadge(volume.raidType)}`}>
                    {volume.raidType}
                  </span>
                </td>
              )}
              {showUsageBar && (
                <td className={`${compactView ? 'py-1' : 'py-2'}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getUsageColor(volume.usagePercent)} transition-all`}
                        style={{ width: `${Math.min(volume.usagePercent, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs w-10 text-right ${getUsageTextColor(volume.usagePercent)}`}>
                      {volume.usagePercent.toFixed(0)}%
                    </span>
                  </div>
                </td>
              )}
              {showCapacity && (
                <>
                  <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-gray-600 dark:text-gray-300 text-xs`}>
                    {formatBytes(volume.usedSize)}
                  </td>
                  <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-gray-600 dark:text-gray-300 text-xs`}>
                    {formatBytes(volume.freeSize)}
                  </td>
                  <td className={`${compactView ? 'py-1' : 'py-2'} text-right text-gray-600 dark:text-gray-300 text-xs`}>
                    {formatBytes(volume.totalSize)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Cards View (original implementation)
  const renderCardsView = () => (
    <div className={`space-y-${compactView ? '2' : '3'}`}>
      {sortedData.map((volume) => (
        <div
          key={volume.id}
          className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {volume.name}
                </span>
                {showStatus && (
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusBadge(volume.status)}`}>
                    {volume.status}
                  </span>
                )}
                {showRaidType && (
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getRaidBadge(volume.raidType)}`}>
                    {volume.raidType}
                  </span>
                )}
              </div>

              {showUsageBar && (
                <div className="mt-2">
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                    <div
                      className={`h-full ${getUsageColor(volume.usagePercent)} rounded-full transition-all`}
                      style={{ width: `${Math.min(volume.usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="text-right flex-shrink-0">
              <div className={`font-medium ${getUsageTextColor(volume.usagePercent)}`}>
                {volume.usagePercent.toFixed(1)}%
              </div>
            </div>
          </div>

          {showCapacity && !compactView && (
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Used: {formatBytes(volume.usedSize)}</span>
              <span>Free: {formatBytes(volume.freeSize)}</span>
              <span>Total: {formatBytes(volume.totalSize)}</span>
            </div>
          )}

          {showCapacity && compactView && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formatBytes(volume.usedSize)} / {formatBytes(volume.totalSize)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Bars View (compact usage bars only)
  const renderBarsView = () => (
    <div className={`space-y-${compactView ? '1' : '2'}`}>
      {sortedData.map((volume) => (
        <div key={volume.id} className="flex items-center gap-3">
          <div className={`${compactView ? 'w-20' : 'w-24'} font-medium text-gray-900 dark:text-white truncate text-sm`}>
            {volume.name}
          </div>
          <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              className={`h-full ${getUsageColor(volume.usagePercent)} transition-all`}
              style={{ width: `${Math.min(volume.usagePercent, 100)}%` }}
            />
          </div>
          <div className={`w-12 text-right text-sm font-medium ${getUsageTextColor(volume.usagePercent)}`}>
            {volume.usagePercent.toFixed(0)}%
          </div>
          {!compactView && showCapacity && (
            <div className="w-36 text-right text-xs text-gray-500 dark:text-gray-400">
              {formatBytes(volume.usedSize)} / {formatBytes(volume.totalSize)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Render based on visualization type
  const renderContent = () => {
    switch (visualization) {
      case 'table':
        return renderTableView();
      case 'bars':
        return renderBarsView();
      case 'cards':
      default:
        return renderCardsView();
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {/* Volume selector toggle */}
          {data.volumes.length >= 1 && (
            <div className="mb-2">
              <button
                onClick={() => setShowVolumeSelector(!showVolumeSelector)}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showVolumeSelector ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>
                  {hasVolumeSelection
                    ? `${enabledCount} of ${data.volumes.length} volumes`
                    : data.volumes.length === 1
                      ? '1 volume'
                      : `All ${data.volumes.length} volumes`}
                </span>
              </button>
            </div>
          )}

          {/* Volume selector panel */}
          {showVolumeSelector && renderVolumeSelector()}

          {/* Main content */}
          {renderContent()}

          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.volumes.length === 0 ? 'No volumes found' : 'No volumes selected'}
            </p>
          )}

          {/* Summary section */}
          {showSummary && sortedData.length > 0 && (
            <div className={`${compactView ? 'mt-2 pt-2' : 'mt-3 pt-3'} border-t border-gray-200 dark:border-gray-700`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Total ({sortedData.length} volume{sortedData.length !== 1 ? 's' : ''})
                </span>
                <span className={`text-sm font-medium ${getUsageTextColor(totals.avgUsage)}`}>
                  {totals.avgUsage.toFixed(1)}% used
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getUsageColor(totals.avgUsage)} transition-all`}
                    style={{ width: `${Math.min(totals.avgUsage, 100)}%` }}
                  />
                </div>
              </div>
              <div className={`mt-1 flex items-center ${compactView ? 'gap-2' : 'gap-4'} text-xs text-gray-500 dark:text-gray-400`}>
                <span>Used: {formatBytes(totals.totalUsed)}</span>
                <span>Free: {formatBytes(totals.totalFree)}</span>
                <span>Total: {formatBytes(totals.totalSize)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </BaseWidget>
  );
}
