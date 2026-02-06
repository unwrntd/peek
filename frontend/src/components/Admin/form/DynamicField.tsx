import React from 'react';
import { DynamicFieldProps } from './types';

/**
 * Generic field renderer that handles text, password, and number inputs
 * based on AuthFieldConfig from integration configs
 */
export function DynamicField({
  fieldKey,
  label,
  type,
  value,
  onChange,
  required = false,
  placeholder,
  helpText,
  colSpan = 1,
  disabled = false,
}: DynamicFieldProps) {
  const inputClasses =
    'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue: string | number | boolean = e.target.value;
    if (type === 'number') {
      newValue = e.target.value === '' ? '' : Number(e.target.value);
    }
    onChange(fieldKey, newValue);
  };

  return (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={handleChange}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClasses}
      />
      {helpText && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helpText}</p>
      )}
    </div>
  );
}
