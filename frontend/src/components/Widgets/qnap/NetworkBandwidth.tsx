import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { QnapNetworkStats } from '../../../types';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';

interface NetworkBandwidthProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface NetworkData {
  network: QnapNetworkStats;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface GaugeProps {
  value: number;
  max: number;
  label: string;
  color: string;
  hideLabels: boolean;
  showTotal?: boolean;
  totalBytes?: number;
  scale?: number;
}

function SpeedGauge({ value, max, label, color, hideLabels, showTotal, totalBytes, scale = 1 }: GaugeProps) {
  const percentage = Math.min(100, (value / max) * 100);
  const baseRadius = 40;
  const baseStrokeWidth = 8;
  const radius = baseRadius * scale;
  const strokeWidth = baseStrokeWidth * scale;
  const dimension = 96 * scale;
  const center = dimension / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const labelFontSize = 12 * scale;
  const valueFontSize = 14 * scale;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: `${dimension}px`, height: `${dimension}px` }}>
        <svg style={{ width: `${dimension}px`, height: `${dimension}px` }} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={color}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold ${color.replace('text-', 'text-').replace('-500', '-600')} dark:${color}`}
            style={{ fontSize: `${valueFontSize}px` }}
          >
            {formatSpeed(value)}
          </span>
        </div>
      </div>
      {!hideLabels && (
        <div className="text-gray-500 dark:text-gray-400" style={{ marginTop: `${4 * scale}px`, fontSize: `${labelFontSize}px` }}>
          {label}
        </div>
      )}
      {showTotal && totalBytes !== undefined && !hideLabels && (
        <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>
          Total: {formatBytes(totalBytes)}
        </div>
      )}
    </div>
  );
}

interface SpeedBarProps {
  value: number;
  max: number;
  label: string;
  color: string;
  bgColor: string;
  hideLabels: boolean;
  showTotal?: boolean;
  totalBytes?: number;
  icon: React.ReactNode;
  scale?: number;
}

function SpeedBar({ value, max, label, color, bgColor, hideLabels, showTotal, totalBytes, icon, scale = 1 }: SpeedBarProps) {
  const percentage = Math.min(100, (value / max) * 100);
  const labelFontSize = 14 * scale;
  const valueFontSize = 14 * scale;
  const barHeight = 8 * scale;

  return (
    <div style={{ gap: `${4 * scale}px` }} className="flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: `${6 * scale}px`, fontSize: `${labelFontSize}px` }}>
          {icon}
          {!hideLabels && <span className="text-gray-600 dark:text-gray-400">{label}</span>}
        </div>
        <span className={`font-medium ${color}`} style={{ fontSize: `${valueFontSize}px` }}>
          {formatSpeed(value)}
        </span>
      </div>
      <div className={`rounded-full ${bgColor} overflow-hidden`} style={{ height: `${barHeight}px` }}>
        <div
          className={`h-full rounded-full ${color.replace('text-', 'bg-')} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showTotal && totalBytes !== undefined && !hideLabels && (
        <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${12 * scale}px` }}>
          Total: {formatBytes(totalBytes)}
        </div>
      )}
    </div>
  );
}

export function NetworkBandwidth({ integrationId, config, widgetId }: NetworkBandwidthProps) {
  const { data, loading, error } = useWidgetData<NetworkData>({
    integrationId,
    metric: (config.metric as string) || 'network',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  // Get widget dimensions for content scaling
  const dimensions = useWidgetDimensions();

  // Calculate effective scale factor
  const getEffectiveScale = (): number => {
    if (!dimensions) return 1;
    const { contentScale, scaleFactors } = dimensions;
    if (contentScale === 'auto') {
      return scaleFactors.textScale;
    }
    return parseFloat(contentScale) || 1;
  };
  const scale = getEffectiveScale();

  // Configuration options
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showUpload = config.showUpload !== false;
  const showDownload = config.showDownload !== false;
  const showTotals = config.showTotals !== false;
  const visualization = (config.visualization as string) || 'text';
  // Max speed in MB/s, default 125 MB/s (1 Gbps)
  const maxSpeedMBps = (config.maxSpeed as number) || 125;
  const maxSpeedBps = maxSpeedMBps * 1024 * 1024;

  const metricSize = (config.metricSize as string) || 'md';
  // Base font sizes in pixels for different metric sizes (before scaling)
  const baseFontSizes: Record<string, number> = hideLabels ? {
    xs: 24,
    sm: 30,
    md: 36,
    lg: 44,
    xl: 54,
    xxl: 66,
    xxxl: 80,
  } : {
    xs: 18,
    sm: 22,
    md: 28,
    lg: 34,
    xl: 42,
    xxl: 52,
    xxxl: 64,
  };
  const baseFontSize = baseFontSizes[metricSize] || (hideLabels ? 36 : 28);
  const scaledFontSize = baseFontSize * scale;
  const labelFontSize = 14 * scale;
  const iconSize = 16 * scale;

  const visibleItems = [showDownload, showUpload, showTotals && showDownload, showTotals && showUpload].filter(Boolean).length;
  const gridCols = showTotals ? 2 : visibleItems || 2;

  // Render gauges visualization
  if (visualization === 'gauges' && data?.network) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center" style={{ gap: `${24 * scale}px`, padding: `${(compactView ? 8 : 12) * scale}px` }}>
          {showDownload && (
            <SpeedGauge
              value={data.network.downloadSpeed}
              max={maxSpeedBps}
              label="Download"
              color="text-green-500"
              hideLabels={hideLabels}
              showTotal={showTotals}
              totalBytes={data.network.totalDownload}
              scale={scale}
            />
          )}
          {showUpload && (
            <SpeedGauge
              value={data.network.uploadSpeed}
              max={maxSpeedBps}
              label="Upload"
              color="text-blue-500"
              hideLabels={hideLabels}
              showTotal={showTotals}
              totalBytes={data.network.totalUpload}
              scale={scale}
            />
          )}
        </div>
      </BaseWidget>
    );
  }

  // Render bars visualization
  if (visualization === 'bars' && data?.network) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col justify-center" style={{ gap: `${12 * scale}px`, padding: `${(compactView ? 8 : 12) * scale}px` }}>
          {showDownload && (
            <SpeedBar
              value={data.network.downloadSpeed}
              max={maxSpeedBps}
              label="Download"
              color="text-green-600 dark:text-green-400"
              bgColor="bg-gray-200 dark:bg-gray-700"
              hideLabels={hideLabels}
              showTotal={showTotals}
              totalBytes={data.network.totalDownload}
              scale={scale}
              icon={
                <svg className="text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: `${16 * scale}px`, height: `${16 * scale}px` }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              }
            />
          )}
          {showUpload && (
            <SpeedBar
              value={data.network.uploadSpeed}
              max={maxSpeedBps}
              label="Upload"
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-gray-200 dark:bg-gray-700"
              hideLabels={hideLabels}
              showTotal={showTotals}
              totalBytes={data.network.totalUpload}
              scale={scale}
              icon={
                <svg className="text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: `${16 * scale}px`, height: `${16 * scale}px` }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              }
            />
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default text visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {data && data.network && (
        <div className="h-full flex flex-col justify-center" style={{ padding: `${(compactView ? 8 : 12) * scale}px` }}>
          {showTotals ? (
            // Layout with totals - 2 columns
            <div className="grid grid-cols-2" style={{ gap: `${16 * scale}px` }}>
              {showDownload && (
                <div className={hideLabels ? 'text-center' : ''}>
                  {!hideLabels && (
                    <div
                      className="flex items-center text-gray-500 dark:text-gray-400"
                      style={{ gap: `${4 * scale}px`, fontSize: `${labelFontSize}px`, marginBottom: `${4 * scale}px` }}
                    >
                      <svg className="text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      Download
                    </div>
                  )}
                  <div className="font-medium text-green-600 dark:text-green-400" style={{ fontSize: `${scaledFontSize}px` }}>
                    {hideLabels && <span className="text-green-500" style={{ marginRight: `${4 * scale}px` }}>↓</span>}
                    {formatSpeed(data.network.downloadSpeed)}
                  </div>
                  {!hideLabels && (
                    <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px`, marginTop: `${4 * scale}px` }}>
                      Total: {formatBytes(data.network.totalDownload)}
                    </div>
                  )}
                </div>
              )}

              {showUpload && (
                <div className={hideLabels ? 'text-center' : ''}>
                  {!hideLabels && (
                    <div
                      className="flex items-center text-gray-500 dark:text-gray-400"
                      style={{ gap: `${4 * scale}px`, fontSize: `${labelFontSize}px`, marginBottom: `${4 * scale}px` }}
                    >
                      <svg className="text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Upload
                    </div>
                  )}
                  <div className="font-medium text-blue-600 dark:text-blue-400" style={{ fontSize: `${scaledFontSize}px` }}>
                    {hideLabels && <span className="text-blue-500" style={{ marginRight: `${4 * scale}px` }}>↑</span>}
                    {formatSpeed(data.network.uploadSpeed)}
                  </div>
                  {!hideLabels && (
                    <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px`, marginTop: `${4 * scale}px` }}>
                      Total: {formatBytes(data.network.totalUpload)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Simple layout without totals
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, gap: `${(compactView ? 8 : 16) * scale}px` }}
            >
              {showDownload && (
                <div className={hideLabels ? 'text-center' : ''}>
                  {!hideLabels && (
                    <div
                      className="flex items-center text-gray-500 dark:text-gray-400"
                      style={{ gap: `${4 * scale}px`, fontSize: `${labelFontSize}px`, marginBottom: `${4 * scale}px` }}
                    >
                      <svg className="text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      Download
                    </div>
                  )}
                  <div className="font-medium text-green-600 dark:text-green-400" style={{ fontSize: `${scaledFontSize}px` }}>
                    {hideLabels && <span className="text-green-500" style={{ marginRight: `${4 * scale}px` }}>↓</span>}
                    {formatSpeed(data.network.downloadSpeed)}
                  </div>
                </div>
              )}

              {showUpload && (
                <div className={hideLabels ? 'text-center' : ''}>
                  {!hideLabels && (
                    <div
                      className="flex items-center text-gray-500 dark:text-gray-400"
                      style={{ gap: `${4 * scale}px`, fontSize: `${labelFontSize}px`, marginBottom: `${4 * scale}px` }}
                    >
                      <svg className="text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Upload
                    </div>
                  )}
                  <div className="font-medium text-blue-600 dark:text-blue-400" style={{ fontSize: `${scaledFontSize}px` }}>
                    {hideLabels && <span className="text-blue-500" style={{ marginRight: `${4 * scale}px` }}>↑</span>}
                    {formatSpeed(data.network.uploadSpeed)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
