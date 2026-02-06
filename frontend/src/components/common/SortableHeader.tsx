import React from 'react';
import { SortDirection } from '../../hooks/useSorting';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  direction: SortDirection;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
  compact?: boolean;
}

export function SortableHeader({
  label,
  sortKey,
  direction,
  onSort,
  className = '',
  align = 'left',
  compact = false,
}: SortableHeaderProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const paddingClass = compact ? 'pb-1' : 'pb-2';

  return (
    <th
      className={`${paddingClass} font-medium ${alignClass} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${
          direction ? 'text-gray-700 dark:text-gray-200' : ''
        }`}
      >
        <span>{label}</span>
        <SortIcon direction={direction} />
      </button>
    </th>
  );
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return (
    <span className="inline-flex flex-col -space-y-1">
      <svg
        className={`w-3 h-3 transition-colors ${
          direction === 'asc' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300 dark:text-gray-600'
        }`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M10 6l-5 5h10l-5-5z" />
      </svg>
      <svg
        className={`w-3 h-3 transition-colors ${
          direction === 'desc' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300 dark:text-gray-600'
        }`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M10 14l5-5H5l5 5z" />
      </svg>
    </span>
  );
}
