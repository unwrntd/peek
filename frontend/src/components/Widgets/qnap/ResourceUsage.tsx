import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { CircularGauge } from '../../common/visualizations';
import { QnapSystemStats } from '../../../types';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';
import { formatBytes } from '../../../utils/formatting';
import { getUsageColor, getProgressColor, getTempColor } from '../../../utils/colors';

interface ResourceUsageProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface StatsData {
  stats: QnapSystemStats;
}

// Wrapper for getTempColor to handle null values
function getTempColorSafe(temp: number | null): string {
  if (temp === null) return 'text-gray-500 dark:text-gray-400';
  return getTempColor(temp);
}

export function ResourceUsage({ integrationId, config, widgetId }: ResourceUsageProps) {
  const { data, loading, error } = useWidgetData<StatsData>({
    integrationId,
    metric: (config.metric as string) || 'system-stats',
    refreshInterval: (config.refreshInterval as number) || 15000,
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
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showCpuTemp = config.showCpuTemp !== false;
  const showSysTemp = config.showSysTemp !== false;
  // Support both 'visualization' (new) and 'visualizationType' (legacy) config keys
  const visualizationType = (config.visualization as 'text' | 'bars' | 'gauges') || (config.visualizationType as 'text' | 'bars' | 'gauges') || 'bars';
  const warningThreshold = (config.warningThreshold as number) || 75;
  const criticalThreshold = (config.criticalThreshold as number) || 90;
  // Totals display options (default to showing when defaultEnabled is true in config)
  const showTotalRam = config.showTotalRam !== false;

  const metricSize = (config.metricSize as string) || 'md';
  // Base font sizes in pixels
  const baseFontSizes: Record<string, number> = hideLabels ? {
    xs: 18,
    sm: 20,
    md: 24,
    lg: 30,
    xl: 36,
  } : {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
  };
  const baseFontSize = baseFontSizes[metricSize] || (hideLabels ? 24 : 16);
  const scaledFontSize = baseFontSize * scale;
  const labelFontSize = 12 * scale;

  // Calculate how many gauges to show for full-height mode
  const gaugeCount = [showCpu, showMemory, showCpuTemp, showSysTemp].filter(Boolean).length;
  const singleStatGauges = visualizationType === 'gauges' && gaugeCount > 0;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && data.stats && (
        singleStatGauges ? (
          // Full-height gauge mode
          <div className="h-full w-full flex items-stretch gap-2">
            {showCpu && (
              <div className="flex-1 h-full min-w-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <CircularGauge
                    value={data.stats.cpu.usage}
                    responsive={true}
                    showValue={true}
                    showLabel={!hideLabels}
                    label="CPU"
                    warningThreshold={warningThreshold}
                    criticalThreshold={criticalThreshold}
                  />
                </div>
              </div>
            )}
            {showMemory && (
              <div className="flex-1 h-full min-w-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <CircularGauge
                    value={data.stats.memory.usagePercent}
                    responsive={true}
                    showValue={true}
                    showLabel={!hideLabels}
                    label="Memory"
                    warningThreshold={warningThreshold}
                    criticalThreshold={criticalThreshold}
                  />
                </div>
                {showTotalRam && data.stats.memory.total > 0 && !hideLabels && (
                  <div className="text-xs text-center text-gray-500 dark:text-gray-400 -mt-1">
                    {formatBytes(data.stats.memory.total)}
                  </div>
                )}
              </div>
            )}
            {showCpuTemp && data.stats.cpu.temperature !== null && (
              <div className="flex-1 h-full min-w-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <CircularGauge
                    value={data.stats.cpu.temperature}
                    responsive={true}
                    showValue={true}
                    showLabel={!hideLabels}
                    label="CPU Temp"
                    unit="°C"
                    warningThreshold={60}
                    criticalThreshold={80}
                  />
                </div>
              </div>
            )}
            {showSysTemp && data.stats.systemTemperature !== null && (
              <div className="flex-1 h-full min-w-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <CircularGauge
                    value={data.stats.systemTemperature}
                    responsive={true}
                    showValue={true}
                    showLabel={!hideLabels}
                    label="System"
                    unit="°C"
                    warningThreshold={45}
                    criticalThreshold={60}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={compactView ? 'space-y-2' : 'space-y-3'}>
            {/* Text-only visualization */}
            {visualizationType === 'text' && (
              <div className={`grid ${hideLabels ? 'grid-cols-2' : 'grid-cols-2'}`} style={{ gap: `${12 * scale}px` }}>
                {showCpu && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>CPU Usage</div>}
                    <div className={`font-medium ${getUsageColor(data.stats.cpu.usage, warningThreshold, criticalThreshold)}`} style={{ fontSize: `${scaledFontSize}px` }}>
                      {data.stats.cpu.usage.toFixed(1)}%
                    </div>
                  </div>
                )}
                {showMemory && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>Memory Usage</div>}
                    <div className={`font-medium ${getUsageColor(data.stats.memory.usagePercent, warningThreshold, criticalThreshold)}`} style={{ fontSize: `${scaledFontSize}px` }}>
                      {data.stats.memory.usagePercent.toFixed(1)}%
                    </div>
                    {!hideLabels && (
                      <div className="text-gray-500 dark:text-gray-400 mt-0.5" style={{ fontSize: `${labelFontSize}px` }}>
                        {formatBytes(data.stats.memory.used)} / {formatBytes(data.stats.memory.total)}
                      </div>
                    )}
                  </div>
                )}
                {showCpuTemp && data.stats.cpu.temperature !== null && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>CPU Temp</div>}
                    <div className={`font-medium ${getTempColorSafe(data.stats.cpu.temperature)}`} style={{ fontSize: `${scaledFontSize}px` }}>
                      {data.stats.cpu.temperature}°C
                    </div>
                  </div>
                )}
                {showSysTemp && data.stats.systemTemperature !== null && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>System Temp</div>}
                    <div className={`font-medium ${getTempColorSafe(data.stats.systemTemperature)}`} style={{ fontSize: `${scaledFontSize}px` }}>
                      {data.stats.systemTemperature}°C
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Progress bars visualization */}
            {visualizationType === 'bars' && (
              <>
                <div className={`grid ${hideLabels ? 'grid-cols-2' : 'grid-cols-2'}`} style={{ gap: `${12 * scale}px` }}>
                  {showCpu && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>CPU Usage</div>}
                      <div className={`font-medium ${getUsageColor(data.stats.cpu.usage, warningThreshold, criticalThreshold)}`} style={{ fontSize: `${scaledFontSize}px` }}>
                        {data.stats.cpu.usage.toFixed(1)}%
                      </div>
                      {!hideLabels && (
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full mt-1" style={{ height: `${6 * scale}px` }}>
                          <div
                            className={`h-full ${getProgressColor(data.stats.cpu.usage, warningThreshold, criticalThreshold)} rounded-full transition-all`}
                            style={{ width: `${Math.min(data.stats.cpu.usage, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {showMemory && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>Memory Usage</div>}
                      <div className={`font-medium ${getUsageColor(data.stats.memory.usagePercent, warningThreshold, criticalThreshold)}`} style={{ fontSize: `${scaledFontSize}px` }}>
                        {data.stats.memory.usagePercent.toFixed(1)}%
                      </div>
                      {!hideLabels && (
                        <>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full mt-1" style={{ height: `${6 * scale}px` }}>
                            <div
                              className={`h-full ${getProgressColor(data.stats.memory.usagePercent, warningThreshold, criticalThreshold)} rounded-full transition-all`}
                              style={{ width: `${Math.min(data.stats.memory.usagePercent, 100)}%` }}
                            />
                          </div>
                          <div className="text-gray-500 dark:text-gray-400 mt-0.5" style={{ fontSize: `${labelFontSize}px` }}>
                            {formatBytes(data.stats.memory.used)} / {formatBytes(data.stats.memory.total)}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Temperature section for bars view */}
                {(showCpuTemp || showSysTemp) && !hideLabels && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400 mb-1" style={{ fontSize: `${labelFontSize}px` }}>Temperatures</div>
                    <div className="flex flex-wrap" style={{ gap: `${8 * scale}px` }}>
                      {showCpuTemp && data.stats.cpu.temperature !== null && (
                        <span
                          className={`rounded ${
                            data.stats.cpu.temperature >= 80
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : data.stats.cpu.temperature >= 60
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                          style={{ fontSize: `${labelFontSize}px`, padding: `${2 * scale}px ${8 * scale}px` }}
                        >
                          CPU: {data.stats.cpu.temperature}°C
                        </span>
                      )}
                      {showSysTemp && data.stats.systemTemperature !== null && (
                        <span
                          className={`rounded ${
                            data.stats.systemTemperature >= 60
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : data.stats.systemTemperature >= 45
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                          style={{ fontSize: `${labelFontSize}px`, padding: `${2 * scale}px ${8 * scale}px` }}
                        >
                          System: {data.stats.systemTemperature}°C
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Compact temperature display when hideLabels is true */}
                {(showCpuTemp || showSysTemp) && hideLabels && (
                  <div className="flex justify-center" style={{ gap: `${16 * scale}px`, fontSize: `${scaledFontSize * 0.6}px` }}>
                    {showCpuTemp && data.stats.cpu.temperature !== null && (
                      <span className={getTempColorSafe(data.stats.cpu.temperature)}>
                        CPU: {data.stats.cpu.temperature}°C
                      </span>
                    )}
                    {showSysTemp && data.stats.systemTemperature !== null && (
                      <span className={getTempColorSafe(data.stats.systemTemperature)}>
                        Sys: {data.stats.systemTemperature}°C
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )
      )}
    </BaseWidget>
  );
}
