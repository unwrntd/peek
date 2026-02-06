import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HomeConnectStatus, HomeConnectApplianceType } from '../../../types';

interface ApplianceStatusData {
  statuses: HomeConnectStatus[];
}

interface ApplianceStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

// Get color for operation state
function getOperationStateColor(state?: string): string {
  if (!state) return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400';

  const stateLower = state.toLowerCase();
  if (stateLower.includes('running') || stateLower.includes('run')) {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
  }
  if (stateLower.includes('finished')) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  }
  if (stateLower.includes('paused')) {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  }
  if (stateLower.includes('error') || stateLower.includes('action')) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  }
  if (stateLower.includes('ready')) {
    return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
  }
  if (stateLower.includes('delayed')) {
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
  }
  return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400';
}

// Icon for door state
function getDoorIcon(state?: 'Open' | 'Closed' | 'Locked'): React.ReactNode {
  const iconClass = "w-4 h-4";
  switch (state) {
    case 'Open':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
        </svg>
      );
    case 'Locked':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
  }
}

// Get appliance type icon
function getTypeIcon(type: HomeConnectApplianceType): React.ReactNode {
  const iconClass = "w-5 h-5";
  switch (type) {
    case 'Washer':
    case 'WasherDryer':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="14" r="4" strokeWidth={2} />
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
        </svg>
      );
    case 'Dishwasher':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <line x1="4" y1="10" x2="20" y2="10" strokeWidth={2} />
        </svg>
      );
    case 'Oven':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <rect x="7" y="10" width="10" height="7" rx="1" strokeWidth={2} />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
        </svg>
      );
  }
}

export function ApplianceStatus({ integrationId, config, widgetId }: ApplianceStatusProps) {
  const { data, loading, error } = useWidgetData<ApplianceStatusData>({
    integrationId,
    metric: 'appliance-status',
    refreshInterval: (config.refreshInterval as number) || 600000, // 10 min default (rate limit consideration)
    widgetId,
  });

  const showDoorState = config.showDoorState !== false;
  const showRemoteControl = config.showRemoteControl !== false;
  const showPowerState = config.showPowerState !== false;
  const connectedOnly = (config.connectedOnly as boolean) || false;
  const applianceTypeFilter = (config.applianceType as string) || '';

  let statuses = data?.statuses || [];

  // Apply filters
  if (connectedOnly) {
    statuses = statuses.filter(s => s.connected);
  }
  if (applianceTypeFilter) {
    statuses = statuses.filter(s => s.type === applianceTypeFilter);
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {statuses.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No appliances found
        </div>
      ) : (
        <div className="space-y-3">
          {statuses.map((status) => (
            <div
              key={status.haId}
              className={`p-3 rounded-lg border ${status.connected ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 opacity-60'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${status.connected ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                  {getTypeIcon(status.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {status.name}
                    </h4>
                    <div className="flex items-center gap-1.5">
                      {!status.connected && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400">
                          Offline
                        </span>
                      )}
                      {status.connected && status.operationState && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getOperationStateColor(status.operationState)}`}>
                          {status.operationState}
                        </span>
                      )}
                    </div>
                  </div>

                  {status.connected && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      {showDoorState && status.doorState && (
                        <div className={`flex items-center gap-1 ${status.doorState === 'Open' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {getDoorIcon(status.doorState)}
                          <span>Door {status.doorState}</span>
                        </div>
                      )}

                      {showPowerState && status.powerState && (
                        <div className={`flex items-center gap-1 ${status.powerState === 'On' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Power {status.powerState}</span>
                        </div>
                      )}

                      {showRemoteControl && (
                        <div className={`flex items-center gap-1 ${status.remoteControlActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span>Remote {status.remoteControlActive ? 'On' : 'Off'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
