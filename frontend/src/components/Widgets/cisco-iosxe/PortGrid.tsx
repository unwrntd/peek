import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { DonutChart } from '../../common/visualizations';

interface PortGridProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface CiscoInterface {
  name?: string;
  description?: string;
  adminStatus?: string;
  operStatus?: string;
  speed?: number;
  inOctets?: number;
  outOctets?: number;
  inErrors?: number;
  outErrors?: number;
}

interface InterfaceData {
  interfaces?: CiscoInterface[];
}

function formatSpeed(speed: number): string {
  if (!speed || speed === 0) return '';
  if (speed >= 1000000000) return (speed / 1000000000).toFixed(0) + 'G';
  if (speed >= 1000000) return (speed / 1000000).toFixed(0) + 'M';
  if (speed >= 1000) return (speed / 1000).toFixed(0) + 'K';
  return speed + '';
}

// Extract port number from interface name (e.g., "GigabitEthernet1/0/1" -> "1/0/1")
function getPortLabel(name: string): string {
  // Match common patterns: Gi1/0/1, Te1/0/1, Fa0/1, etc.
  const match = name.match(/(\d+\/\d+\/?\d*|\d+\/\d+|\d+)$/);
  if (match) return match[1];
  // Fallback: just return last part after any letter
  const parts = name.match(/[A-Za-z]+(.*)$/);
  if (parts) return parts[1];
  return name;
}

// Check if interface is a physical port (not VLAN, Loopback, etc.)
function isPhysicalPort(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('gigabit') ||
    lower.startsWith('fastethernet') ||
    lower.startsWith('tengigabit') ||
    lower.startsWith('twentyfivegig') ||
    lower.startsWith('fortygig') ||
    lower.startsWith('hundredgig') ||
    lower.startsWith('gi') ||
    lower.startsWith('fa') ||
    lower.startsWith('te') ||
    lower.startsWith('fo') ||
    lower.startsWith('hu') ||
    lower.startsWith('eth')
  );
}

export function PortGrid({ integrationId, config, widgetId }: PortGridProps) {
  const { data, loading, error } = useWidgetData<InterfaceData>({
    integrationId,
    metric: (config.metric as string) || 'interfaces',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = config.hideLabels === true;
  const showPortsUp = config.showPortsUp !== false;
  const showPortsDown = config.showPortsDown !== false;
  const showSpeed = config.showSpeed !== false;
  const showPhysicalOnly = config.showPhysicalOnly !== false;
  const metricSize = (config.metricSize as string) || 'md';

  // Support both 'visualization' (new) and 'visualizationType' (legacy)
  const visualizationType = (config.visualization as string) || (config.visualizationType as string) || 'grid';

  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  } : {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-2xl' : 'text-base');

  // Get interfaces array safely
  const allInterfaces = (data?.interfaces && Array.isArray(data.interfaces)) ? data.interfaces : [];

  // Filter to physical ports only if configured
  const physicalPorts = showPhysicalOnly
    ? allInterfaces.filter(iface => iface.name && isPhysicalPort(iface.name))
    : allInterfaces;

  // Count ports
  let portsUp = 0;
  let portsDown = 0;
  let portsAdminDown = 0;

  for (let i = 0; i < physicalPorts.length; i++) {
    const iface = physicalPorts[i];
    if (iface.adminStatus === 'down') {
      portsAdminDown++;
    } else if (iface.operStatus === 'up') {
      portsUp++;
    } else {
      portsDown++;
    }
  }

  const totalPorts = physicalPorts.length;

  // Filter ports based on config
  const filteredPorts = physicalPorts.filter(function(iface) {
    if (iface.adminStatus === 'down') return false; // Always hide admin-down ports
    if (showPortsUp && showPortsDown) return true;
    if (showPortsUp && iface.operStatus === 'up') return true;
    if (showPortsDown && iface.operStatus !== 'up') return true;
    return false;
  });

  // Build donut segments
  const donutSegments: { value: number; label: string; color: string }[] = [];
  if (showPortsUp && portsUp > 0) {
    donutSegments.push({ value: portsUp, label: 'Up', color: '#22c55e' });
  }
  if (showPortsDown && portsDown > 0) {
    donutSegments.push({ value: portsDown, label: 'Down', color: '#ef4444' });
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data ? (
        visualizationType === 'donut' && donutSegments.length > 0 ? (
          <DonutChart
            segments={donutSegments}
            responsive={true}
            showLegend={!hideLabels}
            showLabels={!hideLabels}
            centerValue={totalPorts.toString()}
            centerLabel={hideLabels ? undefined : 'Ports'}
          />
        ) : visualizationType === 'text' ? (
          <div className="flex gap-4 justify-center items-center h-full p-3">
            {showPortsUp && showPortsDown ? (
              <>
                <div className="text-center">
                  <div className={'font-bold ' + metricClass + ' text-green-600 dark:text-green-400'}>
                    {portsUp}
                  </div>
                  {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Up</div>}
                </div>
                <div className="text-center">
                  <div className={'font-bold ' + metricClass + ' text-red-600 dark:text-red-400'}>
                    {portsDown}
                  </div>
                  {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Down</div>}
                </div>
              </>
            ) : showPortsUp ? (
              <div className="text-center">
                <div className={'font-bold ' + metricClass + ' text-green-600 dark:text-green-400'}>
                  {portsUp}
                </div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Ports Up</div>}
              </div>
            ) : (
              <div className="text-center">
                <div className={'font-bold ' + metricClass + ' text-red-600 dark:text-red-400'}>
                  {portsDown}
                </div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Ports Down</div>}
              </div>
            )}
          </div>
        ) : physicalPorts.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            No ports found
          </div>
        ) : (
          <div className={compactView ? 'p-1' : 'p-2'}>
            {/* Summary stats */}
            {!hideLabels && (
              <div className={'flex gap-4 mb-3'}>
                {showPortsUp && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className={'font-semibold ' + metricClass + ' text-green-600 dark:text-green-400'}>
                      {portsUp}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Up</span>
                  </div>
                )}
                {showPortsDown && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className={'font-semibold ' + metricClass + ' text-red-600 dark:text-red-400'}>
                      {portsDown}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Down</span>
                  </div>
                )}
              </div>
            )}

            {/* Port grid */}
            <div className="flex flex-wrap gap-1">
              {filteredPorts.map(function(iface, idx) {
                const isUp = iface.operStatus === 'up';
                const portLabel = getPortLabel(iface.name || '');
                const speed = Number(iface.speed) || 0;
                const hasErrors = (Number(iface.inErrors) || 0) + (Number(iface.outErrors) || 0) > 0;

                return (
                  <div
                    key={iface.name || 'port-' + idx}
                    className={
                      'flex flex-col items-center justify-center rounded ' +
                      (compactView ? 'w-8 h-8' : 'w-10 h-10') + ' ' +
                      (isUp
                        ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                        : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                      ) + ' ' +
                      (hasErrors ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : '')
                    }
                    title={
                      (iface.name || 'Unknown') +
                      (iface.description ? ' - ' + iface.description : '') +
                      (isUp && speed ? ' - ' + formatSpeed(speed) : '') +
                      (!isUp ? ' - Down' : '') +
                      (hasErrors ? ' - Errors!' : '')
                    }
                  >
                    <span className={'text-xs font-medium ' + (isUp ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>
                      {portLabel}
                    </span>
                    {showSpeed && isUp && speed > 0 && (
                      <span className="text-[8px] text-gray-500 dark:text-gray-400">
                        {formatSpeed(speed)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredPorts.length === 0 && physicalPorts.length > 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No matching ports
              </div>
            )}
          </div>
        )
      ) : null}
    </BaseWidget>
  );
}
