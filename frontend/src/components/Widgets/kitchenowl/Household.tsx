import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface HouseholdMember {
  id: number;
  name: string;
  username: string;
}

interface HouseholdInfo {
  id: number;
  name: string;
  photo?: string;
  language?: string;
  currency?: string;
}

interface HouseholdData {
  household: HouseholdInfo;
  members: HouseholdMember[];
  summary: {
    memberCount: number;
    recipeCount: number;
    shoppingListCount: number;
    itemCount: number;
  };
}

interface HouseholdWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Household({ integrationId, config, widgetId }: HouseholdWidgetProps) {
  const { data, loading, error } = useWidgetData<HouseholdData>({
    integrationId,
    metric: 'household',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'stats';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <p className="text-sm">Loading household...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'members') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="text-xs text-gray-500 mb-2 px-1">{data.household.name}</div>
          <div className="space-y-2">
            {data.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-medium text-sm">
                  {member.name?.charAt(0).toUpperCase() || member.username?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{member.name || member.username}</div>
                  {member.name && member.username && (
                    <div className="text-xs text-gray-500">@{member.username}</div>
                  )}
                </div>
              </div>
            ))}
            {data.members.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">No members</p>
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default stats view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col p-2">
        <div className="text-center mb-3">
          <div className="text-xs text-gray-500 mb-1">Household</div>
          <div className="text-lg font-medium text-white">{data.household.name}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 flex-1">
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-400">{data.summary.recipeCount}</div>
            <div className="text-xs text-gray-500">Recipes</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-400">{data.summary.itemCount}</div>
            <div className="text-xs text-gray-500">Items</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-400">{data.summary.shoppingListCount}</div>
            <div className="text-xs text-gray-500">Lists</div>
          </div>
          <div className="p-2 bg-gray-800 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-400">{data.summary.memberCount}</div>
            <div className="text-xs text-gray-500">Members</div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
