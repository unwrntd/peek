import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HeatmapView, HeatmapData, HeatmapCell } from '../../common/HeatmapView';
import { AdGuardQueryLogEntry } from '../../../types';

interface ActivityHeatmapProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface QueryLogData {
  entries: AdGuardQueryLogEntry[];
  oldest: string;
}

export function ActivityHeatmap({ integrationId, config, widgetId }: ActivityHeatmapProps) {
  const { data, loading, error } = useWidgetData<QueryLogData>({
    integrationId,
    metric: 'query-log',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showOnlyBlocked = config.showOnlyBlocked === true;
  const showValues = config.showValues === true;
  const compactView = config.compactView === true;
  const colorScheme = (config.colorScheme as 'green' | 'blue' | 'purple' | 'orange' | 'red') || 'blue';

  // Process query log into heatmap data
  const heatmapData: HeatmapData = useMemo(() => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

    // Initialize 7x24 grid
    const values: HeatmapCell[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ value: 0 }))
    );

    if (!data?.entries) {
      return { rowLabels: dayLabels, colLabels: hourLabels, values };
    }

    // Filter and count entries
    const entries = showOnlyBlocked
      ? data.entries.filter(e =>
          e.reason.includes('Filtered') ||
          e.reason.includes('Blocked') ||
          e.reason.includes('SafeBrowsing') ||
          e.reason.includes('Parental')
        )
      : data.entries;

    entries.forEach(entry => {
      const date = new Date(entry.time);
      const day = date.getDay();
      const hour = date.getHours();
      values[day][hour].value++;
    });

    // Add tooltips
    values.forEach((row, dayIndex) => {
      row.forEach((cell, hourIndex) => {
        const label = showOnlyBlocked ? 'blocked queries' : 'queries';
        cell.tooltip = `${dayLabels[dayIndex]} ${hourLabels[hourIndex]}:00 - ${cell.value} ${label}`;
      });
    });

    return { rowLabels: dayLabels, colLabels: hourLabels, values };
  }, [data?.entries, showOnlyBlocked]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <HeatmapView
          data={heatmapData}
          colorScheme={colorScheme}
          showValues={showValues}
          compact={compactView}
          emptyMessage="No query data available"
        />
      )}
    </BaseWidget>
  );
}
