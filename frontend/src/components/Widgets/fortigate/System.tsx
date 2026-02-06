import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface SystemData {
  hostname: string;
  model: string;
  serial: string;
  version: string;
  build: number;
  uptime: number;
  resources: {
    cpu: number;
    memory: number;
    disk: number;
  };
  sessions: {
    current: number;
    max: number;
    utilizationPercent: number;
  };
  haEnabled: boolean;
  haRole?: string;
}

interface SystemWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function FortiGateSystem({ integrationId, config, widgetId }: SystemWidgetProps) {
  const { data, loading, error } = useWidgetData<SystemData>({
    integrationId,
    metric: 'system',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';

  const renderGauge = (label: string, value: number, color: string) => {
    const circumference = 2 * Math.PI * 36;
    const offset = circumference - (value / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-gray-700"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={color}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
            {value}%
          </span>
        </div>
        <span className="mt-1 text-xs text-gray-400">{label}</span>
      </div>
    );
  };

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm">Loading system...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'gauges') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-4 flex flex-col">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-white">{data.hostname}</h3>
            <p className="text-xs text-gray-400">{data.model} - {data.version}</p>
          </div>
          <div className="flex-1 flex items-center justify-center gap-6">
            {renderGauge('CPU', data.resources.cpu, data.resources.cpu > 80 ? 'text-red-500' : data.resources.cpu > 60 ? 'text-yellow-500' : 'text-green-500')}
            {renderGauge('Memory', data.resources.memory, data.resources.memory > 80 ? 'text-red-500' : data.resources.memory > 60 ? 'text-yellow-500' : 'text-blue-500')}
            {renderGauge('Disk', data.resources.disk, data.resources.disk > 80 ? 'text-red-500' : data.resources.disk > 60 ? 'text-yellow-500' : 'text-purple-500')}
          </div>
          <div className="text-center mt-2 text-xs text-gray-500">
            Sessions: {data.sessions.current.toLocaleString()} / {data.sessions.max.toLocaleString()} ({data.sessions.utilizationPercent}%)
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-3 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white truncate">{data.hostname}</span>
            {data.haEnabled && (
              <span className={`px-1.5 py-0.5 text-xs rounded ${data.haRole === 'primary' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {data.haRole || 'HA'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className={`text-lg font-bold ${data.resources.cpu > 80 ? 'text-red-400' : 'text-green-400'}`}>
                {data.resources.cpu}%
              </div>
              <div className="text-xs text-gray-500">CPU</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${data.resources.memory > 80 ? 'text-red-400' : 'text-blue-400'}`}>
                {data.resources.memory}%
              </div>
              <div className="text-xs text-gray-500">MEM</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">
                {data.sessions.utilizationPercent}%
              </div>
              <div className="text-xs text-gray-500">SESS</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default card visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full p-4 overflow-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{data.hostname}</h3>
            <p className="text-xs text-gray-400">{data.model}</p>
          </div>
          <div className="flex items-center gap-2">
            {data.haEnabled && (
              <span className={`px-2 py-1 text-xs rounded ${data.haRole === 'primary' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {data.haRole || 'HA'}
              </span>
            )}
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
              Online
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Version</span>
              <p className="text-white">{data.version} (build {data.build})</p>
            </div>
            <div>
              <span className="text-gray-500">Serial</span>
              <p className="text-white font-mono text-xs">{data.serial}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-2">Resources</div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">CPU</span>
                  <span className={data.resources.cpu > 80 ? 'text-red-400' : 'text-gray-300'}>{data.resources.cpu}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${data.resources.cpu > 80 ? 'bg-red-500' : data.resources.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${data.resources.cpu}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Memory</span>
                  <span className={data.resources.memory > 80 ? 'text-red-400' : 'text-gray-300'}>{data.resources.memory}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${data.resources.memory > 80 ? 'bg-red-500' : data.resources.memory > 60 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                    style={{ width: `${data.resources.memory}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Disk</span>
                  <span className="text-gray-300">{data.resources.disk}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 transition-all" style={{ width: `${data.resources.disk}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Sessions</span>
              <span className="text-white">
                {data.sessions.current.toLocaleString()} / {data.sessions.max.toLocaleString()}
                <span className="text-gray-500 ml-1">({data.sessions.utilizationPercent}%)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
