import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { DonutChart } from '../../common/visualizations';
import { UnifiDpiCategory } from '../../../types';

interface DpiStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DpiData {
  dpi: UnifiDpiCategory[];
}

// DPI category names from UniFi (based on unpoller/unifi mappings)
const categoryNames: Record<number, string> = {
  0: 'Instant Messaging',
  1: 'P2P',
  2: 'File Transfer',
  3: 'File Sharing',
  4: 'Media Streaming',
  5: 'Email & Messaging',
  6: 'VoIP',
  7: 'Database',
  8: 'Online Games',
  9: 'Network Management',
  10: 'Remote Access',
  11: 'Bypass Proxies',
  12: 'Stock Market',
  13: 'Web',
  14: 'Security Updates',
  15: 'E-Commerce',
  16: 'Business Apps',
  17: 'Network Protocols',
  18: 'Network Protocols',
  19: 'Social Networks',
  20: 'Audio Streaming',
  21: 'Video Streaming',
  22: 'VPN & Tunnels',
  23: 'IoT',
  24: 'Investment',
  25: 'News',
  26: 'Advertising',
  27: 'Cloud Services',
  28: 'Productivity',
  29: 'File Storage',
  30: 'Software Updates',
  255: 'Unknown',
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function DpiStats({ integrationId, config, widgetId }: DpiStatsProps) {
  const { data, loading, error } = useWidgetData<DpiData>({
    integrationId,
    metric: (config.metric as string) || 'dpi',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const maxItems = (config.maxItems as number) || 8;
  const minTrafficMB = (config.minTrafficMB as number) || 0;
  const minTrafficBytes = minTrafficMB * 1024 * 1024;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';
  const visualizationType = (config.visualizationType as 'bars' | 'donut') || 'bars';

  // Metric size classes
  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-base',
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  } : {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-xl' : 'text-base');

  // Sort by total bytes and apply filters
  const dpiData = data?.dpi || [];
  const sortedDpi = dpiData
    .map(d => ({
      ...d,
      total: (d.rx_bytes || 0) + (d.tx_bytes || 0),
      name: d.cat !== undefined && d.cat !== null
        ? (categoryNames[d.cat] || `Category ${d.cat}`)
        : 'Unknown Category',
    }))
    .filter(d => d.total >= minTrafficBytes)
    .sort((a, b) => b.total - a.total)
    .slice(0, maxItems);

  const maxTotal = sortedDpi.length > 0 && sortedDpi[0].total > 0 ? sortedDpi[0].total : 1;

  // Chart colors for donut segments
  const chartColors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  ];

  // Build donut segments
  const donutSegments = sortedDpi.map((cat, idx) => ({
    value: cat.total,
    label: cat.name,
    color: chartColors[idx % chartColors.length],
  }));

  // Calculate total for center value
  const totalTraffic = sortedDpi.reduce((sum, cat) => sum + cat.total, 0);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        visualizationType === 'donut' && sortedDpi.length > 0 ? (
          <DonutChart
            segments={donutSegments}
            responsive={true}
            showLegend={!hideLabels}
            showLabels={!hideLabels}
            centerValue={formatBytes(totalTraffic)}
            centerLabel={hideLabels ? undefined : 'Total'}
          />
        ) : (
          <div className="space-y-3">
            {sortedDpi.map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className={`flex justify-between ${hideLabels ? '' : 'text-sm'}`}>
                  {!hideLabels && <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{cat.name}</span>}
                  <span className={`${metricClass} font-medium text-gray-700 dark:text-gray-300 ${hideLabels ? 'w-full text-center' : 'ml-2'}`}>{formatBytes(cat.total)}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${(cat.total / maxTotal) * 100}%` }}
                  />
                </div>
                {!hideLabels && (
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>↓ {formatBytes(cat.rx_bytes)}</span>
                    <span>↑ {formatBytes(cat.tx_bytes)}</span>
                  </div>
                )}
              </div>
            ))}
            {sortedDpi.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                <p>No DPI data available</p>
                <p className="text-xs mt-1">This feature requires username/password authentication</p>
              </div>
            )}
          </div>
        )
      )}
    </BaseWidget>
  );
}
