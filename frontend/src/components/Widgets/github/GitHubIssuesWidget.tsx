import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
}

interface GitHubUser {
  login: string;
  avatar_url: string;
}

interface GitHubMilestone {
  title: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignee: GitHubUser | null;
  milestone: GitHubMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  repository?: { full_name: string };
}

interface IssuesData {
  issues: GitHubIssue[];
}

interface GitHubIssuesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function GitHubIssuesWidget({ integrationId, config, widgetId }: GitHubIssuesWidgetProps) {
  const { data, loading, error } = useWidgetData<IssuesData>({
    integrationId,
    metric: 'issues',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const maxItems = (config.maxItems as number) || 15;
  const showLabels = config.showLabels !== false;
  const showAssignee = config.showAssignee !== false;
  const showComments = config.showComments !== false;
  const showRepo = config.showRepo !== false;
  const showMilestone = config.showMilestone !== false;

  const issues = useMemo(() => {
    if (!data?.issues) return [];
    return data.issues.slice(0, maxItems);
  }, [data?.issues, maxItems]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleIssueClick = (issue: GitHubIssue) => {
    window.open(issue.html_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-1 overflow-y-auto max-h-full">
          {issues.map(issue => (
            <div
              key={issue.id}
              className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              onClick={() => handleIssueClick(issue)}
              title={`Open issue #${issue.number}`}
            >
              <div className="flex items-start gap-2">
                <div className={`mt-1 w-4 h-4 rounded-full flex-shrink-0 ${
                  issue.state === 'open'
                    ? 'bg-green-500'
                    : 'bg-purple-500'
                }`}>
                  <svg viewBox="0 0 16 16" fill="white" className="p-0.5">
                    {issue.state === 'open' ? (
                      <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" />
                    ) : (
                      <path d="M11.28 6.78a.75.75 0 00-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5z M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" />
                    )}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {issue.title}
                    </span>
                    {!hideLabels && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        #{issue.number}
                      </span>
                    )}
                  </div>
                  {!hideLabels && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {showLabels && issue.labels.slice(0, 3).map(label => (
                        <span
                          key={label.id}
                          className="px-1.5 py-0.5 text-xs rounded-full"
                          style={{
                            backgroundColor: `#${label.color}20`,
                            color: `#${label.color}`,
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                      {showRepo && issue.repository && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {issue.repository.full_name}
                        </span>
                      )}
                      {showMilestone && issue.milestone && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {issue.milestone.title}
                        </span>
                      )}
                    </div>
                  )}
                  {!hideLabels && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>Opened {formatDate(issue.created_at)}</span>
                      {showComments && issue.comments > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {issue.comments}
                        </span>
                      )}
                      {showAssignee && issue.assignee && (
                        <span className="flex items-center gap-1">
                          <img
                            src={issue.assignee.avatar_url}
                            alt={issue.assignee.login}
                            className="w-4 h-4 rounded-full"
                          />
                          {issue.assignee.login}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {issues.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              No issues found
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
