import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';

interface GitHubRepository {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  language: string | null;
  updated_at: string;
}

interface RepoStatsData {
  repository: GitHubRepository | null;
}

interface GitHubRepoStatsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function GitHubRepoStatsWidget({ integrationId, config, widgetId }: GitHubRepoStatsWidgetProps) {
  const repo = (config.repo as string) || '';

  const { data, loading, error } = useWidgetData<RepoStatsData>({
    integrationId,
    metric: 'repository-stats',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const hideLabels = (config.hideLabels as boolean) || false;
  const showStars = config.showStars !== false;
  const showForks = config.showForks !== false;
  const showIssues = config.showIssues !== false;
  const showWatchers = config.showWatchers !== false;
  const showLanguage = config.showLanguage !== false;
  const showLastUpdated = config.showLastUpdated !== false;

  const handleClick = () => {
    if (data?.repository?.html_url) {
      window.open(data.repository.html_url, '_blank', 'noopener,noreferrer');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  if (!repo) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
          Configure a repository (owner/repo) in widget settings
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data?.repository && (
        <div
          className="h-full flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors rounded-lg p-2"
          onClick={handleClick}
          title={`Open ${data.repository.full_name} on GitHub`}
        >
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-white">
              {data.repository.name}
            </div>
            {data.repository.description && !hideLabels && (
              <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {data.repository.description}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 justify-center text-center">
            {showStars && (
              <div>
                <ScaledMetric value={data.repository.stargazers_count.toString()} className="text-yellow-500" />
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Stars</div>}
              </div>
            )}
            {showForks && (
              <div>
                <ScaledMetric value={data.repository.forks_count.toString()} className="text-blue-600 dark:text-blue-400" />
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Forks</div>}
              </div>
            )}
            {showIssues && (
              <div>
                <ScaledMetric value={data.repository.open_issues_count.toString()} className="text-green-600 dark:text-green-400" />
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Issues</div>}
              </div>
            )}
            {showWatchers && (
              <div>
                <ScaledMetric value={data.repository.watchers_count.toString()} className="text-purple-600 dark:text-purple-400" />
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Watchers</div>}
              </div>
            )}
          </div>
          {!hideLabels && (showLanguage || showLastUpdated) && (
            <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
              {showLanguage && data.repository.language && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {data.repository.language}
                </span>
              )}
              {showLastUpdated && (
                <span>Updated {formatDate(data.repository.updated_at)}</span>
              )}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
