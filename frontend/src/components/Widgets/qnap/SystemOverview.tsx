import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { QnapSystemInfo } from '../../../types';

interface SystemOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SystemInfoData {
  systemInfo: QnapSystemInfo;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SystemOverview({ integrationId, config, widgetId }: SystemOverviewProps) {
  const { data, loading, error } = useWidgetData<SystemInfoData>({
    integrationId,
    metric: (config.metric as string) || 'system-info',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  // Configuration options
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showHostname = config.showHostname !== false;
  const showModel = config.showModel !== false;
  const showFirmware = config.showFirmware !== false;
  const showUptime = config.showUptime !== false;
  const showSerial = config.showSerial === true;

  const metricSize = (config.metricSize as string) || 'md';
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

  const visibleItems = [showHostname, showModel, showFirmware, showUptime, showSerial].filter(Boolean).length;
  const gridCols = Math.min(visibleItems, 4) || 2;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && data.systemInfo && (
        <div className={compactView ? 'p-2' : 'p-3'}>
          <div
            className={`grid gap-${compactView ? '2' : '4'}`}
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {showHostname && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Hostname</div>}
                <div className={`font-medium ${metricClass} text-gray-900 dark:text-white truncate`}>
                  {data.systemInfo.hostname}
                </div>
              </div>
            )}

            {showModel && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Model</div>}
                <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300 truncate`}>
                  {data.systemInfo.model}
                </div>
              </div>
            )}

            {showFirmware && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Firmware</div>}
                <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300 truncate`}>
                  {data.systemInfo.firmware}
                </div>
              </div>
            )}

            {showUptime && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Uptime</div>}
                <div className={`font-medium ${metricClass} text-green-600 dark:text-green-400`}>
                  {formatUptime(data.systemInfo.uptime)}
                </div>
              </div>
            )}

            {showSerial && data.systemInfo.serialNumber && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Serial</div>}
                <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300 truncate`}>
                  {data.systemInfo.serialNumber}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </BaseWidget>
  );
}
