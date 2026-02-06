import React, { useState, useCallback, useEffect } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HomeConnectFridgeCamera } from '../../../types';

interface FridgeCameraData {
  fridges: HomeConnectFridgeCamera[];
}

interface FridgeCameraProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return '';
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

export function FridgeCamera({ integrationId, config, widgetId }: FridgeCameraProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const { data, loading, error, refetch } = useWidgetData<FridgeCameraData>({
    integrationId,
    metric: 'fridge-images',
    refreshInterval: (config.refreshInterval as number) || 600000, // 10 min default (rate limit consideration)
    widgetId,
  });

  const showApplianceName = config.showApplianceName !== false;
  const showTimestamp = config.showTimestamp !== false;
  const showImageCount = config.showImageCount === true;
  const selectedHaId = config.selectedHaId as string | undefined;

  // Find the selected fridge by haId, or use the first one with images
  const fridge = data?.fridges?.find(f => {
    if (selectedHaId) {
      return f.haId === selectedHaId;
    }
    return f.available;
  }) || data?.fridges?.find(f => f.available) || null;

  const currentImage = fridge?.images?.[currentImageIndex];

  // Fetch the actual image data when fridge/image changes
  useEffect(() => {
    if (!fridge || !currentImage) {
      setImageData(null);
      return;
    }

    const fetchImage = async () => {
      setImageLoading(true);
      setImageError(null);
      try {
        const response = await fetch(
          `/api/homeconnect-image/${integrationId}/${fridge.haId}/${currentImage.imageKey}`
        );
        if (!response.ok) {
          throw new Error('Failed to load image');
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageData(reader.result as string);
          setImageLoading(false);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Failed to load image');
        setImageLoading(false);
      }
    };

    fetchImage();
  }, [integrationId, fridge?.haId, currentImage?.imageKey]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      setCurrentImageIndex(0);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [refetch]);

  const handlePrevImage = useCallback(() => {
    if (fridge && fridge.images.length > 1) {
      setCurrentImageIndex(prev =>
        prev === 0 ? fridge.images.length - 1 : prev - 1
      );
    }
  }, [fridge]);

  const handleNextImage = useCallback(() => {
    if (fridge && fridge.images.length > 1) {
      setCurrentImageIndex(prev =>
        prev === fridge.images.length - 1 ? 0 : prev + 1
      );
    }
  }, [fridge]);

  // No fridge with camera available
  if (!fridge || !fridge.available) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium">No Fridge Camera</span>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-[200px]">
            {data?.fridges?.length === 0
              ? 'No refrigerators found'
              : 'Camera images not available for connected refrigerators'}
          </p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {showApplianceName && (
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {fridge.applianceName}
              </span>
            )}
            {showImageCount && fridge.images.length > 1 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {currentImageIndex + 1}/{fridge.images.length}
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh images"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Image container */}
        <div className="flex-1 relative rounded-lg overflow-hidden bg-gray-900 min-h-[120px]">
          {imageLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="animate-spin w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : imageError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
              <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs">{imageError}</span>
            </div>
          ) : imageData ? (
            <img
              src={imageData}
              alt={`Fridge camera from ${fridge.applianceName}`}
              className="w-full h-full object-contain"
            />
          ) : null}

          {/* Navigation arrows for multiple images */}
          {fridge.images.length > 1 && !imageLoading && imageData && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                title="Previous image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                title="Next image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Timestamp overlay */}
          {showTimestamp && currentImage?.timestamp && !imageLoading && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
              {formatTimestamp(currentImage.timestamp)}
            </div>
          )}
        </div>

        {/* Image dots indicator for multiple images */}
        {fridge.images.length > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {fridge.images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentImageIndex
                    ? 'bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
