import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BaseWidget } from '../BaseWidget';
import api from '../../../api/client';

interface ServiceStatus {
  name: string;
  url: string;
  imageUrl?: string;
  indicator: 'none' | 'minor' | 'major' | 'critical' | 'unknown';
  description: string;
  updatedAt?: string;
  latestIncident?: string;
  error?: boolean;
}

interface ServiceStatusConfig {
  services?: Array<{ name: string; url: string; imageUrl?: string }>;
  showOnlyIssues?: boolean;
  sortBy?: 'custom' | 'name' | 'status' | 'updated';
  showDescription?: boolean;
  showUpdated?: boolean;
  showIcon?: boolean;
  refreshInterval?: number;
  visualization?: 'cards' | 'list' | 'compact';
}

interface ServiceStatusWidgetProps {
  title: string;
  config: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
  isEditMode?: boolean;
  widgetId?: string;
}

// Popular status pages for quick selection (verified working with Statuspage.io API)
export const POPULAR_STATUS_PAGES = [
  // Developer Tools & Infrastructure
  { name: 'GitHub', url: 'https://www.githubstatus.com' },
  { name: 'Bitbucket', url: 'https://bitbucket.status.atlassian.com' },
  { name: 'npm', url: 'https://status.npmjs.org' },
  { name: 'PyPI', url: 'https://status.python.org' },
  { name: 'Vercel', url: 'https://www.vercel-status.com' },
  { name: 'Netlify', url: 'https://www.netlifystatus.com' },
  { name: 'Render', url: 'https://status.render.com' },
  { name: 'Fly.io', url: 'https://status.fly.io' },

  // Major Cloud Providers
  { name: 'AWS', url: 'https://status.aws.amazon.com' },
  { name: 'Google Cloud', url: 'https://status.cloud.google.com' },
  { name: 'Azure', url: 'https://azure.status.microsoft' },
  { name: 'Cloudflare', url: 'https://www.cloudflarestatus.com' },
  { name: 'DigitalOcean', url: 'https://status.digitalocean.com' },
  { name: 'Linode', url: 'https://status.linode.com' },
  { name: 'Oracle Cloud', url: 'https://ocistatus.oraclecloud.com' },

  // AI & ML - LLM Providers
  { name: 'OpenAI', url: 'https://status.openai.com' },
  { name: 'Claude', url: 'https://status.claude.com' },
  { name: 'Cohere', url: 'https://status.cohere.com' },
  { name: 'Groq', url: 'https://groqstatus.com' },
  { name: 'Together AI', url: 'https://together.statuspage.io' },
  { name: 'AI21 Labs', url: 'https://status.ai21.com' },
  { name: 'Fireworks AI', url: 'https://fireworks.statuspage.io' },
  { name: 'Replicate', url: 'https://status.replicate.com' },

  // AI & ML - Image/Video Generation
  { name: 'Midjourney', url: 'https://midjourney.statuspage.io' },
  { name: 'Stability AI', url: 'https://status.stability.ai' },

  // AI & ML - Voice/Speech
  { name: 'ElevenLabs', url: 'https://status.elevenlabs.io' },
  { name: 'Deepgram', url: 'https://status.deepgram.com' },

  // AI & ML - Vector Databases & ML Ops
  { name: 'Pinecone', url: 'https://status.pinecone.io' },
  { name: 'Weights & Biases', url: 'https://status.wandb.com' },
  { name: 'Scale AI', url: 'https://status.scale.com' },

  // AI & ML - Cloud AI Platforms
  { name: 'Azure AI', url: 'https://status.ai.azure.com' },

  // Communication
  { name: 'Discord', url: 'https://discordstatus.com' },
  { name: 'Zoom', url: 'https://status.zoom.us' },
  { name: 'Twilio', url: 'https://status.twilio.com' },
  { name: 'SendGrid', url: 'https://status.sendgrid.com' },
  { name: 'Intercom', url: 'https://www.intercomstatus.com' },

  // Productivity & Collaboration
  { name: 'Atlassian', url: 'https://status.atlassian.com' },
  { name: 'Jira', url: 'https://jira-software.status.atlassian.com' },
  { name: 'Confluence', url: 'https://confluence.status.atlassian.com' },
  { name: 'Figma', url: 'https://status.figma.com' },
  { name: 'Miro', url: 'https://status.miro.com' },
  { name: 'Canva', url: 'https://www.canvastatus.com' },
  { name: 'Airtable', url: 'https://status.airtable.com' },
  { name: 'ClickUp', url: 'https://clickup.statuspage.io' },
  { name: 'Trello', url: 'https://trello.status.atlassian.com' },
  { name: 'Todoist', url: 'https://status.todoist.com' },
  { name: 'Notion', url: 'https://www.notion-status.com' },

  // Storage & Files
  { name: 'Dropbox', url: 'https://status.dropbox.com' },
  { name: 'Box', url: 'https://status.box.com' },

  // Databases & Backend
  { name: 'MongoDB', url: 'https://status.mongodb.com' },
  { name: 'Redis', url: 'https://status.redis.io' },
  { name: 'Supabase', url: 'https://status.supabase.com' },
  { name: 'PlanetScale', url: 'https://www.planetscalestatus.com' },
  { name: 'Fauna', url: 'https://status.fauna.com' },
  { name: 'Neon', url: 'https://neonstatus.com' },
  { name: 'Upstash', url: 'https://status.upstash.com' },
  { name: 'Algolia', url: 'https://status.algolia.com' },

  // Payments & Finance
  { name: 'PayPal', url: 'https://www.paypal-status.com' },
  { name: 'Square', url: 'https://www.issquareup.com' },
  { name: 'Plaid', url: 'https://status.plaid.com' },
  { name: 'Coinbase', url: 'https://status.coinbase.com' },
  { name: 'Braintree', url: 'https://status.braintreepayments.com' },

  // Monitoring & DevOps
  { name: 'Datadog', url: 'https://status.datadoghq.com' },
  { name: 'New Relic', url: 'https://status.newrelic.com' },
  { name: 'Splunk', url: 'https://www.splunkstatus.com' },
  { name: 'Grafana Cloud', url: 'https://status.grafana.com' },
  { name: 'LaunchDarkly', url: 'https://status.launchdarkly.com' },
  { name: 'CircleCI', url: 'https://status.circleci.com' },
  { name: 'Travis CI', url: 'https://www.traviscistatus.com' },

  // Auth & Security
  { name: 'Auth0', url: 'https://auth0.statuspage.io' },
  { name: '1Password', url: 'https://status.1password.com' },
  { name: 'LastPass', url: 'https://status.lastpass.com' },
  { name: 'HashiCorp', url: 'https://status.hashicorp.com' },

  // CDN & Media
  { name: 'Fastly', url: 'https://status.fastly.com' },
  { name: 'Imgix', url: 'https://status.imgix.com' },
  { name: 'Cloudinary', url: 'https://status.cloudinary.com' },
  { name: 'Mux', url: 'https://status.mux.com' },
  { name: 'Vimeo', url: 'https://www.vimeostatus.com' },

  // Analytics
  { name: 'Amplitude', url: 'https://status.amplitude.com' },
  { name: 'Mixpanel', url: 'https://status.mixpanel.com' },
  { name: 'Segment', url: 'https://status.segment.com' },
  { name: 'Heap', url: 'https://status.heap.io' },

  // CMS & Content
  { name: 'Contentful', url: 'https://www.contentfulstatus.com' },
  { name: 'Sanity', url: 'https://status.sanity.io' },
  { name: 'Webflow', url: 'https://status.webflow.com' },
  { name: 'Squarespace', url: 'https://status.squarespace.com' },
  { name: 'Shopify', url: 'https://www.shopifystatus.com' },

  // Other Popular Services
  { name: 'Twitch', url: 'https://status.twitch.tv' },
  { name: 'Reddit', url: 'https://www.redditstatus.com' },
  { name: 'Medium', url: 'https://medium.statuspage.io' },
  { name: 'Calendly', url: 'https://status.calendly.com' },
  { name: 'Typeform', url: 'https://status.typeform.com' },
  { name: 'HubSpot', url: 'https://status.hubspot.com' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  none: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  minor: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  major: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  unknown: { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' },
};

const STATUS_LABELS: Record<string, string> = {
  none: 'Operational',
  minor: 'Minor Issues',
  major: 'Major Outage',
  critical: 'Critical',
  unknown: 'Unknown',
};

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

export function ServiceStatusWidget({ config }: ServiceStatusWidgetProps) {
  const [statuses, setStatuses] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusConfig = config as ServiceStatusConfig;

  // Stable serialization of services for dependency tracking
  // This prevents unnecessary re-fetches when config object changes but services don't
  const servicesJson = JSON.stringify(statusConfig.services || []);
  const services = useMemo(() => {
    return JSON.parse(servicesJson) as Array<{ name: string; url: string; imageUrl?: string }>;
  }, [servicesJson]);

  const showOnlyIssues = statusConfig.showOnlyIssues ?? false;
  const sortBy = statusConfig.sortBy || 'custom';
  const showDescription = statusConfig.showDescription ?? true;
  const showUpdated = statusConfig.showUpdated ?? true;
  const showIcon = statusConfig.showIcon ?? true;
  const refreshInterval = statusConfig.refreshInterval || 60000;
  const visualization = statusConfig.visualization || 'cards';
  const logoSize = (config.logoSize as string) || 'md';
  const columnsPerRow = (config.columnsPerRow as string) || 'auto';

  // Logo size classes
  const logoSizeClasses: Record<string, string> = {
    xs: 'h-3 max-w-[40px]',
    sm: 'h-4 max-w-[60px]',
    md: 'h-5 max-w-[80px]',
    lg: 'h-6 max-w-[100px]',
    xl: 'h-8 max-w-[120px]',
  };
  const logoClass = logoSizeClasses[logoSize] || logoSizeClasses.md;

  const fetchStatuses = useCallback(async (signal?: AbortSignal) => {
    if (services.length === 0) {
      setStatuses([]);
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/service-status/fetch', { services }, { signal });
      // Check if request was aborted
      if (signal?.aborted) return;
      // Merge imageUrl from config into the response since backend doesn't return it
      const statusesWithImages = (response.data.services || []).map((status: ServiceStatus) => {
        const serviceConfig = services.find(s => s.url === status.url);
        return {
          ...status,
          imageUrl: serviceConfig?.imageUrl,
        };
      });
      setStatuses(statusesWithImages);
      setError(null);
    } catch (err) {
      // Ignore aborted requests
      if (err instanceof Error && err.name === 'CanceledError') return;
      if (signal?.aborted) return;
      setError('Failed to fetch service status');
      console.error('Service status fetch error:', err);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [services]);

  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    fetchStatuses(abortController.signal);

    let interval: ReturnType<typeof setInterval> | undefined;
    if (refreshInterval > 0) {
      interval = setInterval(() => fetchStatuses(), refreshInterval);
    }

    return () => {
      abortController.abort();
      if (interval) clearInterval(interval);
    };
  }, [fetchStatuses, refreshInterval]);

  const filteredAndSortedStatuses = useMemo(() => {
    let result = [...statuses];

    // Filter to only issues if enabled
    if (showOnlyIssues) {
      result = result.filter(s => s.indicator !== 'none');
    }

    // Sort (skip if 'custom' to preserve user-defined order from config)
    if (sortBy !== 'custom') {
      result.sort((a, b) => {
        switch (sortBy) {
          case 'status': {
            const statusOrder = { critical: 0, major: 1, minor: 2, unknown: 3, none: 4 };
            return (statusOrder[a.indicator] || 4) - (statusOrder[b.indicator] || 4);
          }
          case 'updated':
            return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
          case 'name':
          default:
            return a.name.localeCompare(b.name);
        }
      });
    } else {
      // For custom order, sort by the order in the services config
      const serviceOrder = new Map(services.map((s, i) => [s.url, i]));
      result.sort((a, b) => {
        const orderA = serviceOrder.get(a.url) ?? Infinity;
        const orderB = serviceOrder.get(b.url) ?? Infinity;
        return orderA - orderB;
      });
    }

    return result;
  }, [statuses, showOnlyIssues, sortBy, services]);

  if (services.length === 0) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">No services configured</p>
          <p className="text-xs mt-1 text-center px-4">
            Edit this widget to select services to monitor
          </p>
        </div>
      </BaseWidget>
    );
  }

  const renderStatus = (status: ServiceStatus) => {
    const colors = STATUS_COLORS[status.indicator] || STATUS_COLORS.unknown;
    const label = STATUS_LABELS[status.indicator] || 'Unknown';

    // Render service name or image
    const renderServiceName = (className: string) => {
      if (status.imageUrl) {
        return (
          <img
            src={status.imageUrl}
            alt={status.name}
            className={`${logoClass} w-auto object-contain`}
            title={status.name}
          />
        );
      }
      return (
        <span className={className}>
          {status.name}
        </span>
      );
    };

    // Consistent fields for all visualizations:
    // - Icon (status dot)
    // - Name/Logo
    // - Status label
    // - Latest incident summary (if available)

    // Helper to render the event info (incident summary or last event time)
    const renderEventInfo = () => {
      if (!showUpdated) return null;
      if (status.latestIncident) {
        return status.latestIncident;
      }
      if (status.updatedAt) {
        return `Last event ${formatRelativeTime(status.updatedAt)}`;
      }
      return null;
    };

    const eventInfo = renderEventInfo();

    if (visualization === 'compact') {
      return (
        <a
          key={status.url}
          href={status.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 py-1.5 px-2 rounded ${colors.bg} hover:opacity-70 transition-opacity cursor-pointer`}
          title={eventInfo || `Open ${status.name} status page`}
        >
          {showIcon && (
            <span className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
          )}
          {renderServiceName("text-xs font-medium text-gray-700 dark:text-gray-200 truncate")}
          {showDescription && (
            <span className={`text-xs ${colors.text} flex-shrink-0`}>
              {status.error ? 'Error' : label}
            </span>
          )}
        </a>
      );
    }

    if (visualization === 'list') {
      return (
        <a
          key={status.url}
          href={status.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-between py-2 px-3 rounded-md ${colors.bg} hover:opacity-80 transition-opacity cursor-pointer`}
          title={`Open ${status.name} status page`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showIcon && (
              <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} flex-shrink-0`} />
            )}
            {renderServiceName("text-sm font-medium text-gray-700 dark:text-gray-200")}
            {showDescription && (
              <span className={`text-xs ${colors.text} flex-shrink-0`}>
                {status.error ? 'Error' : label}
              </span>
            )}
          </div>
          {eventInfo && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px] ml-2">
              {eventInfo}
            </span>
          )}
        </a>
      );
    }

    // Cards visualization (default)
    return (
      <a
        key={status.url}
        href={status.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block p-3 rounded-lg ${colors.bg} border border-gray-100 dark:border-gray-600 hover:opacity-80 hover:shadow-sm transition-all cursor-pointer`}
        title={`Open ${status.name} status page`}
      >
        <div className="flex items-center gap-2 mb-1">
          {showIcon && (
            <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} flex-shrink-0`} />
          )}
          {status.imageUrl ? (
            <img
              src={status.imageUrl}
              alt={status.name}
              className={`${logoClass} w-auto object-contain`}
              title={status.name}
            />
          ) : (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
              {status.name}
            </span>
          )}
        </div>
        {showDescription && (
          <p className={`text-xs ${colors.text} mb-1`}>
            {status.error ? 'Error' : label}
          </p>
        )}
        {eventInfo && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {eventInfo}
          </p>
        )}
      </a>
    );
  };

  return (
    <BaseWidget loading={loading} error={error}>
      <div className={`h-full overflow-auto ${
        visualization === 'cards'
          ? 'grid gap-2 auto-rows-min'
          : visualization === 'compact'
            ? 'flex flex-wrap gap-x-4 gap-y-1 content-start'
            : 'space-y-2'
      }`}
        style={visualization === 'cards' ? {
          gridTemplateColumns: columnsPerRow === 'auto'
            ? 'repeat(auto-fill, minmax(160px, 1fr))'
            : `repeat(${columnsPerRow}, 1fr)`
        } : undefined}
      >
        {filteredAndSortedStatuses.length === 0 && showOnlyIssues ? (
          <div className="col-span-full flex items-center justify-center py-8 text-green-600 dark:text-green-400">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">All services operational</span>
          </div>
        ) : (
          filteredAndSortedStatuses.map(renderStatus)
        )}
      </div>
    </BaseWidget>
  );
}
