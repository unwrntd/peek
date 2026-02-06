import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface VolumeListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string;
  labels: Record<string, string>;
  scope: string;
  usageData?: {
    size: number;
    refCount: number;
  };
}

interface VolumeData {
  volumes: DockerVolume[];
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
}

export function VolumeList({ integrationId, config, widgetId }: VolumeListProps) {
  const { data, loading, error } = useWidgetData<VolumeData>({
    integrationId,
    metric: 'volumes',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const filteredVolumes = useMemo(() => {
    if (!data?.volumes) return [];

    return data.volumes.filter(volume => {
      const driverFilter = config.driver as string;
      if (driverFilter && volume.driver !== driverFilter) return false;

      const showDangling = config.showDangling as boolean;
      const isDangling = volume.usageData?.refCount === 0;
      if (!showDangling && isDangling) return false;

      const search = config.search as string;
      if (search && !matchesAnyFilter([volume.name, volume.driver], search)) {
        return false;
      }

      return true;
    });
  }, [data?.volumes, config.driver, config.showDangling, config.search]);

  const showDriver = config.showDriver !== false;
  const showMountPoint = config.showMountPoint !== false;
  const showCreated = config.showCreated !== false;
  const showLabels = (config.showLabels as boolean) || false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'table';

  const getDriverBadgeColor = (driver: string): string => {
    switch (driver) {
      case 'local': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'nfs': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const renderCardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {filteredVolumes.map(volume => (
        <div
          key={volume.name}
          className={`p-3 rounded-lg border transition-colors ${
            volume.usageData?.refCount === 0
              ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate" title={volume.name}>
                {volume.name.length > 20 ? `${volume.name.substring(0, 20)}...` : volume.name}
              </h4>
              {showDriver && (
                <span className={`inline-flex items-center px-1.5 py-0.5 mt-1 rounded text-xs font-medium ${getDriverBadgeColor(volume.driver)}`}>
                  {volume.driver}
                </span>
              )}
            </div>
            {volume.usageData?.refCount === 0 && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                Unused
              </span>
            )}
          </div>

          <div className="space-y-1 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {showMountPoint && (
              <div className="truncate" title={volume.mountpoint}>
                <span className="font-mono text-gray-700 dark:text-gray-300">{volume.mountpoint}</span>
              </div>
            )}
            {showCreated && volume.createdAt && (
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTimeAgo(volume.createdAt)}
              </div>
            )}
            {showLabels && volume.labels && Object.keys(volume.labels).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(volume.labels).slice(0, 3).map(([key, value]) => (
                  <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-600">
                    {key}: {value}
                  </span>
                ))}
                {Object.keys(volume.labels).length > 3 && (
                  <span className="text-xs text-gray-400">+{Object.keys(volume.labels).length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        {!hideLabels && (
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 font-medium">Name</th>
              {showDriver && <th className="py-2 font-medium">Driver</th>}
              {showMountPoint && <th className="py-2 font-medium">Mount Point</th>}
              {showCreated && <th className="py-2 font-medium">Created</th>}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredVolumes.map(volume => (
            <tr key={volume.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]" title={volume.name}>
                    {volume.name}
                  </span>
                  {volume.usageData?.refCount === 0 && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">(unused)</span>
                  )}
                </div>
              </td>
              {showDriver && (
                <td className="py-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getDriverBadgeColor(volume.driver)}`}>
                    {volume.driver}
                  </span>
                </td>
              )}
              {showMountPoint && (
                <td className="py-2 text-gray-600 dark:text-gray-300 font-mono text-xs truncate max-w-[200px]" title={volume.mountpoint}>
                  {volume.mountpoint}
                </td>
              )}
              {showCreated && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {volume.createdAt ? formatTimeAgo(volume.createdAt) : '-'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const summary = useMemo(() => {
    const volumes = data?.volumes || [];
    const unused = volumes.filter(v => v.usageData?.refCount === 0).length;
    return { total: volumes.length, unused };
  }, [data?.volumes]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {visualizationType === 'cards' ? renderCardView() : renderTableView()}
          {filteredVolumes.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {(data.volumes?.length || 0) === 0 ? 'No volumes found' : 'No volumes match filters'}
            </p>
          )}
          {summary.total > 0 && summary.unused > 0 && (
            <p className="text-center text-yellow-600 dark:text-yellow-400 text-xs py-2">
              {summary.unused} unused volume{summary.unused !== 1 ? 's' : ''} (dangling)
            </p>
          )}
        </>
      )}
    </BaseWidget>
  );
}
