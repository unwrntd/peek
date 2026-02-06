import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface EcobeeThermostat {
  identifier: string;
  name: string;
  brand?: string;
  modelNumber?: string;
  connected: boolean;
  actualTemperature: number | null;
  desiredHeat: number | null;
  desiredCool: number | null;
  actualHumidity: number | null;
  hvacMode: string;
  fanMode: string;
  equipmentStatus: string;
  useCelsius: boolean;
  activeEvent: {
    type: string;
    name: string;
    holdClimateRef?: string;
  } | null;
}

interface ThermostatData {
  thermostats: EcobeeThermostat[];
}

interface ThermostatProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTemperature(temp: number | null, useCelsius: boolean): string {
  if (temp === null) return '--';
  if (useCelsius) {
    const celsius = (temp - 32) * (5 / 9);
    return `${celsius.toFixed(1)}°C`;
  }
  return `${temp.toFixed(1)}°F`;
}

function getHvacModeColor(mode: string): string {
  switch (mode) {
    case 'heat':
      return 'text-orange-500';
    case 'cool':
      return 'text-blue-500';
    case 'auto':
      return 'text-green-500';
    case 'off':
      return 'text-gray-400';
    default:
      return 'text-gray-500';
  }
}

function getHvacModeIcon(mode: string): JSX.Element {
  switch (mode) {
    case 'heat':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      );
    case 'cool':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
        </svg>
      );
    case 'auto':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      );
  }
}

function getEquipmentStatusLabel(status: string): string {
  const parts = status.split(',').filter(Boolean);
  if (parts.length === 0) return 'Idle';

  const labels: string[] = [];
  if (parts.some(p => p.includes('Heat') || p === 'heatPump')) labels.push('Heating');
  if (parts.some(p => p.includes('Cool') || p === 'compCool1' || p === 'compCool2')) labels.push('Cooling');
  if (parts.includes('fan')) labels.push('Fan');
  if (parts.includes('humidifier')) labels.push('Humidifying');
  if (parts.includes('dehumidifier')) labels.push('Dehumidifying');

  return labels.length > 0 ? labels.join(', ') : status;
}

export function Thermostat({ integrationId, config, widgetId }: ThermostatProps) {
  const [isControlling, setIsControlling] = useState(false);

  const { data, loading, error, refetch } = useWidgetData<ThermostatData>({
    integrationId,
    metric: 'thermostats',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const showHumidity = config.showHumidity !== false;
  const showHvacMode = config.showHvacMode !== false;
  const showEquipment = config.showEquipment !== false;
  const showControls = config.showControls !== false;
  const selectedThermostatId = config.thermostatId as string | undefined;
  const visualization = (config.visualization as string) || 'dial';

  const handleControl = useCallback(async (action: string, thermostatId: string, params?: Record<string, unknown>) => {
    if (isControlling) return;
    setIsControlling(true);
    try {
      const response = await fetch(`/api/integrations/${integrationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { thermostatId, ...params } }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 1000);
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setIsControlling(false);
    }
  }, [integrationId, isControlling, refetch]);

  // Filter to selected thermostat if specified
  let thermostats = data?.thermostats || [];
  if (selectedThermostatId) {
    thermostats = thermostats.filter(t =>
      t.identifier === selectedThermostatId ||
      t.name.toLowerCase().includes(selectedThermostatId.toLowerCase())
    );
  }

  const thermostat = thermostats[0];

  const renderDial = (t: EcobeeThermostat) => {
    const tempRange = { min: 50, max: 90 }; // Fahrenheit
    const temp = t.actualTemperature ?? 70;
    const normalizedTemp = Math.max(0, Math.min(1, (temp - tempRange.min) / (tempRange.max - tempRange.min)));
    const angle = -135 + (normalizedTemp * 270); // -135 to 135 degrees

    return (
      <div className="flex flex-col items-center justify-center flex-1">
        {/* Circular dial */}
        <div className="relative w-32 h-32">
          {/* Background arc */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="212"
              strokeDashoffset="53"
              className="text-gray-200 dark:text-gray-700"
            />
            {/* Temperature arc */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${normalizedTemp * 212} 212`}
              strokeDashoffset="0"
              className={t.hvacMode === 'heat' ? 'text-orange-500' : t.hvacMode === 'cool' ? 'text-blue-500' : 'text-green-500'}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatTemperature(t.actualTemperature, t.useCelsius).replace(/°[CF]/, '')}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t.useCelsius ? '°C' : '°F'}
            </span>
          </div>
        </div>

        {/* Setpoints */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          {t.desiredHeat !== null && (
            <div className="flex items-center gap-1 text-orange-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              <span>{formatTemperature(t.desiredHeat, t.useCelsius)}</span>
            </div>
          )}
          {t.desiredCool !== null && (
            <div className="flex items-center gap-1 text-blue-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>{formatTemperature(t.desiredCool, t.useCelsius)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCard = (t: EcobeeThermostat) => (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatTemperature(t.actualTemperature, t.useCelsius)}
          </div>
          {showHumidity && t.actualHumidity !== null && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t.actualHumidity}% humidity
            </div>
          )}
        </div>
        {showHvacMode && (
          <div className={`flex items-center gap-1.5 ${getHvacModeColor(t.hvacMode)}`}>
            {getHvacModeIcon(t.hvacMode)}
            <span className="text-sm font-medium capitalize">{t.hvacMode}</span>
          </div>
        )}
      </div>

      {/* Setpoints */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
          <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">Heat to</div>
          <div className="text-lg font-semibold text-orange-700 dark:text-orange-300">
            {formatTemperature(t.desiredHeat, t.useCelsius)}
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Cool to</div>
          <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
            {formatTemperature(t.desiredCool, t.useCelsius)}
          </div>
        </div>
      </div>

      {showEquipment && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Status: <span className={t.equipmentStatus ? 'text-green-600 dark:text-green-400' : ''}>
            {getEquipmentStatusLabel(t.equipmentStatus)}
          </span>
        </div>
      )}
    </div>
  );

  const renderCompact = (t: EcobeeThermostat) => (
    <div className="flex items-center justify-between h-full">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${getHvacModeColor(t.hvacMode)} bg-opacity-10`}>
          {getHvacModeIcon(t.hvacMode)}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatTemperature(t.actualTemperature, t.useCelsius)}
          </div>
          {showHumidity && t.actualHumidity !== null && (
            <div className="text-xs text-gray-500">{t.actualHumidity}% humidity</div>
          )}
        </div>
      </div>
      <div className="text-right text-sm">
        <div className="text-orange-500">{formatTemperature(t.desiredHeat, t.useCelsius)}</div>
        <div className="text-blue-500">{formatTemperature(t.desiredCool, t.useCelsius)}</div>
      </div>
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {!thermostat ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">No thermostats found</p>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header with thermostat name */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${thermostat.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-medium text-gray-900 dark:text-white truncate">{thermostat.name}</span>
            </div>
            {thermostat.activeEvent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                {thermostat.activeEvent.name || thermostat.activeEvent.type}
              </span>
            )}
          </div>

          {/* Main content based on visualization */}
          <div className="flex-1 min-h-0">
            {visualization === 'dial' && renderDial(thermostat)}
            {visualization === 'card' && renderCard(thermostat)}
            {visualization === 'compact' && renderCompact(thermostat)}
          </div>

          {/* Controls */}
          {showControls && (
            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              {['heat', 'cool', 'auto', 'off'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleControl('setHvacMode', thermostat.identifier, { mode })}
                  disabled={isControlling || thermostat.hvacMode === mode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                    thermostat.hvacMode === mode
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
