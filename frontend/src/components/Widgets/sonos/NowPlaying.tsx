import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SonosTrack {
  type: 'track' | 'episode' | 'ad';
  name: string;
  artist?: {
    name: string;
  };
  album?: {
    name: string;
  };
  imageUrl?: string;
  durationMillis?: number;
  service?: {
    name: string;
    id: string;
    imageUrl?: string;
  };
}

interface SonosVolume {
  volume: number;
  muted: boolean;
  fixed: boolean;
}

interface SonosNowPlaying {
  groupId: string;
  groupName: string;
  playbackState: string;
  track?: SonosTrack;
  positionMillis?: number;
  volume?: SonosVolume;
  players: string[];
}

interface NowPlayingData {
  nowPlaying: SonosNowPlaying[];
}

interface NowPlayingProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getPlaybackStateIcon(state: string): string {
  switch (state) {
    case 'PLAYBACK_STATE_PLAYING':
      return 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z';
    case 'PLAYBACK_STATE_PAUSED':
      return 'M10 9v6m4-6v6';
    case 'PLAYBACK_STATE_BUFFERING':
      return 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';
    default:
      return 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }
}

function getPlaybackStateColor(state: string): string {
  switch (state) {
    case 'PLAYBACK_STATE_PLAYING':
      return 'text-green-500';
    case 'PLAYBACK_STATE_PAUSED':
      return 'text-yellow-500';
    case 'PLAYBACK_STATE_BUFFERING':
      return 'text-blue-500';
    default:
      return 'text-gray-400';
  }
}

export function NowPlaying({ integrationId, config, widgetId }: NowPlayingProps) {
  const [isControlling, setIsControlling] = useState(false);

  const { data, loading, error, refetch } = useWidgetData<NowPlayingData>({
    integrationId,
    metric: 'now-playing',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const showAlbumArt = config.showAlbumArt !== false;
  const showControls = config.showControls !== false;
  const showVolume = config.showVolume !== false;
  const showService = config.showService !== false;
  const selectedGroup = config.selectedGroup as string | undefined;

  const handleControl = useCallback(async (action: string, groupId: string, params?: Record<string, unknown>) => {
    if (isControlling) return;
    setIsControlling(true);
    try {
      const response = await fetch(`/api/sonos-control/${integrationId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, ...params }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 500);
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setIsControlling(false);
    }
  }, [integrationId, isControlling, refetch]);

  // Filter to selected group if specified
  let nowPlayingList = data?.nowPlaying || [];
  if (selectedGroup) {
    nowPlayingList = nowPlayingList.filter(np =>
      np.groupName.toLowerCase().includes(selectedGroup.toLowerCase()) ||
      np.groupId === selectedGroup
    );
  }

  // Get the first group with content, or the first group overall
  const nowPlaying = nowPlayingList.find(np => np.track) || nowPlayingList[0];

  const isPlaying = nowPlaying?.playbackState === 'PLAYBACK_STATE_PLAYING';

  return (
    <BaseWidget loading={loading} error={error}>
      {!nowPlaying ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-sm">No active speakers</p>
        </div>
      ) : !nowPlaying.track ? (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 mb-3">
            <div className={`${getPlaybackStateColor(nowPlaying.playbackState)}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getPlaybackStateIcon(nowPlaying.playbackState)} />
              </svg>
            </div>
            <span className="font-medium text-gray-900 dark:text-white truncate">{nowPlaying.groupName}</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">Nothing playing</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header with group name */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`flex-shrink-0 ${getPlaybackStateColor(nowPlaying.playbackState)}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getPlaybackStateIcon(nowPlaying.playbackState)} />
                </svg>
              </div>
              <span className="font-medium text-gray-900 dark:text-white truncate">{nowPlaying.groupName}</span>
            </div>
            {showService && nowPlaying.track.service && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate ml-2">
                {nowPlaying.track.service.name}
              </span>
            )}
          </div>

          {/* Main content */}
          <div className="flex gap-3 flex-1 min-h-0">
            {/* Album Art */}
            {showAlbumArt && (
              <div className="flex-shrink-0">
                {nowPlaying.track.imageUrl ? (
                  <img
                    src={nowPlaying.track.imageUrl}
                    alt="Album art"
                    className="w-20 h-20 rounded-lg object-cover shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Track Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {nowPlaying.track.name}
              </p>
              {nowPlaying.track.artist && (
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {nowPlaying.track.artist.name}
                </p>
              )}
              {nowPlaying.track.album && (
                <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                  {nowPlaying.track.album.name}
                </p>
              )}

              {/* Progress */}
              {nowPlaying.track.durationMillis && nowPlaying.positionMillis !== undefined && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatDuration(nowPlaying.positionMillis)}</span>
                  <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${(nowPlaying.positionMillis / nowPlaying.track.durationMillis) * 100}%` }}
                    />
                  </div>
                  <span>{formatDuration(nowPlaying.track.durationMillis)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          {showControls && (
            <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handleControl('previous', nowPlaying.groupId)}
                disabled={isControlling}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handleControl('toggle', nowPlaying.groupId)}
                disabled={isControlling}
                className={`p-3 rounded-full transition-colors disabled:opacity-50 ${
                  isPlaying
                    ? 'bg-primary-500 hover:bg-primary-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isPlaying ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
              </button>
              <button
                onClick={() => handleControl('next', nowPlaying.groupId)}
                disabled={isControlling}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Volume */}
          {showVolume && nowPlaying.volume && !nowPlaying.volume.fixed && (
            <div className="flex items-center gap-2 mt-2 text-sm">
              <button
                onClick={() => handleControl('mute', nowPlaying.groupId, { muted: !nowPlaying.volume!.muted })}
                disabled={isControlling}
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 ${
                  nowPlaying.volume.muted ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {nowPlaying.volume.muted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  )}
                </svg>
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={nowPlaying.volume.volume}
                onChange={(e) => handleControl('volume', nowPlaying.groupId, { volume: parseInt(e.target.value) })}
                disabled={isControlling || nowPlaying.volume.muted}
                className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                {nowPlaying.volume.volume}%
              </span>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
