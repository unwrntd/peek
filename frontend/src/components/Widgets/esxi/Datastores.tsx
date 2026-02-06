import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { formatBytes } from '../../../utils/formatting';

interface Datastore {
  id: string;
  name: string;
  type: string;
  capacity: number;
  freeSpace: number;
  usedSpace: number;
  usedPercent: number;
}

interface DatastoresData {
  datastores: Datastore[];
  summary: {
    count: number;
    totalCapacity: number;
    totalFree: number;
    totalUsed: number;
    usedPercent: number;
  };
}

interface DatastoresWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getUsageColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function Datastores({ integrationId, config, widgetId }: DatastoresWidgetProps) {
  const { data, loading, error } = useWidgetData<DatastoresData>({
    integrationId,
    metric: 'datastores',
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <p className="text-sm">Loading datastores...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'summary') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-xs text-gray-500 mb-1">{data.summary.count} Datastores</div>
          <div className="text-3xl font-bold text-white mb-2">{data.summary.usedPercent}%</div>
          <div className="w-full max-w-[150px] bg-gray-700 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full ${getUsageColor(data.summary.usedPercent)}`}
              style={{ width: `${data.summary.usedPercent}%` }}
            />
          </div>
          <div className="text-xs text-gray-400">
            {formatBytes(data.summary.totalUsed)} / {formatBytes(data.summary.totalCapacity)}
          </div>
          <div className="text-xs text-gray-500">
            {formatBytes(data.summary.totalFree)} free
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'bars') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-gray-500">{data.summary.count} datastores</span>
            <span className="text-gray-400">{formatBytes(data.summary.totalFree)} free</span>
          </div>
          <div className="space-y-2">
            {data.datastores.map((ds) => (
              <div key={ds.id} className="p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white truncate">{ds.name}</span>
                  <span className="text-xs text-gray-400">{ds.usedPercent}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getUsageColor(ds.usedPercent)}`}
                    style={{ width: `${ds.usedPercent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatBytes(ds.usedSpace)} / {formatBytes(ds.capacity)}
                </div>
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
          <span className="text-gray-500">{data.summary.count} datastores</span>
          <span className="text-gray-400">{data.summary.usedPercent}% used</span>
        </div>
        <div className="space-y-1">
          {data.datastores.map((ds) => (
            <div key={ds.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{ds.name}</div>
                <div className="text-xs text-gray-500">{ds.type}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-sm font-medium ${
                  ds.usedPercent >= 90 ? 'text-red-400' :
                  ds.usedPercent >= 75 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {ds.usedPercent}%
                </div>
                <div className="text-xs text-gray-500">{formatBytes(ds.freeSpace)} free</div>
              </div>
            </div>
          ))}
          {data.datastores.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No datastores found</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
