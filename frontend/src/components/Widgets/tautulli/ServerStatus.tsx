import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface TautulliServerInfo {
  tautulliVersion: string;
  tautulliInstallType: string;
  tautulliUpdateAvailable: boolean;
  pmsName: string;
  pmsVersion: string;
  pmsPlatform: string;
  pmsIp: string;
  pmsPort: number;
  pmsIsRemote: boolean;
  pmsUrl: string;
  pmsIdentifier: string;
}

interface ServerInfoData {
  serverInfo: TautulliServerInfo;
}

interface ServerStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function ServerStatus({ integrationId, config, widgetId }: ServerStatusProps) {
  const { data, loading, error } = useWidgetData<ServerInfoData>({
    integrationId,
    metric: 'server-info',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showTautulliVersion = config.showTautulliVersion !== false;
  const showPlexName = config.showPlexName !== false;
  const showPlexVersion = config.showPlexVersion !== false;
  const showPlatform = config.showPlatform !== false;
  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;

  const serverInfo = data?.serverInfo;

  return (
    <BaseWidget loading={loading} error={error}>
      {serverInfo ? (
        <div className={compactView ? 'space-y-1' : 'space-y-2'}>
          {/* Plex Server Name */}
          {showPlexName && (
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.24 12L2 5.73V18.27L11.24 12zM22 5.73L12.76 12L22 18.27V5.73z" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 dark:text-white truncate">
                  {serverInfo.pmsName}
                </div>
                {!hideLabels && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Plex Server</div>
                )}
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  Online
                </span>
              </div>
            </div>
          )}

          {/* Plex Version */}
          {showPlexVersion && (
            <div className={`flex items-center justify-between ${compactView ? 'py-0.5' : 'py-1'}`}>
              <span className="text-sm text-gray-600 dark:text-gray-400">Plex Version</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{serverInfo.pmsVersion}</span>
            </div>
          )}

          {/* Platform */}
          {showPlatform && (
            <div className={`flex items-center justify-between ${compactView ? 'py-0.5' : 'py-1'}`}>
              <span className="text-sm text-gray-600 dark:text-gray-400">Platform</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{serverInfo.pmsPlatform}</span>
            </div>
          )}

          {/* Tautulli Version */}
          {showTautulliVersion && (
            <div className={`flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 ${compactView ? 'mt-1' : 'mt-2'}`}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-400">Tautulli</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">v{serverInfo.tautulliVersion}</span>
                {serverInfo.tautulliUpdateAvailable && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                    Update
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Connection Info */}
          {!hideLabels && (
            <div className={`text-xs text-gray-500 dark:text-gray-400 ${compactView ? 'pt-1' : 'pt-2'}`}>
              {serverInfo.pmsIsRemote ? 'Remote' : 'Local'} connection
              {serverInfo.pmsIp && ` • ${serverInfo.pmsIp}:${serverInfo.pmsPort}`}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <p>Server information unavailable</p>
        </div>
      )}
    </BaseWidget>
  );
}
