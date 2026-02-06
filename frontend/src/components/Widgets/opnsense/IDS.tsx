import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface IDSProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface IDSAlert {
  id: string;
  timestamp: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  signature: string;
  source: string;
  destination: string;
  category: string;
  action: 'alert' | 'drop' | 'reject';
}

interface IDSData {
  alerts: IDSAlert[];
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    dropped: number;
  };
}

export function IDS({ integrationId, config, widgetId }: IDSProps) {
  const { data, loading, error } = useWidgetData<IDSData>({
    integrationId,
    metric: 'ids',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const severityFilter = config.severity as string;
  const maxItems = (config.maxItems as number) || 50;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'list';

  const filteredAlerts = useMemo(() => {
    let alerts = data?.alerts || [];

    if (severityFilter) {
      alerts = alerts.filter(a => a.severity === severityFilter);
    }

    return alerts.slice(0, maxItems);
  }, [data?.alerts, severityFilter, maxItems]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-orange-500';
      case 'low':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'medium':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      case 'low':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  const renderListView = () => (
    <div className="space-y-2">
      {filteredAlerts.map((alert, idx) => (
        <div key={alert.id || idx} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getSeverityBadge(alert.severity)}`}>
                {alert.severity}
              </span>
              {alert.action === 'drop' && (
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                  dropped
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(alert.timestamp)}
            </span>
          </div>
          <div className="text-sm text-gray-900 dark:text-white mb-1 line-clamp-2">
            {alert.signature}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
            <span className="truncate">{alert.source}</span>
            <span>→</span>
            <span className="truncate">{alert.destination}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderChartView = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'high', label: 'High', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
          { key: 'medium', label: 'Medium', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400' },
          { key: 'low', label: 'Low', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400' },
          { key: 'info', label: 'Info', color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
        ].map(item => (
          <div key={item.key} className="text-center">
            <div className={`text-2xl font-bold ${item.textColor}`}>
              {data?.stats[item.key as keyof typeof data.stats] || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {[
          { key: 'high', label: 'High', color: 'bg-red-500' },
          { key: 'medium', label: 'Medium', color: 'bg-orange-500' },
          { key: 'low', label: 'Low', color: 'bg-yellow-500' },
          { key: 'info', label: 'Info', color: 'bg-blue-500' },
        ].map(item => {
          const count = data?.stats[item.key as keyof typeof data.stats] || 0;
          const percentage = data?.stats.total ? (count / data.stats.total) * 100 : 0;
          return (
            <div key={item.key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16">{item.label}</span>
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-300 w-8 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSummaryView = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {data?.stats.total || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Alerts</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            {data?.stats.high || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">High Severity</div>
        </div>
      </div>

      {data?.stats.dropped !== undefined && data.stats.dropped > 0 && (
        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">Threats Blocked</span>
          </div>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">
            {data.stats.dropped}
          </span>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          Recent High Severity
        </div>
        {filteredAlerts.filter(a => a.severity === 'high').slice(0, 3).map((alert, idx) => (
          <div key={alert.id || idx} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
            <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
              {alert.signature}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              {formatTime(alert.timestamp)}
            </span>
          </div>
        ))}
        {filteredAlerts.filter(a => a.severity === 'high').length === 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
            No high severity alerts
          </div>
        )}
      </div>
    </div>
  );

  if (!data?.alerts?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm">No IDS alerts</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your network is secure</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="flex flex-col h-full">
          {!hideLabels && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                IDS/IPS Alerts
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data.stats.total} total
              </span>
            </div>
          )}
          {visualizationType === 'chart' ? renderChartView() :
           visualizationType === 'summary' ? renderSummaryView() : renderListView()}
        </div>
      )}
    </BaseWidget>
  );
}
