import React from 'react';
import { ScaledMetric } from './ScaledMetric';
import { formatBytes, formatSpeed, formatDuration, formatNumber } from '../../utils/formatting';

interface SingleMetricDisplayProps {
  value: string | number;
  label?: string;
  subLabel?: string;
  colorClass?: string;
  icon?: React.ReactNode;
  format?: 'number' | 'percent' | 'bytes' | 'speed' | 'duration' | 'none';
  hideLabel?: boolean;
  minFontSize?: number;
  maxFontSize?: number;
}

/**
 * Format a value based on the specified format type
 */
function formatValue(value: string | number, format?: string): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'percent':
      return `${Math.round(value)}%`;
    case 'bytes':
      return formatBytes(value);
    case 'speed':
      return formatSpeed(value);
    case 'duration':
      return formatDuration(value);
    case 'number':
      return formatNumber(value);
    default:
      return String(value);
  }
}

/**
 * A component for displaying a single metric prominently within a widget.
 * Uses ScaledMetric for auto-sizing text to fill available space.
 */
export function SingleMetricDisplay({
  value,
  label,
  subLabel,
  colorClass = 'text-gray-900 dark:text-white',
  icon,
  format = 'none',
  hideLabel = false,
  minFontSize = 24,
  maxFontSize = 120,
}: SingleMetricDisplayProps) {
  const formattedValue = formatValue(value, format);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-2">
      {/* Icon (optional) */}
      {icon && !hideLabel && (
        <div className="mb-2 opacity-60">
          {icon}
        </div>
      )}

      {/* Main value */}
      <div className={`w-full flex-1 flex items-center justify-center ${colorClass}`}>
        <ScaledMetric
          value={formattedValue}
          minFontSize={minFontSize}
          maxFontSize={maxFontSize}
        />
      </div>

      {/* Label */}
      {label && !hideLabel && (
        <div className="mt-2 text-center">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {label}
          </div>
          {subLabel && (
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {subLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SingleMetricDisplay;
