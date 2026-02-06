import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { StatusIndicator } from '../../common/StatusIndicator';
import { UnifiHealth } from '../../../types';

interface NetworkHealthProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface HealthData {
  health: UnifiHealth[];
}

const subsystemIcons: Record<string, string> = {
  www: 'Internet',
  wan: 'WAN',
  lan: 'LAN',
  wlan: 'WiFi',
  vpn: 'VPN',
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function NetworkHealth({ integrationId, config, widgetId }: NetworkHealthProps) {
  const { data, loading, error } = useWidgetData<HealthData>({
    integrationId,
    metric: (config.metric as string) || 'health',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const showUsers = config.showUsers !== false;
  const showGuests = config.showGuests !== false;
  const showThroughput = config.showThroughput !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';

  // Subsystem visibility (default to true if not set)
  const showWww = config.showWww !== false;
  const showWan = config.showWan !== false;
  const showLan = config.showLan !== false;
  const showWlan = config.showWlan !== false;
  const showVpn = config.showVpn !== false;

  // Metric size classes
  const metricSizeClasses: Record<string, string> = hideLabels ? {
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
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-2xl' : 'text-base');

  // Apply filters based on subsystem checkboxes
  const subsystemVisibility: Record<string, boolean> = {
    www: showWww,
    wan: showWan,
    lan: showLan,
    wlan: showWlan,
    vpn: showVpn,
  };

  const filteredHealth = data?.health.filter(item => {
    return subsystemVisibility[item.subsystem] !== false;
  }) || [];

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {filteredHealth.map(item => (
            <div
              key={item.subsystem}
              className={`border border-gray-200 dark:border-gray-700 rounded-lg ${compactView ? 'p-2' : 'p-3'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {subsystemIcons[item.subsystem] || item.subsystem.toUpperCase()}
                </span>
                <StatusIndicator status={item.status} />
              </div>
              <div className={`grid grid-cols-2 gap-2 ${hideLabels ? '' : 'text-xs'}`}>
                {showUsers && item.num_user > 0 && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Users</span>}
                    <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300`}>{item.num_user}</div>
                  </div>
                )}
                {showGuests && item.num_guest > 0 && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Guests</span>}
                    <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300`}>{item.num_guest}</div>
                  </div>
                )}
                {showThroughput && (item.rx_bytes > 0 || item.tx_bytes > 0) && (
                  <>
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Download</span>}
                      <div className={`font-medium ${metricClass} text-green-600 dark:text-green-400`}>{formatBytes(item.rx_bytes)}</div>
                    </div>
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Upload</span>}
                      <div className={`font-medium ${metricClass} text-blue-600 dark:text-blue-400`}>{formatBytes(item.tx_bytes)}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredHealth.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.health.length === 0 ? 'No health data available' : 'No subsystems match filter'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
