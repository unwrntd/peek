import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Service {
  pk: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  warning: string | null;
  unlockLocations: string[];
}

interface Category {
  pk: string;
  name: string;
  count: number;
}

interface ServicesData {
  services: Service[];
  categories: Category[];
  totalServices: number;
  totalCategories: number;
}

interface ServicesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Services({ integrationId, config, widgetId }: ServicesWidgetProps) {
  const { data, loading, error } = useWidgetData<ServicesData>({
    integrationId,
    metric: 'services',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'grid';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredServices = useMemo(() => {
    if (!data?.services) return [];

    return data.services.filter(service => {
      if (filters.category) {
        const cat = filters.category.toLowerCase();
        if (!service.category.toLowerCase().includes(cat)) return false;
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!service.name.toLowerCase().includes(search) &&
            !service.description.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  const servicesByCategory = useMemo(() => {
    if (!data?.services) return {};

    const grouped: Record<string, Service[]> = {};
    for (const service of filteredServices) {
      if (!grouped[service.category]) {
        grouped[service.category] = [];
      }
      grouped[service.category].push(service);
    }
    return grouped;
  }, [data, filteredServices]);

  if (!data?.services?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <p className="text-sm">No services found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'byCategory') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-4">
            {Object.entries(servicesByCategory).map(([category, services]) => (
              <div key={category}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{category}</span>
                  <span className="text-xs text-gray-500">{services.length} services</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {services.slice(0, 6).map(service => (
                    <div
                      key={service.pk}
                      className="p-2 rounded bg-gray-800 text-center"
                    >
                      <div className="text-xs text-white truncate">{service.name}</div>
                    </div>
                  ))}
                  {services.length > 6 && (
                    <div className="p-2 rounded bg-gray-800 text-center text-xs text-gray-500">
                      +{services.length - 6} more
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

  if (visualization === 'table') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800 text-gray-400">
              <tr>
                <th className="text-left p-2 font-medium">Service</th>
                <th className="text-left p-2 font-medium">Category</th>
                <th className="text-left p-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map(service => (
                <tr
                  key={service.pk}
                  className="border-t border-gray-700/50 hover:bg-gray-800/50"
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{service.name}</span>
                      {service.warning && (
                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
                      {service.category}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-gray-500 line-clamp-1">
                    {service.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BaseWidget>
    );
  }

  // Default grid view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredServices.map(service => (
            <div
              key={service.pk}
              className="p-3 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">{service.name}</div>
                  <div className="text-[10px] text-gray-500">{service.category}</div>
                </div>
              </div>
              {service.warning && (
                <div className="text-[10px] text-yellow-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                  </svg>
                  Warning
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </BaseWidget>
  );
}
