import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HomebridgeAccessory } from '../../../types';

interface AccessoriesData {
  accessories: HomebridgeAccessory[];
  insecureMode: boolean;
}

interface AccessoriesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

// Icon mapping for accessory types
function getAccessoryIcon(type: string): React.ReactNode {
  const iconClass = "w-5 h-5";

  switch (type) {
    case 'Switch':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'Lightbulb':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'Outlet':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'Fan':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'Thermostat':
    case 'TemperatureSensor':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'Lock':
    case 'LockMechanism':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case 'GarageDoorOpener':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'MotionSensor':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    case 'ContactSensor':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      );
    case 'HumiditySensor':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      );
    case 'SecuritySystem':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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

function getAccessoryState(accessory: HomebridgeAccessory): { label: string; isOn: boolean } {
  const values = accessory.values || {};

  // Check for On characteristic
  if ('On' in values) {
    return { label: values.On ? 'On' : 'Off', isOn: Boolean(values.On) };
  }

  // Check for Active characteristic
  if ('Active' in values) {
    return { label: values.Active ? 'Active' : 'Inactive', isOn: Boolean(values.Active) };
  }

  // Check for LockCurrentState (0 = unsecured, 1 = secured)
  if ('LockCurrentState' in values) {
    return { label: values.LockCurrentState === 1 ? 'Locked' : 'Unlocked', isOn: values.LockCurrentState === 1 };
  }

  // Check for ContactSensorState (0 = detected/closed, 1 = not detected/open)
  if ('ContactSensorState' in values) {
    return { label: values.ContactSensorState === 0 ? 'Closed' : 'Open', isOn: values.ContactSensorState === 0 };
  }

  // Check for MotionDetected
  if ('MotionDetected' in values) {
    return { label: values.MotionDetected ? 'Motion' : 'Clear', isOn: Boolean(values.MotionDetected) };
  }

  // Check for CurrentTemperature
  if ('CurrentTemperature' in values) {
    return { label: `${values.CurrentTemperature}°C`, isOn: true };
  }

  // Check for CurrentRelativeHumidity
  if ('CurrentRelativeHumidity' in values) {
    return { label: `${values.CurrentRelativeHumidity}%`, isOn: true };
  }

  return { label: 'Unknown', isOn: false };
}

export function Accessories({ integrationId, config, widgetId }: AccessoriesProps) {
  const { data, loading, error } = useWidgetData<AccessoriesData>({
    integrationId,
    metric: 'accessories',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const accessoryType = config.accessoryType as string | undefined;
  const showManufacturer = config.showManufacturer !== false;
  const showModel = config.showModel !== false;
  const showBridgeName = config.showBridgeName === true;
  const compactView = config.compactView === true || visualization === 'compact';

  // Filter accessories by type
  let accessories = data?.accessories || [];
  if (accessoryType) {
    if (accessoryType === 'Sensor') {
      accessories = accessories.filter(a =>
        a.type.includes('Sensor') ||
        a.humanType?.toLowerCase().includes('sensor')
      );
    } else {
      accessories = accessories.filter(a =>
        a.type === accessoryType ||
        a.humanType === accessoryType
      );
    }
  }

  // Insecure mode not enabled
  if (data && !data.insecureMode) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2 py-4">
          <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm font-medium">Insecure Mode Required</span>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-[200px]">
            Start Homebridge with the -I flag to enable accessory control
          </p>
        </div>
      </BaseWidget>
    );
  }

  // No accessories
  if (accessories.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span className="text-sm">No accessories found</span>
        </div>
      </BaseWidget>
    );
  }

  // List visualization
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {accessories.map((accessory) => {
            const state = getAccessoryState(accessory);
            return (
              <div
                key={accessory.uniqueId}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-1 rounded ${state.isOn ? 'bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                    {getAccessoryIcon(accessory.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {accessory.serviceName || accessory.accessoryInformation?.Name || 'Unknown'}
                    </p>
                    {!hideLabels && showManufacturer && accessory.accessoryInformation?.Manufacturer && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {accessory.accessoryInformation.Manufacturer}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ${state.isOn ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {state.label}
                </span>
              </div>
            );
          })}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {accessories.map((accessory) => {
            const state = getAccessoryState(accessory);
            return (
              <div key={accessory.uniqueId} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${state.isOn ? 'bg-blue-500' : 'bg-gray-400'}`} />
                <span className="flex-1 truncate text-gray-200">
                  {accessory.serviceName || accessory.accessoryInformation?.Name || 'Unknown'}
                </span>
                <span className={`flex-shrink-0 text-xs ${state.isOn ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                  {state.label}
                </span>
              </div>
            );
          })}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className={`grid gap-2 ${compactView ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {accessories.map((accessory) => {
          const state = getAccessoryState(accessory);

          return (
            <div
              key={accessory.uniqueId}
              className={`rounded-lg p-2 transition-colors ${
                state.isOn
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`p-1.5 rounded-lg ${
                  state.isOn
                    ? 'bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                }`}>
                  {getAccessoryIcon(accessory.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {accessory.serviceName || accessory.accessoryInformation?.Name || 'Unknown'}
                  </p>
                  <p className={`text-xs ${
                    state.isOn ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {state.label}
                  </p>
                  {!compactView && (
                    <>
                      {showManufacturer && accessory.accessoryInformation?.Manufacturer && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {accessory.accessoryInformation.Manufacturer}
                        </p>
                      )}
                      {showModel && accessory.accessoryInformation?.Model && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {accessory.accessoryInformation.Model}
                        </p>
                      )}
                      {showBridgeName && accessory.instance?.name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {accessory.instance.name}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </BaseWidget>
  );
}
