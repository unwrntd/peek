import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  UnifiProtectConfig,
  ProtectCamera,
  ProtectSensor,
  ProtectLight,
  ProtectChime,
  ProtectNvr,
  ProtectEvent,
} from '../types';
import { logger } from '../services/logger';

// Session cache for cookie-based auth
interface CachedSession {
  cookies: string[];
  csrfToken?: string;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();

export class UnifiProtectIntegration extends BaseIntegration {
  readonly type = 'unifi-protect';
  readonly name = 'UniFi Protect';

  private getCacheKey(config: UnifiProtectConfig): string {
    return `${config.host}:${config.port}:${config.username || 'api'}`;
  }

  private clearSessionCache(config: UnifiProtectConfig): void {
    const key = this.getCacheKey(config);
    sessionCache.delete(key);
  }

  private createClient(config: UnifiProtectConfig): AxiosInstance {
    const baseURL = `https://${config.host}:${config.port || 443}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    // If using API key, set the header
    if (config.apiKey) {
      headers['X-API-KEY'] = config.apiKey;
    }

    const client = axios.create({
      baseURL,
      headers,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
      withCredentials: true,
    });

    client.interceptors.response.use(
      (response) => {
        logger.debug('unifi-protect', 'Response received', {
          url: response.config.url,
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.debug('unifi-protect', 'Request error', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );

    return client;
  }

  private isApiKeyAuth(config: UnifiProtectConfig): boolean {
    return !!config.apiKey && !config.username;
  }

  // Get authenticated session (cookie-based auth)
  private async getAuthenticatedSession(
    client: AxiosInstance,
    config: UnifiProtectConfig
  ): Promise<{ cookies: string[]; csrfToken?: string }> {
    const cacheKey = this.getCacheKey(config);
    const cached = sessionCache.get(cacheKey);

    // Return cached session if valid
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('unifi-protect', 'Using cached session');
      return { cookies: cached.cookies, csrfToken: cached.csrfToken };
    }

    // Login to get session
    logger.debug('unifi-protect', 'Logging in to UniFi Protect');

    try {
      const loginResponse = await client.post('/api/auth/login', {
        username: config.username,
        password: config.password,
        rememberMe: true,
      });

      const setCookies = loginResponse.headers['set-cookie'] || [];
      const csrfToken = loginResponse.headers['x-csrf-token'] ||
                       loginResponse.headers['x-updated-csrf-token'];

      // Cache session for 30 minutes
      const session: CachedSession = {
        cookies: setCookies,
        csrfToken,
        expiresAt: Date.now() + 30 * 60 * 1000,
      };
      sessionCache.set(cacheKey, session);

      logger.debug('unifi-protect', 'Login successful', { hasCsrf: !!csrfToken });
      return { cookies: setCookies, csrfToken };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('unifi-protect', 'Login failed', { error: errorMsg });
      throw new Error(`Login failed: ${errorMsg}`);
    }
  }

  // Apply session cookies and CSRF token to client
  private applySession(
    client: AxiosInstance,
    cookies: string[],
    csrfToken?: string
  ): void {
    if (cookies.length > 0) {
      const cookieString = cookies
        .map((c) => c.split(';')[0])
        .join('; ');
      client.defaults.headers.common['Cookie'] = cookieString;
    }
    if (csrfToken) {
      client.defaults.headers.common['X-CSRF-Token'] = csrfToken;
    }
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const protectConfig = config as UnifiProtectConfig;
    const client = this.createClient(protectConfig);

    try {
      // If using username/password, authenticate first
      if (!this.isApiKeyAuth(protectConfig) && protectConfig.username) {
        // Clear cache for fresh test
        this.clearSessionCache(protectConfig);
        const session = await this.getAuthenticatedSession(client, protectConfig);
        this.applySession(client, session.cookies, session.csrfToken);
      }

      // Test by fetching bootstrap (contains NVR info and all devices)
      const response = await client.get('/proxy/protect/api/bootstrap');
      const data = response.data;
      const nvr = data.nvr || data;

      return {
        success: true,
        message: `Connected to UniFi Protect - ${nvr.name || 'NVR'}`,
        details: {
          name: nvr.name,
          version: nvr.version,
          firmwareVersion: nvr.firmwareVersion,
          cameras: data.cameras?.length || 0,
          sensors: data.sensors?.length || 0,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('unifi-protect', 'Connection test failed', { error: errorMsg });

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const protectConfig = config as UnifiProtectConfig;
    const client = this.createClient(protectConfig);

    // If using username/password, authenticate first
    if (!this.isApiKeyAuth(protectConfig) && protectConfig.username) {
      const session = await this.getAuthenticatedSession(client, protectConfig);
      this.applySession(client, session.cookies, session.csrfToken);
    }

    switch (metric) {
      case 'cameras':
        return this.getCameras(client);
      case 'sensors':
        return this.getSensors(client);
      case 'lights':
        return this.getLights(client);
      case 'chimes':
        return this.getChimes(client);
      case 'nvr':
        return this.getNvrStatus(client);
      case 'events':
        return this.getRecentEvents(client);
      case 'smart-detections':
        return this.getSmartDetections(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getCameras(client: AxiosInstance): Promise<{ cameras: ProtectCamera[] }> {
    const response = await client.get('/proxy/protect/api/cameras');
    const rawCameras = response.data || [];

    const cameras: ProtectCamera[] = rawCameras.map((c: Record<string, unknown>) => ({
      id: c.id as string,
      name: c.name as string || 'Unknown Camera',
      type: c.type as string,
      model: c.model as string || c.marketName as string || 'Unknown',
      mac: c.mac as string,
      state: c.state as 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED',
      isRecording: c.isRecording as boolean || false,
      isMotionDetected: c.isMotionDetected as boolean || false,
      lastMotion: c.lastMotion as number | null,
      isMicEnabled: c.isMicEnabled as boolean || false,
      micVolume: c.micVolume as number || 0,
      videoMode: c.videoMode as string || 'default',
      hdrType: c.hdrType as string || 'off',
      featureFlags: {
        hasSmartDetect: (c.featureFlags as Record<string, unknown>)?.hasSmartDetect as boolean || false,
        smartDetectTypes: (c.featureFlags as Record<string, unknown>)?.smartDetectTypes as string[] || [],
        hasHdr: (c.featureFlags as Record<string, unknown>)?.hasHdr as boolean || false,
        hasChime: (c.featureFlags as Record<string, unknown>)?.hasChime as boolean || false,
        hasSpeaker: (c.featureFlags as Record<string, unknown>)?.hasSpeaker as boolean || false,
      },
      lastSeen: c.lastSeen as number | null,
      uptime: c.uptime as number | null,
      firmwareVersion: c.firmwareVersion as string | null,
    }));

    logger.debug('unifi-protect', `Fetched ${cameras.length} cameras`);
    return { cameras };
  }

  private async getSensors(client: AxiosInstance): Promise<{ sensors: ProtectSensor[] }> {
    const response = await client.get('/proxy/protect/api/sensors');
    const rawSensors = response.data || [];

    const sensors: ProtectSensor[] = rawSensors.map((s: Record<string, unknown>) => {
      const stats = s.stats as Record<string, Record<string, unknown>> | undefined;
      return {
        id: s.id as string,
        name: s.name as string || 'Unknown Sensor',
        type: s.type as string,
        model: s.model as string || s.marketName as string || 'Unknown',
        mac: s.mac as string,
        state: s.state as 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED',
        mountType: s.mountType as 'door' | 'window' | 'garage' | 'leak' | 'none' || 'none',
        batteryStatus: {
          percentage: (s.batteryStatus as Record<string, unknown>)?.percentage as number | null,
          isLow: (s.batteryStatus as Record<string, unknown>)?.isLow as boolean || false,
        },
        isOpened: s.isOpened as boolean | null,
        openStatusChangedAt: s.openStatusChangedAt as number | null,
        isMotionDetected: s.isMotionDetected as boolean || false,
        motionDetectedAt: s.motionDetectedAt as number | null,
        leakDetectedAt: s.leakDetectedAt as number | null,
        tamperingDetectedAt: s.tamperingDetectedAt as number | null,
        alarmTriggeredAt: s.alarmTriggeredAt as number | null,
        temperature: stats?.temperature?.value as number | null,
        humidity: stats?.humidity?.value as number | null,
        light: stats?.light?.value as number | null,
      };
    });

    logger.debug('unifi-protect', `Fetched ${sensors.length} sensors`);
    return { sensors };
  }

  private async getLights(client: AxiosInstance): Promise<{ lights: ProtectLight[] }> {
    const response = await client.get('/proxy/protect/api/lights');
    const rawLights = response.data || [];

    const lights: ProtectLight[] = rawLights.map((l: Record<string, unknown>) => ({
      id: l.id as string,
      name: l.name as string || 'Unknown Light',
      type: l.type as string,
      model: l.model as string || l.marketName as string || 'Unknown',
      mac: l.mac as string,
      state: l.state as 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED',
      isLightOn: l.isLightOn as boolean || false,
      lightDeviceSettings: {
        isIndicatorEnabled: (l.lightDeviceSettings as Record<string, unknown>)?.isIndicatorEnabled as boolean || false,
        ledLevel: (l.lightDeviceSettings as Record<string, unknown>)?.ledLevel as number || 0,
        pirSensitivity: (l.lightDeviceSettings as Record<string, unknown>)?.pirSensitivity as number || 50,
      },
      isMotionDetected: l.isMotionDetected as boolean || false,
      lastMotion: l.lastMotion as number | null,
      isPirMotionDetected: l.isPirMotionDetected as boolean || false,
    }));

    logger.debug('unifi-protect', `Fetched ${lights.length} lights`);
    return { lights };
  }

  private async getChimes(client: AxiosInstance): Promise<{ chimes: ProtectChime[] }> {
    const response = await client.get('/proxy/protect/api/chimes');
    const rawChimes = response.data || [];

    const chimes: ProtectChime[] = rawChimes.map((c: Record<string, unknown>) => ({
      id: c.id as string,
      name: c.name as string || 'Unknown Chime',
      type: c.type as string,
      model: c.model as string || c.marketName as string || 'Unknown',
      mac: c.mac as string,
      state: c.state as 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED',
      volume: c.volume as number || 50,
      isProbing: c.isProbing as boolean || false,
      lastRing: c.lastRing as number | null,
    }));

    logger.debug('unifi-protect', `Fetched ${chimes.length} chimes`);
    return { chimes };
  }

  private async getNvrStatus(client: AxiosInstance): Promise<{ nvr: ProtectNvr }> {
    const response = await client.get('/proxy/protect/api/nvr');
    const n = response.data;

    // Storage can be in storageStats (newer) or storageInfo (older) format
    const storageStats = n.storageStats || {};
    const recordingSpace = storageStats.recordingSpace || {};

    // Fall back to storageInfo if storageStats is not available
    const storageInfo = n.storageInfo || {};

    const nvr: ProtectNvr = {
      id: n.id as string,
      name: n.name as string || 'UniFi Protect NVR',
      type: n.type as string,
      version: n.version as string,
      firmwareVersion: n.firmwareVersion as string,
      // uptime from API is in milliseconds, convert to seconds for display
      uptime: n.uptime ? Math.floor(n.uptime / 1000) : 0,
      lastSeen: n.lastSeen as number,
      isRecordingDisabled: n.isRecordingDisabled as boolean || false,
      storageInfo: {
        // Try storageStats.recordingSpace first, fall back to storageInfo
        totalSize: recordingSpace.total as number || storageInfo.totalSize as number || storageStats.capacity as number || 0,
        usedSize: recordingSpace.used as number || storageInfo.usedSize as number || 0,
        totalSpaceUsed: storageStats.utilization as number || storageInfo.totalSpaceUsed as number || 0,
      },
      recordingRetentionDurationMs: n.recordingRetentionDurationMs as number | null,
    };

    logger.debug('unifi-protect', 'Fetched NVR status', {
      name: nvr.name,
      uptime: nvr.uptime,
      storage: nvr.storageInfo,
      rawUptime: n.uptime,
    });
    return { nvr };
  }

  private async getRecentEvents(client: AxiosInstance): Promise<{ events: ProtectEvent[] }> {
    // Get events from the last 24 hours
    const endTime = Date.now();
    const startTime = endTime - 24 * 60 * 60 * 1000;

    // Fetch events and cameras/sensors in parallel to resolve names
    const [eventsResponse, camerasResponse, sensorsResponse] = await Promise.all([
      client.get('/proxy/protect/api/events', {
        params: {
          start: startTime,
          end: endTime,
          limit: 100,
        },
      }),
      client.get('/proxy/protect/api/cameras').catch(() => ({ data: [] })),
      client.get('/proxy/protect/api/sensors').catch(() => ({ data: [] })),
    ]);

    const rawEvents = eventsResponse.data || [];
    const cameras = camerasResponse.data || [];
    const sensors = sensorsResponse.data || [];

    // Create lookup maps for camera and sensor names
    const cameraNames = new Map<string, string>();
    cameras.forEach((c: Record<string, unknown>) => {
      cameraNames.set(c.id as string, c.name as string || 'Unknown Camera');
    });

    const sensorNames = new Map<string, string>();
    sensors.forEach((s: Record<string, unknown>) => {
      sensorNames.set(s.id as string, s.name as string || 'Unknown Sensor');
    });

    const events: ProtectEvent[] = rawEvents.map((e: Record<string, unknown>) => {
      const cameraId = e.camera as string | null;
      const sensorId = e.sensor as string | null;

      return {
        id: e.id as string,
        type: e.type as string,
        start: e.start as number,
        end: e.end as number | null,
        // Resolve camera/sensor IDs to names
        camera: cameraId ? (cameraNames.get(cameraId) || cameraId) : null,
        sensor: sensorId ? (sensorNames.get(sensorId) || sensorId) : null,
        smartDetectTypes: e.smartDetectTypes as string[] || [],
        thumbnail: e.thumbnail as string | null,
        score: e.score as number | null,
        metadata: e.metadata as Record<string, unknown> || {},
      };
    });

    logger.debug('unifi-protect', `Fetched ${events.length} recent events`);
    return { events };
  }

  private async getSmartDetections(client: AxiosInstance): Promise<{
    detections: {
      person: number;
      vehicle: number;
      package: number;
      animal: number;
      face: number;
      licensePlate: number;
    };
    recentEvents: ProtectEvent[];
  }> {
    // Get smart detection events from the last 24 hours
    const endTime = Date.now();
    const startTime = endTime - 24 * 60 * 60 * 1000;

    const response = await client.get('/proxy/protect/api/events', {
      params: {
        start: startTime,
        end: endTime,
        types: ['smartDetectZone', 'smartDetectLine'],
        limit: 500,
      },
    });
    const rawEvents = response.data || [];

    // Count detections by type
    const detections = {
      person: 0,
      vehicle: 0,
      package: 0,
      animal: 0,
      face: 0,
      licensePlate: 0,
    };

    const events: ProtectEvent[] = rawEvents.map((e: Record<string, unknown>) => {
      const smartTypes = e.smartDetectTypes as string[] || [];

      // Count each detection type
      smartTypes.forEach((type) => {
        if (type === 'person') detections.person++;
        else if (type === 'vehicle') detections.vehicle++;
        else if (type === 'package') detections.package++;
        else if (type === 'animal') detections.animal++;
        else if (type === 'face') detections.face++;
        else if (type === 'licensePlate') detections.licensePlate++;
      });

      return {
        id: e.id as string,
        type: e.type as string,
        start: e.start as number,
        end: e.end as number | null,
        camera: e.camera as string | null,
        sensor: e.sensor as string | null,
        smartDetectTypes: smartTypes,
        thumbnail: e.thumbnail as string | null,
        score: e.score as number | null,
        metadata: e.metadata as Record<string, unknown> || {},
      };
    });

    logger.debug('unifi-protect', `Fetched smart detections`, { detections });
    return {
      detections,
      recentEvents: events.slice(0, 20), // Return most recent 20 for display
    };
  }

  async getSnapshot(
    config: IntegrationConfig,
    cameraId: string,
    width: number = 640,
    height: number = 360
  ): Promise<Buffer> {
    const protectConfig = config as UnifiProtectConfig;
    const client = this.createClient(protectConfig);

    // If using username/password, authenticate first
    if (!this.isApiKeyAuth(protectConfig) && protectConfig.username) {
      const session = await this.getAuthenticatedSession(client, protectConfig);
      this.applySession(client, session.cookies, session.csrfToken);
    }

    try {
      const response = await client.get(`/proxy/protect/api/cameras/${cameraId}/snapshot`, {
        params: {
          w: width,
          h: height,
          force: true,
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      logger.debug('unifi-protect', `Fetched snapshot for camera ${cameraId}`);
      return Buffer.from(response.data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('unifi-protect', `Failed to fetch snapshot for camera ${cameraId}`, { error: errorMsg });
      throw new Error(`Failed to fetch snapshot: ${errorMsg}`);
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'cameras',
        name: 'Cameras',
        description: 'List of all Protect cameras with status',
        widgetTypes: ['camera-list', 'camera-count', 'camera-snapshot'],
      },
      {
        id: 'sensors',
        name: 'Sensors',
        description: 'Door/window, motion, and leak sensors',
        widgetTypes: ['sensor-list'],
      },
      {
        id: 'lights',
        name: 'Lights',
        description: 'Floodlights and motion lights',
        widgetTypes: ['light-list'],
      },
      {
        id: 'chimes',
        name: 'Chimes',
        description: 'Doorbell chimes',
        widgetTypes: ['chime-list'],
      },
      {
        id: 'nvr',
        name: 'NVR Status',
        description: 'Network Video Recorder status and storage',
        widgetTypes: ['nvr-status'],
      },
      {
        id: 'events',
        name: 'Recent Events',
        description: 'Motion and detection events from the last 24 hours',
        widgetTypes: ['event-list'],
      },
      {
        id: 'smart-detections',
        name: 'Smart Detections',
        description: 'AI-powered detection counts (person, vehicle, package, etc.)',
        widgetTypes: ['smart-detections'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication - Implemented
      {
        id: 'auth-login',
        name: 'Login',
        description: 'Authenticate with username and password',
        method: 'POST',
        endpoint: '/api/auth/login',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'username', type: 'string', required: true },
          { name: 'password', type: 'string', required: true },
          { name: 'rememberMe', type: 'boolean', required: false },
        ],
        documentationUrl: 'https://developer.ui.com/protect/',
      },
      {
        id: 'auth-api-key',
        name: 'API Key Authentication',
        description: 'Authenticate using an API key',
        method: 'GET',
        endpoint: 'X-API-KEY header',
        implemented: true,
        category: 'Authentication',
      },
      {
        id: 'auth-logout',
        name: 'Logout',
        description: 'End the current session',
        method: 'POST',
        endpoint: '/api/auth/logout',
        implemented: false,
        category: 'Authentication',
      },

      // Bootstrap - Implemented
      {
        id: 'bootstrap',
        name: 'Get Bootstrap',
        description: 'Get complete system configuration including all devices',
        method: 'GET',
        endpoint: '/proxy/protect/api/bootstrap',
        implemented: true,
        category: 'System',
      },

      // NVR - Implemented
      {
        id: 'nvr-get',
        name: 'Get NVR Status',
        description: 'Get NVR configuration and status',
        method: 'GET',
        endpoint: '/proxy/protect/api/nvr',
        implemented: true,
        category: 'NVR',
      },
      {
        id: 'nvr-update',
        name: 'Update NVR Settings',
        description: 'Update NVR configuration',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/nvr',
        implemented: false,
        category: 'NVR',
      },
      {
        id: 'nvr-reboot',
        name: 'Reboot NVR',
        description: 'Restart the NVR system',
        method: 'POST',
        endpoint: '/proxy/protect/api/nvr/reboot',
        implemented: false,
        category: 'NVR',
      },
      {
        id: 'nvr-system-info',
        name: 'Get System Info',
        description: 'Get detailed NVR system information',
        method: 'GET',
        endpoint: '/proxy/protect/api/nvr/system-info',
        implemented: false,
        category: 'NVR',
      },

      // Cameras - Implemented
      {
        id: 'cameras-list',
        name: 'List Cameras',
        description: 'Get all cameras',
        method: 'GET',
        endpoint: '/proxy/protect/api/cameras',
        implemented: true,
        category: 'Cameras',
      },
      {
        id: 'camera-get',
        name: 'Get Camera',
        description: 'Get a specific camera by ID',
        method: 'GET',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Cameras',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Camera ID' },
        ],
      },
      {
        id: 'camera-update',
        name: 'Update Camera',
        description: 'Update camera settings',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-snapshot',
        name: 'Get Camera Snapshot',
        description: 'Get a snapshot image from a camera',
        method: 'GET',
        endpoint: '/proxy/protect/api/cameras/{id}/snapshot',
        implemented: true,
        category: 'Cameras',
        parameters: [
          { name: 'id', type: 'string', required: true },
          { name: 'w', type: 'number', required: false, description: 'Width' },
          { name: 'h', type: 'number', required: false, description: 'Height' },
          { name: 'force', type: 'boolean', required: false, description: 'Force new snapshot' },
        ],
      },
      {
        id: 'camera-video',
        name: 'Get Camera Video',
        description: 'Get recorded video footage',
        method: 'GET',
        endpoint: '/proxy/protect/api/cameras/{id}/video',
        implemented: false,
        category: 'Cameras',
        parameters: [
          { name: 'start', type: 'number', required: true, description: 'Start timestamp' },
          { name: 'end', type: 'number', required: true, description: 'End timestamp' },
        ],
      },
      {
        id: 'camera-rtsps-create',
        name: 'Create RTSPS Stream',
        description: 'Create secure RTSP stream for camera',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/rtsps-stream',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-rtsps-get',
        name: 'Get RTSPS Streams',
        description: 'Get active RTSP streams for camera',
        method: 'GET',
        endpoint: '/proxy/protect/api/cameras/{id}/rtsps-stream',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-rtsps-delete',
        name: 'Delete RTSPS Stream',
        description: 'Delete an RTSP stream',
        method: 'DELETE',
        endpoint: '/proxy/protect/api/cameras/{id}/rtsps-stream',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-talkback',
        name: 'Create Talkback Session',
        description: 'Start two-way audio session',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/talkback-session',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-disable-mic',
        name: 'Disable Microphone Permanently',
        description: 'Permanently disable camera microphone',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/disable-mic-permanently',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-reboot',
        name: 'Reboot Camera',
        description: 'Restart a camera',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/reboot',
        implemented: false,
        category: 'Cameras',
      },

      // PTZ Control - Not Implemented
      {
        id: 'camera-ptz-goto',
        name: 'PTZ Go To Preset',
        description: 'Move PTZ camera to a preset position',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/ptz/goto/{slot}',
        implemented: false,
        category: 'PTZ Control',
        parameters: [
          { name: 'id', type: 'string', required: true },
          { name: 'slot', type: 'number', required: true, description: 'Preset slot number' },
        ],
      },
      {
        id: 'camera-ptz-patrol-start',
        name: 'Start PTZ Patrol',
        description: 'Start PTZ patrol sequence',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/ptz/patrol/start/{slot}',
        implemented: false,
        category: 'PTZ Control',
      },
      {
        id: 'camera-ptz-patrol-stop',
        name: 'Stop PTZ Patrol',
        description: 'Stop active PTZ patrol',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/ptz/patrol/stop',
        implemented: false,
        category: 'PTZ Control',
      },
      {
        id: 'camera-ptz-home',
        name: 'PTZ Return Home',
        description: 'Return PTZ camera to home position',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/ptz/home',
        implemented: false,
        category: 'PTZ Control',
      },
      {
        id: 'camera-ptz-relative',
        name: 'PTZ Relative Move',
        description: 'Move PTZ camera by relative amount',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/ptz/relative',
        implemented: false,
        category: 'PTZ Control',
        parameters: [
          { name: 'pan', type: 'number', required: false },
          { name: 'tilt', type: 'number', required: false },
          { name: 'zoom', type: 'number', required: false },
        ],
      },
      {
        id: 'camera-ptz-zoom',
        name: 'PTZ Zoom',
        description: 'Control PTZ camera zoom',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/ptz/zoom',
        implemented: false,
        category: 'PTZ Control',
        parameters: [
          { name: 'zoom', type: 'number', required: true, description: 'Zoom level' },
        ],
      },

      // Sensors - Implemented
      {
        id: 'sensors-list',
        name: 'List Sensors',
        description: 'Get all sensors (door/window, motion, leak)',
        method: 'GET',
        endpoint: '/proxy/protect/api/sensors',
        implemented: true,
        category: 'Sensors',
      },
      {
        id: 'sensor-get',
        name: 'Get Sensor',
        description: 'Get a specific sensor by ID',
        method: 'GET',
        endpoint: '/proxy/protect/api/sensors/{id}',
        implemented: false,
        category: 'Sensors',
      },
      {
        id: 'sensor-update',
        name: 'Update Sensor',
        description: 'Update sensor settings',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/sensors/{id}',
        implemented: false,
        category: 'Sensors',
      },
      {
        id: 'sensor-clear-tamper',
        name: 'Clear Tamper Alert',
        description: 'Clear tamper alert for a sensor',
        method: 'POST',
        endpoint: '/proxy/protect/api/sensors/{id}/clear-tamper',
        implemented: false,
        category: 'Sensors',
      },

      // Lights - Implemented
      {
        id: 'lights-list',
        name: 'List Lights',
        description: 'Get all Protect lights',
        method: 'GET',
        endpoint: '/proxy/protect/api/lights',
        implemented: true,
        category: 'Lights',
      },
      {
        id: 'light-get',
        name: 'Get Light',
        description: 'Get a specific light by ID',
        method: 'GET',
        endpoint: '/proxy/protect/api/lights/{id}',
        implemented: false,
        category: 'Lights',
      },
      {
        id: 'light-update',
        name: 'Update Light',
        description: 'Update light settings (brightness, etc.)',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/lights/{id}',
        implemented: false,
        category: 'Lights',
      },
      {
        id: 'light-on',
        name: 'Turn Light On',
        description: 'Turn on a light',
        method: 'POST',
        endpoint: '/proxy/protect/api/lights/{id}/on',
        implemented: false,
        category: 'Lights',
      },
      {
        id: 'light-off',
        name: 'Turn Light Off',
        description: 'Turn off a light',
        method: 'POST',
        endpoint: '/proxy/protect/api/lights/{id}/off',
        implemented: false,
        category: 'Lights',
      },

      // Chimes - Implemented
      {
        id: 'chimes-list',
        name: 'List Chimes',
        description: 'Get all doorbell chimes',
        method: 'GET',
        endpoint: '/proxy/protect/api/chimes',
        implemented: true,
        category: 'Chimes',
      },
      {
        id: 'chime-get',
        name: 'Get Chime',
        description: 'Get a specific chime by ID',
        method: 'GET',
        endpoint: '/proxy/protect/api/chimes/{id}',
        implemented: false,
        category: 'Chimes',
      },
      {
        id: 'chime-update',
        name: 'Update Chime',
        description: 'Update chime settings (volume, etc.)',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/chimes/{id}',
        implemented: false,
        category: 'Chimes',
      },
      {
        id: 'chime-play',
        name: 'Play Chime',
        description: 'Play a test chime sound',
        method: 'POST',
        endpoint: '/proxy/protect/api/chimes/{id}/play-speaker',
        implemented: false,
        category: 'Chimes',
      },

      // Door Locks - Not Implemented
      {
        id: 'doorlocks-list',
        name: 'List Door Locks',
        description: 'Get all Protect door locks',
        method: 'GET',
        endpoint: '/proxy/protect/api/doorlocks',
        implemented: false,
        category: 'Door Locks',
      },
      {
        id: 'doorlock-get',
        name: 'Get Door Lock',
        description: 'Get a specific door lock by ID',
        method: 'GET',
        endpoint: '/proxy/protect/api/doorlocks/{id}',
        implemented: false,
        category: 'Door Locks',
      },
      {
        id: 'doorlock-update',
        name: 'Update Door Lock',
        description: 'Update door lock settings',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/doorlocks/{id}',
        implemented: false,
        category: 'Door Locks',
      },
      {
        id: 'doorlock-unlock',
        name: 'Unlock Door',
        description: 'Unlock a door lock',
        method: 'POST',
        endpoint: '/proxy/protect/api/doorlocks/{id}/open',
        implemented: false,
        category: 'Door Locks',
      },
      {
        id: 'doorlock-lock',
        name: 'Lock Door',
        description: 'Lock a door lock',
        method: 'POST',
        endpoint: '/proxy/protect/api/doorlocks/{id}/close',
        implemented: false,
        category: 'Door Locks',
      },
      {
        id: 'doorlock-calibrate',
        name: 'Calibrate Door Lock',
        description: 'Calibrate door lock mechanism',
        method: 'POST',
        endpoint: '/proxy/protect/api/doorlocks/{id}/calibrate',
        implemented: false,
        category: 'Door Locks',
      },

      // Events - Implemented
      {
        id: 'events-list',
        name: 'List Events',
        description: 'Get motion and detection events',
        method: 'GET',
        endpoint: '/proxy/protect/api/events',
        implemented: true,
        category: 'Events',
        parameters: [
          { name: 'start', type: 'number', required: false, description: 'Start timestamp' },
          { name: 'end', type: 'number', required: false, description: 'End timestamp' },
          { name: 'limit', type: 'number', required: false, description: 'Max events to return' },
          { name: 'types', type: 'array', required: false, description: 'Event types to filter' },
        ],
      },
      {
        id: 'event-get',
        name: 'Get Event',
        description: 'Get a specific event by ID',
        method: 'GET',
        endpoint: '/proxy/protect/api/events/{id}',
        implemented: false,
        category: 'Events',
      },
      {
        id: 'event-thumbnail',
        name: 'Get Event Thumbnail',
        description: 'Get thumbnail image for an event',
        method: 'GET',
        endpoint: '/proxy/protect/api/events/{id}/thumbnail',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'w', type: 'number', required: false, description: 'Width' },
          { name: 'h', type: 'number', required: false, description: 'Height' },
        ],
      },
      {
        id: 'event-animated-thumbnail',
        name: 'Get Animated Thumbnail',
        description: 'Get animated GIF thumbnail for an event',
        method: 'GET',
        endpoint: '/proxy/protect/api/events/{id}/animated-thumbnail',
        implemented: false,
        category: 'Events',
      },
      {
        id: 'event-heatmap',
        name: 'Get Event Heatmap',
        description: 'Get motion heatmap for an event',
        method: 'GET',
        endpoint: '/proxy/protect/api/events/{id}/heatmap',
        implemented: false,
        category: 'Events',
      },
      {
        id: 'event-smart-detect-track',
        name: 'Get Smart Detect Track',
        description: 'Get object tracking data for smart detection event',
        method: 'GET',
        endpoint: '/proxy/protect/api/events/{id}/smart-detect-track',
        implemented: false,
        category: 'Events',
      },

      // Smart Detection Settings - Not Implemented
      {
        id: 'smart-detect-person',
        name: 'Set Person Detection',
        description: 'Enable/disable person detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Smart Detection',
        parameters: [
          { name: 'smartDetectSettings.objectTypes', type: 'array', required: true },
        ],
      },
      {
        id: 'smart-detect-vehicle',
        name: 'Set Vehicle Detection',
        description: 'Enable/disable vehicle detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Smart Detection',
      },
      {
        id: 'smart-detect-animal',
        name: 'Set Animal Detection',
        description: 'Enable/disable animal detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Smart Detection',
      },
      {
        id: 'smart-detect-package',
        name: 'Set Package Detection',
        description: 'Enable/disable package detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Smart Detection',
      },
      {
        id: 'smart-detect-face',
        name: 'Set Face Detection',
        description: 'Enable/disable face detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Smart Detection',
      },
      {
        id: 'smart-detect-license-plate',
        name: 'Set License Plate Detection',
        description: 'Enable/disable license plate detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Smart Detection',
      },

      // Audio Detection - Not Implemented
      {
        id: 'audio-detect-smoke',
        name: 'Set Smoke Alarm Detection',
        description: 'Enable/disable smoke alarm detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Audio Detection',
      },
      {
        id: 'audio-detect-co',
        name: 'Set CO Alarm Detection',
        description: 'Enable/disable carbon monoxide alarm detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Audio Detection',
      },
      {
        id: 'audio-detect-siren',
        name: 'Set Siren Detection',
        description: 'Enable/disable siren detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Audio Detection',
      },
      {
        id: 'audio-detect-baby-cry',
        name: 'Set Baby Cry Detection',
        description: 'Enable/disable baby cry detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Audio Detection',
      },
      {
        id: 'audio-detect-bark',
        name: 'Set Bark Detection',
        description: 'Enable/disable dog bark detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Audio Detection',
      },
      {
        id: 'audio-detect-glass-break',
        name: 'Set Glass Break Detection',
        description: 'Enable/disable glass break detection',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Audio Detection',
      },

      // Live Views - Not Implemented
      {
        id: 'liveviews-list',
        name: 'List Live Views',
        description: 'Get all configured live views',
        method: 'GET',
        endpoint: '/proxy/protect/api/liveviews',
        implemented: false,
        category: 'Live Views',
      },
      {
        id: 'liveview-get',
        name: 'Get Live View',
        description: 'Get a specific live view configuration',
        method: 'GET',
        endpoint: '/proxy/protect/api/liveviews/{id}',
        implemented: false,
        category: 'Live Views',
      },
      {
        id: 'liveview-create',
        name: 'Create Live View',
        description: 'Create a new live view configuration',
        method: 'POST',
        endpoint: '/proxy/protect/api/liveviews',
        implemented: false,
        category: 'Live Views',
      },
      {
        id: 'liveview-update',
        name: 'Update Live View',
        description: 'Update live view configuration',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/liveviews/{id}',
        implemented: false,
        category: 'Live Views',
      },
      {
        id: 'liveview-delete',
        name: 'Delete Live View',
        description: 'Delete a live view configuration',
        method: 'DELETE',
        endpoint: '/proxy/protect/api/liveviews/{id}',
        implemented: false,
        category: 'Live Views',
      },

      // Viewers - Not Implemented
      {
        id: 'viewers-list',
        name: 'List Viewers',
        description: 'Get all viewer devices (Viewport, etc.)',
        method: 'GET',
        endpoint: '/proxy/protect/api/viewers',
        implemented: false,
        category: 'Viewers',
      },
      {
        id: 'viewer-get',
        name: 'Get Viewer',
        description: 'Get a specific viewer device',
        method: 'GET',
        endpoint: '/proxy/protect/api/viewers/{id}',
        implemented: false,
        category: 'Viewers',
      },
      {
        id: 'viewer-update',
        name: 'Update Viewer',
        description: 'Update viewer settings',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/viewers/{id}',
        implemented: false,
        category: 'Viewers',
      },

      // Bridges - Not Implemented
      {
        id: 'bridges-list',
        name: 'List Bridges',
        description: 'Get all Protect bridges',
        method: 'GET',
        endpoint: '/proxy/protect/api/bridges',
        implemented: false,
        category: 'Bridges',
      },
      {
        id: 'bridge-get',
        name: 'Get Bridge',
        description: 'Get a specific bridge',
        method: 'GET',
        endpoint: '/proxy/protect/api/bridges/{id}',
        implemented: false,
        category: 'Bridges',
      },

      // Users - Not Implemented
      {
        id: 'users-list',
        name: 'List Users',
        description: 'Get all Protect users',
        method: 'GET',
        endpoint: '/proxy/protect/api/users',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-get',
        name: 'Get User',
        description: 'Get a specific user',
        method: 'GET',
        endpoint: '/proxy/protect/api/users/{id}',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-self',
        name: 'Get Current User',
        description: 'Get the current authenticated user',
        method: 'GET',
        endpoint: '/proxy/protect/api/users/self',
        implemented: false,
        category: 'Users',
      },

      // Device Adoption - Not Implemented
      {
        id: 'device-adopt',
        name: 'Adopt Device',
        description: 'Adopt a new Protect device',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/adopt',
        implemented: false,
        category: 'Device Management',
      },
      {
        id: 'device-unadopt',
        name: 'Unadopt Device',
        description: 'Remove a device from Protect',
        method: 'POST',
        endpoint: '/proxy/protect/api/cameras/{id}/unadopt',
        implemented: false,
        category: 'Device Management',
      },

      // Recording Settings - Not Implemented
      {
        id: 'recording-mode',
        name: 'Set Recording Mode',
        description: 'Set camera recording mode (always, motion, never)',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Recording',
        parameters: [
          { name: 'recordingSettings.mode', type: 'string', required: true, description: 'always, motion, or never' },
        ],
      },
      {
        id: 'recording-retention',
        name: 'Set Recording Retention',
        description: 'Set recording retention period',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/nvr',
        implemented: false,
        category: 'Recording',
        parameters: [
          { name: 'recordingRetentionDurationMs', type: 'number', required: true },
        ],
      },

      // Camera Settings - Not Implemented
      {
        id: 'camera-privacy',
        name: 'Set Privacy Mode',
        description: 'Enable/disable privacy mode (stops recording)',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Camera Settings',
        parameters: [
          { name: 'privacyZones', type: 'array', required: true },
        ],
      },
      {
        id: 'camera-hdr',
        name: 'Set HDR Mode',
        description: 'Enable/disable HDR',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Camera Settings',
        parameters: [
          { name: 'hdrMode', type: 'boolean', required: true },
        ],
      },
      {
        id: 'camera-wdr',
        name: 'Set WDR Level',
        description: 'Set wide dynamic range level',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Camera Settings',
        parameters: [
          { name: 'wdrLevel', type: 'number', required: true },
        ],
      },
      {
        id: 'camera-night-vision',
        name: 'Set Night Vision Mode',
        description: 'Configure night vision settings',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Camera Settings',
        parameters: [
          { name: 'ispSettings.icrSensitivity', type: 'number', required: false },
          { name: 'ispSettings.isColorNightVisionEnabled', type: 'boolean', required: false },
        ],
      },
      {
        id: 'camera-status-light',
        name: 'Set Status Light',
        description: 'Enable/disable camera status LED',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Camera Settings',
        parameters: [
          { name: 'ledSettings.isEnabled', type: 'boolean', required: true },
        ],
      },
      {
        id: 'camera-volume',
        name: 'Set Speaker Volume',
        description: 'Set camera speaker volume',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Camera Settings',
        parameters: [
          { name: 'speakerSettings.volume', type: 'number', required: true },
        ],
      },
      {
        id: 'camera-mic-volume',
        name: 'Set Microphone Volume',
        description: 'Set camera microphone sensitivity',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Camera Settings',
        parameters: [
          { name: 'micVolume', type: 'number', required: true },
        ],
      },
      {
        id: 'camera-lcd-text',
        name: 'Set LCD Display Text',
        description: 'Set custom text on doorbell LCD (G4 Doorbell Pro)',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/cameras/{id}',
        implemented: false,
        category: 'Camera Settings',
        parameters: [
          { name: 'lcdMessage.text', type: 'string', required: true },
        ],
      },

      // WebSocket Subscriptions - Not Implemented
      {
        id: 'websocket-devices',
        name: 'Subscribe to Device Updates',
        description: 'WebSocket subscription for real-time device updates',
        method: 'GET',
        endpoint: '/proxy/protect/ws/updates',
        implemented: false,
        category: 'WebSocket',
      },
      {
        id: 'websocket-events',
        name: 'Subscribe to Events',
        description: 'WebSocket subscription for real-time events',
        method: 'GET',
        endpoint: '/proxy/protect/ws/events',
        implemented: false,
        category: 'WebSocket',
      },

      // File Assets - Not Implemented
      {
        id: 'files-upload',
        name: 'Upload Asset File',
        description: 'Upload device asset file (sounds, images)',
        method: 'POST',
        endpoint: '/proxy/protect/api/files/{filetype}',
        implemented: false,
        category: 'Files',
      },
      {
        id: 'files-list',
        name: 'List Asset Files',
        description: 'Get list of uploaded asset files',
        method: 'GET',
        endpoint: '/proxy/protect/api/files/{filetype}',
        implemented: false,
        category: 'Files',
      },

      // Groups - Not Implemented
      {
        id: 'groups-list',
        name: 'List Camera Groups',
        description: 'Get all camera groups',
        method: 'GET',
        endpoint: '/proxy/protect/api/groups',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'group-create',
        name: 'Create Camera Group',
        description: 'Create a new camera group',
        method: 'POST',
        endpoint: '/proxy/protect/api/groups',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'group-update',
        name: 'Update Camera Group',
        description: 'Update camera group settings',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/groups/{id}',
        implemented: false,
        category: 'Groups',
      },
      {
        id: 'group-delete',
        name: 'Delete Camera Group',
        description: 'Delete a camera group',
        method: 'DELETE',
        endpoint: '/proxy/protect/api/groups/{id}',
        implemented: false,
        category: 'Groups',
      },

      // Schedules - Not Implemented
      {
        id: 'schedules-list',
        name: 'List Recording Schedules',
        description: 'Get all recording schedules',
        method: 'GET',
        endpoint: '/proxy/protect/api/schedules',
        implemented: false,
        category: 'Schedules',
      },
      {
        id: 'schedule-create',
        name: 'Create Recording Schedule',
        description: 'Create a new recording schedule',
        method: 'POST',
        endpoint: '/proxy/protect/api/schedules',
        implemented: false,
        category: 'Schedules',
      },
      {
        id: 'schedule-update',
        name: 'Update Recording Schedule',
        description: 'Update a recording schedule',
        method: 'PATCH',
        endpoint: '/proxy/protect/api/schedules/{id}',
        implemented: false,
        category: 'Schedules',
      },
      {
        id: 'schedule-delete',
        name: 'Delete Recording Schedule',
        description: 'Delete a recording schedule',
        method: 'DELETE',
        endpoint: '/proxy/protect/api/schedules/{id}',
        implemented: false,
        category: 'Schedules',
      },

      // Application Info - Not Implemented
      {
        id: 'app-info',
        name: 'Get Application Info',
        description: 'Get Protect application metadata',
        method: 'GET',
        endpoint: '/v1/meta/info',
        implemented: false,
        category: 'Application',
      },
    ];
  }
}
