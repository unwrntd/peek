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

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  draft: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  repository_url?: string;
}

interface PRsData {
  pullRequests: GitHubPullRequest[];
}

interface GitHubPRsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function GitHubPRsWidget({ integrationId, config, widgetId }: GitHubPRsWidgetProps) {
  const { data, loading, error } = useWidgetData<PRsData>({
    integrationId,
    metric: 'pull-requests',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const maxItems = (config.maxItems as number) || 15;
  const showAuthor = config.showAuthor !== false;
  const showLabels = config.showLabels !== false;
  const showRepo = config.showRepo !== false;
  const showDraft = config.showDraft !== false;

  const pullRequests = useMemo(() => {
    if (!data?.pullRequests) return [];
    return data.pullRequests.slice(0, maxItems);
  }, [data?.pullRequests, maxItems]);

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

  const getRepoName = (pr: GitHubPullRequest) => {
    if (pr.repository_url) {
      const parts = pr.repository_url.split('/');
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return null;
  };

  const handlePRClick = (pr: GitHubPullRequest) => {
    window.open(pr.html_url, '_blank', 'noopener,noreferrer');
  };

  const getPRIcon = (pr: GitHubPullRequest) => {
    if (pr.merged_at) {
      return (
        <svg viewBox="0 0 16 16" fill="white" className="p-0.5">
          <path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218zM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM5 3.25a.75.75 0 1 0 0 .005V3.25z" />
        </svg>
      );
    }
    if (pr.state === 'closed') {
      return (
        <svg viewBox="0 0 16 16" fill="white" className="p-0.5">
          <path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06zM3.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 16 16" fill="white" className="p-0.5">
        <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
      </svg>
    );
  };

  const getPRColor = (pr: GitHubPullRequest) => {
    if (pr.merged_at) return 'bg-purple-500';
    if (pr.state === 'closed') return 'bg-red-500';
    return 'bg-green-500';
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-1 overflow-y-auto max-h-full">
          {pullRequests.map(pr => (
            <div
              key={pr.id}
              className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              onClick={() => handlePRClick(pr)}
              title={`Open PR #${pr.number}`}
            >
              <div className="flex items-start gap-2">
                <div className={`mt-1 w-4 h-4 rounded-full flex-shrink-0 ${getPRColor(pr)}`}>
                  {getPRIcon(pr)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {pr.title}
                    </span>
                    {!hideLabels && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        #{pr.number}
                      </span>
                    )}
                    {showDraft && pr.draft && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        Draft
                      </span>
                    )}
                  </div>
                  {!hideLabels && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {showLabels && pr.labels.slice(0, 3).map(label => (
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
                      {showRepo && getRepoName(pr) && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getRepoName(pr)}
                        </span>
                      )}
                    </div>
                  )}
                  {!hideLabels && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {showAuthor && (
                        <span className="flex items-center gap-1">
                          <img
                            src={pr.user.avatar_url}
                            alt={pr.user.login}
                            className="w-4 h-4 rounded-full"
                          />
                          {pr.user.login}
                        </span>
                      )}
                      <span>Opened {formatDate(pr.created_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {pullRequests.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              No pull requests found
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
