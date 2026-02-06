import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface MsdStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface PiKVMMsd {
  enabled: boolean;
  online: boolean;
  busy: boolean;
  drive: {
    image: { name: string; size: number } | null;
    connected: boolean;
    cdrom: boolean;
  };
  storage: {
    size: number;
    free: number;
    images: { name: string; size: number; complete: boolean }[];
  };
}

interface MsdData {
  msd: PiKVMMsd;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function MsdStatus({ integrationId, config, widgetId }: MsdStatusProps) {
  const { data, loading, error } = useWidgetData<MsdData>({
    integrationId,
    metric: 'msd',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const showConnection = config.showConnection !== false;
  const showImage = config.showImage !== false;
  const showStorage = config.showStorage !== false;
  const showImageList = config.showImageList !== false;
  const hideLabels = config.hideLabels === true;
  const compactView = config.compactView === true;

  const msd = data?.msd;

  if (!msd?.enabled) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          MSD is not enabled
        </div>
      </BaseWidget>
    );
  }

  const storageSize = msd.storage?.size || 0;
  const storageFree = msd.storage?.free || 0;
  const usedStorage = storageSize - storageFree;
  const usagePercent = storageSize > 0 ? (usedStorage / storageSize) * 100 : 0;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className={`space-y-${compactView ? '2' : '3'}`}>
        {/* Connection status */}
        {showConnection && msd.drive && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  msd.drive.connected
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
              {!hideLabels && (
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {msd.drive.connected ? 'Connected' : 'Disconnected'}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {msd.drive.cdrom ? 'CD-ROM' : 'Flash'}
            </span>
          </div>
        )}

        {/* Current image */}
        {showImage && msd.drive && (
          <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
            {!hideLabels && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Current Image
              </div>
            )}
            {msd.drive.image ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {msd.drive.image.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  {formatBytes(msd.drive.image.size)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                No image loaded
              </span>
            )}
          </div>
        )}

        {/* Storage usage */}
        {showStorage && msd.storage && (
          <div>
            {!hideLabels && (
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Storage</span>
                <span>
                  {formatBytes(usedStorage)} / {formatBytes(storageSize)}
                </span>
              </div>
            )}
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  usagePercent > 90
                    ? 'bg-red-500'
                    : usagePercent > 70
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Image list */}
        {showImageList && msd.storage.images && msd.storage.images.length > 0 && (
          <div>
            {!hideLabels && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Available Images ({msd.storage.images.length})
              </div>
            )}
            <div className={`space-y-1 ${compactView ? 'max-h-20' : 'max-h-32'} overflow-y-auto`}>
              {msd.storage.images.map((image, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs p-1 rounded bg-gray-50 dark:bg-gray-700/30"
                >
                  <span className={`truncate ${!image.complete ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {image.name}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    {formatBytes(image.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Busy indicator */}
        {msd.busy && (
          <div className="text-xs text-center text-amber-600 dark:text-amber-400">
            MSD is busy...
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
