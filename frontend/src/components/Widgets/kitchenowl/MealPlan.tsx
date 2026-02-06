import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface MealPlanRecipe {
  id: number;
  name: string;
  photo?: string;
}

interface MealPlanEntry {
  id: number;
  date: string;
  recipe: MealPlanRecipe | null;
  yields?: number;
}

interface MealPlanData {
  plans: MealPlanEntry[];
  byDate: Record<string, MealPlanEntry[]>;
  today: MealPlanEntry[];
  summary: {
    totalPlanned: number;
    todayCount: number;
    upcomingDays: number;
  };
}

interface MealPlanWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function MealPlan({ integrationId, config, widgetId }: MealPlanWidgetProps) {
  const { data, loading, error } = useWidgetData<MealPlanData>({
    integrationId,
    metric: 'meal-plan',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'calendar';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Loading meal plan...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'today') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-xs text-gray-500 mb-2">Today's Meals</div>
          {data.today.length > 0 ? (
            <div className="w-full space-y-2">
              {data.today.map((plan) => (
                <div key={plan.id} className="p-3 bg-gray-800 rounded-lg text-center">
                  <div className="text-lg font-medium text-white">{plan.recipe?.name || 'Untitled'}</div>
                  {plan.yields && (
                    <div className="text-xs text-gray-500 mt-1">{plan.yields} servings</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No meals planned for today</p>
            </div>
          )}
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'list') {
    const sortedDates = Object.keys(data.byDate).sort();

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-gray-500">{data.summary.totalPlanned} meals planned</span>
            <span className="text-gray-400">{data.summary.upcomingDays} days</span>
          </div>
          <div className="space-y-2">
            {sortedDates.slice(0, 7).map((date) => (
              <div key={date} className="p-2 bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{formatDate(date)}</div>
                <div className="space-y-1">
                  {data.byDate[date].map((plan) => (
                    <div key={plan.id} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span className="text-sm text-white">{plan.recipe?.name || 'Untitled'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {sortedDates.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">No meals planned</p>
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default calendar view
  const sortedDates = Object.keys(data.byDate).sort();

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <span className="text-gray-500">{data.summary.totalPlanned} meals</span>
          <span className="text-gray-400">next 2 weeks</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {sortedDates.slice(0, 14).map((date) => {
            const meals = data.byDate[date];
            const isToday = formatDate(date) === 'Today';

            return (
              <div
                key={date}
                className={`p-1 rounded text-center ${
                  isToday ? 'bg-orange-900/30 border border-orange-500/30' : 'bg-gray-800'
                }`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday ? 'text-orange-400' : 'text-gray-500'}`}>
                  {getDayName(date)}
                </div>
                {meals.length > 0 ? (
                  <div className="space-y-0.5">
                    {meals.slice(0, 2).map((plan) => (
                      <div
                        key={plan.id}
                        className="text-xs text-white truncate px-1"
                        title={plan.recipe?.name}
                      >
                        {plan.recipe?.name || '...'}
                      </div>
                    ))}
                    {meals.length > 2 && (
                      <div className="text-xs text-gray-500">+{meals.length - 2}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-600">-</div>
                )}
              </div>
            );
          })}
        </div>
        {sortedDates.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">No meals planned</p>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
