import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { BazarrWanted } from '../../../types';
import { DonutChart } from '../../common/visualizations';
import { ScaledMetric } from '../../common/ScaledMetric';

interface WantedData {
  wanted: BazarrWanted;
}

interface WantedOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function WantedOverview({ integrationId, config, widgetId }: WantedOverviewProps) {
  const { data, loading, error } = useWidgetData<WantedData>({
    integrationId,
    metric: 'wanted',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'numbers';
  const hideLabels = (config.hideLabels as boolean) || false;
  const showSeries = config.showSeries !== false;
  const showMovies = config.showMovies !== false;
  const showTotal = config.showTotal !== false;
  const wanted = data?.wanted;

  if (!wanted) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No wanted data available
        </div>
      </BaseWidget>
    );
  }

  const seriesPercentComplete = wanted.seriesTotal > 0
    ? Math.round(((wanted.seriesTotal - wanted.seriesMissing) / wanted.seriesTotal) * 100)
    : 100;
  const moviesPercentComplete = wanted.moviesTotal > 0
    ? Math.round(((wanted.moviesTotal - wanted.moviesMissing) / wanted.moviesTotal) * 100)
    : 100;
  const totalMissing = wanted.seriesMissing + wanted.moviesMissing;

  // Donut visualization
  if (visualization === 'donut') {
    const segments = [];
    if (showSeries && wanted.seriesMissing > 0) {
      segments.push({ label: 'Series Missing', value: wanted.seriesMissing, color: '#3B82F6' });
    }
    if (showMovies && wanted.moviesMissing > 0) {
      segments.push({ label: 'Movies Missing', value: wanted.moviesMissing, color: '#8B5CF6' });
    }
    if (segments.length === 0) {
      segments.push({ label: 'Complete', value: 1, color: '#22C55E' });
    }

    return (
      <BaseWidget loading={loading} error={error}>
        <DonutChart
          segments={segments}
          centerValue={totalMissing}
          centerLabel={hideLabels ? undefined : 'missing'}
          responsive
          showLegend={!hideLabels}
        />
      </BaseWidget>
    );
  }

  // Large numbers visualization
  if (visualization === 'numbers') {
    const visibleCount = [showSeries, showMovies, showTotal].filter(Boolean).length;
    const singleMetric = visibleCount === 1;

    if (singleMetric) {
      const value = showTotal ? totalMissing : showSeries ? wanted.seriesMissing : wanted.moviesMissing;
      const color = value === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
      return (
        <BaseWidget loading={loading} error={error}>
          <ScaledMetric value={value.toLocaleString()} className={color} />
        </BaseWidget>
      );
    }

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <div className={`grid gap-4 ${visibleCount === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {showSeries && (
              <div className="text-center">
                <div className={`text-3xl font-bold ${wanted.seriesMissing > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                  {wanted.seriesMissing.toLocaleString()}
                </div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Series</div>}
              </div>
            )}
            {showMovies && (
              <div className="text-center">
                <div className={`text-3xl font-bold ${wanted.moviesMissing > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'}`}>
                  {wanted.moviesMissing.toLocaleString()}
                </div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Movies</div>}
              </div>
            )}
            {showTotal && (
              <div className="text-center">
                <div className={`text-3xl font-bold ${totalMissing > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  {totalMissing.toLocaleString()}
                </div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</div>}
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: bars/progress visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-4">
        {/* Episodes Subtitles */}
        {showSeries && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                {!hideLabels && <span className="text-sm font-medium text-gray-900 dark:text-white">Episodes</span>}
              </div>
              <span className={`text-sm font-semibold ${wanted.seriesMissing > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                {wanted.seriesMissing.toLocaleString()} missing
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${seriesPercentComplete === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${seriesPercentComplete}%` }}
              />
            </div>
            {!hideLabels && (
              <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{(wanted.seriesTotal - wanted.seriesMissing).toLocaleString()} of {wanted.seriesTotal.toLocaleString()} complete</span>
                <span>{seriesPercentComplete}%</span>
              </div>
            )}
          </div>
        )}

        {/* Movies Subtitles */}
        {showMovies && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {!hideLabels && <span className="text-sm font-medium text-gray-900 dark:text-white">Movies</span>}
              </div>
              <span className={`text-sm font-semibold ${wanted.moviesMissing > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                {wanted.moviesMissing.toLocaleString()} missing
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${moviesPercentComplete === 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                style={{ width: `${moviesPercentComplete}%` }}
              />
            </div>
            {!hideLabels && (
              <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{(wanted.moviesTotal - wanted.moviesMissing).toLocaleString()} of {wanted.moviesTotal.toLocaleString()} complete</span>
                <span>{moviesPercentComplete}%</span>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {showTotal && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            totalMissing === 0
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
          }`}>
            {totalMissing === 0 ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {!hideLabels && <span className="text-sm">All subtitles complete!</span>}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {!hideLabels && <span className="text-sm">{totalMissing} total missing subtitles</span>}
              </>
            )}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
