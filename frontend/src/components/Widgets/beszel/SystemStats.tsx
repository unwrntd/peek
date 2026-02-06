import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { BaseWidget } from '../BaseWidget';
import { CircularGauge } from '../../common/visualizations';
import { BeszelSystemStats } from '../../../types';
import { formatBytes, formatBytesPerSec } from '../../../utils/formatting';
import { getUsageColor, getProgressColor, getTempColor } from '../../../utils/colors';
import { getMetricSizeClasses } from '../../../utils/sizing';

interface SystemStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface StatsData {
  stats: BeszelSystemStats[];
}

interface SystemsData {
  systems: { name: string; status: 'up' | 'down' | 'paused' | 'pending' }[];
}

// Discriminated union for online vs offline systems
type SystemStatWithStatus =
  | (BeszelSystemStats & { isOffline: false })
  | { system: string; isOffline: true };

export function SystemStats({ integrationId, config, widgetId }: SystemStatsProps) {
  const { rHost } = useRedact();
  const { data, loading, error } = useWidgetData<StatsData>({
    integrationId,
    metric: (config.metric as string) || 'beszel-system-stats',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Also fetch systems list to get offline hosts
  const { data: systemsData } = useWidgetData<SystemsData>({
    integrationId,
    metric: 'systems',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId: widgetId ? `${widgetId}-systems` : undefined,
  });

  // Get integration config to build URL to Beszel
  const integration = useIntegrationStore(state =>
    state.integrations.find(i => i.id === integrationId)
  );
  const integrationConfig = integration?.config as { host?: string; port?: number; useHttps?: boolean } | undefined;

  // Build the base Beszel URL
  const getBeszelUrl = (hostname?: string) => {
    if (!integrationConfig?.host) return null;
    const protocol = integrationConfig.useHttps === true ? 'https' : 'http';
    const port = integrationConfig.port || 8090;
    const baseUrl = `${protocol}://${integrationConfig.host}:${port}`;
    if (hostname) {
      return `${baseUrl}/system/${hostname}`;
    }
    return baseUrl;
  };

  // Configuration options
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showDisk = config.showDisk !== false;
  const showNetwork = config.showNetwork !== false;
  const showTemps = config.showTemps !== false;
  const showHostname = config.showHostname !== false;
  const showBorder = config.showBorder !== false;
  // Support both 'visualization' (new) and 'visualizationType' (legacy) config keys
  const visualizationType = (config.visualization as 'text' | 'bars' | 'gauges') || (config.visualizationType as 'text' | 'bars' | 'gauges') || 'bars';
  // Temperature selection - support new hostTemps (per-host), old selectedTemps array, and legacy single selectedTemp
  const hostTemps = (config.hostTemps as Record<string, string[]>) || {};
  const selectedTemps = (config.selectedTemps as string[]) || [];
  const legacySelectedTemp = (config.selectedTemp as string) || '';
  // Totals display options (default to showing when defaultEnabled is true in config)
  const showTotalCpus = config.showTotalCpus !== false;
  const showTotalRam = config.showTotalRam !== false;
  const showTotalDisk = config.showTotalDisk !== false;
  const showMaxTemp = config.showMaxTemp !== false;

  const metricSize = (config.metricSize as string) || 'md';
  const metricSizeClasses = getMetricSizeClasses(hideLabels);
  const metricClass = metricSizeClasses[metricSize as keyof typeof metricSizeClasses] || (hideLabels ? 'text-2xl' : 'text-base');

  // Apply filters - use selectedHosts array if set, otherwise show all
  const selectedHosts = (config.selectedHosts as string[]) || [];
  const hostOrder = (config.hostOrder as string[]) || [];
  const hostIcons = (config.hostIcons as Record<string, string>) || {};

  // Build a map of online stats by system name
  const statsMap = new Map<string, BeszelSystemStats>();
  (data?.stats || []).forEach(stat => {
    statsMap.set(stat.system, stat);
  });

  // Build systems status map
  const systemStatusMap = new Map<string, 'up' | 'down' | 'paused' | 'pending'>();
  (systemsData?.systems || []).forEach(sys => {
    systemStatusMap.set(sys.name, sys.status);
  });

  // Create merged list with both online and offline hosts
  const mergedStats: SystemStatWithStatus[] = [];

  if (selectedHosts.length > 0) {
    // Show only selected hosts (including offline ones)
    selectedHosts.forEach(hostName => {
      const stat = statsMap.get(hostName);
      const status = systemStatusMap.get(hostName);
      if (stat) {
        mergedStats.push({ ...stat, isOffline: false });
      } else if (status && status !== 'up') {
        // Host is selected but offline
        mergedStats.push({ system: hostName, isOffline: true });
      }
    });
  } else {
    // Show all hosts from stats (online only when no selection)
    (data?.stats || []).forEach(stat => {
      mergedStats.push({ ...stat, isOffline: false });
    });
  }

  // Sort by host order if specified
  const sortedStats = [...mergedStats].sort((a, b) => {
    const aIndex = hostOrder.indexOf(a.system);
    const bIndex = hostOrder.indexOf(b.system);
    // If neither has an order, maintain original order
    if (aIndex === -1 && bIndex === -1) return 0;
    // Unordered hosts go to the end
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    // Both have order, sort by index
    return aIndex - bIndex;
  });

  // Helper to get selected temperatures or max temp for a specific host
  const getTemperatures = (hostName: string, temps: { name: string; temp: number }[] | undefined): { name: string; temp: number }[] => {
    if (!temps || temps.length === 0) return [];

    // New: check per-host temperature selection
    const hostSelectedTemps = hostTemps[hostName];
    if (hostSelectedTemps && hostSelectedTemps.length > 0) {
      const matched = temps.filter(t => hostSelectedTemps.includes(t.name));
      return matched.length > 0 ? matched : [];
    }

    // Legacy: global selectedTemps array
    if (selectedTemps.length > 0) {
      const matched = temps.filter(t => selectedTemps.includes(t.name));
      return matched.length > 0 ? matched : [];
    }

    // Legacy: single selectedTemp with partial match
    if (legacySelectedTemp) {
      const found = temps.find(t => t.name.toLowerCase().includes(legacySelectedTemp.toLowerCase()));
      if (found) return [found];
    }

    // Default: return max temp
    const maxTemp = temps.reduce((max, t) => t.temp > max.temp ? t : max, temps[0]);
    return [maxTemp];
  };

  // Configurable thresholds with defaults
  const warningThreshold = (config.warningThreshold as number) || 75;
  const criticalThreshold = (config.criticalThreshold as number) || 90;
  const tempWarningThreshold = (config.tempWarningThreshold as number) || 60;
  const tempCriticalThreshold = (config.tempCriticalThreshold as number) || 80;

  // Check if we should use full-height mode (single system with gauges, no border/hostname)
  const singleSystemGauges = visualizationType === 'gauges' && sortedStats.length === 1 && !showBorder && !showHostname && !sortedStats[0]?.isOffline;

  // Helper to render offline system placeholder with empty gauges
  const renderOfflineGauges = (systemName: string) => (
    <div className="relative flex items-stretch gap-2" style={{ minHeight: '120px' }}>
      {/* Empty gauges */}
      {showCpu && (
        <div className="flex-1 min-w-0 flex flex-col opacity-30">
          <div className="flex-1 min-h-0">
            <CircularGauge
              value={0}
              responsive={true}
              showValue={false}
              showLabel={!hideLabels}
              label="CPU"
            />
          </div>
        </div>
      )}
      {showMemory && (
        <div className="flex-1 min-w-0 flex flex-col opacity-30">
          <div className="flex-1 min-h-0">
            <CircularGauge
              value={0}
              responsive={true}
              showValue={false}
              showLabel={!hideLabels}
              label="Memory"
            />
          </div>
        </div>
      )}
      {showDisk && (
        <div className="flex-1 min-w-0 flex flex-col opacity-30">
          <div className="flex-1 min-h-0">
            <CircularGauge
              value={0}
              responsive={true}
              showValue={false}
              showLabel={!hideLabels}
              label="Disk"
            />
          </div>
        </div>
      )}
      {/* Overlay text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="px-3 py-1.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium">
          System Offline
        </span>
      </div>
    </div>
  );

  // Helper to render a metric row with progress bar
  const renderMetricRow = (
    label: string,
    value: number,
    total?: number,
    used?: number,
    thresholdWarning = warningThreshold,
    thresholdCritical = criticalThreshold
  ) => (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`text-sm font-medium ${getUsageColor(value, thresholdWarning, thresholdCritical)}`}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
        <div
          className={`h-full ${getProgressColor(value, thresholdWarning, thresholdCritical)} rounded-full transition-all`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      {total !== undefined && used !== undefined && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatBytes(used)} / {formatBytes(total)}
        </div>
      )}
    </div>
  );

  // Handler to open Beszel URL
  const handleWidgetClick = (systemId?: string) => {
    const url = getBeszelUrl(systemId);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        singleSystemGauges ? (
          // Full-height gauge mode for single system (only used when not offline)
          (() => {
            const stat = sortedStats[0] as BeszelSystemStats & { isOffline: false };
            const tempsData = getTemperatures(stat.system, stat.temps);
            const showTempGauges = showTemps && tempsData.length > 0;
            const beszelUrl = getBeszelUrl(stat.system);
            return (
              <div
                className={`h-full w-full flex items-stretch gap-2 ${beszelUrl ? 'cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 rounded-lg transition-colors' : ''}`}
                onClick={beszelUrl ? () => handleWidgetClick(stat.system) : undefined}
                title={beszelUrl ? `Open ${stat.system} in Beszel` : undefined}
              >
                {showCpu && (
                  <div className="flex-1 h-full min-w-0 flex flex-col">
                    <div className="flex-1 min-h-0">
                      <CircularGauge
                        value={stat.cpu}
                        responsive={true}
                        showValue={true}
                        showLabel={!hideLabels}
                        label="CPU"
                      />
                    </div>
                    {showTotalCpus && stat.cores && !hideLabels && (
                      <div className="text-xs text-center text-gray-500 dark:text-gray-400 -mt-1">
                        {stat.cores} cores
                      </div>
                    )}
                  </div>
                )}
                {showMemory && (
                  <div className="flex-1 h-full min-w-0 flex flex-col">
                    <div className="flex-1 min-h-0">
                      <CircularGauge
                        value={stat.mem}
                        responsive={true}
                        showValue={true}
                        showLabel={!hideLabels}
                        label="Memory"
                      />
                    </div>
                    {showTotalRam && stat.memTotal > 0 && !hideLabels && (
                      <div className="text-xs text-center text-gray-500 dark:text-gray-400 -mt-1">
                        {formatBytes(stat.memTotal)}
                      </div>
                    )}
                  </div>
                )}
                {showDisk && (
                  <div className="flex-1 h-full min-w-0 flex flex-col">
                    <div className="flex-1 min-h-0">
                      <CircularGauge
                        value={stat.disk}
                        responsive={true}
                        showValue={true}
                        showLabel={!hideLabels}
                        label="Disk"
                      />
                    </div>
                    {showTotalDisk && stat.diskTotal > 0 && !hideLabels && (
                      <div className="text-xs text-center text-gray-500 dark:text-gray-400 -mt-1">
                        {formatBytes(stat.diskTotal)}
                      </div>
                    )}
                  </div>
                )}
                {showTempGauges && tempsData.map((tempData) => (
                  <div key={tempData.name} className="flex-1 h-full min-w-0 flex flex-col">
                    <div className="flex-1 min-h-0">
                      <CircularGauge
                        value={tempData.temp}
                        max={100}
                        responsive={true}
                        showValue={true}
                        showLabel={!hideLabels}
                        label={tempData.name || 'Temp'}
                        unit="°C"
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
        <div className={`${compactView ? 'space-y-2' : 'space-y-3'}`}>
          {sortedStats.map(stat => {
            const systemUrl = getBeszelUrl(stat.system);
            return (
            <div
              key={stat.isOffline ? `offline-${stat.system}` : stat.id}
              className={`${showBorder ? `border border-gray-200 dark:border-gray-700 rounded-lg ${compactView ? 'p-2' : 'p-3'}` : ''} ${systemUrl ? 'cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors' : ''}`}
              onClick={systemUrl ? () => handleWidgetClick(stat.system) : undefined}
              title={systemUrl ? `Open ${stat.system} in Beszel` : undefined}
            >
              {showHostname && (
                <div className={`font-medium text-gray-900 dark:text-white ${showBorder ? 'mb-2' : 'mb-1'} flex items-center gap-2`}>
                  {hostIcons[stat.system] && (
                    <img
                      src={hostIcons[stat.system]}
                      alt=""
                      className="w-5 h-5 object-contain flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  {getBeszelUrl(stat.system) ? (
                    <a
                      href={getBeszelUrl(stat.system)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition-colors ${stat.isOffline ? 'text-gray-500 dark:text-gray-400' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {rHost(stat.system)}
                    </a>
                  ) : (
                    <span className={stat.isOffline ? 'text-gray-500 dark:text-gray-400' : ''}>{rHost(stat.system)}</span>
                  )}
                </div>
              )}

              {/* Render offline placeholder */}
              {stat.isOffline ? (
                renderOfflineGauges(stat.system)
              ) : visualizationType === 'gauges' ? (
                (() => {
                  const tempsData = getTemperatures(stat.system, stat.temps);
                  const showTempGauges = showTemps && tempsData.length > 0;
                  return (
                    <div className="flex items-stretch gap-2" style={{ minHeight: '120px' }}>
                      {showCpu && (
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex-1 min-h-0">
                            <CircularGauge
                              value={stat.cpu}
                              responsive={true}
                              showValue={true}
                              showLabel={!hideLabels}
                              label="CPU"
                            />
                          </div>
                          {showTotalCpus && stat.cores && !hideLabels && (
                            <div className="text-xs text-center text-gray-500 dark:text-gray-400 -mt-1">
                              {stat.cores} cores
                            </div>
                          )}
                        </div>
                      )}
                      {showMemory && (
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex-1 min-h-0">
                            <CircularGauge
                              value={stat.mem}
                              responsive={true}
                              showValue={true}
                              showLabel={!hideLabels}
                              label="Memory"
                            />
                          </div>
                          {showTotalRam && stat.memTotal > 0 && !hideLabels && (
                            <div className="text-xs text-center text-gray-500 dark:text-gray-400 -mt-1">
                              {formatBytes(stat.memTotal)}
                            </div>
                          )}
                        </div>
                      )}
                      {showDisk && (
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex-1 min-h-0">
                            <CircularGauge
                              value={stat.disk}
                              responsive={true}
                              showValue={true}
                              showLabel={!hideLabels}
                              label="Disk"
                            />
                          </div>
                          {showTotalDisk && stat.diskTotal > 0 && !hideLabels && (
                            <div className="text-xs text-center text-gray-500 dark:text-gray-400 -mt-1">
                              {formatBytes(stat.diskTotal)}
                            </div>
                          )}
                        </div>
                      )}
                      {showTempGauges && tempsData.map((tempData) => (
                        <div key={tempData.name} className="flex-1 min-w-0 flex flex-col">
                          <div className="flex-1 min-h-0">
                            <CircularGauge
                              value={tempData.temp}
                              max={100}
                              responsive={true}
                              showValue={true}
                              showLabel={!hideLabels}
                              label={tempData.name || 'Temp'}
                              unit="°C"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : visualizationType === 'text' ? (
                /* Text-only visualization */
                <div className={`grid ${hideLabels ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4'} gap-3`}>
                  {showCpu && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">CPU</div>}
                      <div className={`font-medium ${metricClass} ${getUsageColor(stat.cpu, warningThreshold, criticalThreshold)}`}>
                        {stat.cpu.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {showMemory && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Memory</div>}
                      <div className={`font-medium ${metricClass} ${getUsageColor(stat.mem, warningThreshold, criticalThreshold)}`}>
                        {stat.mem.toFixed(1)}%
                      </div>
                      {!hideLabels && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatBytes(stat.memUsed)} / {formatBytes(stat.memTotal)}
                        </div>
                      )}
                    </div>
                  )}
                  {showDisk && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Disk</div>}
                      <div className={`font-medium ${metricClass} ${getUsageColor(stat.disk, warningThreshold, criticalThreshold)}`}>
                        {stat.disk.toFixed(1)}%
                      </div>
                      {!hideLabels && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatBytes(stat.diskUsed)} / {formatBytes(stat.diskTotal)}
                        </div>
                      )}
                    </div>
                  )}
                  {showNetwork && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Network</div>}
                      <div className="flex flex-col gap-0.5">
                        <div className={`font-medium ${metricClass} text-green-600 dark:text-green-400`}>
                          {hideLabels ? '↓' : ''}{formatBytesPerSec(stat.netIn)}
                        </div>
                        <div className={`font-medium ${metricClass} text-blue-600 dark:text-blue-400`}>
                          {hideLabels ? '↑' : ''}{formatBytesPerSec(stat.netOut)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Progress bars visualization (default) */
                <div className={`grid ${hideLabels ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4'} gap-3`}>
                  {showCpu && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">CPU</div>}
                      <div className={`font-medium ${metricClass} ${getUsageColor(stat.cpu, warningThreshold, criticalThreshold)}`}>
                        {stat.cpu.toFixed(1)}%
                      </div>
                      {!hideLabels && (
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                          <div
                            className={`h-full ${getProgressColor(stat.cpu, warningThreshold, criticalThreshold)} rounded-full transition-all`}
                            style={{ width: `${Math.min(stat.cpu, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {showMemory && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Memory</div>}
                      <div className={`font-medium ${metricClass} ${getUsageColor(stat.mem, warningThreshold, criticalThreshold)}`}>
                        {stat.mem.toFixed(1)}%
                      </div>
                      {!hideLabels && (
                        <>
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                            <div
                              className={`h-full ${getProgressColor(stat.mem, warningThreshold, criticalThreshold)} rounded-full transition-all`}
                              style={{ width: `${Math.min(stat.mem, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatBytes(stat.memUsed)} / {formatBytes(stat.memTotal)}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {showDisk && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Disk</div>}
                      <div className={`font-medium ${metricClass} ${getUsageColor(stat.disk, warningThreshold, criticalThreshold)}`}>
                        {stat.disk.toFixed(1)}%
                      </div>
                      {!hideLabels && (
                        <>
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                            <div
                              className={`h-full ${getProgressColor(stat.disk, warningThreshold, criticalThreshold)} rounded-full transition-all`}
                              style={{ width: `${Math.min(stat.disk, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatBytes(stat.diskUsed)} / {formatBytes(stat.diskTotal)}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {showNetwork && (
                    <div className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Network</div>}
                      <div className="flex flex-col gap-0.5">
                        <div className={`font-medium ${metricClass} text-green-600 dark:text-green-400`}>
                          {hideLabels ? '↓' : ''}{formatBytesPerSec(stat.netIn)}
                        </div>
                        <div className={`font-medium ${metricClass} text-blue-600 dark:text-blue-400`}>
                          {hideLabels ? '↑' : ''}{formatBytesPerSec(stat.netOut)}
                        </div>
                      </div>
                    </div>
                  )}
                  {showTemps && getTemperatures(stat.system, stat.temps).map((tempData, idx) => (
                    <div key={tempData.name || idx} className={hideLabels ? 'text-center' : ''}>
                      {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">{tempData.name || 'Temp'}</div>}
                      <div className={`font-medium ${metricClass} ${getTempColor(tempData.temp, tempWarningThreshold, tempCriticalThreshold)}`}>
                        {tempData.temp.toFixed(0)}°C
                      </div>
                      {!hideLabels && (
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                          <div
                            className={`h-full ${getProgressColor(tempData.temp, tempWarningThreshold, tempCriticalThreshold)} rounded-full transition-all`}
                            style={{ width: `${Math.min(tempData.temp, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Totals section - only for bars/text mode since gauges show inline, only for online hosts */}
              {!stat.isOffline && (showTotalCpus || showTotalRam || showTotalDisk || showMaxTemp) && !hideLabels && visualizationType !== 'gauges' && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {showTotalCpus && stat.cores && (
                      <span>{stat.cores} CPUs</span>
                    )}
                    {showTotalRam && stat.memTotal > 0 && (
                      <span>{formatBytes(stat.memTotal)} RAM</span>
                    )}
                    {showTotalDisk && stat.diskTotal > 0 && (
                      <span>{formatBytes(stat.diskTotal)} Disk</span>
                    )}
                    {showMaxTemp && stat.temps && stat.temps.length > 0 && (() => {
                      const maxTemp = stat.temps.reduce((max: { temp: number }, t: { temp: number }) => t.temp > max.temp ? t : max, stat.temps[0]);
                      return (
                        <span className={getTempColor(maxTemp.temp, tempWarningThreshold, tempCriticalThreshold)}>
                          Max: {maxTemp.temp.toFixed(0)}°C
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Full temperatures list (only when no specific temps are selected), only for online hosts */}
              {!stat.isOffline && showTemps && selectedTemps.length === 0 && !legacySelectedTemp && stat.temps && stat.temps.length > 0 && !hideLabels && visualizationType !== 'gauges' && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Temperatures</div>
                  <div className="flex flex-wrap gap-2">
                    {stat.temps.map((temp: { name: string; temp: number }, idx: number) => (
                      <span
                        key={idx}
                        className={`text-xs px-2 py-0.5 rounded ${
                          temp.temp >= 80 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          temp.temp >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {temp.name}: {temp.temp}°C
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          })}
          {sortedStats.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.stats.length === 0 ? 'No system stats available' : 'No systems match filter'}
            </p>
          )}
        </div>
        )
      )}
    </BaseWidget>
  );
}
