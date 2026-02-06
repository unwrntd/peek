import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProxmoxRrdDataPoint } from '../../../types';
import { matchesFilter } from '../../../utils/filterUtils';
import { formatBytes, formatBytesPerSec } from '../../../utils/formatting';

interface MetricsChartProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface MetricsData {
  rrddata: ProxmoxRrdDataPoint[];
  nodeData: Record<string, ProxmoxRrdDataPoint[]>;
  nodes: string[];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Simple sparkline chart component with scale legend
function Sparkline({
  data,
  color,
  height = 40,
  showScale = false,
  formatValue,
  unit = '',
  fixedScale,
}: {
  data: number[];
  color: string;
  height?: number;
  showScale?: boolean;
  formatValue?: (value: number) => string;
  unit?: string;
  fixedScale?: { min: number; max: number };
}) {
  if (!data || data.length === 0) return null;

  const validData = data.filter(d => d !== undefined && d !== null && !isNaN(d));
  if (validData.length === 0) return null;

  // Use fixed scale if provided (for percentages), otherwise use data-driven scale
  const scaleMin = fixedScale?.min ?? Math.min(...validData);
  const scaleMax = fixedScale?.max ?? Math.max(...validData);
  const range = scaleMax - scaleMin || 1;

  const width = 200;
  const padding = 2;
  const points = validData.map((value, index) => {
    const x = (index / (validData.length - 1)) * width;
    const y = height - padding - ((value - scaleMin) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const formatScaleValue = (value: number) => {
    if (formatValue) return formatValue(value);
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(1);
  };

  // Grid lines for fixed scale (percentages)
  const gridLines = fixedScale ? [0, 50, 100] : null;

  return (
    <div className="relative">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Grid lines for percentage scales */}
        {gridLines && gridLines.map(value => {
          const y = height - padding - ((value - scaleMin) / range) * (height - padding * 2);
          return (
            <line
              key={value}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth="1"
              strokeDasharray={value === 50 ? "4,4" : "none"}
            />
          );
        })}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points}
        />
      </svg>
      {showScale && (
        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-gray-500 dark:text-gray-400 pointer-events-none pr-0.5">
          {fixedScale ? (
            <>
              <span>100{unit}</span>
              <span>50{unit}</span>
              <span>0{unit}</span>
            </>
          ) : (
            <>
              <span>{formatScaleValue(scaleMax)}{unit}</span>
              <span>{formatScaleValue(scaleMin)}{unit}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Component for a single node's metrics
function NodeMetrics({
  nodeName,
  rrdData,
  showCpu,
  showMemory,
  showNetwork,
  showDisk,
  compactView,
  showNodeLabel,
}: {
  nodeName?: string;
  rrdData: ProxmoxRrdDataPoint[];
  showCpu: boolean;
  showMemory: boolean;
  showNetwork: boolean;
  showDisk: boolean;
  compactView: boolean;
  showNodeLabel: boolean;
}) {
  const latest = rrdData[rrdData.length - 1];
  const cpuData = rrdData.map(d => (d.cpu || 0) * 100);
  const memData = rrdData.map(d => d.maxmem ? ((d.mem || 0) / d.maxmem) * 100 : 0);
  const netInData = rrdData.map(d => d.netin || 0);
  const netOutData = rrdData.map(d => d.netout || 0);
  const diskReadData = rrdData.map(d => d.diskread || 0);
  const diskWriteData = rrdData.map(d => d.diskwrite || 0);
  const iowaitData = rrdData.map(d => (d.iowait || 0) * 100);

  // Check if we have actual disk I/O data (non-zero values)
  const hasDiskIoData = diskReadData.some(v => v > 0) || diskWriteData.some(v => v > 0);
  const hasIowaitData = iowaitData.some(v => v > 0);

  return (
    <div className={`space-y-${compactView ? '2' : '3'}`}>
      {showNodeLabel && nodeName && (
        <div className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-600 pb-1">
          {nodeName}
        </div>
      )}

      {/* CPU */}
      {showCpu && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CPU</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {latest?.cpu ? `${(latest.cpu * 100).toFixed(1)}%` : '—'}
            </span>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded p-2">
            <Sparkline
              data={cpuData}
              color="#3b82f6"
              height={compactView ? 30 : 50}
              showScale={!compactView}
              unit="%"
              formatValue={(v) => v.toFixed(0)}
              fixedScale={{ min: 0, max: 100 }}
            />
          </div>
        </div>
      )}

      {/* Memory */}
      {showMemory && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Memory</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {latest?.mem && latest?.maxmem
                ? `${formatBytes(latest.mem)} / ${formatBytes(latest.maxmem)}`
                : '—'}
            </span>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded p-2">
            <Sparkline
              data={memData}
              color="#10b981"
              height={compactView ? 30 : 50}
              showScale={!compactView}
              unit="%"
              formatValue={(v) => v.toFixed(0)}
              fixedScale={{ min: 0, max: 100 }}
            />
          </div>
        </div>
      )}

      {/* Network */}
      {showNetwork && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Network</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              <span className="text-green-600 dark:text-green-400">↓{formatBytesPerSec(latest?.netin || 0)}</span>
              {' / '}
              <span className="text-blue-600 dark:text-blue-400">↑{formatBytesPerSec(latest?.netout || 0)}</span>
            </span>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-green-600 dark:text-green-400 w-3">In</span>
              <div className="flex-1">
                <Sparkline
                  data={netInData}
                  color="#10b981"
                  height={compactView ? 20 : 25}
                  showScale={!compactView}
                  formatValue={(v) => formatBytesPerSec(v).replace('/s', '')}
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-blue-600 dark:text-blue-400 w-3">Out</span>
              <div className="flex-1">
                <Sparkline
                  data={netOutData}
                  color="#3b82f6"
                  height={compactView ? 20 : 25}
                  showScale={!compactView}
                  formatValue={(v) => formatBytesPerSec(v).replace('/s', '')}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disk I/O - show either disk read/write or I/O wait depending on data availability */}
      {showDisk && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {hasDiskIoData ? 'Disk I/O' : 'I/O Wait'}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {hasDiskIoData ? (
                <>
                  <span className="text-green-600 dark:text-green-400">R:{formatBytesPerSec(latest?.diskread || 0)}</span>
                  {' / '}
                  <span className="text-orange-600 dark:text-orange-400">W:{formatBytesPerSec(latest?.diskwrite || 0)}</span>
                </>
              ) : (
                <span className="text-purple-600 dark:text-purple-400">
                  {latest?.iowait ? `${(latest.iowait * 100).toFixed(1)}%` : '—'}
                </span>
              )}
            </span>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 space-y-1">
            {hasDiskIoData ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-green-600 dark:text-green-400 w-3">R</span>
                  <div className="flex-1">
                    <Sparkline
                      data={diskReadData}
                      color="#10b981"
                      height={compactView ? 20 : 25}
                      showScale={!compactView}
                      formatValue={(v) => formatBytesPerSec(v).replace('/s', '')}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-orange-600 dark:text-orange-400 w-3">W</span>
                  <div className="flex-1">
                    <Sparkline
                      data={diskWriteData}
                      color="#f97316"
                      height={compactView ? 20 : 25}
                      showScale={!compactView}
                      formatValue={(v) => formatBytesPerSec(v).replace('/s', '')}
                    />
                  </div>
                </div>
              </>
            ) : hasIowaitData ? (
              <Sparkline
                data={iowaitData}
                color="#a855f7"
                height={compactView ? 30 : 50}
                showScale={!compactView}
                unit="%"
                formatValue={(v) => v.toFixed(1)}
                fixedScale={{ min: 0, max: 100 }}
              />
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                No disk I/O data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Time range info */}
      {!compactView && rrdData.length > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {formatTime(rrdData[0].time)} - {formatTime(rrdData[rrdData.length - 1].time)}
        </div>
      )}
    </div>
  );
}

// Aggregate data from multiple nodes by time
function aggregateNodeData(nodeData: Record<string, ProxmoxRrdDataPoint[]>): ProxmoxRrdDataPoint[] {
  const timeMap = new Map<number, ProxmoxRrdDataPoint>();

  Object.values(nodeData).forEach(nodePoints => {
    nodePoints.forEach(point => {
      const existing = timeMap.get(point.time);
      if (existing) {
        // Sum the values
        existing.cpu = (existing.cpu || 0) + (point.cpu || 0);
        existing.mem = (existing.mem || 0) + (point.mem || 0);
        existing.maxmem = (existing.maxmem || 0) + (point.maxmem || 0);
        existing.netin = (existing.netin || 0) + (point.netin || 0);
        existing.netout = (existing.netout || 0) + (point.netout || 0);
        existing.diskread = (existing.diskread || 0) + (point.diskread || 0);
        existing.diskwrite = (existing.diskwrite || 0) + (point.diskwrite || 0);
        existing.iowait = (existing.iowait || 0) + (point.iowait || 0);
      } else {
        timeMap.set(point.time, { ...point });
      }
    });
  });

  // For CPU and iowait, we need to average instead of sum
  const nodeCount = Object.keys(nodeData).length;
  if (nodeCount > 1) {
    timeMap.forEach(point => {
      if (point.cpu) {
        point.cpu = point.cpu / nodeCount;
      }
      if (point.iowait) {
        point.iowait = point.iowait / nodeCount;
      }
    });
  }

  return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
}

export function MetricsChart({ integrationId, config, widgetId }: MetricsChartProps) {
  const { data, loading, error } = useWidgetData<MetricsData>({
    integrationId,
    metric: (config.metric as string) || 'rrddata',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showNetwork = config.showNetwork !== false;
  const showDisk = config.showDisk !== false;
  const compactView = config.compactView === true;
  const displayMode = (config.displayMode as string) || '';
  const nodeFilter = (config.nodeFilter as string) || '';

  const nodeData = data?.nodeData || {};
  const availableNodes = data?.nodes || [];

  // Determine which nodes to show based on display mode
  const getDisplayData = (): { nodeName?: string; data: ProxmoxRrdDataPoint[] }[] => {
    if (displayMode === 'specific' && nodeFilter) {
      // Show only the nodes matching the filter (supports wildcards and comma-separated lists)
      const matchingNodes = availableNodes.filter(n => matchesFilter(n, nodeFilter));
      if (matchingNodes.length === 0) {
        return [];
      }
      // If multiple nodes match, show them individually
      if (matchingNodes.length === 1) {
        return [{ nodeName: matchingNodes[0], data: nodeData[matchingNodes[0]] }];
      }
      // Multiple matches - show each separately
      return matchingNodes
        .filter(node => nodeData[node]?.length > 0)
        .map(node => ({ nodeName: node, data: nodeData[node] }));
    } else if (displayMode === 'individual') {
      // Show each node separately
      return availableNodes
        .filter(node => nodeData[node]?.length > 0)
        .map(node => ({ nodeName: node, data: nodeData[node] }));
    } else {
      // Combined view (default) - aggregate all nodes
      const aggregated = aggregateNodeData(nodeData);
      return aggregated.length > 0 ? [{ data: aggregated }] : [];
    }
  };

  const displayData = getDisplayData();

  return (
    <BaseWidget loading={loading} error={error}>
      {data && displayData.length > 0 ? (
        <div className={`space-y-${compactView ? '4' : '6'}`}>
          {displayData.map((item, index) => (
            <NodeMetrics
              key={item.nodeName || 'combined'}
              nodeName={item.nodeName}
              rrdData={item.data}
              showCpu={showCpu}
              showMemory={showMemory}
              showNetwork={showNetwork}
              showDisk={showDisk}
              compactView={compactView}
              showNodeLabel={displayMode === 'individual' || (displayMode === 'specific' && !!nodeFilter)}
            />
          ))}
          {displayMode === 'individual' && displayData.length > 1 && !compactView && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              Showing {displayData.length} nodes
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <p>
            {displayMode === 'specific' && nodeFilter
              ? `Node "${nodeFilter}" not found`
              : 'No metrics data available'}
          </p>
        </div>
      )}
    </BaseWidget>
  );
}
