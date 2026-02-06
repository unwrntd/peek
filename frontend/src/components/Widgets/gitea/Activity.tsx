import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface ActivityProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface HeatmapEntry {
  timestamp: number;
  contributions: number;
}

interface ActivityData {
  heatmap: HeatmapEntry[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getContributionColor(count: number, maxCount: number): string {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
  const intensity = Math.min(count / Math.max(maxCount, 1), 1);
  if (intensity < 0.25) return 'bg-green-200 dark:bg-green-900';
  if (intensity < 0.5) return 'bg-green-400 dark:bg-green-700';
  if (intensity < 0.75) return 'bg-green-500 dark:bg-green-600';
  return 'bg-green-600 dark:bg-green-500';
}

export function Activity({ integrationId, config, widgetId }: ActivityProps) {
  const { data, loading, error } = useWidgetData<ActivityData>({
    integrationId,
    metric: 'activity',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const showTotal = config.showTotal !== false;
  const showDayLabels = config.showDayLabels !== false;
  const showMonthLabels = config.showMonthLabels !== false;
  const timeRange = (config.timeRange as string) || 'year';
  const hideLabels = config.hideLabels === true;

  const { heatmapData, totalContributions, maxContributions, monthLabels } = useMemo(() => {
    if (!data?.heatmap) {
      return { heatmapData: [], totalContributions: 0, maxContributions: 0, monthLabels: [] };
    }

    // Convert heatmap entries to date-indexed map
    const contributionMap = new Map<string, number>();
    data.heatmap.forEach(entry => {
      const date = new Date(entry.timestamp * 1000);
      const key = date.toISOString().split('T')[0];
      contributionMap.set(key, (contributionMap.get(key) || 0) + entry.contributions);
    });

    // Determine date range
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case 'year':
      default:
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }

    // Build weeks array (Sunday-aligned)
    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    // Start from the Sunday of the start week
    const current = new Date(startDate);
    current.setDate(current.getDate() - current.getDay());

    while (current <= now) {
      const dayOfWeek = current.getDay();

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      const key = current.toISOString().split('T')[0];
      const count = contributionMap.get(key) || 0;
      currentWeek.push({ date: new Date(current), count });

      current.setDate(current.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Calculate totals
    let total = 0;
    let max = 0;
    weeks.forEach(week => {
      week.forEach(day => {
        total += day.count;
        max = Math.max(max, day.count);
      });
    });

    // Generate month labels with positions
    const labels: { month: string; position: number }[] = [];
    let currentMonth = -1;
    weeks.forEach((week, weekIdx) => {
      const firstDay = week.find(d => d.date.getDate() <= 7);
      if (firstDay && firstDay.date.getMonth() !== currentMonth) {
        currentMonth = firstDay.date.getMonth();
        labels.push({ month: MONTHS[currentMonth], position: weekIdx });
      }
    });

    return {
      heatmapData: weeks,
      totalContributions: total,
      maxContributions: max,
      monthLabels: labels,
    };
  }, [data?.heatmap, timeRange]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-2">
          {showTotal && !hideLabels && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">{totalContributions}</span>
              {' contributions'}
              {timeRange === 'year' ? ' in the last year' : ` in the last ${timeRange === 'month' ? 'month' : timeRange.replace('months', ' months')}`}
            </div>
          )}

          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-0.5">
              {/* Month labels */}
              {showMonthLabels && !hideLabels && (
                <div className="flex ml-4 mb-1">
                  {monthLabels.map((label, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-gray-500 dark:text-gray-400"
                      style={{
                        position: 'relative',
                        left: `${label.position * 11}px`,
                        width: '30px',
                      }}
                    >
                      {label.month}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-0.5">
                {/* Day labels */}
                {showDayLabels && !hideLabels && (
                  <div className="flex flex-col gap-0.5 mr-1">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                      <div
                        key={day}
                        className="w-3 h-2.5 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end"
                      >
                        {day % 2 === 1 ? DAYS[day].charAt(0) : ''}
                      </div>
                    ))}
                  </div>
                )}

                {/* Heatmap grid */}
                <div className="flex gap-0.5">
                  {heatmapData.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-0.5">
                      {week.map((day, dayIdx) => (
                        <div
                          key={dayIdx}
                          className={`w-2.5 h-2.5 rounded-sm ${getContributionColor(day.count, maxContributions)}`}
                          title={`${day.date.toDateString()}: ${day.count} contributions`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              {!hideLabels && (
                <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Less</span>
                  <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 dark:bg-gray-800" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-green-200 dark:bg-green-900" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-green-400 dark:bg-green-700" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-green-500 dark:bg-green-600" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-green-600 dark:bg-green-500" />
                  <span>More</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </BaseWidget>
  );
}
