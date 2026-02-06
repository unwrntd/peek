import React from 'react';
import { useCrossIntegrationData } from '../../../hooks/useCrossIntegrationData';
import { BaseWidget } from '../BaseWidget';
import { useBrandingStore } from '../../../stores/brandingStore';
import { TvIcon } from '../../../utils/icons';

interface ClientCorrelationProps {
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ClientCorrelationData {
  sessions: {
    sessionId: string;
    user: string;
    title: string;
    mediaType: string;
    player: string;
    ipAddress: string;
    state: string;
    transcodeDecision: string;
    bandwidth: number;
    client: {
      name: string;
      mac: string;
      connectionType: 'wired' | 'wireless' | 'unknown';
      signalStrength?: number;
      network?: string;
      manufacturer?: string;
    } | null;
  }[];
  unmatchedClients: {
    ip: string;
    user: string;
  }[];
}

function getConnectionIcon(type: 'wired' | 'wireless' | 'unknown'): React.ReactNode {
  if (type === 'wired') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (type === 'wireless') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function getSignalStrengthBars(signal?: number): React.ReactNode {
  if (signal === undefined) return null;

  // Signal strength is typically -30 (excellent) to -90 (poor)
  const normalized = Math.min(100, Math.max(0, (90 + signal) * 100 / 60));
  const bars = Math.ceil(normalized / 25);

  return (
    <div className="flex items-end gap-0.5 h-3">
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={`w-1 rounded-sm ${
            bar <= bars
              ? bars >= 3 ? 'bg-green-500' : bars >= 2 ? 'bg-yellow-500' : 'bg-red-500'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </div>
  );
}

function getTranscodeColor(decision: string): string {
  if (decision === 'direct play') return 'text-green-500';
  if (decision === 'copy' || decision === 'direct stream') return 'text-blue-500';
  return 'text-orange-500';
}

function getStateIcon(state: string): React.ReactNode {
  if (state === 'playing') {
    return (
      <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    );
  }
  if (state === 'paused') {
    return (
      <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

function formatBandwidth(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} kbps`;
}

export function ClientCorrelation({ config, widgetId }: ClientCorrelationProps) {
  const { data, loading, error, missingIntegrations } = useCrossIntegrationData<ClientCorrelationData>({
    endpoint: 'client-correlation',
    refreshInterval: (config.refreshInterval as number) || 15000,
    widgetId,
  });
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle);

  // Config options
  const showDeviceName = config.showDeviceName !== false;
  const showConnectionType = config.showConnectionType !== false;
  const showSignalStrength = config.showSignalStrength !== false;
  const showBandwidth = config.showBandwidth !== false;
  const showUnmatched = config.showUnmatched === true;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="h-full flex flex-col overflow-hidden">
          {/* Sessions list */}
          <div className="flex-1 overflow-auto">
            {data.sessions.length > 0 ? (
              <div className="space-y-2">
                {data.sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    {/* Top row: title and state */}
                    <div className="flex items-start gap-2 mb-2">
                      {getStateIcon(session.state)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {session.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {session.user} • {session.player}
                        </div>
                      </div>
                      <div className={`text-xs ${getTranscodeColor(session.transcodeDecision)}`}>
                        {session.transcodeDecision}
                      </div>
                    </div>

                    {/* Bottom row: network info */}
                    <div className="flex items-center gap-4 text-xs">
                      {/* Client device info */}
                      {session.client && showDeviceName && (
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                          {showConnectionType && (
                            <span className={session.client.connectionType === 'wired' ? 'text-blue-500' : 'text-green-500'}>
                              {getConnectionIcon(session.client.connectionType)}
                            </span>
                          )}
                          <span className="truncate max-w-[120px]">
                            {session.client.name}
                          </span>
                        </div>
                      )}

                      {/* Signal strength for wireless */}
                      {session.client?.connectionType === 'wireless' && showSignalStrength && session.client.signalStrength && (
                        <div className="flex items-center gap-1">
                          {getSignalStrengthBars(session.client.signalStrength)}
                          <span className="text-gray-400">{session.client.signalStrength} dBm</span>
                        </div>
                      )}

                      {/* Bandwidth */}
                      {showBandwidth && session.bandwidth > 0 && (
                        <div className="text-gray-500 dark:text-gray-400">
                          {formatBandwidth(session.bandwidth)}
                        </div>
                      )}

                      {/* IP address */}
                      <div className="text-gray-500 dark:text-gray-400 ml-auto">
                        {session.ipAddress}
                      </div>
                    </div>

                    {/* Network name */}
                    {session.client?.network && (
                      <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                        Network: {session.client.network}
                      </div>
                    )}

                    {/* No client match indicator */}
                    {!session.client && (
                      <div className="mt-1 text-[10px] text-orange-500 dark:text-orange-400 italic">
                        Client not found in UniFi
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <div className="text-3xl mb-2">
                    {iconStyle === 'none' ? null : iconStyle === 'simple' ? (
                      <TvIcon className="w-8 h-8 mx-auto" />
                    ) : '📺'}
                  </div>
                  No active streams
                </div>
              </div>
            )}
          </div>

          {/* Unmatched clients */}
          {showUnmatched && data.unmatchedClients.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Unmatched Clients
              </div>
              <div className="flex flex-wrap gap-1">
                {data.unmatchedClients.map((client, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs rounded"
                  >
                    {client.ip} ({client.user})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {data.sessions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{data.sessions.length} active stream{data.sessions.length !== 1 ? 's' : ''}</span>
              <span>
                {data.sessions.filter(s => s.client).length}/{data.sessions.length} matched
              </span>
            </div>
          )}

          {/* Missing integrations */}
          {missingIntegrations.length > 0 && (
            <div className="mt-2 text-xs text-center text-orange-500 dark:text-orange-400">
              {missingIntegrations.includes('unifi') && 'UniFi required for client info. '}
              {missingIntegrations.includes('tautulli') && 'Tautulli required for stream info.'}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
