/**
 * Shared color utilities for threshold-based coloring
 * Consolidates duplicate color functions from 10+ widget files
 */

/**
 * Get text color class based on usage percentage
 */
export function getUsageColor(percent: number, warningThreshold = 75, criticalThreshold = 90): string {
  if (percent >= criticalThreshold) return 'text-red-600 dark:text-red-400';
  if (percent >= warningThreshold) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

/**
 * Get progress bar background color class based on percentage
 */
export function getProgressColor(percent: number, warningThreshold = 75, criticalThreshold = 90): string {
  if (percent >= criticalThreshold) return 'bg-red-500';
  if (percent >= warningThreshold) return 'bg-yellow-500';
  return 'bg-green-500';
}

/**
 * Get text color class based on temperature
 */
export function getTempColor(temp: number, warningThreshold = 60, criticalThreshold = 80): string {
  if (temp >= criticalThreshold) return 'text-red-600 dark:text-red-400';
  if (temp >= warningThreshold) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

/**
 * Get text color class based on health/status string
 */
export function getHealthColor(status: string): string {
  const healthyStatuses = ['healthy', 'ok', 'good', 'online', 'active', 'running', 'up', 'passed', 'success'];
  const warningStatuses = ['warning', 'degraded', 'caution', 'pending', 'unknown'];

  const lowerStatus = status.toLowerCase();
  if (healthyStatuses.includes(lowerStatus)) return 'text-green-600 dark:text-green-400';
  if (warningStatuses.includes(lowerStatus)) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get badge classes based on health/status string
 */
export function getHealthBadge(status: string): { text: string; className: string } {
  const healthyStatuses = ['healthy', 'ok', 'good', 'online', 'active', 'running', 'up', 'passed', 'success'];
  const warningStatuses = ['warning', 'degraded', 'caution', 'pending', 'unknown'];

  const lowerStatus = status.toLowerCase();
  if (healthyStatuses.includes(lowerStatus)) {
    return { text: status, className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' };
  }
  if (warningStatuses.includes(lowerStatus)) {
    return { text: status, className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' };
  }
  return { text: status, className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
}

/**
 * Get wearout/lifespan color based on percentage remaining
 */
export function getWearoutColor(percent: number): string {
  if (percent <= 10) return 'text-red-600 dark:text-red-400';
  if (percent <= 25) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

/**
 * Get signal strength color (for WiFi, etc.)
 */
export function getSignalColor(strength: number): string {
  if (strength >= 70) return 'text-green-600 dark:text-green-400';
  if (strength >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get battery level color
 */
export function getBatteryColor(percent: number): string {
  if (percent >= 50) return 'text-green-600 dark:text-green-400';
  if (percent >= 20) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}
