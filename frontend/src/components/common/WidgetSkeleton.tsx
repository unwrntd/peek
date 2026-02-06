import React from 'react';

interface WidgetSkeletonProps {
  type?: 'default' | 'list' | 'chart' | 'stats' | 'image';
  className?: string;
}

/**
 * Loading skeleton for widgets
 * Shows animated placeholder content while widget data loads
 */
export function WidgetSkeleton({ type = 'default', className = '' }: WidgetSkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

  switch (type) {
    case 'list':
      return (
        <div className={`p-4 space-y-3 ${className}`} role="status" aria-label="Loading content">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`${baseClasses} h-8 w-8 rounded-full`} />
              <div className="flex-1 space-y-2">
                <div className={`${baseClasses} h-4 w-3/4`} />
                <div className={`${baseClasses} h-3 w-1/2`} />
              </div>
            </div>
          ))}
        </div>
      );

    case 'chart':
      return (
        <div className={`p-4 ${className}`} role="status" aria-label="Loading chart">
          <div className={`${baseClasses} h-4 w-32 mb-4`} />
          <div className="flex items-end justify-between gap-2 h-32">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className={`${baseClasses} flex-1`}
                style={{ height: `${30 + Math.random() * 70}%` }}
              />
            ))}
          </div>
        </div>
      );

    case 'stats':
      return (
        <div className={`p-4 ${className}`} role="status" aria-label="Loading statistics">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className={`${baseClasses} h-3 w-20`} />
                <div className={`${baseClasses} h-8 w-16`} />
              </div>
            ))}
          </div>
        </div>
      );

    case 'image':
      return (
        <div className={`p-4 ${className}`} role="status" aria-label="Loading image">
          <div className={`${baseClasses} h-48 w-full flex items-center justify-center`}>
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      );

    default:
      return (
        <div className={`p-4 space-y-4 ${className}`} role="status" aria-label="Loading content">
          <div className={`${baseClasses} h-4 w-3/4`} />
          <div className={`${baseClasses} h-4 w-1/2`} />
          <div className={`${baseClasses} h-20 w-full`} />
          <div className="flex gap-2">
            <div className={`${baseClasses} h-8 w-20`} />
            <div className={`${baseClasses} h-8 w-20`} />
          </div>
        </div>
      );
  }
}

/**
 * Inline loading indicator for refreshing content
 */
export function RefreshIndicator() {
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400" role="status" aria-label="Refreshing">
      <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>Updating</span>
    </div>
  );
}
