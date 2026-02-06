/**
 * Shared formatting utilities
 * Consolidates duplicate formatting functions from 20+ widget files
 */

/**
 * Format bytes to human-readable string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format bytes per second to human-readable string (e.g., "1.5 MB/s")
 */
export function formatBytesPerSec(bytes: number, decimals = 1): string {
  return `${formatBytes(bytes, decimals)}/s`;
}

/**
 * Alias for formatBytesPerSec for backward compatibility
 */
export function formatSpeed(bytesPerSec: number, decimals = 1): string {
  return formatBytesPerSec(bytesPerSec, decimals);
}

/**
 * Format duration in seconds to human-readable string (e.g., "2h 30m")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDurationMs(ms: number): string {
  return formatDuration(ms / 1000);
}

/**
 * Format large numbers with K/M/B suffixes (e.g., "1.5M")
 */
export function formatNumber(num: number, decimals = 1): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(decimals)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`;
  return num.toFixed(0);
}

/**
 * Format percentage (e.g., "75.5%")
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format temperature with unit (e.g., "45°C")
 */
export function formatTemperature(temp: number, unit: 'C' | 'F' = 'C'): string {
  return `${Math.round(temp)}°${unit}`;
}

/**
 * Format frequency in Hz to human-readable string (e.g., "3.2 GHz")
 */
export function formatFrequency(hz: number): string {
  if (hz >= 1000000000) return `${(hz / 1000000000).toFixed(1)} GHz`;
  if (hz >= 1000000) return `${(hz / 1000000).toFixed(1)} MHz`;
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)} KHz`;
  return `${hz} Hz`;
}

/**
 * Format uptime from seconds to human-readable string (e.g., "5d 12h 30m")
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return parts.join(' ');
}

/**
 * Format a timestamp to time string (e.g., "14:30:45")
 */
export function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Format a timestamp to relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}
