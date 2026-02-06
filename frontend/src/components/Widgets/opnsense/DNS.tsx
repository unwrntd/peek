import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface DNSProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DNSQuery {
  time: string;
  client: string;
  query: string;
  type: string;
  answer?: string;
  cached: boolean;
}

interface DNSData {
  stats: {
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    blockedQueries: number;
    upstreamQueries: number;
  };
  recentQueries: DNSQuery[];
}

function CacheHitGauge({ percentage }: { percentage: number }) {
  const strokeDasharray = `${percentage}, 100`;
  const color = percentage >= 80 ? 'text-green-500' : percentage >= 50 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-gray-200 dark:text-gray-700"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className={color}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={strokeDasharray}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900 dark:text-white">{Math.round(percentage)}%</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">Cache Hit</span>
      </div>
    </div>
  );
}

export function DNS({ integrationId, config, widgetId }: DNSProps) {
  const { data, loading, error } = useWidgetData<DNSData>({
    integrationId,
    metric: 'dns',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'stats';
  const metricSize = (config.metricSize as string) || 'medium';

  const getMetricSizeClass = () => {
    switch (metricSize) {
      case 'small': return 'text-lg';
      case 'large': return 'text-3xl';
      default: return 'text-2xl';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const renderStatsView = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div className={`${getMetricSizeClass()} font-bold text-blue-600 dark:text-blue-400`}>
            {formatNumber(data?.stats.totalQueries || 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Queries</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div className={`${getMetricSizeClass()} font-bold text-green-600 dark:text-green-400`}>
            {formatNumber(data?.stats.cacheHits || 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Cache Hits</div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Cache Hit Rate</span>
          <span className={`font-bold ${
            (data?.stats.cacheHitRate || 0) >= 80 ? 'text-green-600 dark:text-green-400' :
            (data?.stats.cacheHitRate || 0) >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {(data?.stats.cacheHitRate || 0).toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              (data?.stats.cacheHitRate || 0) >= 80 ? 'bg-green-500' :
              (data?.stats.cacheHitRate || 0) >= 50 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${data?.stats.cacheHitRate || 0}%` }}
          />
        </div>
      </div>

      {data?.stats.blockedQueries !== undefined && data.stats.blockedQueries > 0 && (
        <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-gray-300">Blocked Queries</span>
          <span className="font-bold text-red-600 dark:text-red-400">
            {formatNumber(data.stats.blockedQueries)}
          </span>
        </div>
      )}
    </div>
  );

  const renderChartView = () => (
    <div className="flex flex-col items-center justify-center py-4">
      <CacheHitGauge percentage={data?.stats.cacheHitRate || 0} />

      <div className="grid grid-cols-2 gap-4 mt-4 w-full">
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatNumber(data?.stats.cacheHits || 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Hits</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
            {formatNumber(data?.stats.cacheMisses || 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Misses</div>
        </div>
      </div>
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      {!data?.recentQueries?.length ? (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          No recent queries
        </div>
      ) : (
        data.recentQueries.slice(0, 10).map((query, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-gray-900 dark:text-white truncate">
                {query.query}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {query.client} • {query.type}
              </div>
            </div>
            <div className="ml-2 flex items-center gap-1">
              {query.cached && (
                <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                  cached
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (!data && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <p className="text-sm">DNS statistics unavailable</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="flex flex-col h-full">
          {!hideLabels && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                DNS Statistics
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Unbound
              </span>
            </div>
          )}
          {visualizationType === 'chart' ? renderChartView() :
           visualizationType === 'list' ? renderListView() : renderStatsView()}
        </div>
      )}
    </BaseWidget>
  );
}
