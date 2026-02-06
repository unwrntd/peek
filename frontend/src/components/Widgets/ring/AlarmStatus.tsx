import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RingAlarmStatus } from '../../../types';

interface AlarmStatusData {
  alarmStatuses: RingAlarmStatus[];
  total: number;
  armed: number;
  disarmed: number;
}

interface AlarmStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getModeStyles(mode: string): { bg: string; text: string; icon: React.ReactNode } {
  switch (mode) {
    case 'all':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-400',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      };
    case 'some':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      };
    default:
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
  }
}

export function AlarmStatus({ integrationId, config, widgetId }: AlarmStatusProps) {
  const { data, loading, error } = useWidgetData<AlarmStatusData>({
    integrationId,
    metric: 'alarm-status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const alarmStatuses = data?.alarmStatuses || [];
  const showSensorSummary = config.showSensorSummary !== false;
  const showLocationName = config.showLocationName !== false;
  const showFaultedCount = config.showFaultedCount !== false;

  if (alarmStatuses.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>No alarm systems found</span>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {alarmStatuses.map((status) => {
          const styles = getModeStyles(status.mode);
          return (
            <div
              key={status.locationId}
              className={`p-4 rounded-lg ${styles.bg} border border-opacity-50`}
            >
              {showLocationName && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{status.locationName}</p>
              )}
              <div className="flex items-center gap-3">
                <div className={styles.text}>{styles.icon}</div>
                <div>
                  <h3 className={`text-xl font-bold ${styles.text}`}>{status.modeLabel}</h3>
                  {status.sirenActive && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium animate-pulse">
                      SIREN ACTIVE
                    </p>
                  )}
                </div>
              </div>

              {showSensorSummary && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 border-opacity-50">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.totalSensors}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sensors</p>
                    </div>
                    {showFaultedCount && (
                      <div>
                        <p className={`text-lg font-semibold ${status.faultedSensors > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                          {status.faultedSensors}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Open</p>
                      </div>
                    )}
                    <div>
                      <p className={`text-lg font-semibold ${status.lowBatterySensors > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {status.lowBatterySensors}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Low Batt</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BaseWidget>
  );
}
