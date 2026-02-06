import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TapoSensor } from '../../../types';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon } from '../../../utils/icons';

interface SensorValueProps {
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

function getBatteryColor(percentage: number | undefined): string {
  if (percentage === undefined) return 'text-gray-400';
  if (percentage <= 10) return 'text-red-500';
  if (percentage <= 25) return 'text-yellow-500';
  return 'text-green-500';
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

export function SensorValue({ integrationId, config, widgetId }: SensorValueProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<SensorsData>({
    integrationId,
    metric: 'sensors',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const sensorId = config.sensorId as string;
  const visualization = (config.visualization as string) || 'large';
  const showName = config.showName !== false;
  const showBattery = config.showBattery !== false;
  const showHumidity = config.showHumidity !== false;
  const showStatus = config.showStatus !== false;
  const showLastUpdate = config.showLastUpdate === true;
  const metricSize = (config.metricSize as string) || 'lg';

  // Find the selected sensor
  const sensor = data?.sensors.find(s => s.deviceId === sensorId || s.alias === sensorId);

  // Metric size classes
  const metricSizeClasses: Record<string, string> = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl',
    '2xl': 'text-6xl',
  };
  const valueClass = metricSizeClasses[metricSize] || metricSizeClasses.lg;

  if (!sensorId) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-3xl mb-2">{getIcon('sensor', iconStyle, 'w-8 h-8')}</div>
          <p className="text-sm">No sensor selected</p>
          <p className="text-xs mt-1">Edit widget to select a sensor</p>
        </div>
      </BaseWidget>
    );
  }

  const renderTemperatureSensor = (sensor: TapoSensor) => {
    if (visualization === 'compact') {
      return (
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-2">
            {getIcon('temperature', iconStyle, 'w-5 h-5 text-blue-500')}
            {showName && (
              <span className="text-sm text-gray-600 dark:text-gray-400">{sensor.alias}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-bold text-blue-600 dark:text-blue-400 ${valueClass}`}>
              {formatTemperature(sensor.temperature, sensor.temperatureUnit)}
            </span>
            {showHumidity && sensor.humidity !== undefined && (
              <span className="text-lg text-cyan-600 dark:text-cyan-400">
                {formatHumidity(sensor.humidity)}
              </span>
            )}
          </div>
        </div>
      );
    }

    // Large visualization (default)
    return (
      <div className="h-full flex flex-col items-center justify-center">
        {showName && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            {getIcon('temperature', iconStyle, 'w-4 h-4')} {sensor.alias}
          </div>
        )}
        <div className={`font-bold text-blue-600 dark:text-blue-400 ${valueClass}`}>
          {formatTemperature(sensor.temperature, sensor.temperatureUnit)}
        </div>
        {showHumidity && sensor.humidity !== undefined && (
          <div className="text-xl text-cyan-600 dark:text-cyan-400 flex items-center gap-1 mt-1">
            {getIcon('humidity', iconStyle, 'w-5 h-5')} {formatHumidity(sensor.humidity)}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          {showBattery && sensor.batteryPercentage !== undefined && (
            <span className={getBatteryColor(sensor.batteryPercentage)}>
              {getIcon('battery', iconStyle, 'w-4 h-4 inline')} {formatBattery(sensor.batteryPercentage)}
            </span>
          )}
          {showStatus && (
            <span className={sensor.status === 'online' ? 'text-green-500' : 'text-gray-400'}>
              {sensor.status === 'online' ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderMotionSensor = (sensor: TapoSensor) => {
    const isDetected = sensor.detected;

    if (visualization === 'compact') {
      return (
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-2">
            {getIcon('motion', iconStyle, 'w-5 h-5')}
            {showName && (
              <span className="text-sm text-gray-600 dark:text-gray-400">{sensor.alias}</span>
            )}
          </div>
          <div className={`font-bold ${isDetected ? 'text-red-500 animate-pulse' : 'text-green-600 dark:text-green-400'} ${valueClass}`}>
            {isDetected ? 'Motion!' : 'Clear'}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center">
        {showName && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            {getIcon('motion', iconStyle, 'w-4 h-4')} {sensor.alias}
          </div>
        )}
        <div className={`font-bold ${isDetected ? 'text-red-500 animate-pulse' : 'text-green-600 dark:text-green-400'} ${valueClass}`}>
          {isDetected ? 'Motion!' : 'Clear'}
        </div>
        {showLastUpdate && sensor.lastDetectedTime && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Last: {formatTimeSince(sensor.lastDetectedTime)}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          {showBattery && sensor.batteryPercentage !== undefined && (
            <span className={getBatteryColor(sensor.batteryPercentage)}>
              {getIcon('battery', iconStyle, 'w-4 h-4 inline')} {formatBattery(sensor.batteryPercentage)}
            </span>
          )}
          {showStatus && (
            <span className={sensor.status === 'online' ? 'text-green-500' : 'text-gray-400'}>
              {sensor.status === 'online' ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderContactSensor = (sensor: TapoSensor) => {
    const isOpen = sensor.isOpen;

    if (visualization === 'compact') {
      return (
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-2">
            {getIcon('door', iconStyle, 'w-5 h-5')}
            {showName && (
              <span className="text-sm text-gray-600 dark:text-gray-400">{sensor.alias}</span>
            )}
          </div>
          <div className={`font-bold ${isOpen ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'} ${valueClass}`}>
            {isOpen ? 'Open' : 'Closed'}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center">
        {showName && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            {getIcon('door', iconStyle, 'w-4 h-4')} {sensor.alias}
          </div>
        )}
        <div className={`font-bold ${isOpen ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'} ${valueClass}`}>
          {isOpen ? 'Open' : 'Closed'}
        </div>
        {showLastUpdate && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isOpen && sensor.lastOpenTime
              ? `Opened ${formatTimeSince(sensor.lastOpenTime)}`
              : sensor.lastCloseTime
                ? `Closed ${formatTimeSince(sensor.lastCloseTime)}`
                : ''
            }
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          {showBattery && sensor.batteryPercentage !== undefined && (
            <span className={getBatteryColor(sensor.batteryPercentage)}>
              {getIcon('battery', iconStyle, 'w-4 h-4 inline')} {formatBattery(sensor.batteryPercentage)}
            </span>
          )}
          {showStatus && (
            <span className={sensor.status === 'online' ? 'text-green-500' : 'text-gray-400'}>
              {sensor.status === 'online' ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderWaterLeakSensor = (sensor: TapoSensor) => {
    const isLeak = sensor.waterDetected;

    if (visualization === 'compact') {
      return (
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-2">
            {getIcon('water', iconStyle, 'w-5 h-5')}
            {showName && (
              <span className="text-sm text-gray-600 dark:text-gray-400">{sensor.alias}</span>
            )}
          </div>
          <div className={`font-bold ${isLeak ? 'text-red-500 animate-pulse' : 'text-green-600 dark:text-green-400'} ${valueClass}`}>
            {isLeak ? 'Leak!' : 'Dry'}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center">
        {showName && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            {getIcon('water', iconStyle, 'w-4 h-4')} {sensor.alias}
          </div>
        )}
        <div className={`font-bold ${isLeak ? 'text-red-500 animate-pulse' : 'text-green-600 dark:text-green-400'} ${valueClass}`}>
          {isLeak ? 'Leak Detected!' : 'No Leak'}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          {showBattery && sensor.batteryPercentage !== undefined && (
            <span className={getBatteryColor(sensor.batteryPercentage)}>
              {getIcon('battery', iconStyle, 'w-4 h-4 inline')} {formatBattery(sensor.batteryPercentage)}
            </span>
          )}
          {showStatus && (
            <span className={sensor.status === 'online' ? 'text-green-500' : 'text-gray-400'}>
              {sensor.status === 'online' ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderSensor = (sensor: TapoSensor) => {
    switch (sensor.sensorType) {
      case 'temperature':
        return renderTemperatureSensor(sensor);
      case 'motion':
        return renderMotionSensor(sensor);
      case 'contact':
        return renderContactSensor(sensor);
      case 'water_leak':
        return renderWaterLeakSensor(sensor);
      default:
        return (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <div className="text-3xl mb-2">{getIcon('sensor', iconStyle, 'w-8 h-8')}</div>
            <p className="text-sm">{sensor.alias}</p>
            <p className="text-xs">{sensor.model}</p>
          </div>
        );
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {sensor ? (
        renderSensor(sensor)
      ) : data ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-3xl mb-2">{getIcon('warning', iconStyle, 'w-8 h-8')}</div>
          <p className="text-sm">Sensor not found</p>
          <p className="text-xs mt-1">The selected sensor may be offline</p>
        </div>
      ) : null}
    </BaseWidget>
  );
}
