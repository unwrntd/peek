import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { DonutChart } from '../../common/visualizations';
import { ProwlarrIndexerStats } from '../../../types';

const chartColors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#14B8A6'];

interface StatsData {
  stats: ProwlarrIndexerStats[];
  totals: {
    totalQueries: number;
    totalGrabs: number;
    totalFailedQueries: number;
    totalFailedGrabs: number;
  };
}

interface IndexerStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function IndexerStats({ integrationId, config, widgetId }: IndexerStatsProps) {
  const { data, loading, error } = useWidgetData<StatsData>({
    integrationId,
    metric: 'indexer-stats',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'bars';
  const hideLabels = (config.hideLabels as boolean) || false;
  const sortBy = (config.sortBy as string) || 'queries';
  const displayOptions = (config.displayOptions as Record<string, boolean> | undefined) || {};
  const showResponseTime = displayOptions.showResponseTime !== false;
  const showSuccessRate = displayOptions.showSuccessRate !== false;

  const stats = data?.stats || [];
  const totals = data?.totals;

  // Sort stats
  const sortedStats = [...stats].sort((a, b) => {
    switch (sortBy) {
      case 'grabs':
        return b.numberOfGrabs - a.numberOfGrabs;
      case 'failures':
        return (b.numberOfFailedQueries + b.numberOfFailedGrabs) - (a.numberOfFailedQueries + a.numberOfFailedGrabs);
      default:
        return b.numberOfQueries - a.numberOfQueries;
    }
  });

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No stats data available
        </div>
      </BaseWidget>
    );
  }

  const totalSuccessRate = totals && totals.totalQueries > 0
    ? Math.round(((totals.totalQueries - totals.totalFailedQueries) / totals.totalQueries) * 100)
    : 100;

  // Donut visualization
  if (visualization === 'donut') {
    const segments = sortedStats.slice(0, 8).map((stat, idx) => ({
      label: stat.indexerName,
      value: sortBy === 'grabs' ? stat.numberOfGrabs : stat.numberOfQueries,
      color: chartColors[idx % chartColors.length],
    })).filter(s => s.value > 0);

    return (
      <BaseWidget loading={loading} error={error}>
        {segments.length > 0 ? (
          <DonutChart
            segments={segments}
            centerValue={sortBy === 'grabs' ? (totals?.totalGrabs || 0).toString() : (totals?.totalQueries || 0).toString()}
            centerLabel={hideLabels ? undefined : sortBy === 'grabs' ? 'grabs' : 'queries'}
            responsive
            showLegend={!hideLabels}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No data
          </div>
        )}
      </BaseWidget>
    );
  }

  // List visualization
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2 text-sm">
          {!hideLabels && (
            <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-200 dark:border-gray-700">
              <span>Indexer</span>
              <span>Queries / Grabs</span>
            </div>
          )}
          {sortedStats.slice(0, 10).map(stat => (
            <div key={stat.indexerId} className="flex items-center justify-between">
              <span className="text-gray-900 dark:text-white truncate max-w-[50%]">{stat.indexerName}</span>
              <span className="text-gray-500">
                {stat.numberOfQueries.toLocaleString()} / <span className="text-green-600 dark:text-green-400">{stat.numberOfGrabs.toLocaleString()}</span>
              </span>
            </div>
          ))}
          {!hideLabels && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between text-xs text-gray-500">
              <span>Total: {totals?.totalQueries.toLocaleString() || 0} queries</span>
              <span>{totalSuccessRate}% success</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Bars visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Totals Summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {totals?.totalQueries.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Queries</div>
          </div>
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {totals?.totalGrabs.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Grabs</div>
          </div>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              {((totals?.totalFailedQueries || 0) + (totals?.totalFailedGrabs || 0)).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
          </div>
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-center">
            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
              {totalSuccessRate}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Success</div>
          </div>
        </div>

        {/* Per-Indexer Stats */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedStats.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No indexer statistics available
            </div>
          ) : (
            sortedStats.slice(0, 10).map(stat => {
              const successRate = stat.numberOfQueries > 0
                ? Math.round(((stat.numberOfQueries - stat.numberOfFailedQueries) / stat.numberOfQueries) * 100)
                : 100;
              const failures = stat.numberOfFailedQueries + stat.numberOfFailedGrabs;

              return (
                <div
                  key={stat.indexerId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate text-sm">
                      {stat.indexerName}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{stat.numberOfQueries.toLocaleString()} queries</span>
                      <span className="text-green-600 dark:text-green-400">{stat.numberOfGrabs.toLocaleString()} grabs</span>
                      {failures > 0 && (
                        <span className="text-red-600 dark:text-red-400">{failures.toLocaleString()} failed</span>
                      )}
                    </div>
                  </div>

                  {/* Response Time */}
                  {showResponseTime && stat.averageResponseTime > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.round(stat.averageResponseTime)}ms
                    </div>
                  )}

                  {/* Success Rate */}
                  {showSuccessRate && (
                    <div className={`text-xs font-medium ${
                      successRate >= 90
                        ? 'text-green-600 dark:text-green-400'
                        : successRate >= 70
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {successRate}%
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
