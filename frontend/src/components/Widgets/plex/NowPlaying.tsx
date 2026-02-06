import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { PlexSessionsData, PlexSession } from '../../../types';

interface NowPlayingProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SessionData {
  sessionsData: PlexSessionsData;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getProgressPercent(viewOffset: number, duration: number): number {
  if (!duration) return 0;
  return Math.min(100, (viewOffset / duration) * 100);
}

function getStateIcon(state: string): string {
  switch (state) {
    case 'playing': return 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z';
    case 'paused': return 'M10 9v6m4-6v6';
    case 'buffering': return 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';
    default: return 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z';
  }
}

function getStateColor(state: string): string {
  switch (state) {
    case 'playing': return 'text-green-500';
    case 'paused': return 'text-yellow-500';
    case 'buffering': return 'text-blue-500';
    default: return 'text-gray-500';
  }
}

function getDecisionBadge(decision: string): { text: string; color: string } {
  switch (decision) {
    case 'directplay':
      return { text: 'Direct Play', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' };
    case 'copy':
      return { text: 'Direct Stream', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' };
    case 'transcode':
      return { text: 'Transcode', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' };
    default:
      return { text: decision, color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
  }
}

function getMediaTitle(session: PlexSession): string {
  if (session.type === 'episode' && session.grandparentTitle) {
    return `${session.grandparentTitle} - ${session.title}`;
  }
  if (session.type === 'track' && session.grandparentTitle) {
    return `${session.grandparentTitle} - ${session.title}`;
  }
  return session.title;
}

function getMediaSubtitle(session: PlexSession): string | null {
  if (session.type === 'episode' && session.parentTitle) {
    return session.parentTitle; // Season name
  }
  if (session.type === 'track' && session.parentTitle) {
    return session.parentTitle; // Album name
  }
  return null;
}

export function NowPlaying({ integrationId, config, widgetId }: NowPlayingProps) {
  const { data, loading, error } = useWidgetData<SessionData>({
    integrationId,
    metric: (config.metric as string) || 'sessions',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const showProgress = config.showProgress !== false;
  const showUser = config.showUser !== false;
  const showDevice = config.showDevice !== false;
  const showQuality = config.showQuality !== false;
  const compactView = config.compactView === true || visualization === 'list';
  const hideLabels = (config.hideLabels as boolean) || false;

  // List visualization - compact
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        {data?.sessionsData && (
          <div className="space-y-1 overflow-y-auto h-full">
            {data.sessionsData.sessions.length > 0 ? (
              data.sessionsData.sessions.map((session) => (
                <div key={session.sessionKey} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStateColor(session.player.state).replace('text-', 'bg-')}`} />
                  <span className="flex-1 truncate text-gray-200">{getMediaTitle(session)}</span>
                  {showUser && (
                    <span className="flex-shrink-0 text-xs text-gray-500">{session.user.title}</span>
                  )}
                  {showProgress && session.duration > 0 && (
                    <span className="flex-shrink-0 text-xs text-gray-500">
                      {Math.round(getProgressPercent(session.viewOffset, session.duration))}%
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">Nothing playing</div>
            )}
          </div>
        )}
      </BaseWidget>
    );
  }

  // Posters visualization - grid of media items
  if (visualization === 'posters') {
    return (
      <BaseWidget loading={loading} error={error}>
        {data?.sessionsData && (
          <div className="h-full">
            {data.sessionsData.sessions.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {data.sessionsData.sessions.map((session) => (
                  <div
                    key={session.sessionKey}
                    className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className={`w-2 h-2 rounded-full ${getStateColor(session.player.state).replace('text-', 'bg-')}`} />
                      <span className={`text-xs ${getStateColor(session.player.state)}`}>{session.player.state}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{getMediaTitle(session)}</p>
                    {getMediaSubtitle(session) && (
                      <p className="text-xs text-gray-500 truncate">{getMediaSubtitle(session)}</p>
                    )}
                    {showUser && !hideLabels && (
                      <p className="text-xs text-gray-400 mt-1">{session.user.title}</p>
                    )}
                    {showProgress && session.duration > 0 && (
                      <div className="mt-2 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${getProgressPercent(session.viewOffset, session.duration)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>Nothing playing</p>
              </div>
            )}
          </div>
        )}
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {data?.sessionsData && (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {/* Summary */}
          {!hideLabels && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{data.sessionsData.totalSessions}</span> active
                </span>
                {data.sessionsData.transcoding > 0 && (
                  <span className="text-orange-600 dark:text-orange-400">
                    {data.sessionsData.transcoding} transcoding
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sessions List */}
          {data.sessionsData.sessions.length > 0 ? (
            <div className={compactView ? 'space-y-2' : 'space-y-3'}>
              {data.sessionsData.sessions.map((session) => (
                <div
                  key={session.sessionKey}
                  className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
                >
                  <div className="flex items-start gap-3">
                    {/* State Icon */}
                    <div className={`flex-shrink-0 ${getStateColor(session.player.state)}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getStateIcon(session.player.state)} />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {getMediaTitle(session)}
                      </div>

                      {/* Subtitle */}
                      {getMediaSubtitle(session) && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {getMediaSubtitle(session)}
                        </div>
                      )}

                      {/* Progress Bar */}
                      {showProgress && session.duration > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatDuration(session.viewOffset)}</span>
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 rounded-full transition-all"
                                style={{ width: `${getProgressPercent(session.viewOffset, session.duration)}%` }}
                              />
                            </div>
                            <span>{formatDuration(session.duration)}</span>
                          </div>
                        </div>
                      )}

                      {/* User & Device */}
                      {(showUser || showDevice) && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {showUser && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {session.user.title}
                            </span>
                          )}
                          {showDevice && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {session.player.title}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quality Badge */}
                      {showQuality && session.transcodeSession && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${getDecisionBadge(session.transcodeSession.videoDecision).color}`}>
                            {getDecisionBadge(session.transcodeSession.videoDecision).text}
                            {session.transcodeSession.transcodeHwFullPipeline && ' (HW)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Nothing playing</p>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
