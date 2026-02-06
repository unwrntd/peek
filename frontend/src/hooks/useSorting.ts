import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T extends string> {
  key: T | null;
  direction: SortDirection;
}

export interface UseSortingResult<T extends string, D> {
  sortConfig: SortConfig<T>;
  sortedData: D[];
  requestSort: (key: T) => void;
  getSortDirection: (key: T) => SortDirection;
}

export interface UseSortingOptions<T extends string> {
  /** Callback when sort changes - use this to persist to widget config */
  onSortChange?: (key: T | null, direction: SortDirection) => void;
  /** If true, the defaultKey/defaultDirection are treated as controlled values from config */
  controlled?: boolean;
}

type SortableValue = string | number | boolean | null | undefined;
type ValueGetter<D, T extends string> = (item: D, key: T) => SortableValue;

export function useSorting<T extends string, D>(
  data: D[],
  defaultKey: T | null = null,
  defaultDirection: SortDirection = 'asc',
  getValue?: ValueGetter<D, T>,
  options?: UseSortingOptions<T>
): UseSortingResult<T, D> {
  const { onSortChange, controlled } = options || {};

  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultKey,
    direction: defaultDirection,
  });

  // Track if this is the initial mount to avoid triggering onSortChange
  const isInitialMount = useRef(true);

  // Sync with controlled values from config when they change
  useEffect(() => {
    if (controlled) {
      setSortConfig({
        key: defaultKey,
        direction: defaultDirection,
      });
    }
  }, [controlled, defaultKey, defaultDirection]);

  // Reset initial mount flag after first render
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  const requestSort = useCallback((key: T) => {
    setSortConfig((prevConfig) => {
      let newKey: T | null;
      let newDirection: SortDirection;

      if (prevConfig.key === key) {
        // Cycle through: asc -> desc -> null -> asc
        if (prevConfig.direction === 'asc') {
          newKey = key;
          newDirection = 'desc';
        } else if (prevConfig.direction === 'desc') {
          newKey = null;
          newDirection = null;
        } else {
          newKey = key;
          newDirection = 'asc';
        }
      } else {
        newKey = key;
        newDirection = 'asc';
      }

      // Call the onChange callback if provided (for persistence to config)
      if (onSortChange && !isInitialMount.current) {
        onSortChange(newKey, newDirection);
      }

      return { key: newKey, direction: newDirection };
    });
  }, [onSortChange]);

  const getSortDirection = useCallback(
    (key: T): SortDirection => {
      if (sortConfig.key === key) {
        return sortConfig.direction;
      }
      return null;
    },
    [sortConfig]
  );

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data;
    }

    return [...data].sort((a, b) => {
      let aValue: SortableValue;
      let bValue: SortableValue;

      if (getValue) {
        aValue = getValue(a, sortConfig.key as T);
        bValue = getValue(b, sortConfig.key as T);
      } else {
        // Default: try to access property directly
        aValue = (a as Record<string, SortableValue>)[sortConfig.key as string];
        bValue = (b as Record<string, SortableValue>)[sortConfig.key as string];
      }

      // Handle null/undefined values - push them to the end
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Compare based on type
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        comparison = aValue === bValue ? 0 : aValue ? -1 : 1;
      } else {
        // Fallback: convert to string and compare
        comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
      }

      return sortConfig.direction === 'desc' ? -comparison : comparison;
    });
  }, [data, sortConfig, getValue]);

  return {
    sortConfig,
    sortedData,
    requestSort,
    getSortDirection,
  };
}
