import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProwlarrIndexer } from '../../../types';

interface IndexerData {
  indexers: ProwlarrIndexer[];
  totalCount: number;
  enabledCount: number;
}

interface IndexerListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function IndexerList({ integrationId, config, widgetId }: IndexerListProps) {
  const { data, loading, error } = useWidgetData<IndexerData>({
    integrationId,
    metric: 'indexers',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const protocolFilter = config.protocolFilter as string || '';
  const privacyFilter = config.privacyFilter as string || '';
  const statusFilter = config.statusFilter as string || '';
  const compactView = config.compactView as boolean || false;

  const indexers = data?.indexers || [];

  // Apply filters
  const filteredIndexers = indexers.filter(indexer => {
    if (protocolFilter && indexer.protocol !== protocolFilter) return false;
    if (privacyFilter && indexer.privacy !== privacyFilter) return false;
    if (statusFilter === 'enabled' && !indexer.enable) return false;
    if (statusFilter === 'disabled' && indexer.enable) return false;
    return true;
  });

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No indexer data available
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {!hideLabels && (
            <div className="text-xs text-gray-500 mb-2">{data.enabledCount}/{data.totalCount} enabled</div>
          )}
          {filteredIndexers.map(indexer => (
            <div key={indexer.id} className={`flex items-center gap-2 text-sm ${!indexer.enable ? 'opacity-50' : ''}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                indexer.protocol === 'torrent' ? 'bg-blue-500' : 'bg-purple-500'
              }`} />
              <span className="flex-1 truncate text-gray-200">{indexer.name}</span>
              <span className={`w-2 h-2 rounded-full ${indexer.enable ? 'bg-green-500' : 'bg-gray-400'}`} />
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-2">
          {!hideLabels && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {data.enabledCount} of {data.totalCount} enabled
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-72">
            {filteredIndexers.map(indexer => (
              <div
                key={indexer.id}
                className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 ${
                  !indexer.enable ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded-full ${
                    indexer.protocol === 'torrent' ? 'bg-blue-500' : 'bg-purple-500'
                  }`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{indexer.name}</span>
                </div>
                {!hideLabels && (
                  <div className="text-xs text-gray-500">
                    {indexer.protocol} • {indexer.privacy}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-3">
        {/* Summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            {data.enabledCount} of {data.totalCount} enabled
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" />
              </svg>
              {indexers.filter(i => i.protocol === 'torrent').length} Torrent
            </span>
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" />
              </svg>
              {indexers.filter(i => i.protocol === 'usenet').length} Usenet
            </span>
          </div>
        </div>

        {/* Indexer List */}
        <div className={`space-y-2 ${compactView ? 'max-h-64' : 'max-h-96'} overflow-y-auto`}>
          {filteredIndexers.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No indexers match the current filters
            </div>
          ) : (
            filteredIndexers.map(indexer => (
              <div
                key={indexer.id}
                className={`flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 ${
                  !indexer.enable ? 'opacity-50' : ''
                }`}
              >
                {/* Protocol Icon */}
                <div className={`p-1.5 rounded ${
                  indexer.protocol === 'torrent'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {indexer.protocol === 'torrent' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    )}
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {indexer.name}
                    </span>
                    {!compactView && (
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        indexer.privacy === 'private'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                          : indexer.privacy === 'semiPrivate'
                          ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
                          : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                      }`}>
                        {indexer.privacy === 'semiPrivate' ? 'Semi' : indexer.privacy}
                      </span>
                    )}
                  </div>
                  {!compactView && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Priority: {indexer.priority}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className={`w-2 h-2 rounded-full ${
                  indexer.enable
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`} />
              </div>
            ))
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
