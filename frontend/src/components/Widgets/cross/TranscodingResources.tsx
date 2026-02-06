import React from 'react';
import { useCrossIntegrationData } from '../../../hooks/useCrossIntegrationData';
import { BaseWidget } from '../BaseWidget';

interface TranscodingResourcesProps {
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TranscodingResourcesData {
  transcoding: {
    active: number;
    hwAccelerated: number;
    directPlay: number;
    directStream: number;
    source: string | null;
  };
  resources: {
    cpu: number;
    memory: number;
    source: string | null;
    serverName: string | null;
  };
  correlation: {
    cpuPerTranscode: number;
    isResourceBound: boolean;
  };
}

function getCpuColor(cpu: number): string {
  if (cpu < 50) return 'text-green-500';
  if (cpu < 80) return 'text-yellow-500';
  return 'text-red-500';
}

function getCpuBgColor(cpu: number): string {
  if (cpu < 50) return 'bg-green-500';
  if (cpu < 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function TranscodingResources({ config, widgetId }: TranscodingResourcesProps) {
  const { data, loading, error, missingIntegrations } = useCrossIntegrationData<TranscodingResourcesData>({
    endpoint: 'transcoding-resources',
    refreshInterval: (config.refreshInterval as number) || 15000,
    widgetId,
  });

  // Config options
  const showTranscodeCount = config.showTranscodeCount !== false;
  const showCpuUsage = config.showCpuUsage !== false;
  const showMemoryUsage = config.showMemoryUsage !== false;
  const showCorrelation = config.showCorrelation !== false;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="h-full flex flex-col space-y-4">
          {/* Main metrics */}
          <div className="grid grid-cols-2 gap-4">
            {/* Transcoding section */}
            {showTranscodeCount && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Transcoding Activity
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {data.transcoding.active}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  active transcodes
                </div>

                {/* Breakdown */}
                <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                  <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded">
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">
                      {data.transcoding.directPlay}
                    </div>
                    <div className="text-[10px] text-gray-500">Direct</div>
                  </div>
                  <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {data.transcoding.directStream}
                    </div>
                    <div className="text-[10px] text-gray-500">Stream</div>
                  </div>
                  <div className="p-1 bg-orange-100 dark:bg-orange-900/30 rounded">
                    <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                      {data.transcoding.hwAccelerated}
                    </div>
                    <div className="text-[10px] text-gray-500">HW Accel</div>
                  </div>
                </div>

                {data.transcoding.source && (
                  <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                    via {data.transcoding.source}
                  </div>
                )}
              </div>
            )}

            {/* Resources section */}
            {(showCpuUsage || showMemoryUsage) && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Server Resources
                  {data.resources.serverName && (
                    <span className="ml-1 text-gray-400">({data.resources.serverName})</span>
                  )}
                </div>

                {/* CPU gauge */}
                {showCpuUsage && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">CPU</span>
                      <span className={`text-sm font-bold ${getCpuColor(data.resources.cpu)}`}>
                        {data.resources.cpu}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getCpuBgColor(data.resources.cpu)} transition-all duration-300`}
                        style={{ width: `${data.resources.cpu}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Memory gauge */}
                {showMemoryUsage && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Memory</span>
                      <span className={`text-sm font-bold ${getCpuColor(data.resources.memory)}`}>
                        {data.resources.memory}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getCpuBgColor(data.resources.memory)} transition-all duration-300`}
                        style={{ width: `${data.resources.memory}%` }}
                      />
                    </div>
                  </div>
                )}

                {data.resources.source && (
                  <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                    via {data.resources.source}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Correlation insight */}
          {showCorrelation && data.transcoding.active > 0 && data.resources.cpu > 0 && (
            <div className={`p-3 rounded-lg ${
              data.correlation.isResourceBound
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : 'bg-gray-50 dark:bg-gray-700/50'
            }`}>
              <div className="flex items-center gap-2">
                {data.correlation.isResourceBound ? (
                  <>
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      <span className="font-medium">Resource Constrained:</span> Server CPU at {data.resources.cpu}% with {data.transcoding.active} transcodes
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      ~{data.correlation.cpuPerTranscode}% CPU per transcode
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* No transcoding */}
          {data.transcoding.active === 0 && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <div className="text-2xl mb-1">✓</div>
                No active transcoding
              </div>
            </div>
          )}

          {/* Missing integrations */}
          {missingIntegrations.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {missingIntegrations.includes('tautulli') && 'Tautulli required for transcoding data. '}
              {(missingIntegrations.includes('proxmox') && missingIntegrations.includes('beszel')) && 'Add Proxmox or Beszel for resource metrics.'}
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
