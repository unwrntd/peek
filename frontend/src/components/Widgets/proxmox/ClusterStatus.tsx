import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProxmoxClusterStatus as ClusterStatusType } from '../../../types';
import { matchesFilter } from '../../../utils/filterUtils';

interface ClusterStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ClusterData {
  status: ClusterStatusType[];
}

function getStatusBadge(online: boolean | undefined): string {
  return online !== false
    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
}

// Donut chart component for quorum visualization
function DonutChart({ online, offline, quorate }: { online: number; offline: number; quorate: boolean }) {
  const total = online + offline;
  const onlinePercent = total > 0 ? (online / total) * 100 : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(onlinePercent / 100) * circumference} ${circumference}`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Online segment */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className={quorate ? 'text-green-500' : 'text-amber-500'}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${quorate ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {online}/{total}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">nodes</span>
        </div>
      </div>
      <div className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${
        quorate
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
      }`}>
        {quorate ? 'Quorate' : 'Not Quorate'}
      </div>
    </div>
  );
}

export function ClusterStatus({ integrationId, config, widgetId }: ClusterStatusProps) {
  const { data, loading, error } = useWidgetData<ClusterData>({
    integrationId,
    metric: (config.metric as string) || 'cluster-status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const visualization = (config.visualization as string) || 'cards';
  const showClusterInfo = config.showClusterInfo !== false;
  const showNodes = config.showNodes !== false;
  const showNodeDetails = config.showNodeDetails !== false;
  const compactView = config.compactView === true;

  // Separate cluster info from nodes
  const clusterInfo = data?.status.find(item => item.type === 'cluster');
  const nodes = data?.status.filter(item => item.type === 'node') || [];

  // Apply filters (supports wildcards and comma-separated lists)
  const filteredNodes = nodes.filter(node => {
    const nodeFilter = config.nodeFilter as string;
    if (nodeFilter && !matchesFilter(node.name, nodeFilter)) return false;

    const statusFilter = config.status as string;
    if (statusFilter === 'online' && node.online === false) return false;
    if (statusFilter === 'offline' && node.online !== false) return false;

    return true;
  });

  // Calculate online/offline counts
  const onlineCount = filteredNodes.filter(n => n.online !== false).length;
  const offlineCount = filteredNodes.filter(n => n.online === false).length;

  // Render donut visualization
  const renderDonut = () => (
    <div className="flex flex-col items-center justify-center h-full py-4">
      {clusterInfo && (
        <>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            {clusterInfo.name}
          </h4>
          <DonutChart
            online={onlineCount}
            offline={offlineCount}
            quorate={!!clusterInfo.quorate}
          />
          <div className="mt-4 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Online: {onlineCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Offline: {offlineCount}
            </span>
          </div>
        </>
      )}
    </div>
  );

  // Render list visualization (compact table)
  const renderList = () => (
    <div className="space-y-2">
      {showClusterInfo && clusterInfo && (
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
          <span className="font-medium text-gray-900 dark:text-white">{clusterInfo.name}</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
            clusterInfo.quorate
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            {clusterInfo.quorate ? 'Quorate' : 'Not Quorate'}
          </span>
        </div>
      )}
      {showNodes && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredNodes.map((node) => (
            <div
              key={node.id || node.name}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${node.online !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-900 dark:text-white">{node.name}</span>
                {node.local && (
                  <span className="px-1 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                    Local
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {node.ip && <span>{node.ip}</span>}
                <span className={node.online !== false ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {node.online !== false ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {filteredNodes.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-2 text-sm">
          {nodes.length === 0 ? 'No nodes found' : 'No nodes match filter'}
        </p>
      )}
    </div>
  );

  // Render cards visualization (default)
  const renderCards = () => (
    <div className={`space-y-${compactView ? '3' : '4'}`}>
      {/* Cluster Info */}
      {showClusterInfo && clusterInfo && (
        <div className={`${compactView ? 'p-3' : 'p-4'} bg-gray-50 dark:bg-gray-700 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">{clusterInfo.name}</h4>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {clusterInfo.nodes} nodes • Version {clusterInfo.version}
              </div>
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                clusterInfo.quorate
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {clusterInfo.quorate ? 'Quorate' : 'Not Quorate'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nodes */}
      {showNodes && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cluster Nodes ({filteredNodes.length})
          </h4>
          <div className={`space-y-${compactView ? '1' : '2'}`}>
            {filteredNodes.map((node) => (
              <div
                key={node.id || node.name}
                className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${node.online !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-gray-900 dark:text-white">{node.name}</span>
                    {node.local && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                        Local
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(node.online)}`}>
                    {node.online !== false ? 'Online' : 'Offline'}
                  </span>
                </div>
                {showNodeDetails && !compactView && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {node.ip && (
                      <div>
                        <span className="block text-gray-500 dark:text-gray-400">IP</span>
                        <span className="text-gray-700 dark:text-gray-300">{node.ip}</span>
                      </div>
                    )}
                    {node.nodeid !== undefined && (
                      <div>
                        <span className="block text-gray-500 dark:text-gray-400">Node ID</span>
                        <span className="text-gray-700 dark:text-gray-300">{node.nodeid}</span>
                      </div>
                    )}
                    {node.level && (
                      <div>
                        <span className="block text-gray-500 dark:text-gray-400">Level</span>
                        <span className="text-gray-700 dark:text-gray-300">{node.level}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredNodes.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {nodes.length === 0 ? 'No cluster nodes found' : 'No nodes match filter'}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {!clusterInfo && nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>Not a cluster or cluster unavailable</p>
            </div>
          ) : (
            <>
              {visualization === 'donut' && renderDonut()}
              {visualization === 'list' && renderList()}
              {(visualization === 'cards' || !['donut', 'list'].includes(visualization)) && renderCards()}
            </>
          )}
        </>
      )}
    </BaseWidget>
  );
}
