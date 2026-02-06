import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface HomeKitDevice {
  id: string;
  name: string;
  address: string;
  port: number;
  paired: boolean;
  category: string;
  online: boolean;
  primaryService?: {
    type: string;
    typeName: string;
    state: Record<string, unknown>;
  };
}

interface DevicesData {
  devices: HomeKitDevice[];
}

interface DeviceControlWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getCategoryIcon(category: string): string {
  switch (category.toLowerCase()) {
    case 'lights':
    case 'lightbulb':
      return '\uD83D\uDCA1';
    case 'switches':
    case 'switch':
    case 'outlet':
      return '\uD83D\uDD0C';
    case 'sensors':
    case 'sensor':
      return '\uD83D\uDCE1';
    case 'climate':
    case 'thermostat':
      return '\uD83C\uDF21\uFE0F';
    case 'locks':
    case 'lock':
    case 'door lock':
      return '\uD83D\uDD12';
    case 'doors':
    case 'garage door opener':
      return '\uD83D\uDEAA';
    case 'media':
    case 'television':
      return '\uD83D\uDCFA';
    case 'fan':
      return '\uD83C\uDF2C\uFE0F';
    default:
      return '\uD83C\uDFE0';
  }
}

function getStateDisplay(device: HomeKitDevice): {
  primaryValue: string;
  primaryColor: string;
  secondaryValue?: string;
  canToggle: boolean;
  isOn?: boolean;
} | null {
  if (!device.primaryService?.state) return null;

  const state = device.primaryService.state;

  // Light/Switch - has On state
  if ('On' in state) {
    const isOn = state.On as boolean;
    const brightness = state.Brightness as number | undefined;
    return {
      primaryValue: isOn ? 'On' : 'Off',
      primaryColor: isOn ? 'text-yellow-400' : 'text-gray-500',
      secondaryValue: brightness !== undefined && isOn ? `${brightness}%` : undefined,
      canToggle: true,
      isOn,
    };
  }

  // Thermostat
  if ('CurrentTemperature' in state) {
    const temp = state.CurrentTemperature as number;
    const target = state.TargetTemperature as number | undefined;
    const heatingState = state.CurrentHeatingCoolingState as number | undefined;

    let stateText = '';
    if (heatingState === 1) stateText = ' (Heating)';
    else if (heatingState === 2) stateText = ' (Cooling)';

    return {
      primaryValue: `${temp.toFixed(1)}°`,
      primaryColor: 'text-blue-400',
      secondaryValue: target !== undefined ? `Target: ${target.toFixed(1)}°${stateText}` : undefined,
      canToggle: false,
    };
  }

  // Lock
  if ('LockCurrentState' in state) {
    const lockState = state.LockCurrentState as number;
    const isLocked = lockState === 1;
    return {
      primaryValue: isLocked ? 'Locked' : 'Unlocked',
      primaryColor: isLocked ? 'text-green-400' : 'text-orange-400',
      canToggle: true,
      isOn: isLocked,
    };
  }

  // Motion sensor
  if ('MotionDetected' in state) {
    const motion = state.MotionDetected as boolean;
    return {
      primaryValue: motion ? 'Motion Detected' : 'No Motion',
      primaryColor: motion ? 'text-red-400' : 'text-green-400',
      canToggle: false,
    };
  }

  // Contact sensor
  if ('ContactSensorState' in state) {
    const isOpen = state.ContactSensorState !== 0;
    return {
      primaryValue: isOpen ? 'Open' : 'Closed',
      primaryColor: isOpen ? 'text-orange-400' : 'text-green-400',
      canToggle: false,
    };
  }

  return null;
}

export function DeviceControl({ integrationId, config, widgetId }: DeviceControlWidgetProps) {
  const deviceIdFilter = config.deviceId as string;

  const { data, loading, error } = useWidgetData<DevicesData>({
    integrationId,
    metric: 'devices',
    refreshInterval: (config.refreshInterval as number) || 15000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';

  // Find the specific device
  const device = deviceIdFilter
    ? data?.devices?.find(d => d.id === deviceIdFilter)
    : data?.devices?.[0];

  if (!deviceIdFilter) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">Configure device ID in widget settings</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  const stateDisplay = device ? getStateDisplay(device) : null;

  // Card visualization (default)
  if (visualization === 'card') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          {!device ? (
            <div className="text-gray-500 text-center">
              <p className="text-sm">Device not found</p>
              <p className="text-xs mt-1">{deviceIdFilter}</p>
            </div>
          ) : (
            <>
              <span className={`text-5xl mb-3 ${device.online ? '' : 'opacity-40'}`}>
                {getCategoryIcon(device.category)}
              </span>
              <div className="text-white font-medium text-lg text-center truncate w-full">
                {device.name}
              </div>
              <div className="text-xs text-gray-500 mb-3">{device.category}</div>

              {!device.online ? (
                <div className="text-red-400 text-sm">Offline</div>
              ) : stateDisplay ? (
                <div className="text-center">
                  <div className={`text-2xl font-medium ${stateDisplay.primaryColor}`}>
                    {stateDisplay.primaryValue}
                  </div>
                  {stateDisplay.secondaryValue && (
                    <div className="text-sm text-gray-400 mt-1">
                      {stateDisplay.secondaryValue}
                    </div>
                  )}

                  {stateDisplay.canToggle && (
                    <div className="mt-4">
                      <div
                        className={`w-14 h-8 rounded-full flex items-center px-1 cursor-pointer transition-colors ${
                          stateDisplay.isOn ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                        title="Control not yet implemented"
                      >
                        <div
                          className={`w-6 h-6 rounded-full bg-white transition-transform ${
                            stateDisplay.isOn ? 'translate-x-6' : ''
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">No state available</div>
              )}
            </>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Toggle visualization (minimal)
  if (visualization === 'toggle') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center p-4">
          {!device ? (
            <div className="text-gray-500 text-sm">Device not found</div>
          ) : !device.online ? (
            <div className="text-center">
              <span className="text-3xl opacity-40">{getCategoryIcon(device.category)}</span>
              <div className="text-red-400 text-xs mt-2">Offline</div>
            </div>
          ) : stateDisplay?.canToggle ? (
            <div className="text-center">
              <div
                className={`w-20 h-10 rounded-full flex items-center px-1 cursor-pointer transition-colors mx-auto ${
                  stateDisplay.isOn ? 'bg-green-500' : 'bg-gray-600'
                }`}
                title={device.name}
              >
                <div
                  className={`w-8 h-8 rounded-full bg-white transition-transform shadow-lg ${
                    stateDisplay.isOn ? 'translate-x-10' : ''
                  }`}
                />
              </div>
              <div className="text-white text-sm mt-2 truncate">{device.name}</div>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-3xl">{getCategoryIcon(device.category)}</span>
              <div className={`text-lg font-medium mt-2 ${stateDisplay?.primaryColor || 'text-gray-400'}`}>
                {stateDisplay?.primaryValue || 'N/A'}
              </div>
              <div className="text-white text-xs truncate">{device.name}</div>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex items-center p-3">
        {!device ? (
          <div className="text-gray-500 text-sm">Device not found</div>
        ) : (
          <>
            <span className={`text-2xl mr-3 ${device.online ? '' : 'opacity-40'}`}>
              {getCategoryIcon(device.category)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">{device.name}</div>
              <div className="text-xs text-gray-500">{device.category}</div>
            </div>
            <div className="text-right ml-2">
              {!device.online ? (
                <span className="text-red-400 text-sm">Offline</span>
              ) : stateDisplay ? (
                <>
                  <div className={`font-medium ${stateDisplay.primaryColor}`}>
                    {stateDisplay.primaryValue}
                  </div>
                  {stateDisplay.secondaryValue && (
                    <div className="text-xs text-gray-400">{stateDisplay.secondaryValue}</div>
                  )}
                </>
              ) : (
                <span className="text-gray-400 text-sm">--</span>
              )}
            </div>
          </>
        )}
      </div>
    </BaseWidget>
  );
}
