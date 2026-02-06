import React from 'react';
import { StaticWidgetConfig } from '../../config/integrations';
import { crossIntegrationRequirements, getIntegrationDisplayName } from '../../config/integrations';

interface WidgetCardProps {
  config: StaticWidgetConfig;
  category: 'basic' | 'cross-integration';
  onClick?: () => void;
}

export function WidgetCard({ config, category, onClick }: WidgetCardProps) {
  const requirements = crossIntegrationRequirements[config.type];
  const isCrossIntegration = category === 'cross-integration';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {config.name}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isCrossIntegration
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        }`}>
          {isCrossIntegration ? 'Multi-Source' : 'Basic Widget'}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
        {config.description}
      </p>

      {/* Integration requirements for cross-integration widgets */}
      {requirements && (
        <div className="flex flex-wrap gap-1 mb-2">
          {requirements.required.slice(0, 2).map((int) => (
            <span
              key={int}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
            >
              {getIntegrationDisplayName(int)}
            </span>
          ))}
          {requirements.required.length > 2 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
              +{requirements.required.length - 2} req
            </span>
          )}
          {requirements.optional.slice(0, 2).map((int) => (
            <span
              key={int}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
            >
              {getIntegrationDisplayName(int)}
            </span>
          ))}
          {requirements.optional.length > 2 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
              +{requirements.optional.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-500">
          {isCrossIntegration ? 'Cross-Integration' : 'Basic Widget'}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {config.defaultSize.w}x{config.defaultSize.h}
        </span>
      </div>
    </button>
  );
}
