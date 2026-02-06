import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { WidgetWithLayout, UnifiDevice } from '../../types';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useIntegrationStore } from '../../stores/integrationStore';
import { settingsApi, dataApi } from '../../api/client';
import {
  integrationConfigs,
  staticWidgets,
  crossIntegrationWidgets,
  getIntegrationDisplayName,
  FilterConfig as RegistryFilterConfig,
} from '../../config/integrations';
import { MultiImagePicker } from '../common/MultiImagePicker';
import { ImagePicker } from '../common/ImagePicker';
import { CONTENT_SCALE_OPTIONS } from '../../utils/widgetScaling';
import {
  SWITCH_TEMPLATES,
  loadCustomTemplates,
  initCustomTemplates,
  SwitchTemplate,
} from '../Widgets/network/SwitchPortOverlay/templates';
import {
  DEVICE_TEMPLATES,
  initCustomDeviceTemplates,
  DeviceTemplate,
} from '../Widgets/network/DeviceOverlay/templates';
import { PortConnectionEditor } from '../Widgets/network/SwitchPortOverlay/PortConnectionEditor';

// Helper to format widget type for display
function formatWidgetType(type: string): string {
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper to format integration type for display
function formatIntegrationType(type: string): string {
  return getIntegrationDisplayName(type);
}

/**
 * Build widget filters from the centralized configuration registry.
 * This maps widget types to their filter configurations.
 */
function buildWidgetFilters(): Record<string, FilterConfig[]> {
  const filters: Record<string, FilterConfig[]> = {};

  // Add static widget filters
  for (const widget of staticWidgets) {
    if (widget.filters && widget.filters.length > 0) {
      filters[widget.type] = widget.filters as FilterConfig[];
    }
  }

  // Add cross-integration widget filters
  for (const widget of crossIntegrationWidgets) {
    if (widget.filters && widget.filters.length > 0) {
      filters[widget.type] = widget.filters as FilterConfig[];
    }
  }

  // Add integration widget filters with prefixed types
  for (const integration of integrationConfigs) {
    for (const widget of integration.widgets) {
      if (widget.filters && widget.filters.length > 0) {
        // Prefix widget type with integration type for beszel and adguard
        const widgetType = ['beszel', 'adguard'].includes(integration.type)
          ? `${integration.type}-${widget.type}`
          : widget.type;
        filters[widgetType] = widget.filters as FilterConfig[];
      }
    }
  }

  return filters;
}

/**
 * Build lists of widgets that support various display options from the registry.
 */
function buildWidgetCapabilities(): {
  metricWidgets: string[];
  labelToggleWidgets: string[];
  visualizationWidgets: string[];
} {
  const metricWidgets: string[] = [];
  const labelToggleWidgets: string[] = [];
  const visualizationWidgets: string[] = [];

  // Process static widgets
  for (const widget of staticWidgets) {
    if (widget.supportsMetricSize) metricWidgets.push(widget.type);
    if (widget.supportsHideLabels) labelToggleWidgets.push(widget.type);
  }

  // Process integration widgets
  for (const integration of integrationConfigs) {
    for (const widget of integration.widgets) {
      const widgetType = ['beszel', 'adguard'].includes(integration.type)
        ? `${integration.type}-${widget.type}`
        : widget.type;

      if (widget.supportsMetricSize) metricWidgets.push(widgetType);
      if (widget.supportsHideLabels) labelToggleWidgets.push(widgetType);
      if (widget.visualizations && widget.visualizations.length > 0) {
        visualizationWidgets.push(widgetType);
      }
    }
  }

  return { metricWidgets, labelToggleWidgets, visualizationWidgets };
}

/**
 * Get visualization options for a widget type from the registry.
 */
function getVisualizationOptions(widgetType: string): { value: string; label: string }[] | undefined {
  // Check static widgets
  for (const widget of staticWidgets) {
    if (widget.type === widgetType && widget.visualizations) {
      return widget.visualizations;
    }
  }

  // Check integration widgets
  for (const integration of integrationConfigs) {
    for (const widget of integration.widgets) {
      const prefixedType = ['beszel', 'adguard'].includes(integration.type)
        ? `${integration.type}-${widget.type}`
        : widget.type;
      if (prefixedType === widgetType && widget.visualizations) {
        return widget.visualizations;
      }
    }
  }

  return undefined;
}

interface EditWidgetModalProps {
  widget: WidgetWithLayout;
  onClose: () => void;
}

// Filter configurations for each widget type
interface CheckboxGroupItem {
  label: string;
  key: string;
}

interface FilterConfig {
  label: string;
  key: string;
  type: 'select' | 'text' | 'number' | 'checkbox' | 'checkbox-group' | 'switch-select' | 'switch-select-single' | 'button-group' | 'camera-select' | 'ring-camera-select' | 'tapo-device-select' | 'tapo-sensor-select' | 'kasa-device-select' | 'homeconnect-fridge-select' | 'color' | 'timezone-multi-select' | 'weather-location-search' | 'integration-select' | 'template-select' | 'device-template-select' | 'ap-select' | 'image-select' | 'beszel-host-select' | 'beszel-host-order' | 'beszel-temp-select' | 'beszel-host-icons' | 'service-status-selector';
  options?: { value: string; label: string }[];
  placeholder?: string;
  items?: CheckboxGroupItem[]; // For checkbox-group type
  defaultEnabled?: boolean; // Default state for checkbox-group items
  integrationTypes?: string[]; // For integration-select: filter by these integration types
  min?: number; // For number type
  max?: number; // For number type
  defaultValue?: string | number | boolean; // Default value
  dependsOn?: { key: string; value: unknown }; // Conditional display
  group?: string; // Group name for organizing filters into collapsible sections
  groupCollapsedByDefault?: boolean; // Whether the group should be collapsed by default
}

// Build widget capabilities from the registry
const widgetCapabilities = buildWidgetCapabilities();

// Widgets that support hideLabels and metricSize options (from registry)
const metricWidgets = widgetCapabilities.metricWidgets;

// Widgets where hideLabels hides table headers or list labels (from registry)
const labelToggleWidgets = widgetCapabilities.labelToggleWidgets;

// Widgets that support visualization options (from registry)
const visualizationWidgets = widgetCapabilities.visualizationWidgets;

type TabId = 'general' | 'appearance' | 'filters';

// Build widget filters from registry (at module level for efficiency)
const registryWidgetFilters = buildWidgetFilters();

// Timezone options for the multi-select
const TIMEZONE_OPTIONS = [
  { id: 'America/New_York', label: 'New York' },
  { id: 'America/Los_Angeles', label: 'Los Angeles' },
  { id: 'America/Chicago', label: 'Chicago' },
  { id: 'America/Denver', label: 'Denver' },
  { id: 'America/Phoenix', label: 'Phoenix' },
  { id: 'America/Anchorage', label: 'Anchorage' },
  { id: 'Pacific/Honolulu', label: 'Honolulu' },
  { id: 'America/Toronto', label: 'Toronto' },
  { id: 'America/Vancouver', label: 'Vancouver' },
  { id: 'America/Mexico_City', label: 'Mexico City' },
  { id: 'America/Sao_Paulo', label: 'São Paulo' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Paris', label: 'Paris' },
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Europe/Madrid', label: 'Madrid' },
  { id: 'Europe/Rome', label: 'Rome' },
  { id: 'Europe/Amsterdam', label: 'Amsterdam' },
  { id: 'Europe/Moscow', label: 'Moscow' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Asia/Shanghai', label: 'Shanghai' },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Asia/Jerusalem', label: 'Jerusalem' },
  { id: 'Asia/Kolkata', label: 'Mumbai' },
  { id: 'Asia/Seoul', label: 'Seoul' },
  { id: 'Asia/Bangkok', label: 'Bangkok' },
  { id: 'Australia/Sydney', label: 'Sydney' },
  { id: 'Australia/Melbourne', label: 'Melbourne' },
  { id: 'Australia/Perth', label: 'Perth' },
  { id: 'Pacific/Auckland', label: 'Auckland' },
  { id: 'Africa/Cairo', label: 'Cairo' },
  { id: 'Africa/Johannesburg', label: 'Johannesburg' },
  { id: 'UTC', label: 'UTC' },
];

// Searchable timezone multi-select component
function TimezoneMultiSelect({
  selectedZones,
  onChange,
}: {
  selectedZones: { id: string; label?: string }[];
  onChange: (zones: { id: string; label?: string }[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIds = selectedZones.map(z => z.id);

  const filteredOptions = TIMEZONE_OPTIONS.filter(tz => {
    if (selectedIds.includes(tz.id)) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      tz.label.toLowerCase().includes(searchLower) ||
      tz.id.toLowerCase().includes(searchLower)
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTimezone = (tz: { id: string; label: string }) => {
    onChange([...selectedZones, { id: tz.id, label: tz.label }]);
    setSearch('');
    inputRef.current?.focus();
  };

  const removeTimezone = (index: number) => {
    onChange(selectedZones.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {/* Selected timezones */}
      {selectedZones.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedZones.map((zone, index) => (
            <div
              key={zone.id}
              className="flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-md text-sm"
            >
              <span>{zone.label || TIMEZONE_OPTIONS.find(t => t.id === zone.id)?.label || zone.id}</span>
              <button
                type="button"
                onClick={() => removeTimezone(index)}
                className="ml-1 text-primary-500 hover:text-primary-700 dark:hover:text-primary-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Searchable dropdown */}
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search timezones..."
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {isOpen && filteredOptions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            {filteredOptions.map((tz) => (
              <button
                key={tz.id}
                type="button"
                onClick={() => addTimezone(tz)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              >
                <span className="font-medium">{tz.label}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">{tz.id}</span>
              </button>
            ))}
          </div>
        )}

        {isOpen && search && filteredOptions.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No timezones found
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Search and select timezones to display. Click × to remove.
      </p>
    </div>
  );
}

// Popular status pages for service status widget (sorted alphabetically)
// Verified working status pages (Statuspage.io API compatible)
const SERVICE_STATUS_PAGES = [
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
].sort((a, b) => a.name.localeCompare(b.name));

// Service status selector component
function ServiceStatusSelector({
  selectedServices,
  onChange,
}: {
  selectedServices: { name: string; url: string; imageUrl?: string }[];
  onChange: (services: { name: string; url: string; imageUrl?: string }[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [imagePickerIndex, setImagePickerIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedUrls = selectedServices.map(s => s.url);

  const filteredOptions = SERVICE_STATUS_PAGES.filter(page => {
    if (selectedUrls.includes(page.url)) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return page.name.toLowerCase().includes(searchLower);
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addService = (service: { name: string; url: string }) => {
    onChange([...selectedServices, service]);
    setSearch('');
    inputRef.current?.focus();
  };

  const removeService = (index: number) => {
    onChange(selectedServices.filter((_, i) => i !== index));
  };

  const moveService = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedServices.length) return;

    const updated = [...selectedServices];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    onChange(updated);
  };

  const setServiceImage = (index: number, imageUrl: string | undefined) => {
    const updated = [...selectedServices];
    updated[index] = { ...updated[index], imageUrl };
    onChange(updated);
    setImagePickerIndex(null);
  };

  const validateAndAddCustomService = () => {
    setCustomError(null);

    // Validate name
    if (!customName.trim()) {
      setCustomError('Service name is required');
      return;
    }

    // Validate URL
    if (!customUrl.trim()) {
      setCustomError('Status page URL is required');
      return;
    }

    let normalizedUrl = customUrl.trim();
    // Add https:// if no protocol specified
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setCustomError('Invalid URL format');
      return;
    }

    // Check if URL is already added
    if (selectedUrls.includes(normalizedUrl)) {
      setCustomError('This service is already added');
      return;
    }

    // Add the custom service directly via onChange (don't go through addService to avoid search field focus)
    const newService = { name: customName.trim(), url: normalizedUrl };
    onChange([...selectedServices, newService]);

    // Clear form and collapse
    setCustomName('');
    setCustomUrl('');
    setCustomError(null);
    setShowCustomForm(false);
  };

  return (
    <div className="space-y-3">
      {selectedServices.length > 0 && (
        <div className="space-y-2 mb-2">
          <div className="flex flex-col gap-1.5">
            {selectedServices.map((service, index) => (
              <div
                key={service.url}
                className="flex items-center gap-1 px-2 py-1.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-md text-sm"
              >
                {/* Reorder buttons */}
                <div className="flex flex-col -my-1 mr-1">
                  <button
                    type="button"
                    onClick={() => moveService(index, 'up')}
                    disabled={index === 0}
                    className={`p-0.5 rounded transition-colors ${
                      index === 0
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-primary-500 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-200 dark:hover:bg-primary-800'
                    }`}
                    title="Move up"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveService(index, 'down')}
                    disabled={index === selectedServices.length - 1}
                    className={`p-0.5 rounded transition-colors ${
                      index === selectedServices.length - 1
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-primary-500 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-200 dark:hover:bg-primary-800'
                    }`}
                    title="Move down"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Service name or image */}
                <div className="flex-1 min-w-0">
                  {service.imageUrl ? (
                    <img
                      src={service.imageUrl}
                      alt={service.name}
                      className="h-5 w-auto max-w-[80px] object-contain"
                      title={service.name}
                    />
                  ) : (
                    <span className="truncate">{service.name}</span>
                  )}
                </div>

                {/* Action buttons */}
                <button
                  type="button"
                  onClick={() => setImagePickerIndex(index)}
                  className="p-0.5 rounded hover:bg-primary-200 dark:hover:bg-primary-800 text-primary-500 hover:text-primary-700 dark:hover:text-primary-200 transition-colors"
                  title={service.imageUrl ? "Change logo/image" : "Add logo/image"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeService(index)}
                  className="p-0.5 rounded hover:bg-primary-200 dark:hover:bg-primary-800 text-primary-500 hover:text-primary-700 dark:hover:text-primary-200 transition-colors"
                  title="Remove service"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Click the image icon on a service to replace its name with a logo
          </p>
        </div>
      )}

      {/* Image Picker Modal */}
      {imagePickerIndex !== null && (
        <ImagePicker
          value={selectedServices[imagePickerIndex]?.imageUrl}
          onChange={(url) => setServiceImage(imagePickerIndex, url)}
          onClose={() => setImagePickerIndex(null)}
          title={`Select image for ${selectedServices[imagePickerIndex]?.name}`}
        />
      )}

      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search services (GitHub, Cloudflare, etc.)..."
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {isOpen && filteredOptions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            {filteredOptions.map((page) => (
              <button
                key={page.url}
                type="button"
                onClick={() => addService(page)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              >
                <span className="font-medium">{page.name}</span>
              </button>
            ))}
          </div>
        )}

        {isOpen && search && filteredOptions.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No services found. Try adding a custom service below.
            </div>
          </div>
        )}
      </div>

      {/* Custom Service Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCustomForm(!showCustomForm)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Add Custom Service
          </span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${showCustomForm ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCustomForm && (
          <div className="p-3 space-y-3 bg-white dark:bg-gray-800/50">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My Service"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1.5 text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Status Page URL
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="status.example.com"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1.5 text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {customError && (
              <p className="text-xs text-red-600 dark:text-red-400">{customError}</p>
            )}

            <button
              type="button"
              onClick={validateAndAddCustomService}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Service
            </button>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <strong>Tip:</strong> Works with Statuspage.io-powered status pages. Look for "Status" links in website footers.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Examples: status.example.com, www.examplestatus.com, example.statuspage.io
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Click on a service in the widget to open its status page.
      </p>
    </div>
  );
}

// Weather location search component
interface WeatherLocation {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
  displayName: string;
}

function WeatherLocationSearch({
  selectedLocations,
  onChange,
}: {
  selectedLocations: WeatherLocation[];
  onChange: (locations: WeatherLocation[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for locations with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (search.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/weather/search?q=${encodeURIComponent(search)}`);
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Search failed');
        }
        const results = await response.json();
        setSearchResults(results);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  const addLocation = (loc: WeatherLocation) => {
    // Check if already added
    const exists = selectedLocations.some(
      (l) => l.lat === loc.lat && l.lon === loc.lon
    );
    if (!exists) {
      onChange([...selectedLocations, loc]);
    }
    setSearch('');
    setSearchResults([]);
    inputRef.current?.focus();
  };

  const removeLocation = (index: number) => {
    onChange(selectedLocations.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {/* Selected locations */}
      {selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedLocations.map((loc, index) => (
            <div
              key={`${loc.lat}-${loc.lon}`}
              className="flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-md text-sm"
            >
              <span>{loc.name}</span>
              <button
                type="button"
                onClick={() => removeLocation(index)}
                className="ml-1 text-primary-500 hover:text-primary-700 dark:hover:text-primary-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search for a city..."
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {isOpen && search.length >= 2 && (
          <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            {searching && (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                Searching...
              </div>
            )}

            {!searching && searchError && (
              <div className="px-3 py-2 text-sm text-red-500 dark:text-red-400">
                {searchError}
              </div>
            )}

            {!searching && !searchError && searchResults.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No locations found
              </div>
            )}

            {!searching && searchResults.map((loc) => (
              <button
                key={`${loc.lat}-${loc.lon}`}
                type="button"
                onClick={() => addLocation(loc)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              >
                <span className="font-medium">{loc.name}</span>
                {loc.state && (
                  <span className="text-gray-500 dark:text-gray-400">, {loc.state}</span>
                )}
                <span className="text-gray-500 dark:text-gray-400">, {loc.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Search and select cities to display weather for. Click × to remove.
      </p>
    </div>
  );
}

export function EditWidgetModal({ widget, onClose }: EditWidgetModalProps) {
  const { updateWidget } = useDashboardStore();
  const { integrations } = useIntegrationStore();
  const [title, setTitle] = useState(widget.title);
  const [config, setConfig] = useState<Record<string, unknown>>(widget.config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const headerImageInputRef = useRef<HTMLInputElement>(null);
  const [availableSwitches, setAvailableSwitches] = useState<{ id: string; name: string; model: string }[]>([]);
  const [loadingSwitches, setLoadingSwitches] = useState(false);
  const [customSwitchTemplates, setCustomSwitchTemplates] = useState<SwitchTemplate[]>([]);
  const [customDeviceTemplates, setCustomDeviceTemplates] = useState<DeviceTemplate[]>([]);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; name: string }[]>([]);
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [availableTapoDevices, setAvailableTapoDevices] = useState<{ id: string; name: string; hasEnergy?: boolean }[]>([]);
  const [loadingTapoDevices, setLoadingTapoDevices] = useState(false);
  const [availableTapoSensors, setAvailableTapoSensors] = useState<{ id: string; name: string; type: string }[]>([]);
  const [loadingTapoSensors, setLoadingTapoSensors] = useState(false);
  const [availableKasaDevices, setAvailableKasaDevices] = useState<{ id: string; name: string; hasEnergy?: boolean }[]>([]);
  const [loadingKasaDevices, setLoadingKasaDevices] = useState(false);
  const [availableRingCameras, setAvailableRingCameras] = useState<{ id: number; name: string }[]>([]);
  const [loadingRingCameras, setLoadingRingCameras] = useState(false);
  const [availableHomeConnectFridges, setAvailableHomeConnectFridges] = useState<{ haId: string; name: string; hasCamera: boolean }[]>([]);
  const [loadingHomeConnectFridges, setLoadingHomeConnectFridges] = useState(false);
  const [availableAps, setAvailableAps] = useState<{ id: string; name: string; model: string }[]>([]);
  const [loadingAps, setLoadingAps] = useState(false);
  const [availableBeszelHosts, setAvailableBeszelHosts] = useState<{ name: string; temps: string[]; status?: 'up' | 'down' | 'paused' | 'pending' }[]>([]);
  const [loadingBeszelHosts, setLoadingBeszelHosts] = useState(false);
  const [showSlideshowPicker, setShowSlideshowPicker] = useState(false);
  const [showHeaderImagePicker, setShowHeaderImagePicker] = useState(false);
  const [showSingleImagePicker, setShowSingleImagePicker] = useState(false);
  const [hostIconPickerHost, setHostIconPickerHost] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Find the integration for this widget
  const integration = widget.integration_id
    ? integrations.find(i => i.id === widget.integration_id)
    : null;

  // Get filters from the centralized registry
  const filters = registryWidgetFilters[widget.widget_type] || [];
  const hasFilters = filters.length > 0;

  // Group filters by their group property and identify unique groups
  const filterGroups = useMemo(() => {
    const groups: { name: string | null; filters: FilterConfig[]; collapsedByDefault: boolean }[] = [];
    const seenGroups = new Set<string | null>();

    for (const filter of filters) {
      const groupName = filter.group || null;
      if (!seenGroups.has(groupName)) {
        seenGroups.add(groupName);
        groups.push({
          name: groupName,
          filters: filters.filter(f => (f.group || null) === groupName),
          collapsedByDefault: filter.groupCollapsedByDefault || false,
        });
      }
    }
    return groups;
  }, [filters]);

  // Initialize collapsed state based on filter config
  useEffect(() => {
    const initialCollapsed = new Set<string>();
    for (const group of filterGroups) {
      if (group.name && group.collapsedByDefault) {
        initialCollapsed.add(group.name);
      }
    }
    setCollapsedGroups(initialCollapsed);
  }, [filterGroups]);

  // Toggle a group's collapsed state
  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  useEffect(() => {
    setTitle(widget.title);
    setConfig(widget.config);
  }, [widget]);

  // Load custom switch templates from API
  useEffect(() => {
    initCustomTemplates().then(setCustomSwitchTemplates).catch(console.error);
  }, []);

  // Load custom device templates from API
  useEffect(() => {
    initCustomDeviceTemplates().then(setCustomDeviceTemplates).catch(console.error);
  }, []);

  // Fetch available switches for switch-ports and cross-switch-port-overlay widgets
  const switchIntegrationId = widget.integration_id || (config.integrationId as string);
  useEffect(() => {
    const needsSwitches = widget.widget_type === 'switch-ports' || widget.widget_type === 'cross-switch-port-overlay';
    if (needsSwitches && switchIntegrationId) {
      setLoadingSwitches(true);
      dataApi.getData<{ devices?: UnifiDevice[] }>(switchIntegrationId, 'switch-ports')
        .then((data) => {
          // Include switches (usw), gateways (ugw), and dream machines (udm) that have port tables
          const switchTypes = ['usw', 'ugw', 'udm'];
          const switches = (data.devices || [])
            .filter((d) => switchTypes.includes(d.type) && d.port_table && d.port_table.length > 0)
            .map((d) => ({ id: d._id, name: d.name, model: d.model }));
          setAvailableSwitches(switches);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch switches:', err);
        })
        .finally(() => {
          setLoadingSwitches(false);
        });
    } else if (needsSwitches && !switchIntegrationId) {
      // Clear switches if no integration selected
      setAvailableSwitches([]);
    }
  }, [widget.widget_type, switchIntegrationId]);

  // Fetch available cameras for camera-snapshot widget
  useEffect(() => {
    if (widget.widget_type === 'camera-snapshot' && widget.integration_id) {
      setLoadingCameras(true);
      dataApi.getData<{ cameras?: { id: string; name: string; state: string }[] }>(widget.integration_id, 'cameras')
        .then((data) => {
          const cameras = (data.cameras || [])
            .map((c) => ({ id: c.id, name: c.name }));
          setAvailableCameras(cameras);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch cameras:', err);
        })
        .finally(() => {
          setLoadingCameras(false);
        });
    }
  }, [widget.widget_type, widget.integration_id]);

  // Fetch available Tapo devices for tapo widgets
  useEffect(() => {
    const tapoWidgets = ['tapo-device-status', 'tapo-power'];
    if (tapoWidgets.includes(widget.widget_type) && widget.integration_id) {
      setLoadingTapoDevices(true);
      dataApi.getData<{ devices?: { deviceId: string; alias: string; hasEnergyMonitoring?: boolean }[] }>(widget.integration_id, 'devices')
        .then((data) => {
          const devices = (data.devices || [])
            .map((d) => ({ id: d.deviceId, name: d.alias, hasEnergy: d.hasEnergyMonitoring }));
          setAvailableTapoDevices(devices);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch Tapo devices:', err);
        })
        .finally(() => {
          setLoadingTapoDevices(false);
        });
    }
  }, [widget.widget_type, widget.integration_id]);

  // Fetch available Tapo sensors for tapo-sensor-value widget
  useEffect(() => {
    if (widget.widget_type === 'tapo-sensor-value' && widget.integration_id) {
      setLoadingTapoSensors(true);
      dataApi.getData<{ sensors?: { deviceId: string; alias: string; sensorType: string }[] }>(widget.integration_id, 'sensors')
        .then((data) => {
          const sensors = (data.sensors || [])
            .map((s) => ({ id: s.deviceId, name: s.alias, type: s.sensorType }));
          setAvailableTapoSensors(sensors);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch Tapo sensors:', err);
        })
        .finally(() => {
          setLoadingTapoSensors(false);
        });
    }
  }, [widget.widget_type, widget.integration_id]);

  // Fetch available Kasa devices for kasa widgets
  useEffect(() => {
    const kasaWidgets = ['kasa-device-status', 'kasa-power'];
    if (kasaWidgets.includes(widget.widget_type) && widget.integration_id) {
      setLoadingKasaDevices(true);
      dataApi.getData<{ devices?: { deviceId: string; alias: string; hasEnergyMonitoring?: boolean }[] }>(widget.integration_id, 'devices')
        .then((data) => {
          const devices = (data.devices || [])
            .map((d) => ({ id: d.deviceId, name: d.alias, hasEnergy: d.hasEnergyMonitoring }));
          setAvailableKasaDevices(devices);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch Kasa devices:', err);
        })
        .finally(() => {
          setLoadingKasaDevices(false);
        });
    }
  }, [widget.widget_type, widget.integration_id]);

  // Fetch available Ring cameras for ring-snapshot widget
  useEffect(() => {
    if (widget.widget_type === 'ring-snapshot' && widget.integration_id) {
      setLoadingRingCameras(true);
      dataApi.getData<{ devices?: { id: number; name: string }[] }>(widget.integration_id, 'devices')
        .then((data) => {
          // Backend already returns only cameras/doorbells from api.cameras
          const cameras = (data.devices || []).map((d) => ({ id: d.id, name: d.name }));
          setAvailableRingCameras(cameras);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch Ring cameras:', err);
        })
        .finally(() => {
          setLoadingRingCameras(false);
        });
    }
  }, [widget.widget_type, widget.integration_id]);

  // Fetch available Home Connect fridges for fridge-camera widget
  useEffect(() => {
    if (widget.widget_type === 'homeconnect-fridge-camera' && widget.integration_id) {
      setLoadingHomeConnectFridges(true);
      dataApi.getData<{ fridges?: { haId: string; applianceName: string; available: boolean }[] }>(widget.integration_id, 'fridge-images')
        .then((data) => {
          const fridges = (data.fridges || []).map((f) => ({
            haId: f.haId,
            name: f.applianceName,
            hasCamera: f.available,
          }));
          setAvailableHomeConnectFridges(fridges);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch Home Connect fridges:', err);
        })
        .finally(() => {
          setLoadingHomeConnectFridges(false);
        });
    }
  }, [widget.widget_type, widget.integration_id]);

  // Fetch available APs for ap-status widget
  useEffect(() => {
    if (widget.widget_type === 'ap-status' && widget.integration_id) {
      setLoadingAps(true);
      dataApi.getData<{ devices?: { _id: string; name: string; model: string; type: string }[] }>(widget.integration_id, 'devices')
        .then((data) => {
          const aps = (data.devices || [])
            .filter((d) => d.type === 'uap')
            .map((d) => ({ id: d._id, name: d.name || 'Unnamed AP', model: d.model }));
          setAvailableAps(aps);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch access points:', err);
        })
        .finally(() => {
          setLoadingAps(false);
        });
    }
  }, [widget.widget_type, widget.integration_id]);

  // Fetch available hosts and their temperature sensors for beszel-system-stats widget
  // Fetches from both 'systems' (all hosts including offline) and 'system-stats' (online hosts with temps)
  useEffect(() => {
    if (widget.widget_type === 'beszel-system-stats' && widget.integration_id) {
      setLoadingBeszelHosts(true);

      // Fetch both systems (all hosts) and system-stats (online hosts with temps)
      Promise.all([
        dataApi.getData<{ systems?: { name: string; status: 'up' | 'down' | 'paused' | 'pending' }[] }>(widget.integration_id, 'systems'),
        dataApi.getData<{ stats?: { system: string; temps?: { name: string; temp: number }[] }[] }>(widget.integration_id, 'system-stats'),
      ])
        .then(([systemsData, statsData]) => {
          // Build temps map from online hosts
          const tempsMap = new Map<string, string[]>();
          (statsData.stats || []).forEach((stat) => {
            const temps = (stat.temps || []).map(t => t.name).filter(Boolean).sort();
            tempsMap.set(stat.system, temps);
          });

          // Build host list from all systems
          const hosts = (systemsData.systems || []).map((system) => ({
            name: system.name,
            temps: tempsMap.get(system.name) || [],
            status: system.status,
          }));

          // Sort hosts alphabetically
          hosts.sort((a, b) => a.name.localeCompare(b.name));
          setAvailableBeszelHosts(hosts);
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch Beszel hosts:', err);
        })
        .finally(() => {
          setLoadingBeszelHosts(false);
        });
    }
  }, [widget.widget_type, widget.integration_id]);

  const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { url } = await settingsApi.uploadLogo(file);
      setConfig(prev => ({ ...prev, headerImageUrl: url }));
    } catch (err) {
      console.error('Failed to upload header image:', err);
    } finally {
      setUploadingImage(false);
      if (headerImageInputRef.current) {
        headerImageInputRef.current.value = '';
      }
    }
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateWidget(widget.id, { title, config });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // Helper function to render filter input based on type
  const renderFilterInput = (filter: FilterConfig) => {
    switch (filter.type) {
      case 'select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        );

      case 'template-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Auto-detect</option>
            <optgroup label="Built-in Templates">
              {SWITCH_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{template.displayName}</option>
              ))}
            </optgroup>
            {customSwitchTemplates.length > 0 && (
              <optgroup label="Custom Templates">
                {customSwitchTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.displayName}</option>
                ))}
              </optgroup>
            )}
          </select>
        );

      case 'device-template-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{filter.placeholder || 'Select a device template...'}</option>
            <optgroup label="Built-in Templates">
              {DEVICE_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{template.displayName}</option>
              ))}
            </optgroup>
            {customDeviceTemplates.length > 0 && (
              <optgroup label="Custom Templates">
                {customDeviceTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.displayName}</option>
                ))}
              </optgroup>
            )}
          </select>
        );

      case 'text':
        return (
          <input
            type="text"
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            placeholder={filter.placeholder}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={(config[filter.key] as number) ?? filter.defaultValue ?? ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value ? parseInt(e.target.value, 10) : undefined)}
            placeholder={filter.placeholder}
            min={filter.min}
            max={filter.max}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(config[filter.key] as boolean) || false}
              onChange={(e) => handleConfigChange(filter.key, e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
          </label>
        );

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(config[filter.key] as string) || '#000000'}
              onChange={(e) => handleConfigChange(filter.key, e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <input
              type="text"
              value={(config[filter.key] as string) || ''}
              onChange={(e) => handleConfigChange(filter.key, e.target.value)}
              placeholder={filter.placeholder || '#000000'}
              className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {Boolean(config[filter.key]) && (
              <button
                type="button"
                onClick={() => handleConfigChange(filter.key, '')}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Clear color"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        );

      case 'checkbox-group':
        if (!filter.items) return null;
        return (
          <div className="grid grid-cols-2 gap-2">
            {filter.items.map((item) => {
              const defaultEnabled = filter.defaultEnabled !== false;
              const isChecked = config[item.key] !== undefined ? Boolean(config[item.key]) : defaultEnabled;
              return (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleConfigChange(item.key, e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
                </label>
              );
            })}
          </div>
        );

      case 'switch-select':
        return (
          <div className="grid grid-cols-1 gap-2">
            {loadingSwitches ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading switches...</span>
            ) : availableSwitches.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">No switches found</span>
            ) : (
              availableSwitches.map((sw) => {
                const selected = (config.selectedSwitches as string[]) || [];
                const isChecked = selected.length === 0 || selected.includes(sw.id);
                return (
                  <label key={sw.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        let currentSelected = selected.length === 0 ? availableSwitches.map(s => s.id) : [...selected];
                        if (e.target.checked) {
                          if (!currentSelected.includes(sw.id)) currentSelected.push(sw.id);
                        } else {
                          currentSelected = currentSelected.filter(id => id !== sw.id);
                        }
                        if (currentSelected.length === availableSwitches.length) {
                          handleConfigChange('selectedSwitches', []);
                        } else {
                          handleConfigChange('selectedSwitches', currentSelected);
                        }
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{sw.name}</span>
                  </label>
                );
              })
            )}
          </div>
        );

      case 'switch-select-single':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loadingSwitches}
          >
            <option value="">{loadingSwitches ? 'Loading switches...' : (filter.placeholder || 'Select a switch')}</option>
            {availableSwitches.map((sw) => (
              <option key={sw.id} value={sw.id}>{sw.name} ({sw.model})</option>
            ))}
          </select>
        );

      case 'integration-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{filter.placeholder || 'Select integration...'}</option>
            {integrations
              .filter(i => !filter.integrationTypes || filter.integrationTypes.includes(i.type))
              .map((integ) => (
                <option key={integ.id} value={integ.id}>{integ.name} ({getIntegrationDisplayName(integ.type)})</option>
              ))}
          </select>
        );

      case 'button-group':
        if (!filter.options) return null;
        return (
          <div className="flex flex-wrap gap-1.5">
            {filter.options.map((option) => {
              const isSelected = (config[filter.key] as string) === option.value || (!config[filter.key] && option.value === '');
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleConfigChange(filter.key, option.value)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );

      case 'camera-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loadingCameras}
          >
            <option value="">{loadingCameras ? 'Loading cameras...' : 'Select a camera'}</option>
            {availableCameras.map((camera) => (
              <option key={camera.id} value={camera.id}>{camera.name}</option>
            ))}
          </select>
        );

      case 'ring-camera-select':
        return (
          <select
            value={(config[filter.key] as number)?.toString() || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loadingRingCameras}
          >
            <option value="">{loadingRingCameras ? 'Loading cameras...' : 'Select a camera'}</option>
            {availableRingCameras.map((camera) => (
              <option key={camera.id} value={camera.id}>{camera.name}</option>
            ))}
          </select>
        );

      case 'homeconnect-fridge-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value || undefined)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loadingHomeConnectFridges}
          >
            <option value="">{loadingHomeConnectFridges ? 'Loading refrigerators...' : 'Select a refrigerator'}</option>
            {availableHomeConnectFridges.map((fridge) => (
              <option key={fridge.haId} value={fridge.haId}>{fridge.name}{fridge.hasCamera ? ' \ud83d\udcf7' : ' (no camera)'}</option>
            ))}
          </select>
        );

      case 'tapo-device-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loadingTapoDevices}
          >
            <option value="">{loadingTapoDevices ? 'Loading devices...' : 'Select a device'}</option>
            {availableTapoDevices
              .filter((device) => widget.widget_type !== 'tapo-power' || device.hasEnergy)
              .map((device) => (
                <option key={device.id} value={device.id}>{device.name}{device.hasEnergy ? ' \u26a1' : ''}</option>
              ))}
          </select>
        );

      case 'tapo-sensor-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loadingTapoSensors}
          >
            <option value="">{loadingTapoSensors ? 'Loading sensors...' : 'Select a sensor'}</option>
            {availableTapoSensors.map((sensor) => (
              <option key={sensor.id} value={sensor.id}>
                {sensor.name} ({sensor.type})
              </option>
            ))}
          </select>
        );

      case 'kasa-device-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loadingKasaDevices}
          >
            <option value="">{loadingKasaDevices ? 'Loading devices...' : 'Select a device'}</option>
            {availableKasaDevices
              .filter((device) => widget.widget_type !== 'kasa-power' || device.hasEnergy)
              .map((device) => (
                <option key={device.id} value={device.id}>{device.name}{device.hasEnergy ? ' \u26a1' : ''}</option>
              ))}
          </select>
        );

      case 'timezone-multi-select':
        return (
          <TimezoneMultiSelect
            selectedZones={(config[filter.key] as { id: string; label?: string }[]) || []}
            onChange={(zones) => handleConfigChange(filter.key, zones)}
          />
        );

      case 'service-status-selector':
        return (
          <ServiceStatusSelector
            selectedServices={(config[filter.key] as { name: string; url: string }[]) || []}
            onChange={(services) => handleConfigChange(filter.key, services)}
          />
        );

      case 'weather-location-search':
        return (
          <WeatherLocationSearch
            selectedLocations={(config[filter.key] as WeatherLocation[]) || []}
            onChange={(locations) => handleConfigChange(filter.key, locations)}
          />
        );

      case 'ap-select':
        return (
          <select
            value={(config[filter.key] as string) || ''}
            onChange={(e) => handleConfigChange(filter.key, e.target.value || undefined)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loadingAps}
          >
            <option value="">{loadingAps ? 'Loading access points...' : (filter.placeholder || 'Select an access point')}</option>
            {availableAps.map((ap) => (
              <option key={ap.id} value={ap.id}>{ap.name} ({ap.model})</option>
            ))}
          </select>
        );

      case 'image-select':
        return (
          <div>
            <button
              type="button"
              onClick={() => {
                setConfig(prev => ({ ...prev, _pendingImageKey: filter.key }));
                setShowSingleImagePicker(true);
              }}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 dark:hover:border-primary-500 transition-colors text-center"
            >
              <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{config[filter.key] ? 'Change image' : 'Select image from library'}</span>
              </div>
            </button>
            {Boolean(config[filter.key]) && (
              <div className="mt-2 flex items-center gap-2">
                <img src={config[filter.key] as string} alt="Selected image" className="w-16 h-16 object-contain rounded border border-gray-200 dark:border-gray-700" />
                <button type="button" onClick={() => handleConfigChange(filter.key, undefined)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Remove</button>
              </div>
            )}
          </div>
        );

      case 'beszel-host-select':
        return (
          <div className="space-y-2">
            {loadingBeszelHosts ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading systems...</span>
            ) : availableBeszelHosts.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">No systems found</span>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableBeszelHosts.map((host) => {
                  const selectedHosts = (config.selectedHosts as string[]) || [];
                  const isChecked = selectedHosts.includes(host.name);
                  const isOffline = host.status && host.status !== 'up';
                  return (
                    <label key={host.name} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const newSelectedHosts = e.target.checked
                            ? [...selectedHosts, host.name]
                            : selectedHosts.filter(h => h !== host.name);
                          handleConfigChange('selectedHosts', newSelectedHosts.length > 0 ? newSelectedHosts : undefined);
                          if (!e.target.checked) {
                            const selectedTemps = (config.selectedTemps as string[]) || [];
                            const remainingHosts = availableBeszelHosts.filter(h => newSelectedHosts.includes(h.name));
                            const availableTemps = new Set(remainingHosts.flatMap(h => h.temps));
                            const validTemps = selectedTemps.filter(t => availableTemps.has(t));
                            if (validTemps.length !== selectedTemps.length) {
                              handleConfigChange('selectedTemps', validTemps.length > 0 ? validTemps : undefined);
                            }
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
                      />
                      <span className={`text-sm flex items-center gap-1.5 ${isOffline ? 'text-gray-500 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          host.status === 'up' ? 'bg-green-500' :
                          host.status === 'down' ? 'bg-red-500' :
                          host.status === 'paused' ? 'bg-yellow-500' :
                          'bg-gray-400'
                        }`} />
                        {host.name}
                        {isOffline && <span className="text-xs text-gray-500 dark:text-gray-400">({host.status})</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">Select systems to display. Leave all unchecked to show all systems.</p>
          </div>
        );

      case 'beszel-host-order': {
        const selectedHosts = (config.selectedHosts as string[]) || [];
        const hostOrder = (config.hostOrder as string[]) || [];

        // Get the hosts to display (selected ones, or all if none selected)
        const hostsToOrder = selectedHosts.length > 0
          ? availableBeszelHosts.filter(h => selectedHosts.includes(h.name))
          : availableBeszelHosts;

        if (hostsToOrder.length <= 1) {
          return (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Select multiple systems above to enable reordering.
            </p>
          );
        }

        // Sort hosts by the stored order, with unordered hosts at the end
        const sortedHosts = [...hostsToOrder].sort((a, b) => {
          const aIndex = hostOrder.indexOf(a.name);
          const bIndex = hostOrder.indexOf(b.name);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });

        const moveHost = (hostName: string, direction: 'up' | 'down') => {
          const currentOrder = sortedHosts.map(h => h.name);
          const currentIndex = currentOrder.indexOf(hostName);
          if (currentIndex === -1) return;

          const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
          if (newIndex < 0 || newIndex >= currentOrder.length) return;

          // Swap positions
          [currentOrder[currentIndex], currentOrder[newIndex]] = [currentOrder[newIndex], currentOrder[currentIndex]];
          handleConfigChange('hostOrder', currentOrder);
        };

        return (
          <div className="space-y-2">
            <div className="space-y-1">
              {sortedHosts.map((host, index) => (
                <div
                  key={host.name}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-5">{index + 1}.</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{host.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveHost(host.name, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveHost(host.name, 'down')}
                      disabled={index === sortedHosts.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Use arrows to reorder how systems are displayed.</p>
          </div>
        );
      }

      case 'beszel-temp-select': {
        const selectedHosts = (config.selectedHosts as string[]) || [];
        const relevantHosts = selectedHosts.length > 0
          ? availableBeszelHosts.filter(h => selectedHosts.includes(h.name))
          : availableBeszelHosts;
        const hostsWithTemps = relevantHosts.filter(h => h.temps && h.temps.length > 0);
        const hostTemps = (config.hostTemps as Record<string, string[]>) || {};

        return (
          <div className="space-y-3">
            {loadingBeszelHosts ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading temperature sensors...</span>
            ) : hostsWithTemps.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">No temperature sensors found{selectedHosts.length > 0 ? ' for selected systems' : ''}</span>
            ) : (
              <div className="space-y-3">
                {hostsWithTemps.map((host) => {
                  const selectedSensors = hostTemps[host.name] || [];
                  return (
                    <div key={host.name} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{host.name}</div>
                      <div className="space-y-1.5">
                        {host.temps.sort().map((sensor) => {
                          const isChecked = selectedSensors.includes(sensor);
                          return (
                            <label key={sensor} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setConfig(prev => {
                                    const currentHostTemps = (prev.hostTemps as Record<string, string[]>) || {};
                                    const currentSensors = currentHostTemps[host.name] || [];
                                    const newSensors = checked
                                      ? [...currentSensors, sensor]
                                      : currentSensors.filter(s => s !== sensor);
                                    const newHostTemps = { ...currentHostTemps };
                                    if (newSensors.length > 0) {
                                      newHostTemps[host.name] = newSensors;
                                    } else {
                                      delete newHostTemps[host.name];
                                    }
                                    return { ...prev, hostTemps: Object.keys(newHostTemps).length > 0 ? newHostTemps : undefined };
                                  });
                                }}
                                className="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400">{sensor}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">Select sensors per host. Leave all unchecked to show max temperature for that host.</p>
          </div>
        );
      }

      case 'beszel-host-icons':
        return (
          <div className="space-y-2">
            {loadingBeszelHosts ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading systems...</span>
            ) : availableBeszelHosts.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">No systems found</span>
            ) : (
              <div className="space-y-2">
                {availableBeszelHosts.map((host) => {
                  const hostIcons = (config.hostIcons as Record<string, string>) || {};
                  const iconUrl = hostIcons[host.name];
                  return (
                    <div key={host.name} className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => setHostIconPickerHost(host.name)}
                        className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-700/50"
                      >
                        {iconUrl ? (
                          <img src={iconUrl} alt="" className="w-6 h-6 object-contain" />
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{host.name}</span>
                      {iconUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const newHostIcons = { ...hostIcons };
                            delete newHostIcons[host.name];
                            handleConfigChange('hostIcons', Object.keys(newHostIcons).length > 0 ? newHostIcons : undefined);
                          }}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">Click the icon box to select an icon for each system.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Widget</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'appearance'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Appearance
            </button>
            {hasFilters && (
              <button
                onClick={() => setActiveTab('filters')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'filters'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Filters
              </button>
            )}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Widget & Integration Info */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  {formatWidgetType(widget.widget_type)}
                </span>
                {integration && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                    {formatIntegrationType(integration.type)}: {integration.name}
                  </span>
                )}
              </div>

              {/* Title input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Refresh interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Refresh Interval
                </label>
                <select
                  value={(config.refreshInterval as number) || 30000}
                  onChange={(e) => handleConfigChange('refreshInterval', parseInt(e.target.value, 10))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={15000}>15 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                  <option value={120000}>2 minutes</option>
                  <option value={300000}>5 minutes</option>
                  <option value={600000}>10 minutes</option>
                </select>
              </div>

              {/* Display options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.hideTitle as boolean) || false}
                      onChange={(e) => handleConfigChange('hideTitle', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Hide title bar
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.hideTitleText as boolean) || false}
                      onChange={(e) => handleConfigChange('hideTitleText', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Hide title text
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.transparentBackground as boolean) || false}
                      onChange={(e) => handleConfigChange('transparentBackground', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Transparent background
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.transparentHeader as boolean) || false}
                      onChange={(e) => handleConfigChange('transparentHeader', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Transparent header
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.showLastUpdated as boolean) || false}
                      onChange={(e) => handleConfigChange('showLastUpdated', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Show last updated timestamp
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.hideScrollbar as boolean) || false}
                      onChange={(e) => handleConfigChange('hideScrollbar', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Hide scrollbar
                    </span>
                  </label>
                  {(metricWidgets.includes(widget.widget_type) || labelToggleWidgets.includes(widget.widget_type)) && (
                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(config.hideLabels as boolean) || false}
                        onChange={(e) => handleConfigChange('hideLabels', e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {labelToggleWidgets.includes(widget.widget_type) ? 'Hide table headers' : 'Hide metric labels'}
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Metric Size - only for metric widgets */}
              {metricWidgets.includes(widget.widget_type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Metric Size
                  </label>
                  <select
                    value={(config.metricSize as string) || 'md'}
                    onChange={(e) => handleConfigChange('metricSize', e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="xs">Extra Small</option>
                    <option value="sm">Small</option>
                    <option value="md">Medium (Default)</option>
                    <option value="lg">Large</option>
                    <option value="xl">Extra Large</option>
                    <option value="xxl">XXL</option>
                    <option value="xxxl">XXXL</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Controls the size of primary metric values
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Header Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Header Image
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={(config.headerImageUrl as string) || ''}
                    onChange={(e) => handleConfigChange('headerImageUrl', e.target.value)}
                    placeholder="URL or select from library"
                    className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    ref={headerImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml"
                    onChange={handleHeaderImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowHeaderImagePicker(true)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                    title="Browse image library"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => headerImageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50 text-sm"
                    title="Upload new image"
                  >
                    {uploadingImage ? '...' : 'Upload'}
                  </button>
                  {Boolean(config.headerImageUrl) && (
                    <button
                      type="button"
                      onClick={() => handleConfigChange('headerImageUrl', '')}
                      className="px-2 py-2 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                      title="Remove image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {Boolean(config.headerImageUrl) && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                    <img
                      src={config.headerImageUrl as string}
                      alt="Header preview"
                      className="h-8 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <label className="flex items-center gap-3 mt-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(config.hideHeaderImage as boolean) || false}
                    onChange={(e) => handleConfigChange('hideHeaderImage', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Hide header image
                  </span>
                </label>
              </div>

              {/* Header Icon Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Header Icon Size
                </label>
                <select
                  value={(config.headerIconSize as string) || 'md'}
                  onChange={(e) => handleConfigChange('headerIconSize', e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="xs">Extra Small (12px)</option>
                  <option value="sm">Small (16px)</option>
                  <option value="md">Medium (20px) - Default</option>
                  <option value="lg">Large (24px)</option>
                  <option value="xl">Extra Large (32px)</option>
                  <option value="xxl">XXL (40px)</option>
                  <option value="xxxl">XXXL (48px)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Controls the size of the header image/icon
                </p>
              </div>

              {/* Header Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Header Link
                </label>
                <input
                  type="url"
                  value={(config.headerLinkUrl as string) || ''}
                  onChange={(e) => handleConfigChange('headerLinkUrl', e.target.value)}
                  placeholder="https://example.com"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Makes the header title and icon clickable
                </p>
                {Boolean(config.headerLinkUrl) && (
                  <label className="flex items-center gap-3 mt-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.headerLinkOpenNewTab as boolean) ?? true}
                      onChange={(e) => handleConfigChange('headerLinkOpenNewTab', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Open in new tab
                    </span>
                  </label>
                )}
              </div>

              {/* Colors */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Colors
                </label>

                {/* Background Color */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(config.backgroundColor as string) || '#ffffff'}
                      onChange={(e) => handleConfigChange('backgroundColor', e.target.value)}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={(config.backgroundColor as string) || ''}
                      onChange={(e) => handleConfigChange('backgroundColor', e.target.value)}
                      placeholder="Default"
                      className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1 text-sm font-mono"
                    />
                    {Boolean(config.backgroundColor) && (
                      <button
                        type="button"
                        onClick={() => handleConfigChange('backgroundColor', '')}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Header Color */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Header</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(config.headerColor as string) || '#f9fafb'}
                      onChange={(e) => handleConfigChange('headerColor', e.target.value)}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={(config.headerColor as string) || ''}
                      onChange={(e) => handleConfigChange('headerColor', e.target.value)}
                      placeholder="Default"
                      className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1 text-sm font-mono"
                    />
                    {Boolean(config.headerColor) && (
                      <button
                        type="button"
                        onClick={() => handleConfigChange('headerColor', '')}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Border Color */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Border</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(config.borderColor as string) || '#e5e7eb'}
                      onChange={(e) => handleConfigChange('borderColor', e.target.value)}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={(config.borderColor as string) || ''}
                      onChange={(e) => handleConfigChange('borderColor', e.target.value)}
                      placeholder="Default"
                      className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1 text-sm font-mono"
                    />
                    {Boolean(config.borderColor) && (
                      <button
                        type="button"
                        onClick={() => handleConfigChange('borderColor', '')}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Leave empty for default theme colors
                </p>
              </div>

              {/* Visualization Style - for supported widgets (from registry) */}
              {(() => {
                const vizOptions = getVisualizationOptions(widget.widget_type);
                if (!vizOptions || vizOptions.length === 0) return null;
                // Default to first option when no visualization is set
                const currentViz = (config.visualization as string) || (config.visualizationType as string) || vizOptions[0]?.value || '';
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Visualization Style
                    </label>
                    <select
                      value={currentViz}
                      onChange={(e) => handleConfigChange('visualization', e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {vizOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Choose how data is displayed visually
                    </p>
                  </div>
                );
              })()}

              {/* Content Scale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content Scale
                </label>
                <select
                  value={(config.contentScale as string) || 'auto'}
                  onChange={(e) => handleConfigChange('contentScale', e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {CONTENT_SCALE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Auto scales content based on widget size. Override for manual control.
                </p>
              </div>
            </div>
          )}

          {/* Filters Tab */}
          {activeTab === 'filters' && hasFilters && (
            <div className="space-y-4">
              {filterGroups.map((group) => {
                // For ungrouped filters, render directly without a section header
                if (!group.name) {
                  return group.filters.map((filter) => {
                    // Check if this filter depends on another config value
                    if (filter.dependsOn) {
                      const dependentValue = config[filter.dependsOn.key];
                      if (dependentValue !== filter.dependsOn.value) {
                        return null;
                      }
                    }
                    return (
                      <div key={filter.key}>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {filter.label}
                        </label>
                        {renderFilterInput(filter)}
                      </div>
                    );
                  });
                }

                // For grouped filters, render a collapsible section
                const isCollapsed = collapsedGroups.has(group.name);
                return (
                  <div key={group.name} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.name!)}
                      className="w-full px-4 py-2.5 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.name}</span>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {!isCollapsed && (
                      <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                        {group.filters.map((filter) => {
                          if (filter.dependsOn) {
                            const dependentValue = config[filter.dependsOn.key];
                            if (dependentValue !== filter.dependsOn.value) {
                              return null;
                            }
                          }
                          return (
                            <div key={filter.key}>
                              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                {filter.label}
                              </label>
                              {renderFilterInput(filter)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Single Image Picker - only for image widget when slideshow is NOT enabled */}
              {widget.widget_type === 'image' && !config.slideshowEnabled && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Widget Image
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSingleImagePicker(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 dark:hover:border-primary-500 transition-colors text-center"
                  >
                    <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        {(config.imageUrl || config.imageData) ? 'Change image' : 'Select image from library'}
                      </span>
                    </div>
                  </button>
                  {Boolean(config.imageUrl || config.imageData) && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={(config.imageUrl || config.imageData) as string}
                        alt="Widget image"
                        className="w-16 h-16 object-cover rounded border border-gray-200 dark:border-gray-700"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          handleConfigChange('imageUrl', undefined);
                          handleConfigChange('imageData', undefined);
                        }}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Select an image from your library or enter a URL
                  </p>
                </div>
              )}

              {/* Slideshow Images Manager - only for image widget with slideshow enabled */}
              {widget.widget_type === 'image' && Boolean(config.slideshowEnabled) && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Slideshow Images
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSlideshowPicker(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-400 dark:hover:border-primary-500 transition-colors text-center"
                  >
                    <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        {((config.slideshowImages as string[]) || []).length > 0
                          ? `${((config.slideshowImages as string[]) || []).length} images selected`
                          : 'Select images for slideshow'}
                      </span>
                    </div>
                  </button>
                  {((config.slideshowImages as string[]) || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {((config.slideshowImages as string[]) || []).slice(0, 5).map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Slide ${i + 1}`}
                          className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-gray-700"
                        />
                      ))}
                      {((config.slideshowImages as string[]) || []).length > 5 && (
                        <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                          +{((config.slideshowImages as string[]) || []).length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Port Connection Editor - for switch port overlay widgets */}
              {(widget.widget_type === 'switch-ports' || widget.widget_type === 'cross-switch-port-overlay') && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <PortConnectionEditor
                    widgetId={widget.id}
                    widgetTitle={widget.title}
                    portCount={48}
                    integrationId={widget.integration_id || (config.integrationId as string)}
                    deviceId={config.deviceId as string}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Slideshow Images Picker */}
      {showSlideshowPicker && (
        <MultiImagePicker
          value={(config.slideshowImages as string[]) || []}
          onChange={(urls) => {
            handleConfigChange('slideshowImages', urls);
            // Convert slideshowInterval to number if it's a string
            if (typeof config.slideshowInterval === 'string') {
              handleConfigChange('slideshowInterval', parseInt(config.slideshowInterval, 10));
            }
          }}
          onClose={() => setShowSlideshowPicker(false)}
          title="Select Slideshow Images"
        />
      )}

      {/* Header Image Picker */}
      {showHeaderImagePicker && (
        <ImagePicker
          value={(config.headerImageUrl as string) || undefined}
          onChange={(url) => handleConfigChange('headerImageUrl', url || '')}
          onClose={() => setShowHeaderImagePicker(false)}
          allowUpload={true}
          allowUrl={true}
          title="Select Header Image"
        />
      )}

      {/* Single Image Picker (for ImageWidget and image-select filters) */}
      {showSingleImagePicker && (
        <ImagePicker
          value={
            config._pendingImageKey
              ? (config[config._pendingImageKey as string] as string) || undefined
              : (config.imageUrl as string) || undefined
          }
          onChange={(url) => {
            if (config._pendingImageKey) {
              // Handle image-select filter
              handleConfigChange(config._pendingImageKey as string, url);
              handleConfigChange('_pendingImageKey', undefined);
            } else {
              // Handle ImageWidget
              handleConfigChange('imageUrl', url);
              // Clear imageData if selecting from library/URL
              if (url) {
                handleConfigChange('imageData', undefined);
              }
            }
          }}
          onClose={() => {
            handleConfigChange('_pendingImageKey', undefined);
            setShowSingleImagePicker(false);
          }}
          allowUpload={true}
          allowUrl={true}
          title="Select Image"
        />
      )}

      {/* Host Icon Picker (for Beszel host icons) */}
      {hostIconPickerHost && (
        <ImagePicker
          value={((config.hostIcons as Record<string, string>) || {})[hostIconPickerHost]}
          onChange={(url) => {
            const hostIcons = (config.hostIcons as Record<string, string>) || {};
            if (url) {
              handleConfigChange('hostIcons', { ...hostIcons, [hostIconPickerHost]: url });
            } else {
              const newHostIcons = { ...hostIcons };
              delete newHostIcons[hostIconPickerHost];
              handleConfigChange('hostIcons', Object.keys(newHostIcons).length > 0 ? newHostIcons : undefined);
            }
          }}
          onClose={() => setHostIconPickerHost(null)}
          allowUpload={true}
          allowUrl={true}
          allowIcons={true}
          title={`Select Icon for ${hostIconPickerHost}`}
        />
      )}
    </div>,
    document.body
  );
}
