import React, { useCallback, useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { SortableHeader } from '../../common/SortableHeader';
import { matchesAnyFilter } from '../../../utils/filterUtils';
import { formatBytes } from '../../../utils/formatting';

interface ImageListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DockerImage {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  created: number;
  size: number;
  virtualSize: number;
  containers: number;
}

interface ImageData {
  images: DockerImage[];
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
}

function getImageName(image: DockerImage): string {
  if (image.repoTags && image.repoTags.length > 0 && image.repoTags[0] !== '<none>:<none>') {
    return image.repoTags[0];
  }
  return image.id.substring(7, 19);
}

function getImageTag(image: DockerImage): string {
  if (image.repoTags && image.repoTags.length > 0 && image.repoTags[0] !== '<none>:<none>') {
    const parts = image.repoTags[0].split(':');
    return parts.length > 1 ? parts[parts.length - 1] : 'latest';
  }
  return '-';
}

export function ImageList({ integrationId, config, widgetId }: ImageListProps) {
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<ImageData>({
    integrationId,
    metric: 'images',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const configSortKey = (config.sortField as string) || 'created';
  const configSortDirection = (config.sortDirection as SortDirection) || 'desc';

  const handleSortChange = useCallback((key: string | null, direction: SortDirection) => {
    if (!widgetId) return;
    updateWidget(widgetId, {
      config: { ...config, sortField: key, sortDirection: direction }
    });
  }, [widgetId, config, updateWidget]);

  const filteredImages = useMemo(() => {
    if (!data?.images) return [];

    return data.images.filter(image => {
      const showDangling = config.showDangling as boolean;
      const isDangling = !image.repoTags || image.repoTags.length === 0 || image.repoTags[0] === '<none>:<none>';
      if (!showDangling && isDangling) return false;

      const search = config.search as string;
      if (search) {
        const searchTargets = [
          getImageName(image),
          ...image.repoTags || [],
          image.id,
        ];
        if (!matchesAnyFilter(searchTargets, search)) {
          return false;
        }
      }

      return true;
    });
  }, [data?.images, config.showDangling, config.search]);

  type SortKey = 'name' | 'size' | 'created';
  const getSortValue = useCallback((image: DockerImage, key: SortKey) => {
    switch (key) {
      case 'name': return getImageName(image);
      case 'size': return image.size;
      case 'created': return image.created;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, DockerImage>(
    filteredImages,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  const maxItems = (config.maxItems as number) || 20;
  const showTag = config.showTag !== false;
  const showSize = config.showSize !== false;
  const showCreated = config.showCreated !== false;
  const showId = (config.showId as boolean) || false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'table';

  const renderCardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sortedData.slice(0, maxItems).map(image => (
        <div
          key={image.id}
          className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {getImageName(image).split(':')[0]}
              </h4>
              {showTag && (
                <span className="inline-flex items-center px-1.5 py-0.5 mt-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  {getImageTag(image)}
                </span>
              )}
            </div>
            {showSize && (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {formatBytes(image.size)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {showCreated && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTimeAgo(image.created)}
              </span>
            )}
            {image.containers > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {image.containers} container{image.containers !== 1 ? 's' : ''}
              </span>
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
              <SortableHeader label="Repository" sortKey="name" direction={getSortDirection('name')} onSort={() => requestSort('name')} />
              {showTag && <th className="py-2 font-medium">Tag</th>}
              {showId && <th className="py-2 font-medium">ID</th>}
              {showSize && <SortableHeader label="Size" sortKey="size" direction={getSortDirection('size')} onSort={() => requestSort('size')} />}
              {showCreated && <SortableHeader label="Created" sortKey="created" direction={getSortDirection('created')} onSort={() => requestSort('created')} />}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {sortedData.slice(0, maxItems).map(image => (
            <tr key={image.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2">
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {getImageName(image).split(':')[0]}
                </span>
              </td>
              {showTag && (
                <td className="py-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {getImageTag(image)}
                  </span>
                </td>
              )}
              {showId && (
                <td className="py-2 text-gray-600 dark:text-gray-300 font-mono text-xs">
                  {image.id.substring(7, 19)}
                </td>
              )}
              {showSize && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatBytes(image.size)}
                </td>
              )}
              {showCreated && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatTimeAgo(image.created)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const summary = useMemo(() => {
    const images = data?.images || [];
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    const dangling = images.filter(img => !img.repoTags || img.repoTags.length === 0 || img.repoTags[0] === '<none>:<none>').length;
    return { total: images.length, totalSize, dangling };
  }, [data?.images]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {visualizationType === 'cards' ? renderCardView() : renderTableView()}
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {(data.images?.length || 0) === 0 ? 'No images found' : 'No images match filters'}
            </p>
          )}
          {sortedData.length > maxItems && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-xs py-2">
              Showing {maxItems} of {sortedData.length} images ({formatBytes(summary.totalSize)} total)
            </p>
          )}
        </>
      )}
    </BaseWidget>
  );
}
