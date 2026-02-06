import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { formatBytes } from '../../../utils/formatting';

interface SystemOverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DockerSystemInfo {
  dockerVersion: string;
  apiVersion: string;
  osType: string;
  architecture: string;
  kernelVersion: string;
  operatingSystem: string;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  cpus: number;
  memoryTotal: number;
  storageDriver: string;
  serverVersion: string;
}

interface SystemData {
  system: DockerSystemInfo;
}

export function SystemOverview({ integrationId, config, widgetId }: SystemOverviewProps) {
  const { data, loading, error } = useWidgetData<SystemData>({
    integrationId,
    metric: 'system',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showVersion = config.showVersion !== false;
  const showContainerCount = config.showContainerCount !== false;
  const showImageCount = config.showImageCount !== false;
  const showResources = config.showResources !== false;
  const showStorageDriver = config.showStorageDriver !== false;
  const compactView = (config.compactView as boolean) || false;
  const visualizationType = (config.visualization as string) || 'cards';

  const system = data?.system;

  const renderCardsView = () => (
    <div className={`grid ${compactView ? 'grid-cols-2 gap-2' : 'grid-cols-2 sm:grid-cols-3 gap-3'}`}>
      {showContainerCount && (
        <div className={`${compactView ? 'p-2' : 'p-3'} bg-blue-50 dark:bg-blue-900/20 rounded-lg`}>
          <div className={`${compactView ? 'text-xl' : 'text-2xl'} font-bold text-blue-600 dark:text-blue-400`}>
            {system?.containersRunning || 0}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              /{system?.containers || 0}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Containers</div>
        </div>
      )}

      {showImageCount && (
        <div className={`${compactView ? 'p-2' : 'p-3'} bg-purple-50 dark:bg-purple-900/20 rounded-lg`}>
          <div className={`${compactView ? 'text-xl' : 'text-2xl'} font-bold text-purple-600 dark:text-purple-400`}>
            {system?.images || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Images</div>
        </div>
      )}

      {showResources && (
        <>
          <div className={`${compactView ? 'p-2' : 'p-3'} bg-green-50 dark:bg-green-900/20 rounded-lg`}>
            <div className={`${compactView ? 'text-xl' : 'text-2xl'} font-bold text-green-600 dark:text-green-400`}>
              {system?.cpus || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">CPUs</div>
          </div>
          <div className={`${compactView ? 'p-2' : 'p-3'} bg-orange-50 dark:bg-orange-900/20 rounded-lg`}>
            <div className={`${compactView ? 'text-xl' : 'text-2xl'} font-bold text-orange-600 dark:text-orange-400`}>
              {formatBytes(system?.memoryTotal || 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Memory</div>
          </div>
        </>
      )}
    </div>
  );

  const renderCompactView = () => (
    <div className="space-y-2">
      {showVersion && (
        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">Docker</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">v{system?.dockerVersion}</span>
        </div>
      )}
      {showContainerCount && (
        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">Containers</span>
          <span className="text-sm text-gray-900 dark:text-white">
            <span className="text-green-500">{system?.containersRunning}</span>
            <span className="text-gray-400"> / </span>
            <span>{system?.containers}</span>
          </span>
        </div>
      )}
      {showImageCount && (
        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">Images</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{system?.images}</span>
        </div>
      )}
      {showResources && (
        <>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">CPUs</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{system?.cpus}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Memory</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{formatBytes(system?.memoryTotal || 0)}</span>
          </div>
        </>
      )}
      {showStorageDriver && (
        <div className="flex justify-between items-center py-1.5">
          <span className="text-sm text-gray-500 dark:text-gray-400">Storage Driver</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{system?.storageDriver}</span>
        </div>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && system && (
        <div className="space-y-4">
          {showVersion && visualizationType === 'cards' && (
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  Docker {system.dockerVersion}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {system.operatingSystem} ({system.architecture})
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm text-gray-600 dark:text-gray-300">Connected</span>
              </div>
            </div>
          )}

          {visualizationType === 'compact' ? renderCompactView() : renderCardsView()}
        </div>
      )}
    </BaseWidget>
  );
}
