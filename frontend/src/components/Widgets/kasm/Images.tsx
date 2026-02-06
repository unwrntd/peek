import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface KasmImage {
  image_id: string;
  friendly_name: string;
  image_src: string;
  cores: number;
  memory: number;
  enabled: boolean;
  description: string;
}

interface ImagesData {
  images: KasmImage[];
}

interface ImagesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function ImageIcon({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

export function Images({ integrationId, config, widgetId }: ImagesWidgetProps) {
  const { data, loading, error } = useWidgetData<ImagesData>({
    integrationId,
    metric: 'images',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const images = data?.images || [];
  const search = (config.search as string) || '';
  const showDisabled = config.showDisabled !== false;
  const showResources = config.showResources !== false;

  const filteredImages = useMemo(() => {
    let result = images;

    if (!showDisabled) {
      result = result.filter(i => i.enabled);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(i =>
        i.friendly_name?.toLowerCase().includes(searchLower) ||
        i.image_src?.toLowerCase().includes(searchLower) ||
        i.description?.toLowerCase().includes(searchLower)
      );
    }

    return result.sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
  }, [images, search, showDisabled]);

  const enabledCount = images.filter(i => i.enabled).length;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary header */}
        <div className="px-3 py-2 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {images.length} images
            </span>
            <span className="text-xs text-green-400">
              {enabledCount} enabled
            </span>
          </div>
        </div>

        {/* Images list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-800/30">
            {filteredImages.map((image) => (
              <div
                key={image.image_id}
                className={`px-3 py-3 hover:bg-gray-800/20 ${!image.enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <ImageIcon enabled={image.enabled} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {image.friendly_name}
                      </span>
                      {!image.enabled && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    {image.description && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {image.description}
                      </div>
                    )}
                    {showResources && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                          {image.cores} cores
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                          {image.memory} MB
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-gray-600 mt-1 truncate">
                      {image.image_src}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredImages.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                {search ? 'No images match your search' : 'No images found'}
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
