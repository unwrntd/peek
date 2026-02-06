import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface StreamerStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface PiKVMStreamer {
  enabled: boolean;
  features: {
    quality: boolean;
    resolution: boolean;
  };
  params: {
    quality: number;
    desired_fps: number;
  };
  source: {
    online: boolean;
    resolution: { width: number; height: number };
    captured_fps: number;
  };
  stream: {
    queued_fps: number;
    clients: number;
    clients_stat: Record<string, unknown>;
  };
}

interface StreamerData {
  streamer: PiKVMStreamer;
}

export function StreamerStatus({ integrationId, config, widgetId }: StreamerStatusProps) {
  const { data, loading, error } = useWidgetData<StreamerData>({
    integrationId,
    metric: 'streamer',
    refreshInterval: (config.refreshInterval as number) || 5000,
    widgetId,
  });

  const showOnline = config.showOnline !== false;
  const showResolution = config.showResolution !== false;
  const showFps = config.showFps !== false;
  const showClients = config.showClients !== false;
  const hideLabels = config.hideLabels === true;

  const streamer = data?.streamer;

  if (!streamer?.enabled) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          Streamer is not enabled
        </div>
      </BaseWidget>
    );
  }

  const online = streamer.source?.online;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full justify-center">
        {/* Main status */}
        {showOnline && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className={`w-3 h-3 rounded-full ${
                online
                  ? 'bg-green-500 shadow-sm shadow-green-500/50'
                  : 'bg-red-500 shadow-sm shadow-red-500/50'
              }`}
            />
            <span
              className={`text-lg font-semibold ${
                online
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {online ? 'Online' : 'No Signal'}
            </span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {showResolution && online && streamer.source?.resolution && (
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {streamer.source.resolution.width}x{streamer.source.resolution.height}
              </div>
              {!hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Resolution</div>
              )}
            </div>
          )}

          {showFps && online && (
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.round(streamer.source.captured_fps || 0)}
              </div>
              {!hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400">FPS</div>
              )}
            </div>
          )}

          {showClients && (
            <div className={`text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded ${!showResolution && !showFps ? 'col-span-2' : ''}`}>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {streamer.stream?.clients || 0}
              </div>
              {!hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {streamer.stream?.clients === 1 ? 'Viewer' : 'Viewers'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quality indicator */}
        {!hideLabels && streamer.features?.quality && streamer.params && (
          <div className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
            Quality: {streamer.params.quality}%
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
