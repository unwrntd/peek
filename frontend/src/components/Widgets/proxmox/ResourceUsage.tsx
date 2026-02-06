import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { CircularGauge } from '../../common/visualizations';
import { SparklineChart, getSparklineColor } from '../../common/SparklineChart';
import { ProxmoxNode, ProxmoxRrdDataPoint } from '../../../types';
import { matchesFilter } from '../../../utils/filterUtils';
import { formatBytes } from '../../../utils/formatting';
import { getUsageColor } from '../../../utils/colors';
import { getMetricSizeClasses, MetricSize } from '../../../utils/sizing';

interface ResourceUsageProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface NodeData {
  nodes: ProxmoxNode[];
}

interface RrdData {
  rrddata: ProxmoxRrdDataPoint[];
  nodeData: Record<string, ProxmoxRrdDataPoint[]>;
  nodes: string[];
}

interface GaugeProps {
  label: string;
  value: number;
  max: number;
  format?: (v: number) => string;
  color?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  showPercentage?: boolean;
  nodeName?: string;
  hideLabels?: boolean;
  metricSize?: string;
  visualizationType?: 'text' | 'bars' | 'gauges';
  sparklineData?: number[];
  showSparkline?: boolean;
}

function Gauge({
  label,
  value,
  max,
  format,
  color = 'bg-primary-500',
  warningThreshold = 75,
  criticalThreshold = 90,
  showPercentage = true,
  nodeName,
  hideLabels = false,
  metricSize = 'md',
  visualizationType = 'bars',
  sparklineData,
  showSparkline = false,
}: GaugeProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const displayValue = format ? format(value) : value.toString();
  const displayMax = format ? format(max) : max.toString();

  let barColor = color;
  if (percentage > criticalThreshold) barColor = 'bg-red-500';
  else if (percentage > warningThreshold) barColor = 'bg-yellow-500';

  // Metric size classes
  const metricSizeClassMap = getMetricSizeClasses(hideLabels);
  const metricClass = metricSizeClassMap[metricSize as MetricSize] || (hideLabels ? 'text-2xl' : 'text-lg');

  // When hideLabels is true and using bars, show scaled percentage metric
  if (hideLabels && visualizationType === 'bars') {
    return (
      <div className="h-full w-full">
        <ScaledMetric
          value={`${percentage.toFixed(1)}%`}
          className="text-gray-900 dark:text-white"
        />
      </div>
    );
  }

  // Circular Gauge visualization
  if (visualizationType === 'gauges') {
    return (
      <CircularGauge
        value={percentage}
        responsive={true}
        warningThreshold={warningThreshold}
        criticalThreshold={criticalThreshold}
        showValue={true}
        showLabel={!hideLabels}
        label={nodeName ? `${nodeName} - ${label}` : label}
      />
    );
  }

  // Text-only visualization
  if (visualizationType === 'text') {
    return (
      <div className={hideLabels ? 'text-center' : ''}>
        {!hideLabels && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {nodeName ? `${nodeName} - ${label}` : label}
          </div>
        )}
        <div className={`font-medium ${metricClass} ${getUsageColor(percentage, warningThreshold, criticalThreshold)}`}>
          {percentage.toFixed(1)}%
        </div>
        {!hideLabels && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {displayValue} / {displayMax}
          </div>
        )}
      </div>
    );
  }

  // Default: Horizontal bars visualization
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{nodeName ? `${nodeName} - ${label}` : label}</span>
        <div className="flex items-center gap-2">
          {showSparkline && sparklineData && sparklineData.length > 1 && (
            <SparklineChart
              data={sparklineData}
              width={50}
              height={14}
              {...getSparklineColor(percentage, warningThreshold, criticalThreshold)}
            />
          )}
          <span>{displayValue} / {displayMax}</span>
        </div>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showPercentage && (
        <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {percentage.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export function ResourceUsage({ integrationId, config, widgetId }: ResourceUsageProps) {
  const showSparklines = config.showSparklines === true;

  const { data, loading, error } = useWidgetData<NodeData>({
    integrationId,
    metric: (config.metric as string) || 'nodes',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Fetch RRD data for sparklines (only when enabled)
  const { data: rrdData } = useWidgetData<RrdData>({
    integrationId,
    metric: 'rrddata',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId: widgetId ? `${widgetId}-rrd` : undefined,
    enabled: showSparklines,
  });

  // Configuration options with defaults
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showStorage = config.showStorage !== false;
  const showPercentage = config.showPercentage !== false;
  const warningThreshold = (config.warningThreshold as number) || 75;
  const criticalThreshold = (config.criticalThreshold as number) || 90;
  const displayMode = config.displayMode as string;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';
  // Support both 'visualization' (new) and 'visualizationType' (legacy) config keys
  const visualizationType = (config.visualization as 'text' | 'bars' | 'gauges') || (config.visualizationType as 'text' | 'bars' | 'gauges') || 'bars';
  // Totals display options (default to showing when defaultEnabled is true in config)
  const showTotalCores = config.showTotalCores !== false;
  const showTotalRam = config.showTotalRam !== false;
  const showTotalDisk = config.showTotalDisk !== false;

  // Helper to get aggregated sparkline data across all nodes
  const getAggregateSparklineData = (metric: 'cpu' | 'mem') => {
    if (!rrdData?.rrddata || rrdData.rrddata.length === 0) return [];

    // Group by timestamp and aggregate
    const timeMap = new Map<number, { cpu: number; mem: number; maxmem: number; count: number }>();
    rrdData.rrddata.forEach(d => {
      const existing = timeMap.get(d.time) || { cpu: 0, mem: 0, maxmem: 0, count: 0 };
      existing.cpu += (d.cpu || 0) * 100;
      existing.mem += d.mem || 0;
      existing.maxmem += d.maxmem || 0;
      existing.count += 1;
      timeMap.set(d.time, existing);
    });

    // Convert to array and calculate averages
    const sortedData = Array.from(timeMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => {
        if (metric === 'cpu') return v.count > 0 ? v.cpu / v.count : 0;
        return v.maxmem > 0 ? (v.mem / v.maxmem) * 100 : 0;
      });

    return sortedData;
  };

  // Filter nodes by name if specified (supports wildcards and comma-separated lists)
  const filteredNodes = data?.nodes.filter(node => {
    const nodeFilter = config.nodeFilter as string;
    if (nodeFilter && !matchesFilter(node.node, nodeFilter)) return false;
    return true;
  }) || [];

  // Aggregate resources across filtered nodes
  const totals = filteredNodes.reduce(
    (acc, node) => ({
      cpu: acc.cpu + ((node.cpu || 0) * (node.maxcpu || 0)),
      maxcpu: acc.maxcpu + (node.maxcpu || 0),
      mem: acc.mem + (node.mem || 0),
      maxmem: acc.maxmem + (node.maxmem || 0),
      disk: acc.disk + (node.disk || 0),
      maxdisk: acc.maxdisk + (node.maxdisk || 0),
    }),
    { cpu: 0, maxcpu: 0, mem: 0, maxmem: 0, disk: 0, maxdisk: 0 }
  );

  const renderGauges = (node?: ProxmoxNode) => {
    const source = node ? {
      cpu: (node.cpu || 0) * (node.maxcpu || 0),
      maxcpu: node.maxcpu || 0,
      mem: node.mem || 0,
      maxmem: node.maxmem || 0,
      disk: node.disk || 0,
      maxdisk: node.maxdisk || 0,
    } : totals;

    // For circular gauges, always wrap to give proper flex sizing
    // For bars with hideLabels, wrap for scaled metric sizing
    const needsWrapper = visualizationType === 'gauges' || hideLabels;
    const isGauges = visualizationType === 'gauges';

    // Wrapper that includes totals for gauge mode
    const GaugeWrapperWithTotal = ({ children, total }: { children: React.ReactNode; total?: React.ReactNode }) => {
      if (!needsWrapper) return <>{children}</>;
      return (
        <div className={`flex-1 min-w-0 ${isGauges ? 'h-full flex flex-col' : 'h-full min-h-0'}`}>
          <div className={isGauges ? 'flex-1 min-h-0' : 'h-full'}>{children}</div>
          {isGauges && total && !hideLabels && (
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 -mt-1">
              {total}
            </div>
          )}
        </div>
      );
    };

    return (
      <>
        {showCpu && (
          <GaugeWrapperWithTotal total={showTotalCores && source.maxcpu > 0 ? `${source.maxcpu} cores` : undefined}>
            <Gauge
              label="CPU"
              value={source.cpu}
              max={source.maxcpu}
              format={(v) => `${v.toFixed(1)} cores`}
              color="bg-blue-500"
              warningThreshold={warningThreshold}
              criticalThreshold={criticalThreshold}
              showPercentage={showPercentage}
              nodeName={node?.node}
              hideLabels={hideLabels}
              metricSize={metricSize}
              visualizationType={visualizationType}
              sparklineData={showSparklines ? getAggregateSparklineData('cpu') : undefined}
              showSparkline={showSparklines}
            />
          </GaugeWrapperWithTotal>
        )}
        {showMemory && (
          <GaugeWrapperWithTotal total={showTotalRam && source.maxmem > 0 ? formatBytes(source.maxmem) : undefined}>
            <Gauge
              label="Memory"
              value={source.mem}
              max={source.maxmem}
              format={formatBytes}
              color="bg-green-500"
              warningThreshold={warningThreshold}
              criticalThreshold={criticalThreshold}
              showPercentage={showPercentage}
              nodeName={node?.node}
              hideLabels={hideLabels}
              metricSize={metricSize}
              visualizationType={visualizationType}
              sparklineData={showSparklines ? getAggregateSparklineData('mem') : undefined}
              showSparkline={showSparklines}
            />
          </GaugeWrapperWithTotal>
        )}
        {showStorage && (
          <GaugeWrapperWithTotal total={showTotalDisk && source.maxdisk > 0 ? formatBytes(source.maxdisk) : undefined}>
            <Gauge
              label="Storage"
              value={source.disk}
              max={source.maxdisk}
              format={formatBytes}
              color="bg-purple-500"
              warningThreshold={warningThreshold}
              criticalThreshold={criticalThreshold}
              showPercentage={showPercentage}
              nodeName={node?.node}
              hideLabels={hideLabels}
              metricSize={metricSize}
              visualizationType={visualizationType}
              showSparkline={false}
            />
          </GaugeWrapperWithTotal>
        )}
      </>
    );
  };

  // Count visible metrics for layout - auto scale when only 1 metric shown with hideLabels
  const visibleMetrics = [showCpu, showMemory, showStorage].filter(Boolean).length;
  const singleMetricAuto = hideLabels && visibleMetrics === 1 && displayMode !== 'individual' && visualizationType === 'bars';

  // Determine container class based on visualization type
  const isCircularViz = visualizationType === 'gauges';
  const containerClass = isCircularViz
    ? 'h-full w-full flex items-stretch gap-2'
    : hideLabels
      ? 'h-full flex flex-col gap-2'
      : 'space-y-4';

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        singleMetricAuto ? (
          // Auto single metric mode - scale to fill widget when only one metric shown
          renderGauges()
        ) : (
          <div className={containerClass}>
            {displayMode === 'individual' ? (
              // Individual node view
              filteredNodes.map(node => (
                <div key={node.node} className={isCircularViz ? 'w-full h-full flex flex-col' : 'space-y-3 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0'}>
                  {!hideLabels && (
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{node.node}</div>
                  )}
                  <div className={isCircularViz ? 'flex-1 flex items-stretch gap-2' : ''}>
                    {renderGauges(node)}
                  </div>
                </div>
              ))
            ) : (
              // Aggregate view
              renderGauges()
            )}

            {filteredNodes.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4 w-full">
                {data.nodes.length === 0 ? 'No nodes found' : 'No nodes match filters'}
              </p>
            )}

            {filteredNodes.length > 0 && displayMode !== 'individual' && !hideLabels && !isCircularViz && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-100 dark:border-gray-700">
                {filteredNodes.length} node{filteredNodes.length !== 1 ? 's' : ''}
                {filteredNodes.length !== data.nodes.length && ` (${data.nodes.length} total)`}
              </div>
            )}
          </div>
        )
      )}
    </BaseWidget>
  );
}
