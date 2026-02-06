import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface GatewaysProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface OPNsenseGateway {
  name: string;
  address: string;
  interface: string;
  status: 'online' | 'offline' | 'pending' | 'unknown';
  delay: number;
  stddev: number;
  loss: number;
  monitor: string;
  default: boolean;
}

interface GatewaysData {
  gateways: OPNsenseGateway[];
  stats: {
    total: number;
    online: number;
    offline: number;
  };
}

export function Gateways({ integrationId, config, widgetId }: GatewaysProps) {
  const { data, loading, error } = useWidgetData<GatewaysData>({
    integrationId,
    metric: 'gateways',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const showStatus = config.showStatus !== false;
  const showLatency = config.showLatency !== false;
  const showLoss = config.showLoss !== false;
  const showGatewayIP = config.showGatewayIP !== false;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'cards';
  const metricSize = (config.metricSize as string) || 'medium';

  const getMetricSizeClass = () => {
    switch (metricSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-xl';
      default: return 'text-base';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'offline':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    }
  };

  const formatLatency = (delay: number) => {
    if (delay < 1) return '<1ms';
    return `${Math.round(delay)}ms`;
  };

  const renderCardsView = () => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {data?.gateways.map(gateway => (
        <div key={gateway.name} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                {gateway.name}
              </span>
              {gateway.default && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                  Default
                </span>
              )}
            </div>
            {showStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(gateway.status)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(gateway.status)}`} />
                {gateway.status}
              </span>
            )}
          </div>

          <div className="space-y-1 text-sm">
            {showGatewayIP && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Gateway</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{gateway.address}</span>
              </div>
            )}
            {showLatency && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Latency</span>
                <span className={`${getMetricSizeClass()} font-medium ${
                  gateway.delay > 100 ? 'text-red-600 dark:text-red-400' :
                  gateway.delay > 50 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-green-600 dark:text-green-400'
                }`}>
                  {formatLatency(gateway.delay)}
                </span>
              </div>
            )}
            {showLoss && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Packet Loss</span>
                <span className={`${getMetricSizeClass()} font-medium ${
                  gateway.loss > 5 ? 'text-red-600 dark:text-red-400' :
                  gateway.loss > 1 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-green-600 dark:text-green-400'
                }`}>
                  {gateway.loss.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      {data?.gateways.map(gateway => (
        <div key={gateway.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            {showStatus && (
              <div className={`w-2 h-2 rounded-full ${getStatusColor(gateway.status)}`} />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white text-sm">{gateway.name}</span>
                {gateway.default && (
                  <span className="text-xs px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                    Default
                  </span>
                )}
              </div>
              {showGatewayIP && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{gateway.address}</div>
              )}
            </div>
          </div>
          <div className="text-right text-xs">
            {showLatency && (
              <div className={`${
                gateway.delay > 100 ? 'text-red-600 dark:text-red-400' :
                gateway.delay > 50 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-gray-600 dark:text-gray-300'
              }`}>
                {formatLatency(gateway.delay)}
              </div>
            )}
            {showLoss && gateway.loss > 0 && (
              <div className="text-red-600 dark:text-red-400">{gateway.loss.toFixed(1)}% loss</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderStatusView = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data?.stats.online || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Online</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {data?.stats.offline || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Offline</div>
        </div>
      </div>

      <div className="space-y-2">
        {data?.gateways.map(gateway => (
          <div key={gateway.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(gateway.status)}`} />
              <span className="text-sm text-gray-900 dark:text-white">{gateway.name}</span>
            </div>
            <span className={`text-xs ${getStatusBadge(gateway.status)} px-2 py-0.5 rounded`}>
              {gateway.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (!data?.gateways?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <p className="text-sm">No gateways found</p>
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
                Gateways
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data.stats.online}/{data.stats.total} online
              </span>
            </div>
          )}
          {visualizationType === 'list' ? renderListView() :
           visualizationType === 'status' ? renderStatusView() : renderCardsView()}
        </div>
      )}
    </BaseWidget>
  );
}
