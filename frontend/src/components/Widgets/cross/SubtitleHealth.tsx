import React from 'react';
import { useCrossIntegrationData } from '../../../hooks/useCrossIntegrationData';
import { BaseWidget } from '../BaseWidget';
import { useBrandingStore } from '../../../stores/brandingStore';
import { TvIcon, MovieIcon, CheckmarkIcon } from '../../../utils/icons';

interface SubtitleHealthProps {
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SubtitleHealthData {
  healthScore: number;
  totalMissing: {
    series: number;
    movies: number;
    total: number;
  };
  popularMissing: {
    title: string;
    type: 'series' | 'movie';
    missingCount: number;
    watchCount?: number;
  }[];
  recentlyWatched: {
    title: string;
    hasMissingSubtitles: boolean;
  }[];
}

function getHealthColor(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
}

function getHealthBgColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 70) return 'bg-yellow-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

export function SubtitleHealth({ config, widgetId }: SubtitleHealthProps) {
  const { data, loading, error, missingIntegrations } = useCrossIntegrationData<SubtitleHealthData>({
    endpoint: 'subtitle-health',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle);

  // Config options
  const showHealthScore = config.showHealthScore !== false;
  const showPopularMissing = config.showPopularMissing !== false;
  const showTotals = config.showTotals !== false;
  const maxItems = (config.maxItems as number) || 5;

  // Helper to render media type icon
  const renderMediaIcon = (type: 'series' | 'movie') => {
    if (iconStyle === 'none') return null;
    if (iconStyle === 'simple') {
      return type === 'series' ? <TvIcon className="w-4 h-4" /> : <MovieIcon className="w-4 h-4" />;
    }
    return type === 'series' ? '📺' : '🎬';
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="h-full flex flex-col space-y-3">
          {/* Health Score */}
          {showHealthScore && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-bold ${getHealthColor(data.healthScore)}`}>
                  {data.healthScore}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Subtitle Health
                </div>
              </div>
              <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getHealthBgColor(data.healthScore)} transition-all duration-500`}
                  style={{ width: `${data.healthScore}%` }}
                />
              </div>
            </div>
          )}

          {/* Totals */}
          {showTotals && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {data.totalMissing.total}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Missing</div>
              </div>
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {data.totalMissing.series}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Episodes</div>
              </div>
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <div className="text-lg font-bold text-pink-600 dark:text-pink-400">
                  {data.totalMissing.movies}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Movies</div>
              </div>
            </div>
          )}

          {/* Popular Missing */}
          {showPopularMissing && data.popularMissing.length > 0 && (
            <div className="flex-1 overflow-auto">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Popular Content Missing Subtitles
              </div>
              <div className="space-y-1">
                {data.popularMissing.slice(0, maxItems).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0 text-gray-600 dark:text-gray-300">
                        {renderMediaIcon(item.type)}
                      </span>
                      <span className="truncate text-gray-900 dark:text-white">
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      {item.watchCount !== undefined && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {item.watchCount} plays
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                        {item.missingCount} missing
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No data state */}
          {data.totalMissing.total === 0 && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <div className="text-4xl mb-2 text-green-500">
                  {iconStyle === 'none' ? null : iconStyle === 'simple' ? (
                    <CheckmarkIcon className="w-10 h-10 mx-auto" />
                  ) : '✓'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  All subtitles available!
                </div>
              </div>
            </div>
          )}

          {/* Missing integrations */}
          {missingIntegrations.length > 0 && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {missingIntegrations.includes('bazarr') ? (
                <span className="text-orange-500 dark:text-orange-400">
                  Bazarr integration required
                </span>
              ) : (
                <span>
                  Add Tautulli to see popular content
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
