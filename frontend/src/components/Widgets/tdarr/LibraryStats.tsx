import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { DonutChart } from '../../common/visualizations';
import { TdarrLibraryStats } from '../../../types';

const chartColors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#6366F1'];

interface LibraryStatsData {
  stats: TdarrLibraryStats;
}

interface LibraryStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getCodecColor(codec: string): string {
  const colors: Record<string, string> = {
    'hevc': 'bg-green-500',
    'h265': 'bg-green-500',
    'h264': 'bg-blue-500',
    'avc': 'bg-blue-500',
    'av1': 'bg-purple-500',
    'vp9': 'bg-yellow-500',
    'mpeg4': 'bg-orange-500',
    'mpeg2': 'bg-red-500',
  };
  const lowerCodec = codec.toLowerCase();
  for (const [key, color] of Object.entries(colors)) {
    if (lowerCodec.includes(key)) return color;
  }
  return 'bg-gray-500';
}

export function LibraryStats({ integrationId, config, widgetId }: LibraryStatsProps) {
  const { data, loading, error } = useWidgetData<LibraryStatsData>({
    integrationId,
    metric: 'stats',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'numbers';
  const hideLabels = (config.hideLabels as boolean) || false;
  const stats = data?.stats;

  if (!stats) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No stats data available
        </div>
      </BaseWidget>
    );
  }

  // Get top codecs for display
  const codecEntries = Object.entries(stats.codecBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const totalCodecCount = Object.values(stats.codecBreakdown).reduce((a, b) => a + b, 0);

  // Numbers visualization - large metrics
  if (visualization === 'numbers') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={formatBytes(stats.spaceSaved)}
                className="text-green-600 dark:text-green-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Space Saved</div>}
            </div>
            <div>
              <ScaledMetric
                value={stats.totalFiles.toLocaleString()}
                className="text-blue-600 dark:text-blue-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Total Files</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Donut visualization - codec distribution
  if (visualization === 'donut') {
    const segments = codecEntries.map(([codec, count], idx) => ({
      label: codec,
      value: count,
      color: chartColors[idx % chartColors.length],
    }));

    return (
      <BaseWidget loading={loading} error={error}>
        {segments.length > 0 ? (
          <DonutChart
            segments={segments}
            centerValue={stats.totalFiles.toLocaleString()}
            centerLabel={hideLabels ? undefined : 'files'}
            responsive
            showLegend={!hideLabels}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No codec data
          </div>
        )}
      </BaseWidget>
    );
  }

  // Default: Bars visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Space Saved */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-100 dark:border-green-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <div>
              <div className="text-sm text-green-600 dark:text-green-400">Space Saved</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatBytes(stats.spaceSaved)}
              </div>
              <div className="text-xs text-green-600/70 dark:text-green-400/70">
                {stats.spaceSavedPercent}% reduction
              </div>
            </div>
          </div>
        </div>

        {/* File Count */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
          <span className="text-sm text-gray-500 dark:text-gray-400">Total Files</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {stats.totalFiles.toLocaleString()}
          </span>
        </div>

        {/* Codec Distribution */}
        {codecEntries.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Video Codecs
            </h5>
            <div className="space-y-2">
              {codecEntries.map(([codec, count]) => {
                const percent = totalCodecCount > 0 ? (count / totalCodecCount) * 100 : 0;
                return (
                  <div key={codec}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{codec}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {count.toLocaleString()} ({Math.round(percent)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getCodecColor(codec)}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
