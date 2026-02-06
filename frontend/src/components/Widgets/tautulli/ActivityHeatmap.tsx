import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HeatmapView, HeatmapData, HeatmapCell } from '../../common/HeatmapView';

interface TautulliHistoryItem {
  started: number;
  mediaType: 'movie' | 'episode' | 'track' | 'photo' | 'clip';
}

interface HistoryData {
  history: TautulliHistoryItem[];
  totalCount: number;
}

interface ActivityHeatmapProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function ActivityHeatmap({ integrationId, config, widgetId }: ActivityHeatmapProps) {
  const { data, loading, error } = useWidgetData<HistoryData>({
    integrationId,
    metric: 'history',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const mediaTypeFilter = (config.mediaType as string) || '';
  const showValues = config.showValues === true;
  const compactView = config.compactView === true;
  const colorScheme = (config.colorScheme as 'green' | 'blue' | 'purple' | 'orange') || 'purple';

  // Process history data into heatmap format
  const heatmapData: HeatmapData = useMemo(() => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

    // Initialize 7x24 grid
    const values: HeatmapCell[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ value: 0 }))
    );

    if (!data?.history) {
      return { rowLabels: dayLabels, colLabels: hourLabels, values };
    }

    // Filter by media type if specified
    const filteredHistory = mediaTypeFilter
      ? data.history.filter(item => item.mediaType === mediaTypeFilter)
      : data.history;

    // Count plays for each day/hour
    filteredHistory.forEach(item => {
      const date = new Date(item.started * 1000);
      const day = date.getDay();
      const hour = date.getHours();
      values[day][hour].value++;
    });

    // Add tooltips
    values.forEach((row, dayIndex) => {
      row.forEach((cell, hourIndex) => {
        cell.tooltip = `${dayLabels[dayIndex]} ${hourLabels[hourIndex]}:00 - ${cell.value} plays`;
      });
    });

    return { rowLabels: dayLabels, colLabels: hourLabels, values };
  }, [data?.history, mediaTypeFilter]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <HeatmapView
          data={heatmapData}
          colorScheme={colorScheme}
          showValues={showValues}
          compact={compactView}
          emptyMessage="No watch history available"
        />
      )}
    </BaseWidget>
  );
}
