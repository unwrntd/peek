import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface DNSProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TailscaleDNS {
  nameservers: string[];
  magicDNS: boolean;
  searchPaths: string[];
}

interface DNSData {
  dns: TailscaleDNS;
}

export function DNS({ integrationId, config, widgetId }: DNSProps) {
  const { data, loading, error } = useWidgetData<DNSData>({
    integrationId,
    metric: 'dns',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showMagicDNS = config.showMagicDNS !== false;
  const showNameservers = config.showNameservers !== false;
  const showSearchPaths = config.showSearchPaths !== false;
  const visualizationType = (config.visualization as string) || 'cards';
  const metricSize = (config.metricSize as string) || 'medium';

  const dns = data?.dns;

  const getMetricSizeClass = () => {
    switch (metricSize) {
      case 'small':
        return 'text-sm';
      case 'large':
        return 'text-lg';
      default:
        return 'text-base';
    }
  };

  const renderCardsView = () => (
    <div className="space-y-3">
      {showMagicDNS && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">MagicDNS</div>
              <div className={`${getMetricSizeClass()} font-medium text-gray-900 dark:text-white mt-1`}>
                Automatic DNS resolution
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              dns?.magicDNS
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {dns?.magicDNS ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      )}

      {showNameservers && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Nameservers</div>
          {dns?.nameservers && dns.nameservers.length > 0 ? (
            <div className="space-y-1">
              {dns.nameservers.map((ns, index) => (
                <div key={index} className={`${getMetricSizeClass()} font-mono text-gray-900 dark:text-white`}>
                  {ns}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">No nameservers configured</div>
          )}
        </div>
      )}

      {showSearchPaths && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Search Paths</div>
          {dns?.searchPaths && dns.searchPaths.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dns.searchPaths.map((path, index) => (
                <span key={index} className={`${getMetricSizeClass()} px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-mono`}>
                  {path}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">No search paths configured</div>
          )}
        </div>
      )}
    </div>
  );

  const renderCompactView = () => (
    <div className="space-y-2">
      {showMagicDNS && (
        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-300">MagicDNS</span>
          <span className={`text-sm font-medium ${dns?.magicDNS ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {dns?.magicDNS ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      )}

      {showNameservers && (
        <div className="py-1 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Nameservers</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{dns?.nameservers?.length || 0}</span>
          </div>
          {dns?.nameservers && dns.nameservers.length > 0 && (
            <div className="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">
              {dns.nameservers.slice(0, 2).join(', ')}
              {dns.nameservers.length > 2 && ` +${dns.nameservers.length - 2} more`}
            </div>
          )}
        </div>
      )}

      {showSearchPaths && (
        <div className="py-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Search Paths</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{dns?.searchPaths?.length || 0}</span>
          </div>
          {dns?.searchPaths && dns.searchPaths.length > 0 && (
            <div className="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">
              {dns.searchPaths.slice(0, 2).join(', ')}
              {dns.searchPaths.length > 2 && ` +${dns.searchPaths.length - 2} more`}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && dns && (
        <>
          {visualizationType === 'compact' ? renderCompactView() : renderCardsView()}
        </>
      )}
    </BaseWidget>
  );
}
