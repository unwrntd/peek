import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface ServicesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface OPNsenseService {
  name: string;
  description: string;
  status: 'running' | 'stopped';
  enabled: boolean;
}

interface ServicesData {
  services: OPNsenseService[];
  stats: {
    total: number;
    running: number;
    stopped: number;
  };
}

export function Services({ integrationId, config, widgetId }: ServicesProps) {
  const { data, loading, error } = useWidgetData<ServicesData>({
    integrationId,
    metric: 'services',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const statusFilter = config.status as string;
  const searchFilter = (config.search as string) || '';
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'list';

  const filteredServices = useMemo(() => {
    let services = data?.services || [];

    if (statusFilter === 'running') {
      services = services.filter(s => s.status === 'running');
    } else if (statusFilter === 'stopped') {
      services = services.filter(s => s.status === 'stopped');
    }

    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      services = services.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.description.toLowerCase().includes(search)
      );
    }

    return services;
  }, [data?.services, statusFilter, searchFilter]);

  const renderListView = () => (
    <div className="space-y-1">
      {filteredServices.map(service => (
        <div key={service.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${service.status === 'running' ? 'bg-green-500' : 'bg-gray-400'}`} />
            <div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">
                {service.description || service.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {service.name}
              </div>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${
            service.status === 'running'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            {service.status}
          </span>
        </div>
      ))}
    </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {filteredServices.map(service => (
        <div
          key={service.name}
          className={`p-2 rounded-lg text-center ${
            service.status === 'running'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
          }`}
        >
          <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
            service.status === 'running' ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <div className={`text-xs font-medium truncate ${
            service.status === 'running'
              ? 'text-green-700 dark:text-green-400'
              : 'text-gray-600 dark:text-gray-300'
          }`}>
            {service.description || service.name}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCompactView = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data?.stats.running || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Running</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {data?.stats.stopped || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Stopped</div>
        </div>
      </div>

      {data?.stats.stopped && data.stats.stopped > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Stopped Services
          </div>
          {filteredServices.filter(s => s.status === 'stopped').slice(0, 5).map(service => (
            <div key={service.name} className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                {service.description || service.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">stopped</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!data?.services?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <p className="text-sm">No services found</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="flex flex-col h-full">
          {!hideLabels && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Services
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data.stats.running}/{data.stats.total} running
              </span>
            </div>
          )}
          {visualizationType === 'grid' ? renderGridView() :
           visualizationType === 'compact' ? renderCompactView() : renderListView()}
        </div>
      )}
    </BaseWidget>
  );
}
