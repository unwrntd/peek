import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface LightDevice {
  id: string;
  deviceId: string;
  name: string;
  aid: number;
  iid: number;
  on: boolean;
  brightness?: number;
  hue?: number;
  saturation?: number;
  colorTemperature?: number;
  reachable: boolean;
}

interface LightsData {
  lights: LightDevice[];
  stats: {
    total: number;
    on: number;
    off: number;
    unreachable: number;
  };
}

interface LightsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getBrightnessColor(brightness: number): string {
  if (brightness >= 80) return 'text-yellow-300';
  if (brightness >= 50) return 'text-yellow-400';
  if (brightness >= 20) return 'text-yellow-500';
  return 'text-yellow-600';
}

function getLightIcon(light: LightDevice): string {
  if (!light.on) return '\uD83D\uDCA1';
  if (light.hue !== undefined && light.saturation !== undefined) {
    // Color light
    return '\uD83C\uDF08';
  }
  return '\uD83D\uDCA1';
}

export function Lights({ integrationId, config, widgetId }: LightsWidgetProps) {
  const { data, loading, error } = useWidgetData<LightsData>({
    integrationId,
    metric: 'lights',
    refreshInterval: (config.refreshInterval as number) || 15000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const statusFilter = (config.status as string) || '';
  const displayOptions = config.displayOptions as Record<string, boolean> | undefined;
  const showBrightness = displayOptions?.showBrightness !== false;
  const showColor = displayOptions?.showColor !== false;

  let lights = data?.lights || [];

  // Apply filters
  if (statusFilter === 'on') {
    lights = lights.filter(l => l.on);
  } else if (statusFilter === 'off') {
    lights = lights.filter(l => !l.on);
  }

  // Cards visualization (default)
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {/* Stats header */}
          {data?.stats && (
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
              <span>{data.stats.total} lights</span>
              <span className="text-yellow-400">{data.stats.on} on</span>
              <span className="text-gray-500">{data.stats.off} off</span>
            </div>
          )}

          {lights.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {data?.lights?.length === 0 ? 'No lights found' : 'No lights match filter'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {lights.map((light) => (
                <div
                  key={light.id}
                  className={`bg-gray-800/50 rounded-lg p-3 hover:bg-gray-700/50 transition-colors ${
                    !light.reachable ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-2xl ${light.on ? 'opacity-100' : 'opacity-40'}`}>
                      {getLightIcon(light)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{light.name}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${light.on ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {light.on ? 'On' : 'Off'}
                    </span>
                    {showBrightness && light.brightness !== undefined && light.on && (
                      <span className={`text-sm ${getBrightnessColor(light.brightness)}`}>
                        {light.brightness}%
                      </span>
                    )}
                  </div>

                  {/* Brightness bar */}
                  {showBrightness && light.brightness !== undefined && (
                    <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${light.on ? 'bg-yellow-400' : 'bg-gray-600'}`}
                        style={{ width: `${light.on ? light.brightness : 0}%` }}
                      />
                    </div>
                  )}

                  {/* Color indicator */}
                  {showColor && light.hue !== undefined && light.saturation !== undefined && light.on && (
                    <div
                      className="mt-2 h-2 rounded-full"
                      style={{
                        backgroundColor: `hsl(${light.hue}, ${light.saturation}%, 50%)`,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Sliders visualization
  if (visualization === 'sliders') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {lights.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No lights found
            </div>
          ) : (
            <div className="space-y-3">
              {lights.map((light) => (
                <div
                  key={light.id}
                  className={`bg-gray-800/50 rounded-lg p-3 ${!light.reachable ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xl ${light.on ? 'opacity-100' : 'opacity-40'}`}>
                        {getLightIcon(light)}
                      </span>
                      <span className="text-white font-medium text-sm">{light.name}</span>
                    </div>
                    <span className={`text-sm ${light.on ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {light.on ? (light.brightness !== undefined ? `${light.brightness}%` : 'On') : 'Off'}
                    </span>
                  </div>

                  {/* Brightness slider visualization */}
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${light.on ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' : 'bg-gray-600'}`}
                      style={{ width: `${light.on ? (light.brightness || 100) : 0}%` }}
                    />
                  </div>
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
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 px-2">
          <span>{data?.stats?.total || 0} lights</span>
          <span className="text-yellow-400">{data?.stats?.on || 0} on</span>
        </div>

        {lights.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No lights found
          </div>
        ) : (
          <div className="space-y-1">
            {lights.map((light) => (
              <div
                key={light.id}
                className={`px-2 py-1.5 hover:bg-gray-800/50 rounded flex items-center gap-2 ${
                  !light.reachable ? 'opacity-50' : ''
                }`}
              >
                <span className={`text-lg ${light.on ? '' : 'opacity-40'}`}>
                  {getLightIcon(light)}
                </span>
                <span className="text-white text-sm truncate flex-1">{light.name}</span>
                {showBrightness && light.brightness !== undefined && light.on && (
                  <span className="text-xs text-gray-400">{light.brightness}%</span>
                )}
                <div
                  className={`w-8 h-4 rounded-full flex items-center px-0.5 transition-colors ${
                    light.on ? 'bg-yellow-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      light.on ? 'translate-x-3.5' : ''
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
