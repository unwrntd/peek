import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface FGPolicy {
  policyid: number;
  name: string;
  srcintf: string[];
  dstintf: string[];
  srcaddr: string[];
  dstaddr: string[];
  service: string[];
  action: string;
  status: string;
  logtraffic: string;
  hitCount: number;
  bytes: number;
  lastUsed: number;
}

interface PoliciesData {
  policies: FGPolicy[];
  stats: {
    total: number;
    enabled: number;
    disabled: number;
    totalHits: number;
    totalBytes: number;
  };
}

interface PoliciesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function FortiGatePolicies({ integrationId, config, widgetId }: PoliciesWidgetProps) {
  const { data, loading, error } = useWidgetData<PoliciesData>({
    integrationId,
    metric: 'policies',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Loading policies...</p>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    const topPolicies = [...data.policies]
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10);

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-4 overflow-auto">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{data.stats.total}</div>
              <div className="text-xs text-gray-400">Total Policies</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{data.stats.totalHits.toLocaleString()}</div>
              <div className="text-xs text-gray-400">Total Hits</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{formatBytes(data.stats.totalBytes)}</div>
              <div className="text-xs text-gray-400">Total Traffic</div>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-2">Top Policies by Hits</div>
          <div className="space-y-2">
            {topPolicies.map((policy) => (
              <div key={policy.policyid} className="bg-gray-700/30 rounded p-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white">{policy.name || `Policy ${policy.policyid}`}</span>
                  <span className="text-sm text-green-400">{policy.hitCount.toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {policy.srcintf.join(', ')} &rarr; {policy.dstintf.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-3 overflow-auto">
          <div className="space-y-2">
            {data.policies.map((policy) => (
              <div
                key={policy.policyid}
                className={`p-3 rounded-lg border ${
                  policy.status === 'enable'
                    ? 'bg-gray-700/30 border-gray-600'
                    : 'bg-gray-800/50 border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-xs rounded ${
                      policy.action === 'accept'
                        ? 'bg-green-500/20 text-green-400'
                        : policy.action === 'deny'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {policy.action.toUpperCase()}
                    </span>
                    <span className="font-medium text-white">{policy.name || `Policy ${policy.policyid}`}</span>
                  </div>
                  <span className="text-xs text-gray-500">#{policy.policyid}</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex gap-2">
                    <span className="text-gray-500">From:</span>
                    <span>{policy.srcintf.join(', ')} ({policy.srcaddr.join(', ')})</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500">To:</span>
                    <span>{policy.dstintf.join(', ')} ({policy.dstaddr.join(', ')})</span>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-gray-500">{policy.service.join(', ')}</span>
                  <span className="text-green-400">{policy.hitCount.toLocaleString()} hits</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default table visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800">
            <tr className="text-left text-gray-400 text-xs">
              <th className="p-2">#</th>
              <th className="p-2">Name</th>
              <th className="p-2">Source</th>
              <th className="p-2">Dest</th>
              <th className="p-2">Action</th>
              <th className="p-2 text-right">Hits</th>
              <th className="p-2 text-right">Traffic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.policies.map((policy) => (
              <tr
                key={policy.policyid}
                className={`hover:bg-gray-700/30 ${policy.status !== 'enable' ? 'opacity-50' : ''}`}
              >
                <td className="p-2 text-gray-500">{policy.policyid}</td>
                <td className="p-2 text-white font-medium">{policy.name || '-'}</td>
                <td className="p-2 text-gray-300 text-xs">
                  <div>{policy.srcintf.join(', ')}</div>
                  <div className="text-gray-500">{policy.srcaddr.slice(0, 2).join(', ')}{policy.srcaddr.length > 2 ? '...' : ''}</div>
                </td>
                <td className="p-2 text-gray-300 text-xs">
                  <div>{policy.dstintf.join(', ')}</div>
                  <div className="text-gray-500">{policy.dstaddr.slice(0, 2).join(', ')}{policy.dstaddr.length > 2 ? '...' : ''}</div>
                </td>
                <td className="p-2">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    policy.action === 'accept'
                      ? 'bg-green-500/20 text-green-400'
                      : policy.action === 'deny'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {policy.action}
                  </span>
                </td>
                <td className="p-2 text-right text-green-400">{policy.hitCount.toLocaleString()}</td>
                <td className="p-2 text-right text-gray-400">{formatBytes(policy.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
