import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { DonutChart } from '../../common/visualizations/DonutChart';

interface CameraCountProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ProtectCamera {
  id: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  isRecording: boolean;
}

interface CameraData {
  cameras: ProtectCamera[];
}

export function CameraCount({ integrationId, config, widgetId }: CameraCountProps) {
  const { data, loading, error } = useWidgetData<CameraData>({
    integrationId,
    metric: 'cameras',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const total = data?.cameras.length || 0;
  const online = data?.cameras.filter(c => c.state === 'CONNECTED').length || 0;
  // Only count cameras that are both online AND recording
  const recording = data?.cameras.filter(c => c.state === 'CONNECTED' && c.isRecording).length || 0;
  const offline = total - online;

  const showOnline = config.showOnline !== false;
  const showRecording = config.showRecording !== false;
  const singleMetric = config.singleMetric as string;
  const visualization = (config.visualization as string) || 'numbers';
  const metricSize = (config.metricSize as string) || 'medium';
  const hideLabels = (config.hideLabels as boolean) || false;

  // Text sizes based on metricSize
  const sizeClasses = {
    small: { number: 'text-2xl', label: 'text-xs' },
    medium: { number: 'text-4xl', label: 'text-sm' },
    large: { number: 'text-5xl', label: 'text-base' },
  };
  const sizes = sizeClasses[metricSize as keyof typeof sizeClasses] || sizeClasses.medium;

  // Single metric mode
  if (singleMetric) {
    const metrics: Record<string, { value: number; label: string; color: string }> = {
      total: { value: total, label: 'Total Cameras', color: 'text-gray-900 dark:text-white' },
      online: { value: online, label: 'Online', color: 'text-green-600 dark:text-green-400' },
      recording: { value: recording, label: 'Recording', color: 'text-red-600 dark:text-red-400' },
    };
    const metric = metrics[singleMetric] || metrics.total;

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full">
          <div className={`${sizes.number} font-bold ${metric.color}`}>
            {metric.value}
          </div>
          {!hideLabels && (
            <div className={`${sizes.label} text-gray-500 dark:text-gray-400`}>
              {metric.label}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Donut chart visualization
  if (visualization === 'donut') {
    const segments = [
      { label: 'Online', value: online, color: '#22c55e' },
      { label: 'Offline', value: offline, color: '#ef4444' },
    ];

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <DonutChart
            segments={segments}
            centerValue={total}
            centerLabel="Total"
            size="lg"
          />
        </div>
      </BaseWidget>
    );
  }

  // Default numbers view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className={`${sizes.number} font-bold text-gray-900 dark:text-white`}>
          {total}
        </div>
        {!hideLabels && (
          <div className={`${sizes.label} text-gray-500 dark:text-gray-400`}>
            Total Cameras
          </div>
        )}
        <div className="flex gap-4 mt-2">
          {showOnline && (
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {online}
              </div>
              {!hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Online</div>
              )}
            </div>
          )}
          {showRecording && (
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                {recording}
              </div>
              {!hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Recording</div>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
