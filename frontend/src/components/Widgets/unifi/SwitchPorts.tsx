import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { DonutChart } from '../../common/visualizations';
import { UnifiDevice } from '../../../types';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon } from '../../../utils/icons';

interface SwitchPortsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DeviceData {
  devices: UnifiDevice[];
}

function formatSpeed(speed: number): string {
  if (speed >= 1000) {
    return `${speed / 1000}G`;
  }
  return `${speed}M`;
}

export function SwitchPorts({ integrationId, config, widgetId }: SwitchPortsProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<DeviceData>({
    integrationId,
    metric: 'switch-ports',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options
  const showPortsUp = config.showPortsUp !== false;
  const showPortsDown = config.showPortsDown !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';
  const compactView = config.compactView === true;
  const selectedSwitches = (config.selectedSwitches as string[]) || [];
  const displayMode = (config.displayMode as string) || 'both'; // 'numeric', 'graphical', or 'both'
  const showSpeed = config.showSpeed !== false;
  const showPoe = config.showPoe === true;
  const showSwitches = config.showSwitches !== false; // Show USW devices (default true)
  const showGateways = config.showGateways !== false; // Show UDM devices (default true)

  // Metric size classes
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

  // Filter and process switches
  const switches = useMemo(() => {
    if (!data?.devices) return [];

    return data.devices
      .filter(d => {
        // Filter by device type based on config
        if (d.type === 'usw' && !showSwitches) return false;
        if (d.type === 'udm' && !showGateways) return false;
        // Only include switches and gateways with port tables
        return (d.type === 'usw' || d.type === 'udm') && d.port_table && d.port_table.length > 0;
      })
      .filter(d => {
        // Apply switch filter if specified (empty array means show all)
        if (selectedSwitches.length === 0) return true;
        return selectedSwitches.includes(d._id);
      })
      .map(sw => {
        const ports = sw.port_table || [];
        const portsUp = ports.filter(p => p.up && p.enable).length;
        const portsDown = ports.filter(p => !p.up && p.enable).length;
        const totalEnabled = ports.filter(p => p.enable).length;

        return {
          ...sw,
          portsUp,
          portsDown,
          totalEnabled,
          ports,
        };
      });
  }, [data, selectedSwitches, showSwitches, showGateways]);

  // Calculate totals across all switches
  const totals = useMemo(() => {
    return switches.reduce(
      (acc, sw) => ({
        portsUp: acc.portsUp + sw.portsUp,
        portsDown: acc.portsDown + sw.portsDown,
        totalEnabled: acc.totalEnabled + sw.totalEnabled,
      }),
      { portsUp: 0, portsDown: 0, totalEnabled: 0 }
    );
  }, [switches]);

  // Support both 'visualization' (new) and 'visualizationType' (legacy) config keys
  const visualizationType = (config.visualization as 'default' | 'donut' | 'text') || (config.visualizationType as 'default' | 'donut' | 'text') || 'default';

  // Determine display mode
  const visibleMetrics = [showPortsUp, showPortsDown].filter(Boolean).length;
  const showNumeric = displayMode === 'numeric' || displayMode === 'both';
  const showGraphical = displayMode === 'graphical' || displayMode === 'both';

  // Single metric mode - only when showing numeric only with one metric type
  const singleMetricMode = displayMode === 'numeric' && visibleMetrics === 1;

  // Get single metric value
  const getSingleMetric = (): { value: string; colorClass: string } | null => {
    if (!singleMetricMode) return null;
    if (showPortsUp) return { value: totals.portsUp.toString(), colorClass: 'text-green-600 dark:text-green-400' };
    if (showPortsDown) return { value: totals.portsDown.toString(), colorClass: 'text-red-600 dark:text-red-400' };
    return null;
  };

  const singleMetric = getSingleMetric();

  // Build donut segments for port status
  const donutSegments: { value: number; label: string; color: string }[] = [];
  if (showPortsUp && totals.portsUp > 0) {
    donutSegments.push({ value: totals.portsUp, label: 'Up', color: '#22c55e' });
  }
  if (showPortsDown && totals.portsDown > 0) {
    donutSegments.push({ value: totals.portsDown, label: 'Down', color: '#ef4444' });
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        visualizationType === 'donut' && donutSegments.length > 0 ? (
          <DonutChart
            segments={donutSegments}
            responsive={true}
            showLegend={!hideLabels}
            showLabels={!hideLabels}
            centerValue={totals.totalEnabled.toString()}
            centerLabel={hideLabels ? undefined : 'Ports'}
          />
        ) : visualizationType === 'text' ? (
          <div className="flex gap-4 justify-center items-center h-full p-3">
            {showPortsUp && showPortsDown ? (
              <>
                <div className="text-center">
                  <div className={`font-bold ${metricClass} text-green-600 dark:text-green-400`}>
                    {totals.portsUp}
                  </div>
                  {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Up</div>}
                </div>
                <div className="text-center">
                  <div className={`font-bold ${metricClass} text-red-600 dark:text-red-400`}>
                    {totals.portsDown}
                  </div>
                  {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Down</div>}
                </div>
              </>
            ) : showPortsUp ? (
              <div className="text-center">
                <div className={`font-bold ${metricClass} text-green-600 dark:text-green-400`}>
                  {totals.portsUp}
                </div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Ports Up</div>}
              </div>
            ) : (
              <div className="text-center">
                <div className={`font-bold ${metricClass} text-red-600 dark:text-red-400`}>
                  {totals.portsDown}
                </div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Ports Down</div>}
              </div>
            )}
          </div>
        ) : singleMetricMode && singleMetric ? (
          <ScaledMetric
            value={singleMetric.value}
            className={singleMetric.colorClass}
          />
        ) : switches.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            No switches found
          </div>
        ) : (
          <div>
            {/* Numeric summary stats */}
            {showNumeric && !hideLabels && (
              <div className={`flex gap-4 ${showGraphical ? (compactView ? 'mb-2' : 'mb-4') : ''}`}>
                {showPortsUp && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className={`font-semibold ${metricClass} text-green-600 dark:text-green-400`}>
                      {totals.portsUp}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Up</span>
                  </div>
                )}
                {showPortsDown && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className={`font-semibold ${metricClass} text-red-600 dark:text-red-400`}>
                      {totals.portsDown}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Down</span>
                  </div>
                )}
              </div>
            )}

            {/* Numeric only with hideLabels - show scaled numbers */}
            {showNumeric && hideLabels && !showGraphical && (
              <div className={`flex gap-4 justify-center items-center h-full`}>
                {showPortsUp && showPortsDown ? (
                  <>
                    <span className={`font-semibold ${metricClass} text-green-600 dark:text-green-400`}>
                      {totals.portsUp}
                    </span>
                    <span className={`${metricClass} text-gray-400`}>/</span>
                    <span className={`font-semibold ${metricClass} text-red-600 dark:text-red-400`}>
                      {totals.portsDown}
                    </span>
                  </>
                ) : showPortsUp ? (
                  <span className={`font-semibold ${metricClass} text-green-600 dark:text-green-400`}>
                    {totals.portsUp}
                  </span>
                ) : (
                  <span className={`font-semibold ${metricClass} text-red-600 dark:text-red-400`}>
                    {totals.portsDown}
                  </span>
                )}
              </div>
            )}

            {/* Port grids */}
            {showGraphical && (
              <div className="space-y-4">
                {switches.map(sw => (
                  <div key={sw._id}>
                    {!hideLabels && switches.length > 1 && (
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        {sw.name}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {sw.ports
                        .filter(p => {
                          if (!p.enable) return false;
                          if (showPortsUp && showPortsDown) return true;
                          if (showPortsUp && p.up) return true;
                          if (showPortsDown && !p.up) return true;
                          return false;
                        })
                        .map(port => (
                          <div
                            key={port.port_idx}
                            className={`
                              flex flex-col items-center justify-center
                              ${compactView ? 'w-8 h-8' : 'w-10 h-10'}
                              rounded
                              ${port.up
                                ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                                : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                              }
                              ${port.is_uplink ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}
                            `}
                            title={`${port.name || `Port ${port.port_idx}`}${port.up ? ` - ${formatSpeed(port.speed)}` : ' - Down'}${port.poe_power ? ` - PoE: ${Number(port.poe_power).toFixed(1)}W` : ''}`}
                          >
                            <span className={`text-xs font-medium ${port.up ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                              {port.port_idx}
                            </span>
                            {showSpeed && port.up && port.speed > 0 && (
                              <span className="text-[8px] text-gray-500 dark:text-gray-400">
                                {formatSpeed(port.speed)}
                              </span>
                            )}
                            {showPoe && port.poe_power && Number(port.poe_power) > 0 && (
                              <span className="text-[8px] text-yellow-600 dark:text-yellow-400">
                                {getIcon('bolt', iconStyle, 'w-2 h-2')}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </BaseWidget>
  );
}
