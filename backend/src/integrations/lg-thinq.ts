import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  LGThinQConfig,
  LGDevice,
  LGDeviceType,
  LGRefrigeratorState,
  LGWasherState,
  LGDryerState,
  LGDishwasherState,
  LGAirConditionerState,
  LGAirPurifierState,
  LGRobotVacuumState,
  LGEnergyData,
} from '../types';
import { logger } from '../services/logger';

// LG ThinQ Regional Gateway URLs
const GATEWAY_URLS: Record<string, string> = {
  US: 'https://us.lgeapi.com',
  EU: 'https://eu.lgeapi.com',
  KR: 'https://kr.lgeapi.com',
  AU: 'https://au.lgeapi.com',
  CN: 'https://cn.lgeapi.com',
  RU: 'https://ru.lgeapi.com',
};

// LG OAuth URLs
const AUTH_URLS: Record<string, string> = {
  US: 'https://us.m.lgaccount.com',
  EU: 'https://eu.m.lgaccount.com',
  KR: 'https://kr.m.lgaccount.com',
  AU: 'https://au.m.lgaccount.com',
  CN: 'https://cn.m.lgaccount.com',
  RU: 'https://ru.m.lgaccount.com',
};

// Token cache for authenticated sessions
interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  jsessionId?: string;
}

const tokenCache = new Map<string, TokenCache>();
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry

// LG API Constants
const CLIENT_ID = 'LGAO221A02';
const APPLICATION_KEY = '6V1V8H2BN5P9ZQGOI5DAQ92YZBDO3EK9';
const API_VERSION = '2.0';
const COUNTRY_CODE_MAP: Record<string, string> = {
  US: 'US',
  EU: 'DE',
  KR: 'KR',
  AU: 'AU',
  CN: 'CN',
  RU: 'RU',
};

export class LGThinQIntegration extends BaseIntegration {
  readonly type = 'lg-thinq';
  readonly name = 'LG ThinQ';

  private getCacheKey(config: LGThinQConfig): string {
    return `lg_${config.username}_${config.region}`;
  }

  private getGatewayUrl(region: string): string {
    return GATEWAY_URLS[region] || GATEWAY_URLS.US;
  }

  private getAuthUrl(region: string): string {
    return AUTH_URLS[region] || AUTH_URLS.US;
  }

  private async authenticate(config: LGThinQConfig): Promise<TokenCache> {
    const cacheKey = this.getCacheKey(config);

    try {
      const gatewayUrl = this.getGatewayUrl(config.region);
      const authUrl = this.getAuthUrl(config.region);
      const countryCode = COUNTRY_CODE_MAP[config.region] || 'US';

      // Step 1: Pre-login to get session
      const preLoginResponse = await axios.post(
        `${authUrl}/spx/login/signIn`,
        new URLSearchParams({
          user_auth2: config.password,
          log_param: '',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Application-Key': APPLICATION_KEY,
            'X-Client-App-Key': CLIENT_ID,
            'X-Lge-Svccode': 'SVC202',
            'X-Country-Code': countryCode,
            'X-Language-Code': config.language || 'en-US',
            Accept: 'application/json',
          },
          params: {
            country: countryCode,
            language: config.language || 'en-US',
            svc_list: 'SVC202',
            username: config.username,
          },
        }
      );

      // Step 2: Get OAuth token
      const tokenResponse = await axios.post(
        `${gatewayUrl}/v1/service/users/auth`,
        {
          lgeCredentials: {
            username: config.username,
            password: config.password,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Thinq-App-Key': APPLICATION_KEY,
            'X-Thinq-App-Ver': API_VERSION,
            'X-Thinq-App-Level': '01',
            'X-Thinq-App-Os': 'LINUX',
            'X-Thinq-App-Type': 'NUTS',
            'X-Country-Code': countryCode,
            'X-Language-Code': config.language || 'en-US',
            Accept: 'application/json',
          },
        }
      );

      const result = tokenResponse.data?.result || tokenResponse.data;
      const accessToken = result?.access_token || result?.accessToken;
      const refreshToken = result?.refresh_token || result?.refreshToken;
      const expiresIn = result?.expires_in || 3600;

      if (!accessToken) {
        throw new Error('Failed to obtain access token');
      }

      const cache: TokenCache = {
        accessToken,
        refreshToken: refreshToken || '',
        expiresAt: Date.now() + (expiresIn * 1000),
        jsessionId: preLoginResponse.headers['set-cookie']?.[0]?.split(';')[0],
      };

      tokenCache.set(cacheKey, cache);
      return cache;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('lg-thinq', 'Authentication failed', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  private async refreshToken(config: LGThinQConfig): Promise<TokenCache> {
    const cacheKey = this.getCacheKey(config);
    const cached = tokenCache.get(cacheKey);

    if (!cached?.refreshToken) {
      return this.authenticate(config);
    }

    try {
      const gatewayUrl = this.getGatewayUrl(config.region);
      const countryCode = COUNTRY_CODE_MAP[config.region] || 'US';

      const response = await axios.post(
        `${gatewayUrl}/v1/service/users/token/refresh`,
        {
          refreshToken: cached.refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Thinq-App-Key': APPLICATION_KEY,
            'X-Thinq-App-Ver': API_VERSION,
            'X-Country-Code': countryCode,
            'X-Language-Code': config.language || 'en-US',
            Authorization: `Bearer ${cached.accessToken}`,
          },
        }
      );

      const result = response.data?.result || response.data;
      const accessToken = result?.access_token || result?.accessToken;
      const refreshTokenNew = result?.refresh_token || cached.refreshToken;
      const expiresIn = result?.expires_in || 3600;

      const cache: TokenCache = {
        accessToken,
        refreshToken: refreshTokenNew,
        expiresAt: Date.now() + (expiresIn * 1000),
        jsessionId: cached.jsessionId,
      };

      tokenCache.set(cacheKey, cache);
      return cache;
    } catch {
      // If refresh fails, try full authentication
      return this.authenticate(config);
    }
  }

  private async ensureAuthenticated(config: LGThinQConfig): Promise<string> {
    const cacheKey = this.getCacheKey(config);
    const cached = tokenCache.get(cacheKey);

    if (cached && cached.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER) {
      return cached.accessToken;
    }

    if (cached && cached.refreshToken) {
      const refreshed = await this.refreshToken(config);
      return refreshed.accessToken;
    }

    const newAuth = await this.authenticate(config);
    return newAuth.accessToken;
  }

  private createClient(accessToken: string, region: string): AxiosInstance {
    const gatewayUrl = this.getGatewayUrl(region);
    const countryCode = COUNTRY_CODE_MAP[region] || 'US';

    return axios.create({
      baseURL: gatewayUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Thinq-App-Key': APPLICATION_KEY,
        'X-Thinq-App-Ver': API_VERSION,
        'X-Thinq-App-Level': '01',
        'X-Thinq-App-Os': 'LINUX',
        'X-Thinq-App-Type': 'NUTS',
        'X-Country-Code': countryCode,
        'X-Language-Code': 'en-US',
      },
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const lgConfig = config as LGThinQConfig;

    if (!lgConfig.username || !lgConfig.password) {
      return { success: false, message: 'Username and password are required' };
    }

    if (!lgConfig.region) {
      return { success: false, message: 'Region is required' };
    }

    try {
      const accessToken = await this.ensureAuthenticated(lgConfig);
      const client = this.createClient(accessToken, lgConfig.region);

      const response = await client.get('/v1/service/application/dashboard');
      const devices = response.data?.result?.item || response.data?.result || [];

      return {
        success: true,
        message: `Connected to LG ThinQ`,
        details: {
          devices: Array.isArray(devices) ? devices.length : 0,
          region: lgConfig.region,
          types: Array.isArray(devices)
            ? [...new Set(devices.map((d: LGDevice) => d.deviceType))]
            : [],
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('lg-thinq', 'Connection test failed', { error: errorMsg });

      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('auth')) {
        return { success: false, message: 'Invalid credentials. Check your email and password.' };
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const lgConfig = config as LGThinQConfig;

    switch (metric) {
      case 'devices':
        return this.getDevices(lgConfig);
      case 'device-detail':
        return this.getDeviceDetail(lgConfig);
      case 'refrigerator':
        return this.getRefrigeratorData(lgConfig);
      case 'laundry':
        return this.getLaundryData(lgConfig);
      case 'dishwasher':
        return this.getDishwasherData(lgConfig);
      case 'climate':
        return this.getClimateData(lgConfig);
      case 'robot-vacuum':
        return this.getRobotVacuumData(lgConfig);
      case 'energy':
        return this.getEnergyData(lgConfig);
      default:
        return this.getDevices(lgConfig);
    }
  }

  private async getDevices(config: LGThinQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken, config.region);

      const response = await client.get('/v1/service/application/dashboard');
      const rawDevices = response.data?.result?.item || response.data?.result || [];

      const devices: LGDevice[] = (Array.isArray(rawDevices) ? rawDevices : []).map((d: Record<string, unknown>) => ({
        deviceId: String(d.deviceId || ''),
        alias: String(d.alias || d.deviceNick || 'Unknown'),
        deviceType: this.mapDeviceType(String(d.deviceType || '')),
        modelName: String(d.modelName || ''),
        modelNumber: String(d.modelNumber || d.modelJsonUri || ''),
        macAddress: d.macAddress ? String(d.macAddress) : undefined,
        ssid: d.ssid ? String(d.ssid) : undefined,
        networkType: d.networkType === 'ethernet' ? 'ethernet' : 'wifi',
        online: Boolean(d.online || d.deviceState === 'E'),
        platformType: d.platformType === 'thinq1' ? 'thinq1' : 'thinq2',
        snapshot: d.snapshot as Record<string, unknown> || {},
      }));

      // Group by type
      const byType: Record<string, LGDevice[]> = {};
      devices.forEach((d) => {
        if (!byType[d.deviceType]) byType[d.deviceType] = [];
        byType[d.deviceType].push(d);
      });

      return {
        devices,
        total: devices.length,
        online: devices.filter((d) => d.online).length,
        offline: devices.filter((d) => !d.online).length,
        byType,
        kitchen: devices.filter((d) =>
          ['REFRIGERATOR', 'KIMCHI_REFRIGERATOR', 'DISHWASHER', 'OVEN', 'MICROWAVE', 'COOKTOP'].includes(d.deviceType)
        ).length,
        laundry: devices.filter((d) =>
          ['WASHER', 'DRYER', 'STYLER'].includes(d.deviceType)
        ).length,
        climate: devices.filter((d) =>
          ['AIR_CONDITIONER', 'AIR_PURIFIER', 'DEHUMIDIFIER', 'HUMIDIFIER'].includes(d.deviceType)
        ).length,
        cleaning: devices.filter((d) =>
          ['ROBOT_VACUUM', 'STICK_VACUUM'].includes(d.deviceType)
        ).length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('lg-thinq', 'Failed to get devices', { error: errorMsg });
      throw new Error(`Failed to get devices: ${errorMsg}`);
    }
  }

  private async getDeviceDetail(config: LGThinQConfig): Promise<IntegrationData> {
    const devicesData = await this.getDevices(config);
    const devices = devicesData.devices as LGDevice[];

    if (devices.length === 0) {
      return { device: null, error: 'No devices found' };
    }

    const device = devices[0];

    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken, config.region);

      const snapshotResponse = await client.get(`/v1/service/devices/${device.deviceId}/snapshot`);
      const snapshot = snapshotResponse.data?.result || {};

      return {
        device: {
          ...device,
          snapshot,
        },
      };
    } catch {
      return { device };
    }
  }

  private async getRefrigeratorData(config: LGThinQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken, config.region);

      const response = await client.get('/v1/service/application/dashboard');
      const rawDevices = response.data?.result?.item || response.data?.result || [];

      const refrigerators = (Array.isArray(rawDevices) ? rawDevices : []).filter(
        (d: Record<string, unknown>) =>
          ['REFRIGERATOR', 'KIMCHI_REFRIGERATOR', 'WINE_CELLAR'].includes(
            this.mapDeviceType(String(d.deviceType || ''))
          )
      );

      const states: Array<{ device: LGDevice; state: LGRefrigeratorState }> = [];

      for (const fridge of refrigerators) {
        const deviceId = String(fridge.deviceId || '');

        try {
          const snapshotResponse = await client.get(`/v1/service/devices/${deviceId}/snapshot`);
          const snapshot = snapshotResponse.data?.result || fridge.snapshot || {};

          states.push({
            device: {
              deviceId,
              alias: String(fridge.alias || fridge.deviceNick || 'Refrigerator'),
              deviceType: 'REFRIGERATOR',
              modelName: String(fridge.modelName || ''),
              modelNumber: String(fridge.modelNumber || ''),
              networkType: 'wifi',
              online: Boolean(fridge.online),
              platformType: fridge.platformType === 'thinq1' ? 'thinq1' : 'thinq2',
            },
            state: this.parseRefrigeratorState(snapshot),
          });
        } catch {
          // Skip if we can't get snapshot
        }
      }

      return {
        refrigerators: states,
        total: refrigerators.length,
        online: states.filter((s) => s.device.online).length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get refrigerator data: ${errorMsg}`);
    }
  }

  private async getLaundryData(config: LGThinQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken, config.region);

      const response = await client.get('/v1/service/application/dashboard');
      const rawDevices = response.data?.result?.item || response.data?.result || [];

      const washers = (Array.isArray(rawDevices) ? rawDevices : []).filter(
        (d: Record<string, unknown>) => this.mapDeviceType(String(d.deviceType || '')) === 'WASHER'
      );
      const dryers = (Array.isArray(rawDevices) ? rawDevices : []).filter(
        (d: Record<string, unknown>) => this.mapDeviceType(String(d.deviceType || '')) === 'DRYER'
      );

      const washerStates: Array<{ device: LGDevice; state: LGWasherState }> = [];
      const dryerStates: Array<{ device: LGDevice; state: LGDryerState }> = [];

      for (const washer of washers) {
        const deviceId = String(washer.deviceId || '');
        try {
          const snapshotResponse = await client.get(`/v1/service/devices/${deviceId}/snapshot`);
          const snapshot = snapshotResponse.data?.result || washer.snapshot || {};
          washerStates.push({
            device: {
              deviceId,
              alias: String(washer.alias || washer.deviceNick || 'Washer'),
              deviceType: 'WASHER',
              modelName: String(washer.modelName || ''),
              modelNumber: String(washer.modelNumber || ''),
              networkType: 'wifi',
              online: Boolean(washer.online),
              platformType: washer.platformType === 'thinq1' ? 'thinq1' : 'thinq2',
            },
            state: this.parseWasherState(snapshot),
          });
        } catch {
          // Skip
        }
      }

      for (const dryer of dryers) {
        const deviceId = String(dryer.deviceId || '');
        try {
          const snapshotResponse = await client.get(`/v1/service/devices/${deviceId}/snapshot`);
          const snapshot = snapshotResponse.data?.result || dryer.snapshot || {};
          dryerStates.push({
            device: {
              deviceId,
              alias: String(dryer.alias || dryer.deviceNick || 'Dryer'),
              deviceType: 'DRYER',
              modelName: String(dryer.modelName || ''),
              modelNumber: String(dryer.modelNumber || ''),
              networkType: 'wifi',
              online: Boolean(dryer.online),
              platformType: dryer.platformType === 'thinq1' ? 'thinq1' : 'thinq2',
            },
            state: this.parseDryerState(snapshot),
          });
        } catch {
          // Skip
        }
      }

      const running = [
        ...washerStates.filter((s) => s.state.state === 'RUNNING'),
        ...dryerStates.filter((s) => s.state.state === 'RUNNING'),
      ].length;

      return {
        washers: washerStates,
        dryers: dryerStates,
        totalWashers: washers.length,
        totalDryers: dryers.length,
        running,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get laundry data: ${errorMsg}`);
    }
  }

  private async getDishwasherData(config: LGThinQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken, config.region);

      const response = await client.get('/v1/service/application/dashboard');
      const rawDevices = response.data?.result?.item || response.data?.result || [];

      const dishwashers = (Array.isArray(rawDevices) ? rawDevices : []).filter(
        (d: Record<string, unknown>) => this.mapDeviceType(String(d.deviceType || '')) === 'DISHWASHER'
      );

      const states: Array<{ device: LGDevice; state: LGDishwasherState }> = [];

      for (const dw of dishwashers) {
        const deviceId = String(dw.deviceId || '');
        try {
          const snapshotResponse = await client.get(`/v1/service/devices/${deviceId}/snapshot`);
          const snapshot = snapshotResponse.data?.result || dw.snapshot || {};
          states.push({
            device: {
              deviceId,
              alias: String(dw.alias || dw.deviceNick || 'Dishwasher'),
              deviceType: 'DISHWASHER',
              modelName: String(dw.modelName || ''),
              modelNumber: String(dw.modelNumber || ''),
              networkType: 'wifi',
              online: Boolean(dw.online),
              platformType: dw.platformType === 'thinq1' ? 'thinq1' : 'thinq2',
            },
            state: this.parseDishwasherState(snapshot),
          });
        } catch {
          // Skip
        }
      }

      return {
        dishwashers: states,
        total: dishwashers.length,
        running: states.filter((s) => s.state.state === 'RUNNING').length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get dishwasher data: ${errorMsg}`);
    }
  }

  private async getClimateData(config: LGThinQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken, config.region);

      const response = await client.get('/v1/service/application/dashboard');
      const rawDevices = response.data?.result?.item || response.data?.result || [];

      const acUnits = (Array.isArray(rawDevices) ? rawDevices : []).filter(
        (d: Record<string, unknown>) => this.mapDeviceType(String(d.deviceType || '')) === 'AIR_CONDITIONER'
      );
      const purifiers = (Array.isArray(rawDevices) ? rawDevices : []).filter(
        (d: Record<string, unknown>) => this.mapDeviceType(String(d.deviceType || '')) === 'AIR_PURIFIER'
      );

      const acStates: Array<{ device: LGDevice; state: LGAirConditionerState }> = [];
      const purifierStates: Array<{ device: LGDevice; state: LGAirPurifierState }> = [];

      for (const ac of acUnits) {
        const deviceId = String(ac.deviceId || '');
        try {
          const snapshotResponse = await client.get(`/v1/service/devices/${deviceId}/snapshot`);
          const snapshot = snapshotResponse.data?.result || ac.snapshot || {};
          acStates.push({
            device: {
              deviceId,
              alias: String(ac.alias || ac.deviceNick || 'Air Conditioner'),
              deviceType: 'AIR_CONDITIONER',
              modelName: String(ac.modelName || ''),
              modelNumber: String(ac.modelNumber || ''),
              networkType: 'wifi',
              online: Boolean(ac.online),
              platformType: ac.platformType === 'thinq1' ? 'thinq1' : 'thinq2',
            },
            state: this.parseAirConditionerState(snapshot),
          });
        } catch {
          // Skip
        }
      }

      for (const purifier of purifiers) {
        const deviceId = String(purifier.deviceId || '');
        try {
          const snapshotResponse = await client.get(`/v1/service/devices/${deviceId}/snapshot`);
          const snapshot = snapshotResponse.data?.result || purifier.snapshot || {};
          purifierStates.push({
            device: {
              deviceId,
              alias: String(purifier.alias || purifier.deviceNick || 'Air Purifier'),
              deviceType: 'AIR_PURIFIER',
              modelName: String(purifier.modelName || ''),
              modelNumber: String(purifier.modelNumber || ''),
              networkType: 'wifi',
              online: Boolean(purifier.online),
              platformType: purifier.platformType === 'thinq1' ? 'thinq1' : 'thinq2',
            },
            state: this.parseAirPurifierState(snapshot),
          });
        } catch {
          // Skip
        }
      }

      return {
        airConditioners: acStates,
        airPurifiers: purifierStates,
        totalAC: acUnits.length,
        totalPurifiers: purifiers.length,
        activeAC: acStates.filter((s) => s.state.operation).length,
        activePurifiers: purifierStates.filter((s) => s.state.operation).length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get climate data: ${errorMsg}`);
    }
  }

  private async getRobotVacuumData(config: LGThinQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken, config.region);

      const response = await client.get('/v1/service/application/dashboard');
      const rawDevices = response.data?.result?.item || response.data?.result || [];

      const vacuums = (Array.isArray(rawDevices) ? rawDevices : []).filter(
        (d: Record<string, unknown>) =>
          ['ROBOT_VACUUM', 'STICK_VACUUM'].includes(this.mapDeviceType(String(d.deviceType || '')))
      );

      const states: Array<{ device: LGDevice; state: LGRobotVacuumState }> = [];

      for (const vacuum of vacuums) {
        const deviceId = String(vacuum.deviceId || '');
        try {
          const snapshotResponse = await client.get(`/v1/service/devices/${deviceId}/snapshot`);
          const snapshot = snapshotResponse.data?.result || vacuum.snapshot || {};
          states.push({
            device: {
              deviceId,
              alias: String(vacuum.alias || vacuum.deviceNick || 'Robot Vacuum'),
              deviceType: 'ROBOT_VACUUM',
              modelName: String(vacuum.modelName || ''),
              modelNumber: String(vacuum.modelNumber || ''),
              networkType: 'wifi',
              online: Boolean(vacuum.online),
              platformType: vacuum.platformType === 'thinq1' ? 'thinq1' : 'thinq2',
            },
            state: this.parseRobotVacuumState(snapshot),
          });
        } catch {
          // Skip
        }
      }

      return {
        vacuums: states,
        total: vacuums.length,
        cleaning: states.filter((s) => s.state.state === 'WORKING').length,
        charging: states.filter((s) => s.state.state === 'CHARGING').length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get robot vacuum data: ${errorMsg}`);
    }
  }

  private async getEnergyData(config: LGThinQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken, config.region);

      const response = await client.get('/v1/service/application/dashboard');
      const rawDevices = response.data?.result?.item || response.data?.result || [];

      const energyData: LGEnergyData[] = [];

      for (const device of rawDevices) {
        const deviceId = String(device.deviceId || '');
        try {
          const energyResponse = await client.get(`/v1/service/devices/${deviceId}/energy`);
          const energy = energyResponse.data?.result || {};
          energyData.push({
            deviceId,
            day: Number(energy.day || 0),
            week: Number(energy.week || 0),
            month: Number(energy.month || 0),
            year: energy.year ? Number(energy.year) : undefined,
          });
        } catch {
          // Energy data not available for this device
        }
      }

      const totalDay = energyData.reduce((sum, e) => sum + e.day, 0);
      const totalMonth = energyData.reduce((sum, e) => sum + e.month, 0);

      return {
        devices: energyData,
        totalDevices: energyData.length,
        totalDay,
        totalMonth,
        avgDay: energyData.length > 0 ? totalDay / energyData.length : 0,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get energy data: ${errorMsg}`);
    }
  }

  // State parsers
  private parseRefrigeratorState(snapshot: Record<string, unknown>): LGRefrigeratorState {
    const refrigerator = (snapshot.refState || snapshot.refrigerator || snapshot) as Record<string, unknown>;
    return {
      fridgeTemp: Number(refrigerator.fridgeTemp || refrigerator.tempRefrigerator || 37),
      fridgeTempSet: Number(refrigerator.fridgeTempSet || refrigerator.tempRefrigeratorTarget || 37),
      freezerTemp: Number(refrigerator.freezerTemp || refrigerator.tempFreezer || 0),
      freezerTempSet: Number(refrigerator.freezerTempSet || refrigerator.tempFreezerTarget || 0),
      doorOpen: Boolean(refrigerator.doorOpen || refrigerator.atLeastOneDoorOpen),
      expressMode: Boolean(refrigerator.expressMode || refrigerator.expressCool),
      expressFreezeMode: Boolean(refrigerator.expressFreezeMode || refrigerator.expressFreeze),
      ecoFriendly: Boolean(refrigerator.ecoFriendly || refrigerator.energySavingMode),
      icemaker: refrigerator.iceMaker === 'ON' || refrigerator.icemaker === true ? 'on' : 'off',
      waterFilterUsed: Number(refrigerator.waterFilterUsed || refrigerator.waterFilterUsedMonth || 0),
      freshAirFilter: refrigerator.freshAirFilter === 'AUTO' ? 'auto' : refrigerator.freshAirFilter === 'ON' ? 'on' : 'off',
      tempUnit: refrigerator.tempUnit === 'CELSIUS' || refrigerator.tempUnit === 'C' ? 'C' : 'F',
    };
  }

  private parseWasherState(snapshot: Record<string, unknown>): LGWasherState {
    const washer = (snapshot.washerDryer || snapshot.washer || snapshot) as Record<string, unknown>;
    return {
      state: this.parseWasherStateValue(String(washer.state || washer.processState || 'POWEROFF')),
      course: String(washer.course || washer.courseId || 'Unknown'),
      smartCourse: String(washer.smartCourse || ''),
      remainTimeHour: Number(washer.remainTimeHour || washer.remainHour || 0),
      remainTimeMinute: Number(washer.remainTimeMinute || washer.remainMinute || 0),
      initialTimeHour: Number(washer.initialTimeHour || washer.initialHour || 0),
      initialTimeMinute: Number(washer.initialTimeMinute || washer.initialMinute || 0),
      reserveTimeHour: Number(washer.reserveTimeHour || washer.reserveHour || 0),
      reserveTimeMinute: Number(washer.reserveTimeMinute || washer.reserveMinute || 0),
      doorLock: Boolean(washer.doorLock),
      childLock: Boolean(washer.childLock),
      spinSpeed: String(washer.spinSpeed || washer.spin || 'Normal'),
      waterTemp: String(washer.waterTemp || washer.temp || 'Normal'),
      rinseCount: Number(washer.rinseCount || washer.rinse || 2),
      dryLevel: washer.dryLevel ? String(washer.dryLevel) : undefined,
      steam: Boolean(washer.steam),
      turbowash: Boolean(washer.turbowash || washer.turboWash),
      tcl: washer.tcl ? Number(washer.tcl) : undefined,
      errorCode: washer.errorCode ? String(washer.errorCode) : undefined,
    };
  }

  private parseDryerState(snapshot: Record<string, unknown>): LGDryerState {
    const dryer = (snapshot.washerDryer || snapshot.dryer || snapshot) as Record<string, unknown>;
    return {
      state: this.parseDryerStateValue(String(dryer.state || dryer.processState || 'POWEROFF')),
      course: String(dryer.course || dryer.courseId || 'Unknown'),
      remainTimeHour: Number(dryer.remainTimeHour || dryer.remainHour || 0),
      remainTimeMinute: Number(dryer.remainTimeMinute || dryer.remainMinute || 0),
      initialTimeHour: Number(dryer.initialTimeHour || dryer.initialHour || 0),
      initialTimeMinute: Number(dryer.initialTimeMinute || dryer.initialMinute || 0),
      dryLevel: String(dryer.dryLevel || 'Normal'),
      tempControl: String(dryer.tempControl || dryer.temp || 'Medium'),
      timeDry: Boolean(dryer.timeDry),
      antiCrease: Boolean(dryer.antiCrease || dryer.wrinkleCare),
      childLock: Boolean(dryer.childLock),
      selfClean: Boolean(dryer.selfClean),
      errorCode: dryer.errorCode ? String(dryer.errorCode) : undefined,
    };
  }

  private parseDishwasherState(snapshot: Record<string, unknown>): LGDishwasherState {
    const dishwasher = (snapshot.dishwasher || snapshot) as Record<string, unknown>;
    return {
      state: this.parseDishwasherStateValue(String(dishwasher.state || dishwasher.processState || 'POWEROFF')),
      course: String(dishwasher.course || dishwasher.courseId || 'Unknown'),
      remainTimeHour: Number(dishwasher.remainTimeHour || dishwasher.remainHour || 0),
      remainTimeMinute: Number(dishwasher.remainTimeMinute || dishwasher.remainMinute || 0),
      initialTimeHour: Number(dishwasher.initialTimeHour || dishwasher.initialHour || 0),
      initialTimeMinute: Number(dishwasher.initialTimeMinute || dishwasher.initialMinute || 0),
      reserveTimeHour: Number(dishwasher.reserveTimeHour || dishwasher.reserveHour || 0),
      reserveTimeMinute: Number(dishwasher.reserveTimeMinute || dishwasher.reserveMinute || 0),
      delayStart: Boolean(dishwasher.delayStart || dishwasher.reserve),
      doorOpen: Boolean(dishwasher.doorOpen),
      rinseRefill: Boolean(dishwasher.rinseRefill || dishwasher.lackOfRinseAid),
      childLock: Boolean(dishwasher.childLock),
      extraDry: Boolean(dishwasher.extraDry),
      halfLoad: Boolean(dishwasher.halfLoad),
      steamMode: Boolean(dishwasher.steam || dishwasher.steamMode),
      dualZone: Boolean(dishwasher.dualZone),
      nightDry: Boolean(dishwasher.nightDry),
      energySaver: Boolean(dishwasher.energySaver),
      errorCode: dishwasher.errorCode ? String(dishwasher.errorCode) : undefined,
    };
  }

  private parseAirConditionerState(snapshot: Record<string, unknown>): LGAirConditionerState {
    const ac = (snapshot.airConditioner || snapshot.airState || snapshot) as Record<string, unknown>;
    // Extract nested ThinQ2 state objects
    const airState = ac.airState as Record<string, unknown> | undefined;
    const operation = airState?.operation as Record<string, unknown> | undefined;
    const tempState = airState?.tempState as Record<string, unknown> | undefined;
    const windState = airState?.windState as Record<string, unknown> | undefined;

    return {
      operation: Boolean(ac.operation || operation?.power),
      opMode: this.parseACMode(String(ac.opMode || operation?.mode || 'COOL')),
      tempCurrent: Number(ac.tempCurrent || tempState?.current || 72),
      tempTarget: Number(ac.tempTarget || tempState?.target || 72),
      windStrength: this.parseWindStrength(String(ac.windStrength || windState?.windStrength || 'AUTO')),
      windDirection: this.parseWindDirection(String(ac.windDirection || windState?.direction || 'SWING')),
      airClean: Boolean(ac.airClean),
      airQuality: ac.airQuality ? Number(ac.airQuality) : undefined,
      humidity: ac.humidity ? Number(ac.humidity) : undefined,
      energySaving: Boolean(ac.energySaving || ac.powerSave),
      sleepMode: Boolean(ac.sleepMode || ac.sleep),
      filterRemain: ac.filterRemain ? Number(ac.filterRemain) : undefined,
      errorCode: ac.errorCode ? String(ac.errorCode) : undefined,
    };
  }

  private parseAirPurifierState(snapshot: Record<string, unknown>): LGAirPurifierState {
    const purifier = (snapshot.airPurifier || snapshot.airState || snapshot) as Record<string, unknown>;
    // Extract nested ThinQ2 state objects
    const airState = purifier.airState as Record<string, unknown> | undefined;
    const operation = airState?.operation as Record<string, unknown> | undefined;

    return {
      operation: Boolean(purifier.operation || operation?.power),
      opMode: this.parsePurifierMode(String(purifier.opMode || operation?.mode || 'AUTO')),
      windStrength: this.parsePurifierWindStrength(String(purifier.windStrength || 'AUTO')),
      circulate: Boolean(purifier.circulate || purifier.circulateMode),
      airQuality: Number(purifier.airQuality || purifier.totalPollution || 0),
      pm1: Number(purifier.pm1 || 0),
      pm25: Number(purifier.pm25 || purifier.pm2_5 || 0),
      pm10: Number(purifier.pm10 || 0),
      humidity: purifier.humidity ? Number(purifier.humidity) : undefined,
      filterRemainPercent: Number(purifier.filterRemainPercent || purifier.filterRemain || 100),
      errorCode: purifier.errorCode ? String(purifier.errorCode) : undefined,
    };
  }

  private parseRobotVacuumState(snapshot: Record<string, unknown>): LGRobotVacuumState {
    const vacuum = (snapshot.robotCleaner || snapshot.vacuum || snapshot) as Record<string, unknown>;
    return {
      state: this.parseVacuumState(String(vacuum.state || vacuum.cleanState || 'STANDBY')),
      cleanMode: this.parseCleanMode(String(vacuum.cleanMode || vacuum.mode || 'NORMAL')),
      batteryLevel: Number(vacuum.batteryLevel || vacuum.battery || 0),
      repeat: Boolean(vacuum.repeat),
      cleanArea: vacuum.cleanArea ? Number(vacuum.cleanArea) : undefined,
      cleanTime: vacuum.cleanTime ? Number(vacuum.cleanTime) : undefined,
      errorCode: vacuum.errorCode ? String(vacuum.errorCode) : undefined,
    };
  }

  // Helper parsers
  private parseWasherStateValue(state: string): LGWasherState['state'] {
    const upper = state.toUpperCase();
    if (upper.includes('POWER') || upper.includes('OFF')) return 'POWEROFF';
    if (upper.includes('INITIAL') || upper.includes('IDLE')) return 'INITIAL';
    if (upper.includes('PAUSE')) return 'PAUSE';
    if (upper.includes('DETECT')) return 'DETECTING';
    if (upper.includes('RUN')) return 'RUNNING';
    if (upper.includes('RINSE')) return 'RINSING';
    if (upper.includes('SPIN')) return 'SPINNING';
    if (upper.includes('END') || upper.includes('COMPLETE')) return 'END';
    if (upper.includes('RESERVE')) return 'RESERVED';
    if (upper.includes('ERROR')) return 'ERROR';
    return 'INITIAL';
  }

  private parseDryerStateValue(state: string): LGDryerState['state'] {
    const upper = state.toUpperCase();
    if (upper.includes('POWER') || upper.includes('OFF')) return 'POWEROFF';
    if (upper.includes('INITIAL') || upper.includes('IDLE')) return 'INITIAL';
    if (upper.includes('RUN')) return 'RUNNING';
    if (upper.includes('PAUSE')) return 'PAUSE';
    if (upper.includes('END') || upper.includes('COMPLETE')) return 'END';
    if (upper.includes('ERROR')) return 'ERROR';
    return 'INITIAL';
  }

  private parseDishwasherStateValue(state: string): LGDishwasherState['state'] {
    const upper = state.toUpperCase();
    if (upper.includes('POWER') || upper.includes('OFF')) return 'POWEROFF';
    if (upper.includes('INITIAL') || upper.includes('IDLE')) return 'INITIAL';
    if (upper.includes('RUN')) return 'RUNNING';
    if (upper.includes('PAUSE')) return 'PAUSE';
    if (upper.includes('END') || upper.includes('COMPLETE')) return 'END';
    if (upper.includes('ERROR')) return 'ERROR';
    return 'INITIAL';
  }

  private parseACMode(mode: string): LGAirConditionerState['opMode'] {
    const upper = mode.toUpperCase();
    if (upper.includes('COOL')) return 'COOL';
    if (upper.includes('DRY')) return 'DRY';
    if (upper.includes('FAN')) return 'FAN';
    if (upper.includes('HEAT')) return 'HEAT';
    if (upper.includes('ACO') || upper.includes('AUTO')) return 'ACO';
    if (upper.includes('AI')) return 'AI';
    if (upper.includes('CLEAN')) return 'AIRCLEAN';
    if (upper.includes('AROMA')) return 'AROMA';
    return 'COOL';
  }

  private parseWindStrength(strength: string): LGAirConditionerState['windStrength'] {
    const upper = strength.toUpperCase();
    if (upper.includes('LOW')) return 'LOW';
    if (upper.includes('MID')) return 'MID';
    if (upper.includes('HIGH')) return 'HIGH';
    if (upper.includes('POWER')) return 'POWER';
    if (upper.includes('NATURE')) return 'NATURE';
    return 'AUTO';
  }

  private parseWindDirection(direction: string): LGAirConditionerState['windDirection'] {
    const upper = direction.toUpperCase();
    if (upper.includes('UP') || upper.includes('DOWN')) return 'UP_DOWN';
    if (upper.includes('LEFT') || upper.includes('RIGHT')) return 'LEFT_RIGHT';
    return 'SWING';
  }

  private parsePurifierMode(mode: string): LGAirPurifierState['opMode'] {
    const upper = mode.toUpperCase();
    if (upper.includes('CLEAN')) return 'CLEAN';
    if (upper.includes('SILENT')) return 'SILENT';
    if (upper.includes('CIRCULATOR')) return 'CIRCULATOR';
    if (upper.includes('DUAL')) return 'DUALCLEAN';
    return 'AUTO';
  }

  private parsePurifierWindStrength(strength: string): LGAirPurifierState['windStrength'] {
    const upper = strength.toUpperCase();
    if (upper.includes('LOW')) return 'LOW';
    if (upper.includes('MID')) return 'MID';
    if (upper.includes('HIGH')) return 'HIGH';
    if (upper.includes('POWER')) return 'POWER';
    return 'AUTO';
  }

  private parseVacuumState(state: string): LGRobotVacuumState['state'] {
    const upper = state.toUpperCase();
    if (upper.includes('CHARG')) return 'CHARGING';
    if (upper.includes('WORK') || upper.includes('CLEAN')) return 'WORKING';
    if (upper.includes('PAUSE')) return 'PAUSE';
    if (upper.includes('HOM') || upper.includes('RETURN')) return 'HOMING';
    if (upper.includes('ERROR')) return 'ERROR';
    return 'STANDBY';
  }

  private parseCleanMode(mode: string): LGRobotVacuumState['cleanMode'] {
    const upper = mode.toUpperCase();
    if (upper.includes('TURBO')) return 'TURBO';
    if (upper.includes('SILENT')) return 'SILENT';
    if (upper.includes('MOP')) return 'MOP';
    return 'NORMAL';
  }

  private mapDeviceType(type: string): LGDeviceType {
    const upper = type.toUpperCase();
    const validTypes: LGDeviceType[] = [
      'REFRIGERATOR', 'KIMCHI_REFRIGERATOR', 'WINE_CELLAR', 'WASHER', 'DRYER', 'STYLER',
      'DISHWASHER', 'OVEN', 'MICROWAVE', 'COOKTOP', 'HOOD', 'AIR_CONDITIONER',
      'AIR_PURIFIER', 'DEHUMIDIFIER', 'HUMIDIFIER', 'ROBOT_VACUUM', 'TV',
      'STICK_VACUUM', 'WATER_PURIFIER', 'WATER_HEATER',
    ];
    if (validTypes.includes(upper as LGDeviceType)) {
      return upper as LGDeviceType;
    }
    // Handle common variations
    if (upper.includes('REF')) return 'REFRIGERATOR';
    if (upper.includes('WASH') && !upper.includes('DISH')) return 'WASHER';
    if (upper.includes('DRY')) return 'DRYER';
    if (upper.includes('DISH')) return 'DISHWASHER';
    if (upper.includes('AC') || upper.includes('AIR_CON')) return 'AIR_CONDITIONER';
    if (upper.includes('PURIF')) return 'AIR_PURIFIER';
    if (upper.includes('VAC') || upper.includes('ROBOT')) return 'ROBOT_VACUUM';
    return 'UNKNOWN';
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'devices',
        name: 'Devices',
        description: 'All connected LG devices with status',
        widgetTypes: ['lg-devices'],
      },
      {
        id: 'device-detail',
        name: 'Device Detail',
        description: 'Detailed state of a single device',
        widgetTypes: ['lg-device-detail'],
      },
      {
        id: 'refrigerator',
        name: 'Refrigerator',
        description: 'Refrigerator temperatures and status',
        widgetTypes: ['lg-refrigerator'],
      },
      {
        id: 'laundry',
        name: 'Laundry',
        description: 'Washer and dryer status',
        widgetTypes: ['lg-laundry'],
      },
      {
        id: 'dishwasher',
        name: 'Dishwasher',
        description: 'Dishwasher cycle status',
        widgetTypes: ['lg-dishwasher'],
      },
      {
        id: 'climate',
        name: 'Climate',
        description: 'AC and air purifier status',
        widgetTypes: ['lg-climate'],
      },
      {
        id: 'robot-vacuum',
        name: 'Robot Vacuum',
        description: 'Robot vacuum status and battery',
        widgetTypes: ['lg-robot-vacuum'],
      },
      {
        id: 'energy',
        name: 'Energy',
        description: 'Energy usage data',
        widgetTypes: ['lg-energy'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-login',
        name: 'Authenticate',
        description: 'Authenticate with LG ThinQ account',
        method: 'POST',
        endpoint: '/v1/service/users/auth',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'LG account email' },
          { name: 'password', type: 'string', required: true, description: 'LG account password' },
        ],
        documentationUrl: 'https://github.com/sampsyo/wideq',
      },
      {
        id: 'auth-refresh',
        name: 'Refresh Token',
        description: 'Refresh access token',
        method: 'POST',
        endpoint: '/v1/service/users/token/refresh',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'refreshToken', type: 'string', required: true },
        ],
      },

      // Devices
      {
        id: 'devices-dashboard',
        name: 'Get Dashboard',
        description: 'Get all devices and their current state',
        method: 'GET',
        endpoint: '/v1/service/application/dashboard',
        implemented: true,
        category: 'Devices',
      },
      {
        id: 'device-info',
        name: 'Get Device Info',
        description: 'Get detailed info for a specific device',
        method: 'GET',
        endpoint: '/v1/service/devices/{deviceId}',
        implemented: true,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },
      {
        id: 'device-snapshot',
        name: 'Get Device Snapshot',
        description: 'Get current state snapshot of a device',
        method: 'GET',
        endpoint: '/v1/service/devices/{deviceId}/snapshot',
        implemented: true,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },
      {
        id: 'device-control',
        name: 'Control Device',
        description: 'Send control command to a device',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'command', type: 'string', required: true },
          { name: 'data', type: 'object', required: false },
        ],
      },

      // Energy
      {
        id: 'device-energy',
        name: 'Get Energy Usage',
        description: 'Get energy consumption data for a device',
        method: 'GET',
        endpoint: '/v1/service/devices/{deviceId}/energy',
        implemented: true,
        category: 'Energy',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },

      // Refrigerator Controls
      {
        id: 'fridge-temp-set',
        name: 'Set Fridge Temperature',
        description: 'Set refrigerator temperature',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'temperature', type: 'number', required: true },
        ],
      },
      {
        id: 'freezer-temp-set',
        name: 'Set Freezer Temperature',
        description: 'Set freezer temperature',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'temperature', type: 'number', required: true },
        ],
      },
      {
        id: 'fridge-express-mode',
        name: 'Toggle Express Mode',
        description: 'Enable/disable express cooling',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'enabled', type: 'boolean', required: true },
        ],
      },

      // Washer Controls
      {
        id: 'washer-start',
        name: 'Start Washer',
        description: 'Start the washer cycle',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Laundry',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },
      {
        id: 'washer-pause',
        name: 'Pause Washer',
        description: 'Pause the current cycle',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Laundry',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },
      {
        id: 'washer-set-course',
        name: 'Set Wash Course',
        description: 'Set the wash cycle/course',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Laundry',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'course', type: 'string', required: true },
        ],
      },

      // Dryer Controls
      {
        id: 'dryer-start',
        name: 'Start Dryer',
        description: 'Start the dryer cycle',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Laundry',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },
      {
        id: 'dryer-pause',
        name: 'Pause Dryer',
        description: 'Pause the current cycle',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Laundry',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },

      // AC Controls
      {
        id: 'ac-power',
        name: 'AC Power',
        description: 'Turn AC on/off',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Climate',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'power', type: 'boolean', required: true },
        ],
      },
      {
        id: 'ac-temp-set',
        name: 'Set AC Temperature',
        description: 'Set target temperature',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Climate',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'temperature', type: 'number', required: true },
        ],
      },
      {
        id: 'ac-mode-set',
        name: 'Set AC Mode',
        description: 'Set operating mode (cool, heat, fan, etc.)',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Climate',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'mode', type: 'string', required: true },
        ],
      },
      {
        id: 'ac-fan-set',
        name: 'Set Fan Speed',
        description: 'Set fan speed',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Climate',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'speed', type: 'string', required: true },
        ],
      },

      // Air Purifier Controls
      {
        id: 'purifier-power',
        name: 'Purifier Power',
        description: 'Turn air purifier on/off',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Climate',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'power', type: 'boolean', required: true },
        ],
      },
      {
        id: 'purifier-mode-set',
        name: 'Set Purifier Mode',
        description: 'Set operating mode',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Climate',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'mode', type: 'string', required: true },
        ],
      },

      // Robot Vacuum Controls
      {
        id: 'vacuum-start',
        name: 'Start Cleaning',
        description: 'Start robot vacuum cleaning',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Robot Vacuum',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },
      {
        id: 'vacuum-pause',
        name: 'Pause Cleaning',
        description: 'Pause robot vacuum',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Robot Vacuum',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },
      {
        id: 'vacuum-home',
        name: 'Return to Dock',
        description: 'Send robot vacuum to charging dock',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Robot Vacuum',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
        ],
      },
      {
        id: 'vacuum-mode-set',
        name: 'Set Clean Mode',
        description: 'Set cleaning mode (normal, turbo, silent)',
        method: 'POST',
        endpoint: '/v1/service/devices/{deviceId}/control',
        implemented: false,
        category: 'Robot Vacuum',
        parameters: [
          { name: 'deviceId', type: 'string', required: true },
          { name: 'mode', type: 'string', required: true },
        ],
      },

      // MQTT/Real-time
      {
        id: 'mqtt-connect',
        name: 'Connect MQTT',
        description: 'Establish MQTT connection for real-time updates (ThinQ2 devices)',
        method: 'GET',
        endpoint: 'mqtt://{region}.lgeapi.com',
        implemented: false,
        category: 'Real-time',
      },
    ];
  }
}
