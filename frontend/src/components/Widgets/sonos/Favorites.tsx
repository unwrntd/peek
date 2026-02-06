import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SonosFavorite {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  service?: {
    name: string;
    id: string;
    imageUrl?: string;
  };
}

interface SonosGroup {
  id: string;
  name: string;
}

interface FavoritesData {
  favorites: SonosFavorite[];
  groups: SonosGroup[];
}

interface FavoritesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Favorites({ integrationId, config, widgetId }: FavoritesProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const { data, loading, error, refetch } = useWidgetData<FavoritesData>({
    integrationId,
    metric: 'favorites',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const selectedGroup = config.selectedGroup as string | undefined;
  const showImages = config.showImages !== false;
  const showService = config.showService !== false;
  const gridView = config.gridView !== false;
  const maxItems = (config.maxItems as number) || 12;

  const handlePlayFavorite = useCallback(async (favoriteId: string, groupId: string) => {
    if (isLoading) return;
    setIsLoading(favoriteId);
    try {
      const response = await fetch(`/api/sonos-control/${integrationId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, favoriteId }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 1000);
      }
    } catch (err) {
      console.error('Failed to play favorite:', err);
    } finally {
      setIsLoading(null);
    }
  }, [integrationId, isLoading, refetch]);

  const favorites = (data?.favorites || []).slice(0, maxItems);
  const groups = data?.groups || [];

  // Determine which group to play to
  const targetGroup = selectedGroup
    ? groups.find(g => g.name.toLowerCase().includes(selectedGroup.toLowerCase()) || g.id === selectedGroup)
    : groups[0];

  return (
    <BaseWidget loading={loading} error={error}>
      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <p className="text-sm">No favorites found</p>
        </div>
      ) : !targetGroup ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-sm">No speaker group available</p>
        </div>
      ) : gridView ? (
        <div className="grid grid-cols-3 gap-2">
          {favorites.map((fav) => (
            <button
              key={fav.id}
              onClick={() => handlePlayFavorite(fav.id, targetGroup.id)}
              disabled={isLoading !== null}
              className={`relative group flex flex-col items-center p-2 rounded-lg transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                isLoading === fav.id ? 'opacity-50' : ''
              }`}
            >
              {showImages ? (
                fav.imageUrl ? (
                  <img
                    src={fav.imageUrl}
                    alt={fav.name}
                    className="w-12 h-12 rounded-lg object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
              )}
              <span className="mt-1 text-xs text-gray-700 dark:text-gray-300 text-center line-clamp-2">
                {fav.name}
              </span>
              {showService && fav.service && (
                <span className="text-[10px] text-gray-500 dark:text-gray-500 truncate max-w-full">
                  {fav.service.name}
                </span>
              )}

              {/* Play overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-primary-500 bg-opacity-90 flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((fav) => (
            <button
              key={fav.id}
              onClick={() => handlePlayFavorite(fav.id, targetGroup.id)}
              disabled={isLoading !== null}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                isLoading === fav.id ? 'opacity-50' : ''
              }`}
            >
              {showImages && (
                fav.imageUrl ? (
                  <img
                    src={fav.imageUrl}
                    alt={fav.name}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {fav.name}
                </p>
                {showService && fav.service && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {fav.service.name}
                  </p>
                )}
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
