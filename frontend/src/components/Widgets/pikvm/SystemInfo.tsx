import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SystemInfoProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface PiKVMInfo {
  hw: {
    health?: Record<string, unknown>;
    platform: {
      base: string;
      board?: { manufacturer?: string; product?: string };
      model: string;
      serial?: string;
      type: string;
      video?: { name?: string };
    };
  };
  system: {
    kvmd: { version: string };
    streamer?: { version: string };
  };
  meta: {
    server: { host: string };
  };
}

interface InfoData {
  info: PiKVMInfo;
}

export function SystemInfo({ integrationId, config, widgetId }: SystemInfoProps) {
  const { data, loading, error } = useWidgetData<InfoData>({
    integrationId,
    metric: 'info',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showHostname = config.showHostname !== false;
  const showPlatform = config.showPlatform !== false;
  const showVersion = config.showVersion !== false;
  const showStreamerVersion = config.showStreamerVersion !== false;
  const hideLabels = config.hideLabels === true;
  const compactView = config.compactView === true;

  const info = data?.info;

  // Safely get string values from hw.platform object
  const platform = info?.hw?.platform;
  const hwModel = typeof platform?.model === 'string' ? platform.model : '';
  const hwType = typeof platform?.type === 'string' ? platform.type : '';
  const hwBase = typeof platform?.base === 'string' ? platform.base : '';

  return (
    <BaseWidget loading={loading} error={error}>
      {info && (
        <div className={compactView ? 'space-y-1' : 'space-y-2'}>
          {showHostname && (
            <div className="flex justify-between items-center">
              {!hideLabels && (
                <span className="text-sm text-gray-500 dark:text-gray-400">Hostname</span>
              )}
              <span className={`font-medium text-gray-900 dark:text-white ${hideLabels ? 'text-lg' : ''}`}>
                {info.meta?.server?.host || 'Unknown'}
              </span>
            </div>
          )}
          {showPlatform && (
            <div className="flex justify-between items-center">
              {!hideLabels && (
                <span className="text-sm text-gray-500 dark:text-gray-400">Platform</span>
              )}
              <span className={`font-medium text-gray-900 dark:text-white ${hideLabels ? 'text-lg' : ''}`}>
                {hwModel || hwBase || 'Unknown'}
                {hwType && ` (${hwType})`}
              </span>
            </div>
          )}
          {showVersion && (
            <div className="flex justify-between items-center">
              {!hideLabels && (
                <span className="text-sm text-gray-500 dark:text-gray-400">KVMD Version</span>
              )}
              <span className={`font-medium text-blue-600 dark:text-blue-400 ${hideLabels ? 'text-lg' : ''}`}>
                v{info.system?.kvmd?.version || 'Unknown'}
              </span>
            </div>
          )}
          {showStreamerVersion && info.system?.streamer?.version && (
            <div className="flex justify-between items-center">
              {!hideLabels && (
                <span className="text-sm text-gray-500 dark:text-gray-400">Streamer</span>
              )}
              <span className={`font-medium text-gray-600 dark:text-gray-300 ${hideLabels ? 'text-lg' : ''}`}>
                v{info.system.streamer.version}
              </span>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
