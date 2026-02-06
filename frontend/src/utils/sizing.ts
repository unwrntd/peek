/**
 * Shared sizing utilities for metric display
 * Consolidates duplicate sizing logic from 25+ widget files
 */

export type MetricSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Get metric text size classes based on size and hideLabels setting
 */
export function getMetricSizeClasses(hideLabels: boolean): Record<MetricSize, string> {
  return hideLabels ? {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  } : {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };
}

/**
 * Get label text size classes based on size and hideLabels setting
 */
export function getLabelSizeClasses(hideLabels: boolean): Record<MetricSize, string> {
  return hideLabels ? {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm',
    xl: 'text-base',
  } : {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-sm',
  };
}

/**
 * Get icon size classes based on metric size
 */
export function getIconSizeClasses(size: MetricSize): string {
  const sizes: Record<MetricSize, string> = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };
  return sizes[size];
}

/**
 * Get gap classes for metric containers based on size
 */
export function getGapClasses(size: MetricSize): string {
  const gaps: Record<MetricSize, string> = {
    xs: 'gap-1',
    sm: 'gap-1.5',
    md: 'gap-2',
    lg: 'gap-3',
    xl: 'gap-4',
  };
  return gaps[size];
}

/**
 * Get padding classes for metric containers based on size
 */
export function getPaddingClasses(size: MetricSize): string {
  const paddings: Record<MetricSize, string> = {
    xs: 'p-1.5',
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
    xl: 'p-5',
  };
  return paddings[size];
}
