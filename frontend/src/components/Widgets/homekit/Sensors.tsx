import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface SensorDevice {
  id: string;
  deviceId: string;
  name: string;
  aid: number;
  iid: number;
  type: string;
  typeName: string;
  icon: string;
  value: unknown;
  unit?: string;
  batteryLevel?: number;
  lowBattery?: boolean;
  reachable: boolean;
}

interface SensorsData {
  sensors: SensorDevice[];
  stats: {
    total: number;
    byType: Record<string, number>;
    lowBattery: number;
  };
}

interface SensorsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getSensorIcon(typeName: string): string {
  const name = typeName.toLowerCase();
  if (name.includes('motion')) return '\uD83C\uDFC3';
  if (name.includes('contact')) return '\uD83D\uDEAA';
  if (name.includes('temperature')) return '\uD83C\uDF21\uFE0F';
  if (name.includes('humidity')) return '\uD83D\uDCA7';
  if (name.includes('light')) return '\u2600\uFE0F';
  if (name.includes('leak')) return '\uD83D\uDCA6';
  if (name.includes('smoke')) return '\uD83D\uDCA8';
  if (name.includes('occupancy')) return '\uD83D\uDC64';
  return '\uD83D\uDCE1';
}

function formatSensorValue(sensor: SensorDevice): { text: string; color: string } {
  const type = sensor.typeName.toLowerCase();

  // Boolean sensors
  if (type.includes('motion')) {
    return sensor.value
      ? { text: 'Motion Detected', color: 'text-red-400' }
      : { text: 'No Motion', color: 'text-green-400' };
  }

  if (type.includes('contact')) {
    return sensor.value === 0
      ? { text: 'Closed', color: 'text-green-400' }
      : { text: 'Open', color: 'text-orange-400' };
  }

  if (type.includes('leak')) {
    return sensor.value
      ? { text: 'Leak Detected!', color: 'text-red-500' }
      : { text: 'No Leak', color: 'text-green-400' };
  }

  if (type.includes('smoke')) {
    return sensor.value
      ? { text: 'Smoke Detected!', color: 'text-red-500' }
      : { text: 'Clear', color: 'text-green-400' };
  }

  if (type.includes('occupancy')) {
    return sensor.value
      ? { text: 'Occupied', color: 'text-blue-400' }
      : { text: 'Unoccupied', color: 'text-gray-400' };
  }

  // Numeric sensors
  if (type.includes('temperature')) {
    const temp = sensor.value as number;
    return {
      text: `${temp.toFixed(1)}${sensor.unit || '°C'}`,
      color: temp > 25 ? 'text-orange-400' : temp < 18 ? 'text-blue-400' : 'text-green-400',
    };
  }

  if (type.includes('humidity')) {
    const humidity = sensor.value as number;
    return {
      text: `${humidity.toFixed(0)}%`,
      color: humidity > 70 ? 'text-blue-400' : humidity < 30 ? 'text-orange-400' : 'text-green-400',
    };
  }

  if (type.includes('light')) {
    const lux = sensor.value as number;
    return {
      text: `${lux.toFixed(0)} lux`,
      color: lux > 500 ? 'text-yellow-400' : lux < 50 ? 'text-gray-400' : 'text-blue-400',
    };
  }

  // Default
  return {
    text: String(sensor.value),
    color: 'text-gray-400',
  };
}

function getSensorTypeFilter(sensorType: string): (sensor: SensorDevice) => boolean {
  switch (sensorType) {
    case 'motion':
      return (s) => s.typeName.toLowerCase().includes('motion');
    case 'contact':
      return (s) => s.typeName.toLowerCase().includes('contact');
    case 'temperature':
      return (s) => s.typeName.toLowerCase().includes('temperature');
    case 'humidity':
      return (s) => s.typeName.toLowerCase().includes('humidity');
    default:
      return () => true;
  }
}

export function Sensors({ integrationId, config, widgetId }: SensorsWidgetProps) {
  const { data, loading, error } = useWidgetData<SensorsData>({
    integrationId,
    metric: 'sensors',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'grid';
  const sensorTypeFilter = (config.sensorType as string) || '';
  const displayOptions = config.displayOptions as Record<string, boolean> | undefined;
  const showBattery = displayOptions?.showBattery !== false;

  let sensors = data?.sensors || [];

  // Apply filters
  if (sensorTypeFilter) {
    sensors = sensors.filter(getSensorTypeFilter(sensorTypeFilter));
  }

  // Grid visualization (default)
  if (visualization === 'grid') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {/* Stats header */}
          {data?.stats && (
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
              <span>{data.stats.total} sensors</span>
              {data.stats.lowBattery > 0 && (
                <span className="text-orange-400">\uD83D\uDD0B {data.stats.lowBattery} low battery</span>
              )}
            </div>
          )}

          {sensors.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No sensors found
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sensors.map((sensor) => {
                const valueDisplay = formatSensorValue(sensor);
                return (
                  <div
                    key={sensor.id}
                    className={`bg-gray-800/50 rounded-lg p-3 hover:bg-gray-700/50 transition-colors ${
                      !sensor.reachable ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getSensorIcon(sensor.typeName)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate">{sensor.name}</div>
                        <div className="text-xs text-gray-500">{sensor.typeName}</div>
                      </div>
                    </div>

                    <div className={`text-lg font-medium ${valueDisplay.color}`}>
                      {valueDisplay.text}
                    </div>

                    {showBattery && sensor.batteryLevel !== undefined && (
                      <div className={`text-xs mt-1 ${sensor.lowBattery ? 'text-orange-400' : 'text-gray-500'}`}>
                        \uD83D\uDD0B {sensor.batteryLevel}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // List visualization
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          {/* Stats header */}
          {data?.stats && (
            <div className="flex items-center gap-4 px-3 py-2 border-b border-gray-700 text-xs text-gray-400">
              <span>{data.stats.total} sensors</span>
              {data.stats.lowBattery > 0 && (
                <span className="text-orange-400">{data.stats.lowBattery} low battery</span>
              )}
            </div>
          )}

          {sensors.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No sensors found
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {sensors.map((sensor) => {
                const valueDisplay = formatSensorValue(sensor);
                return (
                  <div
                    key={sensor.id}
                    className={`p-3 hover:bg-gray-800/50 transition-colors flex items-center gap-3 ${
                      !sensor.reachable ? 'opacity-50' : ''
                    }`}
                  >
                    <span className="text-2xl">{getSensorIcon(sensor.typeName)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{sensor.name}</div>
                      <div className="text-xs text-gray-500">{sensor.typeName}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${valueDisplay.color}`}>
                        {valueDisplay.text}
                      </div>
                      {showBattery && sensor.batteryLevel !== undefined && (
                        <div className={`text-xs ${sensor.lowBattery ? 'text-orange-400' : 'text-gray-500'}`}>
                          \uD83D\uDD0B {sensor.batteryLevel}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Status visualization (icon-heavy)
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto p-2">
        {sensors.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No sensors found
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sensors.map((sensor) => {
              const valueDisplay = formatSensorValue(sensor);
              // For boolean sensors, show alert state
              const isTriggered = sensor.typeName.toLowerCase().includes('motion') && sensor.value ||
                                 sensor.typeName.toLowerCase().includes('contact') && sensor.value !== 0 ||
                                 sensor.typeName.toLowerCase().includes('leak') && sensor.value ||
                                 sensor.typeName.toLowerCase().includes('smoke') && sensor.value;

              return (
                <div
                  key={sensor.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm ${
                    isTriggered ? 'bg-red-900/30 border border-red-500/30' : 'bg-gray-800/50'
                  } ${!sensor.reachable ? 'opacity-50' : ''}`}
                  title={`${sensor.name}: ${valueDisplay.text}`}
                >
                  <span>{getSensorIcon(sensor.typeName)}</span>
                  <span className={`font-medium ${valueDisplay.color}`}>
                    {valueDisplay.text}
                  </span>
                  {showBattery && sensor.lowBattery && (
                    <span className="text-orange-400 text-xs">\uD83D\uDD0B</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
