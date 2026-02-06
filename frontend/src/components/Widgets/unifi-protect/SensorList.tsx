import React, { useCallback, useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useSorting, SortDirection } from '../../../hooks/useSorting';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { BaseWidget } from '../BaseWidget';
import { StatusIndicator } from '../../common/StatusIndicator';
import { SortableHeader } from '../../common/SortableHeader';
import { matchesAnyFilter } from '../../../utils/filterUtils';

interface SensorListProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface ProtectSensor {
  id: string;
  name: string;
  model: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  mountType: 'door' | 'window' | 'garage' | 'leak' | 'none';
  batteryStatus: {
    percentage: number | null;
    isLow: boolean;
  };
  isOpened: boolean | null;
  temperature: number | null;
  humidity: number | null;
}

interface SensorData {
  sensors: ProtectSensor[];
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

function formatBattery(percentage: number | null, isLow: boolean): React.ReactNode {
  if (percentage === null) return <span className="text-gray-400">-</span>;

  const color = isLow || percentage < 20
    ? 'text-red-600 dark:text-red-400'
    : percentage < 50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-green-600 dark:text-green-400';

  return <span className={color}>{percentage}%</span>;
}

function formatTemperature(temp: number | null): string {
  if (temp === null) return '-';
  // API returns Celsius, convert to display
  const fahrenheit = (temp * 9/5) + 32;
  return `${Math.round(temp)}°C / ${Math.round(fahrenheit)}°F`;
}

export function SensorList({ integrationId, config, widgetId }: SensorListProps) {
  const { updateWidget } = useDashboardStore();
  const { data, loading, error } = useWidgetData<SensorData>({
    integrationId,
    metric: 'sensors',
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
  const filteredSensors = useMemo(() => {
    if (!data?.sensors) return [];

    return data.sensors.filter(sensor => {
      // Sensor type filter
      const sensorType = config.sensorType as string;
      if (sensorType && sensor.mountType !== sensorType) return false;

      // Status filter
      const status = config.status as string;
      if (status === 'connected' && sensor.state !== 'CONNECTED') return false;
      if (status === 'disconnected' && sensor.state === 'CONNECTED') return false;

      // Search filter
      const search = config.search as string;
      if (search && !matchesAnyFilter([sensor.name, sensor.model], search)) {
        return false;
      }

      return true;
    });
  }, [data?.sensors, config.sensorType, config.status, config.search]);

  // Sorting
  type SortKey = 'name' | 'status' | 'battery' | 'state' | 'temperature';
  const getSortValue = useCallback((sensor: ProtectSensor, key: SortKey) => {
    switch (key) {
      case 'name': return sensor.name;
      case 'status': return sensor.state;
      case 'battery': return sensor.batteryStatus.percentage || 0;
      case 'state': return sensor.isOpened ? 1 : 0;
      case 'temperature': return sensor.temperature || 0;
      default: return '';
    }
  }, []);

  const { sortedData, requestSort, getSortDirection } = useSorting<SortKey, ProtectSensor>(
    filteredSensors,
    configSortKey as SortKey,
    configSortDirection,
    getSortValue,
    { onSortChange: handleSortChange, controlled: true }
  );

  // Column visibility
  const showStatus = config.showStatus !== false;
  const showBattery = config.showBattery !== false;
  const showState = config.showState !== false;
  const showTemperature = config.showTemperature !== false;
  const showHumidity = config.showHumidity !== false;
  const hideLabels = (config.hideLabels as boolean) || false;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            {!hideLabels && (
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Sensor" sortKey="name" direction={getSortDirection('name')} onSort={() => requestSort('name')} />
                  {showStatus && <SortableHeader label="Status" sortKey="status" direction={getSortDirection('status')} onSort={() => requestSort('status')} />}
                  {showBattery && <SortableHeader label="Battery" sortKey="battery" direction={getSortDirection('battery')} onSort={() => requestSort('battery')} />}
                  {showState && <SortableHeader label="State" sortKey="state" direction={getSortDirection('state')} onSort={() => requestSort('state')} />}
                  {showTemperature && <SortableHeader label="Temp" sortKey="temperature" direction={getSortDirection('temperature')} onSort={() => requestSort('temperature')} />}
                  {showHumidity && <th className="py-2 px-1 font-medium">Humidity</th>}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedData.map(sensor => (
                <tr key={sensor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2">
                    <div className="font-medium text-gray-900 dark:text-white">{sensor.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{sensor.mountType}</div>
                  </td>
                  {showStatus && (
                    <td className="py-2">
                      <StatusIndicator status={getStatusFromState(sensor.state)} />
                    </td>
                  )}
                  {showBattery && (
                    <td className="py-2">
                      {formatBattery(sensor.batteryStatus.percentage, sensor.batteryStatus.isLow)}
                    </td>
                  )}
                  {showState && (
                    <td className="py-2">
                      {sensor.isOpened !== null ? (
                        sensor.isOpened ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            Open
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Closed
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  {showTemperature && (
                    <td className="py-2 text-gray-600 dark:text-gray-300 text-xs">
                      {formatTemperature(sensor.temperature)}
                    </td>
                  )}
                  {showHumidity && (
                    <td className="py-2 text-gray-600 dark:text-gray-300 text-xs">
                      {sensor.humidity !== null ? `${Math.round(sensor.humidity)}%` : '-'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {sortedData.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {data.sensors.length === 0 ? 'No sensors found' : 'No sensors match filters'}
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
