import React, { useMemo } from 'react';

interface SparklineChartProps {
  /** Array of numeric data points to display */
  data: number[];
  /** Width of the chart in pixels */
  width?: number;
  /** Height of the chart in pixels */
  height?: number;
  /** Stroke color (CSS color value or Tailwind class) */
  color?: string;
  /** Fill color under the line (optional, for area chart effect) */
  fillColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Show dots at data points */
  showDots?: boolean;
  /** Show the last value as a larger dot */
  highlightLast?: boolean;
  /** Minimum Y value (defaults to min of data) */
  minY?: number;
  /** Maximum Y value (defaults to max of data) */
  maxY?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * A simple sparkline chart component for displaying trends inline.
 * Renders as an SVG with configurable dimensions and colors.
 */
export function SparklineChart({
  data,
  width = 60,
  height = 20,
  color = '#3B82F6', // blue-500
  fillColor,
  strokeWidth = 1.5,
  showDots = false,
  highlightLast = false,
  minY,
  maxY,
  className = '',
}: SparklineChartProps) {
  const { path, fillPath, points } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: '', fillPath: '', points: [] };
    }

    const min = minY ?? Math.min(...data);
    const max = maxY ?? Math.max(...data);
    const range = max - min || 1; // Prevent division by zero

    const padding = 2; // Padding from edges
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Calculate points
    const calculatedPoints = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return { x, y };
    });

    // Build SVG path
    const linePath = calculatedPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(' ');

    // Build fill path (area under the line)
    const areaPath = fillColor
      ? `${linePath} L ${calculatedPoints[calculatedPoints.length - 1].x.toFixed(1)} ${height - padding} L ${padding} ${height - padding} Z`
      : '';

    return { path: linePath, fillPath: areaPath, points: calculatedPoints };
  }, [data, width, height, minY, maxY]);

  if (!data || data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center text-gray-300 dark:text-gray-600 ${className}`}
        style={{ width, height }}
      >
        <span className="text-xs">—</span>
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {/* Fill area (optional) */}
      {fillColor && fillPath && (
        <path
          d={fillPath}
          fill={fillColor}
          opacity={0.2}
        />
      )}

      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data point dots */}
      {showDots && points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={1.5}
          fill={color}
        />
      ))}

      {/* Highlight last point */}
      {highlightLast && points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={2.5}
          fill={color}
        />
      )}
    </svg>
  );
}

/**
 * Predefined color schemes for sparklines
 */
export const sparklineColors = {
  blue: { color: '#3B82F6', fillColor: '#3B82F6' },
  green: { color: '#10B981', fillColor: '#10B981' },
  red: { color: '#EF4444', fillColor: '#EF4444' },
  yellow: { color: '#F59E0B', fillColor: '#F59E0B' },
  purple: { color: '#8B5CF6', fillColor: '#8B5CF6' },
  gray: { color: '#6B7280', fillColor: '#6B7280' },
};

/**
 * Get color based on current value vs thresholds
 */
export function getSparklineColor(
  value: number,
  warningThreshold?: number,
  criticalThreshold?: number
): { color: string; fillColor: string } {
  if (criticalThreshold !== undefined && value >= criticalThreshold) {
    return sparklineColors.red;
  }
  if (warningThreshold !== undefined && value >= warningThreshold) {
    return sparklineColors.yellow;
  }
  return sparklineColors.green;
}
