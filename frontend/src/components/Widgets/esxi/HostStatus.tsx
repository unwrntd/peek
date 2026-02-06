import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface HostStatusData {
  host: {
    name: string;
    connectionState: string;
    powerState: string;
    cpu: {
      model: string;
      cores: number;
      mhz: number;
    };
    memory: {
      totalBytes: number;
    };
  };
}

interface HostStatusWidgetProps {
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

function getConnectionColor(state: string): string {
  switch (state) {
    case 'CONNECTED':
      return 'bg-green-500';
    case 'DISCONNECTED':
      return 'bg-red-500';
    case 'NOT_RESPONDING':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
}

export function HostStatus({ integrationId, config, widgetId }: HostStatusWidgetProps) {
  const { data, loading, error } = useWidgetData<HostStatusData>({
    integrationId,
    metric: 'host-status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <p className="text-sm">Loading host status...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  const { host } = data;

  if (visualization === 'detailed') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-3 h-3 rounded-full ${getConnectionColor(host.connectionState)}`} />
            <span className="text-lg font-medium text-white">{host.name}</span>
          </div>

          <div className="space-y-3">
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">CPU</div>
              <div className="text-sm text-white">{host.cpu.model || 'Unknown'}</div>
              <div className="text-xs text-gray-400 mt-1">
                {host.cpu.cores} cores @ {host.cpu.mhz} MHz
              </div>
            </div>

            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Memory</div>
              <div className="text-lg font-medium text-white">
                {formatBytes(host.memory.totalBytes)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500">Connection</div>
                <div className={`text-sm font-medium ${
                  host.connectionState === 'CONNECTED' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {host.connectionState}
                </div>
              </div>
              <div className="p-2 bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500">Power</div>
                <div className={`text-sm font-medium ${
                  host.powerState === 'POWERED_ON' ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {host.powerState === 'POWERED_ON' ? 'On' : 'Off'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default card view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col p-2">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-3 h-3 rounded-full ${getConnectionColor(host.connectionState)}`} />
          <span className="text-sm font-medium text-white truncate">{host.name}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 flex-1">
          <div className="p-2 bg-gray-800 rounded-lg flex flex-col justify-center">
            <div className="text-xl font-bold text-blue-400">{host.cpu.cores}</div>
            <div className="text-xs text-gray-500">CPU Cores</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg flex flex-col justify-center">
            <div className="text-xl font-bold text-purple-400">{formatBytes(host.memory.totalBytes)}</div>
            <div className="text-xs text-gray-500">Memory</div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
