import { useState, useEffect } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SnapshotProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SnapshotData {
  snapshot: string; // base64 data URL
}

export function Snapshot({ integrationId, config, widgetId }: SnapshotProps) {
  const autoRefresh = (config.autoRefresh as number) || 0;
  const clickToOpen = config.clickToOpen === true;

  const { data, loading, error, refetch } = useWidgetData<SnapshotData>({
    integrationId,
    metric: 'snapshot',
    refreshInterval: autoRefresh > 0 ? autoRefresh * 1000 : 30000,
    widgetId,
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (data?.snapshot) {
      setLastUpdate(new Date());
    }
  }, [data?.snapshot]);

  const handleClick = () => {
    if (clickToOpen && data?.snapshot) {
      setIsFullscreen(true);
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    refetch();
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {data?.snapshot ? (
        <div className="relative h-full flex flex-col">
          {/* Image container */}
          <div
            className={`flex-1 flex items-center justify-center overflow-hidden rounded ${
              clickToOpen ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
            }`}
            onClick={handleClick}
          >
            <img
              src={data.snapshot}
              alt="PiKVM Snapshot"
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Controls overlay */}
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={handleRefresh}
              className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded transition-colors"
              title="Refresh snapshot"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            {clickToOpen && (
              <button
                onClick={() => setIsFullscreen(true)}
                className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded transition-colors"
                title="Open fullscreen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Last update indicator */}
          {lastUpdate && (
            <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}

          {/* Auto-refresh indicator */}
          {autoRefresh > 0 && (
            <div className="absolute bottom-2 right-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
              Auto: {autoRefresh}s
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No snapshot available
        </div>
      )}

      {/* Fullscreen modal */}
      {isFullscreen && data?.snapshot && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={data.snapshot}
            alt="PiKVM Snapshot Fullscreen"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </BaseWidget>
  );
}
