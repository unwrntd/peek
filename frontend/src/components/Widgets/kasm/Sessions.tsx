import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { formatDuration } from '../../../utils/formatting';

interface KasmSession {
  kasm_id: string;
  user_id: string;
  username: string;
  image_id: string;
  image_friendly_name: string;
  operational_status: string;
  start_date: string;
  keepalive_date: string;
  cores: number;
  memory: number;
  hostname: string;
}

interface SessionsData {
  sessions: KasmSession[];
}

interface SessionsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatElapsedTime(startDate: string): string {
  const start = new Date(startDate);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
  return formatDuration(diffSeconds);
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
      return 'bg-green-500';
    case 'starting':
      return 'bg-yellow-500';
    case 'stopping':
      return 'bg-orange-500';
    case 'stopped':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

export function Sessions({ integrationId, config, widgetId }: SessionsWidgetProps) {
  const { data, loading, error } = useWidgetData<SessionsData>({
    integrationId,
    metric: 'sessions',
    refreshInterval: (config.refreshInterval as number) || 15000,
    widgetId,
  });

  const sessions = data?.sessions || [];
  const search = (config.search as string) || '';

  const filteredSessions = useMemo(() => {
    if (!search) return sessions;
    const searchLower = search.toLowerCase();
    return sessions.filter(s =>
      s.username?.toLowerCase().includes(searchLower) ||
      s.image_friendly_name?.toLowerCase().includes(searchLower)
    );
  }, [sessions, search]);

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary header */}
        <div className="px-3 py-2 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
            </span>
            {sessions.length > 0 && (
              <span className="text-xs text-green-400">
                {sessions.filter(s => s.operational_status === 'running').length} running
              </span>
            )}
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="text-sm text-gray-500">
                {search ? 'No sessions match your search' : 'No active sessions'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/30">
              {filteredSessions.map((session) => (
                <div
                  key={session.kasm_id}
                  className="px-3 py-3 hover:bg-gray-800/20"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(session.operational_status)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">
                            {session.username}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-700/50 text-gray-400 rounded">
                            {session.operational_status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {session.image_friendly_name}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{session.cores} cores</span>
                          <span>{session.memory} MB</span>
                          <span>{formatElapsedTime(session.start_date)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
