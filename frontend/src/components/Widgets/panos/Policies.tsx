import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface SecurityRule {
  name: string;
  uuid: string;
  source: string[];
  destination: string[];
  application: string[];
  service: string[];
  action: string;
  disabled: boolean;
  hitCount: number;
  logStart: boolean;
  logEnd: boolean;
}

interface PoliciesData {
  rules: SecurityRule[];
  stats: {
    total: number;
    enabled: number;
    disabled: number;
    hitCount: number;
  };
}

interface PoliciesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getActionColor(action: string): string {
  switch (action.toLowerCase()) {
    case 'allow':
      return 'bg-green-900/30 text-green-400';
    case 'deny':
    case 'drop':
      return 'bg-red-900/30 text-red-400';
    default:
      return 'bg-yellow-900/30 text-yellow-400';
  }
}

export function Policies({ integrationId, config, widgetId }: PoliciesWidgetProps) {
  const { data, loading, error } = useWidgetData<PoliciesData>({
    integrationId,
    metric: 'policies',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Loading policies...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-3xl font-bold text-white mb-2">{data.stats.total}</div>
          <div className="text-sm text-gray-400 mb-4">Security Rules</div>
          <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
            <div className="p-2 bg-gray-800 rounded-lg text-center">
              <div className="text-lg font-bold text-green-400">{data.stats.enabled}</div>
              <div className="text-xs text-gray-500">Enabled</div>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg text-center">
              <div className="text-lg font-bold text-gray-400">{data.stats.disabled}</div>
              <div className="text-xs text-gray-500">Disabled</div>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg text-center">
              <div className="text-lg font-bold text-blue-400">{data.stats.hitCount.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Hits</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-gray-500">{data.stats.total} rules</span>
            <span className="text-gray-400">{data.stats.enabled} enabled</span>
          </div>
          <div className="space-y-1">
            {data.rules.map((rule) => (
              <div key={rule.uuid || rule.name} className={`flex items-center gap-3 p-2 bg-gray-800 rounded-lg ${rule.disabled ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{rule.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {rule.source.join(', ')} → {rule.destination.join(', ')}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${getActionColor(rule.action)}`}>
                  {rule.action}
                </span>
              </div>
            ))}
            {data.rules.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">No security rules found</p>
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default table view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <span className="text-gray-500">{data.stats.total} rules</span>
          <span className="text-gray-400">{data.stats.hitCount.toLocaleString()} total hits</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Source</th>
              <th className="text-left py-2 px-2">Destination</th>
              <th className="text-left py-2 px-2">Action</th>
              <th className="text-right py-2 px-2">Hits</th>
            </tr>
          </thead>
          <tbody>
            {data.rules.map((rule) => (
              <tr key={rule.uuid || rule.name} className={`border-b border-gray-800 ${rule.disabled ? 'opacity-50' : ''}`}>
                <td className="py-2 px-2 text-white truncate max-w-[150px]">{rule.name}</td>
                <td className="py-2 px-2 text-gray-400 truncate max-w-[100px]">{rule.source.join(', ')}</td>
                <td className="py-2 px-2 text-gray-400 truncate max-w-[100px]">{rule.destination.join(', ')}</td>
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 rounded ${getActionColor(rule.action)}`}>
                    {rule.action}
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-gray-400">{rule.hitCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rules.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">No security rules found</p>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
