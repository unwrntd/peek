/**
 * Check if a value matches a filter pattern.
 * Supports:
 * - Wildcards: * matches any characters
 *   - "pve*" matches "pve1", "pve-node", "pve"
 *   - "*01" matches "node01", "pve01", "01"
 *   - "*test*" matches "mytest", "testing", "test"
 * - Comma-separated lists: "pve1, pve2, pve3" matches any of those values
 * - Case-insensitive matching
 *
 * @param value The value to test
 * @param filter The filter pattern (can include * wildcards and comma-separated values)
 * @returns true if the value matches the filter, false otherwise
 */
export function matchesFilter(value: string, filter: string): boolean {
  // No filter means match everything
  if (!filter || filter.trim() === '') {
    return true;
  }

  // No value means no match (unless filter is empty, handled above)
  if (!value) {
    return false;
  }

  const valueLower = value.toLowerCase().trim();

  // Split by comma for list support, trim each pattern
  const patterns = filter
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length > 0);

  // No valid patterns means match everything
  if (patterns.length === 0) {
    return true;
  }

  // Check if value matches any pattern
  for (const pattern of patterns) {
    if (matchesPattern(valueLower, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a value matches a single pattern (may contain wildcards)
 */
function matchesPattern(value: string, pattern: string): boolean {
  // If no wildcard, do exact match
  if (!pattern.includes('*')) {
    return value === pattern;
  }

  // Convert wildcard pattern to regex
  // Escape all regex special characters except *
  let regexStr = '';
  for (const char of pattern) {
    if (char === '*') {
      regexStr += '.*';
    } else if ('.+^${}()|[]\\'.includes(char)) {
      regexStr += '\\' + char;
    } else {
      regexStr += char;
    }
  }

  try {
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(value);
  } catch {
    // If regex fails, fall back to simple includes check
    const simpleParts = pattern.split('*').filter(p => p.length > 0);
    return simpleParts.every(part => value.includes(part));
  }
}

/**
 * Filter an array of items by a property value using wildcard/list matching.
 *
 * @param items Array of items to filter
 * @param filter The filter pattern
 * @param getValue Function to get the value to match against from each item
 * @returns Filtered array of items
 */
export function filterByPattern<T>(
  items: T[],
  filter: string,
  getValue: (item: T) => string
): T[] {
  if (!filter || filter.trim() === '') {
    return items;
  }
  return items.filter(item => matchesFilter(getValue(item), filter));
}

/**
 * Check if any of the provided values matches the filter pattern.
 * Useful for search functionality where multiple fields should be checked.
 *
 * @param values Array of values to test (any matching value returns true)
 * @param filter The filter pattern (can include * wildcards and comma-separated values)
 * @returns true if any value matches the filter, false otherwise
 */
export function matchesAnyFilter(values: (string | undefined | null)[], filter: string): boolean {
  // No filter means match everything
  if (!filter || filter.trim() === '') {
    return true;
  }

  // Check if any value matches
  for (const value of values) {
    if (value && matchesFilter(value, filter)) {
      return true;
    }
  }

  return false;
}
