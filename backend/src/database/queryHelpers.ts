/**
 * Shared database query helpers
 * Consolidates duplicate queryOne/queryAll functions from 8 route files
 */

import { getDatabase } from './db';

/**
 * Execute a SQL query and return the first row as an object, or null if no results
 */
export function queryOne(sql: string, params: (string | number | null)[] = []): Record<string, unknown> | null {
  const db = getDatabase();
  const results = db.exec(sql, params);
  if (results.length === 0 || results[0].values.length === 0) {
    return null;
  }
  const columns = results[0].columns;
  const row = results[0].values[0];
  const obj: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    obj[col] = row[i];
  });
  return obj;
}

/**
 * Execute a SQL query and return all rows as an array of objects
 */
export function queryAll(sql: string, params: (string | number | null)[] = []): Record<string, unknown>[] {
  const db = getDatabase();
  const results = db.exec(sql, params);
  if (results.length === 0) {
    return [];
  }
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE) and return the number of changes
 */
export function execute(sql: string, params: (string | number | null)[] = []): number {
  const db = getDatabase();
  db.run(sql, params);
  return db.getRowsModified();
}
