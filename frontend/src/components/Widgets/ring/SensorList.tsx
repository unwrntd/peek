import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RingSensor } from '../../../types';

interface SensorListData {
  sensors: RingSensor[];
  total: number;
  faulted: number;
  lowBattery: number;
}

interface SensorListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getSensorIcon(deviceType: string): React.ReactNode {
  if (deviceType.includes('contact') || deviceType.includes('entry')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    );
  }
  if (deviceType.includes('motion')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  if (deviceType.includes('smoke') || deviceType.includes('co')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  if (deviceType.includes('flood') || deviceType.includes('water')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    );
  }
  if (deviceType.includes('keypad')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  // Default sensor icon
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
}

export function SensorList({ integrationId, config, widgetId }: SensorListProps) {
  const { data, loading, error } = useWidgetData<SensorListData>({
    integrationId,
    metric: 'sensors',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const sensors = data?.sensors || [];
  const sensorType = (config.sensorType as string) || '';
  const showBattery = config.showBattery !== false;
  const showTamper = config.showTamper !== false;
  const showBypass = config.showBypass !== false;

  // Filter sensors
  let filteredSensors = sensors;
  if (sensorType) {
    filteredSensors = sensors.filter(s => s.deviceType.includes(sensorType));
  }

  if (filteredSensors.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span>No sensors found</span>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {filteredSensors.map((sensor) => (
          <div
            key={sensor.id}
            className={`p-2 rounded-lg border ${
              sensor.faulted
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={sensor.faulted ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}>
                {getSensorIcon(sensor.deviceType)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {sensor.name}
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`${
                    sensor.faulted
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {sensor.faulted ? 'Open' : 'Closed'}
                  </span>
                  {showBypass && sensor.bypassed && (
                    <span className="text-orange-500">Bypassed</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showBattery && sensor.batteryLevel !== null && (
                  <div className={`flex items-center gap-1 text-xs ${
                    sensor.batteryLevel < 20 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2zm-1 10H8v-2h8v2zm0-4H8V9h8v2zm4-3h-1V5h-1V3H6v2H5v3H4v6h1v3h1v2h12v-2h1v-3h1V8z" />
                    </svg>
                    <span>{sensor.batteryLevel}%</span>
                  </div>
                )}
                {showTamper && sensor.tamperStatus === 'tamper' && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    Tampered
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{filteredSensors.length} sensors</span>
            <div className="flex items-center gap-3 text-xs">
              {data?.faulted !== undefined && data.faulted > 0 && (
                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  {data.faulted} open
                </span>
              )}
              {data?.lowBattery !== undefined && data.lowBattery > 0 && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2zm-1 10H8v-2h8v2zm0-4H8V9h8v2zm4-3h-1V5h-1V3H6v2H5v3H4v6h1v3h1v2h12v-2h1v-3h1V8z" />
                  </svg>
                  {data.lowBattery} low
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
