import React from 'react';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface BaseWidgetProps {
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}

export function BaseWidget({ loading, error, children }: BaseWidgetProps) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
