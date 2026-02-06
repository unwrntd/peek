import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface EcobeeClimate {
  name: string;
  climateRef: string;
  type: string;
  isOccupied: boolean;
  coolTemp: number;
  heatTemp: number;
  colour: string;
}

interface EcobeeActiveEvent {
  type: string;
  name: string;
  endDate: string;
  endTime: string;
  holdClimateRef?: string;
  heatHoldTemp: number;
  coolHoldTemp: number;
}

interface EcobeeSchedule {
  thermostatId: string;
  thermostatName: string;
  useCelsius: boolean;
  available: boolean;
  currentClimateRef?: string;
  climates?: EcobeeClimate[];
  schedule?: string[][];
  activeEvent?: EcobeeActiveEvent | null;
}

interface ScheduleData {
  schedules: EcobeeSchedule[];
}

interface ScheduleProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTemperature(temp: number, useCelsius: boolean): string {
  if (useCelsius) {
    const celsius = (temp - 32) * (5 / 9);
    return `${celsius.toFixed(0)}°`;
  }
  return `${temp.toFixed(0)}°`;
}

function getClimateColor(colour: string): string {
  // Ecobee returns colors as decimal values, convert to hex
  const hex = parseInt(colour).toString(16).padStart(6, '0');
  return `#${hex}`;
}

function getDefaultClimateColor(climateRef: string): string {
  switch (climateRef) {
    case 'home': return '#4CAF50';
    case 'away': return '#2196F3';
    case 'sleep': return '#9C27B0';
    default: return '#607D8B';
  }
}

function getClimateIcon(climateRef: string): JSX.Element {
  switch (climateRef.toLowerCase()) {
    case 'home':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'away':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'sleep':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function formatHoldEnd(endDate: string, endTime: string): string {
  try {
    const end = new Date(`${endDate} ${endTime}`);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();

    if (diffMs <= 0) return 'Ending soon';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ${diffHours % 24}h`;
    }
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  } catch {
    return '';
  }
}

export function Schedule({ integrationId, config, widgetId }: ScheduleProps) {
  const [isControlling, setIsControlling] = useState(false);

  const { data, loading, error, refetch } = useWidgetData<ScheduleData>({
    integrationId,
    metric: 'schedule',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showSetpoints = config.showSetpoints !== false;
  const showActiveHold = config.showActiveHold !== false;
  const showControls = config.showControls !== false;
  const selectedThermostatId = config.thermostatId as string | undefined;
  const visualization = (config.visualization as string) || 'timeline';

  const handleSetClimate = useCallback(async (thermostatId: string, climateRef: string) => {
    if (isControlling) return;
    setIsControlling(true);
    try {
      const response = await fetch(`/api/integrations/${integrationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setClimate',
          params: { thermostatId, climateRef },
        }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 1000);
      }
    } catch (err) {
      console.error('Failed to set climate:', err);
    } finally {
      setIsControlling(false);
    }
  }, [integrationId, isControlling, refetch]);

  const handleResumeProgram = useCallback(async (thermostatId: string) => {
    if (isControlling) return;
    setIsControlling(true);
    try {
      const response = await fetch(`/api/integrations/${integrationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resumeProgram',
          params: { thermostatId, resumeAll: false },
        }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 1000);
      }
    } catch (err) {
      console.error('Failed to resume program:', err);
    } finally {
      setIsControlling(false);
    }
  }, [integrationId, isControlling, refetch]);

  // Filter to selected thermostat if specified
  let scheduleData = data?.schedules || [];
  if (selectedThermostatId) {
    scheduleData = scheduleData.filter(s =>
      s.thermostatId === selectedThermostatId ||
      s.thermostatName.toLowerCase().includes(selectedThermostatId.toLowerCase())
    );
  }

  const schedule = scheduleData.find(s => s.available) || scheduleData[0];

  if (!schedule?.available) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No schedule data</p>
        </div>
      </BaseWidget>
    );
  }

  const climates = schedule.climates || [];
  const currentClimate = climates.find(c => c.climateRef === schedule.currentClimateRef);

  const renderTimeline = () => {
    const dayIndex = new Date().getDay();
    const todaySchedule = schedule.schedule?.[dayIndex] || [];
    const hourSlots: { climate: EcobeeClimate | undefined; hour: number }[] = [];

    // Each day has 48 slots (30-min intervals), map to hours
    for (let i = 0; i < 24; i++) {
      const slotIndex = i * 2;
      const climateRef = todaySchedule[slotIndex];
      const climate = climates.find(c => c.climateRef === climateRef);
      hourSlots.push({ climate, hour: i });
    }

    const currentHour = new Date().getHours();

    return (
      <div className="flex flex-col h-full">
        {/* Current climate indicator */}
        {currentClimate && (
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: currentClimate.colour ? getClimateColor(currentClimate.colour) : getDefaultClimateColor(currentClimate.climateRef) }}
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {currentClimate.name}
            </span>
            {showSetpoints && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                {formatTemperature(currentClimate.heatTemp, schedule.useCelsius)} - {formatTemperature(currentClimate.coolTemp, schedule.useCelsius)}
              </span>
            )}
          </div>
        )}

        {/* Active hold notice */}
        {showActiveHold && schedule.activeEvent && (
          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">{schedule.activeEvent.name || schedule.activeEvent.type}</span>
              </div>
              {schedule.activeEvent.endDate && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {formatHoldEnd(schedule.activeEvent.endDate, schedule.activeEvent.endTime)}
                </span>
              )}
            </div>
            {showControls && (
              <button
                onClick={() => handleResumeProgram(schedule.thermostatId)}
                disabled={isControlling}
                className="mt-2 text-xs text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-50"
              >
                Resume Schedule
              </button>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-0.5 h-8">
            {hourSlots.map(({ climate, hour }) => (
              <div
                key={hour}
                className={`flex-1 rounded-sm relative ${hour === currentHour ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
                style={{
                  backgroundColor: climate?.colour
                    ? getClimateColor(climate.colour)
                    : climate
                    ? getDefaultClimateColor(climate.climateRef)
                    : '#ccc',
                  opacity: climate ? 1 : 0.3,
                }}
                title={`${hour}:00 - ${climate?.name || 'Unknown'}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>12am</span>
          </div>
        </div>

        {/* Climate legend */}
        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          {climates.slice(0, 4).map((climate) => (
            <div key={climate.climateRef} className="flex items-center gap-1 text-xs">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: climate.colour ? getClimateColor(climate.colour) : getDefaultClimateColor(climate.climateRef) }}
              />
              <span className="text-gray-600 dark:text-gray-400">{climate.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderClimates = () => (
    <div className="flex flex-col h-full">
      {/* Active hold notice */}
      {showActiveHold && schedule.activeEvent && (
        <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              {schedule.activeEvent.name || schedule.activeEvent.type} active
            </span>
            {showControls && (
              <button
                onClick={() => handleResumeProgram(schedule.thermostatId)}
                disabled={isControlling}
                className="text-xs text-amber-600 hover:underline disabled:opacity-50"
              >
                Resume
              </button>
            )}
          </div>
        </div>
      )}

      {/* Climate cards */}
      <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto">
        {climates.map((climate) => {
          const isActive = climate.climateRef === schedule.currentClimateRef && !schedule.activeEvent;
          const color = climate.colour ? getClimateColor(climate.colour) : getDefaultClimateColor(climate.climateRef);

          return (
            <button
              key={climate.climateRef}
              onClick={() => showControls ? handleSetClimate(schedule.thermostatId, climate.climateRef) : undefined}
              disabled={isControlling || !showControls}
              className={`p-3 rounded-lg border-2 text-left transition-colors disabled:cursor-default ${
                isActive
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className={`text-sm font-medium ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                  {climate.name}
                </span>
              </div>
              {showSetpoints && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="text-orange-500">{formatTemperature(climate.heatTemp, schedule.useCelsius)}</span>
                  <span>-</span>
                  <span className="text-blue-500">{formatTemperature(climate.coolTemp, schedule.useCelsius)}</span>
                </div>
              )}
              {climate.isOccupied && (
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Occupied
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderCompact = () => (
    <div className="flex items-center justify-between h-full">
      {currentClimate ? (
        <>
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: currentClimate.colour ? getClimateColor(currentClimate.colour) : getDefaultClimateColor(currentClimate.climateRef) }}
            />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {currentClimate.name}
                {schedule.activeEvent && (
                  <span className="ml-2 text-xs text-amber-500">(Hold)</span>
                )}
              </div>
              {showSetpoints && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTemperature(currentClimate.heatTemp, schedule.useCelsius)} - {formatTemperature(currentClimate.coolTemp, schedule.useCelsius)}
                </div>
              )}
            </div>
          </div>
          {showControls && schedule.activeEvent && (
            <button
              onClick={() => handleResumeProgram(schedule.thermostatId)}
              disabled={isControlling}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Resume
            </button>
          )}
        </>
      ) : (
        <span className="text-sm text-gray-500 dark:text-gray-400">No active climate</span>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {visualization === 'timeline' && renderTimeline()}
      {visualization === 'climates' && renderClimates()}
      {visualization === 'compact' && renderCompact()}
    </BaseWidget>
  );
}
