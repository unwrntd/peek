/**
 * Cross-Integration Helpers
 *
 * Utility functions for fetching and aggregating data from multiple integrations.
 */

import { queryAll } from '../database/queryHelpers';
import { integrationRegistry } from './registry';
import { logger } from '../services/logger';
import { IntegrationConfig } from '../types';

// Database integration record
interface IntegrationRecord {
  id: string;
  name: string;
  type: string;
  config: string;
  enabled: boolean;
}

/**
 * Parse an integration record from the database
 */
function parseIntegration(row: Record<string, unknown>): IntegrationRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    config: row.config as string,
    enabled: Boolean(row.enabled),
  };
}

/**
 * Get all enabled integrations of specified types
 */
export function getEnabledIntegrationsByType(types: string[]): {
  integrations: IntegrationRecord[];
  byType: Record<string, IntegrationRecord[]>;
} {
  const placeholders = types.map(() => '?').join(', ');
  const rows = queryAll(
    `SELECT * FROM integrations WHERE type IN (${placeholders}) AND enabled = 1`,
    types
  );

  const integrations = rows.map(parseIntegration);
  const byType: Record<string, IntegrationRecord[]> = {};

  for (const type of types) {
    byType[type] = integrations.filter(i => i.type === type);
  }

  return { integrations, byType };
}

/**
 * Fetch data from a single integration
 */
export async function fetchIntegrationData<T>(
  integration: IntegrationRecord,
  metric: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const handler = integrationRegistry.get(integration.type);
    if (!handler) {
      return { success: false, error: `Unknown integration type: ${integration.type}` };
    }

    const config = JSON.parse(integration.config) as IntegrationConfig;
    const data = await handler.getData(config, metric);

    return { success: true, data: data as T };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('cross-integration', `Failed to fetch ${metric} from ${integration.type}`, {
      integrationId: integration.id,
      error: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}

/**
 * Fetch data from multiple integrations in parallel
 */
export async function fetchMultipleIntegrationData<T>(
  integrations: IntegrationRecord[],
  metric: string
): Promise<Map<string, { success: true; data: T } | { success: false; error: string }>> {
  const results = await Promise.all(
    integrations.map(async (integration) => {
      const result = await fetchIntegrationData<T>(integration, metric);
      return { id: integration.id, type: integration.type, result };
    })
  );

  const resultMap = new Map<string, { success: true; data: T } | { success: false; error: string }>();
  for (const { id, result } of results) {
    resultMap.set(id, result);
  }

  return resultMap;
}

/**
 * Response type for cross-integration endpoints
 */
export interface CrossIntegrationResponse<T> {
  timestamp: number;
  availableIntegrations: {
    [type: string]: {
      id: string;
      name: string;
      enabled: boolean;
    }[];
  };
  missingIntegrations: string[];
  data: T;
}

/**
 * Build a cross-integration response with metadata
 */
export function buildCrossIntegrationResponse<T>(
  requiredTypes: string[],
  byType: Record<string, IntegrationRecord[]>,
  data: T
): CrossIntegrationResponse<T> {
  const availableIntegrations: CrossIntegrationResponse<T>['availableIntegrations'] = {};
  const missingIntegrations: string[] = [];

  for (const type of requiredTypes) {
    const integrations = byType[type] || [];
    availableIntegrations[type] = integrations.map(i => ({
      id: i.id,
      name: i.name,
      enabled: i.enabled,
    }));

    if (integrations.length === 0) {
      missingIntegrations.push(type);
    }
  }

  return {
    timestamp: Date.now(),
    availableIntegrations,
    missingIntegrations,
    data,
  };
}

/**
 * Helper to get the first available integration of a type
 */
export function getFirstIntegration(
  byType: Record<string, IntegrationRecord[]>,
  type: string
): IntegrationRecord | null {
  const integrations = byType[type] || [];
  return integrations.length > 0 ? integrations[0] : null;
}

/**
 * Helper to safely get numeric value from data
 */
export function getNumericValue(obj: unknown, ...path: string[]): number {
  let current: unknown = obj;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return 0;
    }
  }
  return typeof current === 'number' ? current : 0;
}

/**
 * Helper to safely get string value from data
 */
export function getStringValue(obj: unknown, ...path: string[]): string {
  let current: unknown = obj;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return '';
    }
  }
  return typeof current === 'string' ? current : '';
}

/**
 * Extract IP address from a host string (removes port if present)
 */
export function extractIpAddress(host: string): string {
  // Handle IPv6 addresses in brackets
  if (host.startsWith('[')) {
    const endBracket = host.indexOf(']');
    if (endBracket !== -1) {
      return host.substring(1, endBracket);
    }
  }
  // Handle regular IPv4 or hostname
  const colonIndex = host.lastIndexOf(':');
  if (colonIndex !== -1 && !host.includes('.') === false) {
    return host.substring(0, colonIndex);
  }
  return host;
}
