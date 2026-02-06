import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProxmoxCephStatus as CephStatusType } from '../../../types';
import { formatBytes } from '../../../utils/formatting';
import { getProgressColor } from '../../../utils/colors';

interface CephStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface CephData {
  ceph: CephStatusType;
}

function getCephHealthBadge(status: string): string {
  if (status === 'HEALTH_OK') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (status === 'HEALTH_WARN') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
}

export function CephStatus({ integrationId, config, widgetId }: CephStatusProps) {
  const { data, loading, error } = useWidgetData<CephData>({
    integrationId,
    metric: (config.metric as string) || 'ceph',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const showOSDs = config.showOSDs !== false;
  const showPGs = config.showPGs !== false;
  const showMonitors = config.showMonitors !== false;
  const showCapacity = config.showCapacity !== false;
  const showWarnings = config.showWarnings !== false;
  const compactView = config.compactView === true;

  const ceph = data?.ceph;

  if (!ceph) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          <p>Ceph not configured or unavailable</p>
        </div>
      </BaseWidget>
    );
  }

  const usagePercent = ceph.pgmap?.bytes_total
    ? (ceph.pgmap.bytes_used / ceph.pgmap.bytes_total) * 100
    : 0;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className={`space-y-${compactView ? '3' : '4'}`}>
        {/* Health Status */}
        <div className={`${compactView ? 'p-3' : 'p-4'} bg-gray-50 dark:bg-gray-700 rounded-lg`}>
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">Ceph Cluster Health</h4>
            <span className={`px-2 py-1 text-xs font-medium rounded ${getCephHealthBadge(ceph.health.status)}`}>
              {ceph.health.status.replace('HEALTH_', '')}
            </span>
          </div>
        </div>

        {/* Health Warnings */}
        {showWarnings && ceph.health.checks && Object.keys(ceph.health.checks).length > 0 && (
          <div className={`space-y-${compactView ? '1' : '2'}`}>
            {Object.entries(ceph.health.checks).map(([key, check]) => (
              <div
                key={key}
                className={`${compactView ? 'p-2' : 'p-3'} border rounded-lg ${
                  check.severity === 'HEALTH_WARN'
                    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                }`}
              >
                <div className="flex items-start gap-2">
                  <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                    check.severity === 'HEALTH_WARN' ? 'text-yellow-500' : 'text-red-500'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{key}</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{check.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* OSDs */}
          {showOSDs && ceph.osdmap && (
            <div className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">OSDs</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {ceph.osdmap.num_up_osds}/{ceph.osdmap.num_osds}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {ceph.osdmap.num_in_osds} in cluster
              </div>
            </div>
          )}

          {/* Monitors */}
          {showMonitors && ceph.monmap && (
            <div className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monitors</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {ceph.monmap.mons.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {ceph.monmap.mons.map(m => m.name).join(', ')}
              </div>
            </div>
          )}

          {/* PGs */}
          {showPGs && ceph.pgmap && (
            <div className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Placement Groups</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {ceph.pgmap.num_pgs}
              </div>
              {!compactView && ceph.pgmap.pgs_by_state && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {ceph.pgmap.pgs_by_state.slice(0, 3).map(s => `${s.count} ${s.state_name}`).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Capacity */}
          {showCapacity && ceph.pgmap && (
            <div className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Capacity</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {usagePercent.toFixed(1)}%
              </div>
              <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(usagePercent)} transition-all`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatBytes(ceph.pgmap.bytes_used)} / {formatBytes(ceph.pgmap.bytes_total)}
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
