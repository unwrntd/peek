import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Message {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  hasAttachment: boolean;
}

interface MailData {
  profile: {
    emailAddress: string;
    messagesTotal: number;
    threadsTotal: number;
  };
  inbox: {
    total: number;
    unread: number;
  };
  recentMessages: Message[];
}

interface MailWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function parseFromHeader(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, ''), email: match[2] };
  }
  return { name: from, email: from };
}

export function Mail({ integrationId, config, widgetId }: MailWidgetProps) {
  const { data, loading, error } = useWidgetData<MailData>({
    integrationId,
    metric: 'mail',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const filter = (config.filter as string) || '';
  const maxItems = (config.maxItems as number) || 10;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Loading Gmail...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Filter messages
  let messages = data.recentMessages;
  if (filter === 'unread') {
    messages = messages.filter((m) => m.isUnread);
  }
  messages = messages.slice(0, maxItems);

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-5xl font-bold text-red-400 mb-2">{data.inbox.unread}</div>
          <div className="text-sm text-gray-400 mb-4">Unread Messages</div>
          <div className="text-xs text-gray-500">{data.inbox.total} total in inbox</div>
          <div className="text-xs text-gray-500 mt-1">{data.profile.emailAddress}</div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-gray-500">{data.inbox.unread} unread</span>
          </div>
          <div className="space-y-1">
            {messages.map((msg) => {
              const sender = parseFromHeader(msg.from);
              return (
                <div
                  key={msg.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                    msg.isUnread ? 'bg-red-500/10' : ''
                  }`}
                >
                  {msg.isUnread && <div className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />}
                  <span className={`truncate flex-1 ${msg.isUnread ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {msg.subject || '(No subject)'}
                  </span>
                  <span className="text-gray-500 text-xs flex-shrink-0">{formatTimeAgo(msg.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{data.inbox.unread}</span>
            <span className="text-xs text-gray-500">unread</span>
          </div>
        </div>
        <div className="space-y-2">
          {messages.map((msg) => {
            const sender = parseFromHeader(msg.from);
            return (
              <div
                key={msg.id}
                className={`p-2 rounded-lg ${msg.isUnread ? 'bg-red-500/10 border border-red-500/20' : 'bg-gray-800'}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-1">
                    {msg.isUnread && <div className="w-2 h-2 bg-red-400 rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${msg.isUnread ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {sender.name}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{formatTimeAgo(msg.date)}</span>
                    </div>
                    <div className={`text-sm truncate ${msg.isUnread ? 'text-gray-200' : 'text-gray-400'}`}>
                      {msg.subject || '(No subject)'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{msg.snippet}</div>
                    {msg.hasAttachment && (
                      <div className="flex items-center gap-1 mt-1">
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No messages</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
