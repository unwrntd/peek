import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { formatBytes } from '../../../utils/formatting';

interface DiskUsageProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DiskUsageCategory {
  totalCount: number;
  activeCount?: number;
  runningCount?: number;
  inUseCount?: number;
  totalSize: number;
  reclaimableSize: number;
}

interface DockerDiskUsage {
  images: DiskUsageCategory;
  containers: DiskUsageCategory;
  volumes: DiskUsageCategory;
  buildCache: DiskUsageCategory;
}

function getActiveCount(data: DiskUsageCategory | undefined): number {
  if (!data) return 0;
  return data.activeCount ?? data.runningCount ?? data.inUseCount ?? 0;
}

interface DiskUsageData {
  diskUsage: DockerDiskUsage;
}

function getUsageBarColor(index: number): string {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
  return colors[index % colors.length];
}

export function DiskUsage({ integrationId, config, widgetId }: DiskUsageProps) {
  const { data, loading, error } = useWidgetData<DiskUsageData>({
    integrationId,
    metric: 'disk-usage',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showImages = config.showImages !== false;
  const showContainers = config.showContainers !== false;
  const showVolumes = config.showVolumes !== false;
  const showBuildCache = config.showBuildCache !== false;
  const showReclaimable = (config.showReclaimable as boolean) || false;
  const visualizationType = (config.visualization as string) || 'bars';

  const diskUsage = data?.diskUsage;

  const categories = [
    { key: 'images', label: 'Images', show: showImages, data: diskUsage?.images, color: 'blue' },
    { key: 'containers', label: 'Containers', show: showContainers, data: diskUsage?.containers, color: 'green' },
    { key: 'volumes', label: 'Volumes', show: showVolumes, data: diskUsage?.volumes, color: 'purple' },
    { key: 'buildCache', label: 'Build Cache', show: showBuildCache, data: diskUsage?.buildCache, color: 'orange' },
  ].filter(c => c.show && c.data);

  const totalSize = categories.reduce((sum, cat) => sum + (cat.data?.totalSize || 0), 0);
  const totalReclaimable = categories.reduce((sum, cat) => sum + (cat.data?.reclaimableSize || 0), 0);

  const renderBarsView = () => (
    <div className="space-y-4">
      {categories.map((cat, index) => (
        <div key={cat.key}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {cat.label}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {formatBytes(cat.data?.totalSize || 0)}
              {showReclaimable && cat.data?.reclaimableSize ? (
                <span className="text-xs text-gray-400 ml-1">
                  ({formatBytes(cat.data.reclaimableSize)} reclaimable)
                </span>
              ) : null}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getUsageBarColor(index)} rounded-full`}
              style={{ width: totalSize > 0 ? `${(cat.data?.totalSize || 0) / totalSize * 100}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>{cat.data?.totalCount || 0} total</span>
            <span>{getActiveCount(cat.data)} active</span>
          </div>
        </div>
      ))}

      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-900 dark:text-white">Total</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatBytes(totalSize)}</span>
        </div>
        {showReclaimable && totalReclaimable > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatBytes(totalReclaimable)} reclaimable space
          </div>
        )}
      </div>
    </div>
  );

  const renderDonutView = () => {
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              className="stroke-gray-200 dark:stroke-gray-700"
              strokeWidth="20"
            />
            {categories.map((cat, index) => {
              const percentage = totalSize > 0 ? (cat.data?.totalSize || 0) / totalSize : 0;
              const strokeDasharray = `${percentage * circumference} ${circumference}`;
              const strokeDashoffset = -offset;
              offset += percentage * circumference;

              return (
                <circle
                  key={cat.key}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  className={`stroke-${cat.color}-500`}
                  style={{ stroke: ['#3b82f6', '#22c55e', '#a855f7', '#f97316'][index] }}
                  strokeWidth="20"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-gray-900 dark:text-white">{formatBytes(totalSize)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 w-full">
          {categories.map((cat, index) => (
            <div key={cat.key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: ['#3b82f6', '#22c55e', '#a855f7', '#f97316'][index] }} />
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {cat.label}: {formatBytes(cat.data?.totalSize || 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 font-medium">Type</th>
            <th className="py-2 font-medium">Count</th>
            <th className="py-2 font-medium">Active</th>
            <th className="py-2 font-medium">Size</th>
            {showReclaimable && <th className="py-2 font-medium">Reclaimable</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {categories.map(cat => (
            <tr key={cat.key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2 font-medium text-gray-900 dark:text-white">{cat.label}</td>
              <td className="py-2 text-gray-600 dark:text-gray-300">{cat.data?.totalCount || 0}</td>
              <td className="py-2 text-gray-600 dark:text-gray-300">
                {getActiveCount(cat.data)}
              </td>
              <td className="py-2 text-gray-600 dark:text-gray-300">{formatBytes(cat.data?.totalSize || 0)}</td>
              {showReclaimable && (
                <td className="py-2 text-gray-600 dark:text-gray-300">{formatBytes(cat.data?.reclaimableSize || 0)}</td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 dark:border-gray-700 font-medium">
            <td className="py-2 text-gray-900 dark:text-white">Total</td>
            <td className="py-2 text-gray-900 dark:text-white">
              {categories.reduce((sum, cat) => sum + (cat.data?.totalCount || 0), 0)}
            </td>
            <td className="py-2 text-gray-900 dark:text-white">-</td>
            <td className="py-2 text-gray-900 dark:text-white">{formatBytes(totalSize)}</td>
            {showReclaimable && (
              <td className="py-2 text-gray-900 dark:text-white">{formatBytes(totalReclaimable)}</td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && diskUsage && (
        <>
          {visualizationType === 'donut' ? renderDonutView() :
           visualizationType === 'table' ? renderTableView() : renderBarsView()}
        </>
      )}
    </BaseWidget>
  );
}
