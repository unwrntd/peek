import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface SystemData {
  hostname: string;
  model: string;
  serial: string;
  ipAddress: string;
  software: {
    version: string;
    appVersion: string;
    threatVersion: string;
    wildfireVersion: string;
  };
  uptime: string;
  uptimeSeconds: number;
  multiVsys: boolean;
  operationalMode: string;
}

interface SystemWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function System({ integrationId, config, widgetId }: SystemWidgetProps) {
  const { data, loading, error } = useWidgetData<SystemData>({
    integrationId,
    metric: 'system',
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm">Loading system...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'status') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-lg font-medium text-white">{data.hostname}</span>
          </div>
          <div className="text-sm text-gray-400">{data.model}</div>
          <div className="text-xs text-gray-500 mt-2">PAN-OS {data.software.version}</div>
          <div className="text-xs text-gray-500 mt-1">Uptime: {data.uptime}</div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-between p-2">
          <div>
            <div className="text-sm font-medium text-white">{data.hostname}</div>
            <div className="text-xs text-gray-500">{data.model}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-400">v{data.software.version}</div>
            <div className="text-xs text-gray-500">{data.uptime}</div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default card view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto p-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-lg font-medium text-white">{data.hostname}</span>
        </div>

        <div className="space-y-3">
          <div className="p-2 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Model</div>
            <div className="text-sm text-white">{data.model}</div>
            <div className="text-xs text-gray-500 mt-1">Serial: {data.serial}</div>
          </div>

          <div className="p-2 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Software Versions</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">PAN-OS:</span>
                <span className="text-white ml-1">{data.software.version}</span>
              </div>
              <div>
                <span className="text-gray-400">App:</span>
                <span className="text-white ml-1">{data.software.appVersion}</span>
              </div>
              <div>
                <span className="text-gray-400">Threat:</span>
                <span className="text-white ml-1">{data.software.threatVersion}</span>
              </div>
              <div>
                <span className="text-gray-400">WildFire:</span>
                <span className="text-white ml-1">{data.software.wildfireVersion}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500">Uptime</div>
              <div className="text-sm text-white">{data.uptime}</div>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500">Mode</div>
              <div className="text-sm text-white capitalize">{data.operationalMode}</div>
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
