import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';
import { PlexServerInfo } from '../../../types';

interface ServerStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ServerData {
  serverInfo: PlexServerInfo;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function ServerStatus({ integrationId, config, widgetId }: ServerStatusProps) {
  const { data, loading, error } = useWidgetData<ServerData>({
    integrationId,
    metric: (config.metric as string) || 'server-info',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const showName = config.showName !== false;
  const showVersion = config.showVersion !== false;
  const showPlatform = config.showPlatform !== false;
  const showStreams = config.showStreams !== false;
  const showUser = config.showUser !== false;
  const compactView = config.compactView === true || visualization === 'compact';
  const hideLabels = (config.hideLabels as boolean) || false;

  const metricSize = (config.metricSize as string) || 'md';
  const metricSizeClasses: Record<string, string> = hideLabels ? {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  } : {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };
  const metricClass = metricSizeClasses[metricSize] || (hideLabels ? 'text-2xl' : 'text-base');

  // Metrics visualization - large numbers
  if (visualization === 'metrics') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          {data?.serverInfo ? (
            <div className="text-center">
              <ScaledMetric
                value={data.serverInfo.transcoderActiveVideoSessions.toString()}
                className={data.serverInfo.transcoderActiveVideoSessions > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}
              />
              {!hideLabels && (
                <div className="text-sm text-gray-500 mt-1">Active Streams</div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No data</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        {data?.serverInfo ? (
          <div className="space-y-2 text-sm">
            {showName && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Server</span>
                <span className="text-gray-900 dark:text-white truncate ml-2">{data.serverInfo.friendlyName}</span>
              </div>
            )}
            {showVersion && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Version</span>
                <span className="text-gray-900 dark:text-white">v{data.serverInfo.version}</span>
              </div>
            )}
            {showPlatform && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Platform</span>
                <span className="text-gray-900 dark:text-white">{data.serverInfo.platform}</span>
              </div>
            )}
            {showStreams && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Streams</span>
                <span className={data.serverInfo.transcoderActiveVideoSessions > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}>
                  {data.serverInfo.transcoderActiveVideoSessions}
                </span>
              </div>
            )}
            {showUser && data.serverInfo.myPlexUsername && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">User</span>
                <span className="text-gray-900 dark:text-white">{data.serverInfo.myPlexUsername}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 text-center">No data</div>
        )}
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      {data?.serverInfo && (
        <div className={compactView ? 'space-y-1' : 'space-y-2'}>
          {showName && (
            <div className={hideLabels ? 'text-center' : ''}>
              {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Server Name</div>}
              <div className={`font-medium text-gray-900 dark:text-white ${metricClass}`}>
                {data.serverInfo.friendlyName}
              </div>
            </div>
          )}

          <div className={`grid ${hideLabels ? 'grid-cols-2 gap-4 text-center' : 'grid-cols-2 gap-2'}`}>
            {showVersion && (
              <div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Version</div>}
                <div className={`text-gray-900 dark:text-white ${hideLabels ? metricClass : 'text-sm'}`}>
                  {hideLabels ? data.serverInfo.version : `v${data.serverInfo.version}`}
                </div>
              </div>
            )}

            {showPlatform && (
              <div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Platform</div>}
                <div className={`text-gray-900 dark:text-white ${hideLabels ? metricClass : 'text-sm'}`}>
                  {data.serverInfo.platform}
                </div>
              </div>
            )}

            {showStreams && (
              <div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Active Streams</div>}
                <div className={`font-medium ${hideLabels ? metricClass : 'text-sm'} ${
                  data.serverInfo.transcoderActiveVideoSessions > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {data.serverInfo.transcoderActiveVideoSessions}
                </div>
              </div>
            )}

            {showUser && data.serverInfo.myPlexUsername && (
              <div>
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Plex User</div>}
                <div className={`text-gray-900 dark:text-white ${hideLabels ? metricClass : 'text-sm'}`}>
                  {data.serverInfo.myPlexUsername}
                </div>
              </div>
            )}
          </div>

          {!hideLabels && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${data.serverInfo.claimed ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {data.serverInfo.claimed ? 'Claimed' : 'Unclaimed'}
                  {data.serverInfo.myPlex && ' (Plex Pass)'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
