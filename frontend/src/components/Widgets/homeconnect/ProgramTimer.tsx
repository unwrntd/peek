import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';
import { HomeConnectProgram } from '../../../types';

interface ProgramTimerData {
  programs: HomeConnectProgram[];
}

interface ProgramTimerProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

// Format seconds to timer display
function formatTimerDisplay(seconds?: number): { hours: string; minutes: string; seconds: string } {
  if (!seconds || seconds <= 0) {
    return { hours: '--', minutes: '--', seconds: '--' };
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return {
    hours: h.toString().padStart(2, '0'),
    minutes: m.toString().padStart(2, '0'),
    seconds: s.toString().padStart(2, '0'),
  };
}

export function ProgramTimer({ integrationId, config, widgetId }: ProgramTimerProps) {
  const { data, loading, error } = useWidgetData<ProgramTimerData>({
    integrationId,
    metric: 'active-programs',
    refreshInterval: (config.refreshInterval as number) || 30000, // 30s for timer
    widgetId,
  });

  const dimensions = useWidgetDimensions();
  const metricSize = (config.metricSize as string) || 'auto';
  const selectedAppliance = (config.selectedAppliance as string) || '';
  const showApplianceName = config.showApplianceName !== false;
  const showProgramName = config.showProgramName !== false;
  const showProgress = config.showProgress !== false;

  // Calculate scale
  const getEffectiveScale = (): number => {
    if (!dimensions) return 1;
    const { contentScale, scaleFactors } = dimensions;
    if (contentScale === 'auto') {
      return scaleFactors.textScale;
    }
    return parseFloat(contentScale) || 1;
  };
  const scale = getEffectiveScale();

  const programs = data?.programs || [];

  // Find the selected program or first program
  let program: HomeConnectProgram | undefined;
  if (selectedAppliance) {
    program = programs.find(p =>
      p.applianceName.toLowerCase().includes(selectedAppliance.toLowerCase())
    );
  }
  if (!program && programs.length > 0) {
    program = programs[0];
  }

  // No active program
  if (!program) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full">
          <svg
            className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            No active program
          </span>
        </div>
      </BaseWidget>
    );
  }

  const timer = formatTimerDisplay(program.remainingTime);
  const hasTime = program.remainingTime && program.remainingTime > 0;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col items-center justify-center h-full">
        {/* Appliance name */}
        {showApplianceName && (
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {program.applianceName}
          </div>
        )}

        {/* Timer display */}
        <div
          className="flex items-center gap-1 font-mono font-bold text-gray-900 dark:text-white"
          style={{ fontSize: `${Math.max(1.5, 2.5 * scale)}rem` }}
        >
          {hasTime ? (
            <>
              <span className="tabular-nums">{timer.hours}</span>
              <span className="text-gray-500 dark:text-gray-400 animate-pulse">:</span>
              <span className="tabular-nums">{timer.minutes}</span>
              <span className="text-gray-500 dark:text-gray-400 animate-pulse">:</span>
              <span className="tabular-nums">{timer.seconds}</span>
            </>
          ) : (
            <span className="text-green-600 dark:text-green-400">Done!</span>
          )}
        </div>

        {/* Program name */}
        {showProgramName && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {program.programName}
          </div>
        )}

        {/* Progress */}
        {showProgress && program.progress !== undefined && (
          <div className="w-full mt-3 px-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {program.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${program.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
