import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { KasaDevice, KasaDeviceType } from '../../../types';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon, IconType } from '../../../utils/icons';

interface DeviceListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DevicesData {
  devices: KasaDevice[];
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

function getDeviceTypeName(type: KasaDeviceType): string {
  switch (type) {
    case 'plug':
      return 'Smart Plug';
    case 'plug_energy':
      return 'Energy Plug';
    case 'bulb':
      return 'Smart Bulb';
    case 'bulb_dimmable':
      return 'Dimmable Bulb';
    case 'bulb_tunable':
      return 'Tunable Bulb';
    case 'bulb_color':
      return 'Color Bulb';
    case 'switch':
      return 'Smart Switch';
    case 'dimmer':
      return 'Dimmer';
    case 'power_strip':
      return 'Power Strip';
    default:
      return 'Device';
  }
}

export function DeviceList({ integrationId, config, widgetId }: DeviceListProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<DevicesData>({
    integrationId,
    metric: (config.metric as string) || 'devices',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const deviceTypeFilter = config.deviceType as string;
  const statusFilter = config.statusFilter as string;

  // Filter devices
  const filteredDevices = data?.devices.filter(device => {
    if (deviceTypeFilter && device.deviceType !== deviceTypeFilter) {
      return false;
    }
    if (statusFilter === 'on' && !device.isOn) {
      return false;
    }
    if (statusFilter === 'off' && device.isOn) {
      return false;
    }
    return true;
  }) || [];

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`${compactView ? 'space-y-1' : 'space-y-2'}`}>
          {filteredDevices.map(device => (
            <div
              key={device.deviceId}
              className={`flex items-center justify-between ${
                compactView ? 'py-1' : 'p-2 bg-gray-50 dark:bg-gray-800 rounded-lg'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-shrink-0">{getIcon(getDeviceIconType(device.deviceType), iconStyle, 'w-5 h-5')}</span>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {device.alias}
                  </div>
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {device.model} - {getDeviceTypeName(device.deviceType)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {device.hasEnergyMonitoring && !hideLabels && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                    Energy
                  </span>
                )}
                <div
                  className={`w-3 h-3 rounded-full ${
                    device.isOn
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  title={device.isOn ? 'On' : 'Off'}
                />
              </div>
            </div>
          ))}
          {filteredDevices.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.devices.length === 0 ? 'No devices found' : 'No devices match filter'}
            </p>
          )}
          {!hideLabels && filteredDevices.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              {filteredDevices.filter(d => d.isOn).length} on / {filteredDevices.length} total
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
