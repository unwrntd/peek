import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Bucket {
  name: string;
  creationDate: string;
  objectCount: number;
  totalSize: number;
}

interface StorageData {
  buckets: Bucket[];
  totalStorage: number;
  totalObjects: number;
  stats: {
    bucketCount: number;
    totalSize: number;
    totalObjects: number;
  };
}

interface StorageWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

export function Storage({ integrationId, config, widgetId }: StorageWidgetProps) {
  const { data, loading, error } = useWidgetData<StorageData>({
    integrationId,
    metric: 'storage',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <p className="text-sm">Loading storage...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'stats') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-3xl font-bold text-green-400 mb-1">{formatBytes(data.stats.totalSize)}</div>
          <div className="text-xs text-gray-500 mb-4">Total Storage</div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <div className="text-center p-2 bg-gray-800 rounded-lg">
              <div className="text-xl font-semibold text-white">{data.stats.bucketCount}</div>
              <div className="text-xs text-gray-500">Buckets</div>
            </div>
            <div className="text-center p-2 bg-gray-800 rounded-lg">
              <div className="text-xl font-semibold text-white">{data.stats.totalObjects.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Objects</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="text-xs text-gray-500 mb-2 px-1">
            {data.stats.bucketCount} buckets · {formatBytes(data.stats.totalSize)}
          </div>
          <div className="space-y-1">
            {data.buckets.map((bucket) => (
              <div key={bucket.name} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span className="text-sm text-white truncate">{bucket.name}</span>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">
                  {formatBytes(bucket.totalSize)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default cards view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs text-gray-500">{data.stats.bucketCount} buckets</span>
          <span className="text-xs text-green-400">{formatBytes(data.stats.totalSize)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.buckets.map((bucket) => (
            <div key={bucket.name} className="p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span className="text-sm text-white truncate">{bucket.name}</span>
              </div>
              <div className="text-xs text-gray-400">{formatBytes(bucket.totalSize)}</div>
              <div className="text-xs text-gray-500">{bucket.objectCount.toLocaleString()} objects</div>
            </div>
          ))}
          {data.buckets.length === 0 && (
            <div className="col-span-2 text-center text-gray-500 py-4">
              <p className="text-sm">No buckets found</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
