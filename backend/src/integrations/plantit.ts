import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationConfig, IntegrationData } from '../types';
import { logger } from '../services/logger';

interface PlantitConfig {
  host: string;
  port: number;
  apiKey?: string;
  username?: string;
  password?: string;
  verifySSL?: boolean;
}

interface TokenCache {
  token: string;
  expiry: number;
}

const tokenCache = new Map<string, TokenCache>();

export class PlantitIntegration extends BaseIntegration {
  readonly type = 'plantit';
  readonly name = 'Plant-it';

  private getConfigKey(config: PlantitConfig): string {
    return `plantit_${config.host}_${config.port}`;
  }

  private getBaseUrl(config: PlantitConfig): string {
    const protocol = config.verifySSL ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  private async getAuthToken(config: PlantitConfig): Promise<string> {
    // If API key is provided directly, use it
    if (config.apiKey) {
      return config.apiKey;
    }

    // Otherwise, get token via username/password
    const cacheKey = this.getConfigKey(config);
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.token;
    }

    if (!config.username || !config.password) {
      throw new Error('API key or username/password required');
    }

    try {
      const response = await axios.post(
        `${this.getBaseUrl(config)}/api/authentication/login`,
        {
          username: config.username,
          password: config.password,
        },
        {
          httpsAgent: new https.Agent({
            rejectUnauthorized: config.verifySSL ?? false,
          }),
          timeout: 15000,
        }
      );

      const token = response.data.jwt?.value || response.data.token;
      if (!token) {
        throw new Error('No token in response');
      }

      tokenCache.set(cacheKey, {
        token,
        expiry: Date.now() + 23 * 60 * 60 * 1000, // 23 hours (JWT typically lasts 24h)
      });

      return token;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('plantit', 'Failed to get auth token', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  private async createClient(config: PlantitConfig): Promise<AxiosInstance> {
    const token = await this.getAuthToken(config);

    return axios.create({
      baseURL: `${this.getBaseUrl(config)}/api`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Key': config.apiKey || token,
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const plConfig = config as unknown as PlantitConfig;

    if (!plConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!plConfig.port) {
      return { success: false, message: 'Port is required' };
    }
    if (!plConfig.apiKey && (!plConfig.username || !plConfig.password)) {
      return { success: false, message: 'API key or username/password required' };
    }

    try {
      const client = await this.createClient(plConfig);
      const response = await client.get('/plant');

      const plantCount = Array.isArray(response.data) ? response.data.length : 0;

      return {
        success: true,
        message: `Connected to Plant-it (${plantCount} plants)`,
        details: { plantCount },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('plantit', 'Connection test failed', { error: errorMsg });

      if (errorMsg.includes('401') || errorMsg.includes('403')) {
        return { success: false, message: 'Invalid credentials or API key' };
      }
      if (errorMsg.includes('ECONNREFUSED')) {
        return { success: false, message: `Connection refused at ${plConfig.host}:${plConfig.port}` };
      }
      if (errorMsg.includes('ENOTFOUND')) {
        return { success: false, message: `Host not found: ${plConfig.host}` };
      }
      if (errorMsg.includes('certificate')) {
        return { success: false, message: 'SSL certificate error. Try disabling SSL verification.' };
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const plConfig = config as unknown as PlantitConfig;
    const client = await this.createClient(plConfig);

    // Handle plant-detail:${plantId} format
    if (metric.startsWith('plant-detail:')) {
      const plantId = parseInt(metric.split(':')[1], 10);
      return this.getPlantDetail(client, plantId);
    }

    switch (metric) {
      case 'statistics':
        return this.getStatistics(client);
      case 'plants':
        return this.getPlants(client);
      case 'events':
        return this.getEvents(client);
      case 'reminders':
        return this.getReminders(client);
      case 'plant-detail':
        throw new Error('plantId is required for plant-detail metric');
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getStatistics(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [plantsRes, eventsRes, remindersRes] = await Promise.all([
        client.get('/plant'),
        client.get('/diary/entry'),
        client.get('/reminder'),
      ]);

      const plants = Array.isArray(plantsRes.data) ? plantsRes.data : [];
      const events = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      const reminders = Array.isArray(remindersRes.data) ? remindersRes.data : [];

      // Count overdue reminders
      const now = new Date();
      const overdueCount = reminders.filter((r: { nextTrigger?: string }) => {
        if (!r.nextTrigger) return false;
        return new Date(r.nextTrigger) < now;
      }).length;

      // Count photos (assuming plants have photos)
      const photoCount = plants.reduce((acc: number, p: { images?: unknown[] }) => {
        return acc + (p.images?.length || 0);
      }, 0);

      // Get unique species
      const speciesSet = new Set(plants.map((p: { species?: { scientificName?: string } }) =>
        p.species?.scientificName
      ).filter(Boolean));

      return {
        statistics: {
          plantCount: plants.length,
          eventCount: events.length,
          reminderCount: reminders.length,
          photoCount,
          speciesCount: speciesSet.size,
          overdueReminders: overdueCount,
        },
      };
    } catch (error) {
      logger.error('plantit', 'Failed to get statistics', { error });
      throw error;
    }
  }

  private async getPlants(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/plant');
      const plants = Array.isArray(response.data) ? response.data : [];

      // Get last watering events for each plant
      const eventsRes = await client.get('/diary/entry');
      const events = Array.isArray(eventsRes.data) ? eventsRes.data : [];

      // Map last watering per plant
      const lastWatered = new Map<number, string>();
      events
        .filter((e: { type?: string }) => e.type === 'WATERING')
        .sort((a: { date?: string }, b: { date?: string }) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        )
        .forEach((e: { plantId?: number; date?: string }) => {
          if (e.plantId && !lastWatered.has(e.plantId)) {
            lastWatered.set(e.plantId, e.date || '');
          }
        });

      const enrichedPlants = plants.map((plant: {
        id: number;
        personalName?: string;
        info?: { personalName?: string };
        species?: { scientificName?: string; family?: string };
        location?: string;
        avatarImageId?: string;
        images?: unknown[];
        purchasedPrice?: number;
        currencySymbol?: string;
        state?: string;
      }) => ({
        id: plant.id,
        personalName: plant.info?.personalName || plant.personalName || `Plant ${plant.id}`,
        species: plant.species?.scientificName || 'Unknown Species',
        family: plant.species?.family || '',
        location: plant.location || '',
        thumbnailId: plant.avatarImageId || (plant.images?.[0] as { id?: string })?.id,
        photoCount: plant.images?.length || 0,
        lastWatered: lastWatered.get(plant.id) || null,
        purchasedPrice: plant.purchasedPrice,
        currencySymbol: plant.currencySymbol,
        state: plant.state,
      }));

      return {
        plants: enrichedPlants,
        total: plants.length,
      };
    } catch (error) {
      logger.error('plantit', 'Failed to get plants', { error });
      throw error;
    }
  }

  private async getEvents(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [eventsRes, plantsRes] = await Promise.all([
        client.get('/diary/entry'),
        client.get('/plant'),
      ]);

      const events = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      const plants = Array.isArray(plantsRes.data) ? plantsRes.data : [];

      // Create plant lookup map
      const plantMap = new Map<number, string>();
      plants.forEach((p: { id: number; info?: { personalName?: string }; personalName?: string }) => {
        plantMap.set(p.id, p.info?.personalName || p.personalName || `Plant ${p.id}`);
      });

      // Sort by date descending and take recent
      const sortedEvents = events
        .sort((a: { date?: string }, b: { date?: string }) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        )
        .slice(0, 50)
        .map((event: {
          id: number;
          type?: string;
          plantId?: number;
          date?: string;
          note?: string;
        }) => ({
          id: event.id,
          type: event.type || 'UNKNOWN',
          plantId: event.plantId,
          plantName: event.plantId ? plantMap.get(event.plantId) || 'Unknown Plant' : 'Unknown Plant',
          date: event.date,
          notes: event.note,
        }));

      return {
        events: sortedEvents,
        total: events.length,
      };
    } catch (error) {
      logger.error('plantit', 'Failed to get events', { error });
      throw error;
    }
  }

  private async getReminders(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [remindersRes, plantsRes] = await Promise.all([
        client.get('/reminder'),
        client.get('/plant'),
      ]);

      const reminders = Array.isArray(remindersRes.data) ? remindersRes.data : [];
      const plants = Array.isArray(plantsRes.data) ? plantsRes.data : [];

      // Create plant lookup map
      const plantMap = new Map<number, string>();
      plants.forEach((p: { id: number; info?: { personalName?: string }; personalName?: string }) => {
        plantMap.set(p.id, p.info?.personalName || p.personalName || `Plant ${p.id}`);
      });

      const now = new Date();
      const enrichedReminders = reminders.map((reminder: {
        id: number;
        plantId?: number;
        targetId?: number;
        action?: string;
        type?: string;
        frequency?: { type?: string; quantity?: number };
        frequencyQuantity?: number;
        frequencyUnit?: string;
        nextTrigger?: string;
        lastTriggered?: string;
        enabled?: boolean;
      }) => {
        const plantId = reminder.plantId || reminder.targetId;
        const nextDue = reminder.nextTrigger ? new Date(reminder.nextTrigger) : null;
        const isOverdue = nextDue ? nextDue < now : false;

        return {
          id: reminder.id,
          plantId,
          plantName: plantId ? plantMap.get(plantId) || 'Unknown Plant' : 'Unknown Plant',
          type: reminder.action || reminder.type || 'UNKNOWN',
          frequency: reminder.frequency?.type || reminder.frequencyUnit || '',
          frequencyAmount: reminder.frequency?.quantity || reminder.frequencyQuantity || 0,
          nextDue: reminder.nextTrigger,
          lastTriggered: reminder.lastTriggered,
          overdue: isOverdue,
          enabled: reminder.enabled !== false,
        };
      });

      // Sort: overdue first, then by next due date
      enrichedReminders.sort((a: { overdue: boolean; nextDue?: string | null }, b: { overdue: boolean; nextDue?: string | null }) => {
        if (a.overdue && !b.overdue) return -1;
        if (!a.overdue && b.overdue) return 1;
        if (!a.nextDue || !b.nextDue) return 0;
        return new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime();
      });

      const overdueCount = enrichedReminders.filter((r: { overdue: boolean }) => r.overdue).length;
      const upcomingCount = enrichedReminders.filter((r: { overdue: boolean; enabled: boolean }) =>
        !r.overdue && r.enabled
      ).length;

      return {
        reminders: enrichedReminders,
        overdueCount,
        upcomingCount,
        total: reminders.length,
      };
    } catch (error) {
      logger.error('plantit', 'Failed to get reminders', { error });
      throw error;
    }
  }

  private async getPlantDetail(client: AxiosInstance, plantId: number): Promise<IntegrationData> {
    try {
      const [plantRes, eventsRes, remindersRes] = await Promise.all([
        client.get(`/plant/${plantId}`),
        client.get(`/diary/entry?plantId=${plantId}`),
        client.get(`/reminder?plantId=${plantId}`),
      ]);

      const plant = plantRes.data;
      const events = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      const reminders = Array.isArray(remindersRes.data) ? remindersRes.data : [];

      // Sort events by date descending
      const recentEvents = events
        .sort((a: { date?: string }, b: { date?: string }) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        )
        .slice(0, 10);

      const now = new Date();
      const overdueReminders = reminders.filter((r: { nextTrigger?: string }) => {
        if (!r.nextTrigger) return false;
        return new Date(r.nextTrigger) < now;
      });

      return {
        plant: {
          id: plant.id,
          personalName: plant.info?.personalName || plant.personalName || `Plant ${plant.id}`,
          species: plant.species?.scientificName || 'Unknown Species',
          family: plant.species?.family || '',
          location: plant.location || '',
          avatarImageId: plant.avatarImageId,
          images: plant.images || [],
          purchasedPrice: plant.purchasedPrice,
          currencySymbol: plant.currencySymbol,
          state: plant.state,
          note: plant.note,
          birthDate: plant.info?.startDate,
        },
        recentEvents,
        reminders,
        overdueCount: overdueReminders.length,
      };
    } catch (error) {
      logger.error('plantit', 'Failed to get plant detail', { error, plantId });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'statistics',
        name: 'Statistics',
        description: 'Plant collection statistics',
        widgetTypes: ['plantit-stats'],
      },
      {
        id: 'plants',
        name: 'Plants',
        description: 'Plant collection',
        widgetTypes: ['plantit-plants'],
      },
      {
        id: 'events',
        name: 'Events',
        description: 'Recent care events',
        widgetTypes: ['plantit-events'],
      },
      {
        id: 'reminders',
        name: 'Reminders',
        description: 'Care reminders',
        widgetTypes: ['plantit-reminders'],
      },
      {
        id: 'plant-detail',
        name: 'Plant Detail',
        description: 'Single plant details',
        widgetTypes: ['plantit-plant-detail'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-login',
        name: 'Login',
        description: 'Authenticate with username and password to get JWT token',
        method: 'POST',
        endpoint: '/authentication/login',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
        ],
      },
      {
        id: 'api-key-list',
        name: 'List API Keys',
        description: 'Get all API keys for the current user',
        method: 'GET',
        endpoint: '/api-key',
        implemented: false,
        category: 'Authentication',
      },
      {
        id: 'api-key-create',
        name: 'Create API Key',
        description: 'Create a new API key',
        method: 'POST',
        endpoint: '/api-key',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'name', type: 'string', required: false, description: 'API key name' },
        ],
      },

      // Plants
      {
        id: 'plant-list',
        name: 'List Plants',
        description: 'Get all plants in your collection',
        method: 'GET',
        endpoint: '/plant',
        implemented: true,
        category: 'Plants',
      },
      {
        id: 'plant-get',
        name: 'Get Plant',
        description: 'Get a single plant by ID',
        method: 'GET',
        endpoint: '/plant/{id}',
        implemented: true,
        category: 'Plants',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Plant ID' },
        ],
      },
      {
        id: 'plant-create',
        name: 'Create Plant',
        description: 'Add a new plant to your collection',
        method: 'POST',
        endpoint: '/plant',
        implemented: false,
        category: 'Plants',
        parameters: [
          { name: 'personalName', type: 'string', required: false, description: 'Personal name for the plant' },
          { name: 'speciesId', type: 'number', required: false, description: 'Species ID from botanical info' },
          { name: 'location', type: 'string', required: false, description: 'Plant location' },
        ],
      },
      {
        id: 'plant-update',
        name: 'Update Plant',
        description: 'Update plant details',
        method: 'PUT',
        endpoint: '/plant/{id}',
        implemented: false,
        category: 'Plants',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Plant ID' },
          { name: 'personalName', type: 'string', required: false, description: 'Personal name' },
          { name: 'location', type: 'string', required: false, description: 'Location' },
        ],
      },
      {
        id: 'plant-delete',
        name: 'Delete Plant',
        description: 'Remove a plant from your collection',
        method: 'DELETE',
        endpoint: '/plant/{id}',
        implemented: false,
        category: 'Plants',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Plant ID' },
        ],
      },
      {
        id: 'plant-thumbnail',
        name: 'Get Plant Thumbnail',
        description: 'Get thumbnail image for a plant',
        method: 'GET',
        endpoint: '/plant/{id}/thumbnail',
        implemented: false,
        category: 'Plants',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Plant ID' },
        ],
      },

      // Diary Entries (Events)
      {
        id: 'diary-list',
        name: 'List Diary Entries',
        description: 'Get all diary entries (care events)',
        method: 'GET',
        endpoint: '/diary/entry',
        implemented: true,
        category: 'Events',
        parameters: [
          { name: 'plantId', type: 'number', required: false, description: 'Filter by plant ID' },
        ],
      },
      {
        id: 'diary-get',
        name: 'Get Diary Entry',
        description: 'Get a single diary entry by ID',
        method: 'GET',
        endpoint: '/diary/entry/{id}',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Entry ID' },
        ],
      },
      {
        id: 'diary-create',
        name: 'Create Diary Entry',
        description: 'Log a new care event',
        method: 'POST',
        endpoint: '/diary/entry',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'plantId', type: 'number', required: true, description: 'Plant ID' },
          { name: 'type', type: 'string', required: true, description: 'Event type: WATERING, FERTILIZING, BIOSTIMULATING, MISTING, TRANSPLANTING, PRUNING, PROPAGATING, TREATMENT' },
          { name: 'date', type: 'string', required: false, description: 'Event date (ISO format)' },
          { name: 'note', type: 'string', required: false, description: 'Event note' },
        ],
      },
      {
        id: 'diary-delete',
        name: 'Delete Diary Entry',
        description: 'Delete a diary entry',
        method: 'DELETE',
        endpoint: '/diary/entry/{id}',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Entry ID' },
        ],
      },

      // Reminders
      {
        id: 'reminder-list',
        name: 'List Reminders',
        description: 'Get all reminders',
        method: 'GET',
        endpoint: '/reminder',
        implemented: true,
        category: 'Reminders',
        parameters: [
          { name: 'plantId', type: 'number', required: false, description: 'Filter by plant ID' },
        ],
      },
      {
        id: 'reminder-get',
        name: 'Get Reminder',
        description: 'Get a single reminder by ID',
        method: 'GET',
        endpoint: '/reminder/{id}',
        implemented: false,
        category: 'Reminders',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Reminder ID' },
        ],
      },
      {
        id: 'reminder-create',
        name: 'Create Reminder',
        description: 'Create a new reminder',
        method: 'POST',
        endpoint: '/reminder',
        implemented: false,
        category: 'Reminders',
        parameters: [
          { name: 'plantId', type: 'number', required: true, description: 'Plant ID' },
          { name: 'action', type: 'string', required: true, description: 'Reminder action type' },
          { name: 'frequencyQuantity', type: 'number', required: true, description: 'Frequency amount' },
          { name: 'frequencyUnit', type: 'string', required: true, description: 'Frequency unit: DAYS, WEEKS, MONTHS' },
        ],
      },
      {
        id: 'reminder-update',
        name: 'Update Reminder',
        description: 'Update a reminder',
        method: 'PUT',
        endpoint: '/reminder/{id}',
        implemented: false,
        category: 'Reminders',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Reminder ID' },
        ],
      },
      {
        id: 'reminder-delete',
        name: 'Delete Reminder',
        description: 'Delete a reminder',
        method: 'DELETE',
        endpoint: '/reminder/{id}',
        implemented: false,
        category: 'Reminders',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Reminder ID' },
        ],
      },

      // Botanical Info (Species)
      {
        id: 'species-search',
        name: 'Search Species',
        description: 'Search botanical/species information',
        method: 'GET',
        endpoint: '/botanical-info',
        implemented: false,
        category: 'Species',
        parameters: [
          { name: 'query', type: 'string', required: false, description: 'Search query' },
        ],
      },
      {
        id: 'species-get',
        name: 'Get Species',
        description: 'Get species information by ID',
        method: 'GET',
        endpoint: '/botanical-info/{id}',
        implemented: false,
        category: 'Species',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'Species ID' },
        ],
      },

      // Images
      {
        id: 'image-get',
        name: 'Get Image',
        description: 'Get an image by ID',
        method: 'GET',
        endpoint: '/image/{id}',
        implemented: false,
        category: 'Images',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Image ID' },
        ],
      },
      {
        id: 'image-upload',
        name: 'Upload Image',
        description: 'Upload an image for a plant',
        method: 'POST',
        endpoint: '/image/plant/{plantId}',
        implemented: false,
        category: 'Images',
        parameters: [
          { name: 'plantId', type: 'number', required: true, description: 'Plant ID' },
          { name: 'image', type: 'file', required: true, description: 'Image file' },
        ],
      },
      {
        id: 'image-delete',
        name: 'Delete Image',
        description: 'Delete an image',
        method: 'DELETE',
        endpoint: '/image/{id}',
        implemented: false,
        category: 'Images',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Image ID' },
        ],
      },

      // Stats
      {
        id: 'stats',
        name: 'Get Statistics',
        description: 'Get global statistics',
        method: 'GET',
        endpoint: '/stats',
        implemented: false,
        category: 'Statistics',
      },
    ];
  }

  async executeCapability(
    config: IntegrationConfig,
    capabilityId: string,
    method: string,
    endpoint: string,
    parameters?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string; statusCode?: number }> {
    const plConfig = config as unknown as PlantitConfig;

    try {
      const client = await this.createClient(plConfig);

      // Replace path parameters
      let resolvedEndpoint = endpoint;
      if (parameters) {
        Object.entries(parameters).forEach(([key, value]) => {
          resolvedEndpoint = resolvedEndpoint.replace(`{${key}}`, String(value));
        });
      }

      // Build query params for GET requests
      const queryParams: Record<string, unknown> = {};
      if (method === 'GET' && parameters) {
        Object.entries(parameters).forEach(([key, value]) => {
          if (!endpoint.includes(`{${key}}`)) {
            queryParams[key] = value;
          }
        });
      }

      // Build body for non-GET requests
      const body: Record<string, unknown> = {};
      if (method !== 'GET' && parameters) {
        Object.entries(parameters).forEach(([key, value]) => {
          if (!endpoint.includes(`{${key}}`)) {
            body[key] = value;
          }
        });
      }

      const response = await client.request({
        method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: resolvedEndpoint,
        params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        data: Object.keys(body).length > 0 ? body : undefined,
      });

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          statusCode: error.response?.status,
          data: error.response?.data,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
