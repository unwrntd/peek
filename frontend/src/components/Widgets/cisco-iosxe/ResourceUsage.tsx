import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface ResourceUsageProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ResourceData {
  resources: {
    cpuUsage: number;
    memoryUsagePercent: number;
    memoryUsed: number;
    memoryFree: number;
    memoryTotal: number;
  };
}

export function ResourceUsage({ integrationId, config, widgetId }: ResourceUsageProps) {
  const { data, loading, error } = useWidgetData<ResourceData>({
    integrationId,
    metric: (config.metric as string) || 'resources',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const visualization = (config.visualization as string) || 'bars';
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const warningThreshold = (config.warningThreshold as number) || 75;
  const criticalThreshold = (config.criticalThreshold as number) || 90;

  const metricSize = (config.metricSize as string) || 'md';
  const metricSizeClasses: Record<string, string> = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };
  const metricClass = metricSizeClasses[metricSize] || 'text-lg';

  const getStatusColor = (value: number): string => {
    if (value >= criticalThreshold) return 'text-red-600 dark:text-red-400';
    if (value >= warningThreshold) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getBarColor = (value: number): string => {
    if (value >= criticalThreshold) return 'bg-red-500';
    if (value >= warningThreshold) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const renderBar = (label: string, value: number | undefined | null) => {
    const safeValue = value ?? 0;
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          {!hideLabels && (
            <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
          )}
          <span className={`font-medium ${metricClass} ${getStatusColor(safeValue)}`}>
            {safeValue.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${getBarColor(safeValue)}`}
            style={{ width: `${Math.min(safeValue, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  const renderGauge = (label: string, value: number | undefined | null) => {
    const safeValue = value ?? 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (safeValue / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              className="stroke-gray-200 dark:stroke-gray-700"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              className={safeValue >= criticalThreshold ? 'stroke-red-500' : safeValue >= warningThreshold ? 'stroke-yellow-500' : 'stroke-green-500'}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-bold ${metricClass} ${getStatusColor(safeValue)}`}>
              {safeValue.toFixed(0)}%
            </span>
          </div>
        </div>
        {!hideLabels && (
          <span className="mt-2 text-sm text-gray-600 dark:text-gray-400">{label}</span>
        )}
      </div>
    );
  };

  const renderText = (label: string, value: number | undefined | null) => {
    const safeValue = value ?? 0;
    return (
      <div className="text-center">
        <div className={`font-bold ${metricClass} ${getStatusColor(safeValue)}`}>
          {safeValue.toFixed(1)}%
        </div>
        {!hideLabels && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</div>
        )}
      </div>
    );
  };

  const visibleItems = [showCpu, showMemory].filter(Boolean).length;

  // Check if we have actual data (both being exactly 0 is unlikely to be real)
  const hasData = data?.resources && (
    (showCpu && data.resources.cpuUsage > 0) ||
    (showMemory && (data.resources.memoryUsagePercent > 0 || data.resources.memoryTotal > 0))
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && data.resources && !hasData && (
        <div className="p-3 h-full flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Resource data unavailable</p>
            <p className="text-xs mt-1 opacity-75">RESTCONF endpoint may not be supported</p>
          </div>
        </div>
      )}
      {data && data.resources && hasData && (
        <div className="p-3 h-full flex items-center justify-center">
          {visualization === 'bars' ? (
            <div className="w-full space-y-4">
              {showCpu && renderBar('CPU', data.resources.cpuUsage)}
              {showMemory && renderBar('Memory', data.resources.memoryUsagePercent)}
            </div>
          ) : visualization === 'gauges' ? (
            <div className={`flex ${visibleItems > 1 ? 'gap-6' : ''} justify-center`}>
              {showCpu && renderGauge('CPU', data.resources.cpuUsage)}
              {showMemory && renderGauge('Memory', data.resources.memoryUsagePercent)}
            </div>
          ) : (
            <div className={`grid gap-6 ${visibleItems > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showCpu && renderText('CPU', data.resources.cpuUsage)}
              {showMemory && renderText('Memory', data.resources.memoryUsagePercent)}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
