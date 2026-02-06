import { useState } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { BaseWidget } from '../BaseWidget';
import { AdGuardStats } from '../../../types';

interface TopDomainsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface StatsData {
  stats: AdGuardStats;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function TopDomains({ integrationId, config, widgetId }: TopDomainsProps) {
  const { r } = useRedact();
  const { data, loading, error } = useWidgetData<StatsData>({
    integrationId,
    metric: 'stats',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const defaultTab = (config.defaultTab as string) || 'blocked';
  const [activeTab, setActiveTab] = useState<'blocked' | 'queried'>(defaultTab as 'blocked' | 'queried');
  const limit = (config.limit as number) || 10;
  const compactView = config.compactView === true;

  const blockedDomains = data?.stats?.top_blocked_domains || [];
  const queriedDomains = data?.stats?.top_queried_domains || [];

  const domains = activeTab === 'blocked' ? blockedDomains : queriedDomains;
  const displayDomains = domains.slice(0, limit);

  const maxQueries = displayDomains.length > 0
    ? Math.max(...displayDomains.map(d => Object.values(d)[0]))
    : 1;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('blocked')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'blocked'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Blocked
            </button>
            <button
              onClick={() => setActiveTab('queried')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'queried'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Queried
            </button>
          </div>

          <div className={`space-y-${compactView ? '1' : '2'}`}>
            {displayDomains.map((domainObj, index) => {
              const [domain, queries] = Object.entries(domainObj)[0];
              const percent = (queries / maxQueries) * 100;

              return (
                <div key={index} className="relative">
                  <div
                    className={`absolute inset-0 rounded ${
                      activeTab === 'blocked'
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-green-100 dark:bg-green-900/30'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                  <div className={`relative flex items-center justify-between ${compactView ? 'px-2 py-1' : 'px-3 py-2'}`}>
                    <span className={`${compactView ? 'text-xs' : 'text-sm'} text-gray-900 dark:text-gray-100 truncate flex-1 mr-2`}>
                      {r(domain)}
                    </span>
                    <span className={`${compactView ? 'text-xs' : 'text-sm'} font-medium text-gray-600 dark:text-gray-400`}>
                      {formatNumber(queries)}
                    </span>
                  </div>
                </div>
              );
            })}
            {displayDomains.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
                No domain data available
              </p>
            )}
          </div>
        </div>
      )}
    </BaseWidget>
  );
}
