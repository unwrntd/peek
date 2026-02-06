import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { KasaEnergyUsage } from '../../../types';
import { useBrandingStore } from '../../../stores/brandingStore';
import { getIcon } from '../../../utils/icons';

interface EnergyOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface EnergyData {
  devices: KasaEnergyUsage[];
}

function formatPower(watts: number): string {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(2)} kW`;
  }
  return `${watts.toFixed(1)} W`;
}

function formatEnergy(kwh: number): string {
  if (kwh >= 1000) {
    return `${(kwh / 1000).toFixed(2)} MWh`;
  }
  return `${kwh.toFixed(2)} kWh`;
}

function formatVoltage(volts: number): string {
  return `${volts.toFixed(1)} V`;
}

function formatCurrent(amps: number): string {
  return `${amps.toFixed(2)} A`;
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
  const showVoltage = config.showVoltage !== false;
  const showCurrent = config.showCurrent !== false;
  const showTodayEnergy = config.showTodayEnergy !== false;
  const showMonthEnergy = config.showMonthEnergy !== false;
  const showTotalEnergy = config.showTotalEnergy !== false;

  // Calculate totals
  const totals = data?.devices.reduce(
    (acc, device) => ({
      currentPower: acc.currentPower + device.currentPower,
      voltage: device.voltage, // Voltage is the same for all devices on same circuit
      current: acc.current + device.current,
      todayEnergy: acc.todayEnergy + device.todayEnergy,
      monthEnergy: acc.monthEnergy + device.monthEnergy,
      totalEnergy: acc.totalEnergy + device.totalEnergy,
    }),
    { currentPower: 0, voltage: 0, current: 0, todayEnergy: 0, monthEnergy: 0, totalEnergy: 0 }
  ) || { currentPower: 0, voltage: 0, current: 0, todayEnergy: 0, monthEnergy: 0, totalEnergy: 0 };

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
            {showVoltage && totals.voltage > 0 && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Voltage</div>
                )}
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {formatVoltage(totals.voltage)}
                </div>
              </div>
            )}
            {showCurrent && totals.current > 0 && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Current</div>
                )}
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrent(totals.current)}
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
            {showTotalEnergy && totals.totalEnergy > 0 && (
              <div className={hideLabels ? 'text-center' : ''}>
                {!hideLabels && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                )}
                <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                  {formatEnergy(totals.totalEnergy)}
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
                Requires devices with energy monitoring (HS110, KP115, etc.)
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
