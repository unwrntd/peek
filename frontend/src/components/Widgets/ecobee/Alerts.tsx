import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface EcobeeAlert {
  id: string;
  thermostatId: string;
  thermostatName: string;
  type: 'alert' | 'reminder';
  date: string;
  time?: string;
  severity?: string;
  text: string;
  alertType?: string;
  priority?: string;
}

interface AlertsData {
  alerts: EcobeeAlert[];
}

interface AlertsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getSeverityColor(severity?: string, type?: string): string {
  if (type === 'reminder') return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
  switch (severity?.toLowerCase()) {
    case 'alert':
    case 'high':
      return 'text-red-500 bg-red-50 dark:bg-red-900/20';
    case 'warn':
    case 'medium':
      return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
    case 'low':
    default:
      return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
  }
}

function getAlertIcon(type: 'alert' | 'reminder', alertType?: string): JSX.Element {
  if (type === 'reminder') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  // Alert type icons
  switch (alertType?.toLowerCase()) {
    case 'hvac':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'temphold':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'demandresponse':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
  }
}

function formatDate(dateStr: string, timeStr?: string): string {
  try {
    const date = new Date(`${dateStr}${timeStr ? ` ${timeStr}` : ''}`);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return timeStr ? `Today at ${timeStr.slice(0, 5)}` : 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function Alerts({ integrationId, config, widgetId }: AlertsProps) {
  const [dismissing, setDismissing] = useState<string | null>(null);

  const { data, loading, error, refetch } = useWidgetData<AlertsData>({
    integrationId,
    metric: 'alerts',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const alertTypeFilter = config.alertType as string | undefined;
  const maxItems = parseInt(config.maxItems as string) || 10;
  const visualization = (config.visualization as string) || 'list';

  const handleDismiss = useCallback(async (alert: EcobeeAlert) => {
    if (dismissing) return;
    setDismissing(alert.id);
    try {
      const response = await fetch(`/api/integrations/${integrationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledgeAlert',
          params: { thermostatId: alert.thermostatId, alertRef: alert.id },
        }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 500);
      }
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    } finally {
      setDismissing(null);
    }
  }, [integrationId, dismissing, refetch]);

  // Filter alerts
  let alerts = data?.alerts || [];
  if (alertTypeFilter) {
    alerts = alerts.filter(a => a.type === alertTypeFilter);
  }
  alerts = alerts.slice(0, maxItems);

  const renderList = () => (
    <div className="space-y-2 h-full overflow-y-auto">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-3 rounded-lg ${getSeverityColor(alert.severity, alert.type)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getAlertIcon(alert.type, alert.alertType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {alert.type === 'reminder' ? 'Reminder' : alert.alertType || 'Alert'}
                </span>
                <span className="text-xs opacity-70">
                  {formatDate(alert.date, alert.time)}
                </span>
              </div>
              <p className="text-sm mt-1 opacity-90">{alert.text}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs opacity-60">{alert.thermostatName}</span>
                {alert.type === 'alert' && (
                  <button
                    onClick={() => handleDismiss(alert)}
                    disabled={dismissing === alert.id}
                    className="text-xs px-2 py-1 rounded bg-white/50 dark:bg-gray-800/50 hover:bg-white/75 dark:hover:bg-gray-800/75 transition-colors disabled:opacity-50"
                  >
                    {dismissing === alert.id ? 'Dismissing...' : 'Dismiss'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCards = () => (
    <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-3 rounded-lg ${getSeverityColor(alert.severity, alert.type)}`}
        >
          <div className="flex items-center gap-2 mb-2">
            {getAlertIcon(alert.type, alert.alertType)}
            <span className="text-xs font-medium truncate">
              {alert.type === 'reminder' ? 'Reminder' : alert.alertType || 'Alert'}
            </span>
          </div>
          <p className="text-sm line-clamp-2">{alert.text}</p>
          <div className="flex items-center justify-between mt-2 text-xs opacity-70">
            <span>{formatDate(alert.date, alert.time)}</span>
            {alert.type === 'alert' && (
              <button
                onClick={() => handleDismiss(alert)}
                disabled={dismissing === alert.id}
                className="underline hover:no-underline disabled:opacity-50"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCompact = () => (
    <div className="space-y-1 h-full overflow-y-auto">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          <div className={`flex-shrink-0 ${getSeverityColor(alert.severity, alert.type).split(' ')[0]}`}>
            {React.cloneElement(getAlertIcon(alert.type, alert.alertType), { className: 'w-4 h-4' })}
          </div>
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
            {alert.text}
          </span>
          <span className="text-xs text-gray-400">{formatDate(alert.date, alert.time)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No active alerts</p>
        </div>
      ) : (
        <>
          {visualization === 'list' && renderList()}
          {visualization === 'cards' && renderCards()}
          {visualization === 'compact' && renderCompact()}
        </>
      )}
    </BaseWidget>
  );
}
