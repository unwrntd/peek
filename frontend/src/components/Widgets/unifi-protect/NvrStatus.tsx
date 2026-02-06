import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { DonutChart } from '../../common/visualizations/DonutChart';
import { formatBytes, formatUptime } from '../../../utils/formatting';

interface NvrStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ProtectNvr {
  id: string;
  name: string;
  version: string;
  firmwareVersion: string;
  uptime: number;
  isRecordingDisabled: boolean;
  storageInfo: {
    totalSize: number;
    usedSize: number;
    totalSpaceUsed: number;
  };
  recordingRetentionDurationMs: number | null;
}

interface NvrData {
  nvr: ProtectNvr;
}

function formatRetention(ms: number | null): string {
  if (!ms) return 'Not set';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days} days`;
}

export function NvrStatus({ integrationId, config, widgetId }: NvrStatusProps) {
  const { data, loading, error } = useWidgetData<NvrData>({
    integrationId,
    metric: 'nvr',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showName = config.showName !== false;
  const showStorage = config.showStorage !== false;
  const showRecording = config.showRecording !== false;
  const showUptime = config.showUptime !== false;
  const showVersion = config.showVersion !== false;
  const showRetention = config.showRetention !== false;
  const compactView = config.compactView as boolean;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'medium';
  const storageVisualization = (config.storageVisualization as string) || 'bar';

  const nvr = data?.nvr;
  if (!nvr) {
    return <BaseWidget loading={loading} error={error}><div /></BaseWidget>;
  }

  const usedPercent = nvr.storageInfo.totalSize > 0
    ? Math.round((nvr.storageInfo.usedSize / nvr.storageInfo.totalSize) * 100)
    : 0;
  const freeSpace = nvr.storageInfo.totalSize - nvr.storageInfo.usedSize;

  // Text sizes based on metricSize
  const sizeClasses = {
    small: { title: 'text-sm', value: 'text-lg', label: 'text-xs' },
    medium: { title: 'text-base', value: 'text-2xl', label: 'text-sm' },
    large: { title: 'text-lg', value: 'text-3xl', label: 'text-base' },
  };
  const sizes = sizeClasses[metricSize as keyof typeof sizeClasses] || sizeClasses.medium;

  // Storage color based on usage
  const getStorageColor = (percent: number) => {
    if (percent > 90) return { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', hex: '#ef4444' };
    if (percent > 70) return { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', hex: '#f59e0b' };
    return { bg: 'bg-green-500', text: 'text-green-600 dark:text-green-400', hex: '#22c55e' };
  };
  const storageColor = getStorageColor(usedPercent);

  // Render storage based on visualization type
  const renderStorage = () => {
    if (storageVisualization === 'donut') {
      const segments = [
        { label: 'Used', value: nvr.storageInfo.usedSize, color: storageColor.hex },
        { label: 'Free', value: freeSpace, color: '#6b7280' },
      ];
      return (
        <div className="flex flex-col items-center">
          <DonutChart
            segments={segments}
            centerValue={`${usedPercent}%`}
            centerLabel="Used"
            size="md"
          />
          {!hideLabels && (
            <div className="flex justify-between w-full text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span>{formatBytes(nvr.storageInfo.usedSize)} used</span>
              <span>{formatBytes(nvr.storageInfo.totalSize)} total</span>
            </div>
          )}
        </div>
      );
    }

    if (storageVisualization === 'number') {
      return (
        <div className="text-center">
          <div className={`${sizes.value} font-bold ${storageColor.text}`}>
            {usedPercent}%
          </div>
          {!hideLabels && (
            <>
              <div className={`${sizes.label} text-gray-500 dark:text-gray-400`}>Storage Used</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatBytes(nvr.storageInfo.usedSize)} / {formatBytes(nvr.storageInfo.totalSize)}
              </div>
            </>
          )}
        </div>
      );
    }

    // Default: bar visualization
    return (
      <div className="space-y-2">
        {!hideLabels && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Storage</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {usedPercent}% used
            </span>
          </div>
        )}
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${storageColor.bg}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{formatBytes(nvr.storageInfo.usedSize)} used</span>
          <span>{formatBytes(nvr.storageInfo.totalSize)} total</span>
        </div>
      </div>
    );
  };

  if (compactView) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          {showName && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white">{nvr.name}</span>
              {showRecording && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  nvr.isRecordingDisabled
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}>
                  {nvr.isRecordingDisabled ? 'Recording Disabled' : 'Recording'}
                </span>
              )}
            </div>
          )}
          {showStorage && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Storage</span>
                <span>{formatBytes(nvr.storageInfo.usedSize)} / {formatBytes(nvr.storageInfo.totalSize)}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${storageColor.bg}`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            {showUptime && <span>Uptime: {formatUptime(nvr.uptime)}</span>}
            {showVersion && <span>v{nvr.version}</span>}
          </div>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Header */}
        {(showName || showRecording) && (
          <div className="flex items-center justify-between">
            {showName && (
              <div>
                <h3 className={`${sizes.title} font-semibold text-gray-900 dark:text-white`}>{nvr.name}</h3>
                {showVersion && !hideLabels && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Version {nvr.version}</p>
                )}
              </div>
            )}
            {showRecording && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                nvr.isRecordingDisabled
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-green-100 dark:bg-green-900/30'
              }`}>
                {!nvr.isRecordingDisabled && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
                <span className={`text-sm font-medium ${
                  nvr.isRecordingDisabled
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-green-700 dark:text-green-400'
                }`}>
                  {nvr.isRecordingDisabled ? 'Recording Disabled' : 'Recording'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Storage */}
        {showStorage && renderStorage()}

        {/* Stats Row */}
        {(showUptime || showRetention) && (
          <div className={`grid gap-4 ${showUptime && showRetention ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showUptime && (
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className={`${sizes.value} font-bold text-gray-900 dark:text-white`}>
                  {formatUptime(nvr.uptime)}
                </div>
                {!hideLabels && (
                  <div className={`${sizes.label} text-gray-500 dark:text-gray-400`}>Uptime</div>
                )}
              </div>
            )}
            {showRetention && (
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className={`${sizes.value} font-bold text-gray-900 dark:text-white`}>
                  {formatRetention(nvr.recordingRetentionDurationMs)}
                </div>
                {!hideLabels && (
                  <div className={`${sizes.label} text-gray-500 dark:text-gray-400`}>Retention</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
