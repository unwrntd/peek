import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { RingSnapshot } from '../../../types';

interface SnapshotData {
  snapshots: RingSnapshot[];
  total: number;
  available: number;
}

interface SnapshotProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleString();
}

export function Snapshot({ integrationId, config, widgetId }: SnapshotProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, loading, error, refetch } = useWidgetData<SnapshotData>({
    integrationId,
    metric: 'snapshot',
    refreshInterval: (config.refreshInterval as number) || 300000, // 5 min default for battery cameras
    widgetId,
  });

  const showTimestamp = config.showTimestamp !== false;
  const showDeviceName = config.showDeviceName !== false;
  const deviceId = config.deviceId as number | undefined;

  // Find the snapshot for the selected device, or use the first one
  const snapshot = data?.snapshots?.find(s => deviceId ? s.deviceId === deviceId : true) || null;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      // Add small delay so user sees the refresh animation
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [refetch]);

  if (!snapshot) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>No snapshot available</span>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-[200px]">
            {deviceId ? 'Waiting for snapshot...' : 'Select a camera in widget settings'}
          </p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        {/* Header with device name and refresh */}
        <div className="flex items-center justify-between mb-2">
          {showDeviceName && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
              {snapshot.deviceName}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh snapshot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Snapshot image */}
        <div className="flex-1 relative rounded-lg overflow-hidden bg-gray-900 min-h-[120px]">
          <img
            src={`data:image/jpeg;base64,${snapshot.imageBase64}`}
            alt={`Snapshot from ${snapshot.deviceName}`}
            className="w-full h-full object-contain"
          />

          {/* Timestamp overlay */}
          {showTimestamp && snapshot.timestamp && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
              {formatTimestamp(snapshot.timestamp)}
            </div>
          )}
        </div>

      </div>
    </BaseWidget>
  );
}
