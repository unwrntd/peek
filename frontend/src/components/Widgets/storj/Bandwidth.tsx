import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface BandwidthData {
  summary: {
    egress: number;
    ingress: number;
    total: number;
  };
  daily: Array<{
    date: string;
    egress: number;
    ingress: number;
    repair: number;
    audit: number;
  }>;
  bySatellite: Record<string, { egress: number; ingress: number }>;
}

interface BandwidthWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function Bandwidth({ integrationId, config, widgetId }: BandwidthWidgetProps) {
  const { data, loading, error } = useWidgetData<BandwidthData>({
    integrationId,
    metric: 'bandwidth',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'stats';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-sm">Loading bandwidth...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'breakdown') {
    const satellites = Object.entries(data.bySatellite);
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-gray-500">Bandwidth by Satellite</span>
            <span className="text-gray-400">{formatBytes(data.summary.total)} total</span>
          </div>
          <div className="space-y-2">
            {satellites.map(([name, stats]) => {
              const total = stats.egress + stats.ingress;
              const egressPercent = total > 0 ? (stats.egress / total) * 100 : 0;
              return (
                <div key={name} className="p-2 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white">{name}</span>
                    <span className="text-xs text-gray-400">{formatBytes(total)}</span>
                  </div>
                  <div className="flex h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="bg-green-500"
                      style={{ width: `${egressPercent}%` }}
                      title={`Egress: ${formatBytes(stats.egress)}`}
                    />
                    <div
                      className="bg-blue-500"
                      style={{ width: `${100 - egressPercent}%` }}
                      title={`Ingress: ${formatBytes(stats.ingress)}`}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-green-400">{formatBytes(stats.egress)} out</span>
                    <span className="text-blue-400">{formatBytes(stats.ingress)} in</span>
                  </div>
                </div>
              );
            })}
            {satellites.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">No bandwidth data</p>
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default stats view
  const egressPercent = data.summary.total > 0 ? (data.summary.egress / data.summary.total) * 100 : 0;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col p-2">
        <div className="text-xs text-gray-500 mb-2">Bandwidth Usage</div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center mb-4">
            <div className="text-2xl font-bold text-white">{formatBytes(data.summary.total)}</div>
            <div className="text-xs text-gray-500">Total Bandwidth</div>
          </div>

          <div className="mb-4">
            <div className="flex h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${egressPercent}%` }}
              />
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${100 - egressPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-gray-500">Egress</span>
              </div>
              <div className="text-lg font-semibold text-green-400">{formatBytes(data.summary.egress)}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-xs text-gray-500">Ingress</span>
              </div>
              <div className="text-lg font-semibold text-blue-400">{formatBytes(data.summary.ingress)}</div>
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
