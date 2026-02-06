import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProxmoxBackupInfo, ProxmoxBackupJob } from '../../../types';
import { matchesFilter } from '../../../utils/filterUtils';

interface BackupStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface BackupData {
  notBackedUp: ProxmoxBackupInfo[];
  jobs: ProxmoxBackupJob[];
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

export function BackupStatus({ integrationId, config, widgetId }: BackupStatusProps) {
  const { data, loading, error } = useWidgetData<BackupData>({
    integrationId,
    metric: (config.metric as string) || 'backups',
    refreshInterval: (config.refreshInterval as number) || 30000, // 5 minutes
    widgetId,
  });

  // Configuration options with defaults
  const showNotBackedUp = config.showNotBackedUp !== false;
  const showJobs = config.showJobs !== false;
  const compactView = config.compactView === true;

  // Apply filters (supports wildcards and comma-separated lists)
  const filteredNotBackedUp = data?.notBackedUp.filter(item => {
    const nodeFilter = config.nodeFilter as string;
    if (nodeFilter && !matchesFilter(item.node, nodeFilter)) return false;

    const vmType = config.vmType as string;
    if (vmType && item.type !== vmType) return false;

    return true;
  }) || [];

  const filteredJobs = data?.jobs.filter(job => {
    const showDisabled = config.showDisabled as boolean;
    if (!showDisabled && !job.enabled) return false;

    return true;
  }) || [];

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`space-y-${compactView ? '3' : '4'}`}>
          {/* Not Backed Up Section */}
          {showNotBackedUp && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Not Backed Up ({filteredNotBackedUp.length})
              </h4>
              {filteredNotBackedUp.length > 0 ? (
                <div className={`space-y-${compactView ? '1' : '2'}`}>
                  {filteredNotBackedUp.map((item) => (
                    <div
                      key={`${item.vmid}-${item.node}`}
                      className={`${compactView ? 'p-2' : 'p-3'} bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {item.name || `VM ${item.vmid}`}
                          </span>
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({item.type.toUpperCase()})
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.node}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All VMs are backed up
                </p>
              )}
            </div>
          )}

          {/* Backup Jobs Section */}
          {showJobs && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Scheduled Jobs ({filteredJobs.length})
              </h4>
              {filteredJobs.length > 0 ? (
                <div className={`space-y-${compactView ? '1' : '2'}`}>
                  {filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {job.id}
                            </span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              job.enabled
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                              {job.enabled ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>{job.schedule}</span>
                            <span className="mx-1">•</span>
                            <span>{job.storage}</span>
                            <span className="mx-1">•</span>
                            <span>{job.mode}</span>
                          </div>
                        </div>
                      </div>
                      {!compactView && job['next-run'] && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Next run: {formatDate(job['next-run'])}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No backup jobs configured</p>
              )}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
