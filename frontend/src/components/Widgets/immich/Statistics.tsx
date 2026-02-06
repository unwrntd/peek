import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { DonutChart } from '../../common/visualizations';
import { ImmichStatistics } from '../../../types';

const chartColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];

interface StatisticsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Statistics({ integrationId, config, widgetId }: StatisticsProps) {
  const { data, loading, error } = useWidgetData<ImmichStatistics>({
    integrationId,
    metric: 'statistics',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'numbers';
  const hideLabels = (config.hideLabels as boolean) || false;
  const showUserBreakdown = config.showUserBreakdown !== false;
  const showStorageUsage = config.showStorageUsage !== false;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Loading statistics...</span>
        </div>
      </BaseWidget>
    );
  }

  // Numbers visualization - large metrics
  if (visualization === 'numbers') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={data.photos.toLocaleString()}
                className="text-blue-600 dark:text-blue-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Photos</div>}
            </div>
            <div>
              <ScaledMetric
                value={data.videos.toLocaleString()}
                className="text-purple-600 dark:text-purple-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Videos</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Donut visualization
  if (visualization === 'donut') {
    const segments = [
      { label: 'Photos', value: data.photos, color: chartColors[0] },
      { label: 'Videos', value: data.videos, color: chartColors[1] },
    ].filter(s => s.value > 0);

    return (
      <BaseWidget loading={loading} error={error}>
        {segments.length > 0 ? (
          <DonutChart
            segments={segments}
            centerValue={data.totalAssets.toLocaleString()}
            centerLabel={hideLabels ? undefined : 'total'}
            responsive
            showLegend={!hideLabels}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No assets
          </div>
        )}
      </BaseWidget>
    );
  }

  // Default: Bars visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Photos</span>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {data.photos.toLocaleString()}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Videos</span>
            </div>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {data.videos.toLocaleString()}
            </p>
          </div>

          {showStorageUsage && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Storage</span>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {data.usageFormatted}
              </p>
            </div>
          )}

          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Users</span>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {data.totalUsers}
            </p>
          </div>
        </div>

        {/* User Breakdown */}
        {showUserBreakdown && data.usageByUser && data.usageByUser.length > 0 && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">By User</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {data.usageByUser.map((user) => (
                <div key={user.userId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 truncate">{user.userName}</span>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{user.photos + user.videos} items</span>
                    <span>{user.usageFormatted}</span>
                    {user.quotaPercentage !== null && (
                      <span className={`${user.quotaPercentage > 90 ? 'text-red-500' : user.quotaPercentage > 75 ? 'text-yellow-500' : ''}`}>
                        {user.quotaPercentage}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{data.totalAssets.toLocaleString()} total assets</span>
        </div>
      </div>
    </BaseWidget>
  );
}
