// Utility functions for visualization components

/**
 * Convert polar coordinates to cartesian
 */
export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

/**
 * Generate SVG arc path for circular gauges
 */
export function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

/**
 * Get color class based on value and thresholds
 */
export function getThresholdColor(
  value: number,
  warningThreshold = 75,
  criticalThreshold = 90
): { text: string; stroke: string; fill: string } {
  if (value >= criticalThreshold) {
    return {
      text: 'text-red-500',
      stroke: 'stroke-red-500',
      fill: 'fill-red-500',
    };
  }
  if (value >= warningThreshold) {
    return {
      text: 'text-yellow-500',
      stroke: 'stroke-yellow-500',
      fill: 'fill-yellow-500',
    };
  }
  return {
    text: 'text-green-500',
    stroke: 'stroke-green-500',
    fill: 'fill-green-500',
  };
}

/**
 * Get hex color based on value and thresholds (for SVG inline styles)
 */
export function getThresholdHexColor(
  value: number,
  warningThreshold = 75,
  criticalThreshold = 90
): string {
  if (value >= criticalThreshold) return '#ef4444'; // red-500
  if (value >= warningThreshold) return '#eab308'; // yellow-500
  return '#22c55e'; // green-500
}

/**
 * Size presets for visualization components
 */
export const sizePresets = {
  xs: { dimension: 48, strokeWidth: 4, fontSize: 10 },
  sm: { dimension: 64, strokeWidth: 5, fontSize: 12 },
  md: { dimension: 80, strokeWidth: 6, fontSize: 14 },
  lg: { dimension: 100, strokeWidth: 7, fontSize: 16 },
  xl: { dimension: 120, strokeWidth: 8, fontSize: 18 },
  xxl: { dimension: 150, strokeWidth: 10, fontSize: 22 },
} as const;

export type SizePreset = keyof typeof sizePresets;

/**
 * Default color palette for charts
 */
export const chartColors = [
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
];

/**
 * Get color from palette by index (cycles through)
 */
export function getChartColor(index: number): string {
  return chartColors[index % chartColors.length];
}

/**
 * Calculate SVG polyline points from data array
 */
export function dataToPolylinePoints(
  data: number[],
  width: number,
  height: number,
  padding = 2
): string {
  if (data.length === 0) return '';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * innerWidth;
      const y = padding + innerHeight - ((value - min) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(' ');
}

/**
 * Calculate SVG polygon points for area chart (closed path)
 */
export function dataToAreaPoints(
  data: number[],
  width: number,
  height: number,
  padding = 2
): string {
  if (data.length === 0) return '';

  const linePoints = dataToPolylinePoints(data, width, height, padding);
  const innerWidth = width - padding * 2;

  // Close the polygon at the bottom
  return `${padding},${height - padding} ${linePoints} ${padding + innerWidth},${height - padding}`;
}
