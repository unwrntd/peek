import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';

interface ApStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface UnifiDevice {
  _id: string;
  mac: string;
  name: string;
  model: string;
  type: string;
  state: number;
  uptime: number;
  num_sta?: number;
}

interface DevicesData {
  devices: UnifiDevice[];
}

// Map UniFi AP model codes to display-friendly names
const MODEL_NAMES: Record<string, string> = {
  'U6E': 'UniFi 6 Enterprise',
  'U6M': 'UniFi 6 Mesh',
  'U6P': 'UniFi 6 Pro',
  'U6L': 'UniFi 6 Lite',
  'U6LR': 'UniFi 6 Long-Range',
  'U6+': 'UniFi 6+',
  'UAP6': 'UniFi 6',
  'UAPAC': 'UniFi AC',
  'UAPM': 'UniFi AC Mesh',
  'UAPMINI': 'UniFi AC Mini',
  'UAPIW': 'UniFi In-Wall',
  'UAPIHD': 'UniFi AP In-Wall HD',
  'UAPNANOHD': 'UniFi nanoHD',
  'UAPFLEXHD': 'UniFi FlexHD',
  'UAPHD': 'UniFi AP HD',
  'UAPSHD': 'UniFi AP SHD',
  'UAPXG': 'UniFi AP XG',
  'UBB': 'UniFi Building Bridge',
  'UWB': 'UniFi WiFi BaseStation',
};

function getModelDisplayName(model: string): string {
  // Try exact match first
  if (MODEL_NAMES[model]) return MODEL_NAMES[model];

  // Try partial match
  for (const [key, name] of Object.entries(MODEL_NAMES)) {
    if (model.toUpperCase().includes(key)) return name;
  }

  return model;
}

// Get Ubiquiti product image URL
function getApImageUrl(model: string): string {
  // Ubiquiti's static assets URL pattern
  const baseUrl = 'https://static.ui.com/fingerprint/ui/images';

  // Map common models to their image IDs
  const imageIds: Record<string, string> = {
    'U6E': 'c6a51138-e7af-4a42-8c94-2c94e13b5b1c',
    'U6P': '4f817a57-dc2a-4d76-94fe-f2be5da83dd4',
    'U6L': 'f6a7d276-be61-4c34-b5ed-3dbde8c1d7db',
    'U6LR': 'dbe44a3a-8c07-4c47-8a83-1cbc0a36fdd3',
    'U6+': '8d3e8b85-0f3c-49c1-b9eb-b53a2deaa7a5',
    'UAPNANOHD': 'c5e5c23a-5d2c-4531-aa4a-c55a00a63a34',
    'UAPFLEXHD': 'e3e91a25-af03-4f91-ae0c-92f1b1d90c30',
    'UAPHD': 'a5e5db81-8e8c-4f85-9ef0-6fd16e0f4b6e',
  };

  // Try to find image ID
  for (const [key, id] of Object.entries(imageIds)) {
    if (model.toUpperCase().includes(key)) {
      return `${baseUrl}/${id}/220x220.png`;
    }
  }

  // Return null to use fallback icon
  return '';
}

export function ApStatus({ integrationId, config, widgetId }: ApStatusProps) {
  const { data, loading, error } = useWidgetData<DevicesData>({
    integrationId,
    metric: 'devices',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const dimensions = useWidgetDimensions();

  // Configuration options
  const deviceId = config.deviceId as string;
  const customImageUrl = config.customImageUrl as string | undefined;
  const showName = config.showName !== false;
  const showImage = config.showImage !== false;
  const showClients = config.showClients !== false;
  const showStatus = config.showStatus !== false;
  const showModel = config.showModel === true;
  const imageSize = (config.imageSize as string) || 'medium';
  const clientCountSize = (config.clientCountSize as string) || 'medium';

  // Calculate scale
  const getEffectiveScale = (): number => {
    if (!dimensions) return 1;
    const { contentScale, scaleFactors } = dimensions;
    if (contentScale === 'auto') {
      return scaleFactors.textScale;
    }
    return parseFloat(contentScale) || 1;
  };
  const scale = getEffectiveScale();

  // Image sizes
  const imageSizes: Record<string, number> = {
    small: 80,
    medium: 120,
    large: 160,
  };
  const imgSize = (imageSizes[imageSize] || 120) * scale;

  // Client count sizes (font size in px)
  const clientCountSizes: Record<string, { number: number; label: number; icon: number }> = {
    small: { number: 16, label: 12, icon: 16 },
    medium: { number: 24, label: 14, icon: 20 },
    large: { number: 36, label: 16, icon: 28 },
    'extra-large': { number: 48, label: 18, icon: 36 },
  };
  const clientSizes = clientCountSizes[clientCountSize] || clientCountSizes.medium;

  // Find the selected AP or first available AP
  const accessPoints = data?.devices?.filter(d => d.type === 'uap') || [];
  const selectedAp = deviceId
    ? accessPoints.find(ap => ap._id === deviceId || ap.mac === deviceId)
    : accessPoints[0];

  // No AP selected state
  if (!deviceId && accessPoints.length === 0 && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          <p className="text-sm">No access points found</p>
        </div>
      </BaseWidget>
    );
  }

  // AP not found
  if (deviceId && !selectedAp && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">Access point not found</p>
        </div>
      </BaseWidget>
    );
  }

  const isOnline = selectedAp?.state === 1;
  // Use custom image if provided, otherwise fall back to Ubiquiti CDN image
  const imageUrl = customImageUrl || (selectedAp ? getApImageUrl(selectedAp.model) : '');

  return (
    <BaseWidget loading={loading} error={error}>
      {selectedAp && (
        <div className="h-full relative flex flex-col items-center justify-center p-2">
          {/* AP Image */}
          {showImage && (
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: imgSize, height: imgSize }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={selectedAp.model}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    // Hide image on error, fallback icon will show
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <svg
                  className="text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ width: imgSize * 0.6, height: imgSize * 0.6 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              )}
            </div>
          )}

          {/* AP Name */}
          {showName && (
            <div
              className="text-center font-semibold text-gray-900 dark:text-white mt-2 truncate w-full px-2"
              style={{ fontSize: `${16 * scale}px` }}
            >
              {selectedAp.name || 'Unnamed AP'}
            </div>
          )}

          {/* Model Name */}
          {showModel && (
            <div
              className="text-center text-gray-500 dark:text-gray-400 truncate w-full px-2"
              style={{ fontSize: `${12 * scale}px` }}
            >
              {getModelDisplayName(selectedAp.model)}
            </div>
          )}

          {/* Client Count */}
          {showClients && (
            <div
              className="flex items-center gap-2 mt-3"
            >
              <svg
                className="text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ width: `${clientSizes.icon * scale}px`, height: `${clientSizes.icon * scale}px` }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <span
                className="text-gray-700 dark:text-gray-300 font-bold"
                style={{ fontSize: `${clientSizes.number * scale}px` }}
              >
                {selectedAp.num_sta ?? 0}
              </span>
              <span
                className="text-gray-500 dark:text-gray-400"
                style={{ fontSize: `${clientSizes.label * scale}px` }}
              >
                {(selectedAp.num_sta ?? 0) === 1 ? 'client' : 'clients'}
              </span>
            </div>
          )}

          {/* Status indicator - positioned in content area */}
          {showStatus && (
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-3 ${
                isOnline
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}
              style={{ fontSize: `${12 * scale}px` }}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
