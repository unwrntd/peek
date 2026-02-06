import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface NotificationsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface GiteaNotification {
  id: number;
  repository: {
    full_name: string;
    html_url?: string;
  };
  subject: {
    title: string;
    url: string;
    type: 'Issue' | 'Pull' | 'Commit' | 'Repository';
    state: string;
  };
  unread: boolean;
  pinned: boolean;
  updated_at: string;
}

interface NotificationsData {
  notifications: GiteaNotification[];
  unreadCount: number;
  total: number;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'Issue':
      return (
        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'Pull':
      return (
        <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
        </svg>
      );
    case 'Commit':
      return (
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z" />
        </svg>
      );
    case 'Repository':
      return (
        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 16 16">
          <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 16a2 2 0 001.985-1.75c.017-.137-.097-.25-.235-.25h-3.5c-.138 0-.252.113-.235.25A2 2 0 008 16zM8 1.5A3.5 3.5 0 004.5 5v2.947c0 .346-.102.683-.294.97l-1.703 2.556a.018.018 0 00-.003.01l.001.006c0 .002.002.004.004.006a.017.017 0 00.006.004l.007.001h10.964l.007-.001a.016.016 0 00.006-.004.016.016 0 00.004-.006l.001-.007a.017.017 0 00-.003-.01l-1.703-2.554a1.75 1.75 0 01-.294-.97V5A3.5 3.5 0 008 1.5z" />
        </svg>
      );
  }
}

export function Notifications({ integrationId, config, widgetId }: NotificationsProps) {
  const { data, loading, error } = useWidgetData<NotificationsData>({
    integrationId,
    metric: 'notifications',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showRepo = config.showRepo !== false;
  const showTimestamp = config.showTimestamp !== false;
  const showTypeIcon = config.showTypeIcon !== false;
  const hideLabels = config.hideLabels === true;
  const maxItems = (config.maxItems as number) || 20;
  const statusFilter = (config.status as string) || 'unread';
  const subjectTypeFilter = (config.subjectType as string) || '';

  const filteredNotifications = useMemo(() => {
    if (!data?.notifications) return [];

    let notifications = [...data.notifications];

    // Filter by status
    if (statusFilter === 'unread') {
      notifications = notifications.filter(n => n.unread);
    } else if (statusFilter === 'pinned') {
      notifications = notifications.filter(n => n.pinned);
    }

    // Filter by subject type
    if (subjectTypeFilter) {
      notifications = notifications.filter(n => n.subject.type === subjectTypeFilter);
    }

    return notifications.slice(0, maxItems);
  }, [data?.notifications, statusFilter, subjectTypeFilter, maxItems]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-1">
          {/* Unread badge */}
          {!hideLabels && data.unreadCount > 0 && (
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Unread notifications
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                {data.unreadCount}
              </span>
            </div>
          )}

          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`p-2 rounded-lg transition-colors ${
                notification.unread
                  ? 'bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-start gap-2">
                {showTypeIcon && (
                  <div className="mt-0.5 flex-shrink-0">
                    {getTypeIcon(notification.subject.type)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                      {notification.subject.title}
                      {notification.pinned && (
                        <svg className="w-3 h-3 inline ml-1 text-amber-500" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 010 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 01.16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 01-.707 0l-2.829-2.828-3.182 3.182a.5.5 0 01-.707-.707l3.182-3.182L2.4 7.194a.5.5 0 010-.707c.688-.688 1.673-.766 2.375-.72a5.922 5.922 0 011.013.16l3.134-3.133a2.772 2.772 0 01-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 01.353-.146z" />
                        </svg>
                      )}
                    </div>
                    {notification.unread && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {showRepo && notification.repository && (
                      <span className="truncate">
                        {notification.repository.full_name}
                      </span>
                    )}
                    {!hideLabels && (
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        notification.subject.type === 'Issue'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : notification.subject.type === 'Pull'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {notification.subject.type}
                      </span>
                    )}
                    {showTimestamp && (
                      <span className="ml-auto flex-shrink-0">
                        {formatRelativeTime(notification.updated_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredNotifications.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {statusFilter === 'unread' ? 'No unread notifications' : 'No notifications found'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
