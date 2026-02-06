import React, { useState, useEffect, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface CameraSnapshotProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ProtectCamera {
  id: string;
  name: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
}

interface CameraData {
  cameras: ProtectCamera[];
}

export function CameraSnapshot({ integrationId, config, widgetId }: CameraSnapshotProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const { data, loading, error } = useWidgetData<CameraData>({
    integrationId,
    metric: 'cameras',
    refreshInterval: 300000, // Refresh camera list every 5 minutes
    widgetId,
  });

  const cameraId = config.cameraId as string;
  // snapshotRefreshInterval is in seconds from config, convert to milliseconds
  const configRefreshSeconds = (config.snapshotRefreshInterval as number) || 30;
  const refreshInterval = configRefreshSeconds * 1000; // Convert to milliseconds
  const showCameraName = config.showCameraName !== false;
  const showTimestamp = config.showTimestamp !== false;
  const objectFit = (config.objectFit as string) || 'contain';

  // Find selected camera
  const selectedCamera = data?.cameras.find(c => c.id === cameraId);
  const isOffline = selectedCamera?.state !== 'CONNECTED';

  // Build snapshot URL
  const getSnapshotUrl = useCallback(() => {
    if (!cameraId || !integrationId) return null;
    // Add timestamp to force refresh
    return `/api/integrations/${integrationId}/snapshot/${cameraId}?w=1280&h=720&t=${Date.now()}`;
  }, [integrationId, cameraId]);

  // Refresh snapshot
  const refreshSnapshot = useCallback(() => {
    if (isOffline) {
      setImageError('Camera is offline');
      setImageUrl(null);
      return;
    }

    const url = getSnapshotUrl();
    if (url) {
      setImageUrl(url);
      setImageError(null);
      setLastRefresh(Date.now());
    }
  }, [getSnapshotUrl, isOffline]);

  // Initial load and interval refresh
  useEffect(() => {
    refreshSnapshot();

    const interval = setInterval(refreshSnapshot, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshSnapshot, refreshInterval]);

  // Handle image load error
  const handleImageError = () => {
    setImageError('Failed to load snapshot');
  };

  // Format last refresh time
  const formatRefreshTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // No camera selected
  if (!cameraId) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <p>Select a camera in widget settings</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading && !imageUrl} error={error}>
      <div className="flex flex-col h-full">
        {/* Camera name header */}
        {showCameraName && selectedCamera && (
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {selectedCamera.name}
            </span>
            {isOffline && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                Offline
              </span>
            )}
          </div>
        )}

        {/* Snapshot image */}
        <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden min-h-0">
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">{imageError}</p>
              </div>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={selectedCamera?.name || 'Camera snapshot'}
              className="w-full h-full"
              style={{ objectFit: objectFit as 'contain' | 'cover' | 'fill' }}
              onError={handleImageError}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-pulse text-gray-400">Loading...</div>
            </div>
          )}

          {/* Manual refresh button */}
          <button
            onClick={refreshSnapshot}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            title="Refresh snapshot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Timestamp footer */}
        {showTimestamp && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
            Last updated: {formatRefreshTime(lastRefresh)}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
