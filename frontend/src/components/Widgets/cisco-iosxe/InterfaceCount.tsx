import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface InterfaceCountProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface CiscoInterface {
  name: string;
  operStatus: 'up' | 'down' | 'testing' | 'dormant' | 'notPresent' | 'lowerLayerDown' | 'unknown';
  adminStatus: 'up' | 'down';
}

interface InterfaceData {
  interfaces: CiscoInterface[];
}

export function InterfaceCount({ integrationId, config, widgetId }: InterfaceCountProps) {
  const { data, loading, error } = useWidgetData<InterfaceData>({
    integrationId,
    metric: (config.metric as string) || 'interfaces',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const singleMetric = (config.singleMetric as string) || '';
  const showTotal = config.showTotal !== false;
  const showUp = config.showUp !== false;
  const showDown = config.showDown !== false;

  const metricSize = (config.metricSize as string) || 'md';
  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-2xl',
    sm: 'text-3xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-6xl',
  } : {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-4xl' : 'text-2xl');

  const total = data?.interfaces?.length || 0;
  const upCount = data?.interfaces?.filter(i => i.operStatus === 'up').length || 0;
  const downCount = data?.interfaces?.filter(i => i.operStatus === 'down' || i.operStatus === 'lowerLayerDown' || i.operStatus === 'notPresent').length || 0;

  const renderSingleMetric = () => {
    let value: number;
    let label: string;
    let colorClass: string;

    switch (singleMetric) {
      case 'up':
        value = upCount;
        label = 'Up';
        colorClass = 'text-green-600 dark:text-green-400';
        break;
      case 'down':
        value = downCount;
        label = 'Down';
        colorClass = 'text-red-600 dark:text-red-400';
        break;
      default:
        value = total;
        label = 'Total';
        colorClass = 'text-gray-900 dark:text-white';
    }

    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className={`font-bold ${metricClass} ${colorClass}`}>
          {value}
        </div>
        {!hideLabels && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {label} Interfaces
          </div>
        )}
      </div>
    );
  };

  const visibleItems = [showTotal, showUp, showDown].filter(Boolean).length;
  const gridCols = Math.min(visibleItems, 3) || 1;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="p-3 h-full flex items-center justify-center">
          {singleMetric ? (
            renderSingleMetric()
          ) : (
            <div
              className="grid gap-4 w-full"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
            >
              {showTotal && (
                <div className="text-center">
                  <div className={`font-bold ${metricClass} text-gray-900 dark:text-white`}>
                    {total}
                  </div>
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</div>
                  )}
                </div>
              )}
              {showUp && (
                <div className="text-center">
                  <div className={`font-bold ${metricClass} text-green-600 dark:text-green-400`}>
                    {upCount}
                  </div>
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Up</div>
                  )}
                </div>
              )}
              {showDown && (
                <div className="text-center">
                  <div className={`font-bold ${metricClass} text-red-600 dark:text-red-400`}>
                    {downCount}
                  </div>
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Down</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
