import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface HomeAssistantEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

interface EntitiesData {
  entities: HomeAssistantEntity[];
}

interface EntitiesProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function getStateColor(state: string): string {
  switch (state.toLowerCase()) {
    case 'on':
    case 'home':
    case 'open':
    case 'playing':
      return 'text-green-600 dark:text-green-400';
    case 'off':
    case 'away':
    case 'closed':
    case 'paused':
    case 'idle':
      return 'text-gray-500 dark:text-gray-400';
    case 'unavailable':
    case 'unknown':
      return 'text-red-500 dark:text-red-400';
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
}

function getDomainIcon(domain: string): React.ReactNode {
  switch (domain) {
    case 'light':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'switch':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'sensor':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'binary_sensor':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    case 'climate':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
        </svg>
      );
    case 'cover':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

export function Entities({ integrationId, config, widgetId }: EntitiesProps) {
  const { data, loading, error } = useWidgetData<EntitiesData>({
    integrationId,
    metric: 'entities',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'cards';
  const hideLabels = (config.hideLabels as boolean) || false;
  const domain = (config.domain as string) || '';
  const stateFilter = (config.stateFilter as string) || '';
  const search = (config.search as string) || '';
  const maxItems = (config.maxItems as number) || 50;
  const showEntityId = config.showEntityId !== false;
  const showLastChanged = config.showLastChanged !== false;
  const showAttributes = config.showAttributes === true;

  const filteredEntities = useMemo(() => {
    if (!data?.entities) return [];

    let filtered = data.entities;

    // Filter by domain
    if (domain) {
      filtered = filtered.filter(e => e.entity_id.startsWith(`${domain}.`));
    }

    // Filter by state
    if (stateFilter) {
      filtered = filtered.filter(e => e.state.toLowerCase() === stateFilter.toLowerCase());
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.entity_id.toLowerCase().includes(searchLower) ||
        (e.attributes.friendly_name as string || '').toLowerCase().includes(searchLower)
      );
    }

    // Sort by friendly_name or entity_id
    filtered.sort((a, b) => {
      const nameA = (a.attributes.friendly_name as string || a.entity_id).toLowerCase();
      const nameB = (b.attributes.friendly_name as string || b.entity_id).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return filtered.slice(0, maxItems);
  }, [data?.entities, domain, stateFilter, search, maxItems]);

  // Table visualization
  if (visualization === 'table') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="overflow-x-auto h-full">
          <table className="w-full text-sm">
            {!hideLabels && (
              <thead className="bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 text-gray-400 font-medium">Entity</th>
                  {showEntityId && <th className="text-left p-2 text-gray-400 font-medium">ID</th>}
                  <th className="text-right p-2 text-gray-400 font-medium">State</th>
                  {showLastChanged && <th className="text-right p-2 text-gray-400 font-medium">Changed</th>}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-800/30">
              {filteredEntities.map((entity) => {
                const friendlyName = (entity.attributes.friendly_name as string) || entity.entity_id;
                return (
                  <tr key={entity.entity_id} className="hover:bg-gray-800/20">
                    <td className="p-2 text-gray-200 truncate max-w-[150px]">{friendlyName}</td>
                    {showEntityId && <td className="p-2 text-gray-500 truncate max-w-[120px]">{entity.entity_id}</td>}
                    <td className={`p-2 text-right font-medium ${getStateColor(entity.state)}`}>
                      {entity.state}
                      {Boolean(entity.attributes.unit_of_measurement) ? ` ${String(entity.attributes.unit_of_measurement)}` : ''}
                    </td>
                    {showLastChanged && <td className="p-2 text-right text-gray-500">{formatRelativeTime(entity.last_changed)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredEntities.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">No entities found</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {filteredEntities.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              No entities found
            </div>
          ) : (
            filteredEntities.map((entity) => {
              const friendlyName = (entity.attributes.friendly_name as string) || entity.entity_id;
              return (
                <div key={entity.entity_id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    entity.state === 'on' || entity.state === 'home' ? 'bg-green-500' :
                    entity.state === 'unavailable' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  <span className="flex-1 truncate text-gray-200">{friendlyName}</span>
                  <span className={`flex-shrink-0 ${getStateColor(entity.state)}`}>
                    {entity.state}
                    {Boolean(entity.attributes.unit_of_measurement) ? ` ${String(entity.attributes.unit_of_measurement)}` : ''}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Cards visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="space-y-1">
        {filteredEntities.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            No entities found
          </div>
        ) : (
          filteredEntities.map((entity) => {
            const entityDomain = entity.entity_id.split('.')[0];
            const friendlyName = (entity.attributes.friendly_name as string) || entity.entity_id;

            return (
              <div
                key={entity.entity_id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Domain Icon */}
                <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                  {getDomainIcon(entityDomain)}
                </div>

                {/* Entity Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {friendlyName}
                  </p>
                  {showEntityId && !hideLabels && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {entity.entity_id}
                    </p>
                  )}
                  {showAttributes && !hideLabels && Boolean(entity.attributes.unit_of_measurement) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Unit: {String(entity.attributes.unit_of_measurement)}
                    </p>
                  )}
                </div>

                {/* State */}
                <div className="flex-shrink-0 text-right">
                  <p className={`text-sm font-medium ${getStateColor(entity.state)}`}>
                    {entity.state}
                    {Boolean(entity.attributes.unit_of_measurement) ? ` ${String(entity.attributes.unit_of_measurement)}` : ''}
                  </p>
                  {showLastChanged && !hideLabels && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(entity.last_changed)}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </BaseWidget>
  );
}
