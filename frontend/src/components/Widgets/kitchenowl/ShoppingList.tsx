import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface ShoppingListItem {
  id: number;
  name: string;
  description?: string;
  done: boolean;
}

interface ShoppingListData {
  id: number;
  name: string;
  items: ShoppingListItem[];
  itemCount: number;
  doneCount: number;
}

interface ShoppingListWidgetData {
  lists: ShoppingListData[];
  summary: {
    listCount: number;
    totalItems: number;
    totalDone: number;
    totalPending: number;
  };
}

interface ShoppingListWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function ShoppingList({ integrationId, config, widgetId }: ShoppingListWidgetProps) {
  const { data, loading, error } = useWidgetData<ShoppingListWidgetData>({
    integrationId,
    metric: 'shopping-list',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const filter = (config.filter as string) || '';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">Loading shopping list...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Filter items based on selection
  const filterItems = (items: ShoppingListItem[]) => {
    if (filter === 'pending') return items.filter(i => !i.done);
    if (filter === 'done') return items.filter(i => i.done);
    return items;
  };

  if (visualization === 'summary') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-xs text-gray-500 mb-2">{data.summary.listCount} Shopping Lists</div>
          <div className="text-3xl font-bold text-white mb-1">{data.summary.totalPending}</div>
          <div className="text-sm text-gray-400">items to buy</div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="text-green-400 font-medium">{data.summary.totalDone}</div>
              <div className="text-gray-500">done</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-medium">{data.summary.totalItems}</div>
              <div className="text-gray-500">total</div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'compact') {
    const allItems = data.lists.flatMap(list =>
      filterItems(list.items).map(item => ({ ...item, listName: list.name }))
    );

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-gray-500">{data.summary.totalPending} pending</span>
            <span className="text-gray-400">{data.summary.listCount} lists</span>
          </div>
          <div className="space-y-0.5">
            {allItems.slice(0, 20).map((item) => (
              <div key={`${item.listName}-${item.id}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800">
                <div className={`w-3 h-3 rounded border flex-shrink-0 ${
                  item.done ? 'bg-green-500 border-green-500' : 'border-gray-600'
                }`}>
                  {item.done && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-xs truncate ${item.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <span className="text-gray-500">{data.summary.totalPending} items to buy</span>
          <span className="text-gray-400">{data.summary.totalDone} done</span>
        </div>
        <div className="space-y-3">
          {data.lists.map((list) => {
            const filteredItems = filterItems(list.items);
            if (filteredItems.length === 0 && filter) return null;

            return (
              <div key={list.id} className="p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{list.name}</span>
                  <span className="text-xs text-gray-500">
                    {list.doneCount}/{list.itemCount}
                  </span>
                </div>
                <div className="space-y-1">
                  {filteredItems.slice(0, 10).map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        item.done ? 'bg-green-500 border-green-500' : 'border-gray-600'
                      }`}>
                        {item.done && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${item.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                        {item.name}
                      </span>
                      {item.description && (
                        <span className="text-xs text-gray-500">({item.description})</span>
                      )}
                    </div>
                  ))}
                  {filteredItems.length > 10 && (
                    <div className="text-xs text-gray-500 pl-6">
                      +{filteredItems.length - 10} more items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {data.lists.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No shopping lists</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
