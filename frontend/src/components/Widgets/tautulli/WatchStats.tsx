import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { formatDuration } from '../../../utils/formatting';

interface TautulliStatItem {
  rowId: number;
  title: string;
  thumb?: string;
  year?: number;
  total_plays: number;
  total_duration: number;
  friendly_name?: string;
  platform?: string;
}

interface TautulliHomeStat {
  stat_id: string;
  stat_title: string;
  stat_type: 'plays' | 'duration';
  rows: TautulliStatItem[];
}

interface HomeStatsData {
  homeStats: TautulliHomeStat[];
}

interface WatchStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

const STAT_CONFIG: Record<string, { configKey: string; icon: string }> = {
  // Movies
  'top_movies': { configKey: 'showMovies', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
  'popular_movies': { configKey: 'showMovies', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
  // TV Shows
  'top_tv': { configKey: 'showTV', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  'popular_tv': { configKey: 'showTV', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  // Music
  'top_music': { configKey: 'showMusic', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
  'popular_music': { configKey: 'showMusic', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
  // Users & Platforms
  'top_users': { configKey: 'showUsers', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  'top_platforms': { configKey: 'showPlatforms', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
  'most_concurrent': { configKey: 'showConcurrent', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  // Libraries & Recent
  'top_libraries': { configKey: 'showLibraries', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  'last_watched': { configKey: 'showRecent', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
};

export function WatchStats({ integrationId, config, widgetId }: WatchStatsProps) {
  const { data, loading, error } = useWidgetData<HomeStatsData>({
    integrationId,
    metric: 'home-stats',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showMovies = config.showMovies !== false;
  const showTV = config.showTV !== false;
  const showMusic = config.showMusic !== false;
  const showUsers = config.showUsers !== false;
  const showPlatforms = config.showPlatforms !== false;
  const showConcurrent = config.showConcurrent !== false;
  const showLibraries = config.showLibraries !== false;
  const showRecent = config.showRecent !== false;
  const itemsPerCategory = Number(config.itemsPerCategory) || 5;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;

  const shouldShowStat = (statId: string): boolean => {
    const cfg = STAT_CONFIG[statId];
    if (!cfg) return true;

    switch (cfg.configKey) {
      case 'showMovies': return showMovies;
      case 'showTV': return showTV;
      case 'showMusic': return showMusic;
      case 'showUsers': return showUsers;
      case 'showPlatforms': return showPlatforms;
      case 'showConcurrent': return showConcurrent;
      case 'showLibraries': return showLibraries;
      case 'showRecent': return showRecent;
      default: return true;
    }
  };

  const filteredStats = data?.homeStats?.filter(stat => shouldShowStat(stat.stat_id)) || [];

  return (
    <BaseWidget loading={loading} error={error}>
      {filteredStats.length > 0 ? (
        <div className={compactView ? 'space-y-3' : 'space-y-4'}>
          {filteredStats.map((stat) => {
            const iconPath = STAT_CONFIG[stat.stat_id]?.icon || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
            const displayRows = stat.rows.slice(0, itemsPerCategory);

            return (
              <div key={stat.stat_id}>
                {/* Section Header */}
                {!hideLabels && (
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
                    </svg>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {stat.stat_title}
                    </span>
                  </div>
                )}

                {/* Items List */}
                <div className={compactView ? 'space-y-1' : 'space-y-2'}>
                  {displayRows.map((item, index) => (
                    <div
                      key={item.rowId || index}
                      className={`flex items-center justify-between ${compactView ? 'py-1' : 'py-1.5'} ${
                        index < displayRows.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-gray-400 w-4 flex-shrink-0">{index + 1}</span>
                        <span className="text-sm text-gray-900 dark:text-white truncate">
                          {item.friendly_name || item.title}
                        </span>
                        {item.year && (
                          <span className="text-xs text-gray-400 flex-shrink-0">({item.year})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                          {item.total_plays}
                        </span>
                        <span className="text-xs text-gray-400">plays</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No statistics available</p>
        </div>
      )}
    </BaseWidget>
  );
}
