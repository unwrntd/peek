import { Router } from 'express';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { logger } from '../services/logger';

const router = Router();

// Per-service cache for status data (5 minute TTL)
// Using per-service caching so adding/removing services doesn't invalidate everything
const serviceCache = new Map<string, { data: unknown; timestamp: number }>();
const SERVICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getServiceCached(url: string): unknown | null {
  const entry = serviceCache.get(url);
  if (entry && Date.now() - entry.timestamp < SERVICE_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setServiceCache(url: string, data: unknown): void {
  serviceCache.set(url, { data, timestamp: Date.now() });
}

// Legacy cache for other endpoints (details, incidents, maintenance)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Special cloud provider URLs that need custom handling
const CLOUD_PROVIDERS: Record<string, { type: 'aws' | 'gcp' | 'azure'; name: string }> = {
  'https://status.aws.amazon.com': { type: 'aws', name: 'AWS' },
  'https://health.aws.amazon.com': { type: 'aws', name: 'AWS' },
  'https://status.cloud.google.com': { type: 'gcp', name: 'Google Cloud' },
  'https://azure.status.microsoft': { type: 'azure', name: 'Azure' },
  'https://status.azure.com': { type: 'azure', name: 'Azure' },
};

// Fetch AWS status from RSS feed
async function fetchAwsStatus(url: string, name?: string): Promise<{
  name: string;
  url: string;
  indicator: string;
  description: string;
  updatedAt?: string;
  latestIncident?: string;
}> {
  const rssUrl = 'https://status.aws.amazon.com/rss/all.rss';
  const response = await axios.get(rssUrl, {
    timeout: 5000,
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'DashStatusMonitor/1.0',
    },
  });

  const parsed = await parseStringPromise(response.data);
  const channel = parsed?.rss?.channel?.[0];
  const items = channel?.item || [];
  const lastBuildDate = channel?.lastBuildDate?.[0];

  // If there are items, there are active issues
  if (items.length > 0) {
    const latestItem = items[0];
    const title = latestItem?.title?.[0] || 'Service Issue';
    // Determine severity from title
    let indicator = 'minor';
    const titleLower = title.toLowerCase();
    if (titleLower.includes('resolved') || titleLower.includes('recovered')) {
      indicator = 'none';
    } else if (titleLower.includes('major') || titleLower.includes('outage')) {
      indicator = 'major';
    } else if (titleLower.includes('critical') || titleLower.includes('severe')) {
      indicator = 'critical';
    }

    return {
      name: name || 'AWS',
      url,
      indicator,
      description: indicator === 'none' ? 'All Systems Operational' : 'Service Issues Reported',
      updatedAt: latestItem?.pubDate?.[0] || lastBuildDate,
      latestIncident: title,
    };
  }

  // No items means all services are operational
  // Don't return updatedAt since lastBuildDate is just when the feed was regenerated, not an actual event
  return {
    name: name || 'AWS',
    url,
    indicator: 'none',
    description: 'All Systems Operational',
  };
}

// Fetch GCP status from incidents.json
async function fetchGcpStatus(url: string, name?: string): Promise<{
  name: string;
  url: string;
  indicator: string;
  description: string;
  updatedAt?: string;
  latestIncident?: string;
}> {
  const incidentsUrl = 'https://status.cloud.google.com/incidents.json';
  const response = await axios.get(incidentsUrl, {
    timeout: 5000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'DashStatusMonitor/1.0',
    },
  });

  const incidents = response.data || [];

  // Find active incidents (no end date or end date in future)
  const now = new Date();
  const activeIncidents = incidents.filter((incident: { end?: string; begin: string }) => {
    if (!incident.end) return true;
    return new Date(incident.end) > now;
  });

  // Find recent incidents (within last 24 hours)
  const recentIncidents = incidents.filter((incident: { modified: string }) => {
    const modified = new Date(incident.modified);
    const hoursDiff = (now.getTime() - modified.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  });

  if (activeIncidents.length > 0) {
    const latestIncident = activeIncidents[0];
    // GCP incidents have severity in the external_desc or we can infer from text
    let indicator = 'minor';
    const desc = (latestIncident.external_desc || '').toLowerCase();
    if (desc.includes('outage') || desc.includes('unavailable')) {
      indicator = 'major';
    }

    return {
      name: name || 'Google Cloud',
      url,
      indicator,
      description: 'Active Incident',
      updatedAt: latestIncident.modified,
      latestIncident: latestIncident.external_desc,
    };
  }

  // Check for recently resolved incidents
  if (recentIncidents.length > 0) {
    const latestIncident = recentIncidents[0];
    return {
      name: name || 'Google Cloud',
      url,
      indicator: 'none',
      description: 'All Systems Operational',
      updatedAt: latestIncident.modified,
      latestIncident: `[Resolved] ${latestIncident.external_desc}`,
    };
  }

  // No recent incidents - don't return old incident dates as "last event"
  return {
    name: name || 'Google Cloud',
    url,
    indicator: 'none',
    description: 'All Systems Operational',
  };
}

// Fetch Azure status from RSS feed
async function fetchAzureStatus(url: string, name?: string): Promise<{
  name: string;
  url: string;
  indicator: string;
  description: string;
  updatedAt?: string;
  latestIncident?: string;
}> {
  const rssUrl = 'https://azure.status.microsoft/en-us/status/feed';
  const response = await axios.get(rssUrl, {
    timeout: 5000,
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'DashStatusMonitor/1.0',
    },
  });

  const parsed = await parseStringPromise(response.data);
  const channel = parsed?.rss?.channel?.[0];
  const items = channel?.item || [];
  const lastBuildDate = channel?.lastBuildDate?.[0];

  // If there are items, there are active issues
  if (items.length > 0) {
    const latestItem = items[0];
    const title = latestItem?.title?.[0] || 'Service Issue';
    // Determine severity from title
    let indicator = 'minor';
    const titleLower = title.toLowerCase();
    if (titleLower.includes('resolved') || titleLower.includes('mitigated')) {
      indicator = 'none';
    } else if (titleLower.includes('major') || titleLower.includes('outage')) {
      indicator = 'major';
    } else if (titleLower.includes('critical') || titleLower.includes('widespread')) {
      indicator = 'critical';
    }

    return {
      name: name || 'Azure',
      url,
      indicator,
      description: indicator === 'none' ? 'All Systems Operational' : 'Service Issues Reported',
      updatedAt: latestItem?.pubDate?.[0] || lastBuildDate,
      latestIncident: title,
    };
  }

  // No items means all services are operational
  // Don't return updatedAt since lastBuildDate is just when the feed was regenerated, not an actual event
  return {
    name: name || 'Azure',
    url,
    indicator: 'none',
    description: 'All Systems Operational',
  };
}

// Detect if URL is a special cloud provider and fetch appropriately
async function fetchCloudProviderStatus(service: { name?: string; url: string }): Promise<{
  name: string;
  url: string;
  indicator: string;
  description: string;
  updatedAt?: string;
  latestIncident?: string;
} | null> {
  const provider = CLOUD_PROVIDERS[service.url];
  if (!provider) return null;

  switch (provider.type) {
    case 'aws':
      return fetchAwsStatus(service.url, service.name);
    case 'gcp':
      return fetchGcpStatus(service.url, service.name);
    case 'azure':
      return fetchAzureStatus(service.url, service.name);
    default:
      return null;
  }
}

// Pre-defined popular status pages
export const POPULAR_STATUS_PAGES = [
  // Major Cloud Providers (custom API handling)
  { name: 'AWS', url: 'https://status.aws.amazon.com' },
  { name: 'Google Cloud', url: 'https://status.cloud.google.com' },
  { name: 'Azure', url: 'https://azure.status.microsoft' },
  // Statuspage.io format
  { name: 'GitHub', url: 'https://www.githubstatus.com' },
  { name: 'Cloudflare', url: 'https://www.cloudflarestatus.com' },
  { name: 'Slack', url: 'https://status.slack.com' },
  { name: 'Discord', url: 'https://discordstatus.com' },
  { name: 'OpenAI', url: 'https://status.openai.com' },
  { name: 'Stripe', url: 'https://status.stripe.com' },
  { name: 'Zoom', url: 'https://status.zoom.us' },
  { name: 'Datadog', url: 'https://status.datadoghq.com' },
  { name: 'Heroku', url: 'https://status.heroku.com' },
  { name: 'DigitalOcean', url: 'https://status.digitalocean.com' },
  { name: 'Atlassian', url: 'https://status.atlassian.com' },
  { name: 'GitLab', url: 'https://status.gitlab.com' },
  { name: 'Vercel', url: 'https://www.vercel-status.com' },
  { name: 'Netlify', url: 'https://www.netlifystatus.com' },
  { name: 'Dropbox', url: 'https://status.dropbox.com' },
  { name: 'Twilio', url: 'https://status.twilio.com' },
  { name: 'Auth0', url: 'https://status.auth0.com' },
  { name: 'PagerDuty', url: 'https://status.pagerduty.com' },
  { name: 'Sentry', url: 'https://status.sentry.io' },
  { name: 'Hashicorp', url: 'https://status.hashicorp.com' },
  { name: 'MongoDB', url: 'https://status.mongodb.com' },
  { name: 'Redis', url: 'https://status.redis.io' },
  { name: 'Supabase', url: 'https://status.supabase.com' },
  { name: 'Linear', url: 'https://status.linear.app' },
  { name: 'Notion', url: 'https://status.notion.so' },
  { name: 'Figma', url: 'https://status.figma.com' },
  { name: 'Miro', url: 'https://status.miro.com' },
  { name: 'CircleCI', url: 'https://status.circleci.com' },
  { name: 'Travis CI', url: 'https://www.traviscistatus.com' },
  { name: 'npm', url: 'https://status.npmjs.org' },
];

// Get list of available status pages
router.get('/pages', (_req, res) => {
  res.json(POPULAR_STATUS_PAGES);
});

// Helper to fetch a single service status (for per-service caching)
async function fetchSingleServiceStatus(service: { name?: string; url: string }): Promise<{
  name: string;
  url: string;
  indicator: string;
  description: string;
  updatedAt?: string;
  latestIncident?: string;
  error?: boolean;
}> {
  // Check per-service cache first
  const cached = getServiceCached(service.url);
  if (cached) {
    return cached as typeof cached & { name: string; url: string; indicator: string; description: string };
  }

  try {
    // Check if this is a special cloud provider (AWS, GCP, Azure)
    const cloudStatus = await fetchCloudProviderStatus(service);
    if (cloudStatus) {
      setServiceCache(service.url, cloudStatus);
      return cloudStatus;
    }

    // Standard Statuspage.io format - use shorter timeout (5s)
    const [statusResponse, summaryResponse] = await Promise.all([
      axios.get(`${service.url}/api/v2/status.json`, {
        timeout: 5000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DashStatusMonitor/1.0',
        },
      }),
      axios.get(`${service.url}/api/v2/summary.json`, {
        timeout: 5000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DashStatusMonitor/1.0',
        },
      }).catch(() => null),
    ]);

    // Find the most recent update time from components and incidents
    let mostRecentUpdate = statusResponse.data.page?.updated_at;

    if (summaryResponse?.data) {
      const timestamps: string[] = [];

      if (summaryResponse.data.components) {
        for (const component of summaryResponse.data.components) {
          if (component.updated_at) {
            timestamps.push(component.updated_at);
          }
        }
      }

      if (summaryResponse.data.incidents) {
        for (const incident of summaryResponse.data.incidents) {
          if (incident.updated_at) {
            timestamps.push(incident.updated_at);
          }
          if (incident.incident_updates) {
            for (const update of incident.incident_updates) {
              if (update.created_at) {
                timestamps.push(update.created_at);
              }
            }
          }
        }
      }

      if (timestamps.length > 0) {
        timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        mostRecentUpdate = timestamps[0];
      }
    }

    let latestIncidentSummary: string | undefined;
    if (summaryResponse?.data?.incidents && summaryResponse.data.incidents.length > 0) {
      latestIncidentSummary = summaryResponse.data.incidents[0].name;
    }

    const result = {
      name: service.name || statusResponse.data.page?.name || 'Unknown',
      url: service.url,
      indicator: statusResponse.data.status.indicator,
      description: statusResponse.data.status.description,
      updatedAt: mostRecentUpdate,
      latestIncident: latestIncidentSummary,
    };

    setServiceCache(service.url, result);
    return result;
  } catch {
    // Return error result but don't cache it
    return {
      name: service.name || 'Unknown',
      url: service.url,
      indicator: 'unknown',
      description: 'Failed to fetch status',
      error: true,
    };
  }
}

// Fetch status for multiple services
router.post('/fetch', async (req, res) => {
  try {
    const { services } = req.body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'Services array is required' });
    }

    // Validate services
    for (const service of services) {
      if (!service.url) {
        return res.status(400).json({ error: 'Each service must have a url' });
      }
      try {
        new URL(service.url);
      } catch {
        return res.status(400).json({ error: `Invalid URL: ${service.url}` });
      }
    }

    // Fetch all services in parallel, using per-service cache
    const results = await Promise.all(
      services.map((service: { name?: string; url: string }) => fetchSingleServiceStatus(service))
    );

    res.json({ services: results });
  } catch (error) {
    logger.error('service-status', 'Failed to fetch service status', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch service status' });
  }
});

// Fetch detailed components for a single service
router.get('/details', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const cacheKey = `details:${url}`;
    const cached = getCached(cacheKey);
    if (cached) {
      logger.debug('service-status', 'Returning cached details', { url });
      return res.json(cached);
    }

    logger.info('service-status', 'Fetching service details', { url });

    const response = await axios.get(`${url}/api/v2/summary.json`, {
      timeout: 5000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DashStatusMonitor/1.0',
      },
    });

    const data = {
      name: response.data.page?.name,
      url: url,
      status: response.data.status,
      components: response.data.components.map((c: {
        id: string;
        name: string;
        status: string;
        description?: string;
        updated_at?: string;
      }) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        description: c.description,
        updatedAt: c.updated_at,
      })),
    };

    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    logger.error('service-status', 'Failed to fetch service details', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch service details' });
  }
});

// Fetch active incidents for multiple services
router.post('/incidents', async (req, res) => {
  try {
    const { services } = req.body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'Services array is required' });
    }

    const cacheKey = `incidents:${services.map((s: { url: string }) => s.url).sort().join(',')}`;
    const cached = getCached(cacheKey);
    if (cached) {
      logger.debug('service-status', 'Returning cached incidents');
      return res.json(cached);
    }

    logger.info('service-status', `Fetching incidents for ${services.length} services`);

    const allIncidents: Array<{
      id: string;
      name: string;
      status: string;
      impact: string;
      createdAt: string;
      updatedAt: string;
      serviceName: string;
      serviceUrl: string;
      updates: Array<{ body: string; status: string; createdAt: string }>;
    }> = [];

    await Promise.allSettled(
      services.map(async (service: { name?: string; url: string }) => {
        try {
          const response = await axios.get(`${service.url}/api/v2/incidents/unresolved.json`, {
            timeout: 5000,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'DashStatusMonitor/1.0',
            },
          });
          response.data.incidents.forEach((incident: {
            id: string;
            name: string;
            status: string;
            impact: string;
            created_at: string;
            updated_at: string;
            incident_updates?: Array<{ body: string; status: string; created_at: string }>;
          }) => {
            allIncidents.push({
              id: incident.id,
              name: incident.name,
              status: incident.status,
              impact: incident.impact,
              createdAt: incident.created_at,
              updatedAt: incident.updated_at,
              serviceName: service.name || 'Unknown',
              serviceUrl: service.url,
              updates: incident.incident_updates?.map(u => ({
                body: u.body,
                status: u.status,
                createdAt: u.created_at,
              })) || [],
            });
          });
        } catch (e) {
          logger.debug('service-status', `Failed to fetch incidents for ${service.name}`, { error: e });
        }
      })
    );

    // Sort by created_at descending
    allIncidents.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const data = { incidents: allIncidents };
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    logger.error('service-status', 'Failed to fetch incidents', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Fetch scheduled maintenance for multiple services
router.post('/maintenance', async (req, res) => {
  try {
    const { services } = req.body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'Services array is required' });
    }

    const cacheKey = `maintenance:${services.map((s: { url: string }) => s.url).sort().join(',')}`;
    const cached = getCached(cacheKey);
    if (cached) {
      logger.debug('service-status', 'Returning cached maintenance');
      return res.json(cached);
    }

    logger.info('service-status', `Fetching maintenance for ${services.length} services`);

    const allMaintenance: Array<{
      id: string;
      name: string;
      status: string;
      impact: string;
      scheduledFor: string;
      scheduledUntil: string;
      serviceName: string;
      serviceUrl: string;
    }> = [];

    await Promise.allSettled(
      services.map(async (service: { name?: string; url: string }) => {
        try {
          const response = await axios.get(
            `${service.url}/api/v2/scheduled-maintenances/upcoming.json`,
            {
              timeout: 5000,
              headers: {
                Accept: 'application/json',
                'User-Agent': 'DashStatusMonitor/1.0',
              },
            }
          );
          response.data.scheduled_maintenances.forEach((maint: {
            id: string;
            name: string;
            status: string;
            impact: string;
            scheduled_for: string;
            scheduled_until: string;
          }) => {
            allMaintenance.push({
              id: maint.id,
              name: maint.name,
              status: maint.status,
              impact: maint.impact,
              scheduledFor: maint.scheduled_for,
              scheduledUntil: maint.scheduled_until,
              serviceName: service.name || 'Unknown',
              serviceUrl: service.url,
            });
          });
        } catch (e) {
          logger.debug('service-status', `Failed to fetch maintenance for ${service.name}`, { error: e });
        }
      })
    );

    // Sort by scheduled_for ascending
    allMaintenance.sort((a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    );

    const data = { maintenances: allMaintenance };
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    logger.error('service-status', 'Failed to fetch maintenance', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch maintenance' });
  }
});

// Clear cache
router.post('/clear-cache', (_req, res) => {
  cache.clear();
  serviceCache.clear();
  logger.info('service-status', 'Cleared service status cache');
  res.json({ success: true });
});

export default router;
