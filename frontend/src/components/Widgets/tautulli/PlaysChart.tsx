import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface TautulliPlaysByDate {
  categories: string[];
  series: {
    name: string;
    data: number[];
  }[];
}

interface PlaysByDateData {
  playsByDate: TautulliPlaysByDate;
}

interface PlaysChartProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

const SERIES_COLORS: Record<string, string> = {
  'movies': '#3B82F6',
  'tv': '#10B981',
  'music': '#8B5CF6',
  'live': '#F59E0B',
};

function getSeriesColor(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [key, color] of Object.entries(SERIES_COLORS)) {
    if (lowerName.includes(key)) {
      return color;
    }
  }
  return '#6B7280';
}

// Simple line chart component
function LineChart({
  data,
  series,
  categories,
  height = 150,
  showLegend = true,
  chartType = 'line',
}: {
  data: Record<string, number>[];
  series: { name: string; color: string }[];
  categories: string[];
  height?: number;
  showLegend?: boolean;
  chartType?: 'line' | 'bar' | 'area';
}) {
  const padding = { top: 10, right: 10, bottom: 30, left: 40 };
  const chartWidth = 300;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate max value across all series
  const maxValue = useMemo(() => {
    let max = 0;
    data.forEach(point => {
      series.forEach(s => {
        const value = point[s.name] || 0;
        if (value > max) max = value;
      });
    });
    return max || 1;
  }, [data, series]);

  // Generate Y axis labels
  const yLabels = useMemo(() => {
    const steps = 4;
    const labels = [];
    for (let i = 0; i <= steps; i++) {
      labels.push(Math.round((maxValue / steps) * i));
    }
    return labels;
  }, [maxValue]);

  // Generate paths for each series
  const paths = useMemo(() => {
    return series.map(s => {
      const points = data.map((point, index) => {
        const x = padding.left + (index / Math.max(data.length - 1, 1)) * (chartWidth - padding.left - padding.right);
        const y = padding.top + chartHeight - ((point[s.name] || 0) / maxValue) * chartHeight;
        return { x, y, value: point[s.name] || 0 };
      });

      // Line path
      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      // Area path (for filled area chart)
      const areaPath = chartType === 'area' && points.length > 0
        ? linePath + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`
        : '';

      return { ...s, points, linePath, areaPath };
    });
  }, [data, series, maxValue, chartHeight, chartType]);

  // Bar chart rendering
  const barWidth = chartType === 'bar' && data.length > 0
    ? (chartWidth - padding.left - padding.right) / data.length / (series.length + 0.5) * 0.8
    : 0;

  return (
    <div className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${chartWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {/* Grid lines */}
        {yLabels.map((label, i) => {
          const y = padding.top + chartHeight - (i / (yLabels.length - 1)) * chartHeight;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                className="stroke-gray-200 dark:stroke-gray-700"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 5}
                y={y}
                className="fill-gray-400 dark:fill-gray-500"
                fontSize="9"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {categories.length > 0 && categories.map((cat, i) => {
          // Show every nth label based on count
          const showEvery = Math.ceil(categories.length / 6);
          if (i % showEvery !== 0 && i !== categories.length - 1) return null;

          const x = padding.left + (i / Math.max(categories.length - 1, 1)) * (chartWidth - padding.left - padding.right);
          const date = new Date(cat);
          const label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

          return (
            <text
              key={i}
              x={x}
              y={height - 5}
              className="fill-gray-400 dark:fill-gray-500"
              fontSize="8"
              textAnchor="middle"
            >
              {label}
            </text>
          );
        })}

        {/* Render based on chart type */}
        {chartType === 'bar' ? (
          // Bar chart
          data.map((point, dataIndex) => (
            <g key={dataIndex}>
              {series.map((s, seriesIndex) => {
                const x = padding.left + (dataIndex / Math.max(data.length - 1, 1)) * (chartWidth - padding.left - padding.right)
                  - (series.length * barWidth) / 2 + seriesIndex * barWidth;
                const value = point[s.name] || 0;
                const barHeight = (value / maxValue) * chartHeight;
                const y = padding.top + chartHeight - barHeight;

                return (
                  <rect
                    key={`${dataIndex}-${seriesIndex}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={s.color}
                    opacity={0.8}
                    rx={1}
                  />
                );
              })}
            </g>
          ))
        ) : (
          // Line or Area chart
          paths.map((p, index) => (
            <g key={index}>
              {chartType === 'area' && (
                <path
                  d={p.areaPath}
                  fill={p.color}
                  opacity={0.15}
                />
              )}
              <path
                d={p.linePath}
                fill="none"
                stroke={p.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points */}
              {p.points.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r={2}
                  fill={p.color}
                  className="opacity-0 hover:opacity-100 transition-opacity"
                />
              ))}
            </g>
          ))
        )}
      </svg>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
          {series.map((s, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {s.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlaysChart({ integrationId, config, widgetId }: PlaysChartProps) {
  const { data, loading, error } = useWidgetData<PlaysByDateData>({
    integrationId,
    metric: 'plays-by-date',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const chartType = (config.chartType as 'line' | 'bar' | 'area') || 'line';
  const showMovies = config.showMovies !== false;
  const showTV = config.showTV !== false;
  const showMusic = config.showMusic !== false;
  const showLegend = config.showLegend !== false;

  // Transform data for the chart
  const { chartData, visibleSeries, categories } = useMemo(() => {
    if (!data?.playsByDate) {
      return { chartData: [], visibleSeries: [], categories: [] };
    }

    const { categories, series } = data.playsByDate;

    // Filter series based on config
    const filteredSeries = series.filter(s => {
      const name = s.name.toLowerCase();
      if (name.includes('movie') && !showMovies) return false;
      if (name.includes('tv') && !showTV) return false;
      if (name.includes('music') && !showMusic) return false;
      return true;
    });

    // Transform to chart data format
    const transformed = categories.map((date, index) => {
      const point: Record<string, number | string> = { date };
      filteredSeries.forEach(s => {
        point[s.name] = s.data[index] || 0;
      });
      return point;
    });

    const seriesConfig = filteredSeries.map(s => ({
      name: s.name,
      color: getSeriesColor(s.name),
    }));

    return {
      chartData: transformed as Record<string, number>[],
      visibleSeries: seriesConfig,
      categories,
    };
  }, [data, showMovies, showTV, showMusic]);

  return (
    <BaseWidget loading={loading} error={error}>
      {chartData.length > 0 ? (
        <div className="h-full w-full flex flex-col">
          <div className="flex-1 min-h-0">
            <LineChart
              data={chartData}
              series={visibleSeries}
              categories={categories}
              height={180}
              showLegend={showLegend}
              chartType={chartType}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No play data available</p>
        </div>
      )}
    </BaseWidget>
  );
}
