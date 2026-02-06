import { Router, Request, Response } from 'express';
import { dataCache, CACHE_TTL, CacheEntry } from './data';
import { logger } from '../services/logger';

const router = Router();

// Get cache statistics and entries
router.get('/cache', (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    const entries = Array.from(dataCache.entries()).map(([key, entry]) => {
      const [integrationId, metric] = key.split(':');
      return {
        key,
        integrationId,
        metric,
        timestamp: entry.timestamp,
        ttlRemaining: Math.max(0, CACHE_TTL - (now - entry.timestamp)),
        sizeBytes: JSON.stringify(entry.data).length,
      };
    });

    const stats = {
      entryCount: entries.length,
      estimatedSizeBytes: entries.reduce((sum, e) => sum + e.sizeBytes, 0),
      entries: entries.sort((a, b) => b.timestamp - a.timestamp), // Most recent first
    };

    res.json(stats);
  } catch (error) {
    logger.error('dev', 'Failed to get cache stats', { error });
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

// Clear a specific cache entry
router.delete('/cache/:key', (req: Request, res: Response) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const existed = dataCache.has(key);
    dataCache.delete(key);

    logger.info('dev', `Cache entry ${existed ? 'cleared' : 'not found'}`, { key });
    res.status(204).send();
  } catch (error) {
    logger.error('dev', 'Failed to clear cache entry', { error });
    res.status(500).json({ error: 'Failed to clear cache entry' });
  }
});

// Clear all cache entries
router.delete('/cache', (_req: Request, res: Response) => {
  try {
    const count = dataCache.size;
    dataCache.clear();

    logger.info('dev', 'All cache entries cleared', { count });
    res.status(204).send();
  } catch (error) {
    logger.error('dev', 'Failed to clear cache', { error });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;
