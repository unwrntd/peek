import React, { useCallback, useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { StatusIndicator } from '../../common/StatusIndicator';
import { SortableHeader } from '../../common/SortableHeader';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface ContainerListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: Array<{
    IP?: string;
    PrivatePort: number;
    PublicPort?: number;
    Type: string;
  }>;
}

interface ContainerData {
  containers: DockerContainer[];
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

function formatPorts(ports: DockerContainer['ports']): string {
  if (!ports || ports.length === 0) return '-';
  return ports
    .filter(p => p.PublicPort)
    .map(p => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`)
    .slice(0, 3)
    .join(', ') || '-';
}

export function ContainerList({ integrationId, config, widgetId }: ContainerListProps) {
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<ContainerData>({
    integrationId,
    metric: 'containers',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const configSortKey = (config.sortField as string) || 'name';
  const configSortDirection = (config.sortDirection as SortDirection) || 'asc';

  const handleSortChange = useCallback((key: string | null, direction: SortDirection) => {
    if (!widgetId) return;
    updateWidget(widgetId, {
      config: { ...config, sortField: key, sortDirection: direction }
    });
  }, [widgetId, config, updateWidget]);

  const filteredContainers = useMemo(() => {
    if (!data?.containers) return [];

    return data.containers.filter(container => {
      const statusFilter = config.status as string;
      if (statusFilter) {
        if (statusFilter === 'running' && container.state !== 'running') return false;
        if (statusFilter === 'stopped' && container.state !== 'exited') return false;
        if (statusFilter === 'paused' && container.state !== 'paused') return false;
        if (statusFilter === 'restarting' && container.state !== 'restarting') return false;
      }

      const search = config.search as string;
      if (search && !matchesAnyFilter([container.name, container.image], search)) {
        return false;
      }

      return true;
    });
  }, [data?.containers, config.status, config.search]);

  type SortKey = 'name' | 'image' | 'state' | 'created';
  const getSortValue = useCallback((container: DockerContainer, key: SortKey) => {
    switch (key) {
      case 'name': return container.name;
      case 'image': return container.image;
      case 'state': return container.state;
      case 'created': return container.created;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, DockerContainer>(
    filteredContainers,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  const maxItems = (config.maxItems as number) || 20;
  const showStatus = config.showStatus !== false;
  const showImage = config.showImage !== false;
  const showCreated = config.showCreated !== false;
  const showPorts = config.showPorts !== false;
  const hideLabels = (config.hideLabels as boolean) || false;
  const visualizationType = (config.visualization as string) || 'table';

  const getStateStatus = (state: string): 'running' | 'stopped' | 'warning' => {
    switch (state) {
      case 'running': return 'running';
      case 'exited': return 'stopped';
      case 'paused': return 'warning';
      case 'restarting': return 'warning';
      default: return 'stopped';
    }
  };

  const renderCardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sortedData.slice(0, maxItems).map(container => (
        <div
          key={container.id}
          className={`p-3 rounded-lg border transition-colors ${
            container.state === 'running'
              ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {container.name}
              </h4>
              {showImage && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                  {container.image}
                </p>
              )}
            </div>
            {showStatus && <StatusIndicator status={getStateStatus(container.state)} />}
          </div>

          <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {showCreated && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTimeAgo(container.created)}
              </span>
            )}
            {showPorts && container.ports.length > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {formatPorts(container.ports)}
              </span>
            )}
          </div>
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
              <SortableHeader label="Name" sortKey="name" direction={getSortDirection('name')} onSort={() => requestSort('name')} />
              {showStatus && <th className="py-2 font-medium">Status</th>}
              {showImage && <SortableHeader label="Image" sortKey="image" direction={getSortDirection('image')} onSort={() => requestSort('image')} />}
              {showCreated && <SortableHeader label="Created" sortKey="created" direction={getSortDirection('created')} onSort={() => requestSort('created')} />}
              {showPorts && <th className="py-2 font-medium">Ports</th>}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {sortedData.slice(0, maxItems).map(container => (
            <tr key={container.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="py-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {container.name}
                </span>
              </td>
              {showStatus && (
                <td className="py-2">
                  <StatusIndicator status={getStateStatus(container.state)} />
                </td>
              )}
              {showImage && (
                <td className="py-2 text-gray-600 dark:text-gray-300 truncate max-w-[200px]">
                  {container.image}
                </td>
              )}
              {showCreated && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatTimeAgo(container.created)}
                </td>
              )}
              {showPorts && (
                <td className="py-2 text-gray-600 dark:text-gray-300">
                  {formatPorts(container.ports)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const summary = useMemo(() => {
    const containers = data?.containers || [];
    return {
      total: containers.length,
      running: containers.filter(c => c.state === 'running').length,
      stopped: containers.filter(c => c.state === 'exited').length,
    };
  }, [data?.containers]);

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {visualizationType === 'cards' ? renderCardView() : renderTableView()}
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {(data.containers?.length || 0) === 0 ? 'No containers found' : 'No containers match filters'}
            </p>
          )}
          {sortedData.length > maxItems && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-xs py-2">
              Showing {maxItems} of {sortedData.length} containers ({summary.running} running)
            </p>
          )}
        </>
      )}
    </BaseWidget>
  );
}
