import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface OrganizationsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface GiteaTeam {
  id: number;
  name: string;
  description: string;
  permission: string;
  members_count: number;
  repos_count: number;
}

interface GiteaOrganization {
  id: number;
  username: string;
  full_name: string;
  avatar_url: string;
  description: string;
  repoCount?: number;
  memberCount?: number;
  teams?: GiteaTeam[];
}

interface OrganizationsData {
  organizations: GiteaOrganization[];
  total: number;
}

export function Organizations({ integrationId, config, widgetId }: OrganizationsProps) {
  const { data, loading, error } = useWidgetData<OrganizationsData>({
    integrationId,
    metric: 'organizations',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const showTeams = config.showTeams === true;
  const showMemberCount = config.showMemberCount !== false;
  const showRepoCount = config.showRepoCount !== false;
  const showDescription = config.showDescription !== false;
  const hideLabels = config.hideLabels === true;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          {data.organizations.map(org => (
            <div
              key={org.id}
              className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
            >
              <div className="flex items-start gap-3">
                {org.avatar_url && (
                  <img
                    src={org.avatar_url}
                    alt={org.username}
                    className="w-10 h-10 rounded-lg"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {org.full_name || org.username}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    @{org.username}
                  </div>
                  {showDescription && org.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {org.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              {(showMemberCount || showRepoCount) && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {showMemberCount && org.memberCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      {!hideLabels && <span>{org.memberCount} members</span>}
                      {hideLabels && <span>{org.memberCount}</span>}
                    </span>
                  )}
                  {showRepoCount && org.repoCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {!hideLabels && <span>{org.repoCount} repos</span>}
                      {hideLabels && <span>{org.repoCount}</span>}
                    </span>
                  )}
                </div>
              )}

              {/* Teams */}
              {showTeams && org.teams && org.teams.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Teams
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {org.teams.map(team => (
                      <span
                        key={team.id}
                        className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        title={team.description || team.name}
                      >
                        {team.name}
                        {team.permission && (
                          <span className="ml-1 opacity-60">({team.permission})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {data.organizations.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No organizations found
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
