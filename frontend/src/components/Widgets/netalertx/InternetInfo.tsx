import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { NetAlertXInternetInfo } from '../../../types';

interface InternetInfoData {
  info: NetAlertXInternetInfo;
}

interface InternetInfoProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function InternetInfo({ integrationId, config, widgetId }: InternetInfoProps) {
  const { data, loading, error } = useWidgetData<InternetInfoData>({
    integrationId,
    metric: 'internet-info',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const hideLabels = config.hideLabels === true;
  const metricSize = (config.metricSize as string) || 'default';

  const info = data?.info;

  const getTextSize = () => {
    if (metricSize === 'small') return 'text-sm';
    if (metricSize === 'large') return 'text-xl';
    return 'text-lg';
  };

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Public IP */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              {!hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Public IP</p>
              )}
              <p className={`${getTextSize()} font-mono font-medium text-gray-900 dark:text-white`}>
                {info?.ip || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Additional Info Grid */}
        <div className="grid grid-cols-2 gap-2">
          {info?.hostname && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Hostname</p>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {info.hostname}
              </p>
            </div>
          )}

          {info?.city && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400">City</p>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {info.city}
              </p>
            </div>
          )}

          {info?.region && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Region</p>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {info.region}
              </p>
            </div>
          )}

          {info?.country && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Country</p>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {info.country}
              </p>
            </div>
          )}

          {info?.org && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 col-span-2">
              {!hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400">ISP</p>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {info.org}
              </p>
            </div>
          )}

          {info?.timezone && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              {!hideLabels && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Timezone</p>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {info.timezone}
              </p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
