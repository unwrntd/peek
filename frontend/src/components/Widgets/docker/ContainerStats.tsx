import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { matchesAnyFilter } from '../../../utils/filterUtils';
import { formatBytes } from '../../../utils/formatting';

interface ContainerStatsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ContainerStat {
  id: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
  pids: number;
}

interface ContainerStatsData {
  stats: ContainerStat[];
}

function getUsageColor(percent: number, warning: number, critical: number): string {
  if (percent >= critical) return 'bg-red-500';
  if (percent >= warning) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function ContainerStats({ integrationId, config, widgetId }: ContainerStatsProps) {
  const { data, loading, error } = useWidgetData<ContainerStatsData>({
    integrationId,
    metric: 'container-stats',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const filteredStats = useMemo(() => {
    if (!data?.stats) return [];

    return data.stats.filter(stat => {
      const containerFilter = config.containerFilter as string;
      if (containerFilter && !matchesAnyFilter([stat.name], containerFilter)) {
        return false;
      }
      return true;
    });
  }, [data?.stats, config.containerFilter]);

  const maxItems = (config.maxItems as number) || 10;
  const showCpu = config.showCpu !== false;
  const showMemory = config.showMemory !== false;
  const showNetwork = config.showNetwork !== false;
  const showBlockIo = config.showBlockIo !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'bars';
  const warningThreshold = (config.warningThreshold as number) || 75;
  const criticalThreshold = (config.criticalThreshold as number) || 90;

  const renderBarsView = () => (
    <div className="space-y-4">
      {filteredStats.slice(0, maxItems).map(stat => (
        <div key={stat.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {stat.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {stat.pids} PIDs
            </span>
          </div>

          {showCpu && (
            <div>
              {!hideLabels && (
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">CPU</span>
                  <span className="text-gray-700 dark:text-gray-300">{stat.cpuPercent.toFixed(1)}%</span>
                </div>
              )}
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                <div
                  className={`h-full rounded-full ${getUsageColor(stat.cpuPercent, warningThreshold, criticalThreshold)}`}
                  style={{ width: `${Math.min(stat.cpuPercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {showMemory && (
            <div>
              {!hideLabels && (
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Memory</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatBytes(stat.memoryUsage)} / {formatBytes(stat.memoryLimit)} ({stat.memoryPercent.toFixed(1)}%)
                  </span>
                </div>
              )}
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                <div
                  className={`h-full rounded-full ${getUsageColor(stat.memoryPercent, warningThreshold, criticalThreshold)}`}
                  style={{ width: `${Math.min(stat.memoryPercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {(showNetwork || showBlockIo) && (
            <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              {showNetwork && (
                <span>Net: {formatBytes(stat.networkRx)} / {formatBytes(stat.networkTx)}</span>
              )}
              {showBlockIo && (
                <span>I/O: {formatBytes(stat.blockRead)} / {formatBytes(stat.blockWrite)}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderCardsView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {filteredStats.slice(0, maxItems).map(stat => (
        <div
          key={stat.id}
          className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {stat.name}
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            {showCpu && (
              <div>
                <div className={`text-2xl font-bold ${
                  stat.cpuPercent >= criticalThreshold ? 'text-red-500' :
                  stat.cpuPercent >= warningThreshold ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {stat.cpuPercent.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">CPU</div>
              </div>
            )}
            {showMemory && (
              <div>
                <div className={`text-2xl font-bold ${
                  stat.memoryPercent >= criticalThreshold ? 'text-red-500' :
                  stat.memoryPercent >= warningThreshold ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {stat.memoryPercent.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Memory</div>
              </div>
            )}
          </div>

          {(showNetwork || showBlockIo) && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {showNetwork && (
                <div className="flex justify-between">
                  <span>Network</span>
                  <span>{formatBytes(stat.networkRx)} / {formatBytes(stat.networkTx)}</span>
                </div>
              )}
              {showBlockIo && (
                <div className="flex justify-between">
                  <span>Block I/O</span>
                  <span>{formatBytes(stat.blockRead)} / {formatBytes(stat.blockWrite)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        {!hideLabels && (
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 font-medium">Container</th>
              {showCpu && <th className="py-2 font-medium">CPU</th>}
              {showMemory && <th className="py-2 font-medium">Memory</th>}
              {showNetwork && <th className="py-2 font-medium">Network</th>}
              {showBlockIo && <th className="py-2 font-medium">Block I/O</th>}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredStats.slice(0, maxItems).map(stat => (
            <tr key={stat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {stat.name}
                </span>
              </td>
              {showCpu && (
                <td className={`py-2 ${
                  stat.cpuPercent >= criticalThreshold ? 'text-red-500' :
                  stat.cpuPercent >= warningThreshold ? 'text-yellow-500' : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {stat.cpuPercent.toFixed(1)}%
                </td>
              )}
              {showMemory && (
                <td className={`py-2 ${
                  stat.memoryPercent >= criticalThreshold ? 'text-red-500' :
                  stat.memoryPercent >= warningThreshold ? 'text-yellow-500' : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {formatBytes(stat.memoryUsage)} ({stat.memoryPercent.toFixed(1)}%)
                </td>
              )}
              {showNetwork && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatBytes(stat.networkRx)} / {formatBytes(stat.networkTx)}
                </td>
              )}
              {showBlockIo && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatBytes(stat.blockRead)} / {formatBytes(stat.blockWrite)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {visualizationType === 'cards' ? renderCardsView() :
           visualizationType === 'table' ? renderTableView() : renderBarsView()}
          {filteredStats.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No running containers found
            </p>
          )}
          {filteredStats.length > maxItems && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-xs py-2">
              Showing {maxItems} of {filteredStats.length} containers
            </p>
          )}
        </>
      )}
    </BaseWidget>
  );
}
