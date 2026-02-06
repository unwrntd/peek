import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface EnvironmentStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface EnvironmentSensor {
  name: string;
  type: 'temperature' | 'fan' | 'power';
  value: number;
  unit: string;
  status: 'ok' | 'warning' | 'critical';
}

interface EnvironmentData {
  sensors: EnvironmentSensor[];
}

export function EnvironmentStatus({ integrationId, config, widgetId }: EnvironmentStatusProps) {
  const { data, loading, error } = useWidgetData<EnvironmentData>({
    integrationId,
    metric: (config.metric as string) || 'environment',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const sensorType = (config.sensorType as string) || '';
  const showTemperature = config.showTemperature !== false;
  const showFans = config.showFans !== false;
  const showPower = config.showPower !== false;

  const filteredSensors = useMemo(() => {
    if (!data?.sensors) return [];

    let sensors = data.sensors;

    if (sensorType) {
      sensors = sensors.filter(s => s.type === sensorType);
    } else {
      sensors = sensors.filter(s => {
        if (s.type === 'temperature') return showTemperature;
        if (s.type === 'fan') return showFans;
        if (s.type === 'power') return showPower;
        return true;
      });
    }

    return sensors;
  }, [data?.sensors, sensorType, showTemperature, showFans, showPower]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'critical':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'temperature':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'fan':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'power':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const groupedSensors = useMemo(() => {
    const groups: Record<string, EnvironmentSensor[]> = {
      temperature: [],
      fan: [],
      power: [],
    };

    filteredSensors.forEach(sensor => {
      if (groups[sensor.type]) {
        groups[sensor.type].push(sensor);
      }
    });

    return groups;
  }, [filteredSensors]);

  const renderSensorGroup = (type: string, sensors: EnvironmentSensor[]) => {
    if (sensors.length === 0) return null;

    const title = type.charAt(0).toUpperCase() + type.slice(1);

    return (
      <div key={type} className="space-y-2">
        {!hideLabels && (
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <span className="text-gray-500 dark:text-gray-400">{getTypeIcon(type)}</span>
            {title}
          </div>
        )}
        <div className={`grid gap-2 ${compactView ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {sensors.map((sensor, index) => (
            <div
              key={`${sensor.name}-${index}`}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded"
            >
              <div className="flex items-center gap-2 min-w-0">
                {getStatusIcon(sensor.status)}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {sensor.name}
                </span>
              </div>
              <span className={`text-sm font-medium ml-2 ${
                sensor.status === 'critical' ? 'text-red-600 dark:text-red-400' :
                sensor.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-gray-900 dark:text-white'
              }`}>
                {sensor.value}{sensor.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`${compactView ? 'p-2' : 'p-3'} space-y-4 overflow-auto h-full`}>
          {sensorType ? (
            <div className={`grid gap-2 ${compactView ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {filteredSensors.map((sensor, index) => (
                <div
                  key={`${sensor.name}-${index}`}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(sensor.status)}
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {sensor.name}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ml-2 ${
                    sensor.status === 'critical' ? 'text-red-600 dark:text-red-400' :
                    sensor.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-gray-900 dark:text-white'
                  }`}>
                    {sensor.value}{sensor.unit}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {showTemperature && renderSensorGroup('temperature', groupedSensors.temperature)}
              {showFans && renderSensorGroup('fan', groupedSensors.fan)}
              {showPower && renderSensorGroup('power', groupedSensors.power)}
            </>
          )}
          {filteredSensors.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No sensors found
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
