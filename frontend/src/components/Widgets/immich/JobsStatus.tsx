import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ImmichJobsData, ImmichJob } from '../../../types';

interface JobsStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function JobsStatus({ integrationId, config, widgetId }: JobsStatusProps) {
  const { data, loading, error } = useWidgetData<ImmichJobsData>({
    integrationId,
    metric: 'jobs',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const jobFilter = (config.jobFilter as string) || 'all';
  const showCompleted = config.showCompleted !== false;
  const showProgressBars = config.showProgressBars !== false;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Loading jobs...</span>
        </div>
      </BaseWidget>
    );
  }

  // Filter jobs based on selection
  let filteredJobs = data.jobs;
  if (jobFilter === 'active') {
    filteredJobs = data.jobs.filter(j => j.active > 0 || j.waiting > 0);
  } else if (jobFilter === 'failed') {
    filteredJobs = data.jobs.filter(j => j.failed > 0);
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {filteredJobs.map((job) => (
            <div key={job.key} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                job.failed > 0 ? 'bg-red-500' : job.active > 0 ? 'bg-blue-500 animate-pulse' : job.waiting > 0 ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
              <span className="flex-1 truncate text-gray-200">{job.name}</span>
              <span className="text-xs text-gray-500">
                {job.active > 0 && `${job.active} active`}
                {job.waiting > 0 && `${job.waiting} waiting`}
                {job.failed > 0 && <span className="text-red-500">{job.failed} failed</span>}
              </span>
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Progress visualization - focused on progress bars
  if (visualization === 'progress') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-3">
          {filteredJobs.filter(j => j.active > 0 || j.waiting > 0).map((job) => {
            const total = job.active + job.waiting;
            const progress = total > 0 ? (job.active / total) * 100 : 0;
            return (
              <div key={job.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-900 dark:text-white">{job.name}</span>
                  <span className="text-gray-500">{job.active}/{total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.max(progress, 5)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {filteredJobs.filter(j => j.active > 0 || j.waiting > 0).length === 0 && (
            <div className="text-center text-gray-500 py-4">All queues idle</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Summary Stats */}
        <div className="flex items-center gap-4 text-sm">
          {data.totalActive > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-blue-600 dark:text-blue-400">{data.totalActive} active</span>
            </div>
          )}
          {data.totalWaiting > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-yellow-600 dark:text-yellow-400">{data.totalWaiting} waiting</span>
            </div>
          )}
          {data.totalFailed > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-red-600 dark:text-red-400">{data.totalFailed} failed</span>
            </div>
          )}
          {data.totalActive === 0 && data.totalWaiting === 0 && data.totalFailed === 0 && (
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              All queues idle
            </span>
          )}
        </div>

        {/* Jobs List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredJobs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No jobs match the selected filter
            </p>
          ) : (
            filteredJobs.map((job) => (
              <JobRow
                key={job.key}
                job={job}
                showCompleted={showCompleted}
                showProgressBar={showProgressBars}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {data.totalJobs} job queues
        </div>
      </div>
    </BaseWidget>
  );
}

function JobRow({ job, showCompleted, showProgressBar }: { job: ImmichJob; showCompleted: boolean; showProgressBar: boolean }) {
  const hasActivity = job.active > 0 || job.waiting > 0 || job.failed > 0;
  const total = job.active + job.waiting;

  return (
    <div className={`p-2 rounded-lg border ${
      job.failed > 0
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : job.active > 0
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        : job.waiting > 0
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{job.name}</span>
          {job.isPaused && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
              Paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {job.active > 0 && (
            <span className="text-blue-600 dark:text-blue-400">{job.active} active</span>
          )}
          {job.waiting > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400">{job.waiting} waiting</span>
          )}
          {job.failed > 0 && (
            <span className="text-red-600 dark:text-red-400">{job.failed} failed</span>
          )}
          {showCompleted && job.completed > 0 && !hasActivity && (
            <span className="text-green-600 dark:text-green-400">{job.completed.toLocaleString()} done</span>
          )}
        </div>
      </div>

      {showProgressBar && total > 0 && (
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-1">
          <div
            className="h-1.5 rounded-full bg-blue-500 transition-all"
            style={{ width: `${total > 0 ? Math.max((job.active / total) * 100, 5) : 0}%` }}
          />
        </div>
      )}
    </div>
  );
}
