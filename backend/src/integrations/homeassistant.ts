import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  HomeAssistantConfig,
  HomeAssistantSystemConfig,
  HomeAssistantEntity,
  HomeAssistantLogEntry,
  HomeAssistantCombinedStatus,
} from '../types';
import { logger } from '../services/logger';

export class HomeAssistantIntegration extends BaseIntegration {
  readonly type = 'homeassistant';
  readonly name = 'Home Assistant';

  private getBaseUrl(config: HomeAssistantConfig): string {
    const protocol = config.verifySSL === true ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  private createClient(config: HomeAssistantConfig): AxiosInstance {
    return axios.create({
      baseURL: this.getBaseUrl(config),
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const haConfig = config as HomeAssistantConfig;

    if (!haConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!haConfig.token) {
      return { success: false, message: 'Access token is required' };
    }

    try {
      const client = this.createClient(haConfig);

      // Test connection by getting config
      const [apiRes, configRes] = await Promise.all([
        client.get('/api/'),
        client.get('/api/config'),
      ]);

      if (apiRes.data?.message !== 'API running.') {
        return { success: false, message: 'Unexpected API response' };
      }

      const systemConfig = configRes.data as HomeAssistantSystemConfig;

      return {
        success: true,
        message: `Connected to ${systemConfig.location_name || 'Home Assistant'} v${systemConfig.version}`,
        details: {
          locationName: systemConfig.location_name,
          version: systemConfig.version,
          state: systemConfig.state,
          timezone: systemConfig.time_zone,
          components: systemConfig.components?.length || 0,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('homeassistant', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return { success: false, message: 'Authentication failed: Invalid access token' };
        }
        if (error.code === 'ECONNREFUSED') {
          return { success: false, message: `Connection refused. Is Home Assistant running on ${haConfig.host}:${haConfig.port}?` };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
          return { success: false, message: `Cannot reach ${haConfig.host}:${haConfig.port}` };
        }
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const haConfig = config as HomeAssistantConfig;
    const client = this.createClient(haConfig);

    switch (metric) {
      case 'status':
        return this.getStatus(client);
      case 'entities':
        return this.getEntities(client);
      case 'logbook':
        return this.getLogbook(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatus(client: AxiosInstance): Promise<{ status: HomeAssistantCombinedStatus }> {
    try {
      const [configRes, statesRes] = await Promise.all([
        client.get('/api/config'),
        client.get('/api/states'),
      ]);

      const systemConfig = configRes.data as HomeAssistantSystemConfig;
      const entities = statesRes.data as HomeAssistantEntity[];

      // Count entities by domain
      const domainCounts: Record<string, number> = {};
      for (const entity of entities) {
        const domain = entity.entity_id.split('.')[0];
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }

      return {
        status: {
          config: systemConfig,
          entityCount: entities.length,
          domainCounts,
        },
      };
    } catch (error) {
      logger.error('homeassistant', 'Failed to get status', { error });
      throw error;
    }
  }

  private async getEntities(client: AxiosInstance): Promise<{ entities: HomeAssistantEntity[] }> {
    try {
      const response = await client.get('/api/states');
      const entities = response.data as HomeAssistantEntity[];

      return { entities };
    } catch (error) {
      logger.error('homeassistant', 'Failed to get entities', { error });
      throw error;
    }
  }

  private async getLogbook(client: AxiosInstance): Promise<{ entries: HomeAssistantLogEntry[] }> {
    try {
      // Get logbook entries for the last 24 hours
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const timestamp = yesterday.toISOString();

      const response = await client.get(`/api/logbook/${timestamp}`);
      const entries = response.data as HomeAssistantLogEntry[];

      return { entries };
    } catch (error) {
      logger.error('homeassistant', 'Failed to get logbook', { error });
      throw error;
    }
  }

  // Call a service (turn on/off, etc.)
  async callService(
    config: IntegrationConfig,
    domain: string,
    service: string,
    data: Record<string, unknown>
  ): Promise<HomeAssistantEntity[]> {
    const haConfig = config as HomeAssistantConfig;
    const client = this.createClient(haConfig);

    try {
      const response = await client.post(`/api/services/${domain}/${service}`, data);
      logger.debug('homeassistant', `Called service ${domain}.${service}`, { data });
      return response.data as HomeAssistantEntity[];
    } catch (error) {
      logger.error('homeassistant', 'Failed to call service', { error, domain, service });
      throw error;
    }
  }

  // Perform action (used by routes/integrations.ts action endpoint)
  async performAction(
    config: IntegrationConfig,
    action: string,
    params: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; message?: string }> {
    try {
      switch (action) {
        case 'callService': {
          const { domain, service, data } = params as {
            domain: string;
            service: string;
            data: Record<string, unknown>;
          };
          if (!domain || !service) {
            return { success: false, message: 'Missing domain or service parameter' };
          }
          const result = await this.callService(config, domain, service, data || {});
          return { success: true, data: result };
        }
        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, message: errorMsg };
    }
  }

  // Get a single entity state
  async getEntityState(
    config: IntegrationConfig,
    entityId: string
  ): Promise<HomeAssistantEntity | null> {
    const haConfig = config as HomeAssistantConfig;
    const client = this.createClient(haConfig);

    try {
      const response = await client.get(`/api/states/${entityId}`);
      return response.data as HomeAssistantEntity;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('homeassistant', 'Failed to get entity state', { error, entityId });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'status',
        name: 'System Status',
        description: 'Home Assistant config, version, and entity counts',
        widgetTypes: ['homeassistant-status'],
      },
      {
        id: 'entities',
        name: 'Entities',
        description: 'All Home Assistant entities with states',
        widgetTypes: ['homeassistant-entities', 'homeassistant-entity-control'],
      },
      {
        id: 'logbook',
        name: 'Logbook',
        description: 'Recent activity and state changes',
        widgetTypes: ['homeassistant-logbook'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // API & Config - Implemented
      {
        id: 'api-status',
        name: 'Get API Status',
        description: 'Check if API is running and get basic info',
        method: 'GET',
        endpoint: '/api/',
        implemented: true,
        category: 'System',
        documentationUrl: 'https://developers.home-assistant.io/docs/api/rest',
      },
      {
        id: 'config',
        name: 'Get Config',
        description: 'Get Home Assistant configuration',
        method: 'GET',
        endpoint: '/api/config',
        implemented: true,
        category: 'System',
      },
      {
        id: 'discovery-info',
        name: 'Get Discovery Info',
        description: 'Get discovery information for the instance',
        method: 'GET',
        endpoint: '/api/discovery_info',
        implemented: false,
        category: 'System',
      },

      // States - Implemented
      {
        id: 'states-list',
        name: 'List All States',
        description: 'Get states of all entities',
        method: 'GET',
        endpoint: '/api/states',
        implemented: true,
        category: 'States',
      },
      {
        id: 'state-get',
        name: 'Get Entity State',
        description: 'Get state of a specific entity',
        method: 'GET',
        endpoint: '/api/states/{entity_id}',
        implemented: true,
        category: 'States',
        parameters: [
          { name: 'entity_id', type: 'string', required: true, description: 'Entity ID (e.g., light.living_room)' },
        ],
      },
      {
        id: 'state-set',
        name: 'Set Entity State',
        description: 'Set state of an entity (for testing/debugging)',
        method: 'POST',
        endpoint: '/api/states/{entity_id}',
        implemented: false,
        category: 'States',
      },

      // Services
      {
        id: 'services-list',
        name: 'List Services',
        description: 'Get list of available services',
        method: 'GET',
        endpoint: '/api/services',
        implemented: false,
        category: 'Services',
      },
      {
        id: 'service-call',
        name: 'Call Service',
        description: 'Call a service (turn on light, etc.)',
        method: 'POST',
        endpoint: '/api/services/{domain}/{service}',
        implemented: false,
        category: 'Services',
        parameters: [
          { name: 'domain', type: 'string', required: true, description: 'Service domain (light, switch, etc.)' },
          { name: 'service', type: 'string', required: true, description: 'Service name (turn_on, turn_off, etc.)' },
          { name: 'entity_id', type: 'string', required: false, description: 'Target entity' },
        ],
      },

      // Events
      {
        id: 'events-list',
        name: 'List Event Types',
        description: 'Get list of available event types',
        method: 'GET',
        endpoint: '/api/events',
        implemented: false,
        category: 'Events',
      },
      {
        id: 'event-fire',
        name: 'Fire Event',
        description: 'Fire a custom event',
        method: 'POST',
        endpoint: '/api/events/{event_type}',
        implemented: false,
        category: 'Events',
      },

      // History - Implemented
      {
        id: 'history',
        name: 'Get History',
        description: 'Get state history for entities',
        method: 'GET',
        endpoint: '/api/history/period/{timestamp}',
        implemented: false,
        category: 'History',
        parameters: [
          { name: 'timestamp', type: 'string', required: false, description: 'Start time (ISO 8601)' },
          { name: 'filter_entity_id', type: 'string', required: false, description: 'Filter by entity ID' },
        ],
      },

      // Logbook - Implemented
      {
        id: 'logbook',
        name: 'Get Logbook',
        description: 'Get logbook entries',
        method: 'GET',
        endpoint: '/api/logbook/{timestamp}',
        implemented: true,
        category: 'History',
        parameters: [
          { name: 'timestamp', type: 'string', required: false, description: 'Start time (ISO 8601)' },
          { name: 'entity', type: 'string', required: false, description: 'Filter by entity ID' },
        ],
      },

      // Error Log
      {
        id: 'error-log',
        name: 'Get Error Log',
        description: 'Get Home Assistant error log',
        method: 'GET',
        endpoint: '/api/error_log',
        implemented: false,
        category: 'System',
      },

      // Camera
      {
        id: 'camera-proxy',
        name: 'Get Camera Image',
        description: 'Get current camera image',
        method: 'GET',
        endpoint: '/api/camera_proxy/{entity_id}',
        implemented: false,
        category: 'Camera',
      },

      // Calendars
      {
        id: 'calendars-list',
        name: 'List Calendars',
        description: 'Get list of calendar entities',
        method: 'GET',
        endpoint: '/api/calendars',
        implemented: false,
        category: 'Calendars',
      },
      {
        id: 'calendar-events',
        name: 'Get Calendar Events',
        description: 'Get events from a calendar',
        method: 'GET',
        endpoint: '/api/calendars/{entity_id}',
        implemented: false,
        category: 'Calendars',
      },

      // Templates
      {
        id: 'render-template',
        name: 'Render Template',
        description: 'Render a Jinja2 template',
        method: 'POST',
        endpoint: '/api/template',
        implemented: false,
        category: 'Utilities',
      },

      // Check Config
      {
        id: 'check-config',
        name: 'Check Configuration',
        description: 'Validate Home Assistant configuration',
        method: 'POST',
        endpoint: '/api/config/core/check_config',
        implemented: false,
        category: 'System',
      },

      // Intents
      {
        id: 'intent-handle',
        name: 'Handle Intent',
        description: 'Process a conversation intent',
        method: 'POST',
        endpoint: '/api/intent/handle',
        implemented: false,
        category: 'Conversation',
      },

      // Shopping List
      {
        id: 'shopping-list',
        name: 'Get Shopping List',
        description: 'Get shopping list items',
        method: 'GET',
        endpoint: '/api/shopping_list',
        implemented: false,
        category: 'Shopping List',
      },
      {
        id: 'shopping-list-add',
        name: 'Add Shopping Item',
        description: 'Add item to shopping list',
        method: 'POST',
        endpoint: '/api/shopping_list/item',
        implemented: false,
        category: 'Shopping List',
      },

      // Companion App
      {
        id: 'mobile-app-registrations',
        name: 'List Mobile Registrations',
        description: 'Get registered mobile app devices',
        method: 'GET',
        endpoint: '/api/mobile_app/registrations',
        implemented: false,
        category: 'Mobile',
      },

      // Persons
      {
        id: 'persons',
        name: 'Get Persons',
        description: 'Get configured persons',
        method: 'GET',
        endpoint: '/api/config/person',
        implemented: false,
        category: 'People',
      },

      // Zones
      {
        id: 'zones',
        name: 'Get Zones',
        description: 'Get configured zones',
        method: 'GET',
        endpoint: '/api/config/zone',
        implemented: false,
        category: 'Location',
      },

      // Automations
      {
        id: 'automations-list',
        name: 'List Automations',
        description: 'Get configured automations',
        method: 'GET',
        endpoint: '/api/config/automation/config',
        implemented: false,
        category: 'Automations',
      },
      {
        id: 'automation-trigger',
        name: 'Trigger Automation',
        description: 'Manually trigger an automation',
        method: 'POST',
        endpoint: '/api/services/automation/trigger',
        implemented: false,
        category: 'Automations',
      },

      // Scripts
      {
        id: 'scripts-list',
        name: 'List Scripts',
        description: 'Get configured scripts',
        method: 'GET',
        endpoint: '/api/config/script/config',
        implemented: false,
        category: 'Scripts',
      },
      {
        id: 'script-run',
        name: 'Run Script',
        description: 'Execute a script',
        method: 'POST',
        endpoint: '/api/services/script/{script_id}',
        implemented: false,
        category: 'Scripts',
      },

      // Scenes
      {
        id: 'scenes-list',
        name: 'List Scenes',
        description: 'Get configured scenes',
        method: 'GET',
        endpoint: '/api/config/scene/config',
        implemented: false,
        category: 'Scenes',
      },
      {
        id: 'scene-activate',
        name: 'Activate Scene',
        description: 'Activate a scene',
        method: 'POST',
        endpoint: '/api/services/scene/turn_on',
        implemented: false,
        category: 'Scenes',
      },

      // Restart/Reload
      {
        id: 'restart',
        name: 'Restart Home Assistant',
        description: 'Restart the Home Assistant service',
        method: 'POST',
        endpoint: '/api/services/homeassistant/restart',
        implemented: false,
        category: 'System',
      },
      {
        id: 'reload-core',
        name: 'Reload Core Config',
        description: 'Reload core configuration',
        method: 'POST',
        endpoint: '/api/services/homeassistant/reload_core_config',
        implemented: false,
        category: 'System',
      },
    ];
  }
}
