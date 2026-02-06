import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { BaseWidget } from '../BaseWidget';
import { BeszelAlert } from '../../../types';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface AlertsListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface AlertsData {
  alerts: BeszelAlert[];
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function AlertsList({ integrationId, config, widgetId }: AlertsListProps) {
  const { data, loading, error } = useWidgetData<AlertsData>({
    integrationId,
    metric: (config.metric as string) || 'alerts',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Get integration config to build URL to Beszel
  const integration = useIntegrationStore(state =>
    state.integrations.find(i => i.id === integrationId)
  );
  const integrationConfig = integration?.config as { host?: string; port?: number; useHttps?: boolean } | undefined;

  // Build the base Beszel URL (alerts open base dashboard)
  const getBeszelUrl = () => {
    if (!integrationConfig?.host) return null;
    const protocol = integrationConfig.useHttps === true ? 'https' : 'http';
    const port = integrationConfig.port || 8090;
    return `${protocol}://${integrationConfig.host}:${port}`;
  };

  // Handler to open Beszel URL
  const handleAlertClick = () => {
    const url = getBeszelUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Configuration options
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const maxItems = (config.maxItems as number) || 20;
  const showTriggeredOnly = config.showTriggeredOnly === true;

  // Apply filters
  const filteredAlerts = data?.alerts.filter(alert => {
    if (showTriggeredOnly && !alert.triggered) return false;

    const search = config.search as string;
    if (search && !matchesAnyFilter([alert.name, alert.system], search)) {
      return false;
    }

    const systemFilter = config.systemFilter as string;
    if (systemFilter && !matchesAnyFilter([alert.system], systemFilter)) {
      return false;
    }

    return true;
  }).slice(0, maxItems) || [];

  const triggeredCount = data?.alerts.filter(a => a.triggered).length || 0;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-2">
          {!hideLabels && triggeredCount > 0 && (
            <div className="flex items-center justify-between px-2 py-1 bg-red-50 dark:bg-red-900/30 rounded-md">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {triggeredCount} active alert{triggeredCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="space-y-1 max-h-80 overflow-y-auto">
            {filteredAlerts.map(alert => {
              const beszelUrl = getBeszelUrl();
              return (
              <div
                key={alert.id}
                className={`flex items-start gap-2 ${compactView ? 'p-1.5' : 'p-2'} ${
                  alert.triggered
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : hideLabels ? '' : 'bg-gray-50 dark:bg-gray-700'
                } rounded-lg ${beszelUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                onClick={beszelUrl ? handleAlertClick : undefined}
                title={beszelUrl ? 'Open Beszel dashboard' : undefined}
              >
                <div className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
                  alert.triggered ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${
                      alert.triggered ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'
                    } truncate`}>
                      {alert.name}
                    </span>
                    {alert.triggered && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 rounded">
                        {alert.value.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {!hideLabels && (
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span>{alert.system}</span>
                      <span>•</span>
                      <span>{formatTime(alert.updated)}</span>
                      {alert.count > 1 && (
                        <>
                          <span>•</span>
                          <span>{alert.count}x</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>

          {filteredAlerts.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              <p>{showTriggeredOnly ? 'No active alerts' : 'No alerts configured'}</p>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
