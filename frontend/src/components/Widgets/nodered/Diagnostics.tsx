import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { formatBytes, formatUptime } from '../../../utils/formatting';

interface NodeRedDiagnostics {
  report?: string;
  os?: {
    arch: string;
    platform: string;
    type: string;
    release: string;
    cpus: number | null;
    loadavg?: number[];
    uptime?: number;
    mem: {
      total: number;
      free: number;
    };
  };
  runtime?: {
    version: string | null;
    isStarted?: boolean;
    flows?: {
      started?: number;
      stopped?: number;
    };
    heap: {
      total: number;
      used: number;
    } | null;
  };
  settings?: {
    version: string;
    flowFile?: string;
    contextStorageDefault?: string;
  };
  error?: string;
}

interface DiagnosticsData {
  diagnostics: NodeRedDiagnostics;
}

interface DiagnosticsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all ${color}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

export function Diagnostics({ integrationId, config, widgetId }: DiagnosticsWidgetProps) {
  const { data, loading, error } = useWidgetData<DiagnosticsData>({
    integrationId,
    metric: 'diagnostics',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const diagnostics = data?.diagnostics;

  if (diagnostics?.error) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <svg className="w-8 h-8 text-yellow-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-gray-400">{diagnostics.error}</div>
        </div>
      </BaseWidget>
    );
  }

  const os = diagnostics?.os;
  const runtime = diagnostics?.runtime;
  const settings = diagnostics?.settings;

  const memUsedPercent = os?.mem && os.mem.total > 0
    ? Math.round(((os.mem.total - os.mem.free) / os.mem.total) * 100)
    : 0;
  const heapUsedPercent = runtime?.heap && runtime.heap.total > 0
    ? Math.round((runtime.heap.used / runtime.heap.total) * 100)
    : 0;

  // Format load average (1, 5, 15 min)
  const loadAvgStr = os?.loadavg
    ? os.loadavg.map(l => l.toFixed(2)).join(', ')
    : null;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-3 overflow-y-auto">
        {/* OS Info */}
        {os && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">System</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Platform</span>
                <span className="text-sm text-gray-200">{os.platform} ({os.arch})</span>
              </div>
              {os.cpus !== null && os.cpus > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">CPUs</span>
                  <span className="text-sm text-gray-200">{os.cpus}</span>
                </div>
              )}
              {loadAvgStr && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Load Avg</span>
                  <span className="text-sm text-gray-200">{loadAvgStr}</span>
                </div>
              )}
              {os.uptime !== undefined && os.uptime > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Uptime</span>
                  <span className="text-sm text-gray-200">{formatUptime(os.uptime)}</span>
                </div>
              )}
              {os.mem && os.mem.total > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-400">Memory</span>
                    <span className="text-xs text-gray-500">
                      {formatBytes(os.mem.total - os.mem.free)} / {formatBytes(os.mem.total)} ({memUsedPercent}%)
                    </span>
                  </div>
                  <ProgressBar
                    value={os.mem.total - os.mem.free}
                    max={os.mem.total}
                    color={memUsedPercent > 90 ? 'bg-red-500' : memUsedPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Runtime Info */}
        {runtime && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Runtime</div>
            <div className="space-y-2">
              {runtime.version && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Node.js</span>
                  <span className="text-sm text-gray-200">{runtime.version}</span>
                </div>
              )}
              {runtime.isStarted !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Flows</span>
                  <span className={`text-sm ${runtime.isStarted ? 'text-green-400' : 'text-yellow-400'}`}>
                    {runtime.isStarted ? 'Started' : 'Stopped'}
                  </span>
                </div>
              )}
              {runtime.flows && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Flow Count</span>
                  <span className="text-sm text-gray-200">
                    {runtime.flows.started ?? 0} running
                    {runtime.flows.stopped ? `, ${runtime.flows.stopped} stopped` : ''}
                  </span>
                </div>
              )}
              {runtime.heap && runtime.heap.total > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-400">Heap</span>
                    <span className="text-xs text-gray-500">
                      {formatBytes(runtime.heap.used)} / {formatBytes(runtime.heap.total)} ({heapUsedPercent}%)
                    </span>
                  </div>
                  <ProgressBar
                    value={runtime.heap.used}
                    max={runtime.heap.total}
                    color={heapUsedPercent > 90 ? 'bg-red-500' : heapUsedPercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Info */}
        {settings && (
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Settings</div>
            <div className="space-y-1">
              {settings.version && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Version</span>
                  <span className="text-sm text-gray-200">{settings.version}</span>
                </div>
              )}
              {settings.flowFile && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Flow File</span>
                  <span className="text-sm text-gray-200 truncate max-w-[150px]" title={settings.flowFile}>
                    {settings.flowFile}
                  </span>
                </div>
              )}
              {settings.contextStorageDefault && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Context Store</span>
                  <span className="text-sm text-gray-200">{settings.contextStorageDefault}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!os && !runtime && !settings && (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            No diagnostics data available
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
