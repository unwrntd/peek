import React from 'react';
import { AuthMethodConfig, AuthMethod } from '../../../config/integrations/types';

interface AuthMethodSelectorProps {
  methods: AuthMethodConfig[];
  selectedMethod: AuthMethod;
  onMethodChange: (method: AuthMethod) => void;
}

/**
 * Toggle buttons for selecting authentication method
 * Only renders when there are multiple auth methods available
 */
export function AuthMethodSelector({
  methods,
  selectedMethod,
  onMethodChange,
}: AuthMethodSelectorProps) {
  // Don't render if there's only one method
  if (methods.length <= 1) {
    return null;
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Authentication Method
      </label>
      <div className="flex gap-2">
        {methods.map((method) => (
          <button
            key={method.method}
            type="button"
            onClick={() => onMethodChange(method.method)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
              selectedMethod === method.method
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            {method.label}
          </button>
        ))}
      </div>
    </div>
  );
}
