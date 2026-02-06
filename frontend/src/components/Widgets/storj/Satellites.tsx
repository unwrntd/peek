import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface SatelliteInfo {
  id: string;
  name: string;
  url: string;
  disqualified: string | null;
  suspended: string | null;
  storageUsed: number;
  auditScore: number;
  uptimeScore: number;
  egress: number;
  ingress: number;
}

interface SatellitesData {
  satellites: SatelliteInfo[];
  summary: {
    totalStorage: number;
    totalBandwidth: number;
    avgAuditScore: number;
    avgUptimeScore: number;
  };
}

interface SatellitesWidgetProps {
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

function getScoreColor(score: number): string {
  if (score >= 0.95) return 'text-green-400';
  if (score >= 0.8) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 0.95) return 'bg-green-500';
  if (score >= 0.8) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function Satellites({ integrationId, config, widgetId }: SatellitesWidgetProps) {
  const { data, loading, error } = useWidgetData<SatellitesData>({
    integrationId,
    metric: 'satellites',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Loading satellites...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-xs text-gray-500 mb-2">{data.satellites.length} Satellites</div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(data.summary.avgAuditScore)}`}>
                {Math.round(data.summary.avgAuditScore * 100)}%
              </div>
              <div className="text-xs text-gray-500">Audit Score</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(data.summary.avgUptimeScore)}`}>
                {Math.round(data.summary.avgUptimeScore * 100)}%
              </div>
              <div className="text-xs text-gray-500">Uptime Score</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="grid grid-cols-2 gap-2">
            {data.satellites.map((sat) => (
              <div
                key={sat.id}
                className={`p-2 rounded-lg ${
                  sat.disqualified ? 'bg-red-900/20 border border-red-500/30' :
                  sat.suspended ? 'bg-yellow-900/20 border border-yellow-500/30' :
                  'bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{sat.name}</span>
                  {sat.disqualified && <span className="text-xs text-red-400">DQ</span>}
                  {sat.suspended && <span className="text-xs text-yellow-400">Susp</span>}
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>
                    <span className="text-gray-500">Audit</span>
                    <div className={getScoreColor(sat.auditScore)}>{Math.round(sat.auditScore * 100)}%</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Uptime</span>
                    <div className={getScoreColor(sat.uptimeScore)}>{Math.round(sat.uptimeScore * 100)}%</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{formatBytes(sat.storageUsed)}</div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <span className="text-gray-500">{data.satellites.length} satellites</span>
          <span className="text-gray-400">
            Avg: {Math.round(data.summary.avgAuditScore * 100)}% audit / {Math.round(data.summary.avgUptimeScore * 100)}% uptime
          </span>
        </div>
        <div className="space-y-1">
          {data.satellites.map((sat) => (
            <div
              key={sat.id}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                sat.disqualified ? 'bg-red-900/20 border border-red-500/30' :
                sat.suspended ? 'bg-yellow-900/20 border border-yellow-500/30' :
                'bg-gray-800'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{sat.name}</span>
                  {sat.disqualified && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">Disqualified</span>
                  )}
                  {sat.suspended && (
                    <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">Suspended</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{formatBytes(sat.storageUsed)} stored</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-center">
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${getScoreBgColor(sat.auditScore)}`} />
                    <span className={`text-xs ${getScoreColor(sat.auditScore)}`}>
                      {Math.round(sat.auditScore * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">audit</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${getScoreBgColor(sat.uptimeScore)}`} />
                    <span className={`text-xs ${getScoreColor(sat.uptimeScore)}`}>
                      {Math.round(sat.uptimeScore * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">uptime</div>
                </div>
              </div>
            </div>
          ))}
          {data.satellites.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No satellites connected</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
