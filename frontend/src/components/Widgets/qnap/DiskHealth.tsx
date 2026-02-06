import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { QnapDisk } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';
import { formatBytes } from '../../../utils/formatting';
import { getTempColor } from '../../../utils/colors';

interface DiskHealthProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DiskData {
  disks: QnapDisk[];
}

function getHealthBadge(health: string): string {
  const healthLower = health.toLowerCase();
  if (healthLower === 'good' || healthLower === 'ok' || healthLower === 'passed') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  }
  if (healthLower === 'warning' || healthLower === 'unknown') {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  }
  if (healthLower === 'error' || healthLower === 'failed' || healthLower === 'bad') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

function getSmartBadge(smartStatus: string): string {
  const smart = smartStatus.toLowerCase();
  if (smart === 'normal' || smart === 'ok' || smart === 'passed' || smart === 'good') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  }
  if (smart === 'warning') {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  }
  if (smart === 'abnormal' || smart === 'failed' || smart === 'error') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

function getDiskTypeBadge(type: string): string {
  switch (type) {
    case 'ssd':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    case 'nvme':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
    case 'hdd':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
}

// Wrapper for getTempColor to handle null values with disk-specific thresholds (45°C warning, 55°C critical)
function getDiskTempColor(temp: number | null): string {
  if (temp === null) return 'text-gray-500 dark:text-gray-400';
  return getTempColor(temp, 45, 55);
}

export function DiskHealth({ integrationId, config, widgetId }: DiskHealthProps) {
  const { data, loading, error } = useWidgetData<DiskData>({
    integrationId,
    metric: (config.metric as string) || 'disks',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  // Configuration options
  const visualizationType = (config.visualization as 'table' | 'cards' | 'compact') || 'table';
  const compactView = config.compactView === true || visualizationType === 'compact';
  const showDiskName = config.showDiskName !== false;
  const showDiskType = config.showDiskType !== false;
  const showModel = config.showModel !== false;
  const showSerial = config.showSerial === true;
  const showCapacity = config.showCapacity !== false;
  const showTemperature = config.showTemperature !== false;
  const showHealth = config.showHealth !== false;
  const showSmart = config.showSmart !== false;
  const showTotalCapacity = config.showTotalCapacity === true;

  // Apply filters
  const filteredDisks = data?.disks.filter(disk => {
    // Disk type filter
    const diskType = config.diskType as string;
    if (diskType && disk.type !== diskType) return false;

    // Health filter
    const healthFilter = config.healthFilter as string;
    if (healthFilter) {
      const healthLower = disk.health.toLowerCase();
      const filterLower = healthFilter.toLowerCase();
      if (filterLower === 'good' && healthLower !== 'good' && healthLower !== 'ok' && healthLower !== 'passed') return false;
      if (filterLower === 'warning' && healthLower !== 'warning' && healthLower !== 'unknown') return false;
      if (filterLower === 'error' && healthLower !== 'error' && healthLower !== 'failed' && healthLower !== 'bad') return false;
    }

    // Search filter (supports wildcards and comma-separated lists)
    const search = config.search as string;
    if (search && !matchesAnyFilter([disk.model, disk.serial, disk.id], search)) {
      return false;
    }

    return true;
  }) || [];

  // Calculate total capacity of filtered disks
  const totalCapacity = filteredDisks.reduce((sum, disk) => sum + (disk.capacity || 0), 0);

  // Render total capacity summary
  const renderTotalCapacity = () => {
    if (!showTotalCapacity || filteredDisks.length === 0) return null;
    return (
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Total ({filteredDisks.length} disk{filteredDisks.length !== 1 ? 's' : ''})
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {formatBytes(totalCapacity)}
        </span>
      </div>
    );
  };

  // Render table view
  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {showDiskName && <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Disk</th>}
            {showDiskType && <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Type</th>}
            {showModel && <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Model</th>}
            {showSerial && <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Serial</th>}
            {showCapacity && <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Capacity</th>}
            {showTemperature && <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Temp</th>}
            {showHealth && <th className="text-center py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Health</th>}
            {showSmart && <th className="text-center py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">SMART</th>}
          </tr>
        </thead>
        <tbody>
          {filteredDisks.map((disk) => (
            <tr key={disk.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
              {showDiskName && (
                <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">Disk {disk.id}</td>
              )}
              {showDiskType && (
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getDiskTypeBadge(disk.type)}`}>
                    {disk.type.toUpperCase()}
                  </span>
                </td>
              )}
              {showModel && (
                <td className="py-2 px-2 text-gray-600 dark:text-gray-400 truncate max-w-[150px]" title={disk.model}>
                  {disk.model || 'Unknown'}
                </td>
              )}
              {showSerial && (
                <td className="py-2 px-2 text-gray-500 dark:text-gray-500 text-xs truncate max-w-[100px]" title={disk.serial}>
                  {disk.serial || '-'}
                </td>
              )}
              {showCapacity && (
                <td className="py-2 px-2 text-right text-gray-900 dark:text-white">{formatBytes(disk.capacity)}</td>
              )}
              {showTemperature && (
                <td className={`py-2 px-2 text-right ${getDiskTempColor(disk.temperature)}`}>
                  {disk.temperature !== null ? `${disk.temperature}°C` : '-'}
                </td>
              )}
              {showHealth && (
                <td className="py-2 px-2 text-center">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getHealthBadge(disk.health)}`}>
                    {disk.health}
                  </span>
                </td>
              )}
              {showSmart && (
                <td className="py-2 px-2 text-center">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getSmartBadge(disk.smartStatus)}`}>
                    {disk.smartStatus}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render cards view
  const renderCards = () => (
    <div className={`space-y-${compactView ? '2' : '3'}`}>
      {filteredDisks.map((disk) => (
        <div
          key={disk.id}
          className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {showDiskName && (
                  <span className="font-medium text-gray-900 dark:text-white">
                    Disk {disk.id}
                  </span>
                )}
                {showDiskType && (
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getDiskTypeBadge(disk.type)}`}>
                    {disk.type.toUpperCase()}
                  </span>
                )}
                {showHealth && (
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getHealthBadge(disk.health)}`}>
                    {disk.health}
                  </span>
                )}
              </div>

              {showModel && (
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                  {disk.model || 'Unknown model'}
                </div>
              )}

              {showSerial && disk.serial && (
                <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                  S/N: {disk.serial}
                </div>
              )}
            </div>

            <div className="text-right flex-shrink-0">
              {showCapacity && (
                <div className="font-medium text-gray-900 dark:text-white">
                  {formatBytes(disk.capacity)}
                </div>
              )}
              {showTemperature && disk.temperature !== null && (
                <div className={`text-sm ${getDiskTempColor(disk.temperature)}`}>
                  {disk.temperature}°C
                </div>
              )}
            </div>
          </div>

          {showSmart && !compactView && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">SMART:</span>
              <span className={`px-1.5 py-0.5 text-xs rounded ${getSmartBadge(disk.smartStatus)}`}>
                {disk.smartStatus}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Render compact list view
  const renderCompact = () => (
    <div className="space-y-1">
      {filteredDisks.map((disk) => (
        <div
          key={disk.id}
          className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showDiskName && (
              <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                Disk {disk.id}
              </span>
            )}
            {showDiskType && (
              <span className={`px-1 py-0.5 text-[10px] rounded ${getDiskTypeBadge(disk.type)}`}>
                {disk.type.toUpperCase()}
              </span>
            )}
            {showModel && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {disk.model || 'Unknown'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showCapacity && (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {formatBytes(disk.capacity)}
              </span>
            )}
            {showTemperature && disk.temperature !== null && (
              <span className={`text-xs ${getDiskTempColor(disk.temperature)}`}>
                {disk.temperature}°C
              </span>
            )}
            {showHealth && (
              <span className={`px-1 py-0.5 text-[10px] rounded ${getHealthBadge(disk.health)}`}>
                {disk.health}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {filteredDisks.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.disks.length === 0 ? 'No disks found' : 'No disks match filter'}
            </p>
          ) : visualizationType === 'table' ? (
            renderTable()
          ) : visualizationType === 'compact' ? (
            renderCompact()
          ) : (
            renderCards()
          )}
          {renderTotalCapacity()}
        </>
      )}
    </BaseWidget>
  );
}
