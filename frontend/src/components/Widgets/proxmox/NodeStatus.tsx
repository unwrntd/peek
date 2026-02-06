import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { StatusIndicator } from '../../common/StatusIndicator';
import { SparklineChart, getSparklineColor } from '../../common/SparklineChart';
import { ProxmoxNode, ProxmoxRrdDataPoint } from '../../../types';
import { matchesFilter } from '../../../utils/filterUtils';
import { formatBytes, formatUptime } from '../../../utils/formatting';
import { getMetricSizeClasses, MetricSize } from '../../../utils/sizing';

interface NodeStatusProps {
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

// Wrapper for formatUptime to handle missing values
function formatNodeUptime(seconds: number): string {
  if (!seconds) return '-';
  return formatUptime(seconds);
}

export function NodeStatus({ integrationId, config, widgetId }: NodeStatusProps) {
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

  // Default all options to true if not explicitly set to false
  const showCpu = config.showCpu !== false;
  const showCores = config.showCores !== false;
  const showUptime = config.showUptime !== false;
  const showMemory = config.showMemory === true;
  const showStorage = config.showStorage === true;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';

  // Helper to get sparkline data for a node
  const getNodeSparklineData = (nodeName: string, metric: 'cpu' | 'mem') => {
    if (!rrdData?.nodeData?.[nodeName]) return [];
    const nodeRrd = rrdData.nodeData[nodeName];
    if (metric === 'cpu') {
      return nodeRrd.map(d => (d.cpu || 0) * 100);
    }
    return nodeRrd.map(d => d.maxmem ? ((d.mem || 0) / d.maxmem) * 100 : 0);
  };

  // Metric size classes
  const metricSizeClassMap = getMetricSizeClasses(hideLabels);
  const metricClass = metricSizeClassMap[metricSize as MetricSize] || (hideLabels ? 'text-2xl' : 'text-base');

  // Apply filters
  const filteredNodes = data?.nodes.filter(node => {
    // Node name filter (supports wildcards and comma-separated lists)
    const nodeFilter = config.nodeFilter as string;
    if (nodeFilter && !matchesFilter(node.node, nodeFilter)) return false;

    // Status filter
    const status = config.status as string;
    if (status && node.status !== status) return false;

    return true;
  }) || [];

  // Calculate visible columns for grid
  const visibleMetrics = [showCpu, showCores, showUptime, showMemory, showStorage].filter(Boolean).length;
  const gridCols = Math.min(visibleMetrics, 5) || 3;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {filteredNodes.map(node => (
            <div
              key={node.node}
              className={`border border-gray-200 dark:border-gray-700 rounded-lg ${compactView ? 'p-2' : 'p-3'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white">{node.node}</span>
                <StatusIndicator status={node.status} />
              </div>
              <div className={`grid gap-2 ${hideLabels ? '' : 'text-xs'}`} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                {showCpu && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <span className="text-gray-500 dark:text-gray-400">CPU</span>}
                    <div className="flex items-center gap-2">
                      <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300`}>
                        {typeof node.cpu === 'number' ? `${(node.cpu * 100).toFixed(1)}%` : '-'}
                      </div>
                      {showSparklines && typeof node.cpu === 'number' && (
                        <SparklineChart
                          data={getNodeSparklineData(node.node, 'cpu')}
                          width={50}
                          height={16}
                          {...getSparklineColor(node.cpu * 100, 75, 90)}
                        />
                      )}
                    </div>
                  </div>
                )}
                {showCores && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Cores</span>}
                    <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300`}>{node.maxcpu || '-'}</div>
                  </div>
                )}
                {showUptime && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Uptime</span>}
                    <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300`}>{formatNodeUptime(node.uptime)}</div>
                  </div>
                )}
                {showMemory && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Memory</span>}
                    <div className="flex items-center gap-2">
                      <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300`}>
                        {node.mem ? `${formatBytes(node.mem)} / ${formatBytes(node.maxmem)}` : '-'}
                      </div>
                      {showSparklines && node.mem && node.maxmem && (
                        <SparklineChart
                          data={getNodeSparklineData(node.node, 'mem')}
                          width={50}
                          height={16}
                          {...getSparklineColor((node.mem / node.maxmem) * 100, 75, 90)}
                        />
                      )}
                    </div>
                  </div>
                )}
                {showStorage && (
                  <div className={hideLabels ? 'text-center' : ''}>
                    {!hideLabels && <span className="text-gray-500 dark:text-gray-400">Storage</span>}
                    <div className={`font-medium ${metricClass} text-gray-700 dark:text-gray-300`}>
                      {node.disk ? `${formatBytes(node.disk)} / ${formatBytes(node.maxdisk)}` : '-'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredNodes.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.nodes.length === 0 ? 'No nodes found' : 'No nodes match filters'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
