import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ImmichAsset } from '../../../types';

interface RecentUploadsData {
  assets: ImmichAsset[];
  total: number;
  photos: number;
  videos: number;
}

interface RecentUploadsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function RecentUploads({ integrationId, config, widgetId }: RecentUploadsProps) {
  const { data, loading, error } = useWidgetData<RecentUploadsData>({
    integrationId,
    metric: 'recent',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'grid';
  const hideLabels = (config.hideLabels as boolean) || false;
  const mediaType = (config.mediaType as string) || 'all';
  const itemCount = (config.itemCount as number) || 12;
  const showFilename = config.showFilename === true;
  const showDate = config.showDate !== false;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Loading recent uploads...</span>
        </div>
      </BaseWidget>
    );
  }

  // Filter by media type
  let filteredAssets = data.assets;
  if (mediaType === 'photos') {
    filteredAssets = data.assets.filter(a => a.type === 'IMAGE');
  } else if (mediaType === 'videos') {
    filteredAssets = data.assets.filter(a => a.type === 'VIDEO');
  }

  // Limit items
  const displayAssets = filteredAssets.slice(0, itemCount);

  if (displayAssets.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>No recent uploads</span>
        </div>
      </BaseWidget>
    );
  }

  // List visualization
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {displayAssets.map((asset) => (
            <div key={asset.id} className="flex items-center gap-2 text-sm py-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${asset.type === 'VIDEO' ? 'bg-purple-500' : 'bg-blue-500'}`} />
              <span className="flex-1 truncate text-gray-200">{asset.originalFileName}</span>
              <span className="text-xs text-gray-500">{formatDate(asset.fileCreatedAt)}</span>
            </div>
          ))}
          {!hideLabels && (
            <div className="pt-2 text-xs text-gray-500">{data.photos} photos • {data.videos} videos</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Carousel visualization - single item focus with navigation
  if (visualization === 'carousel') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          <div className="aspect-video rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            {displayAssets[0]?.type === 'VIDEO' ? (
              <svg className="w-12 h-12 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-12 h-12 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          {!hideLabels && displayAssets[0] && (
            <div className="text-center">
              <p className="text-sm text-gray-900 dark:text-white truncate">{displayAssets[0].originalFileName}</p>
              <p className="text-xs text-gray-500">{formatDate(displayAssets[0].fileCreatedAt)}</p>
            </div>
          )}
          <div className="flex justify-center gap-1">
            {displayAssets.slice(0, 5).map((_, idx) => (
              <span key={idx} className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: Grid visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Grid of assets */}
        <div className="grid grid-cols-4 gap-2">
          {displayAssets.map((asset) => (
            <div
              key={asset.id}
              className="relative aspect-square rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden group"
            >
              {/* Placeholder thumbnail */}
              <div className="absolute inset-0 flex items-center justify-center">
                {asset.type === 'VIDEO' ? (
                  <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>

              {/* Video indicator */}
              {asset.type === 'VIDEO' && (
                <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[10px] text-white flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  {asset.duration && asset.duration !== '0:00:00.000000' && (
                    <span>{asset.duration.split('.')[0].replace(/^0:/, '')}</span>
                  )}
                </div>
              )}

              {/* Favorite indicator */}
              {asset.isFavorite && (
                <div className="absolute top-1 left-1">
                  <svg className="w-3.5 h-3.5 text-yellow-400 drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              )}

              {/* Hover overlay with details */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                {showFilename && (
                  <p className="text-[10px] text-white truncate">{asset.originalFileName}</p>
                )}
                {showDate && (
                  <p className="text-[10px] text-gray-300">{formatDate(asset.fileCreatedAt)}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{displayAssets.length} recent items</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {data.photos}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {data.videos}
              </span>
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
