import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface RepositoriesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface GiteaRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string;
  language: string;
  stars_count: number;
  forks_count: number;
  updated_at: string;
  archived: boolean;
  mirror: boolean;
}

interface RepositoriesData {
  repositories: GiteaRepository[];
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

const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-blue-600',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-600',
  Java: 'bg-red-500',
  'C++': 'bg-pink-600',
  C: 'bg-gray-600',
  Ruby: 'bg-red-600',
  PHP: 'bg-purple-500',
  Shell: 'bg-green-600',
  HTML: 'bg-orange-500',
  CSS: 'bg-purple-600',
};

export function Repositories({ integrationId, config, widgetId }: RepositoriesProps) {
  const { data, loading, error } = useWidgetData<RepositoriesData>({
    integrationId,
    metric: 'repositories',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const showStars = config.showStars !== false;
  const showForks = config.showForks !== false;
  const showLanguage = config.showLanguage !== false;
  const showDescription = config.showDescription !== false;
  const showLastUpdated = config.showLastUpdated !== false;
  const showVisibility = config.showVisibility !== false;
  const hideLabels = config.hideLabels === true;
  const maxItems = (config.maxItems as number) || 20;
  const sortBy = (config.sortBy as string) || 'updated';
  const visibility = (config.visibility as string) || '';
  const search = (config.search as string) || '';

  const filteredRepos = useMemo(() => {
    if (!data?.repositories) return [];

    let repos = [...data.repositories];

    // Filter by visibility
    if (visibility === 'public') {
      repos = repos.filter(r => !r.private);
    } else if (visibility === 'private') {
      repos = repos.filter(r => r.private);
    }

    // Filter by search
    if (search) {
      repos = repos.filter(r =>
        matchesAnyFilter([r.name, r.full_name, r.description, r.language], search)
      );
    }

    // Sort
    repos.sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return b.stars_count - a.stars_count;
        case 'forks':
          return b.forks_count - a.forks_count;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return repos.slice(0, maxItems);
  }, [data?.repositories, visibility, search, sortBy, maxItems]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-2">
          {filteredRepos.map(repo => (
            <div
              key={repo.id}
              className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      {repo.name}
                    </a>
                    {showVisibility && (
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        repo.private
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {repo.private ? 'Private' : 'Public'}
                      </span>
                    )}
                    {repo.archived && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        Archived
                      </span>
                    )}
                    {repo.mirror && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        Mirror
                      </span>
                    )}
                  </div>
                  {showDescription && repo.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                      {repo.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                {showLanguage && repo.language && (
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${languageColors[repo.language] || 'bg-gray-400'}`} />
                    {!hideLabels && repo.language}
                  </span>
                )}
                {showStars && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {repo.stars_count}
                  </span>
                )}
                {showForks && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    {repo.forks_count}
                  </span>
                )}
                {showLastUpdated && (
                  <span className="ml-auto">
                    {formatRelativeTime(repo.updated_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {filteredRepos.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No repositories found
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
