import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface HALink {
  name: string;
  state: string;
  type: string;
}

interface HAData {
  enabled: boolean;
  mode: string;
  localState: string;
  peerState: string;
  peerAddress: string;
  configSynced: boolean;
  links: HALink[];
}

interface HAWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getStateColor(state: string): string {
  switch (state.toLowerCase()) {
    case 'active':
      return 'text-green-400';
    case 'passive':
      return 'text-blue-400';
    case 'initial':
    case 'suspended':
      return 'text-yellow-400';
    case 'standalone':
      return 'text-gray-400';
    default:
      return 'text-gray-500';
  }
}

function getStateBgColor(state: string): string {
  switch (state.toLowerCase()) {
    case 'active':
      return 'bg-green-500';
    case 'passive':
      return 'bg-blue-500';
    case 'initial':
    case 'suspended':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
}

export function HA({ integrationId, config, widgetId }: HAWidgetProps) {
  const { data, loading, error } = useWidgetData<HAData>({
    integrationId,
    metric: 'ha',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'status';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-sm">Loading HA status...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (!data.enabled) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-sm">HA Not Configured</p>
            <p className="text-xs text-gray-500 mt-1">Running in standalone mode</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'detailed') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          <div className="space-y-3">
            {/* HA State */}
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 mb-2">HA State</div>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${getStateBgColor(data.localState)}`} />
                  <div className={`text-sm font-medium ${getStateColor(data.localState)} capitalize`}>
                    {data.localState}
                  </div>
                  <div className="text-xs text-gray-500">Local</div>
                </div>
                <div className="text-gray-600 px-2">⟷</div>
                <div className="text-center flex-1">
                  <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${getStateBgColor(data.peerState)}`} />
                  <div className={`text-sm font-medium ${getStateColor(data.peerState)} capitalize`}>
                    {data.peerState}
                  </div>
                  <div className="text-xs text-gray-500">Peer</div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500">Mode</div>
                <div className="text-sm text-white capitalize">{data.mode}</div>
              </div>
              <div className="p-2 bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500">Config Sync</div>
                <div className={`text-sm ${data.configSynced ? 'text-green-400' : 'text-red-400'}`}>
                  {data.configSynced ? 'Synced' : 'Not Synced'}
                </div>
              </div>
            </div>

            {/* Peer Info */}
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Peer Address</div>
              <div className="text-sm text-white">{data.peerAddress}</div>
            </div>

            {/* Links */}
            {data.links.length > 0 && (
              <div className="p-2 bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500 mb-2">HA Links</div>
                <div className="space-y-1">
                  {data.links.map((link) => (
                    <div key={link.name} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${link.state === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-xs text-white">{link.name}</span>
                      <span className="text-xs text-gray-500">({link.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default status view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-6 mb-4">
          {/* Local */}
          <div className="text-center">
            <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${getStateBgColor(data.localState)}`} />
            <div className={`text-lg font-bold ${getStateColor(data.localState)} capitalize`}>
              {data.localState}
            </div>
            <div className="text-xs text-gray-500">Local</div>
          </div>

          {/* Sync indicator */}
          <div className="text-center">
            <svg
              className={`w-6 h-6 ${data.configSynced ? 'text-green-400' : 'text-red-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>

          {/* Peer */}
          <div className="text-center">
            <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${getStateBgColor(data.peerState)}`} />
            <div className={`text-lg font-bold ${getStateColor(data.peerState)} capitalize`}>
              {data.peerState}
            </div>
            <div className="text-xs text-gray-500">Peer</div>
          </div>
        </div>

        <div className="text-xs text-gray-500 capitalize">{data.mode}</div>
        <div className={`text-xs mt-1 ${data.configSynced ? 'text-green-400' : 'text-red-400'}`}>
          {data.configSynced ? 'Config Synchronized' : 'Config Not Synced'}
        </div>
      </div>
    </BaseWidget>
  );
}
