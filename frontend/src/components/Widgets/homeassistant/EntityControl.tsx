import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import apiClient from '../../../api/client';

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

interface EntityControlProps {
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

  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function EntityControl({ integrationId, config, widgetId }: EntityControlProps) {
  const { data, loading, error, refetch } = useWidgetData<EntitiesData>({
    integrationId,
    metric: 'entities',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';
  const hideLabels = (config.hideLabels as boolean) || false;
  const entityId = (config.entityId as string) || '';
  const showName = config.showName !== false;
  const showState = config.showState !== false;
  const showLastChanged = config.showLastChanged !== false;

  const [isToggling, setIsToggling] = useState(false);

  const entity = data?.entities?.find(e => e.entity_id === entityId);
  const domain = entityId.split('.')[0];
  const friendlyName = entity?.attributes.friendly_name as string || entityId;

  // Check if entity supports toggle
  const supportsToggle = ['light', 'switch', 'input_boolean', 'fan', 'automation', 'script'].includes(domain);
  const isOn = entity?.state === 'on';

  const handleToggle = useCallback(async () => {
    if (!entity || isToggling) return;

    setIsToggling(true);
    try {
      const service = isOn ? 'turn_off' : 'turn_on';
      await apiClient.post(`/api/integrations/${integrationId}/action`, {
        action: 'callService',
        params: {
          domain,
          service,
          data: { entity_id: entityId },
        },
      });
      // Refetch to get updated state
      setTimeout(() => refetch(), 500);
    } catch (err) {
      console.error('Failed to toggle entity:', err);
    } finally {
      setIsToggling(false);
    }
  }, [entity, isOn, isToggling, integrationId, domain, entityId, refetch]);

  if (!entityId) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
          <span>Configure entity ID in widget settings</span>
        </div>
      </BaseWidget>
    );
  }

  // Toggle visualization - just the button
  if (visualization === 'toggle') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          {entity && supportsToggle ? (
            <button
              onClick={handleToggle}
              disabled={isToggling}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isOn
                  ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-lg shadow-yellow-400/30'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400'
              } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
            >
              {domain === 'light' ? (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </button>
          ) : entity ? (
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {entity.state}
            </div>
          ) : (
            <span className="text-gray-500 text-sm">Not found</span>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-between h-full p-2">
          {entity ? (
            <>
              <div className="flex items-center gap-2">
                {supportsToggle && (
                  <button
                    onClick={handleToggle}
                    disabled={isToggling}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isOn
                        ? 'bg-yellow-400 text-yellow-900'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    } ${isToggling ? 'opacity-50' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                )}
                {showName && !hideLabels && (
                  <span className="text-sm text-gray-900 dark:text-white truncate">{friendlyName}</span>
                )}
              </div>
              {showState && (
                <span className={`text-sm font-medium ${isOn ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`}>
                  {entity.state}
                  {Boolean(entity.attributes.unit_of_measurement) ? ` ${String(entity.attributes.unit_of_measurement)}` : ''}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-500 text-sm">Entity not found</span>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Card visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col items-center justify-center h-full space-y-3">
        {entity ? (
          <>
            {/* Toggle Button */}
            {supportsToggle && (
              <button
                onClick={handleToggle}
                disabled={isToggling}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isOn
                    ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-lg shadow-yellow-400/30'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400'
                } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
              >
                {domain === 'light' ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </button>
            )}

            {/* Non-toggle state display */}
            {!supportsToggle && showState && (
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {entity.state}
                {Boolean(entity.attributes.unit_of_measurement) && (
                  <span className="text-lg text-gray-500 dark:text-gray-400 ml-1">
                    {String(entity.attributes.unit_of_measurement)}
                  </span>
                )}
              </div>
            )}

            {/* Entity Name */}
            {showName && !hideLabels && (
              <p className="text-sm font-medium text-gray-900 dark:text-white text-center">
                {friendlyName}
              </p>
            )}

            {/* State text for toggle entities */}
            {supportsToggle && showState && !hideLabels && (
              <p className={`text-sm font-medium ${
                isOn ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {isOn ? 'On' : 'Off'}
              </p>
            )}

            {/* Last Changed */}
            {showLastChanged && !hideLabels && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Changed {formatRelativeTime(entity.last_changed)}
              </p>
            )}
          </>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
            <p>Entity not found</p>
            <p className="text-xs mt-1">{entityId}</p>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
