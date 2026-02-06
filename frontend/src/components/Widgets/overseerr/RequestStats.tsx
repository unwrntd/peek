import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';
import { DonutChart } from '../../common/visualizations';
import { OverseerrRequestCount } from '../../../types';

interface RequestCountData {
  requestCount: OverseerrRequestCount;
}

interface RequestStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function RequestStats({ integrationId, config, widgetId }: RequestStatsProps) {
  const { data, loading, error } = useWidgetData<RequestCountData>({
    integrationId,
    metric: 'request-count',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const dimensions = useWidgetDimensions();
  const visualization = (config.visualization as string) || 'number';
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'auto';
  const singleMetric = config.singleMetric as { key: string; color: string } | undefined;

  // Display options
  const showPending = config.showPending !== false;
  const showApproved = config.showApproved !== false;
  const showDeclined = config.showDeclined !== false;
  const showProcessing = config.showProcessing !== false;
  const showAvailable = config.showAvailable !== false;

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

  // Base font sizes for different metric sizes
  const baseFontSizes: Record<string, number> = {
    xs: 24,
    sm: 30,
    md: 40,
    lg: 50,
    xl: 64,
    xxl: 80,
    xxxl: 96,
  };
  const baseFontSize = baseFontSizes[metricSize] || 40;
  const scaledFontSize = baseFontSize * scale;

  const requestCount = data?.requestCount;

  // Single metric mode
  if (singleMetric && requestCount) {
    let value: number = 0;
    switch (singleMetric.key) {
      case 'total':
        value = requestCount.total;
        break;
      case 'pending':
        value = requestCount.pending;
        break;
      case 'approved':
        value = requestCount.approved;
        break;
      case 'declined':
        value = requestCount.declined;
        break;
      case 'processing':
        value = requestCount.processing;
        break;
      case 'available':
        value = requestCount.available;
        break;
    }

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div
            className="font-bold"
            style={{ color: singleMetric.color, fontSize: `${scaledFontSize}px` }}
          >
            {value}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Donut visualization
  if (visualization === 'donut' && requestCount) {
    const segments = [];
    if (showPending && requestCount.pending > 0) {
      segments.push({ label: 'Pending', value: requestCount.pending, color: '#EAB308' });
    }
    if (showApproved && requestCount.approved > 0) {
      segments.push({ label: 'Approved', value: requestCount.approved, color: '#22C55E' });
    }
    if (showDeclined && requestCount.declined > 0) {
      segments.push({ label: 'Declined', value: requestCount.declined, color: '#EF4444' });
    }
    if (showProcessing && requestCount.processing > 0) {
      segments.push({ label: 'Processing', value: requestCount.processing, color: '#6366F1' });
    }
    if (showAvailable && requestCount.available > 0) {
      segments.push({ label: 'Available', value: requestCount.available, color: '#10B981' });
    }

    if (segments.length === 0) {
      segments.push({ label: 'No Requests', value: 1, color: '#D1D5DB' });
    }

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full">
          <DonutChart
            segments={segments}
            centerValue={requestCount.total}
            centerLabel={hideLabels ? undefined : 'requests'}
            responsive
            showLegend={!hideLabels}
          />
        </div>
      </BaseWidget>
    );
  }

  // Multi-row visualization
  if (visualization === 'multi-row' && requestCount) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400 text-sm">Total</span>
            <span className="font-bold text-lg text-gray-900 dark:text-white">{requestCount.total}</span>
          </div>
          {showPending && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Pending</span>
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">{requestCount.pending}</span>
            </div>
          )}
          {showApproved && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Approved</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{requestCount.approved}</span>
            </div>
          )}
          {showDeclined && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Declined</span>
              <span className="font-semibold text-red-600 dark:text-red-400">{requestCount.declined}</span>
            </div>
          )}
          {showProcessing && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Processing</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{requestCount.processing}</span>
            </div>
          )}
          {showAvailable && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Available</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{requestCount.available}</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Number visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {requestCount && (
        <div className="flex flex-col items-center justify-center h-full">
          <div
            className="font-bold text-gray-900 dark:text-white"
            style={{ fontSize: `${scaledFontSize}px` }}
          >
            {requestCount.total}
          </div>
          {!hideLabels && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {requestCount.total === 1 ? 'request' : 'requests'}
            </div>
          )}
          {!hideLabels && requestCount.pending > 0 && (
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              {requestCount.pending} pending
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
