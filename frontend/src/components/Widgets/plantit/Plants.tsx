import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Plant {
  id: number;
  personalName: string;
  species: string;
  family: string;
  location: string;
  thumbnailId?: string;
  photoCount: number;
  lastWatered: string | null;
  state?: string;
}

interface PlantsData {
  plants: Plant[];
  total: number;
}

interface PlantsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function getEventTypeIcon(type: string): string {
  switch (type) {
    case 'WATERING': return '💧';
    case 'FERTILIZING': return '🧪';
    case 'PRUNING': return '✂️';
    case 'TRANSPLANTING': return '🪴';
    case 'MISTING': return '💨';
    case 'PROPAGATING': return '🌱';
    case 'TREATMENT': return '💊';
    default: return '📝';
  }
}

export function Plants({ integrationId, config, widgetId }: PlantsWidgetProps) {
  const { data, loading, error } = useWidgetData<PlantsData>({
    integrationId,
    metric: 'plants',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'grid';
  const maxItems = (config.maxItems as number) || 20;
  const searchFilter = (config.search as string) || '';
  const displayOptions = config.displayOptions as Record<string, boolean> | undefined;
  const showSpecies = displayOptions?.showSpecies !== false;
  const showLocation = displayOptions?.showLocation !== false;
  const showLastWatered = displayOptions?.showLastWatered !== false;

  let plants = data?.plants || [];

  // Apply search filter
  if (searchFilter) {
    plants = plants.filter(p =>
      p.personalName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.species.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }

  // Limit items
  plants = plants.slice(0, maxItems);

  // Grid visualization
  if (visualization === 'grid') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {plants.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No plants found
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {plants.map((plant) => (
                <div
                  key={plant.id}
                  className="bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-700/50 transition-colors"
                >
                  <div className="aspect-square bg-gray-700 flex items-center justify-center">
                    {plant.thumbnailId ? (
                      <div className="w-full h-full bg-gradient-to-br from-green-900/50 to-green-700/50 flex items-center justify-center">
                        <span className="text-4xl">🌿</span>
                      </div>
                    ) : (
                      <span className="text-4xl">🌱</span>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="font-medium text-white text-sm truncate">{plant.personalName}</div>
                    {showSpecies && (
                      <div className="text-xs text-gray-400 truncate italic">{plant.species}</div>
                    )}
                    {showLocation && plant.location && (
                      <div className="text-xs text-gray-500 truncate">{plant.location}</div>
                    )}
                    {showLastWatered && (
                      <div className="text-xs text-blue-400 mt-1">
                        💧 {formatRelativeTime(plant.lastWatered)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // List visualization
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          {plants.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No plants found
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {plants.map((plant) => (
                <div
                  key={plant.id}
                  className="p-3 hover:bg-gray-800/50 transition-colors flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🌿</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">{plant.personalName}</div>
                    {showSpecies && (
                      <div className="text-xs text-gray-400 truncate italic">{plant.species}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {showLocation && plant.location && (
                      <div className="text-xs text-gray-500">{plant.location}</div>
                    )}
                    {showLastWatered && (
                      <div className="text-xs text-blue-400">
                        💧 {formatRelativeTime(plant.lastWatered)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="text-xs text-gray-400 mb-2 px-2">{data?.total || 0} plants</div>
        {plants.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No plants found
          </div>
        ) : (
          <div className="space-y-1">
            {plants.map((plant) => (
              <div
                key={plant.id}
                className="px-2 py-1 hover:bg-gray-800/50 rounded flex items-center justify-between text-sm"
              >
                <span className="text-white truncate">{plant.personalName}</span>
                {showLastWatered && plant.lastWatered && (
                  <span className="text-xs text-blue-400 flex-shrink-0 ml-2">
                    💧 {formatRelativeTime(plant.lastWatered)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
