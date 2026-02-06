import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface KasmStatus {
  sessionCount: number;
  userCount: number;
  imageCount: number;
  zoneCount: number;
}

interface StatusData {
  status: KasmStatus;
}

interface StatusWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Status({ integrationId, config, widgetId }: StatusWidgetProps) {
  const { data, loading, error } = useWidgetData<StatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const status = data?.status;
  const isMetricSize = config.metricSize === true;

  if (isMetricSize) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${status ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-sm text-gray-400">
              {status ? 'Online' : 'Offline'}
            </span>
          </div>
          {status && (
            <>
              <div className="text-2xl font-bold text-white mb-1">
                {status.sessionCount}
              </div>
              <div className="text-sm text-gray-400">
                active sessions
              </div>
            </>
          )}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold text-white">Kasm</div>
            <div className="text-sm text-gray-400">Workspaces</div>
          </div>
          <div className="ml-auto">
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              status ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {status ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        {status && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{status.sessionCount}</div>
              <div className="text-xs text-gray-400">Sessions</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{status.userCount}</div>
              <div className="text-xs text-gray-400">Users</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{status.imageCount}</div>
              <div className="text-xs text-gray-400">Images</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{status.zoneCount}</div>
              <div className="text-xs text-gray-400">Zones</div>
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
