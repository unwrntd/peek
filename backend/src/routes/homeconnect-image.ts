import { Router, Request, Response } from 'express';
import { queryOne } from '../database/queryHelpers';
import { logger } from '../services/logger';
import { integrationRegistry } from '../integrations/registry';
import { HomeConnectIntegration } from '../integrations/homeconnect';
import { IntegrationConfig } from '../types';

const router = Router();

// In-memory cache for images
interface ImageCacheEntry {
  imageBase64: string;
  contentType: string;
  timestamp: number;
}
const imageCache = new Map<string, ImageCacheEntry>();
const IMAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up stale image cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of imageCache.entries()) {
    if (now - entry.timestamp > IMAGE_CACHE_TTL) {
      imageCache.delete(key);
    }
  }
}, 60000); // Clean every minute

// Get a specific image from a Home Connect appliance
router.get('/:integrationId/:haId/:imageKey', async (req: Request, res: Response) => {
  try {
    const { integrationId, haId, imageKey } = req.params;
    const cacheKey = `${integrationId}:${haId}:${imageKey}`;

    // Check cache first
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_TTL) {
      logger.debug('homeconnect-image', 'Serving image from cache', { haId, imageKey });
      const buffer = Buffer.from(cached.imageBase64, 'base64');
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', 'public, max-age=300'); // Cache in browser for 5 min
      res.send(buffer);
      return;
    }

    // Get integration config from database
    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [integrationId]);

    if (!row) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    if (row.type !== 'homeconnect') {
      res.status(400).json({ error: 'Invalid integration type' });
      return;
    }

    const config = JSON.parse(row.config as string) as IntegrationConfig;
    const integration = integrationRegistry.get('homeconnect') as HomeConnectIntegration;

    if (!integration) {
      res.status(500).json({ error: 'Home Connect integration not available' });
      return;
    }

    // Fetch the image
    const { imageBase64, contentType } = await integration.getImage(config, haId, imageKey);

    // Cache the result
    imageCache.set(cacheKey, {
      imageBase64,
      contentType,
      timestamp: Date.now(),
    });

    // Send the image
    const buffer = Buffer.from(imageBase64, 'base64');
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buffer);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('homeconnect-image', 'Failed to get image', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

export default router;
