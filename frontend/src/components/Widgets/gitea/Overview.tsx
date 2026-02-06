import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface OverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface GiteaUser {
  login: string;
  full_name: string;
  avatar_url: string;
  email: string;
  is_admin: boolean;
}

interface OverviewData {
  user: GiteaUser;
  stats: {
    totalRepos: number;
    publicRepos: number;
    privateRepos: number;
    organizations: number;
    stars: number;
    followers: number;
    following: number;
  };
}

export function Overview({ integrationId, config, widgetId }: OverviewProps) {
  const { data, loading, error } = useWidgetData<OverviewData>({
    integrationId,
    metric: 'overview',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const showRepoCount = config.showRepoCount !== false;
  const showOrgCount = config.showOrgCount !== false;
  const showStarCount = config.showStarCount !== false;
  const showFollowerCount = config.showFollowerCount !== false;
  const hideLabels = config.hideLabels === true;
  const metricSize = (config.metricSize as string) || 'medium';

  const getSizeClasses = () => {
    switch (metricSize) {
      case 'small':
        return { value: 'text-lg', label: 'text-xs' };
      case 'large':
        return { value: 'text-4xl', label: 'text-sm' };
      default:
        return { value: 'text-2xl', label: 'text-xs' };
    }
  };

  const sizes = getSizeClasses();

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          {/* User Info */}
          <div className="flex items-center gap-3">
            {data.user.avatar_url && (
              <img
                src={data.user.avatar_url}
                alt={data.user.login}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div className="min-w-0">
              <div className="font-medium text-gray-900 dark:text-white truncate">
                {data.user.full_name || data.user.login}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                @{data.user.login}
                {data.user.is_admin && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {showRepoCount && (
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className={`font-bold text-gray-900 dark:text-white ${sizes.value}`}>
                  {data.stats.totalRepos}
                </div>
                {!hideLabels && (
                  <div className={`text-gray-500 dark:text-gray-400 ${sizes.label}`}>
                    Repositories
                  </div>
                )}
              </div>
            )}
            {showOrgCount && (
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className={`font-bold text-gray-900 dark:text-white ${sizes.value}`}>
                  {data.stats.organizations}
                </div>
                {!hideLabels && (
                  <div className={`text-gray-500 dark:text-gray-400 ${sizes.label}`}>
                    Organizations
                  </div>
                )}
              </div>
            )}
            {showStarCount && (
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className={`font-bold text-yellow-600 dark:text-yellow-400 ${sizes.value}`}>
                  {data.stats.stars}
                </div>
                {!hideLabels && (
                  <div className={`text-gray-500 dark:text-gray-400 ${sizes.label}`}>
                    Stars
                  </div>
                )}
              </div>
            )}
            {showFollowerCount && (
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className={`font-bold text-gray-900 dark:text-white ${sizes.value}`}>
                  {data.stats.followers}
                </div>
                {!hideLabels && (
                  <div className={`text-gray-500 dark:text-gray-400 ${sizes.label}`}>
                    Followers
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </BaseWidget>
  );
}
