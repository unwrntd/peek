import { Router } from 'express';
import axios from 'axios';
import { getDatabase } from '../database/db';
import { logger } from '../services/logger';

const router = Router();

// In-memory cache for location search
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry>();
const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key: string): unknown | null {
  const entry = searchCache.get(key);
  if (entry && Date.now() - entry.timestamp < SEARCH_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  searchCache.set(key, { data, timestamp: Date.now() });
}

// Get API key from an integration config
function getApiKeyFromIntegration(integrationId: string): string | null {
  try {
    const db = getDatabase();
    const results = db.exec(
      `SELECT config FROM integrations WHERE id = ? AND type = 'weather'`,
      [integrationId]
    );
    if (results.length > 0 && results[0].values.length > 0) {
      const config = JSON.parse(results[0].values[0][0] as string);
      return config.apiKey || null;
    }
    return null;
  } catch (error) {
    logger.error('weather', 'Failed to get API key from integration', { error: String(error) });
    return null;
  }
}

// Get any weather integration's API key (for location search)
function getAnyWeatherApiKey(): string | null {
  try {
    const db = getDatabase();
    const results = db.exec(
      `SELECT config FROM integrations WHERE type = 'weather' AND enabled = 1 LIMIT 1`
    );
    if (results.length > 0 && results[0].values.length > 0) {
      const config = JSON.parse(results[0].values[0][0] as string);
      return config.apiKey || null;
    }
    return null;
  } catch (error) {
    logger.error('weather', 'Failed to get weather API key', { error: String(error) });
    return null;
  }
}

// Search for locations (used by widget configuration)
router.get('/search', async (req, res) => {
  try {
    const { q, integrationId } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters' });
      return;
    }

    // Get API key from specific integration or any weather integration
    const apiKey = integrationId
      ? getApiKeyFromIntegration(integrationId as string)
      : getAnyWeatherApiKey();

    if (!apiKey) {
      res.status(400).json({ error: 'No weather integration configured. Add a Weather integration first.' });
      return;
    }

    const cacheKey = `search:${q.toLowerCase().trim()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      logger.debug('weather', 'Serving location search from cache', { q });
      res.json(cached);
      return;
    }

    logger.debug('weather', 'Searching locations via API', { q });

    const response = await axios.get(
      'https://api.openweathermap.org/geo/1.0/direct',
      {
        params: {
          q: q.trim(),
          limit: 5,
          appid: apiKey,
        },
        timeout: 10000,
      }
    );

    // Transform response to simpler format
    const locations = response.data.map((loc: {
      name: string;
      state?: string;
      country: string;
      lat: number;
      lon: number;
    }) => ({
      name: loc.name,
      state: loc.state,
      country: loc.country,
      lat: loc.lat,
      lon: loc.lon,
      displayName: loc.state
        ? `${loc.name}, ${loc.state}, ${loc.country}`
        : `${loc.name}, ${loc.country}`,
    }));

    setCache(cacheKey, locations);
    res.json(locations);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('weather', 'API error searching locations', {
        status: error.response?.status,
        message: error.message,
      });
      if (error.response?.status === 401) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }
    }
    logger.error('weather', 'Failed to search locations', { error: String(error) });
    res.status(500).json({ error: 'Failed to search locations' });
  }
});

export default router;
