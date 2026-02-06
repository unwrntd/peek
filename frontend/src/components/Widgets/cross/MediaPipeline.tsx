import React from 'react';
import { useCrossIntegrationData } from '../../../hooks/useCrossIntegrationData';
import { BaseWidget } from '../BaseWidget';
import { useBrandingStore } from '../../../stores/brandingStore';
import {
  DocumentIcon,
  SearchIcon,
  TvIcon,
  MovieIcon,
  DownloadIcon,
  RefreshIcon,
  LibraryIcon,
} from '../../../utils/icons';

interface MediaPipelineProps {
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface MediaPipelineStage {
  count: number;
  source: string | null;
  pending?: number;
  healthy?: number;
  total?: number;
  wanted?: number;
  active?: number;
  speed?: number;
  speedUnit?: string;
  queue?: number;
  movies?: number;
  shows?: number;
  episodes?: number;
}

interface MediaPipelineData {
  stages: {
    requests: MediaPipelineStage;
    indexers: MediaPipelineStage;
    tvQueue: MediaPipelineStage;
    movieQueue: MediaPipelineStage;
    downloads: MediaPipelineStage;
    transcoding: MediaPipelineStage;
    available: MediaPipelineStage;
  };
  bottleneck: string | null;
  totalInPipeline: number;
}

// Pipeline stage configuration
const pipelineStages = [
  { key: 'requests', label: 'Requests', emoji: '📝', color: 'bg-blue-500', source: 'Overseerr', IconComponent: DocumentIcon },
  { key: 'indexers', label: 'Indexers', emoji: '🔍', color: 'bg-purple-500', source: 'Prowlarr', IconComponent: SearchIcon },
  { key: 'tvQueue', label: 'TV Queue', emoji: '📺', color: 'bg-indigo-500', source: 'Sonarr', IconComponent: TvIcon },
  { key: 'movieQueue', label: 'Movies', emoji: '🎬', color: 'bg-pink-500', source: 'Radarr', IconComponent: MovieIcon },
  { key: 'downloads', label: 'Downloads', emoji: '⬇️', color: 'bg-orange-500', source: 'SABnzbd/qBit', IconComponent: DownloadIcon },
  { key: 'transcoding', label: 'Transcode', emoji: '🔄', color: 'bg-yellow-500', source: 'Tdarr', IconComponent: RefreshIcon },
  { key: 'available', label: 'Library', emoji: '📚', color: 'bg-green-500', source: 'Plex', IconComponent: LibraryIcon },
] as const;

export function MediaPipeline({ config, widgetId }: MediaPipelineProps) {
  const { data, loading, error, missingIntegrations } = useCrossIntegrationData<MediaPipelineData>({
    endpoint: 'media-pipeline',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle);

  // Config options
  const showStageNames = config.showStageNames !== false;
  const showCounts = config.showCounts !== false;
  const showSources = config.showSources !== false;
  const highlightBottleneck = config.highlightBottleneck !== false;
  const compact = config.compact === true;

  const renderStage = (stageConfig: typeof pipelineStages[number], stageData: MediaPipelineStage | undefined, isBottleneck: boolean) => {
    const hasData = stageData?.source !== null;
    const count = stageData?.count ?? 0;

    // Get the appropriate icon based on iconStyle
    const getStageIcon = () => {
      if (showCounts && hasData) return count;
      if (iconStyle === 'none') return null;
      if (iconStyle === 'simple') {
        const IconComponent = stageConfig.IconComponent;
        return <IconComponent className={compact ? 'w-4 h-4' : 'w-6 h-6'} />;
      }
      return stageConfig.emoji;
    };

    return (
      <div
        key={stageConfig.key}
        className={`flex flex-col items-center ${compact ? 'px-1' : 'px-2'} ${
          isBottleneck && highlightBottleneck ? 'scale-110 z-10' : ''
        } transition-transform`}
      >
        {/* Stage icon/count */}
        <div
          className={`${compact ? 'w-8 h-8 text-sm' : 'w-12 h-12 text-lg'} rounded-full flex items-center justify-center font-bold text-white ${
            hasData ? stageConfig.color : 'bg-gray-300 dark:bg-gray-600'
          } ${isBottleneck && highlightBottleneck ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-800' : ''}`}
        >
          {getStageIcon()}
        </div>

        {/* Stage name */}
        {showStageNames && (
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} mt-1 text-center text-gray-600 dark:text-gray-400`}>
            {stageConfig.label}
          </div>
        )}

        {/* Source indicator */}
        {showSources && !compact && (
          <div className={`text-[10px] text-gray-500 dark:text-gray-400 ${hasData ? '' : 'italic'}`}>
            {hasData ? stageData?.source : 'N/A'}
          </div>
        )}

        {/* Extra info for specific stages */}
        {!compact && hasData && stageConfig.key === 'downloads' && stageData?.speed !== undefined && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            {stageData.speed} {stageData.speedUnit}
          </div>
        )}

        {!compact && hasData && stageConfig.key === 'indexers' && stageData?.healthy !== undefined && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            {stageData.healthy}/{stageData.total} healthy
          </div>
        )}

        {!compact && hasData && stageConfig.key === 'available' && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            {stageData?.movies ?? 0}M / {stageData?.shows ?? 0}S
          </div>
        )}
      </div>
    );
  };

  const renderArrow = (index: number) => (
    <div key={`arrow-${index}`} className="flex items-center text-gray-300 dark:text-gray-600">
      <svg className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="h-full flex flex-col">
          {/* Pipeline visualization */}
          <div className="flex-1 flex items-center justify-center overflow-x-auto">
            <div className="flex items-center gap-1">
              {pipelineStages.map((stage, index) => (
                <React.Fragment key={stage.key}>
                  {renderStage(
                    stage,
                    data.stages[stage.key as keyof typeof data.stages],
                    data.bottleneck === stage.key
                  )}
                  {index < pipelineStages.length - 1 && renderArrow(index)}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Summary row */}
          {!compact && (
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
              <div className="text-gray-500 dark:text-gray-400">
                {data.totalInPipeline > 0 ? (
                  <span>
                    <span className="font-medium text-gray-900 dark:text-white">{data.totalInPipeline}</span> items in pipeline
                  </span>
                ) : (
                  <span>Pipeline clear</span>
                )}
              </div>

              {data.bottleneck && highlightBottleneck && (
                <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Bottleneck: {pipelineStages.find(s => s.key === data.bottleneck)?.label}</span>
                </div>
              )}
            </div>
          )}

          {/* Missing integrations notice */}
          {missingIntegrations.length > 0 && !compact && (
            <div className="pt-2 text-[10px] text-gray-500 dark:text-gray-400">
              Missing: {missingIntegrations.slice(0, 3).join(', ')}
              {missingIntegrations.length > 3 && ` +${missingIntegrations.length - 3} more`}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
