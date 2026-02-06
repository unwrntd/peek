import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { CircularGauge } from '../../common/visualizations';
import { PlexTranscodeSession } from '../../../types';

interface TranscodingStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TranscodeData {
  transcodeSessions: PlexTranscodeSession[];
}

function getDecisionLabel(decision: string): string {
  switch (decision) {
    case 'directplay': return 'Direct Play';
    case 'copy': return 'Direct Stream';
    case 'transcode': return 'Transcode';
    default: return decision;
  }
}

function getDecisionColor(decision: string): string {
  switch (decision) {
    case 'directplay': return 'text-green-600 dark:text-green-400';
    case 'copy': return 'text-blue-600 dark:text-blue-400';
    case 'transcode': return 'text-orange-600 dark:text-orange-400';
    default: return 'text-gray-600 dark:text-gray-400';
  }
}

function getDecisionBadge(decision: string): string {
  switch (decision) {
    case 'directplay': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'copy': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    case 'transcode': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  }
}

export function TranscodingStatus({ integrationId, config, widgetId }: TranscodingStatusProps) {
  const { data, loading, error } = useWidgetData<TranscodeData>({
    integrationId,
    metric: (config.metric as string) || 'transcode-sessions',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const showProgress = config.showProgress !== false;
  const showSpeed = config.showSpeed !== false;
  const showVideoDecision = config.showVideoDecision !== false;
  const showAudioDecision = config.showAudioDecision !== false;
  const showHwAccel = config.showHwAccel !== false;
  const compactView = config.compactView === true || visualization === 'compact';
  const hideLabels = (config.hideLabels as boolean) || false;

  const activeSessions = data?.transcodeSessions.filter(s => !s.complete) || [];
  const hwAccelCount = activeSessions.filter(s => s.transcodeHwFullPipeline).length;

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {activeSessions.length > 0 ? (
            activeSessions.map((session, index) => (
              <div key={session.key || index} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${session.transcodeHwFullPipeline ? 'bg-green-500' : 'bg-orange-500'}`} />
                <span className="flex-1 truncate text-gray-200">
                  {Math.round(session.progress)}%
                </span>
                {showSpeed && (
                  <span className="flex-shrink-0 text-xs text-gray-500">{session.speed.toFixed(1)}x</span>
                )}
                <span className={`flex-shrink-0 text-xs ${getDecisionColor(session.videoDecision)}`}>
                  {getDecisionLabel(session.videoDecision)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">No active transcodes</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Gauges visualization
  if (visualization === 'gauges') {
    return (
      <BaseWidget loading={loading} error={error}>
        {activeSessions.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {activeSessions.slice(0, 4).map((session, index) => (
              <div key={session.key || index} className="flex flex-col items-center">
                <CircularGauge
                  value={session.progress}
                  max={100}
                  size="md"
                  showValue
                  unit="%"
                />
                {!hideLabels && (
                  <div className="mt-2 text-center">
                    <span className={`text-xs ${getDecisionColor(session.videoDecision)}`}>
                      {getDecisionLabel(session.videoDecision)}
                    </span>
                    {showSpeed && (
                      <span className="text-xs text-gray-500 ml-1">{session.speed.toFixed(1)}x</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <p>No active transcodes</p>
          </div>
        )}
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={compactView ? 'space-y-2' : 'space-y-3'}>
          {/* Summary */}
          {!hideLabels && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${activeSessions.length > 0 ? 'bg-orange-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {activeSessions.length} active
                  </span>
                </div>
                {hwAccelCount > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                    {hwAccelCount} HW accelerated
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sessions */}
          {activeSessions.length > 0 ? (
            <div className={compactView ? 'space-y-2' : 'space-y-3'}>
              {activeSessions.map((session, index) => (
                <div
                  key={session.key || index}
                  className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
                >
                  {/* Progress */}
                  {showProgress && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(session.progress)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all"
                          style={{ width: `${session.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className={`grid ${hideLabels ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} gap-2 text-sm`}>
                    {showSpeed && (
                      <div>
                        {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Speed</div>}
                        <div className={`font-medium ${session.throttled ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                          {session.speed.toFixed(1)}x
                          {session.throttled && !hideLabels && <span className="text-xs ml-1">(throttled)</span>}
                        </div>
                      </div>
                    )}

                    {showVideoDecision && (
                      <div>
                        {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Video</div>}
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded ${getDecisionBadge(session.videoDecision)}`}>
                          {getDecisionLabel(session.videoDecision)}
                        </span>
                      </div>
                    )}

                    {showAudioDecision && (
                      <div>
                        {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Audio</div>}
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded ${getDecisionBadge(session.audioDecision)}`}>
                          {getDecisionLabel(session.audioDecision)}
                        </span>
                      </div>
                    )}

                    {showHwAccel && (
                      <div>
                        {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Hardware</div>}
                        <div className="flex items-center gap-1">
                          {session.transcodeHwFullPipeline ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {!hideLabels && 'Enabled'}
                            </span>
                          ) : session.transcodeHwRequested ? (
                            <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              {!hideLabels && 'Partial'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {!hideLabels && 'Software'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <p>No active transcodes</p>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
