import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { CircularGauge, DonutChart } from '../../common/visualizations';
import { AdGuardStats } from '../../../types';

interface StatsOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface StatsData {
  stats: AdGuardStats;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatResponseTime(seconds: number): string {
  const ms = seconds * 1000;
  return ms.toFixed(1) + ' ms';
}

export function StatsOverview({ integrationId, config, widgetId }: StatsOverviewProps) {
  const { data, loading, error } = useWidgetData<StatsData>({
    integrationId,
    metric: 'stats',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';
  // Support both 'visualization' (new) and 'visualizationType' (legacy) config keys
  const visualizationType = (config.visualization as 'numbers' | 'gauge' | 'donut' | 'text') || (config.visualizationType as 'numbers' | 'gauge' | 'donut' | 'text') || 'numbers';
  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    xxl: 'text-5xl',
    xxxl: 'text-6xl',
  } : {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    xxl: 'text-2xl',
    xxxl: 'text-3xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-2xl' : 'text-base');

  // Display options (default to true if not set)
  const showTotalQueries = config.showTotalQueries !== false;
  const showBlocked = config.showBlocked !== false;
  const showBlockRate = config.showBlockRate !== false;
  const showResponseTime = config.showResponseTime !== false;

  const visibleMetrics = [showTotalQueries, showBlocked, showBlockRate, showResponseTime].filter(Boolean).length;

  const stats = data?.stats;
  const totalBlocked = stats
    ? stats.num_blocked_filtering +
      stats.num_replaced_safebrowsing +
      stats.num_replaced_safesearch +
      stats.num_replaced_parental
    : 0;
  const blockingPercent = stats && stats.num_dns_queries > 0
    ? ((totalBlocked / stats.num_dns_queries) * 100).toFixed(1)
    : '0';

  const gridCols = hideLabels
    ? `grid-cols-${Math.min(visibleMetrics, 4)}`
    : visibleMetrics <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4';

  // Single metric mode - when only one metric is visible, use ScaledMetric to fill the widget
  const singleMetricMode = visibleMetrics === 1;

  // Determine which single metric to show and its properties
  const getSingleMetric = (): { value: string; colorClass: string } | null => {
    if (!stats || !singleMetricMode) return null;
    if (showTotalQueries) return { value: formatNumber(stats.num_dns_queries), colorClass: 'text-blue-600 dark:text-blue-400' };
    if (showBlocked) return { value: formatNumber(totalBlocked), colorClass: 'text-red-600 dark:text-red-400' };
    if (showBlockRate) return { value: `${blockingPercent}%`, colorClass: 'text-green-600 dark:text-green-400' };
    if (showResponseTime) return { value: formatResponseTime(stats.avg_processing_time), colorClass: 'text-purple-600 dark:text-purple-400' };
    return null;
  };

  const singleMetric = getSingleMetric();

  // Build donut segments for blocked vs allowed
  const donutSegments = stats ? [
    { value: totalBlocked, label: 'Blocked', color: '#ef4444' },
    { value: stats.num_dns_queries - totalBlocked, label: 'Allowed', color: '#22c55e' },
  ].filter(s => s.value > 0) : [];

  const renderNumbers = () => (
    <div className={`grid ${gridCols} gap-4`}>
      {showTotalQueries && (
        <div className={hideLabels ? 'text-center' : ''}>
          {!hideLabels && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Queries</div>
          )}
          <div className={`font-semibold ${metricClass} text-blue-600 dark:text-blue-400`}>
            {formatNumber(stats!.num_dns_queries)}
          </div>
        </div>
      )}

      {showBlocked && (
        <div className={hideLabels ? 'text-center' : ''}>
          {!hideLabels && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Blocked</div>
          )}
          <div className={`font-semibold ${metricClass} text-red-600 dark:text-red-400`}>
            {formatNumber(totalBlocked)}
          </div>
        </div>
      )}

      {showBlockRate && (
        <div className={hideLabels ? 'text-center' : ''}>
          {!hideLabels && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Block Rate</div>
          )}
          <div className={`font-semibold ${metricClass} text-green-600 dark:text-green-400`}>
            {blockingPercent}%
          </div>
        </div>
      )}

      {showResponseTime && (
        <div className={hideLabels ? 'text-center' : ''}>
          {!hideLabels && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Response</div>
          )}
          <div className={`font-semibold ${metricClass} text-purple-600 dark:text-purple-400`}>
            {formatResponseTime(stats!.avg_processing_time)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {stats && (
        visualizationType === 'text' ? (
          <ScaledMetric
            value={formatNumber(stats.num_dns_queries)}
            className="text-blue-600 dark:text-blue-400"
          />
        ) : visualizationType === 'gauge' ? (
          <CircularGauge
            value={parseFloat(blockingPercent)}
            responsive={true}
            warningThreshold={30}
            criticalThreshold={50}
            showValue={true}
            showLabel={!hideLabels}
            label="Block Rate"
          />
        ) : visualizationType === 'donut' ? (
          <DonutChart
            segments={donutSegments}
            responsive={true}
            showLegend={!hideLabels}
            showLabels={!hideLabels}
            centerValue={formatNumber(stats.num_dns_queries)}
            centerLabel={hideLabels ? undefined : 'Total'}
          />
        ) : singleMetricMode && singleMetric ? (
          <ScaledMetric
            value={singleMetric.value}
            className={singleMetric.colorClass}
          />
        ) : (
          renderNumbers()
        )
      )}
    </BaseWidget>
  );
}
