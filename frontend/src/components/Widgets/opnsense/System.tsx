import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { formatBytes } from '../../../utils/formatting';

interface SystemProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface OPNsenseSystemData {
  hostname: string;
  version: string;
  platform: string;
  uptime: number;
  uptimeFormatted: string;
  firmware: {
    current: string;
    available?: string;
    updateAvailable: boolean;
  };
  cpu: {
    usage: number;
    model: string;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    percentUsed: number;
  };
  disk: {
    total: number;
    used: number;
    percentUsed: number;
  };
}

interface SystemDataResponse {
  system: OPNsenseSystemData;
}

function UsageGauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-gray-200 dark:text-gray-700"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className={color}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${value}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-900 dark:text-white">{Math.round(value)}%</span>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</span>
    </div>
  );
}

export function System({ integrationId, config, widgetId }: SystemProps) {
  const { data, loading, error } = useWidgetData<SystemDataResponse>({
    integrationId,
    metric: 'system',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const showVersion = config.showVersion !== false;
  const showUptime = config.showUptime !== false;
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showDisk = config.showDisk !== false;
  const showFirmware = config.showFirmware !== false;
  const visualizationType = (config.visualization as string) || 'card';
  const metricSize = (config.metricSize as string) || 'medium';

  const system = data?.system;

  const getMetricSizeClass = () => {
    switch (metricSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-xl';
      default: return 'text-base';
    }
  };

  const renderCardView = () => (
    <div className="space-y-3">
      {showVersion && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Version</span>
          <span className={`${getMetricSizeClass()} font-medium text-gray-900 dark:text-white`}>
            {system?.version || 'Unknown'}
          </span>
        </div>
      )}

      {showUptime && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Uptime</span>
          <span className={`${getMetricSizeClass()} font-medium text-gray-900 dark:text-white`}>
            {system?.uptimeFormatted || 'Unknown'}
          </span>
        </div>
      )}

      {showFirmware && system?.firmware?.updateAvailable && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-xs text-yellow-700 dark:text-yellow-400">
              Update available: {system.firmware.available}
            </span>
          </div>
        </div>
      )}

      {(showCpu || showMemory || showDisk) && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {showCpu && (
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {Math.round(system?.cpu?.usage || 0)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">CPU</div>
            </div>
          )}
          {showMemory && (
            <div className="text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {Math.round(system?.memory?.percentUsed || 0)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Memory</div>
            </div>
          )}
          {showDisk && (
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {Math.round(system?.disk?.percentUsed || 0)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Disk</div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderGaugesView = () => (
    <div className="flex justify-around items-center py-2">
      {showCpu && (
        <UsageGauge label="CPU" value={system?.cpu?.usage || 0} color="text-blue-500" />
      )}
      {showMemory && (
        <UsageGauge label="Memory" value={system?.memory?.percentUsed || 0} color="text-green-500" />
      )}
      {showDisk && (
        <UsageGauge label="Disk" value={system?.disk?.percentUsed || 0} color="text-purple-500" />
      )}
    </div>
  );

  const renderCompactView = () => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">OPNsense</span>
        <span className="font-medium text-gray-900 dark:text-white">{system?.version}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
        {showCpu && <span>CPU: {Math.round(system?.cpu?.usage || 0)}%</span>}
        {showMemory && <span>Mem: {Math.round(system?.memory?.percentUsed || 0)}%</span>}
        {showDisk && <span>Disk: {Math.round(system?.disk?.percentUsed || 0)}%</span>}
      </div>
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && system && (
        <>
          {visualizationType === 'gauges' ? renderGaugesView() :
           visualizationType === 'compact' ? renderCompactView() : renderCardView()}
        </>
      )}
    </BaseWidget>
  );
}
