import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { ImmichServerInfo, ImmichStorageInfo } from '../../../types';

interface ServerInfoData {
  serverInfo: ImmichServerInfo;
  storageInfo: ImmichStorageInfo | null;
  updateAvailable: boolean;
  latestVersion: string | null;
}

interface ServerInfoProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function ServerInfo({ integrationId, config, widgetId }: ServerInfoProps) {
  const { data, loading, error } = useWidgetData<ServerInfoData>({
    integrationId,
    metric: 'server-info',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const showStorage = config.showStorage !== false;
  const showVersionDetails = config.showVersionDetails !== false;
  const showUpdateStatus = config.showUpdateStatus !== false;

  // Configurable thresholds with defaults
  const warningThreshold = (config.warningThreshold as number) || 75;
  const criticalThreshold = (config.criticalThreshold as number) || 90;

  const getStorageBarColor = (percentage: number): string => {
    if (percentage > criticalThreshold) return 'bg-red-500';
    if (percentage > warningThreshold) return 'bg-yellow-500';
    return 'bg-indigo-500';
  };

  if (!data?.serverInfo) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <span>Connecting to Immich...</span>
        </div>
      </BaseWidget>
    );
  }

  const { serverInfo, storageInfo, updateAvailable, latestVersion } = data;

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={`v${serverInfo.version}`}
                className="text-indigo-600 dark:text-indigo-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Version</div>}
            </div>
            {storageInfo && (
              <div>
                <ScaledMetric
                  value={`${storageInfo.diskUsagePercentage.toFixed(0)}%`}
                  className={storageInfo.diskUsagePercentage > criticalThreshold ? 'text-red-600 dark:text-red-400' : storageInfo.diskUsagePercentage > warningThreshold ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}
                />
                {!hideLabels && <div className="text-sm text-gray-500 mt-1">Storage Used</div>}
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Version</span>
            <span className="text-gray-900 dark:text-white">v{serverInfo.version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <span className={updateAvailable ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}>
              {updateAvailable ? `${latestVersion} available` : 'Up to date'}
            </span>
          </div>
          {storageInfo && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Storage</span>
                <span className="text-gray-900 dark:text-white">{storageInfo.diskUse} / {storageInfo.diskSize}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Available</span>
                <span className={storageInfo.diskUsagePercentage > criticalThreshold ? 'text-red-600 dark:text-red-400' : storageInfo.diskUsagePercentage > warningThreshold ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}>
                  {storageInfo.diskAvailable}
                </span>
              </div>
            </>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Version Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Immich</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">v{serverInfo.version}</p>
            </div>
          </div>
          {showUpdateStatus && updateAvailable && (
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
              {latestVersion} available
            </span>
          )}
          {showUpdateStatus && !updateAvailable && (
            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              Up to date
            </span>
          )}
        </div>

        {/* Storage Bar */}
        {showStorage && storageInfo && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Storage</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {storageInfo.diskUse} / {storageInfo.diskSize}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getStorageBarColor(storageInfo.diskUsagePercentage)}`}
                style={{ width: `${Math.min(storageInfo.diskUsagePercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {storageInfo.diskAvailable} available ({storageInfo.diskUsagePercentage.toFixed(1)}% used)
            </p>
          </div>
        )}

        {/* Version Details */}
        {showVersionDetails && (serverInfo.build || serverInfo.nodejs || serverInfo.ffmpeg || serverInfo.libvips) && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {serverInfo.build && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Build: </span>
                  <span className="text-gray-700 dark:text-gray-300">{serverInfo.build.slice(0, 8)}</span>
                </div>
              )}
              {serverInfo.nodejs && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Node: </span>
                  <span className="text-gray-700 dark:text-gray-300">{serverInfo.nodejs}</span>
                </div>
              )}
              {serverInfo.ffmpeg && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">FFmpeg: </span>
                  <span className="text-gray-700 dark:text-gray-300">{serverInfo.ffmpeg}</span>
                </div>
              )}
              {serverInfo.libvips && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">libvips: </span>
                  <span className="text-gray-700 dark:text-gray-300">{serverInfo.libvips}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
