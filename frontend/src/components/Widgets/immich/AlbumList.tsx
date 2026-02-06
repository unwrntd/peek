import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ImmichAlbum } from '../../../types';

interface AlbumListData {
  albums: ImmichAlbum[];
  total: number;
  sharedCount: number;
  totalAssets: number;
}

interface AlbumListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString();
}

export function AlbumList({ integrationId, config, widgetId }: AlbumListProps) {
  const { data, loading, error } = useWidgetData<AlbumListData>({
    integrationId,
    metric: 'albums',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'grid';
  const hideLabels = (config.hideLabels as boolean) || false;
  const albumFilter = (config.albumFilter as string) || 'all';
  const itemCount = (config.itemCount as number) || 10;
  const showOwner = config.showOwner !== false;
  const showDate = config.showDate !== false;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Loading albums...</span>
        </div>
      </BaseWidget>
    );
  }

  // Filter albums
  let filteredAlbums = data.albums;
  if (albumFilter === 'shared') {
    filteredAlbums = data.albums.filter(a => a.shared);
  } else if (albumFilter === 'owned') {
    filteredAlbums = data.albums.filter(a => !a.shared);
  }

  // Limit items
  const displayAlbums = filteredAlbums.slice(0, itemCount);

  if (displayAlbums.length === 0) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>No albums found</span>
        </div>
      </BaseWidget>
    );
  }

  // List visualization - compact list
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {displayAlbums.map((album) => (
            <div key={album.id} className="flex items-center gap-2 text-sm py-1">
              <span className="flex-1 truncate text-gray-200">{album.albumName}</span>
              <span className="text-xs text-gray-500">{album.assetCount} items</span>
              {album.shared && <span className="text-xs text-blue-500">Shared</span>}
            </div>
          ))}
          {!hideLabels && (
            <div className="pt-2 text-xs text-gray-500">{data.total} albums • {data.totalAssets.toLocaleString()} items</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization - card grid
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="grid grid-cols-2 gap-2">
          {displayAlbums.map((album) => (
            <div
              key={album.id}
              className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{album.albumName}</span>
                {album.shared && (
                  <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                )}
              </div>
              {!hideLabels && (
                <div className="text-xs text-gray-500">{album.assetCount} items</div>
              )}
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Default: Grid visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-2">
        {displayAlbums.map((album) => (
          <div
            key={album.id}
            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Album Thumbnail Placeholder */}
              <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {album.albumThumbnailAssetId ? (
                  <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {album.albumName}
                  </h4>
                  {album.shared && (
                    <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {album.assetCount} {album.assetCount === 1 ? 'item' : 'items'}
                  </span>
                  {showOwner && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {album.owner.name}
                      </span>
                    </>
                  )}
                  {showDate && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(album.updatedAt)}
                      </span>
                    </>
                  )}
                </div>
                {album.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {album.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredAlbums.length > itemCount && (
          <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
            +{filteredAlbums.length - itemCount} more albums
          </div>
        )}

        {/* Summary */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{data.total} albums</span>
            <span>{data.totalAssets.toLocaleString()} total items</span>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
