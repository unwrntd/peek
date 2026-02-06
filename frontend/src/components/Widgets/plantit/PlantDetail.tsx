import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface PlantEvent {
  id: number;
  type: string;
  date: string;
  note?: string;
}

interface PlantReminder {
  id: number;
  action: string;
  type: string;
  nextTrigger?: string;
  enabled: boolean;
}

interface PlantDetailData {
  plant: {
    id: number;
    personalName: string;
    species: string;
    family: string;
    location: string;
    avatarImageId?: string;
    images: unknown[];
    purchasedPrice?: number;
    currencySymbol?: string;
    state?: string;
    note?: string;
    birthDate?: string;
  };
  recentEvents: PlantEvent[];
  reminders: PlantReminder[];
  overdueCount: number;
}

interface PlantDetailWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getEventTypeInfo(type: string): { icon: string; color: string } {
  switch (type) {
    case 'WATERING': return { icon: '💧', color: 'text-blue-400' };
    case 'FERTILIZING': return { icon: '🧪', color: 'text-green-400' };
    case 'PRUNING': return { icon: '✂️', color: 'text-yellow-400' };
    case 'TRANSPLANTING': return { icon: '🪴', color: 'text-orange-400' };
    case 'MISTING': return { icon: '💨', color: 'text-cyan-400' };
    case 'PROPAGATING': return { icon: '🌱', color: 'text-lime-400' };
    case 'TREATMENT': return { icon: '💊', color: 'text-purple-400' };
    default: return { icon: '📝', color: 'text-gray-400' };
  }
}

export function PlantDetail({ integrationId, config, widgetId }: PlantDetailWidgetProps) {
  const plantId = config.plantId as number;

  const { data, loading, error } = useWidgetData<PlantDetailData>({
    integrationId,
    metric: plantId ? `plant-detail:${plantId}` : 'plant-detail',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
    enabled: !!plantId,
  });

  const visualization = (config.visualization as string) || 'card';
  const displayOptions = config.displayOptions as Record<string, boolean> | undefined;
  const showEvents = displayOptions?.showEvents !== false;
  const showReminders = displayOptions?.showReminders !== false;
  const showSpecies = displayOptions?.showSpecies !== false;

  if (!plantId) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-sm">Configure plant ID in widget settings</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  const plant = data?.plant;

  // Card visualization (default)
  if (visualization === 'card') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          {plant && (
            <div className="p-3">
              {/* Header with image and name */}
              <div className="flex gap-3 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-900/50 to-green-700/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">🌿</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-white truncate">{plant.personalName}</h3>
                  {showSpecies && (
                    <p className="text-sm text-gray-400 italic truncate">{plant.species}</p>
                  )}
                  {plant.location && (
                    <p className="text-xs text-gray-500 mt-1">{plant.location}</p>
                  )}
                </div>
              </div>

              {/* Status indicators */}
              {data?.overdueCount && data.overdueCount > 0 && (
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-3 py-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400">⚠️</span>
                    <span className="text-sm text-orange-400">
                      {data.overdueCount} overdue reminder{data.overdueCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Recent events */}
              {showEvents && data?.recentEvents && data.recentEvents.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Recent Activity</h4>
                  <div className="space-y-2">
                    {data.recentEvents.slice(0, 5).map((event) => {
                      const eventInfo = getEventTypeInfo(event.type);
                      return (
                        <div key={event.id} className="flex items-center gap-2 text-sm">
                          <span>{eventInfo.icon}</span>
                          <span className={eventInfo.color}>{event.type}</span>
                          <span className="text-gray-500 text-xs ml-auto">{formatDate(event.date)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reminders */}
              {showReminders && data?.reminders && data.reminders.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Reminders</h4>
                  <div className="space-y-2">
                    {data.reminders.slice(0, 4).map((reminder) => {
                      const eventInfo = getEventTypeInfo(reminder.action || reminder.type);
                      const isOverdue = reminder.nextTrigger && new Date(reminder.nextTrigger) < new Date();
                      return (
                        <div
                          key={reminder.id}
                          className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-orange-400' : ''}`}
                        >
                          <span>{eventInfo.icon}</span>
                          <span className="truncate">{reminder.action || reminder.type}</span>
                          {!reminder.enabled && (
                            <span className="text-xs text-gray-500">(disabled)</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              {plant.note && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Notes</h4>
                  <p className="text-sm text-gray-300 line-clamp-3">{plant.note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto p-3">
        {plant && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🌿</span>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{plant.personalName}</div>
                {showSpecies && (
                  <div className="text-xs text-gray-400 italic truncate">{plant.species}</div>
                )}
              </div>
              {data?.overdueCount && data.overdueCount > 0 && (
                <span className="text-orange-400 text-xs bg-orange-900/30 px-2 py-0.5 rounded">
                  {data.overdueCount} overdue
                </span>
              )}
            </div>

            {showEvents && data?.recentEvents && data.recentEvents.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {data.recentEvents.slice(0, 3).map((event) => {
                  const eventInfo = getEventTypeInfo(event.type);
                  return (
                    <span
                      key={event.id}
                      className="text-xs bg-gray-800 px-2 py-0.5 rounded flex items-center gap-1"
                      title={`${event.type} - ${formatDate(event.date)}`}
                    >
                      {eventInfo.icon}
                      <span className="text-gray-400">{formatDate(event.date)}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
