import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { ScaledMetric } from '../../common/ScaledMetric';

interface StatsData {
  statistics: {
    totalDocuments: number;
    inboxCount: number;
    characterCount: number;
    fileTypes: Array<{ mime_type: string; count: number }>;
  };
}

interface StatsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function Stats({ integrationId, config, widgetId }: StatsWidgetProps) {
  const { data, loading, error } = useWidgetData<StatsData>({
    integrationId,
    metric: 'statistics',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'numbers';
  const hideLabels = (config.hideLabels as boolean) || false;
  const stats = data?.statistics;
  const isMetricSize = config.metricSize === true;

  // Numbers visualization - large metrics
  if (visualization === 'numbers') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <ScaledMetric
                value={formatNumber(stats?.totalDocuments || 0)}
                className="text-blue-600 dark:text-blue-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Documents</div>}
            </div>
            <div>
              <ScaledMetric
                value={formatNumber(stats?.inboxCount || 0)}
                className="text-yellow-600 dark:text-yellow-400"
              />
              {!hideLabels && <div className="text-sm text-gray-500 mt-1">Inbox</div>}
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Documents</span>
            <span className="text-gray-900 dark:text-white">{formatNumber(stats?.totalDocuments || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Inbox</span>
            <span className={stats?.inboxCount ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}>
              {formatNumber(stats?.inboxCount || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Characters</span>
            <span className="text-gray-900 dark:text-white">{formatNumber(stats?.characterCount || 0)}</span>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (isMetricSize) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-3xl font-bold text-white mb-1">
            {formatNumber(stats?.totalDocuments || 0)}
          </div>
          <div className="text-sm text-gray-400">documents</div>
          {stats && stats.inboxCount > 0 && (
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-yellow-400">{stats.inboxCount} in inbox</span>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-4">
        <div className="text-sm font-medium text-gray-400 mb-3">Document Statistics</div>

        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs text-gray-400">Total Documents</span>
              </div>
              <div className="text-xl font-bold text-white">{formatNumber(stats.totalDocuments)}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <span className="text-xs text-gray-400">Inbox</span>
              </div>
              <div className="text-xl font-bold text-yellow-400">{formatNumber(stats.inboxCount)}</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3 col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span className="text-xs text-gray-400">Characters Indexed</span>
              </div>
              <div className="text-xl font-bold text-green-400">{formatNumber(stats.characterCount)}</div>
            </div>

            {stats.fileTypes && stats.fileTypes.length > 0 && (
              <div className="col-span-2 mt-2">
                <div className="text-xs text-gray-400 mb-2">File Types</div>
                <div className="flex flex-wrap gap-2">
                  {stats.fileTypes.slice(0, 4).map((ft, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                      {ft.mime_type?.split('/')[1] || 'unknown'}: {ft.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
