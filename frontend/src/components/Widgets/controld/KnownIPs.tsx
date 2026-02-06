import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';

interface KnownIP {
  pk: string;
  ip: string;
  created: number;
  lastUsed: number;
  geo: {
    country: string;
    city: string;
    asn: number;
    asnOrg: string;
  };
}

interface KnownIPsData {
  knownIPs: KnownIP[];
  total: number;
}

interface KnownIPsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Never';
  return new Date(timestamp * 1000).toLocaleDateString();
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return 'Never';
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(timestamp);
}

export function KnownIPs({ integrationId, config, widgetId }: KnownIPsWidgetProps) {
  const { rIP } = useRedact();
  const { data, loading, error } = useWidgetData<KnownIPsData>({
    integrationId,
    metric: 'known-ips',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredIPs = useMemo(() => {
    if (!data?.knownIPs) return [];

    return data.knownIPs.filter(ip => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!ip.ip.toLowerCase().includes(search) &&
            !ip.geo.city.toLowerCase().includes(search) &&
            !ip.geo.country.toLowerCase().includes(search) &&
            !ip.geo.asnOrg.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  if (!data?.knownIPs?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No known IPs found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-2">
            {filteredIPs.map(ip => (
              <div
                key={ip.pk}
                className="p-3 rounded-lg border border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-mono font-medium text-white">{rIP(ip.ip)}</span>
                  <span className="text-xs text-gray-500">Last used {formatTimeAgo(ip.lastUsed)}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{ip.geo.city}, {ip.geo.country}</span>
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  {ip.geo.asnOrg} (AS{ip.geo.asn})
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
              <th className="text-left p-2 font-medium">IP Address</th>
              <th className="text-left p-2 font-medium">Location</th>
              <th className="text-left p-2 font-medium">ISP</th>
              <th className="text-right p-2 font-medium">Last Used</th>
            </tr>
          </thead>
          <tbody>
            {filteredIPs.map(ip => (
              <tr
                key={ip.pk}
                className="border-t border-gray-700/50 hover:bg-gray-800/50"
              >
                <td className="p-2 font-mono text-white">{rIP(ip.ip)}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="text-xs text-gray-400">{ip.geo.city}, {ip.geo.country}</span>
                  </div>
                </td>
                <td className="p-2 text-xs text-gray-500">{ip.geo.asnOrg}</td>
                <td className="p-2 text-right text-xs text-gray-400">{formatTimeAgo(ip.lastUsed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
