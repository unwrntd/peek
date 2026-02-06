import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface ClimateDevice {
  id: string;
  deviceId: string;
  name: string;
  aid: number;
  iid: number;
  type: 'thermostat' | 'sensor' | 'fan';
  currentTemperature?: number;
  targetTemperature?: number;
  currentHumidity?: number;
  heatingCoolingState?: number;
  targetHeatingCoolingState?: number;
  fanActive?: boolean;
  fanSpeed?: number;
  unit: string;
  reachable: boolean;
}

interface ClimateData {
  devices: ClimateDevice[];
  stats: {
    thermostats: number;
    sensors: number;
    fans: number;
  };
}

interface ClimateWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getHeatingCoolingStateName(state?: number): { text: string; color: string; icon: string } {
  switch (state) {
    case 0:
      return { text: 'Off', color: 'text-gray-400', icon: '\u26AA' };
    case 1:
      return { text: 'Heating', color: 'text-orange-400', icon: '\uD83D\uDD25' };
    case 2:
      return { text: 'Cooling', color: 'text-blue-400', icon: '\u2744\uFE0F' };
    default:
      return { text: 'Unknown', color: 'text-gray-500', icon: '\u2753' };
  }
}

function getTargetModeName(mode?: number): string {
  switch (mode) {
    case 0:
      return 'Off';
    case 1:
      return 'Heat';
    case 2:
      return 'Cool';
    case 3:
      return 'Auto';
    default:
      return 'Unknown';
  }
}

function getDeviceIcon(device: ClimateDevice): string {
  switch (device.type) {
    case 'thermostat':
      return '\uD83C\uDF21\uFE0F';
    case 'sensor':
      return '\uD83C\uDF21\uFE0F';
    case 'fan':
      return '\uD83C\uDF2C\uFE0F';
    default:
      return '\uD83C\uDFE0';
  }
}

function formatTemperature(temp?: number, unit?: string): string {
  if (temp === undefined) return '--';
  const formatted = temp.toFixed(1);
  return unit === 'fahrenheit' ? `${formatted}°F` : `${formatted}°C`;
}

export function Climate({ integrationId, config, widgetId }: ClimateWidgetProps) {
  const { data, loading, error } = useWidgetData<ClimateData>({
    integrationId,
    metric: 'climate',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const deviceTypeFilter = (config.deviceType as string) || '';
  const displayOptions = config.displayOptions as Record<string, boolean> | undefined;
  const showTarget = displayOptions?.showTarget !== false;
  const showHumidity = displayOptions?.showHumidity !== false;
  const showMode = displayOptions?.showMode !== false;

  let devices = data?.devices || [];

  // Apply filters
  if (deviceTypeFilter) {
    devices = devices.filter(d => d.type === deviceTypeFilter);
  }

  // Cards visualization (default)
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {/* Stats header */}
          {data?.stats && (
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
              {data.stats.thermostats > 0 && (
                <span>{data.stats.thermostats} thermostat{data.stats.thermostats !== 1 ? 's' : ''}</span>
              )}
              {data.stats.sensors > 0 && (
                <span>{data.stats.sensors} sensor{data.stats.sensors !== 1 ? 's' : ''}</span>
              )}
              {data.stats.fans > 0 && (
                <span>{data.stats.fans} fan{data.stats.fans !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}

          {devices.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No climate devices found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {devices.map((device) => {
                const stateInfo = device.type === 'thermostat'
                  ? getHeatingCoolingStateName(device.heatingCoolingState)
                  : null;

                return (
                  <div
                    key={device.id}
                    className={`bg-gray-800/50 rounded-lg p-4 ${!device.reachable ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getDeviceIcon(device)}</span>
                        <div>
                          <div className="text-white font-medium">{device.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{device.type}</div>
                        </div>
                      </div>
                      {stateInfo && (
                        <span className={`text-xs ${stateInfo.color} flex items-center gap-1`}>
                          {stateInfo.icon} {stateInfo.text}
                        </span>
                      )}
                    </div>

                    {/* Temperature display */}
                    {device.currentTemperature !== undefined && (
                      <div className="text-center mb-3">
                        <div className="text-3xl font-light text-white">
                          {formatTemperature(device.currentTemperature, device.unit)}
                        </div>
                        {showTarget && device.targetTemperature !== undefined && device.type === 'thermostat' && (
                          <div className="text-sm text-gray-400">
                            Target: {formatTemperature(device.targetTemperature, device.unit)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fan display */}
                    {device.type === 'fan' && (
                      <div className="text-center mb-3">
                        <div className={`text-2xl font-medium ${device.fanActive ? 'text-blue-400' : 'text-gray-500'}`}>
                          {device.fanActive ? 'Running' : 'Off'}
                        </div>
                        {device.fanSpeed !== undefined && device.fanActive && (
                          <div className="text-sm text-gray-400">{device.fanSpeed}% speed</div>
                        )}
                      </div>
                    )}

                    {/* Additional info */}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      {showHumidity && device.currentHumidity !== undefined && (
                        <span>\uD83D\uDCA7 {device.currentHumidity.toFixed(0)}%</span>
                      )}
                      {showMode && device.targetHeatingCoolingState !== undefined && (
                        <span>Mode: {getTargetModeName(device.targetHeatingCoolingState)}</span>
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

  // Gauges visualization
  if (visualization === 'gauges') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {devices.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No climate devices found
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {devices.filter(d => d.currentTemperature !== undefined).map((device) => (
                <div key={device.id} className="text-center">
                  <div className="relative w-20 h-20 mx-auto mb-2">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="none"
                        className="text-gray-700"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="none"
                        className="text-blue-400"
                        strokeDasharray={`${((device.currentTemperature || 0) / 40) * 226} 226`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-medium text-white">
                        {device.currentTemperature?.toFixed(0)}°
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-white truncate">{device.name}</div>
                  {showHumidity && device.currentHumidity !== undefined && (
                    <div className="text-xs text-gray-400">\uD83D\uDCA7 {device.currentHumidity.toFixed(0)}%</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="text-xs text-gray-400 mb-2 px-2">
          {devices.length} climate device{devices.length !== 1 ? 's' : ''}
        </div>

        {devices.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No climate devices found
          </div>
        ) : (
          <div className="space-y-1">
            {devices.map((device) => {
              const stateInfo = device.type === 'thermostat'
                ? getHeatingCoolingStateName(device.heatingCoolingState)
                : null;

              return (
                <div
                  key={device.id}
                  className={`px-2 py-1.5 hover:bg-gray-800/50 rounded flex items-center gap-2 ${
                    !device.reachable ? 'opacity-50' : ''
                  }`}
                >
                  <span className="text-lg">{getDeviceIcon(device)}</span>
                  <span className="text-white text-sm truncate flex-1">{device.name}</span>
                  {device.currentTemperature !== undefined && (
                    <span className="text-blue-400 font-medium">
                      {formatTemperature(device.currentTemperature, device.unit)}
                    </span>
                  )}
                  {device.type === 'fan' && (
                    <span className={device.fanActive ? 'text-blue-400' : 'text-gray-500'}>
                      {device.fanActive ? 'On' : 'Off'}
                    </span>
                  )}
                  {stateInfo && (
                    <span className={`text-xs ${stateInfo.color}`}>{stateInfo.icon}</span>
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
