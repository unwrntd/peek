import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { BaseWidget } from '../BaseWidget';

interface WanInfoProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface WanData {
  wan: {
    wan_ip: string | null;
    wan2_ip: string | null;
    wan1_status: string;
    wan2_status: string;
    gw_name: string | null;
    gw_mac: string | null;
    gw_version: string | null;
    wan1_isp_name: string | null;
    wan1_isp_organization: string | null;
    wan2_isp_name: string | null;
    wan2_isp_organization: string | null;
    wan1_netmask: string | null;
    wan2_netmask: string | null;
    wan1_uptime: number | null;
    wan2_uptime: number | null;
    wan1_tx_bytes: number;
    wan1_rx_bytes: number;
    wan2_tx_bytes: number;
    wan2_rx_bytes: number;
  };
}

function formatUptime(seconds: number | null, isWan2 = false): string {
  if (seconds === null || seconds === undefined) {
    return isWan2 ? 'N/A' : '—';
  }
  if (seconds === 0) return '0m';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B/s';
  if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(2)} GB/s`;
  } else if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(2)} MB/s`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB/s`;
  }
  return `${bytes} B/s`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ok':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'error':
    case 'unknown':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export function WanInfo({ integrationId, config, widgetId }: WanInfoProps) {
  const { rIP, rHost } = useRedact();
  const { data, loading, error } = useWidgetData<WanData>({
    integrationId,
    metric: (config.metric as string) || 'wan',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const wanInterface = (config.wanInterface as string) || ''; // '', 'wan1', or 'wan2'
  const showWan1 = wanInterface === '' || wanInterface === 'wan1';
  const showWan2 = wanInterface === '' || wanInterface === 'wan2';
  const showIsp = config.showIsp !== false;
  const showGateway = config.showGateway !== false;
  const showNetmask = config.showNetmask !== false;
  const showUptime = config.showUptime !== false;
  const showThroughput = config.showThroughput !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';

  // Metric size classes for IP addresses
  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-xl',
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl',
  } : {
    xs: 'text-base',
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-3xl' : 'text-xl');

  const wan = data?.wan;

  // Check if WAN2 should be shown (only if it exists and is selected)
  const hasWan2 = wan?.wan2_ip !== null;
  const displayWan2 = showWan2 && hasWan2;

  // Determine which status to show based on selected interface
  const displayStatus = wanInterface === 'wan2' ? wan?.wan2_status : wan?.wan1_status;

  return (
    <BaseWidget loading={loading} error={error}>
      {wan ? (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {/* Status indicator */}
          {!hideLabels && (
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(displayStatus || 'unknown')}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                {wanInterface === 'wan2' ? 'WAN 2' : wanInterface === 'wan1' ? 'WAN 1' : 'WAN'} {displayStatus === 'ok' ? 'Online' : displayStatus}
              </span>
            </div>
          )}

          {/* WAN IPs */}
          <div className={`grid ${compactView ? 'gap-2' : 'gap-3'}`} style={{ gridTemplateColumns: showWan1 && displayWan2 ? 'repeat(2, 1fr)' : '1fr' }}>
            {/* WAN 1 */}
            {showWan1 && (
              <div className={`${compactView ? 'p-2' : 'p-3'} ${hideLabels ? '' : 'bg-blue-50 dark:bg-blue-900/20'} rounded-lg ${hideLabels ? 'flex items-center justify-center' : ''}`}>
                {!hideLabels && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {hasWan2 ? 'WAN 1' : 'WAN IP'}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(wan.wan1_status)}`} />
                  </div>
                )}
                <div className={`${metricClass} font-bold text-blue-700 dark:text-blue-300 font-mono`}>
                  {rIP(wan.wan_ip)}
                </div>
                {!compactView && !hideLabels && showNetmask && wan.wan1_netmask && (
                  <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                    /{wan.wan1_netmask}
                  </div>
                )}
                {!hideLabels && showIsp && wan.wan1_isp_name && (
                  <div className="text-xs text-blue-500 dark:text-blue-400 mt-1 truncate">
                    {wan.wan1_isp_name}
                  </div>
                )}
                {!hideLabels && showThroughput && (
                  <div className="flex justify-between text-xs mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                    <span className="text-green-600 dark:text-green-400">↓ {formatBytes(wan.wan1_rx_bytes)}</span>
                    <span className="text-blue-600 dark:text-blue-400">↑ {formatBytes(wan.wan1_tx_bytes)}</span>
                  </div>
                )}
              </div>
            )}

            {/* WAN 2 */}
            {displayWan2 && (
              <div className={`${compactView ? 'p-2' : 'p-3'} ${hideLabels ? '' : 'bg-purple-50 dark:bg-purple-900/20'} rounded-lg ${hideLabels ? 'flex items-center justify-center' : ''}`}>
                {!hideLabels && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">WAN 2</span>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(wan.wan2_status)}`} />
                  </div>
                )}
                <div className={`${metricClass} font-bold text-purple-700 dark:text-purple-300 font-mono`}>
                  {rIP(wan.wan2_ip)}
                </div>
                {!compactView && !hideLabels && showNetmask && wan.wan2_netmask && (
                  <div className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                    /{wan.wan2_netmask}
                  </div>
                )}
                {!hideLabels && showIsp && wan.wan2_isp_name && (
                  <div className="text-xs text-purple-500 dark:text-purple-400 mt-1 truncate">
                    {wan.wan2_isp_name}
                  </div>
                )}
                {!hideLabels && showThroughput && (
                  <div className="flex justify-between text-xs mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                    <span className="text-green-600 dark:text-green-400">↓ {formatBytes(wan.wan2_rx_bytes)}</span>
                    <span className="text-purple-600 dark:text-purple-400">↑ {formatBytes(wan.wan2_tx_bytes)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Show message if WAN2 selected but not available */}
            {wanInterface === 'wan2' && !hasWan2 && (
              <div className={`${compactView ? 'p-2' : 'p-3'} bg-gray-50 dark:bg-gray-700 rounded-lg`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">WAN 2</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Not configured
                </div>
              </div>
            )}
          </div>

          {/* Gateway Info */}
          {!hideLabels && showGateway && wan.gw_name && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <span>{rHost(wan.gw_name)}</span>
              {!compactView && wan.gw_version && (
                <span className="text-xs text-gray-400">v{wan.gw_version}</span>
              )}
            </div>
          )}

          {/* Uptime */}
          {!hideLabels && showUptime && (
            <div className={`${compactView ? 'p-1.5' : 'p-2'} bg-gray-50 dark:bg-gray-700 rounded text-center`}>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {wanInterface === 'wan2' ? 'WAN2 Uptime' : 'WAN1 Uptime'}
              </div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {formatUptime(wanInterface === 'wan2' ? wan.wan2_uptime : wan.wan1_uptime, wanInterface === 'wan2')}
              </div>
            </div>
          )}

          {/* Combined Throughput - only in combined view */}
          {!hideLabels && showThroughput && wanInterface === '' && displayWan2 && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className={`${compactView ? 'p-1.5' : 'p-2'} bg-gray-50 dark:bg-gray-700 rounded`}>
                <div className="text-xs text-gray-500 dark:text-gray-400">↓ Total</div>
                <div className="text-sm font-medium text-green-600 dark:text-green-400">
                  {formatBytes(wan.wan1_rx_bytes + wan.wan2_rx_bytes)}
                </div>
              </div>
              <div className={`${compactView ? 'p-1.5' : 'p-2'} bg-gray-50 dark:bg-gray-700 rounded`}>
                <div className="text-xs text-gray-500 dark:text-gray-400">↑ Total</div>
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {formatBytes(wan.wan1_tx_bytes + wan.wan2_tx_bytes)}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <p>No WAN info available</p>
        </div>
      )}
    </BaseWidget>
  );
}
