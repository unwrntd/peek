import React from 'react';
import { IntegrationConfig, getCategoryConfig } from '../../config/integrations';

interface IntegrationCardProps {
  config: IntegrationConfig;
  instanceCount?: number;
  onClick?: () => void;
}

export function IntegrationCard({ config, instanceCount = 0, onClick }: IntegrationCardProps) {
  const category = getCategoryConfig(config.category);
  const widgetCount = config.widgets.length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {config.displayName}
        </h3>
        {instanceCount > 0 && (
          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
            {instanceCount} deployed
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
        {config.description}
      </p>

      <div className="flex items-center justify-between">
        {category && (
          <span className="text-xs text-gray-500 dark:text-gray-500">
            {category.name}
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {widgetCount} widget{widgetCount !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  );
}
