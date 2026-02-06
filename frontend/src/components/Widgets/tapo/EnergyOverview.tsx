import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TapoEnergyUsage } from '../../../types';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon } from '../../../utils/icons';

interface EnergyOverviewProps {
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

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

export function EnergyOverview({ integrationId, config, widgetId }: EnergyOverviewProps) {
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle) || 'emoji';
  const { data, loading, error } = useWidgetData<EnergyData>({
    integrationId,
    metric: (config.metric as string) || 'energy-usage',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showCurrentPower = config.showCurrentPower !== false;
  const showTodayEnergy = config.showTodayEnergy !== false;
  const showMonthEnergy = config.showMonthEnergy !== false;
  const showRuntime = config.showRuntime !== false;

  // Calculate totals
  const totals = data?.devices.reduce(
    (acc, device) => ({
      currentPower: acc.currentPower + device.currentPower,
      todayEnergy: acc.todayEnergy + device.todayEnergy,
      monthEnergy: acc.monthEnergy + device.monthEnergy,
      todayRuntime: Math.max(acc.todayRuntime, device.todayRuntime),
      monthRuntime: Math.max(acc.monthRuntime, device.monthRuntime),
    }),
    { currentPower: 0, todayEnergy: 0, monthEnergy: 0, todayRuntime: 0, monthRuntime: 0 }
  ) || { currentPower: 0, todayEnergy: 0, monthEnergy: 0, todayRuntime: 0, monthRuntime: 0 };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`${compactView ? 'space-y-2' : 'space-y-3'}`}>
          {/* Summary Stats */}
          <div className={`grid ${hideLabels ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3'} gap-3`}>
            {showCurrentPower && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Current Power</div>
                )}
                <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                  {formatPower(totals.currentPower)}
                </div>
              </div>
            )}
            {showTodayEnergy && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Today</div>
                )}
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatEnergy(totals.todayEnergy)}
                </div>
              </div>
            )}
            {showMonthEnergy && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">This Month</div>
                )}
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {formatEnergy(totals.monthEnergy)}
                </div>
              </div>
            )}
          </div>

          {/* Per-device breakdown */}
          {!hideLabels && data.devices.length > 1 && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Per Device</div>
              <div className="space-y-2">
                {data.devices.map(device => (
                  <div
                    key={device.deviceId}
                    className={`flex items-center justify-between ${
                      compactView ? '' : 'bg-gray-50 dark:bg-gray-800 rounded p-2'
                    }`}
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {device.alias}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      {showCurrentPower && (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          {formatPower(device.currentPower)}
                        </span>
                      )}
                      {showTodayEnergy && (
                        <span className="text-green-600 dark:text-green-400">
                          {formatEnergy(device.todayEnergy)}
                        </span>
                      )}
                      {showRuntime && device.todayRuntime > 0 && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatRuntime(device.todayRuntime)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.devices.length === 0 && (
            <div className="text-center py-4">
              <div className="text-3xl mb-2 text-gray-400">{getIcon('bolt', iconStyle, 'w-8 h-8')}</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No energy data available
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Add device IPs in integration settings for P110/P115 plugs
              </p>
            </div>
          )}

          {!hideLabels && data.devices.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {data.devices.length} device{data.devices.length !== 1 ? 's' : ''} with energy monitoring
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
