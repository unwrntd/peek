import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { TdarrWorker } from '../../../types';

interface ActiveWorkersData {
  workers: TdarrWorker[];
}

interface ActiveWorkersProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getFileName(filePath: string): string {
  if (!filePath) return 'Unknown';
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

export function ActiveWorkers({ integrationId, config, widgetId }: ActiveWorkersProps) {
  const { data, loading, error } = useWidgetData<ActiveWorkersData>({
    integrationId,
    metric: 'workers',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const workers = data?.workers || [];

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {workers.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">No active workers</div>
          ) : (
            workers.map((worker, idx) => (
              <div key={worker.id || idx} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${worker.mode === 'gpu' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                <span className="flex-1 truncate text-gray-200">{getFileName(worker.file)}</span>
                <span className="text-xs text-gray-500">{Math.round(worker.percentage)}%</span>
              </div>
            ))
          )}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        {workers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">No active workers</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {workers.map((worker, idx) => (
              <div
                key={worker.id || idx}
                className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded-full ${worker.mode === 'gpu' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                  <span className="text-xs font-medium text-gray-500 uppercase">{worker.mode}</span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white truncate mb-1">{getFileName(worker.file)}</div>
                {!hideLabels && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full">
                      <div className={`h-full rounded-full ${worker.mode === 'gpu' ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${worker.percentage}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{Math.round(worker.percentage)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">No active workers</span>
          </div>
        ) : (
          workers.map((worker, idx) => (
            <div
              key={worker.id || idx}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
            >
              <div className="flex items-center gap-2 mb-2">
                {/* Worker type icon */}
                <div className={`p-1.5 rounded-md ${
                  worker.mode === 'gpu'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30'
                    : 'bg-blue-100 dark:bg-blue-900/30'
                }`}>
                  {worker.mode === 'gpu' ? (
                    <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {worker.mode}-{worker.id}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      worker.workerType === 'transcode'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                        : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                    }`}>
                      {worker.workerType === 'transcode' ? 'Transcode' : 'Health'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white truncate" title={worker.file}>
                    {getFileName(worker.file)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      worker.mode === 'gpu' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${worker.percentage}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  <span className="font-medium">{Math.round(worker.percentage)}%</span>
                  {worker.ETA && <span>{worker.ETA}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </BaseWidget>
  );
}
