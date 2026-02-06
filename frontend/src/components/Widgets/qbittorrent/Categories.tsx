import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { DonutChart } from '../../common/visualizations';
import { QBittorrentStatus, QBittorrentTorrent, QBittorrentCategory } from '../../../types';
import { formatBytes } from '../../../utils/formatting';

interface CategoriesData {
  status: QBittorrentStatus;
  torrents: QBittorrentTorrent[];
  categories: Record<string, QBittorrentCategory>;
}

interface CategoriesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

const chartColors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#14B8A6'];

export function Categories({ integrationId, config, widgetId }: CategoriesProps) {
  const { data, loading, error } = useWidgetData<CategoriesData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const categories = data?.categories || {};
  const torrents = data?.torrents || [];
  const showPaths = config.showPaths !== false;
  const showTags = config.showTags !== false;

  // Count torrents per category
  const categoryCounts: Record<string, { count: number; size: number }> = {};
  let uncategorizedCount = 0;
  let uncategorizedSize = 0;

  for (const torrent of torrents) {
    if (torrent.category) {
      if (!categoryCounts[torrent.category]) {
        categoryCounts[torrent.category] = { count: 0, size: 0 };
      }
      categoryCounts[torrent.category].count++;
      categoryCounts[torrent.category].size += torrent.size;
    } else {
      uncategorizedCount++;
      uncategorizedSize += torrent.size;
    }
  }

  // Extract tags from torrents
  const allTags = new Set<string>();
  for (const torrent of torrents) {
    if (torrent.tags) {
      torrent.tags.split(',').forEach(tag => {
        const trimmed = tag.trim();
        if (trimmed) allTags.add(trimmed);
      });
    }
  }

  const categoryEntries = Object.entries(categories);
  const hasCategories = categoryEntries.length > 0 || uncategorizedCount > 0;

  if (!hasCategories) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span>No categories defined</span>
        </div>
      </BaseWidget>
    );
  }

  // Donut visualization
  if (visualization === 'donut') {
    const segments = [];
    let colorIdx = 0;
    for (const [name] of categoryEntries) {
      const stats = categoryCounts[name] || { count: 0, size: 0 };
      if (stats.count > 0) {
        segments.push({
          label: name,
          value: stats.count,
          color: chartColors[colorIdx % chartColors.length],
        });
        colorIdx++;
      }
    }
    if (uncategorizedCount > 0) {
      segments.push({
        label: 'Uncategorized',
        value: uncategorizedCount,
        color: '#6B7280',
      });
    }

    return (
      <BaseWidget loading={loading} error={error}>
        {segments.length > 0 ? (
          <DonutChart
            segments={segments}
            centerValue={torrents.length.toString()}
            centerLabel={hideLabels ? undefined : 'torrents'}
            responsive
            showLegend={!hideLabels}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No torrents
          </div>
        )}
      </BaseWidget>
    );
  }

  // Cards visualization - grid of category cards
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="grid grid-cols-2 gap-2">
          {categoryEntries.map(([name], idx) => {
            const stats = categoryCounts[name] || { count: 0, size: 0 };
            return (
              <div
                key={name}
                className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: chartColors[idx % chartColors.length] }}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {stats.count} torrents • {formatBytes(stats.size)}
                </div>
              </div>
            );
          })}
          {uncategorizedCount > 0 && (
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Uncategorized</span>
              </div>
              <div className="text-xs text-gray-500">
                {uncategorizedCount} torrents • {formatBytes(uncategorizedSize)}
              </div>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Categories List */}
        <div className="space-y-2">
          {categoryEntries.map(([name, category]) => {
            const stats = categoryCounts[name] || { count: 0, size: 0 };
            return (
              <div
                key={name}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="font-medium text-gray-900 dark:text-white">{name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{stats.count} torrents</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>{formatBytes(stats.size)}</span>
                  </div>
                </div>
                {showPaths && category.savePath && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1" title={category.savePath}>
                    {category.savePath}
                  </p>
                )}
              </div>
            );
          })}

          {/* Uncategorized */}
          {uncategorizedCount > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Uncategorized</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{uncategorizedCount} torrents</span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>{formatBytes(uncategorizedSize)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tags Section */}
        {showTags && allTags.size > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(allTags).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{categoryEntries.length} categories</span>
            <span>{torrents.length} total torrents</span>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
