import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Rule {
  pk: string;
  order: number;
  group: string;
  action: number;
  actionLabel: string;
  actionTarget: string;
  hostnames: string[];
  created: number;
}

interface ProfileRules {
  profilePk: string;
  profileName: string;
  rules: Rule[];
  folders: Array<{
    pk: string;
    name: string;
    count: number;
    order: number;
  }>;
}

interface RulesData {
  profileRules: ProfileRules[];
  totalProfiles: number;
}

interface RulesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getActionColor(action: number): string {
  switch (action) {
    case 0:
      return 'bg-green-500/20 text-green-400';
    case 1:
      return 'bg-red-500/20 text-red-400';
    case 2:
      return 'bg-blue-500/20 text-blue-400';
    case 3:
      return 'bg-purple-500/20 text-purple-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export function Rules({ integrationId, config, widgetId }: RulesWidgetProps) {
  const { data, loading, error } = useWidgetData<RulesData>({
    integrationId,
    metric: 'rules',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredRules = useMemo(() => {
    if (!data?.profileRules) return [];

    const allRules: Array<Rule & { profileName: string }> = [];

    for (const profile of data.profileRules) {
      for (const rule of profile.rules) {
        if (filters.action && rule.action.toString() !== filters.action) {
          continue;
        }
        allRules.push({
          ...rule,
          profileName: profile.profileName,
        });
      }
    }

    return allRules;
  }, [data, filters]);

  if (!data?.profileRules?.length || !filteredRules.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No custom rules found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'byProfile') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-4">
            {data.profileRules.map(profile => (
              <div key={profile.profilePk}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{profile.profileName}</span>
                  <span className="text-xs text-gray-500">{profile.rules.length} rules</span>
                </div>
                <div className="space-y-1">
                  {profile.rules
                    .filter(rule => !filters.action || rule.action.toString() === filters.action)
                    .slice(0, 5)
                    .map(rule => (
                      <div
                        key={rule.pk}
                        className="flex items-center justify-between p-2 bg-gray-800 rounded"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getActionColor(rule.action)}`}>
                            {rule.actionLabel}
                          </span>
                          <span className="text-xs text-gray-300 truncate">
                            {rule.hostnames.slice(0, 2).join(', ')}
                            {rule.hostnames.length > 2 && ` +${rule.hostnames.length - 2}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  {profile.rules.filter(rule => !filters.action || rule.action.toString() === filters.action).length > 5 && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      +{profile.rules.filter(rule => !filters.action || rule.action.toString() === filters.action).length - 5} more rules
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default table view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left p-2 font-medium">Profile</th>
              <th className="text-center p-2 font-medium">Action</th>
              <th className="text-left p-2 font-medium">Hostnames</th>
              <th className="text-left p-2 font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map(rule => (
              <tr
                key={rule.pk}
                className="border-t border-gray-700/50 hover:bg-gray-800/50"
              >
                <td className="p-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                    {rule.profileName}
                  </span>
                </td>
                <td className="p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${getActionColor(rule.action)}`}>
                    {rule.actionLabel}
                  </span>
                </td>
                <td className="p-2">
                  <div className="text-xs text-gray-300 max-w-[200px]">
                    {rule.hostnames.slice(0, 2).map((hostname, i) => (
                      <span key={i} className="font-mono">
                        {hostname}
                        {i < Math.min(rule.hostnames.length, 2) - 1 && ', '}
                      </span>
                    ))}
                    {rule.hostnames.length > 2 && (
                      <span className="text-gray-500"> +{rule.hostnames.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="p-2 text-xs text-gray-500">
                  {rule.actionTarget || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
