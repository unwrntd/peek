import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { UnifiSpeedTest } from '../../../types';

interface SpeedTestProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SpeedTestData {
  speedtest: UnifiSpeedTest | null;
}

function formatSpeed(mbps: number): string {
  if (!mbps) return '—';
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(1)} Gbps`;
  }
  return `${mbps.toFixed(1)} Mbps`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function SpeedTest({ integrationId, config, widgetId }: SpeedTestProps) {
  const { data, loading, error } = useWidgetData<SpeedTestData>({
    integrationId,
    metric: (config.metric as string) || 'speedtest',
    refreshInterval: (config.refreshInterval as number) || 30000, // 5 minutes
    widgetId,
  });

  // Configuration options with defaults
  const showDownload = config.showDownload !== false;
  const showUpload = config.showUpload !== false;
  const showLatency = config.showLatency !== false;
  const showDate = config.showDate !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';

  // Metric size classes for the speed values
  // When hideLabels is true, use larger sizes to fill the widget
  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-2xl',
    sm: 'text-3xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-6xl',
    xxl: 'text-7xl',
    xxxl: 'text-8xl',
  } : {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    xxl: 'text-5xl',
    xxxl: 'text-6xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-4xl' : 'text-2xl');

  const speedtest = data?.speedtest;

  // Count visible metrics for grid layout
  const visibleMetrics = [showDownload, showUpload].filter(Boolean).length;

  // When hideLabels is true and only one speed metric is shown, use ScaledMetric
  const singleScaledMetric = hideLabels && visibleMetrics === 1 && !showLatency;

  return (
    <BaseWidget loading={loading} error={error}>
      {speedtest ? (
        hideLabels && singleScaledMetric ? (
          // Auto scale mode - scale to fill widget when only one metric shown
          <ScaledMetric
            value={showDownload ? formatSpeed(speedtest.xput_download) : formatSpeed(speedtest.xput_upload)}
            className={showDownload ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}
          />
        ) : (
        <div className="h-full flex flex-col">
          <div className={`flex-1 grid gap-${compactView ? '2' : '4'}`} style={{ gridTemplateColumns: `repeat(${visibleMetrics || 1}, minmax(0, 1fr))` }}>
            {/* Download */}
            {showDownload && (
              <div className={`flex flex-col items-center justify-center ${compactView ? 'p-2' : 'p-4'} ${hideLabels ? '' : 'bg-green-50 dark:bg-green-900/20'} rounded-lg`}>
                {!hideLabels && (
                  <svg className={`${compactView ? 'w-6 h-6' : 'w-8 h-8'} text-green-500 mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                <div className={`${compactView ? 'text-xl' : metricClass} font-bold text-green-600 dark:text-green-400`}>
                  {formatSpeed(speedtest.xput_download)}
                </div>
                {!hideLabels && <div className="text-xs text-green-600 dark:text-green-400">Download</div>}
              </div>
            )}

            {/* Upload */}
            {showUpload && (
              <div className={`flex flex-col items-center justify-center ${compactView ? 'p-2' : 'p-4'} ${hideLabels ? '' : 'bg-blue-50 dark:bg-blue-900/20'} rounded-lg`}>
                {!hideLabels && (
                  <svg className={`${compactView ? 'w-6 h-6' : 'w-8 h-8'} text-blue-500 mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                )}
                <div className={`${compactView ? 'text-xl' : metricClass} font-bold text-blue-600 dark:text-blue-400`}>
                  {formatSpeed(speedtest.xput_upload)}
                </div>
                {!hideLabels && <div className="text-xs text-blue-600 dark:text-blue-400">Upload</div>}
              </div>
            )}
          </div>

          {/* Latency */}
          {showLatency && (
            <div className={`${compactView ? 'mt-2' : 'mt-4'} flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400`}>
              {!hideLabels && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              <span className={hideLabels ? metricClass : 'text-sm'}>
                {!hideLabels && 'Latency: '}<span className="font-medium">{speedtest.latency ? `${speedtest.latency} ms` : '—'}</span>
              </span>
            </div>
          )}

          {/* Last run time */}
          {showDate && !hideLabels && (
            <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Last tested: {formatDate(speedtest.rundate)}
            </div>
          )}
        </div>
        )
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No speed test results</p>
          <p className="text-xs mt-1">Run a speed test from your UniFi controller</p>
          <p className="text-xs">Requires username/password authentication</p>
        </div>
      )}
    </BaseWidget>
  );
}
