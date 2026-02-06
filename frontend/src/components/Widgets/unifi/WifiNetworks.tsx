import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { UnifiWlan } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface WifiNetworksProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface WlanData {
  wlans: UnifiWlan[];
}

export function WifiNetworks({ integrationId, config, widgetId }: WifiNetworksProps) {
  const { data, loading, error } = useWidgetData<WlanData>({
    integrationId,
    metric: (config.metric as string) || 'wlans',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Column visibility (default to true if not set)
  const showName = config.showName !== false;
  const showStatus = config.showStatus !== false;
  const showSecurity = config.showSecurity !== false;
  const showClients = config.showClients !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';

  // Metric size classes
  // When hideLabels is true, use larger sizes
  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-xl',
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl',
  } : {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-3xl' : 'text-lg');

  // Apply filters
  const filteredWlans = data?.wlans.filter(wlan => {
    // Show disabled filter
    const showDisabled = config.showDisabled as boolean;
    if (!showDisabled && !wlan.enabled) return false;

    // Network type filter
    const networkType = config.networkType as string;
    if (networkType === 'user' && wlan.is_guest) return false;
    if (networkType === 'guest' && !wlan.is_guest) return false;

    // Search filter (supports wildcards and comma-separated lists)
    const search = config.search as string;
    if (search && !matchesAnyFilter([wlan.name, wlan.security], search)) {
      return false;
    }

    return true;
  }) || [];

  // Check if we're in single metric mode (one network, only clients shown, labels hidden)
  const singleMetricMode = hideLabels && showClients && !showName && !showStatus && !showSecurity && filteredWlans.length === 1;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        singleMetricMode ? (
          // Single metric mode - scale to fill widget
          <ScaledMetric
            value={filteredWlans[0].num_sta}
            className="text-gray-900 dark:text-white"
          />
        ) : (
          <div className={`${hideLabels && showClients && !showName && !showStatus && !showSecurity ? 'h-full flex flex-col justify-center' : 'space-y-2'}`}>
            {filteredWlans.map(wlan => (
              <div
                key={wlan._id}
                className={`${hideLabels && showClients && !showName && !showStatus && !showSecurity
                  ? 'flex items-center justify-center p-2'
                  : 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'}`}
              >
                {!(hideLabels && showClients && !showName && !showStatus && !showSecurity) && (
                  <div className="flex items-center gap-3">
                    {showStatus && (
                      <div className={`w-2 h-2 rounded-full ${wlan.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                    )}
                    <div>
                      {showName && (
                        <div className="font-medium text-gray-900 dark:text-white">{wlan.name}</div>
                      )}
                      {(showSecurity || wlan.is_guest) && !hideLabels && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {showSecurity && wlan.security} {wlan.is_guest && '• Guest'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {showClients && (
                  <div className={hideLabels && !showName && !showStatus && !showSecurity ? 'text-center' : 'text-right'}>
                    <div className={`${metricClass} font-semibold text-gray-900 dark:text-white leading-none`}>{wlan.num_sta}</div>
                    {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">clients</div>}
                  </div>
                )}
              </div>
            ))}
            {filteredWlans.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                <p>{data.wlans.length === 0 ? 'No WiFi networks found' : 'No networks match filters'}</p>
                {data.wlans.length === 0 && (
                  <p className="text-xs mt-1">This feature requires username/password authentication</p>
                )}
              </div>
            )}
          </div>
        )
      )}
    </BaseWidget>
  );
}
