import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface OverviewData {
  user: {
    email: string;
    organization: string | null;
    role: string | null;
  };
  counts: {
    profiles: number;
    devices: number;
    activeDevices: number;
    pendingDevices: number;
    disabledDevices: number;
  };
  stats: {
    totalFilters: number;
    totalRules: number;
    totalServices: number;
  };
}

interface OverviewWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Overview({ integrationId, config, widgetId }: OverviewWidgetProps) {
  const { data, loading, error } = useWidgetData<OverviewData>({
    integrationId,
    metric: 'overview',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm">Loading ControlD data...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{data.counts.devices}</div>
              <div className="text-xs text-gray-400">Devices</div>
            </div>
            <div className="text-center p-3 bg-purple-500/10 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{data.counts.profiles}</div>
              <div className="text-xs text-gray-400">Profiles</div>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{data.counts.activeDevices}</div>
              <div className="text-xs text-gray-400">Active</div>
            </div>
            <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
              <div className="text-2xl font-bold text-yellow-400">{data.counts.pendingDevices}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-semibold text-white">{data.stats.totalFilters}</div>
                <div className="text-xs text-gray-500">Filters</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-white">{data.stats.totalRules}</div>
                <div className="text-xs text-gray-500">Rules</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-white">{data.stats.totalServices}</div>
                <div className="text-xs text-gray-500">Services</div>
              </div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default card view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="text-sm text-white font-medium">{data.user.email}</div>
            {data.user.organization && (
              <div className="text-xs text-gray-400">{data.user.organization}</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Devices</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{data.counts.devices}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                {data.counts.activeDevices} active
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Profiles</span>
            <span className="text-sm font-medium text-white">{data.counts.profiles}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Total Filters</span>
            <span className="text-sm font-medium text-white">{data.stats.totalFilters}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Custom Rules</span>
            <span className="text-sm font-medium text-white">{data.stats.totalRules}</span>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
