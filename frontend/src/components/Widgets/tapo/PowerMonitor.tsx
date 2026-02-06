import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TapoEnergyUsage } from '../../../types';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon } from '../../../utils/icons';

interface PowerMonitorProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface EnergyData {
  devices: TapoEnergyUsage[];
}

function formatPower(watts: number): string {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(2)} kW`;
  }
  return `${watts.toFixed(1)} W`;
}

function formatEnergy(wattHours: number): string {
  if (wattHours >= 1000) {
    return `${(wattHours / 1000).toFixed(2)} kWh`;
  }
  return `${wattHours.toFixed(0)} Wh`;
}

export function PowerMonitor({ integrationId, config, widgetId }: PowerMonitorProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<EnergyData>({
    integrationId,
    metric: (config.metric as string) || 'energy-usage',
    refreshInterval: (config.refreshInterval as number) || 5000, // Faster refresh for real-time power
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const deviceId = config.deviceId as string;
  const singleMetric = config.singleMetric as string;

  // Find the requested device by ID
  const device = deviceId
    ? data?.devices.find(d => d.deviceId === deviceId)
    : data?.devices[0];

  // Show message if no energy data (requires device IPs)
  if (data && data.devices.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center text-center p-2">
          <div className="text-3xl mb-2 text-gray-400">{getIcon('bolt', iconStyle, 'w-8 h-8')}</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No energy data available
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Add device IPs in integration settings
          </p>
        </div>
      </BaseWidget>
    );
  }

  // Determine what to display
  const getValue = (): { value: string; label: string; colorClass: string } => {
    if (!device) {
      return { value: '--', label: 'Power', colorClass: 'text-gray-500' };
    }

    switch (singleMetric) {
      case 'today':
        return {
          value: formatEnergy(device.todayEnergy),
          label: 'Today',
          colorClass: 'text-green-600 dark:text-green-400',
        };
      case 'month':
        return {
          value: formatEnergy(device.monthEnergy),
          label: 'This Month',
          colorClass: 'text-blue-600 dark:text-blue-400',
        };
      case 'power':
      default:
        return {
          value: formatPower(device.currentPower),
          label: 'Power',
          colorClass: 'text-yellow-600 dark:text-yellow-400',
        };
    }
  };

  const { value, label, colorClass } = getValue();

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className={`text-3xl font-bold ${colorClass}`}>
          {value}
        </div>
        {!hideLabels && device && (
          <>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {device.alias}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {label}
            </div>
          </>
        )}
        {!device && data && data.devices.length > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Select a device
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
