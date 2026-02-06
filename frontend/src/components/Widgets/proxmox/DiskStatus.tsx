import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProxmoxDisk } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';
import { formatBytes } from '../../../utils/formatting';
import { getHealthColor, getWearoutColor } from '../../../utils/colors';

interface DiskStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DiskData {
  disks: ProxmoxDisk[];
}

function getHealthBadge(health?: string): string {
  if (!health) return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  if (health === 'PASSED' || health === 'OK') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (health === 'UNKNOWN') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
}

function getDiskWearoutColor(wearout?: number): string {
  if (wearout === undefined) return 'text-gray-500 dark:text-gray-400';
  // DiskStatus shows wearout as remaining life (higher is better)
  return getWearoutColor(wearout);
}

export function DiskStatus({ integrationId, config, widgetId }: DiskStatusProps) {
  const { data, loading, error } = useWidgetData<DiskData>({
    integrationId,
    metric: (config.metric as string) || 'disks',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const showHealth = config.showHealth !== false;
  const showWearout = config.showWearout !== false;
  const showModel = config.showModel !== false;
  const showSerial = config.showSerial === true;
  const compactView = config.compactView === true;

  // Apply filters
  const filteredDisks = data?.disks.filter(disk => {
    const diskType = config.diskType as string;
    if (diskType && disk.type !== diskType) return false;

    const healthFilter = config.healthFilter as string;
    if (healthFilter === 'healthy' && disk.health !== 'PASSED' && disk.health !== 'OK') return false;
    if (healthFilter === 'warning' && disk.health !== 'UNKNOWN') return false;
    if (healthFilter === 'failed' && (disk.health === 'PASSED' || disk.health === 'OK' || disk.health === 'UNKNOWN')) return false;

    // Search filter (supports wildcards and comma-separated lists)
    const search = config.search as string;
    if (search && !matchesAnyFilter([disk.devpath, disk.model, disk.serial, disk.vendor], search)) {
      return false;
    }

    return true;
  }) || [];

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`space-y-${compactView ? '2' : '3'}`}>
          {filteredDisks.map((disk) => (
            <div
              key={disk.devpath}
              className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {disk.devpath}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${
                      disk.type === 'ssd'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {disk.type.toUpperCase()}
                    </span>
                  </div>
                  {showModel && (
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                      {disk.vendor && `${disk.vendor} `}{disk.model || 'Unknown model'}
                    </div>
                  )}
                  {showSerial && disk.serial && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                      S/N: {disk.serial}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatBytes(disk.size)}
                  </div>
                  {disk.used && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {disk.used}
                    </div>
                  )}
                </div>
              </div>

              {(showHealth || showWearout) && !compactView && (
                <div className="mt-2 flex items-center gap-4 text-sm">
                  {showHealth && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">Health:</span>
                      <span className={`px-1.5 py-0.5 text-xs rounded ${getHealthBadge(disk.health)}`}>
                        {disk.health || 'Unknown'}
                      </span>
                    </div>
                  )}
                  {showWearout && disk.wearout !== undefined && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">Wearout:</span>
                      <span className={getDiskWearoutColor(disk.wearout)}>
                        {disk.wearout}%
                      </span>
                    </div>
                  )}
                  {disk.rpm && disk.rpm > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">RPM:</span>
                      <span className="text-gray-700 dark:text-gray-300">{disk.rpm}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {filteredDisks.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.disks.length === 0 ? 'No disks found' : 'No disks match filter'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
