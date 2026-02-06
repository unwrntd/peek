import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SonosPlayer {
  id: string;
  name: string;
  icon: string;
  capabilities: string[];
}

interface SonosGroup {
  id: string;
  name: string;
  coordinatorId: string;
  playbackState: 'PLAYBACK_STATE_IDLE' | 'PLAYBACK_STATE_BUFFERING' | 'PLAYBACK_STATE_PLAYING' | 'PLAYBACK_STATE_PAUSED';
  playerIds: string[];
}

interface GroupsData {
  groups: SonosGroup[];
  players: SonosPlayer[];
}

interface GroupsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getPlaybackStateLabel(state: string): string {
  switch (state) {
    case 'PLAYBACK_STATE_PLAYING':
      return 'Playing';
    case 'PLAYBACK_STATE_PAUSED':
      return 'Paused';
    case 'PLAYBACK_STATE_BUFFERING':
      return 'Buffering';
    default:
      return 'Idle';
  }
}

function getPlaybackStateBadge(state: string): { bg: string; text: string } {
  switch (state) {
    case 'PLAYBACK_STATE_PLAYING':
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' };
    case 'PLAYBACK_STATE_PAUSED':
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' };
    case 'PLAYBACK_STATE_BUFFERING':
      return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' };
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' };
  }
}

export function Groups({ integrationId, config, widgetId }: GroupsProps) {
  const [isControlling, setIsControlling] = useState(false);

  const { data, loading, error, refetch } = useWidgetData<GroupsData>({
    integrationId,
    metric: 'groups',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const showState = config.showState !== false;
  const showPlayerCount = config.showPlayerCount !== false;
  const showControls = config.showControls !== false;
  const compactView = config.compactView === true;

  const handleControl = useCallback(async (action: string, groupId: string) => {
    if (isControlling) return;
    setIsControlling(true);
    try {
      const response = await fetch(`/api/sonos-control/${integrationId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
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

  const groups = data?.groups || [];
  const players = data?.players || [];

  // Create a map of player IDs to player names
  const playerMap = new Map(players.map(p => [p.id, p]));

  return (
    <BaseWidget loading={loading} error={error}>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-sm">No speaker groups found</p>
        </div>
      ) : (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {groups.map((group) => {
            const isPlaying = group.playbackState === 'PLAYBACK_STATE_PLAYING';
            const badge = getPlaybackStateBadge(group.playbackState);
            const groupPlayers = group.playerIds.map(id => playerMap.get(id)).filter(Boolean);

            return (
              <div
                key={group.id}
                className={`${compactView ? 'p-2' : 'p-3'} rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {group.name}
                      </h4>
                    </div>

                    {/* Player count */}
                    {showPlayerCount && groupPlayers.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
                        {groupPlayers.length} speaker{groupPlayers.length !== 1 ? 's' : ''}
                        {groupPlayers.length <= 3 && (
                          <span className="ml-1">
                            ({groupPlayers.map(p => p!.name).join(', ')})
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* State badge */}
                    {showState && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                        {getPlaybackStateLabel(group.playbackState)}
                      </span>
                    )}

                    {/* Controls */}
                    {showControls && (
                      <button
                        onClick={() => handleControl('toggle', group.id)}
                        disabled={isControlling}
                        className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${
                          isPlaying
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isPlaying ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          )}
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BaseWidget>
  );
}
