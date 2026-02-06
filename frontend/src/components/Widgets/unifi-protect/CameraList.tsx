import React, { useCallback, useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { StatusIndicator } from '../../common/StatusIndicator';
import { SortableHeader } from '../../common/SortableHeader';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface CameraListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ProtectCamera {
  id: string;
  name: string;
  model: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  isRecording: boolean;
  isMotionDetected: boolean;
  lastMotion: number | null;
}

interface CameraData {
  cameras: ProtectCamera[];
}

function getStatusFromState(state: string): 'online' | 'warning' | 'offline' {
  switch (state) {
    case 'CONNECTED':
      return 'online';
    case 'CONNECTING':
      return 'warning';
    default:
      return 'offline';
  }
}

function formatLastMotion(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CameraList({ integrationId, config, widgetId }: CameraListProps) {
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<CameraData>({
    integrationId,
    metric: 'cameras',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Read sort state from config
  const configSortKey = (config.sortField as string) || 'name';
  const configSortDirection = (config.sortDirection as SortDirection) || 'asc';

  // Callback to persist sort changes to widget config
  const handleSortChange = useCallback((key: string | null, direction: SortDirection) => {
    if (!widgetId) return;
    updateWidget(widgetId, {
      config: { ...config, sortField: key, sortDirection: direction }
    });
  }, [widgetId, config, updateWidget]);

  // Apply filters
  const filteredCameras = useMemo(() => {
    if (!data?.cameras) return [];

    return data.cameras.filter(camera => {
      // Status filter
      const status = config.status as string;
      if (status === 'connected' && camera.state !== 'CONNECTED') return false;
      if (status === 'disconnected' && camera.state === 'CONNECTED') return false;

      // Recording filter
      const recording = config.recording as string;
      if (recording === 'recording' && !camera.isRecording) return false;
      if (recording === 'not-recording' && camera.isRecording) return false;

      // Search filter
      const search = config.search as string;
      if (search && !matchesAnyFilter([camera.name, camera.model], search)) {
        return false;
      }

      return true;
    });
  }, [data?.cameras, config.status, config.recording, config.search]);

  // Sorting
  type SortKey = 'name' | 'status' | 'recording' | 'motion' | 'model';
  const getSortValue = useCallback((camera: ProtectCamera, key: SortKey) => {
    switch (key) {
      case 'name': return camera.name;
      case 'status': return camera.state;
      case 'recording': return camera.isRecording ? 1 : 0;
      case 'motion': return camera.lastMotion || 0;
      case 'model': return camera.model;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, ProtectCamera>(
    filteredCameras,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  // Column visibility
  const showStatus = config.showStatus !== false;
  const showRecording = config.showRecording !== false;
  const showMotion = config.showMotion !== false;
  const showModel = config.showModel !== false;
  const hideLabels = (config.hideLabels as boolean) || false;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            {!hideLabels && (
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Camera" sortKey="name" direction={getSortDirection('name')} onSort={() => requestSort('name')} />
                  {showStatus && <SortableHeader label="Status" sortKey="status" direction={getSortDirection('status')} onSort={() => requestSort('status')} />}
                  {showRecording && <SortableHeader label="Recording" sortKey="recording" direction={getSortDirection('recording')} onSort={() => requestSort('recording')} />}
                  {showMotion && <SortableHeader label="Last Motion" sortKey="motion" direction={getSortDirection('motion')} onSort={() => requestSort('motion')} />}
                  {showModel && <SortableHeader label="Model" sortKey="model" direction={getSortDirection('model')} onSort={() => requestSort('model')} />}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedData.map(camera => (
                <tr key={camera.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2">
                    <div className="font-medium text-gray-900 dark:text-white">{camera.name}</div>
                  </td>
                  {showStatus && (
                    <td className="py-2">
                      <StatusIndicator status={getStatusFromState(camera.state)} />
                    </td>
                  )}
                  {showRecording && (
                    <td className="py-2">
                      {camera.state !== 'CONNECTED' ? (
                        <span className="text-gray-500 dark:text-gray-400">Offline</span>
                      ) : camera.isRecording ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          REC
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  {showMotion && (
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      {camera.isMotionDetected ? (
                        <span className="text-amber-600 dark:text-amber-400">Motion detected</span>
                      ) : (
                        formatLastMotion(camera.lastMotion)
                      )}
                    </td>
                  )}
                  {showModel && (
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      <span className="text-xs">{camera.model}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.cameras.length === 0 ? 'No cameras found' : 'No cameras match filters'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
