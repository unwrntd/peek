import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface WazuhStatusData {
  status: {
    version: string;
    title: string;
    hostname: string;
    services: Record<string, string>;
    runningServices: number;
    totalServices: number;
    healthy: boolean;
  };
}

interface StatusWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Status({ integrationId, config, widgetId }: StatusWidgetProps) {
  const { data, loading, error } = useWidgetData<WazuhStatusData>({
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
            <div className={`w-3 h-3 rounded-full ${status?.healthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm text-gray-400">
              {status?.healthy ? 'Healthy' : 'Degraded'}
            </span>
          </div>
          {status && (
            <>
              <div className="text-2xl font-bold text-white mb-1">
                {status.runningServices}/{status.totalServices}
              </div>
              <div className="text-sm text-gray-400">services running</div>
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
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold text-white">Wazuh</div>
            <div className="text-sm text-gray-400">
              {status?.version ? `v${status.version}` : 'Security Platform'}
            </div>
          </div>
          <div className="ml-auto">
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              status?.healthy ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {status?.healthy ? 'Healthy' : 'Degraded'}
            </div>
          </div>
        </div>

        {status && (
          <div className="space-y-3">
            {status.hostname && (
              <div className="text-sm text-gray-400">
                Host: <span className="text-gray-200">{status.hostname}</span>
              </div>
            )}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Services</span>
                <span className="text-sm text-gray-200">
                  {status.runningServices}/{status.totalServices}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    status.healthy ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${(status.runningServices / status.totalServices) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
