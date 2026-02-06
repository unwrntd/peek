import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Reminder {
  id: number;
  plantId: number;
  plantName: string;
  type: string;
  frequency: string;
  frequencyAmount: number;
  nextDue: string | null;
  lastTriggered: string | null;
  overdue: boolean;
  enabled: boolean;
}

interface RemindersData {
  reminders: Reminder[];
  overdueCount: number;
  upcomingCount: number;
  total: number;
}

interface RemindersWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDueDate(dateStr: string | null, overdue: boolean): string {
  if (!dateStr) return 'Not scheduled';

  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (overdue) {
    const overdueDays = Math.abs(days);
    if (overdueDays === 0) return 'Due today';
    if (overdueDays === 1) return '1 day overdue';
    return `${overdueDays} days overdue`;
  }

  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 30) return `In ${Math.floor(days / 7)} weeks`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getReminderTypeInfo(type: string): { icon: string; label: string } {
  switch (type) {
    case 'WATERING':
      return { icon: '💧', label: 'Water' };
    case 'FERTILIZING':
      return { icon: '🧪', label: 'Fertilize' };
    case 'PRUNING':
      return { icon: '✂️', label: 'Prune' };
    case 'TRANSPLANTING':
      return { icon: '🪴', label: 'Repot' };
    case 'MISTING':
      return { icon: '💨', label: 'Mist' };
    case 'PROPAGATING':
      return { icon: '🌱', label: 'Propagate' };
    case 'TREATMENT':
      return { icon: '💊', label: 'Treat' };
    case 'BIOSTIMULATING':
      return { icon: '⚡', label: 'Biostimulate' };
    default:
      return { icon: '🔔', label: type };
  }
}

function formatFrequency(unit: string, amount: number): string {
  if (!unit || !amount) return '';

  const unitLabel = unit.toLowerCase();
  if (amount === 1) {
    switch (unitLabel) {
      case 'days': return 'Daily';
      case 'weeks': return 'Weekly';
      case 'months': return 'Monthly';
      default: return `Every ${unitLabel}`;
    }
  }
  return `Every ${amount} ${unitLabel}`;
}

export function Reminders({ integrationId, config, widgetId }: RemindersWidgetProps) {
  const { data, loading, error } = useWidgetData<RemindersData>({
    integrationId,
    metric: 'reminders',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const statusFilter = (config.status as string) || '';
  const displayOptions = config.displayOptions as Record<string, boolean> | undefined;
  const showPlantName = displayOptions?.showPlantName !== false;
  const showFrequency = displayOptions?.showFrequency !== false;
  const showDueDate = displayOptions?.showDueDate !== false;

  let reminders = data?.reminders || [];

  // Apply status filter
  if (statusFilter === 'overdue') {
    reminders = reminders.filter(r => r.overdue);
  } else if (statusFilter === 'upcoming') {
    reminders = reminders.filter(r => !r.overdue && r.enabled);
  }

  // List visualization (default)
  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          {/* Summary header */}
          {data && (data.overdueCount > 0 || data.upcomingCount > 0) && (
            <div className="flex items-center gap-4 px-3 py-2 border-b border-gray-700 text-xs">
              {data.overdueCount > 0 && (
                <span className="text-orange-400">
                  {data.overdueCount} overdue
                </span>
              )}
              <span className="text-gray-400">
                {data.upcomingCount} upcoming
              </span>
            </div>
          )}

          {reminders.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No reminders found
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {reminders.map((reminder) => {
                const typeInfo = getReminderTypeInfo(reminder.type);
                return (
                  <div
                    key={reminder.id}
                    className={`p-3 hover:bg-gray-800/50 transition-colors ${
                      reminder.overdue ? 'bg-orange-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{typeInfo.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">
                            {typeInfo.label}
                          </span>
                          {!reminder.enabled && (
                            <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        {showPlantName && (
                          <div className="text-sm text-gray-400">{reminder.plantName}</div>
                        )}
                        {showFrequency && reminder.frequency && (
                          <div className="text-xs text-gray-500">
                            {formatFrequency(reminder.frequency, reminder.frequencyAmount)}
                          </div>
                        )}
                      </div>
                      {showDueDate && (
                        <div className={`text-xs text-right flex-shrink-0 ${
                          reminder.overdue ? 'text-orange-400 font-medium' : 'text-gray-400'
                        }`}>
                          {formatDueDate(reminder.nextDue, reminder.overdue)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Calendar visualization
  if (visualization === 'calendar') {
    // Group reminders by due date
    const remindersByDate = reminders.reduce((acc, reminder) => {
      if (!reminder.nextDue) return acc;
      const dateKey = new Date(reminder.nextDue).toISOString().split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(reminder);
      return acc;
    }, {} as Record<string, Reminder[]>);

    const sortedDates = Object.keys(remindersByDate).sort();

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          {sortedDates.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No scheduled reminders
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map((dateKey) => {
                const date = new Date(dateKey);
                const isToday = date.toDateString() === new Date().toDateString();
                const isPast = date < new Date() && !isToday;

                return (
                  <div key={dateKey}>
                    <div className={`text-xs font-medium mb-2 ${
                      isPast ? 'text-orange-400' : isToday ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      {isToday ? 'Today' : date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="space-y-1">
                      {remindersByDate[dateKey].map((reminder) => {
                        const typeInfo = getReminderTypeInfo(reminder.type);
                        return (
                          <div
                            key={reminder.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                              reminder.overdue ? 'bg-orange-900/20' : 'bg-gray-800/50'
                            }`}
                          >
                            <span>{typeInfo.icon}</span>
                            <span className="text-white">{typeInfo.label}</span>
                            {showPlantName && (
                              <span className="text-gray-400 truncate">- {reminder.plantName}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 px-2">
          <span>{data?.total || 0} reminders</span>
          {data?.overdueCount ? (
            <span className="text-orange-400">({data.overdueCount} overdue)</span>
          ) : null}
        </div>
        {reminders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No reminders found
          </div>
        ) : (
          <div className="space-y-1">
            {reminders.map((reminder) => {
              const typeInfo = getReminderTypeInfo(reminder.type);
              return (
                <div
                  key={reminder.id}
                  className={`px-2 py-1 hover:bg-gray-800/50 rounded flex items-center gap-2 text-sm ${
                    reminder.overdue ? 'text-orange-400' : ''
                  }`}
                >
                  <span>{typeInfo.icon}</span>
                  <span className="truncate flex-1">
                    {showPlantName ? reminder.plantName : typeInfo.label}
                  </span>
                  {showDueDate && (
                    <span className={`text-xs flex-shrink-0 ${
                      reminder.overdue ? 'text-orange-400' : 'text-gray-500'
                    }`}>
                      {formatDueDate(reminder.nextDue, reminder.overdue)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
