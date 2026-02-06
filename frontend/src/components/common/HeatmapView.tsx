import React from 'react';

export interface HeatmapCell {
  /** Value for this cell (0-100 or raw value) */
  value: number;
  /** Optional label for the cell */
  label?: string;
  /** Optional tooltip text */
  tooltip?: string;
}

export interface HeatmapData {
  /** Row labels (e.g., days of week) */
  rowLabels: string[];
  /** Column labels (e.g., hours of day) */
  colLabels: string[];
  /** 2D array of values [row][col] */
  values: HeatmapCell[][];
}

interface HeatmapViewProps {
  data: HeatmapData;
  /** Color scheme for the heatmap */
  colorScheme?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'gray';
  /** Show cell values */
  showValues?: boolean;
  /** Compact mode with smaller cells */
  compact?: boolean;
  /** Optional title for the heatmap */
  title?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Optional max value for normalization (auto-calculated if not provided) */
  maxValue?: number;
  /** Optional min value for normalization (defaults to 0) */
  minValue?: number;
}

const colorSchemes: Record<string, { bg: string; text: string; scale: string[] }> = {
  green: {
    bg: 'bg-green-50 dark:bg-green-950',
    text: 'text-green-900 dark:text-green-100',
    scale: [
      'bg-green-50 dark:bg-green-950/30',
      'bg-green-100 dark:bg-green-900/40',
      'bg-green-200 dark:bg-green-800/50',
      'bg-green-300 dark:bg-green-700/60',
      'bg-green-400 dark:bg-green-600/70',
      'bg-green-500 dark:bg-green-500',
      'bg-green-600 dark:bg-green-400',
    ],
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-900 dark:text-blue-100',
    scale: [
      'bg-blue-50 dark:bg-blue-950/30',
      'bg-blue-100 dark:bg-blue-900/40',
      'bg-blue-200 dark:bg-blue-800/50',
      'bg-blue-300 dark:bg-blue-700/60',
      'bg-blue-400 dark:bg-blue-600/70',
      'bg-blue-500 dark:bg-blue-500',
      'bg-blue-600 dark:bg-blue-400',
    ],
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950',
    text: 'text-orange-900 dark:text-orange-100',
    scale: [
      'bg-orange-50 dark:bg-orange-950/30',
      'bg-orange-100 dark:bg-orange-900/40',
      'bg-orange-200 dark:bg-orange-800/50',
      'bg-orange-300 dark:bg-orange-700/60',
      'bg-orange-400 dark:bg-orange-600/70',
      'bg-orange-500 dark:bg-orange-500',
      'bg-orange-600 dark:bg-orange-400',
    ],
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-900 dark:text-red-100',
    scale: [
      'bg-red-50 dark:bg-red-950/30',
      'bg-red-100 dark:bg-red-900/40',
      'bg-red-200 dark:bg-red-800/50',
      'bg-red-300 dark:bg-red-700/60',
      'bg-red-400 dark:bg-red-600/70',
      'bg-red-500 dark:bg-red-500',
      'bg-red-600 dark:bg-red-400',
    ],
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    text: 'text-purple-900 dark:text-purple-100',
    scale: [
      'bg-purple-50 dark:bg-purple-950/30',
      'bg-purple-100 dark:bg-purple-900/40',
      'bg-purple-200 dark:bg-purple-800/50',
      'bg-purple-300 dark:bg-purple-700/60',
      'bg-purple-400 dark:bg-purple-600/70',
      'bg-purple-500 dark:bg-purple-500',
      'bg-purple-600 dark:bg-purple-400',
    ],
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    text: 'text-gray-900 dark:text-gray-100',
    scale: [
      'bg-gray-50 dark:bg-gray-900/30',
      'bg-gray-100 dark:bg-gray-800/40',
      'bg-gray-200 dark:bg-gray-700/50',
      'bg-gray-300 dark:bg-gray-600/60',
      'bg-gray-400 dark:bg-gray-500/70',
      'bg-gray-500 dark:bg-gray-400',
      'bg-gray-600 dark:bg-gray-300',
    ],
  },
};

function getColorClass(value: number, min: number, max: number, scale: string[]): string {
  if (max === min) return scale[0];
  const normalized = (value - min) / (max - min);
  const index = Math.min(Math.floor(normalized * scale.length), scale.length - 1);
  return scale[Math.max(0, index)];
}

/**
 * A reusable heatmap visualization component.
 * Ideal for showing activity patterns over time (e.g., queries by hour/day).
 */
export function HeatmapView({
  data,
  colorScheme = 'green',
  showValues = false,
  compact = false,
  title,
  emptyMessage = 'No data to display',
  maxValue,
  minValue = 0,
}: HeatmapViewProps) {
  const scheme = colorSchemes[colorScheme] || colorSchemes.green;

  // Calculate max value if not provided
  const calculatedMax = maxValue ?? Math.max(
    ...data.values.flat().map(cell => cell.value),
    1 // Prevent division by zero
  );

  const cellSize = compact ? 'w-4 h-4' : 'w-6 h-6';
  const fontSize = compact ? 'text-[8px]' : 'text-[10px]';
  const labelSize = compact ? 'text-[9px]' : 'text-xs';

  if (data.values.length === 0 || data.values[0].length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
        <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-sm">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && (
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h4>
      )}

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Column labels */}
          <div className="flex">
            <div className={`${compact ? 'w-8' : 'w-12'}`} /> {/* Spacer for row labels */}
            {data.colLabels.map((label, colIndex) => (
              <div
                key={colIndex}
                className={`${cellSize} flex items-center justify-center ${labelSize} text-gray-500 dark:text-gray-400`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Rows */}
          {data.values.map((row, rowIndex) => (
            <div key={rowIndex} className="flex items-center">
              {/* Row label */}
              <div className={`${compact ? 'w-8' : 'w-12'} ${labelSize} text-gray-500 dark:text-gray-400 pr-1 text-right`}>
                {data.rowLabels[rowIndex]}
              </div>

              {/* Cells */}
              {row.map((cell, colIndex) => (
                <div
                  key={colIndex}
                  className={`${cellSize} ${getColorClass(cell.value, minValue, calculatedMax, scheme.scale)}
                    rounded-sm m-[1px] flex items-center justify-center
                    transition-all duration-150 hover:ring-2 hover:ring-gray-500 dark:hover:ring-gray-400 cursor-default`}
                  title={cell.tooltip || `${data.rowLabels[rowIndex]} ${data.colLabels[colIndex]}: ${cell.value}`}
                >
                  {showValues && (
                    <span className={`${fontSize} ${cell.value > calculatedMax * 0.6 ? 'text-white' : scheme.text}`}>
                      {cell.label || (cell.value > 0 ? cell.value : '')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Less</span>
        {scheme.scale.map((color, index) => (
          <div
            key={index}
            className={`w-3 h-3 ${color} rounded-sm`}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/**
 * Helper function to create heatmap data from a simple array of timestamped values.
 * Useful for converting activity logs into a week/hour heatmap.
 */
export function createWeekHourHeatmap(
  timestamps: number[],
  format: 'count' | 'sum' = 'count'
): HeatmapData {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

  // Initialize 7x24 grid
  const values: HeatmapCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ value: 0 }))
  );

  // Count events for each day/hour
  timestamps.forEach(timestamp => {
    const date = new Date(timestamp);
    const day = date.getDay();
    const hour = date.getHours();
    values[day][hour].value++;
  });

  // Add tooltips
  values.forEach((row, dayIndex) => {
    row.forEach((cell, hourIndex) => {
      cell.tooltip = `${dayLabels[dayIndex]} ${hourLabels[hourIndex]}:00 - ${cell.value} events`;
    });
  });

  return {
    rowLabels: dayLabels,
    colLabels: hourLabels,
    values,
  };
}
