import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { DonutChart } from '../../common/visualizations';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';

interface ClientCountProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ClientData {
  summary: {
    total: number;
    wired: number;
    wireless: number;
  };
}

export function ClientCount({ integrationId, config, widgetId }: ClientCountProps) {
  const { data, loading, error } = useWidgetData<ClientData>({
    integrationId,
    metric: (config.metric as string) || 'clients',
    refreshInterval: (config.refreshInterval as number) || 30000,
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

  // Configuration options with defaults
  const showWired = config.showWired !== false;
  const showWireless = config.showWireless !== false;
  const largeDisplay = config.largeDisplay === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';
  // Support both 'visualization' (new) and 'visualizationType' (legacy) config keys
  const visualizationType = (config.visualization as 'numbers' | 'donut' | 'text') || (config.visualizationType as 'numbers' | 'donut' | 'text') || 'numbers';

  // Base font sizes in pixels for different metric sizes (before scaling)
  // These are the sizes at scale=1, which corresponds to a 300x200px widget
  const baseFontSizes: Record<string, number> = hideLabels ? {
    xs: 36,
    sm: 48,
    md: 60,
    lg: 72,
    xl: 96,
    xxl: 120,
    xxxl: 144,
  } : {
    xs: 24,
    sm: 30,
    md: 40,
    lg: 50,
    xl: 64,
    xxl: 80,
    xxxl: 96,
  };
  const baseFontSize = largeDisplay ? 50 : (baseFontSizes[metricSize] || (hideLabels ? 60 : 40));
  const scaledFontSize = baseFontSize * scale;

  // Scaled secondary text sizes
  const labelFontSize = 16 * scale;
  const subLabelFontSize = 16 * scale;
  const iconSize = 20 * scale;

  // Build donut segments
  const donutSegments: { value: number; label: string; color: string }[] = [];
  if (showWireless && data?.summary.wireless) {
    donutSegments.push({ value: data.summary.wireless, label: 'Wireless', color: '#3b82f6' }); // blue-500
  }
  if (showWired && data?.summary.wired) {
    donutSegments.push({ value: data.summary.wired, label: 'Wired', color: '#22c55e' }); // green-500
  }

  // Map metricSize to visualization size
  const sizeMap: Record<string, 'sm' | 'md' | 'lg' | 'xl' | 'xxl'> = {
    xs: 'sm',
    sm: 'md',
    md: 'lg',
    lg: 'xl',
    xl: 'xxl',
    xxl: 'xxl',
    xxxl: 'xxl',
  };
  const vizSize = sizeMap[metricSize] || 'lg';

  const renderNumbers = () => (
    <div className="h-full flex flex-col items-center justify-center">
      <div
        className="font-bold text-gray-900 dark:text-white"
        style={{ fontSize: `${scaledFontSize}px` }}
      >
        {data?.summary.total}
      </div>
      {!hideLabels && (
        <div
          className="text-gray-500 dark:text-gray-400 mt-1"
          style={{ fontSize: `${labelFontSize}px` }}
        >
          Connected Clients
        </div>
      )}
      {!hideLabels && (showWired || showWireless) && (
        <div
          className="flex mt-3"
          style={{ fontSize: `${subLabelFontSize}px`, gap: `${16 * scale}px` }}
        >
          {showWireless && (
            <div className="flex items-center" style={{ gap: `${6 * scale}px` }}>
              <svg
                className="text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
              <span className="text-gray-600 dark:text-gray-300">{data?.summary.wireless}</span>
            </div>
          )}
          {showWired && (
            <div className="flex items-center" style={{ gap: `${6 * scale}px` }}>
              <svg
                className="text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
              >
                {/* Ethernet plug icon */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4v4M12 4v4M16 4v4M6 8h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zM10 18v2M14 18v2" />
              </svg>
              <span className="text-gray-600 dark:text-gray-300">{data?.summary.wired}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        visualizationType === 'text' || (hideLabels && visualizationType === 'numbers') ? (
          <ScaledMetric
            value={data.summary.total}
            className="text-gray-900 dark:text-white"
          />
        ) : visualizationType === 'donut' ? (
          <DonutChart
            segments={donutSegments}
            responsive={true}
            showLegend={!hideLabels}
            showLabels={!hideLabels}
            centerValue={data.summary.total.toString()}
            centerLabel={hideLabels ? undefined : 'Total'}
          />
        ) : (
          renderNumbers()
        )
      )}
    </BaseWidget>
  );
}
