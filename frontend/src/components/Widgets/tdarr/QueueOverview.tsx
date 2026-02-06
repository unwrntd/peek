import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { DonutChart } from '../../common/visualizations';
import { TdarrQueueStats } from '../../../types';

const chartColors = ['#F59E0B', '#3B82F6', '#06B6D4', '#10B981', '#EF4444'];

interface QueueOverviewData {
  queue: TdarrQueueStats;
}

interface QueueOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function QueueOverview({ integrationId, config, widgetId }: QueueOverviewProps) {
  const { data, loading, error } = useWidgetData<QueueOverviewData>({
    integrationId,
    metric: 'queue',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'numbers';
  const hideLabels = (config.hideLabels as boolean) || false;
  const queue = data?.queue;

  if (!queue) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No queue data available
        </div>
      </BaseWidget>
    );
  }

  const total = queue.totalQueued + queue.totalProcessing;
  const progressPercent = total > 0 ? (queue.totalProcessing / total) * 100 : 0;

  // Numbers visualization - large metrics
  if (visualization === 'numbers') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={queue.totalQueued.toString()}
                className="text-amber-600 dark:text-amber-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Queued</div>}
            </div>
            <div>
              <ScaledMetric
                value={queue.totalProcessing.toString()}
                className="text-blue-600 dark:text-blue-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Processing</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Donut visualization
  if (visualization === 'donut') {
    const segments = [
      { label: 'Queued', value: queue.totalQueued, color: chartColors[0] },
      { label: 'Transcode', value: queue.transcodeQueue, color: chartColors[1] },
      { label: 'Health Check', value: queue.healthCheckQueue, color: chartColors[2] },
    ].filter(s => s.value > 0);

    return (
      <BaseWidget loading={loading} error={error}>
        {segments.length > 0 ? (
          <DonutChart
            segments={segments}
            centerValue={total.toString()}
            centerLabel={hideLabels ? undefined : 'total'}
            responsive
            showLegend={!hideLabels}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Queue empty
          </div>
        )}
      </BaseWidget>
    );
  }

  // Default: Bars visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Processing</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {queue.totalProcessing} / {total}
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Queue Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 text-center">
            <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              {queue.totalQueued}
            </div>
            <div className="text-xs text-amber-600/70 dark:text-amber-400/70">Queued</div>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 text-center">
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {queue.transcodeQueue}
            </div>
            <div className="text-xs text-blue-600/70 dark:text-blue-400/70">Transcode</div>
          </div>
          <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800/50 text-center">
            <div className="text-lg font-semibold text-cyan-600 dark:text-cyan-400">
              {queue.healthCheckQueue}
            </div>
            <div className="text-xs text-cyan-600/70 dark:text-cyan-400/70">Health</div>
          </div>
        </div>

        {/* Completed & Errored */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Completed: <span className="font-medium text-gray-900 dark:text-white">{queue.totalCompleted.toLocaleString()}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Errored: <span className="font-medium text-red-600 dark:text-red-400">{queue.totalErrored}</span>
            </span>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
