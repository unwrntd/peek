import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface HAMember {
  serial: string;
  hostname: string;
  role: 'primary' | 'secondary';
  priority: number;
  status: 'up' | 'down';
  uptime: number;
}

interface HAData {
  enabled: boolean;
  mode: 'standalone' | 'a-a' | 'a-p';
  groupId: number;
  groupName: string;
  localRole: 'primary' | 'secondary';
  members: HAMember[];
  syncStatus: 'synchronized' | 'out-of-sync';
}

interface HAWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function FortiGateHA({ integrationId, config, widgetId }: HAWidgetProps) {
  const { data, loading, error } = useWidgetData<HAData>({
    integrationId,
    metric: 'ha',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'status';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Loading HA status...</p>
        </div>
      </BaseWidget>
    );
  }

  if (!data.enabled) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>
          <span className="text-gray-400 text-sm">Standalone Mode</span>
          <span className="text-xs text-gray-500 mt-1">HA is not configured</span>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'members') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-4 overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-white">HA Members</span>
            <span className={`px-2 py-1 text-xs rounded ${
              data.syncStatus === 'synchronized'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {data.syncStatus}
            </span>
          </div>

          {data.members.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              No member information available
            </div>
          ) : (
            <div className="space-y-3">
              {data.members.map((member) => (
                <div
                  key={member.serial}
                  className={`p-3 rounded-lg border ${
                    member.status === 'up'
                      ? member.role === 'primary'
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-green-500/10 border-green-500/30'
                      : 'bg-gray-700/50 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        member.status === 'up' ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span className="font-medium text-white">{member.hostname}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${
                      member.role === 'primary'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {member.role}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Priority:</span>
                      <span className="text-gray-300 ml-1">{member.priority}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Uptime:</span>
                      <span className="text-gray-300 ml-1">{formatUptime(member.uptime)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 font-mono">{member.serial}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default status visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full p-4 flex flex-col justify-center">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-green-500/20 mb-3">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">
            {data.mode === 'a-a' ? 'Active-Active' : 'Active-Passive'}
          </h3>
          {data.groupName && (
            <p className="text-xs text-gray-500">Group: {data.groupName}</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 px-3 bg-gray-700/30 rounded">
            <span className="text-sm text-gray-400">Local Role</span>
            <span className={`px-2 py-1 text-xs rounded font-medium ${
              data.localRole === 'primary'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {data.localRole.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-gray-700/30 rounded">
            <span className="text-sm text-gray-400">Sync Status</span>
            <span className={`px-2 py-1 text-xs rounded font-medium ${
              data.syncStatus === 'synchronized'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {data.syncStatus}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-gray-700/30 rounded">
            <span className="text-sm text-gray-400">Members</span>
            <span className="text-sm text-white">
              {data.members.filter(m => m.status === 'up').length} / {data.members.length} online
            </span>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
