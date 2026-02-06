import { Router } from 'express';
import Parser from 'rss-parser';
import { logger } from '../services/logger';

const router = Router();

// Custom parser with additional fields
type CustomFeed = {
  title?: string;
  description?: string;
  link?: string;
  image?: { url?: string };
  lastBuildDate?: string;
};

type CustomItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  creator?: string;
  author?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  categories?: string[];
  enclosure?: { url?: string; type?: string };
  'media:content'?: { $?: { url?: string } };
  'media:thumbnail'?: { $?: { url?: string } };
  isoDate?: string;
};

const parser: Parser<CustomFeed, CustomItem> = new Parser({
  customFields: {
    feed: ['image'],
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['dc:creator', 'creator'],
      'author',
      'summary',
    ],
  },
  timeout: 10000,
});

// Cache for RSS feeds (5 minute TTL)
const feedCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch and parse an RSS feed
router.get('/fetch', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check cache
    const cached = feedCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('rss', 'Returning cached feed', { url });
      return res.json(cached.data);
    }

    logger.info('rss', 'Fetching RSS feed', { url });
    const feed = await parser.parseURL(url);

    // Extract image URL from various possible locations
    const getImageUrl = (item: CustomItem): string | undefined => {
      // Check enclosure (common for podcasts)
      if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
        return item.enclosure.url;
      }
      // Check media:content
      if (item['media:content']?.$?.url) {
        return item['media:content'].$.url;
      }
      // Check media:thumbnail
      if (item['media:thumbnail']?.$?.url) {
        return item['media:thumbnail'].$.url;
      }
      // Try to extract first image from content
      const content = item.content || item.summary || '';
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        return imgMatch[1];
      }
      return undefined;
    };

    // Transform feed data
    const result = {
      title: feed.title,
      description: feed.description,
      link: feed.link,
      image: feed.image?.url,
      lastBuildDate: feed.lastBuildDate,
      items: feed.items.map((item) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate || item.isoDate,
        isoDate: item.isoDate,
        author: item.creator || item.author,
        description: item.contentSnippet || item.summary,
        content: item.content,
        categories: item.categories || [],
        image: getImageUrl(item),
      })),
    };

    // Cache the result
    feedCache.set(url, { data: result, timestamp: Date.now() });

    res.json(result);
  } catch (error) {
    logger.error('rss', 'Failed to fetch RSS feed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch RSS feed', details: String(error) });
  }
});

// Clear cache for a specific URL or all
router.post('/clear-cache', (req, res) => {
  const { url } = req.body;

  if (url) {
    feedCache.delete(url);
    logger.info('rss', 'Cleared cache for URL', { url });
  } else {
    feedCache.clear();
    logger.info('rss', 'Cleared all RSS cache');
  }

  res.json({ success: true });
});

export default router;
