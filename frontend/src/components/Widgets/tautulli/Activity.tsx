import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { BaseWidget } from '../BaseWidget';

interface TautulliSession {
  sessionKey: string;
  sessionId: string;
  mediaType: 'movie' | 'episode' | 'track' | 'photo' | 'clip';
  title: string;
  parentTitle?: string;
  grandparentTitle?: string;
  year?: number;
  progressPercent: number;
  duration: number;
  viewOffset: number;
  state: 'playing' | 'paused' | 'buffering';
  transcodeDecision: string;
  videoDecision?: string;
  transcodeHwFullPipeline: boolean;
  bandwidth: number;
  quality: string;
  user: string;
  friendlyName: string;
  platform: string;
  product: string;
  player: string;
  device: string;
  local: boolean;
}

interface TautulliActivity {
  streamCount: number;
  streamCountDirectPlay: number;
  streamCountDirectStream: number;
  streamCountTranscode: number;
  totalBandwidth: number;
  lanBandwidth: number;
  wanBandwidth: number;
  sessions: TautulliSession[];
}

interface ActivityData {
  activity: TautulliActivity;
}

interface ActivityProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
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

function formatBandwidth(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
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

function getDecisionBadge(decision: string, hwAccel: boolean): { text: string; color: string } {
  const text = decision === 'direct play' ? 'Direct Play' :
               decision === 'copy' ? 'Direct Stream' :
               decision === 'transcode' ? (hwAccel ? 'Transcode (HW)' : 'Transcode') :
               decision;

  const color = decision === 'direct play' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                decision === 'copy' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                decision === 'transcode' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';

  return { text, color };
}

function getMediaTitle(session: TautulliSession): string {
  if (session.mediaType === 'episode' && session.grandparentTitle) {
    return `${session.grandparentTitle} - ${session.title}`;
  }
  if (session.mediaType === 'track' && session.grandparentTitle) {
    return `${session.grandparentTitle} - ${session.title}`;
  }
  return session.title;
}

function getMediaSubtitle(session: TautulliSession): string | null {
  if (session.mediaType === 'episode' && session.parentTitle) {
    return session.parentTitle;
  }
  if (session.mediaType === 'track' && session.parentTitle) {
    return session.parentTitle;
  }
  return null;
}

export function Activity({ integrationId, config, widgetId }: ActivityProps) {
  const { rUser, rHost } = useRedact();
  const { data, loading, error } = useWidgetData<ActivityData>({
    integrationId,
    metric: 'activity',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const showProgress = config.showProgress !== false;
  const showUser = config.showUser !== false;
  const showDevice = config.showDevice !== false;
  const showQuality = config.showQuality !== false;
  const showBandwidth = config.showBandwidth !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;

  return (
    <BaseWidget loading={loading} error={error}>
      {data?.activity && (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {/* Summary */}
          {!hideLabels && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{data.activity.streamCount}</span> active
                </span>
                {data.activity.streamCountTranscode > 0 && (
                  <span className="text-orange-600 dark:text-orange-400">
                    {data.activity.streamCountTranscode} transcoding
                  </span>
                )}
              </div>
              {showBandwidth && data.activity.totalBandwidth > 0 && (
                <span className="text-gray-500 dark:text-gray-400">
                  {formatBandwidth(data.activity.totalBandwidth)}
                </span>
              )}
            </div>
          )}

          {/* Sessions List */}
          {data.activity.sessions.length > 0 ? (
            <div className={compactView ? 'space-y-2' : 'space-y-3'}>
              {data.activity.sessions.map((session) => (
                <div
                  key={session.sessionKey}
                  className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
                >
                  <div className="flex items-start gap-3">
                    {/* State Icon */}
                    <div className={`flex-shrink-0 ${getStateColor(session.state)}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getStateIcon(session.state)} />
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
                                style={{ width: `${Math.min(100, session.progressPercent)}%` }}
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
                              {rUser(session.friendlyName || session.user)}
                            </span>
                          )}
                          {showDevice && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {rHost(session.player || session.product)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quality & Bandwidth */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {showQuality && (
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${getDecisionBadge(session.transcodeDecision, session.transcodeHwFullPipeline).color}`}>
                            {getDecisionBadge(session.transcodeDecision, session.transcodeHwFullPipeline).text}
                          </span>
                        )}
                        {session.quality && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {session.quality}
                          </span>
                        )}
                        {showBandwidth && session.bandwidth > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatBandwidth(session.bandwidth)}
                          </span>
                        )}
                      </div>
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
