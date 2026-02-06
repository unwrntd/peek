import { Router, Request, Response } from 'express';
import { queryOne } from '../database/queryHelpers';
import { logger } from '../services/logger';
import { integrationRegistry } from '../integrations/registry';
import { IntegrationConfig, IntegrationData } from '../types';
import { sanitizeError } from '../utils/security';

const router = Router();

// In-memory cache for integration data with LRU eviction
export interface CacheEntry {
  data: IntegrationData;
  timestamp: number;
  lastAccess: number;
}
export const dataCache = new Map<string, CacheEntry>();
export const CACHE_TTL = 60000; // 60 seconds (increased from 15s for better performance)
const MAX_CACHE_SIZE = 100; // Maximum number of cached entries

// LRU eviction: remove least recently accessed entries when cache is full
function evictLRUEntries(): void {
  if (dataCache.size <= MAX_CACHE_SIZE) return;

  // Convert to array and sort by lastAccess (oldest first)
  const entries = Array.from(dataCache.entries())
    .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

  // Remove oldest entries until we're under the limit
  const toRemove = entries.slice(0, dataCache.size - MAX_CACHE_SIZE + 10); // Remove 10 extra for headroom
  for (const [key] of toRemove) {
    dataCache.delete(key);
  }
}

// Clean up stale cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of dataCache.entries()) {
    // Remove entries older than 2x TTL
    if (now - entry.timestamp > CACHE_TTL * 2) {
      dataCache.delete(key);
    }
  }
  // Also enforce size limit
  evictLRUEntries();
}, 30000); // Clean every 30 seconds

// Get all available metrics for an integration type
// NOTE: These routes MUST be before /:integrationId/:metric to avoid matching as integrationId
router.get('/metrics/:type', (req: Request, res: Response) => {
  try {
    const handler = integrationRegistry.get(req.params.type);

    if (!handler) {
      res.status(404).json({ error: `Unknown integration type: ${req.params.type}` });
      return;
    }

    res.json(handler.getAvailableMetrics());
  } catch (error) {
    logger.error('data', 'Failed to fetch metrics', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get all API capabilities for an integration type (full API surface)
router.get('/capabilities/:type', (req: Request, res: Response) => {
  try {
    const handler = integrationRegistry.get(req.params.type);

    if (!handler) {
      res.status(404).json({ error: `Unknown integration type: ${req.params.type}` });
      return;
    }

    res.json(handler.getApiCapabilities());
  } catch (error) {
    logger.error('data', 'Failed to fetch capabilities', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch capabilities' });
  }
});

// Get data for a specific integration and metric
router.get('/:integrationId/:metric', async (req: Request, res: Response) => {
  try {
    const { integrationId, metric } = req.params;
    const cacheKey = `${integrationId}:${metric}`;

    // Check cache first
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Update last access time for LRU tracking
      cached.lastAccess = Date.now();
      logger.debug('data', 'Serving from cache', { integrationId, metric });
      res.json(cached.data);
      return;
    }

    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [integrationId]);

    if (!row) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    if (!row.enabled) {
      res.status(400).json({ error: 'Integration is disabled' });
      return;
    }

    const config = JSON.parse(row.config as string) as IntegrationConfig;
    const handler = integrationRegistry.get(row.type as string);

    if (!handler) {
      res.status(400).json({ error: `Unknown integration type: ${row.type}` });
      return;
    }

    const data = await handler.getData(config, metric);

    // Store in cache with LRU tracking
    const now = Date.now();
    dataCache.set(cacheKey, { data, timestamp: now, lastAccess: now });

    // Evict old entries if cache is too large
    evictLRUEntries();

    res.json(data);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const sanitizedMsg = sanitizeError(errorMsg);

    logger.error('data', `Failed to fetch data`, {
      error: sanitizedMsg,
      integrationId: req.params.integrationId,
      metric: req.params.metric,
    });

    // Return generic error to client, don't expose internal details
    res.status(500).json({ error: 'Failed to fetch integration data' });
  }
});

export default router;
