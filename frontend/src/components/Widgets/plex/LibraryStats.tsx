import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { DonutChart } from '../../common/visualizations';
import { ScaledMetric } from '../../common/ScaledMetric';
import { PlexLibraryStats } from '../../../types';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';

interface LibraryStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface LibraryData {
  libraryStats: PlexLibraryStats;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getLibraryIcon(type: string): string {
  switch (type) {
    case 'movie': return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
    case 'show': return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    case 'artist': return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
    case 'photo': return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
    default: return 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10';
  }
}

function getLibraryColor(type: string): string {
  switch (type) {
    case 'movie': return 'text-orange-500 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
    case 'show': return 'text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    case 'artist': return 'text-purple-500 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
    case 'photo': return 'text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    default: return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
  }
}

const chartColors = ['#F97316', '#3B82F6', '#8B5CF6', '#10B981'];

export function LibraryStats({ integrationId, config, widgetId }: LibraryStatsProps) {
  const { data, loading, error } = useWidgetData<LibraryData>({
    integrationId,
    metric: (config.metric as string) || 'libraries',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  // Get widget dimensions for content scaling
  const dimensions = useWidgetDimensions();

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

  const visualization = (config.visualization as string) || 'bars';
  const showMovies = config.showMovies !== false;
  const showShows = config.showShows !== false;
  const showMusic = config.showMusic !== false;
  const showPhotos = config.showPhotos !== false;
  const showLibraries = config.showLibraries === true;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;

  const metricSize = (config.metricSize as string) || 'md';
  // Base font sizes in pixels for different metric sizes (before scaling)
  const baseFontSizes: Record<string, number> = hideLabels ? {
    xs: 18,
    sm: 20,
    md: 24,
    lg: 30,
    xl: 36,
    xxl: 48,
    xxxl: 60,
  } : {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  };
  const baseFontSize = baseFontSizes[metricSize] || (hideLabels ? 24 : 16);
  const scaledFontSize = baseFontSize * scale;
  const labelFontSize = 12 * scale;
  const iconSize = 16 * scale;
  const iconPadding = 8 * scale;

  // Donut visualization
  if (visualization === 'donut') {
    const segments = [];
    const stats = data?.libraryStats;
    if (stats) {
      if (showMovies && stats.totalMovies > 0) segments.push({ label: 'Movies', value: stats.totalMovies, color: chartColors[0] });
      if (showShows && stats.totalShows > 0) segments.push({ label: 'Shows', value: stats.totalShows, color: chartColors[1] });
      if (showMusic && stats.totalMusic > 0) segments.push({ label: 'Music', value: stats.totalMusic, color: chartColors[2] });
      if (showPhotos && stats.totalPhotos > 0) segments.push({ label: 'Photos', value: stats.totalPhotos, color: chartColors[3] });
    }
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    return (
      <BaseWidget loading={loading} error={error}>
        {segments.length > 0 ? (
          <DonutChart
            segments={segments}
            centerValue={formatNumber(total)}
            centerLabel={hideLabels ? undefined : 'items'}
            responsive
            showLegend={!hideLabels}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No library data
          </div>
        )}
      </BaseWidget>
    );
  }

  // Numbers visualization - large metrics
  if (visualization === 'numbers') {
    const stats = data?.libraryStats;
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          {stats ? (
            <div className="grid grid-cols-2 gap-4 text-center">
              {showMovies && stats.totalMovies > 0 && (
                <div>
                  <ScaledMetric value={formatNumber(stats.totalMovies)} className="text-orange-500" />
                  {!hideLabels && <div className="text-sm text-gray-500">Movies</div>}
                </div>
              )}
              {showShows && stats.totalShows > 0 && (
                <div>
                  <ScaledMetric value={formatNumber(stats.totalShows)} className="text-blue-500" />
                  {!hideLabels && <div className="text-sm text-gray-500">Shows</div>}
                </div>
              )}
              {showMusic && stats.totalMusic > 0 && (
                <div>
                  <ScaledMetric value={formatNumber(stats.totalMusic)} className="text-purple-500" />
                  {!hideLabels && <div className="text-sm text-gray-500">Artists</div>}
                </div>
              )}
              {showPhotos && stats.totalPhotos > 0 && (
                <div>
                  <ScaledMetric value={formatNumber(stats.totalPhotos)} className="text-green-500" />
                  {!hideLabels && <div className="text-sm text-gray-500">Photos</div>}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No data</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Bars visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {data?.libraryStats && (
        <div style={{ gap: `${(compactView ? 8 : 12) * scale}px` }} className="flex flex-col">
          {/* Summary Stats */}
          <div
            className={`grid ${hideLabels ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}
            style={{ gap: `${(hideLabels ? 16 : 12) * scale}px` }}
          >
            {showMovies && data.libraryStats.totalMovies > 0 && (
              <div className={`${hideLabels ? 'text-center' : 'flex items-center'}`} style={{ gap: `${8 * scale}px` }}>
                {!hideLabels && (
                  <div
                    className={`rounded-lg ${getLibraryColor('movie')}`}
                    style={{ padding: `${iconPadding}px` }}
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getLibraryIcon('movie')} />
                    </svg>
                  </div>
                )}
                <div>
                  <div
                    className="font-semibold text-gray-900 dark:text-white"
                    style={{ fontSize: `${scaledFontSize}px` }}
                  >
                    {formatNumber(data.libraryStats.totalMovies)}
                  </div>
                  {!hideLabels && (
                    <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>
                      Movies
                    </div>
                  )}
                </div>
              </div>
            )}

            {showShows && data.libraryStats.totalShows > 0 && (
              <div className={`${hideLabels ? 'text-center' : 'flex items-center'}`} style={{ gap: `${8 * scale}px` }}>
                {!hideLabels && (
                  <div
                    className={`rounded-lg ${getLibraryColor('show')}`}
                    style={{ padding: `${iconPadding}px` }}
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getLibraryIcon('show')} />
                    </svg>
                  </div>
                )}
                <div>
                  <div
                    className="font-semibold text-gray-900 dark:text-white"
                    style={{ fontSize: `${scaledFontSize}px` }}
                  >
                    {formatNumber(data.libraryStats.totalShows)}
                  </div>
                  {!hideLabels && (
                    <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>
                      Shows {data.libraryStats.totalEpisodes > 0 && `(${formatNumber(data.libraryStats.totalEpisodes)} ep)`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showMusic && data.libraryStats.totalMusic > 0 && (
              <div className={`${hideLabels ? 'text-center' : 'flex items-center'}`} style={{ gap: `${8 * scale}px` }}>
                {!hideLabels && (
                  <div
                    className={`rounded-lg ${getLibraryColor('artist')}`}
                    style={{ padding: `${iconPadding}px` }}
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getLibraryIcon('artist')} />
                    </svg>
                  </div>
                )}
                <div>
                  <div
                    className="font-semibold text-gray-900 dark:text-white"
                    style={{ fontSize: `${scaledFontSize}px` }}
                  >
                    {formatNumber(data.libraryStats.totalMusic)}
                  </div>
                  {!hideLabels && (
                    <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>
                      Artists
                    </div>
                  )}
                </div>
              </div>
            )}

            {showPhotos && data.libraryStats.totalPhotos > 0 && (
              <div className={`${hideLabels ? 'text-center' : 'flex items-center'}`} style={{ gap: `${8 * scale}px` }}>
                {!hideLabels && (
                  <div
                    className={`rounded-lg ${getLibraryColor('photo')}`}
                    style={{ padding: `${iconPadding}px` }}
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getLibraryIcon('photo')} />
                    </svg>
                  </div>
                )}
                <div>
                  <div
                    className="font-semibold text-gray-900 dark:text-white"
                    style={{ fontSize: `${scaledFontSize}px` }}
                  >
                    {formatNumber(data.libraryStats.totalPhotos)}
                  </div>
                  {!hideLabels && (
                    <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px` }}>
                      Photos
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Individual Libraries */}
          {showLibraries && !hideLabels && data.libraryStats.libraries.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700" style={{ paddingTop: `${8 * scale}px` }}>
              <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: `${labelFontSize}px`, marginBottom: `${8 * scale}px` }}>
                Libraries
              </div>
              <div style={{ gap: `${6 * scale}px` }} className="flex flex-col">
                {data.libraryStats.libraries.map((library) => (
                  <div key={library.key} className="flex items-center justify-between">
                    <div className="flex items-center" style={{ gap: `${8 * scale}px` }}>
                      <div
                        className={`rounded-full ${getLibraryColor(library.type).split(' ')[0]}`}
                        style={{ width: `${8 * scale}px`, height: `${8 * scale}px` }}
                      />
                      <span className="text-gray-700 dark:text-gray-300" style={{ fontSize: `${14 * scale}px` }}>
                        {library.title}
                      </span>
                      {library.refreshing && (
                        <span className="text-yellow-600 dark:text-yellow-400" style={{ fontSize: `${labelFontSize}px` }}>
                          (refreshing)
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white" style={{ fontSize: `${14 * scale}px` }}>
                      {formatNumber(library.count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
