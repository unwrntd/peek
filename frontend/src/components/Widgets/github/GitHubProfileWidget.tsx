import { useWidgetData } from '../../../hooks/useWidgetData';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { BaseWidget } from '../BaseWidget';
import { ScaledMetric } from '../../common/ScaledMetric';

interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

interface ProfileData {
  user: GitHubUser;
}

interface GitHubProfileWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function GitHubProfileWidget({ integrationId, config, widgetId }: GitHubProfileWidgetProps) {
  const { data, loading, error } = useWidgetData<ProfileData>({
    integrationId,
    metric: 'user-profile',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  // Get integration config to build GitHub URL
  const integration = useIntegrationStore(state =>
    state.integrations.find(i => i.id === integrationId)
  );

  const hideLabels = (config.hideLabels as boolean) || false;
  const showAvatar = config.showAvatar !== false;
  const showRepoCount = config.showRepoCount !== false;
  const showFollowers = config.showFollowers !== false;
  const showFollowing = config.showFollowing !== false;
  const showBio = config.showBio !== false;

  const handleClick = () => {
    if (data?.user?.html_url) {
      window.open(data.user.html_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data?.user && (
        <div
          className="h-full flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors rounded-lg p-2"
          onClick={handleClick}
          title={`Open ${data.user.login}'s profile on GitHub`}
        >
          {showAvatar && (
            <img
              src={data.user.avatar_url}
              alt={data.user.login}
              className="w-16 h-16 rounded-full"
            />
          )}
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-white">
              {data.user.name || data.user.login}
            </div>
            {data.user.name && !hideLabels && (
              <div className="text-sm text-gray-500 dark:text-gray-400">@{data.user.login}</div>
            )}
          </div>
          {showBio && data.user.bio && !hideLabels && (
            <div className="text-sm text-gray-600 dark:text-gray-300 text-center line-clamp-2">
              {data.user.bio}
            </div>
          )}
          <div className="flex gap-4 text-center">
            {showRepoCount && (
              <div>
                <ScaledMetric value={data.user.public_repos.toString()} className="text-blue-600 dark:text-blue-400" />
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Repos</div>}
              </div>
            )}
            {showFollowers && (
              <div>
                <ScaledMetric value={data.user.followers.toString()} className="text-gray-900 dark:text-white" />
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Followers</div>}
              </div>
            )}
            {showFollowing && (
              <div>
                <ScaledMetric value={data.user.following.toString()} className="text-gray-900 dark:text-white" />
                {!hideLabels && <div className="text-xs text-gray-500 dark:text-gray-400">Following</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </BaseWidget>
  );
}
