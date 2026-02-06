import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface TopSession {
  source: string;
  destination: string;
  service: string;
  bytes: number;
  packets: number;
  duration: number;
}

interface SessionsData {
  stats: {
    current: number;
    max: number;
    utilizationPercent: number;
    rate: number;
  };
  topSessions: TopSession[];
}

interface SessionsWidgetProps {
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

export function FortiGateSessions({ integrationId, config, widgetId }: SessionsWidgetProps) {
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
          <p className="text-sm">Loading sessions...</p>
        </div>
      </BaseWidget>
    );
  }

  const { stats } = data;
  const utilizationColor =
    stats.utilizationPercent > 80
      ? 'text-red-500'
      : stats.utilizationPercent > 60
      ? 'text-yellow-500'
      : 'text-green-500';

  if (visualization === 'gauge') {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (stats.utilizationPercent / 100) * circumference;

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                className="text-gray-700"
              />
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={utilizationColor}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${utilizationColor}`}>
                {stats.utilizationPercent}%
              </span>
              <span className="text-xs text-gray-500">utilized</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-lg font-semibold text-white">
              {stats.current.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">
              of {stats.max.toLocaleString()} max
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'top') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-3 overflow-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-white">Top Sessions</h3>
            <span className="text-xs text-gray-400">
              {stats.current.toLocaleString()} active
            </span>
          </div>

          {data.topSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No session data available
            </div>
          ) : (
            <div className="space-y-2">
              {data.topSessions.map((session, index) => (
                <div key={index} className="bg-gray-700/30 rounded-lg p-2">
                  <div className="flex justify-between items-start mb-1">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-400 truncate">
                        {session.source} &rarr; {session.destination}
                      </div>
                    </div>
                    <span className="text-xs text-blue-400 flex-shrink-0 ml-2">
                      {formatBytes(session.bytes)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{session.service}</span>
                    <span>{session.packets.toLocaleString()} pkts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default stats visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full p-4 flex flex-col justify-center">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Active Sessions</span>
              <span className="text-white font-medium">
                {stats.current.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  stats.utilizationPercent > 80
                    ? 'bg-red-500'
                    : stats.utilizationPercent > 60
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${stats.utilizationPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <div className="text-xs text-gray-500">Maximum</div>
              <div className="text-lg font-semibold text-white">
                {stats.max.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Utilization</div>
              <div className={`text-lg font-semibold ${utilizationColor}`}>
                {stats.utilizationPercent}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
