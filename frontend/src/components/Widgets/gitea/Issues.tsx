import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface IssuesProps {
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

interface GiteaMilestone {
  title: string;
}

interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  labels: GiteaLabel[];
  assignee: GiteaUser | null;
  assignees: GiteaUser[];
  milestone: GiteaMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  repository?: {
    name: string;
    full_name: string;
  };
}

interface IssuesData {
  issues: GiteaIssue[];
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
  // Convert hex to RGB to determine if we need dark or light text
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

export function Issues({ integrationId, config, widgetId }: IssuesProps) {
  const { data, loading, error } = useWidgetData<IssuesData>({
    integrationId,
    metric: 'issues',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showLabels = config.showLabels !== false;
  const showAssignee = config.showAssignee !== false;
  const showComments = config.showComments !== false;
  const showRepo = config.showRepo !== false;
  const showMilestone = config.showMilestone !== false;
  const hideLabels = config.hideLabels === true;
  const maxItems = (config.maxItems as number) || 20;
  const stateFilter = (config.state as string) || 'open';
  const labelsFilter = (config.labels as string) || '';
  const repository = (config.repository as string) || '';
  const sortBy = (config.sortBy as string) || 'created';

  const filteredIssues = useMemo(() => {
    if (!data?.issues) return [];

    let issues = [...data.issues];

    // Filter by state
    if (stateFilter !== 'all') {
      issues = issues.filter(i => i.state === stateFilter);
    }

    // Filter by repository
    if (repository) {
      issues = issues.filter(i =>
        i.repository?.full_name?.toLowerCase() === repository.toLowerCase()
      );
    }

    // Filter by labels
    if (labelsFilter) {
      const labelNames = labelsFilter.split(',').map(l => l.trim().toLowerCase());
      issues = issues.filter(i =>
        i.labels.some(l => labelNames.includes(l.name.toLowerCase()))
      );
    }

    // Sort
    issues.sort((a, b) => {
      switch (sortBy) {
        case 'comments':
          return b.comments - a.comments;
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'created':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return issues.slice(0, maxItems);
  }, [data?.issues, stateFilter, repository, labelsFilter, sortBy, maxItems]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-2">
          {filteredIssues.map(issue => (
            <div
              key={issue.id}
              className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <div className="flex items-start gap-2">
                {/* Status indicator */}
                <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${
                  issue.state === 'open'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-purple-100 dark:bg-purple-900/30'
                }`}>
                  {issue.state === 'open' ? (
                    <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 118 2a6 6 0 010 12zm3.5-6.5l-5 5-2.5-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
                    >
                      {issue.title}
                    </a>
                    {showAssignee && issue.assignees && issue.assignees.length > 0 && (
                      <div className="flex -space-x-1">
                        {issue.assignees.slice(0, 3).map(assignee => (
                          <img
                            key={assignee.login}
                            src={assignee.avatar_url}
                            alt={assignee.login}
                            title={assignee.login}
                            className="w-5 h-5 rounded-full border border-white dark:border-gray-800"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {showRepo && issue.repository && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {issue.repository.full_name}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      #{issue.number}
                    </span>
                    {showLabels && issue.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {issue.labels.slice(0, 3).map(label => {
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
                        {issue.labels.length > 3 && (
                          <span className="text-xs text-gray-400">+{issue.labels.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {showMilestone && issue.milestone && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {issue.milestone.title}
                      </span>
                    )}
                    {showComments && issue.comments > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {issue.comments}
                      </span>
                    )}
                    <span className="ml-auto">
                      {formatRelativeTime(issue.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredIssues.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No issues found
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
