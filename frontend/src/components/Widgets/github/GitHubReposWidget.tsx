import { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  visibility: 'public' | 'private' | 'internal';
}

interface ReposData {
  repositories: GitHubRepository[];
}

interface GitHubReposWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function GitHubReposWidget({ integrationId, config, widgetId }: GitHubReposWidgetProps) {
  const { data, loading, error } = useWidgetData<ReposData>({
    integrationId,
    metric: 'repositories',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const maxItems = (config.maxItems as number) || 10;
  const showStars = config.showStars !== false;
  const showLanguage = config.showLanguage !== false;
  const showDescription = config.showDescription !== false;
  const showLastUpdated = config.showLastUpdated !== false;
  const showVisibility = config.showVisibility !== false;

  const repositories = useMemo(() => {
    if (!data?.repositories) return [];
    let repos = [...data.repositories];

    // Apply visibility filter
    const visibility = config.visibility as string;
    if (visibility === 'public') {
      repos = repos.filter(r => !r.private);
    } else if (visibility === 'private') {
      repos = repos.filter(r => r.private);
    }

    // Sort
    const sortBy = (config.sortBy as string) || 'updated';
    repos.sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return b.stargazers_count - a.stargazers_count;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'pushed':
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return repos.slice(0, maxItems);
  }, [data?.repositories, config.visibility, config.sortBy, maxItems]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  };

  const handleRepoClick = (repo: GitHubRepository) => {
    window.open(repo.html_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-1 overflow-y-auto max-h-full">
          {repositories.map(repo => (
            <div
              key={repo.id}
              className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              onClick={() => handleRepoClick(repo)}
              title={`Open ${repo.full_name} on GitHub`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {repo.name}
                    </span>
                    {showVisibility && repo.private && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                        Private
                      </span>
                    )}
                  </div>
                  {showDescription && repo.description && !hideLabels && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {repo.description}
                    </div>
                  )}
                  {!hideLabels && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {showLanguage && repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          {repo.language}
                        </span>
                      )}
                      {showStars && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {repo.stargazers_count}
                        </span>
                      )}
                      {showLastUpdated && (
                        <span>{formatDate(repo.updated_at)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {repositories.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              No repositories found
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
