import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface EcobeeSensor {
  id: string;
  name: string;
  type: string;
  thermostatId: string;
  thermostatName: string;
  inUse: boolean;
  temperature: number | null;
  humidity: number | null;
  occupancy: boolean | null;
  useCelsius: boolean;
}

interface SensorsData {
  sensors: EcobeeSensor[];
}

interface SensorsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTemperature(temp: number | null, useCelsius: boolean): string {
  if (temp === null) return '--';
  if (useCelsius) {
    const celsius = (temp - 32) * (5 / 9);
    return `${celsius.toFixed(1)}°`;
  }
  return `${temp.toFixed(1)}°`;
}

function getSensorTypeIcon(type: string): JSX.Element {
  if (type === 'thermostat') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  // Remote sensor
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
}

export function Sensors({ integrationId, config, widgetId }: SensorsProps) {
  const { data, loading, error } = useWidgetData<SensorsData>({
    integrationId,
    metric: 'sensors',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const showTemperature = config.showTemperature !== false;
  const showHumidity = config.showHumidity !== false;
  const showOccupancy = config.showOccupancy !== false;
  const showThermostatName = config.showThermostatName !== false;
  const sensorTypeFilter = config.sensorType as string | undefined;
  const selectedThermostatId = config.thermostatId as string | undefined;
  const visualization = (config.visualization as string) || 'cards';

  // Filter sensors
  let sensors = data?.sensors || [];

  if (selectedThermostatId) {
    sensors = sensors.filter(s =>
      s.thermostatId === selectedThermostatId ||
      s.thermostatName.toLowerCase().includes(selectedThermostatId.toLowerCase())
    );
  }

  if (sensorTypeFilter) {
    sensors = sensors.filter(s => s.type === sensorTypeFilter);
  }

  const renderCards = () => (
    <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto">
      {sensors.map((sensor) => (
        <div
          key={sensor.id}
          className={`p-3 rounded-lg ${
            sensor.inUse
              ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
              : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className={sensor.inUse ? 'text-primary-500' : 'text-gray-400'}>
              {getSensorTypeIcon(sensor.type)}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {sensor.name}
            </span>
          </div>

          {/* Temperature */}
          {showTemperature && (
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatTemperature(sensor.temperature, sensor.useCelsius)}
            </div>
          )}

          {/* Humidity and Occupancy */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {showHumidity && sensor.humidity !== null && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
                {sensor.humidity}%
              </span>
            )}
            {showOccupancy && sensor.occupancy !== null && (
              <span className={`flex items-center gap-1 ${sensor.occupancy ? 'text-green-500' : ''}`}>
                <svg className="w-3 h-3" fill={sensor.occupancy ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {sensor.occupancy ? 'Occupied' : 'Empty'}
              </span>
            )}
          </div>

          {/* Thermostat name */}
          {showThermostatName && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {sensor.thermostatName}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="space-y-2 h-full overflow-y-auto">
      {sensors.map((sensor) => (
        <div
          key={sensor.id}
          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={sensor.inUse ? 'text-primary-500' : 'text-gray-400'}>
              {getSensorTypeIcon(sensor.type)}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {sensor.name}
              </div>
              {showThermostatName && (
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {sensor.thermostatName}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            {showTemperature && (
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatTemperature(sensor.temperature, sensor.useCelsius)}
              </span>
            )}
            {showHumidity && sensor.humidity !== null && (
              <span className="text-gray-500 dark:text-gray-400">{sensor.humidity}%</span>
            )}
            {showOccupancy && sensor.occupancy !== null && (
              <span className={`w-2 h-2 rounded-full ${sensor.occupancy ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderGrid = () => (
    <div className="grid grid-cols-3 gap-2 h-full overflow-y-auto">
      {sensors.map((sensor) => (
        <div
          key={sensor.id}
          className={`flex flex-col items-center justify-center p-2 rounded-lg text-center ${
            sensor.inUse
              ? 'bg-primary-50 dark:bg-primary-900/20'
              : 'bg-gray-50 dark:bg-gray-800/50'
          }`}
        >
          {showOccupancy && sensor.occupancy !== null && (
            <span className={`w-2 h-2 rounded-full mb-1 ${sensor.occupancy ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          )}
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatTemperature(sensor.temperature, sensor.useCelsius)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-full">
            {sensor.name}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {sensors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <p className="text-sm">No sensors found</p>
        </div>
      ) : (
        <>
          {visualization === 'cards' && renderCards()}
          {visualization === 'list' && renderList()}
          {visualization === 'grid' && renderGrid()}
        </>
      )}
    </BaseWidget>
  );
}
