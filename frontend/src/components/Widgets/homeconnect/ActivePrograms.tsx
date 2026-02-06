import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HomeConnectProgram } from '../../../types';

interface ActiveProgramsData {
  programs: HomeConnectProgram[];
}

interface ActiveProgramsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

// Format seconds to human-readable time
function formatTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '--:--';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Get icon based on appliance type
function getApplianceIcon(type: string): React.ReactNode {
  const iconClass = "w-5 h-5";
  switch (type) {
    case 'Washer':
    case 'WasherDryer':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="14" r="4" strokeWidth={2} />
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
        </svg>
      );
    case 'Dryer':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="14" r="4" strokeWidth={2} />
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M10 14h4" />
        </svg>
      );
    case 'Dishwasher':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <line x1="4" y1="10" x2="20" y2="10" strokeWidth={2} />
          <circle cx="12" cy="15" r="2" strokeWidth={2} />
        </svg>
      );
    case 'Oven':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
          <rect x="7" y="10" width="10" height="7" rx="1" strokeWidth={2} />
        </svg>
      );
    case 'CoffeeMaker':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h1a4 4 0 010 8h-1" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
        </svg>
      );
  }
}

export function ActivePrograms({ integrationId, config, widgetId }: ActiveProgramsProps) {
  const { data, loading, error } = useWidgetData<ActiveProgramsData>({
    integrationId,
    metric: 'active-programs',
    refreshInterval: (config.refreshInterval as number) || 300000, // 5 min default (rate limit consideration)
    widgetId,
  });

  const compactView = (config.compactView as boolean) || false;
  const showProgressBar = config.showProgressBar !== false;
  const showTimeRemaining = config.showTimeRemaining !== false;
  const showOptions = (config.showOptions as boolean) || false;

  const programs = data?.programs || [];

  if (programs.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">No active programs</span>
        </div>
      </BaseWidget>
    );
  }

  if (compactView) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          {programs.map((program) => (
            <div
              key={program.haId}
              className="flex items-center justify-between p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">
                  {getApplianceIcon(program.applianceType)}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {program.applianceName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {program.progress !== undefined && (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {program.progress}%
                  </span>
                )}
                {showTimeRemaining && program.remainingTime && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatTime(program.remainingTime)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {programs.map((program) => (
          <div
            key={program.haId}
            className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                {getApplianceIcon(program.applianceType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-gray-900 dark:text-white truncate">
                    {program.applianceName}
                  </h4>
                  {showTimeRemaining && program.remainingTime && (
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium">
                        {formatTime(program.remainingTime)}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {program.programName}
                </p>

                {showProgressBar && program.progress !== undefined && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Progress</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {program.progress}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${program.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {showOptions && program.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {program.options.slice(0, 3).map((option) => (
                      <span
                        key={option.key}
                        className="text-xs px-2 py-0.5 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      >
                        {option.name}: {String(option.value)}{option.unit || ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </BaseWidget>
  );
}
