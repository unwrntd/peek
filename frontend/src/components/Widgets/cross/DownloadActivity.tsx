import React from 'react';
import { useCrossIntegrationData } from '../../../hooks/useCrossIntegrationData';
import { BaseWidget } from '../BaseWidget';

interface DownloadActivityProps {
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DownloadActivityData {
  downloading: {
    active: number;
    speed: number;
    speedUnit: string;
    sources: {
      name: string;
      type: 'sabnzbd' | 'qbittorrent';
      active: number;
      speed: number;
    }[];
  };
  streaming: {
    active: number;
    bandwidth: number;
    bandwidthUnit: string;
  };
  networkContention: boolean;
  contentionWarning: string | null;
}

export function DownloadActivity({ config, widgetId }: DownloadActivityProps) {
  const { data, loading, error, missingIntegrations } = useCrossIntegrationData<DownloadActivityData>({
    endpoint: 'download-activity',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  // Config options
  const showDownloadSpeed = config.showDownloadSpeed !== false;
  const showStreamingBandwidth = config.showStreamingBandwidth !== false;
  const showContentionWarning = config.showContentionWarning !== false;
  const showSources = config.showSources !== false;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="h-full flex flex-col">
          {/* Main comparison */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            {/* Downloads side */}
            <div className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-blue-500 dark:text-blue-400 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.downloading.active}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Active Downloads
              </div>
              {showDownloadSpeed && (
                <div className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                  {data.downloading.speed} {data.downloading.speedUnit}
                </div>
              )}
            </div>

            {/* Streaming side */}
            <div className="flex flex-col items-center justify-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-green-500 dark:text-green-400 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.streaming.active}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Active Streams
              </div>
              {showStreamingBandwidth && (
                <div className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">
                  {data.streaming.bandwidth} {data.streaming.bandwidthUnit}
                </div>
              )}
            </div>
          </div>

          {/* Download sources breakdown */}
          {showSources && data.downloading.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4 text-xs">
                {data.downloading.sources.map((source, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      source.type === 'sabnzbd' ? 'bg-orange-500' : 'bg-blue-500'
                    }`} />
                    <span className="text-gray-600 dark:text-gray-400">
                      {source.name}: {source.active} @ {source.speed} MB/s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contention warning */}
          {showContentionWarning && data.networkContention && data.contentionWarning && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{data.contentionWarning}</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.downloading.active === 0 && data.streaming.active === 0 && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              No active downloads or streams
            </div>
          )}

          {/* Missing integrations */}
          {missingIntegrations.length === 3 && (
            <div className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
              Add SABnzbd, qBittorrent, or Tautulli to see activity
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
