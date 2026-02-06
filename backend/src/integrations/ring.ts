import { RingApi, RingCamera, RingDevice as RingApiDevice, Location } from 'ring-client-api';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  RingConfig,
  RingDevice,
  RingEvent,
  RingAlarmStatus,
  RingSensor,
  RingSnapshot,
} from '../types';
import { logger } from '../services/logger';

// Cache for Ring API instances per integration
const ringApiCache = new Map<string, { api: RingApi; lastAccess: number }>();

// Cleanup old API instances after 30 minutes of inactivity
const CACHE_TTL = 30 * 60 * 1000;

// Snapshot cache for battery cameras (10 minute minimum)
const snapshotCache = new Map<number, { data: string; timestamp: number }>();
const SNAPSHOT_CACHE_TTL = 10 * 60 * 1000;

export class RingIntegration extends BaseIntegration {
  readonly type = 'ring';
  readonly name = 'Ring';

  private getApiCacheKey(config: RingConfig): string {
    return `ring_${config.refreshToken.substring(0, 20)}`;
  }

  private async getApi(config: RingConfig): Promise<RingApi> {
    const cacheKey = this.getApiCacheKey(config);
    const cached = ringApiCache.get(cacheKey);
    const now = Date.now();

    // Cleanup old cache entries
    for (const [key, entry] of ringApiCache.entries()) {
      if (now - entry.lastAccess > CACHE_TTL) {
        ringApiCache.delete(key);
      }
    }

    if (cached) {
      cached.lastAccess = now;
      return cached.api;
    }

    const api = new RingApi({
      refreshToken: config.refreshToken,
      cameraStatusPollingSeconds: config.cameraStatusPollingSeconds || 20,
      locationIds: config.locationIds,
    });

    ringApiCache.set(cacheKey, { api, lastAccess: now });
    return api;
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const ringConfig = config as RingConfig;

    if (!ringConfig.refreshToken) {
      return { success: false, message: 'Refresh token is required' };
    }

    try {
      const api = await this.getApi(ringConfig);
      const locations = await api.getLocations();
      const cameras = await api.getCameras();

      return {
        success: true,
        message: `Connected to Ring`,
        details: {
          locations: locations.length,
          cameras: cameras.length,
          locationNames: locations.map(l => l.name),
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ring', 'Connection test failed', { error: errorMsg });

      if (errorMsg.includes('Invalid refresh token') || errorMsg.includes('Unauthorized')) {
        return {
          success: false,
          message: 'Invalid refresh token. Please generate a new token using ring-auth-cli.',
        };
      }

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const ringConfig = config as RingConfig;

    switch (metric) {
      case 'devices':
        return this.getDevices(ringConfig);
      case 'events':
        return this.getEvents(ringConfig);
      case 'alarm-status':
        return this.getAlarmStatus(ringConfig);
      case 'sensors':
        return this.getSensors(ringConfig);
      case 'snapshot':
        return this.getSnapshot(ringConfig);
      default:
        return this.getDevices(ringConfig);
    }
  }

  private async getDevices(config: RingConfig): Promise<IntegrationData> {
    try {
      const api = await this.getApi(config);
      const cameras = await api.getCameras();

      const devices: RingDevice[] = await Promise.all(
        cameras.map(async (camera) => {
          let health: { wifi_name?: string; latest_signal_strength?: number; firmware?: string } = {};
          try {
            health = await camera.getHealth();
          } catch {
            // Health info may not be available for all devices
          }

          const cameraData = camera.data as unknown as Record<string, unknown>;
          const alerts = cameraData.alerts as Record<string, unknown> | undefined;
          return {
            id: camera.id,
            name: camera.name,
            deviceType: String(camera.deviceType),
            description: camera.model,
            batteryLife: camera.batteryLevel ?? null,
            hasLight: camera.hasLight,
            hasSiren: camera.hasSiren,
            isOnline: Boolean(alerts?.connection === 'online'),
            firmwareStatus: health.firmware || 'unknown',
            wifiSignalStrength: health.latest_signal_strength || 0,
            wifiSignalCategory: this.getSignalCategory(health.latest_signal_strength || 0),
            lastMotion: (cameraData.last_motion as number) || null,
            lastDing: (cameraData.last_ding as number) || null,
          };
        })
      );

      return {
        devices,
        total: devices.length,
        online: devices.filter(d => d.isOnline).length,
        offline: devices.filter(d => !d.isOnline).length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ring', 'Failed to get devices', { error: errorMsg });
      throw new Error(`Failed to get Ring devices: ${errorMsg}`);
    }
  }

  private async getEvents(config: RingConfig): Promise<IntegrationData> {
    try {
      const api = await this.getApi(config);
      const locations = await api.getLocations();

      const allEvents: RingEvent[] = [];

      for (const location of locations) {
        try {
          const cameraEvents = await location.getCameraEvents({ limit: 50 });

          for (const event of cameraEvents.events || []) {
            // Find the camera name
            const camera = location.cameras.find(c => c.id === event.doorbot_id);
            const eventData = event as unknown as Record<string, unknown>;

            allEvents.push({
              id: event.ding_id_str || String(eventData.id || event.doorbot_id),
              deviceId: event.doorbot_id,
              deviceName: camera?.name || 'Unknown Device',
              kind: event.kind as 'motion' | 'ding' | 'on_demand',
              createdAt: event.created_at,
              answered: (eventData.answered as boolean) || false,
              favorite: event.favorite || false,
              duration: (eventData.duration as number) || 0,
            });
          }
        } catch (err) {
          logger.warn('ring', `Failed to get events for location ${location.name}`, { error: String(err) });
        }
      }

      // Sort by date descending
      allEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        events: allEvents.slice(0, 100), // Limit to 100 most recent
        total: allEvents.length,
        motionCount: allEvents.filter(e => e.kind === 'motion').length,
        dingCount: allEvents.filter(e => e.kind === 'ding').length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ring', 'Failed to get events', { error: errorMsg });
      throw new Error(`Failed to get Ring events: ${errorMsg}`);
    }
  }

  private async getAlarmStatus(config: RingConfig): Promise<IntegrationData> {
    try {
      const api = await this.getApi(config);
      const locations = await api.getLocations();

      const alarmStatuses: RingAlarmStatus[] = [];

      for (const location of locations) {
        if (!location.hasHubs) {
          continue; // Skip locations without alarm system
        }

        try {
          const devices = await location.getDevices();
          const sensors = devices.filter(d =>
            d.deviceType.includes('sensor') ||
            d.deviceType === 'security-panel'
          );

          const mode = await location.getAlarmMode();
          const modeLabels: Record<string, string> = {
            'all': 'Armed Away',
            'some': 'Armed Home',
            'none': 'Disarmed',
          };

          const faultedSensors = sensors.filter(s => s.data.faulted).length;
          const lowBatterySensors = sensors.filter(s =>
            s.data.batteryStatus === 'low' ||
            (s.data.batteryLevel !== undefined && s.data.batteryLevel < 20)
          ).length;

          alarmStatuses.push({
            locationId: location.id,
            locationName: location.name,
            mode: mode as 'all' | 'some' | 'none',
            modeLabel: modeLabels[mode] || mode,
            sirenActive: false, // Would need event subscription to track
            entryDelayActive: false,
            exitDelayActive: false,
            faultedSensors,
            totalSensors: sensors.length,
            lowBatterySensors,
          });
        } catch (err) {
          logger.warn('ring', `Failed to get alarm status for location ${location.name}`, { error: String(err) });
        }
      }

      return {
        alarmStatuses,
        total: alarmStatuses.length,
        armed: alarmStatuses.filter(s => s.mode !== 'none').length,
        disarmed: alarmStatuses.filter(s => s.mode === 'none').length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ring', 'Failed to get alarm status', { error: errorMsg });
      throw new Error(`Failed to get Ring alarm status: ${errorMsg}`);
    }
  }

  private async getSensors(config: RingConfig): Promise<IntegrationData> {
    try {
      const api = await this.getApi(config);
      const locations = await api.getLocations();

      const allSensors: RingSensor[] = [];

      for (const location of locations) {
        if (!location.hasHubs) {
          continue;
        }

        try {
          const devices = await location.getDevices();

          for (const device of devices) {
            // Filter to sensor types
            const deviceTypeStr = String(device.deviceType);
            if (!deviceTypeStr.includes('sensor') &&
                !deviceTypeStr.includes('security-panel') &&
                !deviceTypeStr.includes('hub')) {
              continue;
            }

            const batteryLevel = device.data.batteryLevel ?? null;
            let batteryStatus: 'ok' | 'low' | 'none' = 'none';
            if (batteryLevel !== null) {
              batteryStatus = batteryLevel < 20 ? 'low' : 'ok';
            } else if (device.data.batteryStatus) {
              batteryStatus = device.data.batteryStatus === 'low' ? 'low' : 'ok';
            }

            allSensors.push({
              id: device.zid,
              name: device.name,
              deviceType: String(device.deviceType),
              roomName: device.data.roomId?.toString() || 'Unknown',
              faulted: device.data.faulted || false,
              tamperStatus: device.data.tamperStatus === 'tamper' ? 'tamper' : 'ok',
              batteryLevel,
              batteryStatus,
              lastUpdate: new Date().toISOString(),
              bypassed: false,
            });
          }
        } catch (err) {
          logger.warn('ring', `Failed to get sensors for location ${location.name}`, { error: String(err) });
        }
      }

      return {
        sensors: allSensors,
        total: allSensors.length,
        faulted: allSensors.filter(s => s.faulted).length,
        lowBattery: allSensors.filter(s => s.batteryStatus === 'low').length,
        tampered: allSensors.filter(s => s.tamperStatus === 'tamper').length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ring', 'Failed to get sensors', { error: errorMsg });
      throw new Error(`Failed to get Ring sensors: ${errorMsg}`);
    }
  }

  private async getSnapshot(config: RingConfig): Promise<IntegrationData> {
    try {
      const api = await this.getApi(config);
      const cameras = await api.getCameras();

      const snapshots: RingSnapshot[] = [];

      for (const camera of cameras) {
        const cacheKey = camera.id;
        const cached = snapshotCache.get(cacheKey);
        const now = Date.now();

        // Check if we have a valid cached snapshot
        if (cached && (now - cached.timestamp) < SNAPSHOT_CACHE_TTL) {
          snapshots.push({
            deviceId: camera.id,
            deviceName: camera.name,
            timestamp: new Date(cached.timestamp).toISOString(),
            imageBase64: cached.data,
          });
          continue;
        }

        // Try to get a new snapshot
        try {
          const snapshotBuffer = await camera.getSnapshot();
          const imageBase64 = snapshotBuffer.toString('base64');

          snapshotCache.set(cacheKey, {
            data: imageBase64,
            timestamp: now,
          });

          snapshots.push({
            deviceId: camera.id,
            deviceName: camera.name,
            timestamp: new Date(now).toISOString(),
            imageBase64,
          });
        } catch (err) {
          // Snapshot may fail for battery cameras or offline devices
          logger.debug('ring', `Failed to get snapshot for ${camera.name}`, { error: String(err) });

          // Return cached if available, even if expired
          if (cached) {
            snapshots.push({
              deviceId: camera.id,
              deviceName: camera.name,
              timestamp: new Date(cached.timestamp).toISOString(),
              imageBase64: cached.data,
            });
          }
        }
      }

      return {
        snapshots,
        total: cameras.length,
        available: snapshots.length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ring', 'Failed to get snapshots', { error: errorMsg });
      throw new Error(`Failed to get Ring snapshots: ${errorMsg}`);
    }
  }

  private getSignalCategory(rssi: number): string {
    if (rssi >= -50) return 'excellent';
    if (rssi >= -60) return 'good';
    if (rssi >= -70) return 'fair';
    return 'poor';
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'devices',
        name: 'Devices',
        description: 'Doorbells and cameras with status',
        widgetTypes: ['ring-devices'],
      },
      {
        id: 'events',
        name: 'Events',
        description: 'Motion and doorbell events',
        widgetTypes: ['ring-events'],
      },
      {
        id: 'alarm-status',
        name: 'Alarm Status',
        description: 'Alarm mode and sensor summary',
        widgetTypes: ['ring-alarm-status'],
      },
      {
        id: 'sensors',
        name: 'Sensors',
        description: 'All alarm sensors with states',
        widgetTypes: ['ring-sensors'],
      },
      {
        id: 'snapshot',
        name: 'Snapshot',
        description: 'Camera snapshots',
        widgetTypes: ['ring-snapshot'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-refresh-token',
        name: 'Authenticate with Refresh Token',
        description: 'Authenticate using a refresh token obtained from ring-auth-cli',
        method: 'POST',
        endpoint: 'RingApi({ refreshToken })',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'refreshToken', type: 'string', required: true, description: 'Token from ring-auth-cli' },
        ],
        documentationUrl: 'https://github.com/dgreif/ring',
      },
      {
        id: 'auth-2fa',
        name: 'Two-Factor Authentication',
        description: 'Handle 2FA during authentication flow',
        method: 'POST',
        endpoint: 'RingApi.requestAuth()',
        implemented: false,
        category: 'Authentication',
      },

      // Locations - Implemented
      {
        id: 'locations-list',
        name: 'Get Locations',
        description: 'Get all Ring locations associated with the account',
        method: 'GET',
        endpoint: 'RingApi.getLocations()',
        implemented: true,
        category: 'Locations',
      },
      {
        id: 'location-cameras',
        name: 'Get Location Cameras',
        description: 'Get all cameras at a specific location',
        method: 'GET',
        endpoint: 'Location.cameras',
        implemented: true,
        category: 'Locations',
      },
      {
        id: 'location-devices',
        name: 'Get Location Devices',
        description: 'Get all devices (sensors, keypads, etc.) at a location',
        method: 'GET',
        endpoint: 'Location.getDevices()',
        implemented: true,
        category: 'Locations',
      },
      {
        id: 'location-has-hubs',
        name: 'Check for Hubs',
        description: 'Check if location has Ring Alarm hubs',
        method: 'GET',
        endpoint: 'Location.hasHubs',
        implemented: true,
        category: 'Locations',
      },
      {
        id: 'location-rooms',
        name: 'Get Room List',
        description: 'Get list of rooms at a location',
        method: 'GET',
        endpoint: 'Location.getRoomList()',
        implemented: false,
        category: 'Locations',
      },

      // Cameras - Implemented
      {
        id: 'cameras-list',
        name: 'Get All Cameras',
        description: 'Get all cameras across all locations',
        method: 'GET',
        endpoint: 'RingApi.getCameras()',
        implemented: true,
        category: 'Cameras',
      },
      {
        id: 'camera-data',
        name: 'Get Camera Data',
        description: 'Get camera info including motion zones, light status, battery',
        method: 'GET',
        endpoint: 'Camera.data',
        implemented: true,
        category: 'Cameras',
      },
      {
        id: 'camera-health',
        name: 'Get Camera Health',
        description: 'Get camera health including WiFi signal strength',
        method: 'GET',
        endpoint: 'Camera.getHealth()',
        implemented: true,
        category: 'Cameras',
      },
      {
        id: 'camera-snapshot',
        name: 'Get Camera Snapshot',
        description: 'Get latest snapshot image from camera',
        method: 'GET',
        endpoint: 'Camera.getSnapshot()',
        implemented: true,
        category: 'Cameras',
      },
      {
        id: 'camera-light-on',
        name: 'Turn Light On',
        description: 'Turn on camera spotlight/floodlight',
        method: 'POST',
        endpoint: 'Camera.setLight(true)',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-light-off',
        name: 'Turn Light Off',
        description: 'Turn off camera spotlight/floodlight',
        method: 'POST',
        endpoint: 'Camera.setLight(false)',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-siren-on',
        name: 'Activate Siren',
        description: 'Turn on camera siren',
        method: 'POST',
        endpoint: 'Camera.setSiren(true)',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-siren-off',
        name: 'Deactivate Siren',
        description: 'Turn off camera siren',
        method: 'POST',
        endpoint: 'Camera.setSiren(false)',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-live-stream',
        name: 'Start Live Stream',
        description: 'Start a new video on demand stream',
        method: 'POST',
        endpoint: 'Camera.startVideoOnDemand()',
        implemented: false,
        category: 'Cameras',
      },
      {
        id: 'camera-sip-session',
        name: 'Create SIP Session',
        description: 'Create SIP session for RTP flow control',
        method: 'POST',
        endpoint: 'Camera.createSipSession()',
        implemented: false,
        category: 'Cameras',
      },

      // Events/History - Implemented
      {
        id: 'camera-events',
        name: 'Get Camera Events',
        description: 'Get event history for location cameras',
        method: 'GET',
        endpoint: 'Location.getCameraEvents()',
        implemented: true,
        category: 'Events',
        parameters: [
          { name: 'limit', type: 'number', required: false, description: 'Number of events to fetch' },
        ],
      },
      {
        id: 'camera-history',
        name: 'Get Camera History',
        description: 'Get ding history for a specific camera',
        method: 'GET',
        endpoint: 'Camera.getHistory()',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'limit', type: 'number', required: false, description: 'Number of dings to fetch' },
        ],
      },
      {
        id: 'event-recording',
        name: 'Get Event Recording',
        description: 'Get recording URL for a specific event',
        method: 'GET',
        endpoint: 'Camera.getRecordingUrl(dingId)',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'dingId', type: 'string', required: true },
          { name: 'transcoded', type: 'boolean', required: false },
        ],
      },
      {
        id: 'event-subscribe-motion',
        name: 'Subscribe to Motion Events',
        description: 'Subscribe to real-time motion detection events',
        method: 'GET',
        endpoint: 'Camera.onMotionDetected.subscribe()',
        implemented: false,
        category: 'Events',
      },
      {
        id: 'event-subscribe-doorbell',
        name: 'Subscribe to Doorbell Events',
        description: 'Subscribe to real-time doorbell press events',
        method: 'GET',
        endpoint: 'Camera.onDoorbellPressed.subscribe()',
        implemented: false,
        category: 'Events',
      },
      {
        id: 'event-subscribe-dings',
        name: 'Subscribe to New Dings',
        description: 'Subscribe to new ding notifications with SIP info',
        method: 'GET',
        endpoint: 'Camera.onNewDing.subscribe()',
        implemented: false,
        category: 'Events',
      },
      {
        id: 'event-active-dings',
        name: 'Get Active Dings',
        description: 'Get dings from the last 65 seconds',
        method: 'GET',
        endpoint: 'Camera.onActiveDings',
        implemented: false,
        category: 'Events',
      },

      // Alarm System - Implemented
      {
        id: 'alarm-mode-get',
        name: 'Get Alarm Mode',
        description: 'Get current alarm mode (all/some/none)',
        method: 'GET',
        endpoint: 'Location.getAlarmMode()',
        implemented: true,
        category: 'Alarm',
      },
      {
        id: 'alarm-disarm',
        name: 'Disarm Alarm',
        description: 'Disarm the alarm system',
        method: 'POST',
        endpoint: 'Location.disarm()',
        implemented: false,
        category: 'Alarm',
      },
      {
        id: 'alarm-arm-home',
        name: 'Arm Home Mode',
        description: 'Arm alarm in Home mode',
        method: 'POST',
        endpoint: 'Location.armHome()',
        implemented: false,
        category: 'Alarm',
        parameters: [
          { name: 'bypassSensorZids', type: 'array', required: false, description: 'Sensor IDs to bypass' },
        ],
      },
      {
        id: 'alarm-arm-away',
        name: 'Arm Away Mode',
        description: 'Arm alarm in Away mode',
        method: 'POST',
        endpoint: 'Location.armAway()',
        implemented: false,
        category: 'Alarm',
        parameters: [
          { name: 'bypassSensorZids', type: 'array', required: false, description: 'Sensor IDs to bypass' },
        ],
      },
      {
        id: 'alarm-siren-on',
        name: 'Sound Siren',
        description: 'Trigger the alarm siren',
        method: 'POST',
        endpoint: 'Location.soundSiren()',
        implemented: false,
        category: 'Alarm',
      },
      {
        id: 'alarm-siren-off',
        name: 'Silence Siren',
        description: 'Silence the alarm siren',
        method: 'POST',
        endpoint: 'Location.silenceSiren()',
        implemented: false,
        category: 'Alarm',
      },

      // Sensors/Devices - Implemented
      {
        id: 'sensors-list',
        name: 'List Sensors',
        description: 'Get all alarm sensors at a location',
        method: 'GET',
        endpoint: 'Location.getDevices()',
        implemented: true,
        category: 'Sensors',
      },
      {
        id: 'sensor-data',
        name: 'Get Sensor Data',
        description: 'Get sensor data (faulted, tamper status, battery)',
        method: 'GET',
        endpoint: 'Device.data',
        implemented: true,
        category: 'Sensors',
      },
      {
        id: 'sensor-subscribe',
        name: 'Subscribe to Sensor Updates',
        description: 'Subscribe to real-time sensor state changes',
        method: 'GET',
        endpoint: 'Device.onData.subscribe()',
        implemented: false,
        category: 'Sensors',
      },
      {
        id: 'device-volume',
        name: 'Set Device Volume',
        description: 'Set volume for base station or keypad',
        method: 'POST',
        endpoint: 'Device.setVolume()',
        implemented: false,
        category: 'Sensors',
        parameters: [
          { name: 'volume', type: 'number', required: true, description: 'Volume level 0-1' },
        ],
      },

      // Smart Lighting - Not Implemented
      {
        id: 'lights-list',
        name: 'List Smart Lights',
        description: 'Get all Ring Smart Lighting devices',
        method: 'GET',
        endpoint: 'Location.lights',
        implemented: false,
        category: 'Smart Lighting',
      },
      {
        id: 'light-on',
        name: 'Turn Light On',
        description: 'Turn on a smart light',
        method: 'POST',
        endpoint: 'Light.setOn(true)',
        implemented: false,
        category: 'Smart Lighting',
      },
      {
        id: 'light-off',
        name: 'Turn Light Off',
        description: 'Turn off a smart light',
        method: 'POST',
        endpoint: 'Light.setOn(false)',
        implemented: false,
        category: 'Smart Lighting',
      },
      {
        id: 'light-brightness',
        name: 'Set Light Brightness',
        description: 'Set brightness level for a smart light',
        method: 'POST',
        endpoint: 'Light.setBrightness()',
        implemented: false,
        category: 'Smart Lighting',
        parameters: [
          { name: 'brightness', type: 'number', required: true, description: 'Brightness 0-100' },
        ],
      },
      {
        id: 'light-motion-settings',
        name: 'Configure Motion Settings',
        description: 'Configure motion detection settings for light',
        method: 'POST',
        endpoint: 'Light.setMotionSettings()',
        implemented: false,
        category: 'Smart Lighting',
      },

      // Chimes - Not Implemented
      {
        id: 'chimes-list',
        name: 'List Chimes',
        description: 'Get all Ring Chimes',
        method: 'GET',
        endpoint: 'RingApi.getChimes()',
        implemented: false,
        category: 'Chimes',
      },
      {
        id: 'chime-play',
        name: 'Play Chime',
        description: 'Play a test chime sound',
        method: 'POST',
        endpoint: 'Chime.playSound()',
        implemented: false,
        category: 'Chimes',
      },
      {
        id: 'chime-volume',
        name: 'Set Chime Volume',
        description: 'Set the chime volume',
        method: 'POST',
        endpoint: 'Chime.setVolume()',
        implemented: false,
        category: 'Chimes',
        parameters: [
          { name: 'volume', type: 'number', required: true, description: 'Volume level 0-11' },
        ],
      },
      {
        id: 'chime-snooze',
        name: 'Snooze Chime',
        description: 'Temporarily disable chime alerts',
        method: 'POST',
        endpoint: 'Chime.snooze()',
        implemented: false,
        category: 'Chimes',
        parameters: [
          { name: 'minutes', type: 'number', required: true },
        ],
      },

      // Intercom - Not Implemented
      {
        id: 'intercom-list',
        name: 'List Intercoms',
        description: 'Get all Ring Intercom devices',
        method: 'GET',
        endpoint: 'Location.intercoms',
        implemented: false,
        category: 'Intercom',
      },
      {
        id: 'intercom-unlock',
        name: 'Unlock Door',
        description: 'Unlock door via intercom',
        method: 'POST',
        endpoint: 'Intercom.unlock()',
        implemented: false,
        category: 'Intercom',
      },

      // Third-Party Devices - Not Implemented
      {
        id: 'third-party-locks',
        name: 'List Third-Party Locks',
        description: 'Get Z-Wave locks connected to Ring Alarm',
        method: 'GET',
        endpoint: 'Location.locks',
        implemented: false,
        category: 'Third-Party Devices',
      },
      {
        id: 'lock-unlock',
        name: 'Unlock Lock',
        description: 'Unlock a connected Z-Wave lock',
        method: 'POST',
        endpoint: 'Lock.unlock()',
        implemented: false,
        category: 'Third-Party Devices',
      },
      {
        id: 'lock-lock',
        name: 'Lock Lock',
        description: 'Lock a connected Z-Wave lock',
        method: 'POST',
        endpoint: 'Lock.lock()',
        implemented: false,
        category: 'Third-Party Devices',
      },
      {
        id: 'third-party-switches',
        name: 'List Third-Party Switches',
        description: 'Get Z-Wave switches connected to Ring Alarm',
        method: 'GET',
        endpoint: 'Location.switches',
        implemented: false,
        category: 'Third-Party Devices',
      },
      {
        id: 'switch-on',
        name: 'Turn Switch On',
        description: 'Turn on a Z-Wave switch',
        method: 'POST',
        endpoint: 'Switch.setOn(true)',
        implemented: false,
        category: 'Third-Party Devices',
      },
      {
        id: 'switch-off',
        name: 'Turn Switch Off',
        description: 'Turn off a Z-Wave switch',
        method: 'POST',
        endpoint: 'Switch.setOn(false)',
        implemented: false,
        category: 'Third-Party Devices',
      },

      // Push Notifications - Not Implemented
      {
        id: 'push-notifications',
        name: 'Subscribe to Push Notifications',
        description: 'Subscribe to Ring push notifications',
        method: 'GET',
        endpoint: 'Camera.onNewNotification.subscribe()',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'active-notifications',
        name: 'Get Active Notifications',
        description: 'Get notifications from the last minute',
        method: 'GET',
        endpoint: 'Camera.onActiveNotifications',
        implemented: false,
        category: 'Notifications',
      },

      // Location Mode - Not Implemented
      {
        id: 'location-mode-get',
        name: 'Get Location Mode',
        description: 'Get current location mode (home/away/disarmed)',
        method: 'GET',
        endpoint: 'Location.getLocationMode()',
        implemented: false,
        category: 'Location Mode',
      },
      {
        id: 'location-mode-set',
        name: 'Set Location Mode',
        description: 'Set location mode for cameras without alarm',
        method: 'POST',
        endpoint: 'Location.setLocationMode()',
        implemented: false,
        category: 'Location Mode',
        parameters: [
          { name: 'mode', type: 'string', required: true, description: 'home, away, or disarmed' },
        ],
      },

      // Account - Not Implemented
      {
        id: 'account-profile',
        name: 'Get Account Profile',
        description: 'Get Ring account profile information',
        method: 'GET',
        endpoint: 'RingApi.profile',
        implemented: false,
        category: 'Account',
      },

      // WebSocket - Not Implemented
      {
        id: 'websocket-connect',
        name: 'Connect WebSocket',
        description: 'Establish real-time WebSocket connection',
        method: 'GET',
        endpoint: 'RingApi.onConnected',
        implemented: false,
        category: 'WebSocket',
      },
      {
        id: 'websocket-refresh',
        name: 'Refresh Connection',
        description: 'Refresh WebSocket connection',
        method: 'POST',
        endpoint: 'Location.requestConnection()',
        implemented: false,
        category: 'WebSocket',
      },
    ];
  }
}
