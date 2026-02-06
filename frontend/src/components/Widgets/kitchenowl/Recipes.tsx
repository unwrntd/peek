import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Recipe {
  id: number;
  name: string;
  description?: string;
  time?: number;
  cookTime?: number;
  prepTime?: number;
  yields?: number;
  yieldsUnit?: string;
  source?: string;
  photo?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface RecipesData {
  recipes: Recipe[];
  tags: Array<{ id: number; name: string }>;
  summary: {
    recipeCount: number;
    tagCount: number;
  };
}

interface RecipesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function Recipes({ integrationId, config, widgetId }: RecipesWidgetProps) {
  const { data, loading, error } = useWidgetData<RecipesData>({
    integrationId,
    metric: 'recipes',
    refreshInterval: (config.refreshInterval as number) || 300000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'grid';
  const maxItems = (config.maxItems as number) || 12;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-sm">Loading recipes...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  const recipes = data.recipes.slice(0, maxItems);

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-gray-500">{data.summary.recipeCount} recipes</span>
            <span className="text-gray-400">{data.summary.tagCount} tags</span>
          </div>
          <div className="space-y-0.5">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800">
                <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-xs text-gray-300 truncate flex-1">{recipe.name}</span>
                {recipe.time && (
                  <span className="text-xs text-gray-500">{formatTime(recipe.time)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'list') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="text-xs text-gray-500 mb-2 px-1">{data.summary.recipeCount} recipes</div>
          <div className="space-y-2">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="p-2 bg-gray-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{recipe.name}</div>
                    {recipe.description && (
                      <div className="text-xs text-gray-500 truncate mt-0.5">{recipe.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {recipe.time && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(recipe.time)}
                        </span>
                      )}
                      {recipe.yields && (
                        <span className="text-xs text-gray-400">
                          {recipe.yields} {recipe.yieldsUnit || 'servings'}
                        </span>
                      )}
                    </div>
                    {recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {recipe.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default grid view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="text-xs text-gray-500 mb-2 px-1">{data.summary.recipeCount} recipes</div>
        <div className="grid grid-cols-2 gap-2">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="p-2 bg-gray-800 rounded-lg">
              <div className="text-sm font-medium text-white truncate mb-1">{recipe.name}</div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {recipe.time && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatTime(recipe.time)}
                  </span>
                )}
                {recipe.yields && (
                  <span>{recipe.yields} {recipe.yieldsUnit || 'srv'}</span>
                )}
              </div>
              {recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {recipe.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs px-1 py-0.5 bg-orange-900/30 text-orange-400 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {data.recipes.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">No recipes</p>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
