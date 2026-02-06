import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Profile {
  pk: string;
  name: string;
  updated: number;
  analyticsLevel: number;
  counts: {
    filters: number;
    counterFilters: number;
    ipFilters: number;
    rules: number;
    services: number;
    folders: number;
    options: number;
  };
  deviceCount: number;
}

interface ProfilesData {
  profiles: Profile[];
  total: number;
}

interface ProfilesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getAnalyticsLabel(level: number): string {
  switch (level) {
    case 0:
      return 'Off';
    case 1:
      return 'Basic';
    case 2:
      return 'Full';
    default:
      return 'Unknown';
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function Profiles({ integrationId, config, widgetId }: ProfilesWidgetProps) {
  const { data, loading, error } = useWidgetData<ProfilesData>({
    integrationId,
    metric: 'profiles',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredProfiles = useMemo(() => {
    if (!data?.profiles) return [];

    return data.profiles.filter(profile => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!profile.name.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  if (!data?.profiles?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm">No profiles found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-3">
            {filteredProfiles.map(profile => (
              <div
                key={profile.pk}
                className="p-3 rounded-lg border border-gray-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-white">{profile.name}</div>
                    <div className="text-xs text-gray-500">Updated {formatDate(profile.updated)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      {profile.deviceCount} devices
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-gray-800 rounded">
                    <div className="text-lg font-semibold text-white">{profile.counts.filters}</div>
                    <div className="text-[10px] text-gray-500">Filters</div>
                  </div>
                  <div className="p-2 bg-gray-800 rounded">
                    <div className="text-lg font-semibold text-white">{profile.counts.rules}</div>
                    <div className="text-[10px] text-gray-500">Rules</div>
                  </div>
                  <div className="p-2 bg-gray-800 rounded">
                    <div className="text-lg font-semibold text-white">{profile.counts.services}</div>
                    <div className="text-[10px] text-gray-500">Services</div>
                  </div>
                  <div className="p-2 bg-gray-800 rounded">
                    <div className="text-lg font-semibold text-white">{profile.counts.folders}</div>
                    <div className="text-[10px] text-gray-500">Folders</div>
                  </div>
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
              <th className="text-center p-2 font-medium">Devices</th>
              <th className="text-center p-2 font-medium">Filters</th>
              <th className="text-center p-2 font-medium">Rules</th>
              <th className="text-center p-2 font-medium">Services</th>
              <th className="text-center p-2 font-medium">Analytics</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.map(profile => (
              <tr
                key={profile.pk}
                className="border-t border-gray-700/50 hover:bg-gray-800/50"
              >
                <td className="p-2">
                  <div className="text-white font-medium">{profile.name}</div>
                  <div className="text-xs text-gray-500">Updated {formatDate(profile.updated)}</div>
                </td>
                <td className="p-2 text-center">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                    {profile.deviceCount}
                  </span>
                </td>
                <td className="p-2 text-center text-white">{profile.counts.filters}</td>
                <td className="p-2 text-center text-white">{profile.counts.rules}</td>
                <td className="p-2 text-center text-white">{profile.counts.services}</td>
                <td className="p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    profile.analyticsLevel === 2 ? 'bg-green-500/20 text-green-400' :
                    profile.analyticsLevel === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {getAnalyticsLabel(profile.analyticsLevel)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
