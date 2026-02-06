import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface ThreatEvent {
  id: string;
  time: string;
  severity: string;
  type: string;
  name: string;
  sourceIP: string;
  destinationIP: string;
  action: string;
}

interface ThreatType {
  name: string;
  count: number;
  severity: string;
}

interface ThreatsData {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  recent: ThreatEvent[];
  topThreats: ThreatType[];
}

interface ThreatsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-blue-400';
    default:
      return 'text-gray-400';
  }
}

function getSeverityBgColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-red-900/30 text-red-400';
    case 'high':
      return 'bg-orange-900/30 text-orange-400';
    case 'medium':
      return 'bg-yellow-900/30 text-yellow-400';
    case 'low':
      return 'bg-blue-900/30 text-blue-400';
    default:
      return 'bg-gray-900/30 text-gray-400';
  }
}

export function Threats({ integrationId, config, widgetId }: ThreatsWidgetProps) {
  const { data, loading, error } = useWidgetData<ThreatsData>({
    integrationId,
    metric: 'threats',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'summary';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm">Loading threats...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="text-xs text-gray-500 mb-2 px-1">{data.summary.total} threats detected</div>
          <div className="space-y-1">
            {data.recent.map((threat, idx) => (
              <div key={threat.id || idx} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getSeverityColor(threat.severity).replace('text-', 'bg-')}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{threat.name}</div>
                  <div className="text-xs text-gray-500">{threat.sourceIP} → {threat.destinationIP}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${getSeverityBgColor(threat.severity)}`}>
                  {threat.severity}
                </span>
              </div>
            ))}
            {data.recent.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">No recent threats</p>
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'chart') {
    const maxCount = Math.max(
      data.summary.critical,
      data.summary.high,
      data.summary.medium,
      data.summary.low,
      data.summary.informational,
      1
    );

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          <div className="text-xs text-gray-500 mb-3">{data.summary.total} total threats</div>
          <div className="space-y-2">
            {[
              { label: 'Critical', value: data.summary.critical, color: 'bg-red-500' },
              { label: 'High', value: data.summary.high, color: 'bg-orange-500' },
              { label: 'Medium', value: data.summary.medium, color: 'bg-yellow-500' },
              { label: 'Low', value: data.summary.low, color: 'bg-blue-400' },
              { label: 'Info', value: data.summary.informational, color: 'bg-gray-400' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{item.label}</span>
                  <span className="text-xs text-white">{item.value}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${item.color}`}
                    style={{ width: `${(item.value / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default summary view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col p-2">
        <div className="grid grid-cols-5 gap-2 mb-4">
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-lg font-bold text-red-500">{data.summary.critical}</div>
            <div className="text-xs text-gray-500">Critical</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-lg font-bold text-orange-500">{data.summary.high}</div>
            <div className="text-xs text-gray-500">High</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-lg font-bold text-yellow-500">{data.summary.medium}</div>
            <div className="text-xs text-gray-500">Medium</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-lg font-bold text-blue-400">{data.summary.low}</div>
            <div className="text-xs text-gray-500">Low</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-lg font-bold text-gray-400">{data.summary.informational}</div>
            <div className="text-xs text-gray-500">Info</div>
          </div>
        </div>

        {data.topThreats.length > 0 && (
          <div className="flex-1 overflow-auto">
            <div className="text-xs text-gray-500 mb-2">Top Threats</div>
            <div className="space-y-1">
              {data.topThreats.slice(0, 5).map((threat, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getSeverityColor(threat.severity).replace('text-', 'bg-')}`} />
                  <span className="text-xs text-white truncate flex-1">{threat.name}</span>
                  <span className="text-xs text-gray-400">{threat.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
