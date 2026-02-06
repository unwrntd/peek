import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Filter {
  pk: string;
  name: string;
  description: string;
  category: string;
  sources: number;
  domainCount: number;
  type: 'native' | 'thirdparty';
}

interface FiltersData {
  nativeFilters: Filter[];
  thirdPartyFilters: Filter[];
  totalNative: number;
  totalThirdParty: number;
}

interface FiltersWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function Filters({ integrationId, config, widgetId }: FiltersWidgetProps) {
  const { data, loading, error } = useWidgetData<FiltersData>({
    integrationId,
    metric: 'filters',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredFilters = useMemo(() => {
    if (!data) return [];

    let allFilters: Filter[] = [];

    if (!filters.type || filters.type === 'native') {
      allFilters = [...allFilters, ...data.nativeFilters];
    }
    if (!filters.type || filters.type === 'thirdparty') {
      allFilters = [...allFilters, ...data.thirdPartyFilters];
    }

    if (filters.category) {
      const cat = filters.category.toLowerCase();
      allFilters = allFilters.filter(f => f.category.toLowerCase().includes(cat));
    }

    return allFilters;
  }, [data, filters]);

  if (!data || (data.nativeFilters.length === 0 && data.thirdPartyFilters.length === 0)) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <p className="text-sm">No filters found</p>
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
            {filteredFilters.map(filter => (
              <div
                key={filter.pk}
                className="p-3 rounded-lg border border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      filter.type === 'native' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {filter.type === 'native' ? 'Native' : '3rd Party'}
                    </span>
                    <span className="font-medium text-white">{filter.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{formatNumber(filter.domainCount)} domains</span>
                </div>

                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{filter.description}</p>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                    {filter.category}
                  </span>
                  <span className="text-xs text-gray-500">{filter.sources} sources</span>
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
        <div className="sticky top-0 bg-gray-800 p-2 text-xs text-gray-400 border-b border-gray-700">
          {data.totalNative} native + {data.totalThirdParty} third-party filters
        </div>
        <table className="w-full text-sm">
          <thead className="sticky top-8 bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left p-2 font-medium">Filter</th>
              <th className="text-left p-2 font-medium">Category</th>
              <th className="text-center p-2 font-medium">Type</th>
              <th className="text-right p-2 font-medium">Domains</th>
            </tr>
          </thead>
          <tbody>
            {filteredFilters.map(filter => (
              <tr
                key={filter.pk}
                className="border-t border-gray-700/50 hover:bg-gray-800/50"
              >
                <td className="p-2">
                  <div className="text-white font-medium">{filter.name}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{filter.description}</div>
                </td>
                <td className="p-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
                    {filter.category}
                  </span>
                </td>
                <td className="p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    filter.type === 'native' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {filter.type === 'native' ? 'Native' : '3rd Party'}
                  </span>
                </td>
                <td className="p-2 text-right text-white">{formatNumber(filter.domainCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
