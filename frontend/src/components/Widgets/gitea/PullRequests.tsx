import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface PullRequestsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface GiteaLabel {
  id: number;
  name: string;
  color: string;
}

interface GiteaUser {
  login: string;
  avatar_url: string;
}

interface GiteaPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  labels: GiteaLabel[];
  user: GiteaUser;
  head: {
    ref: string;
    repo: {
      full_name: string;
    };
  };
  base: {
    ref: string;
    repo: {
      full_name: string;
    };
  };
  merged: boolean;
  mergeable: boolean;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
}

interface PullRequestsData {
  pullRequests: GiteaPullRequest[];
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

function getLabelColor(hexColor: string): { bg: string; text: string } {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return {
    bg: `#${hex}`,
    text: brightness > 128 ? '#1f2937' : '#ffffff',
  };
}

export function PullRequests({ integrationId, config, widgetId }: PullRequestsProps) {
  const { data, loading, error } = useWidgetData<PullRequestsData>({
    integrationId,
    metric: 'pull-requests',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showAuthor = config.showAuthor !== false;
  const showLabels = config.showLabels !== false;
  const showBranches = config.showBranches !== false;
  const showMergeStatus = config.showMergeStatus !== false;
  const showRepo = config.showRepo !== false;
  const showChanges = config.showChanges !== false;
  const maxItems = (config.maxItems as number) || 20;
  const stateFilter = (config.state as string) || 'open';
  const repository = (config.repository as string) || '';
  const sortBy = (config.sortBy as string) || 'created';

  const filteredPRs = useMemo(() => {
    if (!data?.pullRequests) return [];

    let prs = [...data.pullRequests];

    // Filter by state
    if (stateFilter === 'open') {
      prs = prs.filter(pr => pr.state === 'open' && !pr.merged);
    } else if (stateFilter === 'closed') {
      prs = prs.filter(pr => pr.state === 'closed' && !pr.merged);
    } else if (stateFilter === 'merged') {
      prs = prs.filter(pr => pr.merged);
    }

    // Filter by repository
    if (repository) {
      prs = prs.filter(pr =>
        pr.base.repo.full_name.toLowerCase() === repository.toLowerCase()
      );
    }

    // Sort
    prs.sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'created':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return prs.slice(0, maxItems);
  }, [data?.pullRequests, stateFilter, repository, sortBy, maxItems]);

  const getStatusIcon = (pr: GiteaPullRequest) => {
    if (pr.merged) {
      return (
        <div className="mt-1 w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z" />
          </svg>
        </div>
      );
    }
    if (pr.state === 'open') {
      return (
        <div className="mt-1 w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 16 16">
            <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="mt-1 w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
        </svg>
      </div>
    );
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-2">
          {filteredPRs.map(pr => (
            <div
              key={pr.id}
              className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <div className="flex items-start gap-2">
                {getStatusIcon(pr)}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={pr.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
                    >
                      {pr.title}
                    </a>
                    {showAuthor && pr.user && (
                      <img
                        src={pr.user.avatar_url}
                        alt={pr.user.login}
                        title={pr.user.login}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {showRepo && pr.base.repo && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {pr.base.repo.full_name}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      #{pr.number}
                    </span>
                    {showLabels && pr.labels && pr.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pr.labels.slice(0, 3).map(label => {
                          const colors = getLabelColor(label.color);
                          return (
                            <span
                              key={label.id}
                              className="px-1.5 py-0.5 text-xs rounded-full"
                              style={{ backgroundColor: colors.bg, color: colors.text }}
                            >
                              {label.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {showBranches && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {pr.head.ref} → {pr.base.ref}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {showMergeStatus && pr.state === 'open' && (
                      <span className={`flex items-center gap-1 ${
                        pr.mergeable
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {pr.mergeable ? (
                          <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Mergeable
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Conflicts
                          </>
                        )}
                      </span>
                    )}
                    {showChanges && (
                      <span className="flex items-center gap-2">
                        <span className="text-green-600 dark:text-green-400">+{pr.additions}</span>
                        <span className="text-red-600 dark:text-red-400">-{pr.deletions}</span>
                        <span>{pr.changed_files} files</span>
                      </span>
                    )}
                    <span className="ml-auto">
                      {formatRelativeTime(pr.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredPRs.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No pull requests found
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
