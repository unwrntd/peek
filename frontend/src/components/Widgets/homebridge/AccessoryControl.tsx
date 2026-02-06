import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { HomebridgeAccessory } from '../../../types';

interface AccessoriesData {
  accessories: HomebridgeAccessory[];
  insecureMode: boolean;
}

interface AccessoryControlProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function AccessoryControl({ integrationId, config, widgetId }: AccessoryControlProps) {
  const [isToggling, setIsToggling] = useState(false);

  const { data, loading, error, refetch } = useWidgetData<AccessoriesData>({
    integrationId,
    metric: 'accessories',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';
  const hideLabels = (config.hideLabels as boolean) || false;
  const selectedAccessoryName = config.selectedAccessory as string | undefined;
  const showName = config.showName !== false;
  const showState = config.showState !== false;
  const showIcon = config.showIcon !== false;

  // Find the selected accessory or use the first controllable one
  const controllableTypes = ['Switch', 'Lightbulb', 'Outlet', 'Fan'];
  const accessory = data?.accessories?.find(a => {
    if (selectedAccessoryName) {
      const name = a.serviceName || a.accessoryInformation?.Name || '';
      return name.toLowerCase().includes(selectedAccessoryName.toLowerCase());
    }
    return controllableTypes.includes(a.type);
  }) || data?.accessories?.find(a => controllableTypes.includes(a.type));

  const isOn = accessory?.values?.On === true || accessory?.values?.Active === true;

  const handleToggle = useCallback(async () => {
    if (!accessory || isToggling) return;

    setIsToggling(true);
    try {
      const response = await fetch(`/api/data/${integrationId}/accessory-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uniqueId: accessory.uniqueId,
          characteristicType: 'On',
          value: !isOn,
        }),
      });

      if (response.ok) {
        // Refetch data after a short delay
        setTimeout(() => refetch(), 500);
      }
    } catch (err) {
      console.error('Failed to toggle accessory:', err);
    } finally {
      setIsToggling(false);
    }
  }, [accessory, isOn, isToggling, integrationId, refetch]);

  // Insecure mode not enabled
  if (data && !data.insecureMode) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs text-center">Insecure mode required</span>
        </div>
      </BaseWidget>
    );
  }

  // No controllable accessory found
  if (!accessory) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span className="text-xs text-center">
            {selectedAccessoryName ? 'Accessory not found' : 'No controllable accessory'}
          </span>
        </div>
      </BaseWidget>
    );
  }

  const accessoryName = accessory.serviceName || accessory.accessoryInformation?.Name || 'Accessory';

  // Toggle visualization - just the button
  if (visualization === 'toggle') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-center h-full">
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isOn
                ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-lg shadow-yellow-400/30'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400'
            } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>
        </div>
      </BaseWidget>
    );
  }

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex items-center justify-between h-full p-2">
          <div className="flex items-center gap-2">
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
            {showName && !hideLabels && (
              <span className="text-sm text-gray-900 dark:text-white truncate">{accessoryName}</span>
            )}
          </div>
          {showState && (
            <span className={`text-sm font-medium ${isOn ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`}>
              {isOn ? 'On' : 'Off'}
            </span>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Default: Card visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col items-center justify-center h-full gap-3">
        {/* Icon */}
        {showIcon && (
          <div className={`p-4 rounded-full transition-colors ${
            isOn
              ? 'bg-yellow-100 dark:bg-yellow-900/30'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            <svg
              className={`w-8 h-8 transition-colors ${
                isOn
                  ? 'text-yellow-500 dark:text-yellow-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
        )}

        {/* Name */}
        {showName && (
          <p className="text-sm font-medium text-gray-900 dark:text-white text-center truncate max-w-full px-2">
            {accessoryName}
          </p>
        )}

        {/* State */}
        {showState && (
          <p className={`text-xs ${
            isOn ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {isOn ? 'On' : 'Off'}
          </p>
        )}

        {/* Toggle Button */}
        <button
          onClick={handleToggle}
          disabled={isToggling}
          className={`px-6 py-2 rounded-full font-medium text-sm transition-all ${
            isToggling
              ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-wait'
              : isOn
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          {isToggling ? 'Updating...' : isOn ? 'Turn Off' : 'Turn On'}
        </button>
      </div>
    </BaseWidget>
  );
}
