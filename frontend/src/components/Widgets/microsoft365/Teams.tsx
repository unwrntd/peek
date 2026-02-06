import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Channel {
  id: string;
  displayName: string;
  membershipType: string;
}

interface Team {
  id: string;
  displayName: string;
  description?: string;
  channels: Channel[];
}

interface TeamsData {
  teams: Team[];
  totalTeams: number;
  unreadChats: number;
  error?: string;
}

interface TeamsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Teams({ integrationId, config, widgetId }: TeamsWidgetProps) {
  const { data, loading, error } = useWidgetData<TeamsData>({
    integrationId,
    metric: 'teams',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const showChannels = (config.showChannels as boolean) ?? true;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm">Loading Teams...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (data.error) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm">{data.error}</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <div className="text-center p-3 bg-purple-500/10 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{data.totalTeams}</div>
              <div className="text-xs text-gray-400">Teams</div>
            </div>
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{data.unreadChats}</div>
              <div className="text-xs text-gray-400">Unread Chats</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-gray-500">{data.totalTeams} teams</span>
            {data.unreadChats > 0 && (
              <span className="text-xs text-blue-400">{data.unreadChats} unread</span>
            )}
          </div>
          <div className="space-y-1">
            {data.teams.map(team => (
              <div
                key={team.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800"
              >
                <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center">
                  <span className="text-xs text-purple-400">{team.displayName.charAt(0)}</span>
                </div>
                <span className="text-sm text-gray-300 truncate">{team.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        {data.unreadChats > 0 && (
          <div className="mb-3 p-2 bg-blue-500/10 rounded-lg flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm text-blue-400">{data.unreadChats} unread chats</span>
          </div>
        )}
        <div className="space-y-2">
          {data.teams.map(team => (
            <div key={team.id} className="p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center">
                  <span className="text-sm text-purple-400 font-medium">{team.displayName.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{team.displayName}</div>
                  {team.description && (
                    <div className="text-xs text-gray-500 truncate">{team.description}</div>
                  )}
                </div>
              </div>
              {showChannels && team.channels.length > 0 && (
                <div className="mt-2 pl-10 space-y-0.5">
                  {team.channels.slice(0, 3).map(channel => (
                    <div key={channel.id} className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="text-gray-500">#</span>
                      <span className="truncate">{channel.displayName}</span>
                      {channel.membershipType === 'private' && (
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                  ))}
                  {team.channels.length > 3 && (
                    <div className="text-xs text-gray-500">+{team.channels.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          ))}
          {data.teams.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No teams found</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
