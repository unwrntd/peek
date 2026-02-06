import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TapoSensor, TapoSensorType } from '../../../types';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon } from '../../../utils/icons';

interface SensorListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SensorsData {
  sensors: TapoSensor[];
}

function formatTemperature(temp: number | undefined, unit: 'celsius' | 'fahrenheit' | undefined): string {
  if (temp === undefined) return '--';
  const symbol = unit === 'fahrenheit' ? 'F' : 'C';
  return `${temp.toFixed(1)}°${symbol}`;
}

function formatHumidity(humidity: number | undefined): string {
  if (humidity === undefined) return '--';
  return `${humidity}%`;
}

function formatBattery(percentage: number | undefined): string {
  if (percentage === undefined) return '--';
  return `${percentage}%`;
}

function getBatteryIconType(percentage: number | undefined): 'battery' | 'batteryLow' {
  if (percentage === undefined) return 'battery';
  if (percentage <= 10) return 'batteryLow';
  return 'battery';
}

function getBatteryColor(percentage: number | undefined): string {
  if (percentage === undefined) return 'text-gray-400';
  if (percentage <= 10) return 'text-red-500';
  if (percentage <= 25) return 'text-yellow-500';
  return 'text-green-500';
}

function getSensorIconType(sensorType: TapoSensorType): 'temperature' | 'motion' | 'door' | 'water' | 'button' | 'sensor' {
  switch (sensorType) {
    case 'temperature':
      return 'temperature';
    case 'motion':
      return 'motion';
    case 'contact':
      return 'door';
    case 'water_leak':
      return 'water';
    case 'button':
      return 'button';
    default:
      return 'sensor';
  }
}

function formatTimeSince(isoString: string | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function SensorList({ integrationId, config, widgetId }: SensorListProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<SensorsData>({
    integrationId,
    metric: (config.metric as string) || 'sensors',
    refreshInterval: (config.refreshInterval as number) || 60000, // Sensors update less frequently
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showBattery = config.showBattery !== false;
  const showHumidity = config.showHumidity !== false;

  // Sensor type filters (default to showing all types)
  const showTemperature = config.showTemperature !== false;
  const showMotion = config.showMotion !== false;
  const showContact = config.showContact !== false;
  const showWaterLeak = config.showWaterLeak !== false;
  const showButton = config.showButton !== false;

  // Filter sensors based on type settings
  const filteredSensors = data?.sensors.filter(sensor => {
    switch (sensor.sensorType) {
      case 'temperature':
        return showTemperature;
      case 'motion':
        return showMotion;
      case 'contact':
        return showContact;
      case 'water_leak':
        return showWaterLeak;
      case 'button':
        return showButton;
      default:
        return true; // Show unknown types by default
    }
  }) || [];

  // Render sensor-specific data
  const renderSensorData = (sensor: TapoSensor) => {
    switch (sensor.sensorType) {
      case 'temperature':
        return (
          <>
            <div className="text-right">
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {formatTemperature(sensor.temperature, sensor.temperatureUnit)}
              </div>
            </div>
            {showHumidity && sensor.humidity !== undefined && (
              <div className="text-right">
                <div className="text-sm text-cyan-600 dark:text-cyan-400 flex items-center gap-1 justify-end">
                  {getIcon('humidity', iconStyle, 'w-4 h-4')} {formatHumidity(sensor.humidity)}
                </div>
              </div>
            )}
          </>
        );
      case 'motion':
        return (
          <div className="text-right">
            <div className={`text-sm font-medium ${sensor.detected ? 'text-red-500 animate-pulse' : 'text-green-600 dark:text-green-400'} flex items-center gap-1`}>
              {sensor.detected ? <>{getIcon('warning', iconStyle, 'w-4 h-4')} Motion!</> : 'Clear'}
            </div>
            {sensor.lastDetectedTime && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Last: {formatTimeSince(sensor.lastDetectedTime)}
              </div>
            )}
          </div>
        );
      case 'contact':
        return (
          <div className="text-right">
            <div className={`text-sm font-medium ${sensor.isOpen ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
              {sensor.isOpen ? 'Open' : 'Closed'}
            </div>
            {(sensor.lastOpenTime || sensor.lastCloseTime) && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {sensor.isOpen
                  ? `Opened: ${formatTimeSince(sensor.lastOpenTime)}`
                  : `Closed: ${formatTimeSince(sensor.lastCloseTime)}`
                }
              </div>
            )}
          </div>
        );
      case 'water_leak':
        return (
          <div className="text-right">
            <div className={`text-sm font-medium ${sensor.waterDetected ? 'text-red-500' : 'text-green-600 dark:text-green-400'} flex items-center gap-1`}>
              {sensor.waterDetected ? <>{getIcon('warning', iconStyle, 'w-4 h-4')} Leak Detected!</> : 'No Leak'}
            </div>
          </div>
        );
      case 'button':
        return (
          <div className="text-right">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Smart Button
            </div>
          </div>
        );
      default:
        return (
          <div className="text-right">
            <div className="text-sm text-gray-500">
              {sensor.model}
            </div>
          </div>
        );
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {filteredSensors.length > 0 ? (
        <div className={`${compactView ? 'space-y-1' : 'space-y-2'}`}>
          {filteredSensors.map(sensor => (
            <div
              key={sensor.deviceId}
              className={`flex items-center justify-between ${
                compactView ? 'py-1' : 'p-2 bg-gray-50 dark:bg-gray-800 rounded-lg'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-shrink-0">{getIcon(getSensorIconType(sensor.sensorType), iconStyle, 'w-5 h-5')}</span>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {sensor.alias}
                  </div>
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {sensor.model}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {renderSensorData(sensor)}

                {/* Battery */}
                {showBattery && sensor.batteryPercentage !== undefined && (
                  <div className={`text-xs ${getBatteryColor(sensor.batteryPercentage)} flex items-center gap-1`}>
                    {getIcon(getBatteryIconType(sensor.batteryPercentage), iconStyle, 'w-4 h-4')} {formatBattery(sensor.batteryPercentage)}
                  </div>
                )}

                {/* Status indicator */}
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    sensor.status === 'online'
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  title={sensor.status === 'online' ? 'Online' : 'Offline'}
                />
              </div>
            </div>
          ))}
          {!hideLabels && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              {filteredSensors.filter(s => s.status === 'online').length} online / {filteredSensors.length} total
            </div>
          )}
        </div>
      ) : data && data.sensors.length > 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-2">
          <div className="text-3xl mb-2 text-gray-400">{getIcon('search', iconStyle, 'w-8 h-8')}</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No sensors match filters
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Adjust filter settings to show sensors
          </p>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center p-2">
          <div className="text-3xl mb-2 text-gray-400">{getIcon('sensor', iconStyle, 'w-8 h-8')}</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No sensors found
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Add a Tapo Hub (H100/H200) IP to see connected sensors
          </p>
        </div>
      )}
    </BaseWidget>
  );
}
