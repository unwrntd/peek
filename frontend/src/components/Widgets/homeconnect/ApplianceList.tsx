import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HomeConnectAppliance, HomeConnectApplianceType } from '../../../types';

interface ApplianceListData {
  appliances: HomeConnectAppliance[];
}

interface ApplianceListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

// Icon mapping for appliance types
function getApplianceIcon(type: HomeConnectApplianceType): React.ReactNode {
  const iconClass = "w-5 h-5";
  switch (type) {
    case 'Washer':
    case 'WasherDryer':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="14" r="4" strokeWidth={2} />
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <circle cx="8" cy="8" r="1" fill="currentColor" />
        </svg>
      );
    case 'Dryer':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="14" r="4" strokeWidth={2} />
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14h4" />
        </svg>
      );
    case 'Dishwasher':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <line x1="4" y1="10" x2="20" y2="10" strokeWidth={2} />
          <circle cx="12" cy="15" r="2" strokeWidth={2} />
        </svg>
      );
    case 'Oven':
    case 'Cooktop':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <rect x="7" y="10" width="10" height="7" rx="1" strokeWidth={2} />
          <circle cx="8" cy="7" r="1" fill="currentColor" />
          <circle cx="12" cy="7" r="1" fill="currentColor" />
          <circle cx="16" cy="7" r="1" fill="currentColor" />
        </svg>
      );
    case 'Refrigerator':
    case 'Freezer':
    case 'FridgeFreezer':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth={2} />
          <line x1="5" y1="10" x2="19" y2="10" strokeWidth={2} />
          <line x1="9" y1="6" x2="9" y2="8" strokeWidth={2} />
          <line x1="9" y1="13" x2="9" y2="16" strokeWidth={2} />
        </svg>
      );
    case 'CoffeeMaker':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h1a4 4 0 010 8h-1" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 2v4M10 2v4M14 2v4" />
        </svg>
      );
    case 'Hood':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 12l2-8h12l2 8M4 12v6h16v-6" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6M9 12h6M9 15h4" />
        </svg>
      );
  }
}

export function ApplianceList({ integrationId, config, widgetId }: ApplianceListProps) {
  const { data, loading, error } = useWidgetData<ApplianceListData>({
    integrationId,
    metric: 'appliances',
    refreshInterval: (config.refreshInterval as number) || 600000, // 10 min default (rate limit consideration)
    widgetId,
  });

  const compactView = (config.compactView as boolean) || false;
  const showBrand = config.showBrand !== false;
  const showModel = config.showModel !== false;
  const showConnectionStatus = config.showConnectionStatus !== false;
  const applianceTypeFilter = (config.applianceType as string) || '';
  const connectionStatusFilter = (config.connectionStatus as string) || '';

  let appliances = data?.appliances || [];

  // Apply filters
  if (applianceTypeFilter) {
    appliances = appliances.filter(a => a.type === applianceTypeFilter);
  }
  if (connectionStatusFilter === 'connected') {
    appliances = appliances.filter(a => a.connected);
  } else if (connectionStatusFilter === 'disconnected') {
    appliances = appliances.filter(a => !a.connected);
  }

  if (compactView && appliances.length > 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1">
          {appliances.map((appliance) => (
            <div
              key={appliance.haId}
              className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">
                  {getApplianceIcon(appliance.type)}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {appliance.name}
                </span>
              </div>
              <div className={`w-2 h-2 rounded-full ${appliance.connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {appliances.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No appliances found
        </div>
      ) : (
        <div className="space-y-3">
          {appliances.map((appliance) => (
            <div
              key={appliance.haId}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${appliance.connected ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                  {getApplianceIcon(appliance.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {appliance.name}
                    </h4>
                    {showConnectionStatus && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${appliance.connected ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'}`}>
                        {appliance.connected ? 'Connected' : 'Offline'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                      {appliance.type}
                    </span>
                    {showBrand && appliance.brand && (
                      <span>{appliance.brand}</span>
                    )}
                    {showModel && appliance.vib && (
                      <span className="font-mono">{appliance.vib}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
