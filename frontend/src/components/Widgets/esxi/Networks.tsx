import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Network {
  id: string;
  name: string;
  type: string;
}

interface NetworksData {
  networks: Network[];
  summary: {
    count: number;
    byType: Record<string, number>;
  };
}

interface NetworksWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getNetworkIcon(type: string): React.ReactNode {
  return (
    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

export function Networks({ integrationId, config, widgetId }: NetworksWidgetProps) {
  const { data, loading, error } = useWidgetData<NetworksData>({
    integrationId,
    metric: 'networks',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <p className="text-sm">Loading networks...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="text-xs text-gray-500 mb-2 px-1">{data.summary.count} Networks</div>
          <div className="space-y-0.5">
            {data.networks.map((net) => (
              <div key={net.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800">
                {getNetworkIcon(net.type)}
                <span className="text-xs text-gray-300 truncate flex-1">{net.name}</span>
                <span className="text-xs text-gray-500">{net.type}</span>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <span className="text-gray-500">{data.summary.count} networks</span>
          <span className="text-gray-400">
            {Object.entries(data.summary.byType).map(([type, count]) => `${count} ${type}`).join(' · ')}
          </span>
        </div>
        <div className="space-y-1">
          {data.networks.map((net) => (
            <div key={net.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
              {getNetworkIcon(net.type)}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{net.name}</div>
              </div>
              <span className="text-xs px-2 py-0.5 bg-cyan-900/30 text-cyan-400 rounded">
                {net.type}
              </span>
            </div>
          ))}
          {data.networks.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No networks found</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
