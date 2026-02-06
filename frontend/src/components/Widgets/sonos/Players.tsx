import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SonosPlayer {
  id: string;
  name: string;
  icon: string;
  softwareVersion: string;
  capabilities: string[];
}

interface SonosGroup {
  id: string;
  name: string;
  coordinatorId: string;
  playbackState: 'PLAYBACK_STATE_IDLE' | 'PLAYBACK_STATE_BUFFERING' | 'PLAYBACK_STATE_PLAYING' | 'PLAYBACK_STATE_PAUSED';
  playerIds: string[];
}

interface PlayersData {
  groups: SonosGroup[];
  players: SonosPlayer[];
}

interface PlayersProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getPlayerIcon(icon: string): React.ReactNode {
  const iconClass = "w-5 h-5";

  // Sonos icon types from API
  switch (icon) {
    case 'S1': // Sonos One
    case 'S13': // Sonos One SL
    case 'S26': // Sonos One (Gen 2)
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="3" width="12" height="18" rx="2" strokeWidth={2} />
          <circle cx="12" cy="14" r="3" strokeWidth={2} />
        </svg>
      );
    case 'S3': // Play:3
    case 'S5': // Play:5
    case 'S6': // Play:5 (Gen 2)
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth={2} />
          <circle cx="8" cy="12" r="2" strokeWidth={2} />
          <circle cx="16" cy="12" r="2" strokeWidth={2} />
        </svg>
      );
    case 'S9': // Playbar
    case 'S11': // Playbase
    case 'S14': // Beam
    case 'S17': // Beam (Gen 2)
    case 'S18': // Arc
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="9" width="20" height="6" rx="2" strokeWidth={2} />
          <line x1="6" y1="12" x2="8" y2="12" strokeWidth={2} />
          <line x1="11" y1="12" x2="13" y2="12" strokeWidth={2} />
          <line x1="16" y1="12" x2="18" y2="12" strokeWidth={2} />
        </svg>
      );
    case 'S15': // Sub
    case 'S21': // Sub (Gen 3)
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth={2} />
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
        </svg>
      );
    case 'S22': // Move
    case 'S23': // Move 2
    case 'S24': // Roam
    case 'S27': // Roam SL
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="7" y="2" width="10" height="20" rx="3" strokeWidth={2} />
          <circle cx="12" cy="14" r="2" strokeWidth={2} />
          <path d="M9 5h6" strokeWidth={2} strokeLinecap="round" />
        </svg>
      );
    default:
      // Generic speaker icon
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="4" width="14" height="16" rx="2" strokeWidth={2} />
          <circle cx="12" cy="13" r="3" strokeWidth={2} />
          <circle cx="12" cy="7" r="1" strokeWidth={2} />
        </svg>
      );
  }
}

function getCapabilityBadge(capability: string): { label: string; color: string } | null {
  switch (capability) {
    case 'PLAYBACK':
      return { label: 'Playback', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' };
    case 'CLOUD':
      return { label: 'Cloud', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' };
    case 'HT_PLAYBACK':
      return { label: 'Home Theater', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' };
    case 'HT_POWER_STATE':
      return { label: 'Power', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' };
    case 'AIRPLAY':
      return { label: 'AirPlay', color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
    case 'VOICE':
      return { label: 'Voice', color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' };
    default:
      return null;
  }
}

export function Players({ integrationId, config, widgetId }: PlayersProps) {
  const { data, loading, error } = useWidgetData<PlayersData>({
    integrationId,
    metric: 'groups',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showCapabilities = config.showCapabilities === true;
  const showVersion = config.showVersion === true;
  const showGroup = config.showGroup !== false;
  const compactView = config.compactView === true;

  const players = data?.players || [];
  const groups = data?.groups || [];

  // Create a map of player ID to their group
  const playerToGroup = new Map<string, SonosGroup>();
  for (const group of groups) {
    for (const playerId of group.playerIds) {
      playerToGroup.set(playerId, group);
    }
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-sm">No speakers found</p>
        </div>
      ) : (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {players.map((player) => {
            const group = playerToGroup.get(player.id);
            const isCoordinator = group?.coordinatorId === player.id;
            const isPlaying = group?.playbackState === 'PLAYBACK_STATE_PLAYING';

            return (
              <div
                key={player.id}
                className={`${compactView ? 'p-2' : 'p-3'} rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}
              >
                <div className="flex items-start gap-3">
                  {/* Player Icon */}
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    isPlaying
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {getPlayerIcon(player.icon)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Player Name */}
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {player.name}
                      </h4>
                      {isCoordinator && group && group.playerIds.length > 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          Coordinator
                        </span>
                      )}
                    </div>

                    {/* Group Name */}
                    {showGroup && group && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        Group: {group.name}
                        {isPlaying && (
                          <span className="ml-2 text-green-600 dark:text-green-400">● Playing</span>
                        )}
                      </p>
                    )}

                    {/* Version */}
                    {showVersion && player.softwareVersion && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        v{player.softwareVersion}
                      </p>
                    )}

                    {/* Capabilities */}
                    {showCapabilities && player.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {player.capabilities.map(cap => {
                          const badge = getCapabilityBadge(cap);
                          if (!badge) return null;
                          return (
                            <span
                              key={cap}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })}
                      </div>
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
