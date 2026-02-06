import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { KasaDeviceInfo, KasaDeviceType } from '../../../types';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon, IconType } from '../../../utils/icons';
import { formatDuration } from '../../../utils/formatting';

interface DeviceStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DeviceInfoData {
  devices: KasaDeviceInfo[];
}

function getDeviceIconType(type: KasaDeviceType): IconType {
  switch (type) {
    case 'plug':
    case 'plug_energy':
      return 'plug';
    case 'bulb':
    case 'bulb_dimmable':
    case 'bulb_tunable':
    case 'bulb_color':
      return 'lightBulb';
    case 'switch':
    case 'dimmer':
      return 'switch';
    case 'power_strip':
      return 'plug';
    default:
      return 'device';
  }
}

function getSignalStrength(level: number): { label: string; color: string } {
  if (level >= -50) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400' };
  if (level >= -60) return { label: 'Good', color: 'text-green-600 dark:text-green-400' };
  if (level >= -70) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Poor', color: 'text-red-600 dark:text-red-400' };
}

export function DeviceStatus({ integrationId, config, widgetId }: DeviceStatusProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<DeviceInfoData>({
    integrationId,
    metric: (config.metric as string) || 'device-info',
    refreshInterval: (config.refreshInterval as number) || 15000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const deviceId = config.deviceId as string;
  const showSignal = config.showSignal !== false;
  const showUptime = config.showUptime !== false;

  // Find the requested device by ID first, then fallback to first device
  const device = deviceId
    ? data?.devices.find(d => d.deviceId === deviceId)
    : data?.devices[0];

  // Show message if no devices found
  if (data && data.devices.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400">No devices found</p>
        </div>
      </BaseWidget>
    );
  }

  // Show message if device not selected
  if (data && !device && deviceId) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400">Device not found</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {device && (
        <div className="h-full flex flex-col items-center justify-center text-center p-2">
          <div className={`text-4xl mb-2 ${device.isOn ? '' : 'opacity-40'}`}>
            {getIcon(getDeviceIconType(device.deviceType), iconStyle, 'w-10 h-10')}
          </div>
          {!hideLabels && (
            <div className="font-medium text-gray-900 dark:text-white mb-1">
              {device.alias}
            </div>
          )}
          <div
            className={`text-lg font-bold ${
              device.isOn
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {device.isOn ? 'ON' : 'OFF'}
          </div>
          {!hideLabels && (
            <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              {device.isOn && showUptime && device.onTime && device.onTime > 0 && (
                <div>On for: {formatDuration(device.onTime)}</div>
              )}
              {showSignal && device.rssi && device.rssi !== 0 && (
                <div className={getSignalStrength(device.rssi).color}>
                  Signal: {getSignalStrength(device.rssi).label}
                </div>
              )}
              {device.brightness !== undefined && (
                <div>Brightness: {device.brightness}%</div>
              )}
              {device.colorTemp !== undefined && device.colorTemp > 0 && (
                <div>Color Temp: {device.colorTemp}K</div>
              )}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
