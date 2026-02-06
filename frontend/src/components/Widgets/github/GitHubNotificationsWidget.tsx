import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface GitHubRepository {
  full_name: string;
}

interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  subject: {
    title: string;
    url: string;
    type: 'Issue' | 'PullRequest' | 'Commit' | 'Release' | 'Discussion';
  };
  repository: GitHubRepository;
}

interface NotificationsData {
  notifications: GitHubNotification[];
  unreadCount: number;
}

interface GitHubNotificationsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function GitHubNotificationsWidget({ integrationId, config, widgetId }: GitHubNotificationsWidgetProps) {
  const { data, loading, error } = useWidgetData<NotificationsData>({
    integrationId,
    metric: 'notifications',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const maxItems = (config.maxItems as number) || 20;
  const showRepo = config.showRepo !== false;
  const showReason = config.showReason !== false;
  const showTimestamp = config.showTimestamp !== false;
  const showTypeIcon = config.showTypeIcon !== false;

  const notifications = useMemo(() => {
    if (!data?.notifications) return [];
    let notifs = [...data.notifications];

    // Apply filter
    const filter = (config.filter as string) || 'unread';
    if (filter === 'unread') {
      notifs = notifs.filter(n => n.unread);
    } else if (filter === 'participating') {
      notifs = notifs.filter(n =>
        ['author', 'comment', 'mention', 'team_mention', 'review_requested'].includes(n.reason)
      );
    }

    // Apply repo filter
    const repoFilter = config.repo as string;
    if (repoFilter) {
      notifs = notifs.filter(n => n.repository.full_name === repoFilter);
    }

    return notifs.slice(0, maxItems);
  }, [data?.notifications, config.filter, config.repo, maxItems]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatReason = (reason: string) => {
    const reasons: Record<string, string> = {
      assign: 'Assigned',
      author: 'Author',
      comment: 'Comment',
      invitation: 'Invitation',
      manual: 'Subscribed',
      mention: 'Mentioned',
      review_requested: 'Review',
      security_alert: 'Security',
      state_change: 'State change',
      subscribed: 'Watching',
      team_mention: 'Team mention',
    };
    return reasons[reason] || reason;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Issue':
        return (
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="white" className="w-3 h-3">
              <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" />
            </svg>
          </div>
        );
      case 'PullRequest':
        return (
          <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="white" className="w-3 h-3">
              <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
            </svg>
          </div>
        );
      case 'Release':
        return (
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="white" className="w-3 h-3">
              <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
            </svg>
          </div>
        );
      case 'Discussion':
        return (
          <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="white" className="w-3 h-3">
              <path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A.25.25 0 0 1 4 12.426V10H1.75A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1Z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="white" className="w-3 h-3">
              <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287ZM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
            </svg>
          </div>
        );
    }
  };

  const handleNotificationClick = (notification: GitHubNotification) => {
    // Convert API URL to web URL
    const webUrl = notification.subject.url
      ?.replace('api.github.com/repos', 'github.com')
      ?.replace('/pulls/', '/pull/');
    if (webUrl) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-1 overflow-y-auto max-h-full">
          {!hideLabels && data.unreadCount > 0 && (
            <div className="px-2 py-1 mb-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                {data.unreadCount} unread notification{data.unreadCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                notification.unread ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
              title={notification.subject.title}
            >
              <div className="flex items-start gap-2">
                {showTypeIcon && getTypeIcon(notification.subject.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${
                      notification.unread
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      {notification.subject.title}
                    </span>
                    {notification.unread && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  {!hideLabels && (
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {showRepo && (
                        <span>{notification.repository.full_name}</span>
                      )}
                      {showReason && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                          {formatReason(notification.reason)}
                        </span>
                      )}
                      {showTimestamp && (
                        <span>{formatDate(notification.updated_at)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              No notifications
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
