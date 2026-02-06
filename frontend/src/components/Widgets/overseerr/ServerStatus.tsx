import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';
import { OverseerrServerStatus } from '../../../types';

interface ServerStatusData {
  serverStatus: OverseerrServerStatus;
}

interface ServerStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function ServerStatus({ integrationId, config, widgetId }: ServerStatusProps) {
  const { data, loading, error } = useWidgetData<ServerStatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const dimensions = useWidgetDimensions();
  const compactView = (config.compactView as boolean) || false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'auto';

  // Display options
  const showVersion = config.showVersion !== false;
  const showCommitTag = config.showCommitTag !== false;
  const showUpdateStatus = config.showUpdateStatus !== false;

  // Calculate effective scale factor
  const getEffectiveScale = (): number => {
    if (!dimensions) return 1;
    const { contentScale, scaleFactors } = dimensions;
    if (contentScale === 'auto') {
      return scaleFactors.textScale;
    }
    return parseFloat(contentScale) || 1;
  };
  const scale = getEffectiveScale();

  const serverStatus = data?.serverStatus;

  if (compactView && serverStatus) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              v{serverStatus.version}
            </span>
          </div>
          {serverStatus.updateAvailable && (
            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
              Update available
            </span>
          )}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {serverStatus && (
        <div className="h-full flex flex-col justify-center">
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Online</span>
          </div>

          {/* Info rows */}
          <div className="space-y-2">
            {showVersion && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Version</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {serverStatus.version}
                </span>
              </div>
            )}

            {showCommitTag && serverStatus.commitTag && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Commit</span>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  {serverStatus.commitTag.slice(0, 7)}
                </span>
              </div>
            )}

            {showUpdateStatus && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Updates</span>
                {serverStatus.updateAvailable ? (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {serverStatus.commitsBehind > 0
                        ? `${serverStatus.commitsBehind} behind`
                        : 'Available'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      Up to date
                    </span>
                  </div>
                )}
              </div>
            )}

            {serverStatus.restartRequired && (
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="text-xs font-medium">Restart required</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </BaseWidget>
  );
}
