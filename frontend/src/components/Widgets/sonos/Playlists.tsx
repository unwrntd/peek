import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SonosPlaylist {
  id: string;
  name: string;
  type: string;
  trackCount?: number;
}

interface SonosGroup {
  id: string;
  name: string;
}

interface PlaylistsData {
  playlists: SonosPlaylist[];
  groups: SonosGroup[];
}

interface PlaylistsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Playlists({ integrationId, config, widgetId }: PlaylistsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const { data, loading, error, refetch } = useWidgetData<PlaylistsData>({
    integrationId,
    metric: 'playlists',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const selectedGroup = config.selectedGroup as string | undefined;
  const showTrackCount = config.showTrackCount !== false;
  const maxItems = (config.maxItems as number) || 20;

  const handlePlayPlaylist = useCallback(async (playlistId: string, groupId: string) => {
    if (isLoading) return;
    setIsLoading(playlistId);
    try {
      const response = await fetch(`/api/sonos-control/${integrationId}/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, playlistId }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 1000);
      }
    } catch (err) {
      console.error('Failed to play playlist:', err);
    } finally {
      setIsLoading(null);
    }
  }, [integrationId, isLoading, refetch]);

  const playlists = (data?.playlists || []).slice(0, maxItems);
  const groups = data?.groups || [];

  // Determine which group to play to
  const targetGroup = selectedGroup
    ? groups.find(g => g.name.toLowerCase().includes(selectedGroup.toLowerCase()) || g.id === selectedGroup)
    : groups[0];

  return (
    <BaseWidget loading={loading} error={error}>
      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm">No playlists found</p>
        </div>
      ) : !targetGroup ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-sm">No speaker group available</p>
        </div>
      ) : (
        <div className="space-y-1">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => handlePlayPlaylist(playlist.id, targetGroup.id)}
              disabled={isLoading !== null}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 group ${
                isLoading === playlist.id ? 'opacity-50' : ''
              }`}
            >
              <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {playlist.name}
                </p>
                {showTrackCount && playlist.trackCount !== undefined && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <svg className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
