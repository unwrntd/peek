import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface SystemData {
  system: {
    identity: string;
    version: string;
    buildTime: string;
    uptime: string;
    cpu: string;
    cpuCount: number;
    cpuFrequency: number;
    cpuLoad: number;
    memoryFree: number;
    memoryTotal: number;
    memoryUsedPercent: number;
    hddFree: number;
    hddTotal: number;
    hddUsedPercent: number;
    architecture: string;
    boardName: string;
    platform: string;
    routerboard: {
      model: string;
      serialNumber: string;
      firmwareType: string;
      currentFirmware: string;
      upgradeFirmware: string;
    } | null;
  };
}

interface SystemWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(uptime: string): string {
  return uptime
    .replace(/(\d+)w/, '$1w ')
    .replace(/(\d+)d/, '$1d ')
    .replace(/(\d+)h/, '$1h ')
    .replace(/(\d+)m/, '$1m ')
    .replace(/(\d+)s/, '$1s')
    .trim();
}

function GaugeBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="font-medium text-gray-200">{value}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function System({ integrationId, config, widgetId }: SystemWidgetProps) {
  const { data, loading, error } = useWidgetData<SystemData>({
    integrationId,
    metric: 'system',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';
  const system = data?.system;
  const isMetricSize = config.metricSize === true;

  if (isMetricSize && system) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-3xl font-bold text-white mb-1">{system.cpuLoad}%</div>
          <div className="text-sm text-gray-400">CPU Load</div>
          <div className="text-xs text-gray-500 mt-2">{system.identity}</div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'gauges') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-4 space-y-4">
          {system && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">{system.identity}</h3>
                  <p className="text-xs text-gray-400">{system.boardName}</p>
                </div>
              </div>

              <GaugeBar
                value={system.cpuLoad}
                label="CPU"
                color={system.cpuLoad > 80 ? 'bg-red-500' : system.cpuLoad > 50 ? 'bg-yellow-500' : 'bg-green-500'}
              />

              <GaugeBar
                value={system.memoryUsedPercent}
                label="Memory"
                color={system.memoryUsedPercent > 80 ? 'bg-red-500' : system.memoryUsedPercent > 50 ? 'bg-yellow-500' : 'bg-blue-500'}
              />

              {system.hddTotal > 0 && (
                <GaugeBar
                  value={system.hddUsedPercent}
                  label="Storage"
                  color={system.hddUsedPercent > 80 ? 'bg-red-500' : system.hddUsedPercent > 50 ? 'bg-yellow-500' : 'bg-purple-500'}
                />
              )}

              <div className="pt-2 flex items-center gap-2 text-xs text-gray-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatUptime(system.uptime)}</span>
              </div>
            </>
          )}
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-3 flex flex-col justify-center gap-2">
          {system && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">{system.identity}</span>
                <span className="text-xs text-gray-400">{system.version}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1 text-blue-400">
                  <span>CPU: {system.cpuLoad}%</span>
                </div>
                <div className="flex items-center gap-1 text-green-400">
                  <span>RAM: {system.memoryUsedPercent}%</span>
                </div>
                <div className="flex items-center gap-1 text-purple-400">
                  <span>{formatUptime(system.uptime)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default card view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full p-4 space-y-4 overflow-auto">
        {system && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">{system.identity}</h3>
                  <p className="text-sm text-gray-400">{system.boardName}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                {system.version}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <span>CPU</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold text-white">{system.cpuLoad}%</span>
                  <span className="text-xs text-gray-500">({system.cpuCount} cores)</span>
                </div>
              </div>

              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <span>Memory</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold text-white">{system.memoryUsedPercent}%</span>
                  <span className="text-xs text-gray-500">{formatBytes(system.memoryTotal)}</span>
                </div>
              </div>

              {system.hddTotal > 0 && (
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                    <span>Storage</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-semibold text-white">{system.hddUsedPercent}%</span>
                    <span className="text-xs text-gray-500">{formatBytes(system.hddTotal)}</span>
                  </div>
                </div>
              )}

              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <span>Uptime</span>
                </div>
                <div className="text-xl font-semibold text-white">{formatUptime(system.uptime)}</div>
              </div>
            </div>

            {/* Routerboard Info */}
            {system.routerboard && (
              <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                <p>Model: {system.routerboard.model}</p>
                <p>S/N: {system.routerboard.serialNumber}</p>
                <p>Firmware: {system.routerboard.currentFirmware}</p>
              </div>
            )}
          </>
        )}
      </div>
    </BaseWidget>
  );
}
