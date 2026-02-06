import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProwlarrApplication } from '../../../types';

interface ApplicationData {
  applications: ProwlarrApplication[];
  totalCount: number;
}

interface ApplicationListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getAppIcon(implementationName: string): JSX.Element {
  const iconClass = "w-4 h-4";

  switch (implementationName.toLowerCase()) {
    case 'sonarr':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      );
    case 'radarr':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case 'lidarr':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    case 'readarr':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      );
  }
}

function getAppColor(implementationName: string): string {
  switch (implementationName.toLowerCase()) {
    case 'sonarr':
      return 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400';
    case 'radarr':
      return 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400';
    case 'lidarr':
      return 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400';
    case 'readarr':
      return 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400';
    default:
      return 'bg-gray-100 dark:bg-gray-900/40 text-gray-600 dark:text-gray-400';
  }
}

export function ApplicationList({ integrationId, config, widgetId }: ApplicationListProps) {
  const { data, loading, error } = useWidgetData<ApplicationData>({
    integrationId,
    metric: 'applications',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const displayOptions = (config.displayOptions as Record<string, boolean> | undefined) || {};
  const showSyncLevel = displayOptions.showSyncLevel !== false;
  const showAppType = displayOptions.showAppType !== false;

  const applications = data?.applications || [];

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No application data available
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {!hideLabels && (
            <div className="text-xs text-gray-500 mb-2">{data.totalCount} app{data.totalCount !== 1 ? 's' : ''}</div>
          )}
          {applications.map(app => (
            <div key={app.id} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getAppColor(app.implementationName).includes('blue') ? 'bg-blue-500' : getAppColor(app.implementationName).includes('amber') ? 'bg-amber-500' : getAppColor(app.implementationName).includes('green') ? 'bg-green-500' : getAppColor(app.implementationName).includes('purple') ? 'bg-purple-500' : 'bg-gray-500'}`} />
              <span className="flex-1 truncate text-gray-200">{app.name}</span>
              <span className="text-xs text-gray-500">{app.implementationName}</span>
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="grid grid-cols-2 gap-2">
          {applications.map(app => (
            <div
              key={app.id}
              className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded ${getAppColor(app.implementationName)}`}>
                  {getAppIcon(app.implementationName)}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{app.name}</span>
              </div>
              {!hideLabels && (
                <div className="text-xs text-gray-500">
                  {app.implementationName} • {app.syncLevel === 'fullSync' ? 'Full' : app.syncLevel === 'addOnly' ? 'Add Only' : 'Disabled'}
                </div>
              )}
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Summary */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {data.totalCount} connected application{data.totalCount !== 1 ? 's' : ''}
        </div>

        {/* Application List */}
        <div className="space-y-2">
          {applications.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No applications connected
            </div>
          ) : (
            applications.map(app => (
              <div
                key={app.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
              >
                {/* App Icon */}
                <div className={`p-2 rounded-lg ${getAppColor(app.implementationName)}`}>
                  {getAppIcon(app.implementationName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {app.name}
                  </div>
                  {showAppType && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {app.implementationName}
                    </div>
                  )}
                </div>

                {/* Sync Level */}
                {showSyncLevel && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    app.syncLevel === 'fullSync'
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                      : app.syncLevel === 'addOnly'
                      ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {app.syncLevel === 'fullSync' ? 'Full Sync' : app.syncLevel === 'addOnly' ? 'Add Only' : 'Disabled'}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
