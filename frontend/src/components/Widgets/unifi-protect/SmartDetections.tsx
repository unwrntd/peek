import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { DonutChart } from '../../common/visualizations/DonutChart';

interface SmartDetectionsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SmartDetectionData {
  detections: {
    person: number;
    vehicle: number;
    package: number;
    animal: number;
    face: number;
    licensePlate: number;
  };
}

const detectionColors: Record<string, string> = {
  person: '#3b82f6',      // blue
  vehicle: '#8b5cf6',     // purple
  package: '#f59e0b',     // amber
  animal: '#22c55e',      // green
  face: '#06b6d4',        // cyan
  licensePlate: '#ec4899', // pink
};

const detectionIcons: Record<string, React.ReactNode> = {
  person: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  vehicle: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 0v10m8-10v10M8 17h8M5 17H4a1 1 0 01-1-1v-4a1 1 0 011-1h1m15 0h1a1 1 0 011 1v4a1 1 0 01-1 1h-1m0-6V8a4 4 0 00-4-4H8a4 4 0 00-4 4v3" />
    </svg>
  ),
  package: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  animal: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
    </svg>
  ),
  face: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  licensePlate: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
};

export function SmartDetections({ integrationId, config, widgetId }: SmartDetectionsProps) {
  const { data, loading, error } = useWidgetData<SmartDetectionData>({
    integrationId,
    metric: 'smart-detections',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showPerson = config.showPerson !== false;
  const showVehicle = config.showVehicle !== false;
  const showPackage = config.showPackage !== false;
  const showAnimal = config.showAnimal !== false;
  const showFace = config.showFace !== false;
  const showLicensePlate = config.showLicensePlate !== false;
  const showTimeRange = config.showTimeRange as boolean;
  const singleMetric = config.singleMetric as string;
  const visualization = (config.visualization as string) || 'numbers';
  const metricSize = (config.metricSize as string) || 'medium';
  const hideLabels = (config.hideLabels as boolean) || false;

  const detections = data?.detections || {
    person: 0,
    vehicle: 0,
    package: 0,
    animal: 0,
    face: 0,
    licensePlate: 0,
  };

  // Text sizes based on metricSize
  const sizeClasses = {
    small: { number: 'text-xl', label: 'text-xs', icon: 'w-4 h-4' },
    medium: { number: 'text-3xl', label: 'text-sm', icon: 'w-5 h-5' },
    large: { number: 'text-4xl', label: 'text-base', icon: 'w-6 h-6' },
  };
  const sizes = sizeClasses[metricSize as keyof typeof sizeClasses] || sizeClasses.medium;

  // Single metric mode
  if (singleMetric) {
    const metrics: Record<string, { value: number; label: string; color: string }> = {
      person: { value: detections.person, label: 'People', color: 'text-blue-600 dark:text-blue-400' },
      vehicle: { value: detections.vehicle, label: 'Vehicles', color: 'text-purple-600 dark:text-purple-400' },
      package: { value: detections.package, label: 'Packages', color: 'text-amber-600 dark:text-amber-400' },
      animal: { value: detections.animal, label: 'Animals', color: 'text-green-600 dark:text-green-400' },
    };
    const metric = metrics[singleMetric] || metrics.person;

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
          {showTimeRange && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Last 24 hours
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Build display items
  const displayItems = [
    showPerson && { key: 'person', label: 'People', value: detections.person, color: detectionColors.person, icon: detectionIcons.person },
    showVehicle && { key: 'vehicle', label: 'Vehicles', value: detections.vehicle, color: detectionColors.vehicle, icon: detectionIcons.vehicle },
    showPackage && { key: 'package', label: 'Packages', value: detections.package, color: detectionColors.package, icon: detectionIcons.package },
    showAnimal && { key: 'animal', label: 'Animals', value: detections.animal, color: detectionColors.animal, icon: detectionIcons.animal },
    showFace && { key: 'face', label: 'Faces', value: detections.face, color: detectionColors.face, icon: detectionIcons.face },
    showLicensePlate && { key: 'licensePlate', label: 'Plates', value: detections.licensePlate, color: detectionColors.licensePlate, icon: detectionIcons.licensePlate },
  ].filter(Boolean) as Array<{ key: string; label: string; value: number; color: string; icon: React.ReactNode }>;

  const total = displayItems.reduce((sum, item) => sum + item.value, 0);

  // Donut chart visualization
  if (visualization === 'donut') {
    const segments = displayItems
      .filter(item => item.value > 0)
      .map(item => ({
        label: item.label,
        value: item.value,
        color: item.color,
      }));

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full">
          <DonutChart
            segments={segments.length > 0 ? segments : [{ label: 'None', value: 1, color: '#6b7280' }]}
            centerValue={total}
            centerLabel="Total"
            size="lg"
          />
          {showTimeRange && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Last 24 hours
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Horizontal bars visualization
  if (visualization === 'bars') {
    const maxValue = Math.max(...displayItems.map(i => i.value), 1);

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-3">
          {displayItems.map(item => (
            <div key={item.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span style={{ color: item.color }}>{item.icon}</span>
                  {!hideLabels && (
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {item.value}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
          {showTimeRange && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
              Last 24 hours
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default numbers grid view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col">
        <div className="flex-1 grid grid-cols-2 gap-3">
          {displayItems.map(item => (
            <div
              key={item.key}
              className="flex flex-col items-center justify-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <div className="mb-1" style={{ color: item.color }}>
                {item.icon}
              </div>
              <div className={`${sizes.number} font-bold`} style={{ color: item.color }}>
                {item.value}
              </div>
              {!hideLabels && (
                <div className={`${sizes.label} text-gray-500 dark:text-gray-400`}>
                  {item.label}
                </div>
              )}
            </div>
          ))}
        </div>
        {showTimeRange && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
            Last 24 hours
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
