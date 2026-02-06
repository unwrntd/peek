import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';
import { DonutChart } from '../../common/visualizations';

interface TautulliActivity {
  streamCount: number;
  streamCountDirectPlay: number;
  streamCountDirectStream: number;
  streamCountTranscode: number;
  totalBandwidth: number;
  lanBandwidth: number;
  wanBandwidth: number;
  sessions: unknown[];
}

interface ActivityData {
  activity: TautulliActivity;
}

interface StreamCountProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBandwidth(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${Math.round(kbps)} Kbps`;
}

export function StreamCount({ integrationId, config, widgetId }: StreamCountProps) {
  const { data, loading, error } = useWidgetData<ActivityData>({
    integrationId,
    metric: 'activity',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const dimensions = useWidgetDimensions();
  const visualization = (config.visualization as string) || 'number';
  const showBandwidth = config.showBandwidth !== false;
  const showBreakdown = config.showBreakdown !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'auto';
  const singleMetric = config.singleMetric as { key: string; color: string; format?: string } | undefined;

  // Calculate effective scale factor
  const getEffectiveScale = (): number => {
    if (!dimensions) return 1;
    const { contentScale, scaleFactors } = dimensions;
    if (contentScale === 'auto') {
      return scaleFactors.textScale;
    }
    return parseFloat(contentScale) || 1;
  };
  const scale = getEffectiveScale();

  // Base font sizes for different metric sizes
  const baseFontSizes: Record<string, number> = {
    xs: 24,
    sm: 30,
    md: 40,
    lg: 50,
    xl: 64,
    xxl: 80,
    xxxl: 96,
  };
  const baseFontSize = baseFontSizes[metricSize] || 40;
  const scaledFontSize = baseFontSize * scale;

  const activity = data?.activity;

  // Single metric mode
  if (singleMetric && activity) {
    let value: number | string = 0;
    switch (singleMetric.key) {
      case 'total':
        value = activity.streamCount;
        break;
      case 'directPlay':
        value = activity.streamCountDirectPlay;
        break;
      case 'directStream':
        value = activity.streamCountDirectStream;
        break;
      case 'transcode':
        value = activity.streamCountTranscode;
        break;
      case 'bandwidth':
        value = formatBandwidth(activity.totalBandwidth);
        break;
    }

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div
            className="font-bold"
            style={{ color: singleMetric.color, fontSize: `${scaledFontSize}px` }}
          >
            {value}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Donut visualization
  if (visualization === 'donut' && activity) {
    const segments = [
      { label: 'Direct Play', value: activity.streamCountDirectPlay, color: '#10B981' },
      { label: 'Direct Stream', value: activity.streamCountDirectStream, color: '#6366F1' },
      { label: 'Transcode', value: activity.streamCountTranscode, color: '#F59E0B' },
    ].filter(d => d.value > 0);

    if (segments.length === 0) {
      segments.push({ label: 'No Streams', value: 1, color: '#D1D5DB' });
    }

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full">
          <DonutChart
            segments={segments}
            centerValue={activity.streamCount}
            centerLabel={hideLabels ? undefined : 'streams'}
            responsive
            showLegend={!hideLabels}
          />
          {showBandwidth && activity.totalBandwidth > 0 && !hideLabels && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {formatBandwidth(activity.totalBandwidth)}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Multi-row visualization
  if (visualization === 'multi-row' && activity) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400 text-sm">Total</span>
            <span className="font-bold text-lg text-gray-900 dark:text-white">{activity.streamCount}</span>
          </div>
          {showBreakdown && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Direct Play</span>
                <span className="font-semibold text-green-600 dark:text-green-400">{activity.streamCountDirectPlay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Direct Stream</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{activity.streamCountDirectStream}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Transcode</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">{activity.streamCountTranscode}</span>
              </div>
            </>
          )}
          {showBandwidth && activity.totalBandwidth > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Bandwidth</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">{formatBandwidth(activity.totalBandwidth)}</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Number visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {activity && (
        <div className="flex flex-col items-center justify-center h-full">
          <div
            className="font-bold text-gray-900 dark:text-white"
            style={{ fontSize: `${scaledFontSize}px` }}
          >
            {activity.streamCount}
          </div>
          {!hideLabels && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {activity.streamCount === 1 ? 'stream' : 'streams'}
            </div>
          )}
          {showBreakdown && activity.streamCount > 0 && (
            <div className="flex items-center gap-3 mt-2 text-xs">
              {activity.streamCountDirectPlay > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  {activity.streamCountDirectPlay} direct
                </span>
              )}
              {activity.streamCountTranscode > 0 && (
                <span className="text-orange-600 dark:text-orange-400">
                  {activity.streamCountTranscode} transcode
                </span>
              )}
            </div>
          )}
          {showBandwidth && activity.totalBandwidth > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatBandwidth(activity.totalBandwidth)}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
