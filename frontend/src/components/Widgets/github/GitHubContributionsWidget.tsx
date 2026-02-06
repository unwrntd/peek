import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface GitHubContributionDay {
  date: string;
  contributionCount: number;
  color: string;
}

interface GitHubContributionWeek {
  contributionDays: GitHubContributionDay[];
}

interface GitHubContributionCalendar {
  totalContributions: number;
  weeks: GitHubContributionWeek[];
}

interface ContributionsData {
  contributions: GitHubContributionCalendar | null;
}

interface GitHubContributionsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function GitHubContributionsWidget({ integrationId, config, widgetId }: GitHubContributionsWidgetProps) {
  const { data, loading, error } = useWidgetData<ContributionsData>({
    integrationId,
    metric: 'contributions',
    refreshInterval: (config.refreshInterval as number) || 3600000, // 1 hour default
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const showTotal = config.showTotal !== false;
  const showDayLabels = config.showDayLabels !== false;
  const showMonthLabels = config.showMonthLabels !== false;
  const showStreak = config.showStreak !== false;
  const timeRange = (config.timeRange as string) || 'year';

  const { weeks, totalContributions, currentStreak, longestStreak } = useMemo(() => {
    if (!data?.contributions) {
      return { weeks: [], totalContributions: 0, currentStreak: 0, longestStreak: 0 };
    }

    let weeks = data.contributions.weeks;

    // Filter by time range
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

    weeks = weeks.filter(week =>
      week.contributionDays.some(day => new Date(day.date) >= startDate)
    );

    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const allDays = weeks.flatMap(w => w.contributionDays).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Current streak (from today backwards)
    for (const day of allDays) {
      if (day.contributionCount > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak
    for (const day of [...allDays].reverse()) {
      if (day.contributionCount > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return {
      weeks,
      totalContributions: data.contributions.totalContributions,
      currentStreak,
      longestStreak,
    };
  }, [data?.contributions, timeRange]);

  const getColorClass = (color: string) => {
    // GitHub uses specific colors for contribution levels
    const colorMap: Record<string, string> = {
      '#ebedf0': 'bg-gray-100 dark:bg-gray-800',
      '#9be9a8': 'bg-green-200 dark:bg-green-900',
      '#40c463': 'bg-green-400 dark:bg-green-700',
      '#30a14e': 'bg-green-500 dark:bg-green-600',
      '#216e39': 'bg-green-700 dark:bg-green-500',
    };
    return colorMap[color] || 'bg-gray-100 dark:bg-gray-800';
  };

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getMonthsInRange = () => {
    if (weeks.length === 0) return [];

    const months: { label: string; weekIndex: number }[] = [];
    let currentMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDay = week.contributionDays[0];
      if (firstDay) {
        const month = new Date(firstDay.date).getMonth();
        if (month !== currentMonth) {
          currentMonth = month;
          months.push({ label: monthLabels[month], weekIndex });
        }
      }
    });

    return months;
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data?.contributions && (
        <div className="h-full flex flex-col">
          {!hideLabels && (showTotal || showStreak) && (
            <div className="flex items-center justify-between mb-2 text-sm">
              {showTotal && (
                <span className="text-gray-900 dark:text-white font-medium">
                  {totalContributions.toLocaleString()} contributions
                </span>
              )}
              {showStreak && (
                <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>Current: {currentStreak}d</span>
                  <span>Longest: {longestStreak}d</span>
                </div>
              )}
            </div>
          )}
          <div className="flex-1 overflow-x-auto">
            <div className="inline-flex flex-col">
              {!hideLabels && showMonthLabels && (
                <div className="flex mb-1 text-xs text-gray-500 dark:text-gray-400" style={{ marginLeft: showDayLabels ? '24px' : '0' }}>
                  {getMonthsInRange().map((month, idx) => (
                    <span
                      key={idx}
                      className="text-center"
                      style={{
                        position: 'absolute',
                        left: `${(showDayLabels ? 24 : 0) + month.weekIndex * 12}px`,
                      }}
                    >
                      {month.label}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex">
                {!hideLabels && showDayLabels && (
                  <div className="flex flex-col mr-1 text-xs text-gray-500 dark:text-gray-400">
                    {dayLabels.map((label, idx) => (
                      <div key={idx} className="h-[10px] text-right pr-1 leading-[10px]">
                        {label}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-[2px]">
                  {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-[2px]">
                      {week.contributionDays.map((day, dayIdx) => (
                        <div
                          key={dayIdx}
                          className={`w-[10px] h-[10px] rounded-sm ${getColorClass(day.color)}`}
                          title={`${day.date}: ${day.contributionCount} contribution${day.contributionCount !== 1 ? 's' : ''}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {!hideLabels && (
            <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Less</span>
              <div className="w-[10px] h-[10px] rounded-sm bg-gray-100 dark:bg-gray-800" />
              <div className="w-[10px] h-[10px] rounded-sm bg-green-200 dark:bg-green-900" />
              <div className="w-[10px] h-[10px] rounded-sm bg-green-400 dark:bg-green-700" />
              <div className="w-[10px] h-[10px] rounded-sm bg-green-500 dark:bg-green-600" />
              <div className="w-[10px] h-[10px] rounded-sm bg-green-700 dark:bg-green-500" />
              <span>More</span>
            </div>
          )}
        </div>
      )}
      {!data?.contributions && !loading && !error && (
        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
          No contribution data available
        </div>
      )}
    </BaseWidget>
  );
}
