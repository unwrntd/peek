import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Proxy {
  pk: string;
  city: string;
  country: string;
  countryName: string;
  latitude: number;
  longitude: number;
}

interface CountryGroup {
  country: string;
  countryName: string;
  locations: Array<{ pk: string; city: string }>;
  count: number;
}

interface ProxiesData {
  proxies: Proxy[];
  byCountry: CountryGroup[];
  total: number;
  totalCountries: number;
}

interface ProxiesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Proxies({ integrationId, config, widgetId }: ProxiesWidgetProps) {
  const { data, loading, error } = useWidgetData<ProxiesData>({
    integrationId,
    metric: 'proxies',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredProxies = useMemo(() => {
    if (!data?.proxies) return [];

    return data.proxies.filter(proxy => {
      if (filters.country) {
        const country = filters.country.toLowerCase();
        if (!proxy.country.toLowerCase().includes(country) &&
            !proxy.countryName.toLowerCase().includes(country)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  const filteredByCountry = useMemo(() => {
    if (!data?.byCountry) return [];

    return data.byCountry.filter(group => {
      if (filters.country) {
        const country = filters.country.toLowerCase();
        if (!group.country.toLowerCase().includes(country) &&
            !group.countryName.toLowerCase().includes(country)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  if (!data?.proxies?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No proxy locations found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'byCountry') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredByCountry.map(group => (
              <div
                key={group.country}
                className="p-3 rounded-lg border border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getFlagEmoji(group.country)}</span>
                    <span className="font-medium text-white">{group.countryName}</span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                    {group.count} cities
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {group.locations.slice(0, 5).map(loc => (
                    <span
                      key={loc.pk}
                      className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400"
                    >
                      {loc.city}
                    </span>
                  ))}
                  {group.locations.length > 5 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">
                      +{group.locations.length - 5}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'map') {
    // Simple map visualization showing locations
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-4">
          <div className="text-center mb-4">
            <div className="text-2xl font-bold text-white">{data.total}</div>
            <div className="text-sm text-gray-400">proxy locations in {data.totalCountries} countries</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredByCountry.slice(0, 12).map(group => (
              <div
                key={group.country}
                className="text-center p-2 bg-gray-800 rounded"
              >
                <div className="text-xl mb-1">{getFlagEmoji(group.country)}</div>
                <div className="text-xs text-gray-400">{group.countryName}</div>
                <div className="text-xs text-blue-400">{group.count} cities</div>
              </div>
            ))}
          </div>

          {filteredByCountry.length > 12 && (
            <div className="text-center mt-4 text-xs text-gray-500">
              +{filteredByCountry.length - 12} more countries
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default table view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="sticky top-0 bg-gray-800 p-2 text-xs text-gray-400 border-b border-gray-700">
          {data.total} locations in {data.totalCountries} countries
        </div>
        <table className="w-full text-sm">
          <thead className="sticky top-8 bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left p-2 font-medium">Location</th>
              <th className="text-left p-2 font-medium">Country</th>
              <th className="text-left p-2 font-medium">ID</th>
            </tr>
          </thead>
          <tbody>
            {filteredProxies.map(proxy => (
              <tr
                key={proxy.pk}
                className="border-t border-gray-700/50 hover:bg-gray-800/50"
              >
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getFlagEmoji(proxy.country)}</span>
                    <span className="text-white">{proxy.city}</span>
                  </div>
                </td>
                <td className="p-2 text-gray-400">{proxy.countryName}</td>
                <td className="p-2 text-xs font-mono text-gray-500">{proxy.pk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
