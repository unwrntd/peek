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
  categoryId: number;
  online: boolean;
  primaryService?: {
    type: string;
    typeName: string;
    state: Record<string, unknown>;
  };
}

interface DevicesData {
  devices: HomeKitDevice[];
  stats: {
    total: number;
    online: number;
    offline: number;
    byCategory: Record<string, number>;
  };
}

interface DevicesWidgetProps {
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
    case 'security':
    case 'security system':
      return '\uD83D\uDEE1\uFE0F';
    default:
      return '\uD83C\uDFE0';
  }
}

function getStateDisplay(device: HomeKitDevice): { text: string; color: string } | null {
  if (!device.primaryService?.state) return null;

  const state = device.primaryService.state;

  // Light/Switch state
  if ('On' in state) {
    return state.On
      ? { text: 'On', color: 'text-yellow-400' }
      : { text: 'Off', color: 'text-gray-500' };
  }

  // Temperature
  if ('CurrentTemperature' in state) {
    const temp = state.CurrentTemperature as number;
    return { text: `${temp.toFixed(1)}°`, color: 'text-blue-400' };
  }

  // Motion
  if ('MotionDetected' in state) {
    return state.MotionDetected
      ? { text: 'Motion', color: 'text-red-400' }
      : { text: 'Clear', color: 'text-green-400' };
  }

  // Contact
  if ('ContactSensorState' in state) {
    return state.ContactSensorState === 0
      ? { text: 'Closed', color: 'text-green-400' }
      : { text: 'Open', color: 'text-orange-400' };
  }

  // Lock
  if ('LockCurrentState' in state) {
    const lockState = state.LockCurrentState as number;
    switch (lockState) {
      case 0:
        return { text: 'Unsecured', color: 'text-orange-400' };
      case 1:
        return { text: 'Secured', color: 'text-green-400' };
      case 2:
        return { text: 'Jammed', color: 'text-red-400' };
      default:
        return { text: 'Unknown', color: 'text-gray-400' };
    }
  }

  return null;
}

export function Devices({ integrationId, config, widgetId }: DevicesWidgetProps) {
  const { data, loading, error } = useWidgetData<DevicesData>({
    integrationId,
    metric: 'devices',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'grid';
  const categoryFilter = (config.category as string) || '';
  const statusFilter = (config.status as string) || '';
  const displayOptions = config.displayOptions as Record<string, boolean> | undefined;
  const showStatus = displayOptions?.showStatus !== false;
  const showCategory = displayOptions?.showCategory !== false;
  const showAddress = displayOptions?.showAddress !== false;

  let devices = data?.devices || [];

  // Apply filters
  if (categoryFilter) {
    devices = devices.filter(d => d.category.toLowerCase() === categoryFilter.toLowerCase());
  }
  if (statusFilter === 'online') {
    devices = devices.filter(d => d.online);
  } else if (statusFilter === 'offline') {
    devices = devices.filter(d => !d.online);
  }

  // Grid visualization (default)
  if (visualization === 'grid') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {/* Stats header */}
          {data?.stats && (
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
              <span>{data.stats.total} devices</span>
              <span className="text-green-400">{data.stats.online} online</span>
              {data.stats.offline > 0 && (
                <span className="text-red-400">{data.stats.offline} offline</span>
              )}
            </div>
          )}

          {devices.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {data?.devices?.length === 0 ? 'No devices paired' : 'No devices match filter'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {devices.map((device) => {
                const stateDisplay = getStateDisplay(device);
                return (
                  <div
                    key={device.id}
                    className={`bg-gray-800/50 rounded-lg p-3 hover:bg-gray-700/50 transition-colors ${
                      !device.online ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getCategoryIcon(device.category)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate">{device.name}</div>
                        {showCategory && (
                          <div className="text-xs text-gray-500">{device.category}</div>
                        )}
                      </div>
                    </div>

                    {showStatus && (
                      <div className="flex items-center justify-between text-xs">
                        <span className={device.online ? 'text-green-400' : 'text-red-400'}>
                          {device.online ? 'Online' : 'Offline'}
                        </span>
                        {stateDisplay && (
                          <span className={stateDisplay.color}>{stateDisplay.text}</span>
                        )}
                      </div>
                    )}

                    {showAddress && device.online && (
                      <div className="text-xs text-gray-600 mt-1 truncate">
                        {device.address}:{device.port}
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
              <span>{data.stats.total} devices</span>
              <span className="text-green-400">{data.stats.online} online</span>
              {data.stats.offline > 0 && (
                <span className="text-red-400">{data.stats.offline} offline</span>
              )}
            </div>
          )}

          {devices.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No devices found
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {devices.map((device) => {
                const stateDisplay = getStateDisplay(device);
                return (
                  <div
                    key={device.id}
                    className={`p-3 hover:bg-gray-800/50 transition-colors flex items-center gap-3 ${
                      !device.online ? 'opacity-50' : ''
                    }`}
                  >
                    <span className="text-2xl">{getCategoryIcon(device.category)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{device.name}</div>
                      <div className="flex items-center gap-2 text-xs">
                        {showCategory && (
                          <span className="text-gray-500">{device.category}</span>
                        )}
                        {showAddress && (
                          <span className="text-gray-600">{device.address}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {showStatus && (
                        <div className={`text-xs ${device.online ? 'text-green-400' : 'text-red-400'}`}>
                          {device.online ? 'Online' : 'Offline'}
                        </div>
                      )}
                      {stateDisplay && (
                        <div className={`text-sm font-medium ${stateDisplay.color}`}>
                          {stateDisplay.text}
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

  // Compact visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="text-xs text-gray-400 mb-2 px-2">
          {data?.stats?.total || 0} devices ({data?.stats?.online || 0} online)
        </div>
        {devices.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No devices found
          </div>
        ) : (
          <div className="space-y-1">
            {devices.map((device) => {
              const stateDisplay = getStateDisplay(device);
              return (
                <div
                  key={device.id}
                  className={`px-2 py-1 hover:bg-gray-800/50 rounded flex items-center gap-2 text-sm ${
                    !device.online ? 'opacity-50' : ''
                  }`}
                >
                  <span>{getCategoryIcon(device.category)}</span>
                  <span className="text-white truncate flex-1">{device.name}</span>
                  {stateDisplay && (
                    <span className={`text-xs ${stateDisplay.color}`}>{stateDisplay.text}</span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${device.online ? 'bg-green-400' : 'bg-red-400'}`} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
