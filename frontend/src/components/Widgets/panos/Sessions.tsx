import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface SessionsData {
  stats: {
    activeSessions: number;
    maxSessions: number;
    utilizationPercent: number;
    tcpSessions: number;
    udpSessions: number;
    icmpSessions: number;
  };
  throughput: {
    kbps: number;
    pps: number;
  };
}

interface SessionsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getUtilizationColor(percent: number): string {
  if (percent >= 90) return 'text-red-500';
  if (percent >= 75) return 'text-yellow-500';
  return 'text-green-500';
}

function getUtilizationBgColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function Sessions({ integrationId, config, widgetId }: SessionsWidgetProps) {
  const { data, loading, error } = useWidgetData<SessionsData>({
    integrationId,
    metric: 'sessions',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'gauge';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-sm">Loading sessions...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col p-2">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-2 bg-gray-800 rounded-lg text-center">
              <div className="text-lg font-bold text-blue-400">{formatNumber(data.stats.tcpSessions)}</div>
              <div className="text-xs text-gray-500">TCP</div>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg text-center">
              <div className="text-lg font-bold text-green-400">{formatNumber(data.stats.udpSessions)}</div>
              <div className="text-xs text-gray-500">UDP</div>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg text-center">
              <div className="text-lg font-bold text-purple-400">{formatNumber(data.stats.icmpSessions)}</div>
              <div className="text-xs text-gray-500">ICMP</div>
            </div>
          </div>

          <div className="p-2 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Session Utilization</span>
              <span className={`text-xs font-medium ${getUtilizationColor(data.stats.utilizationPercent)}`}>
                {data.stats.utilizationPercent}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getUtilizationBgColor(data.stats.utilizationPercent)}`}
                style={{ width: `${data.stats.utilizationPercent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatNumber(data.stats.activeSessions)} / {formatNumber(data.stats.maxSessions)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="p-2 bg-gray-800 rounded-lg text-center">
              <div className="text-sm font-bold text-white">{formatNumber(data.throughput.kbps)}</div>
              <div className="text-xs text-gray-500">Kbps</div>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg text-center">
              <div className="text-sm font-bold text-white">{formatNumber(data.throughput.pps)}</div>
              <div className="text-xs text-gray-500">PPS</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default gauge view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="relative w-32 h-32 mb-4">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-gray-700"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(data.stats.utilizationPercent / 100) * 352} 352`}
              className={getUtilizationColor(data.stats.utilizationPercent)}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-3xl font-bold ${getUtilizationColor(data.stats.utilizationPercent)}`}>
              {data.stats.utilizationPercent}%
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-white">{formatNumber(data.stats.activeSessions)}</div>
          <div className="text-xs text-gray-500">Active Sessions</div>
          <div className="text-xs text-gray-600 mt-1">Max: {formatNumber(data.stats.maxSessions)}</div>
        </div>
      </div>
    </BaseWidget>
  );
}
