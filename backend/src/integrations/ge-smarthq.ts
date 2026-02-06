import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  GESmartHQConfig,
  GEAppliance,
  GEApplianceType,
  GERefrigeratorState,
  GEDishwasherState,
  GEWasherState,
  GEDryerState,
  GEOvenState,
  GEAirConditionerState,
  GEOpalIceMakerState,
} from '../types';
import { logger } from '../services/logger';

// GE SmartHQ API URLs
const AUTH_BASE_URL = 'https://accounts.brillion.geappliances.com';
const API_BASE_URL = 'https://api.brillion.geappliances.com';

// Token cache for authenticated sessions
interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCache>();
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry

// ERD Code mappings (common codes from gehome library)
const ERD_CODES = {
  // Universal
  MODEL_NUMBER: '0x0001',
  SERIAL_NUMBER: '0x0002',
  APPLIANCE_TYPE: '0x0007',
  SABBATH_MODE: '0x0009',

  // Refrigerator
  FRIDGE_SETPOINT: '0x0100',
  FRIDGE_TEMP: '0x0101',
  FREEZER_SETPOINT: '0x0102',
  FREEZER_TEMP: '0x0103',
  DOOR_STATUS: '0x0104',
  WATER_FILTER_STATUS: '0x0105',
  ICE_MAKER_STATUS: '0x0106',
  TURBO_FREEZE: '0x0107',
  TURBO_COOL: '0x0108',

  // Dishwasher/Laundry
  CYCLE_STATE: '0x1000',
  CYCLE_NAME: '0x1001',
  TIME_REMAINING: '0x1002',
  DELAY_START: '0x1003',
  RINSE_AID_LEVEL: '0x1004',
  DOOR_STATUS_DW: '0x1005',

  // Washer
  SPIN_SPEED: '0x1100',
  WASH_TEMP: '0x1101',
  SOIL_LEVEL: '0x1102',
  DOOR_LOCKED: '0x1103',

  // Dryer
  HEAT_LEVEL: '0x1200',
  DAMP_ALERT: '0x1201',
  ECO_MODE: '0x1202',

  // Oven
  UPPER_OVEN_MODE: '0x5000',
  UPPER_OVEN_SETPOINT: '0x5001',
  UPPER_OVEN_TEMP: '0x5002',
  UPPER_OVEN_STATE: '0x5003',
  UPPER_OVEN_TIMER: '0x5004',
  UPPER_OVEN_PROBE: '0x5005',
  LOWER_OVEN_MODE: '0x5100',
  LOWER_OVEN_SETPOINT: '0x5101',
  LOWER_OVEN_TEMP: '0x5102',
  LOWER_OVEN_STATE: '0x5103',
  LOWER_OVEN_TIMER: '0x5104',
  COOKTOP_STATUS: '0x5200',

  // AC
  AC_POWER: '0x6000',
  AC_MODE: '0x6001',
  AC_FAN_SPEED: '0x6002',
  AC_TARGET_TEMP: '0x6003',
  AC_CURRENT_TEMP: '0x6004',
  AC_HUMIDITY: '0x6005',
  AC_FILTER_ALERT: '0x6006',

  // Opal Ice Maker
  OPAL_POWER: '0x7000',
  OPAL_MAKING: '0x7001',
  OPAL_ICE_BIN: '0x7002',
  OPAL_WATER_STATUS: '0x7003',
  OPAL_NIGHT_LIGHT: '0x7004',
  OPAL_SCHEDULE: '0x7005',
};

export class GESmartHQIntegration extends BaseIntegration {
  readonly type = 'ge-smarthq';
  readonly name = 'GE SmartHQ';

  private getCacheKey(config: GESmartHQConfig): string {
    return `ge_${config.email}`;
  }

  private async authenticate(config: GESmartHQConfig): Promise<TokenCache> {
    const cacheKey = this.getCacheKey(config);

    try {
      // GE uses OAuth2 with password grant (non-standard)
      const response = await axios.post(
        `${AUTH_BASE_URL}/oauth2/token`,
        new URLSearchParams({
          grant_type: 'password',
          username: config.email,
          password: config.password,
          client_id: 'mobile_app',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const cache: TokenCache = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000),
      };

      tokenCache.set(cacheKey, cache);
      return cache;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ge-smarthq', 'Authentication failed', { error: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  private async refreshToken(config: GESmartHQConfig): Promise<TokenCache> {
    const cacheKey = this.getCacheKey(config);
    const cached = tokenCache.get(cacheKey);

    if (!cached?.refreshToken) {
      return this.authenticate(config);
    }

    try {
      const response = await axios.post(
        `${AUTH_BASE_URL}/oauth2/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: cached.refreshToken,
          client_id: 'mobile_app',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const cache: TokenCache = {
        accessToken: access_token,
        refreshToken: refresh_token || cached.refreshToken,
        expiresAt: Date.now() + (expires_in * 1000),
      };

      tokenCache.set(cacheKey, cache);
      return cache;
    } catch {
      // If refresh fails, try full authentication
      return this.authenticate(config);
    }
  }

  private async ensureAuthenticated(config: GESmartHQConfig): Promise<string> {
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

  private createClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: API_BASE_URL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const geConfig = config as GESmartHQConfig;

    if (!geConfig.email || !geConfig.password) {
      return { success: false, message: 'Email and password are required' };
    }

    try {
      const accessToken = await this.ensureAuthenticated(geConfig);
      const client = this.createClient(accessToken);

      const response = await client.get('/v1/appliance');
      const appliances = response.data?.items || response.data || [];

      return {
        success: true,
        message: `Connected to GE SmartHQ`,
        details: {
          appliances: appliances.length,
          types: [...new Set(appliances.map((a: GEAppliance) => a.type))],
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ge-smarthq', 'Connection test failed', { error: errorMsg });

      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        return { success: false, message: 'Invalid credentials. Check your email and password.' };
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const geConfig = config as GESmartHQConfig;

    switch (metric) {
      case 'appliances':
        return this.getAppliances(geConfig);
      case 'appliance-detail':
        return this.getApplianceDetail(geConfig);
      case 'refrigerator':
        return this.getRefrigeratorData(geConfig);
      case 'laundry':
        return this.getLaundryData(geConfig);
      case 'dishwasher':
        return this.getDishwasherData(geConfig);
      case 'oven':
        return this.getOvenData(geConfig);
      case 'hvac':
        return this.getHVACData(geConfig);
      default:
        return this.getAppliances(geConfig);
    }
  }

  private async getAppliances(config: GESmartHQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken);

      const response = await client.get('/v1/appliance');
      const rawAppliances = response.data?.items || response.data || [];

      const appliances: GEAppliance[] = rawAppliances.map((a: Record<string, unknown>) => ({
        applianceId: String(a.applianceId || a.id || ''),
        type: this.mapApplianceType(String(a.type || '')),
        brand: String(a.brand || 'GE'),
        jid: String(a.jid || ''),
        nickname: String(a.nickname || a.name || 'Unknown'),
        online: Boolean(a.online),
        lastSeen: a.lastSeen ? String(a.lastSeen) : undefined,
        features: Array.isArray(a.features) ? a.features : [],
        erd: (a.erd || {}) as Record<string, string>,
      }));

      // Group by type
      const byType: Record<string, GEAppliance[]> = {};
      appliances.forEach((a) => {
        if (!byType[a.type]) byType[a.type] = [];
        byType[a.type].push(a);
      });

      return {
        appliances,
        total: appliances.length,
        online: appliances.filter((a) => a.online).length,
        offline: appliances.filter((a) => !a.online).length,
        byType,
        kitchen: appliances.filter((a) =>
          ['REFRIGERATOR', 'FREEZER', 'DISHWASHER', 'OVEN', 'RANGE', 'COOKTOP', 'MICROWAVE', 'COFFEE_MAKER', 'OPAL_ICE_MAKER'].includes(a.type)
        ).length,
        laundry: appliances.filter((a) =>
          ['WASHER', 'DRYER', 'WASHER_DRYER'].includes(a.type)
        ).length,
        hvac: appliances.filter((a) =>
          ['AIR_CONDITIONER', 'WATER_HEATER'].includes(a.type)
        ).length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ge-smarthq', 'Failed to get appliances', { error: errorMsg });
      throw new Error(`Failed to get appliances: ${errorMsg}`);
    }
  }

  private async getApplianceDetail(config: GESmartHQConfig): Promise<IntegrationData> {
    // Returns the first appliance with full ERD data
    const appliancesData = await this.getAppliances(config);
    const appliances = appliancesData.appliances as GEAppliance[];

    if (appliances.length === 0) {
      return { appliance: null, error: 'No appliances found' };
    }

    const appliance = appliances[0];

    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken);

      const erdResponse = await client.get(`/v1/appliance/${appliance.applianceId}/erd`);
      const erdData = erdResponse.data || {};

      return {
        appliance: {
          ...appliance,
          erd: erdData,
        },
        erdCodes: Object.keys(erdData).length,
      };
    } catch {
      return {
        appliance,
        erdCodes: 0,
      };
    }
  }

  private async getRefrigeratorData(config: GESmartHQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken);

      const response = await client.get('/v1/appliance');
      const appliances = (response.data?.items || response.data || []) as Record<string, unknown>[];

      const refrigerators = appliances.filter(
        (a) => this.mapApplianceType(String(a.type || '')) === 'REFRIGERATOR'
      );

      const states: Array<{ appliance: GEAppliance; state: GERefrigeratorState }> = [];

      for (const fridge of refrigerators) {
        const applianceId = String(fridge.applianceId || fridge.id || '');

        try {
          const erdResponse = await client.get(`/v1/appliance/${applianceId}/erd`);
          const erd = erdResponse.data || {};

          states.push({
            appliance: {
              applianceId,
              type: 'REFRIGERATOR',
              brand: String(fridge.brand || 'GE'),
              jid: String(fridge.jid || ''),
              nickname: String(fridge.nickname || fridge.name || 'Refrigerator'),
              online: Boolean(fridge.online),
              features: [],
              erd,
            },
            state: this.parseRefrigeratorState(erd),
          });
        } catch {
          // Skip if we can't get ERD data
        }
      }

      return {
        refrigerators: states,
        total: refrigerators.length,
        online: states.filter((s) => s.appliance.online).length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get refrigerator data: ${errorMsg}`);
    }
  }

  private async getLaundryData(config: GESmartHQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken);

      const response = await client.get('/v1/appliance');
      const appliances = (response.data?.items || response.data || []) as Record<string, unknown>[];

      const washers = appliances.filter(
        (a) => ['WASHER', 'WASHER_DRYER'].includes(this.mapApplianceType(String(a.type || '')))
      );
      const dryers = appliances.filter(
        (a) => ['DRYER', 'WASHER_DRYER'].includes(this.mapApplianceType(String(a.type || '')))
      );

      const washerStates: Array<{ appliance: GEAppliance; state: GEWasherState }> = [];
      const dryerStates: Array<{ appliance: GEAppliance; state: GEDryerState }> = [];

      for (const washer of washers) {
        const applianceId = String(washer.applianceId || washer.id || '');
        try {
          const erdResponse = await client.get(`/v1/appliance/${applianceId}/erd`);
          const erd = erdResponse.data || {};
          washerStates.push({
            appliance: {
              applianceId,
              type: 'WASHER',
              brand: String(washer.brand || 'GE'),
              jid: String(washer.jid || ''),
              nickname: String(washer.nickname || washer.name || 'Washer'),
              online: Boolean(washer.online),
              features: [],
              erd,
            },
            state: this.parseWasherState(erd),
          });
        } catch {
          // Skip
        }
      }

      for (const dryer of dryers) {
        const applianceId = String(dryer.applianceId || dryer.id || '');
        try {
          const erdResponse = await client.get(`/v1/appliance/${applianceId}/erd`);
          const erd = erdResponse.data || {};
          dryerStates.push({
            appliance: {
              applianceId,
              type: 'DRYER',
              brand: String(dryer.brand || 'GE'),
              jid: String(dryer.jid || ''),
              nickname: String(dryer.nickname || dryer.name || 'Dryer'),
              online: Boolean(dryer.online),
              features: [],
              erd,
            },
            state: this.parseDryerState(erd),
          });
        } catch {
          // Skip
        }
      }

      const running = [
        ...washerStates.filter((s) => s.state.cycleState === 'running'),
        ...dryerStates.filter((s) => s.state.cycleState === 'running'),
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

  private async getDishwasherData(config: GESmartHQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken);

      const response = await client.get('/v1/appliance');
      const appliances = (response.data?.items || response.data || []) as Record<string, unknown>[];

      const dishwashers = appliances.filter(
        (a) => this.mapApplianceType(String(a.type || '')) === 'DISHWASHER'
      );

      const states: Array<{ appliance: GEAppliance; state: GEDishwasherState }> = [];

      for (const dw of dishwashers) {
        const applianceId = String(dw.applianceId || dw.id || '');
        try {
          const erdResponse = await client.get(`/v1/appliance/${applianceId}/erd`);
          const erd = erdResponse.data || {};
          states.push({
            appliance: {
              applianceId,
              type: 'DISHWASHER',
              brand: String(dw.brand || 'GE'),
              jid: String(dw.jid || ''),
              nickname: String(dw.nickname || dw.name || 'Dishwasher'),
              online: Boolean(dw.online),
              features: [],
              erd,
            },
            state: this.parseDishwasherState(erd),
          });
        } catch {
          // Skip
        }
      }

      return {
        dishwashers: states,
        total: dishwashers.length,
        running: states.filter((s) => s.state.cycleState === 'running').length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get dishwasher data: ${errorMsg}`);
    }
  }

  private async getOvenData(config: GESmartHQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken);

      const response = await client.get('/v1/appliance');
      const appliances = (response.data?.items || response.data || []) as Record<string, unknown>[];

      const ovens = appliances.filter((a) =>
        ['OVEN', 'RANGE', 'COOKTOP', 'ADVANTIUM'].includes(this.mapApplianceType(String(a.type || '')))
      );

      const states: Array<{ appliance: GEAppliance; state: GEOvenState }> = [];

      for (const oven of ovens) {
        const applianceId = String(oven.applianceId || oven.id || '');
        try {
          const erdResponse = await client.get(`/v1/appliance/${applianceId}/erd`);
          const erd = erdResponse.data || {};
          states.push({
            appliance: {
              applianceId,
              type: this.mapApplianceType(String(oven.type || '')),
              brand: String(oven.brand || 'GE'),
              jid: String(oven.jid || ''),
              nickname: String(oven.nickname || oven.name || 'Oven'),
              online: Boolean(oven.online),
              features: [],
              erd,
            },
            state: this.parseOvenState(erd),
          });
        } catch {
          // Skip
        }
      }

      const active = states.filter(
        (s) => s.state.upperOvenState !== 'off' || (s.state.lowerOvenState && s.state.lowerOvenState !== 'off')
      ).length;

      return {
        ovens: states,
        total: ovens.length,
        active,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get oven data: ${errorMsg}`);
    }
  }

  private async getHVACData(config: GESmartHQConfig): Promise<IntegrationData> {
    try {
      const accessToken = await this.ensureAuthenticated(config);
      const client = this.createClient(accessToken);

      const response = await client.get('/v1/appliance');
      const appliances = (response.data?.items || response.data || []) as Record<string, unknown>[];

      const hvacUnits = appliances.filter((a) =>
        ['AIR_CONDITIONER', 'WATER_HEATER'].includes(this.mapApplianceType(String(a.type || '')))
      );

      const states: Array<{ appliance: GEAppliance; state: GEAirConditionerState }> = [];

      for (const unit of hvacUnits) {
        const applianceId = String(unit.applianceId || unit.id || '');
        try {
          const erdResponse = await client.get(`/v1/appliance/${applianceId}/erd`);
          const erd = erdResponse.data || {};
          states.push({
            appliance: {
              applianceId,
              type: this.mapApplianceType(String(unit.type || '')),
              brand: String(unit.brand || 'GE'),
              jid: String(unit.jid || ''),
              nickname: String(unit.nickname || unit.name || 'AC Unit'),
              online: Boolean(unit.online),
              features: [],
              erd,
            },
            state: this.parseAirConditionerState(erd),
          });
        } catch {
          // Skip
        }
      }

      return {
        units: states,
        total: hvacUnits.length,
        active: states.filter((s) => s.state.powerOn).length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get HVAC data: ${errorMsg}`);
    }
  }

  // ERD State parsers
  private parseRefrigeratorState(erd: Record<string, string>): GERefrigeratorState {
    return {
      fridgeTemp: this.parseTemp(erd[ERD_CODES.FRIDGE_TEMP]) || 37,
      fridgeTempSet: this.parseTemp(erd[ERD_CODES.FRIDGE_SETPOINT]) || 37,
      freezerTemp: this.parseTemp(erd[ERD_CODES.FREEZER_TEMP]) || 0,
      freezerTempSet: this.parseTemp(erd[ERD_CODES.FREEZER_SETPOINT]) || 0,
      doorOpen: this.parseBool(erd[ERD_CODES.DOOR_STATUS]),
      filterStatus: this.parseFilterStatus(erd[ERD_CODES.WATER_FILTER_STATUS]),
      icemaker: this.parseBool(erd[ERD_CODES.ICE_MAKER_STATUS]) ? 'on' : 'off',
      turboFreezeActive: this.parseBool(erd[ERD_CODES.TURBO_FREEZE]),
      turboCoolActive: this.parseBool(erd[ERD_CODES.TURBO_COOL]),
      waterFilterRemaining: this.parsePercent(erd[ERD_CODES.WATER_FILTER_STATUS]) || 100,
    };
  }

  private parseDishwasherState(erd: Record<string, string>): GEDishwasherState {
    return {
      cycleState: this.parseCycleState(erd[ERD_CODES.CYCLE_STATE]),
      cycleName: erd[ERD_CODES.CYCLE_NAME] || 'Unknown',
      timeRemaining: this.parseMinutes(erd[ERD_CODES.TIME_REMAINING]) || 0,
      delayStartHours: this.parseHours(erd[ERD_CODES.DELAY_START]) || 0,
      rinseAidLevel: this.parseRinseAidLevel(erd[ERD_CODES.RINSE_AID_LEVEL]),
      doorOpen: this.parseBool(erd[ERD_CODES.DOOR_STATUS_DW]),
      pods: 0, // Not always available
    };
  }

  private parseWasherState(erd: Record<string, string>): GEWasherState {
    return {
      cycleState: this.parseCycleState(erd[ERD_CODES.CYCLE_STATE]),
      cycleName: erd[ERD_CODES.CYCLE_NAME] || 'Unknown',
      timeRemaining: this.parseMinutes(erd[ERD_CODES.TIME_REMAINING]) || 0,
      spinSpeed: erd[ERD_CODES.SPIN_SPEED] || 'Normal',
      washTemp: erd[ERD_CODES.WASH_TEMP] || 'Normal',
      soilLevel: erd[ERD_CODES.SOIL_LEVEL] || 'Normal',
      doorLocked: this.parseBool(erd[ERD_CODES.DOOR_LOCKED]),
      delayStartHours: this.parseHours(erd[ERD_CODES.DELAY_START]) || 0,
    };
  }

  private parseDryerState(erd: Record<string, string>): GEDryerState {
    return {
      cycleState: this.parseCycleState(erd[ERD_CODES.CYCLE_STATE]),
      cycleName: erd[ERD_CODES.CYCLE_NAME] || 'Unknown',
      timeRemaining: this.parseMinutes(erd[ERD_CODES.TIME_REMAINING]) || 0,
      heatLevel: erd[ERD_CODES.HEAT_LEVEL] || 'Medium',
      dampAlert: this.parseBool(erd[ERD_CODES.DAMP_ALERT]),
      ecoMode: this.parseBool(erd[ERD_CODES.ECO_MODE]),
    };
  }

  private parseOvenState(erd: Record<string, string>): GEOvenState {
    return {
      upperOvenState: this.parseOvenStateValue(erd[ERD_CODES.UPPER_OVEN_STATE]),
      upperOvenMode: erd[ERD_CODES.UPPER_OVEN_MODE] || 'Off',
      upperOvenTemp: this.parseTemp(erd[ERD_CODES.UPPER_OVEN_TEMP]) || 0,
      upperOvenTempSet: this.parseTemp(erd[ERD_CODES.UPPER_OVEN_SETPOINT]) || 0,
      upperOvenProbeTemp: this.parseTemp(erd[ERD_CODES.UPPER_OVEN_PROBE]),
      upperOvenTimeRemaining: this.parseMinutes(erd[ERD_CODES.UPPER_OVEN_TIMER]) || 0,
      lowerOvenState: erd[ERD_CODES.LOWER_OVEN_STATE]
        ? this.parseOvenStateValue(erd[ERD_CODES.LOWER_OVEN_STATE])
        : undefined,
      lowerOvenMode: erd[ERD_CODES.LOWER_OVEN_MODE] || undefined,
      lowerOvenTemp: this.parseTemp(erd[ERD_CODES.LOWER_OVEN_TEMP]),
      lowerOvenTempSet: this.parseTemp(erd[ERD_CODES.LOWER_OVEN_SETPOINT]),
      lowerOvenTimeRemaining: this.parseMinutes(erd[ERD_CODES.LOWER_OVEN_TIMER]),
      sabbathMode: this.parseBool(erd[ERD_CODES.SABBATH_MODE]),
    };
  }

  private parseAirConditionerState(erd: Record<string, string>): GEAirConditionerState {
    return {
      powerOn: this.parseBool(erd[ERD_CODES.AC_POWER]),
      mode: this.parseACMode(erd[ERD_CODES.AC_MODE]),
      fanSpeed: this.parseFanSpeed(erd[ERD_CODES.AC_FAN_SPEED]),
      currentTemp: this.parseTemp(erd[ERD_CODES.AC_CURRENT_TEMP]) || 72,
      targetTemp: this.parseTemp(erd[ERD_CODES.AC_TARGET_TEMP]) || 72,
      humidity: this.parsePercent(erd[ERD_CODES.AC_HUMIDITY]),
      filterAlert: this.parseBool(erd[ERD_CODES.AC_FILTER_ALERT]),
    };
  }

  // Helper parsers
  private parseTemp(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 16) || parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }

  private parseBool(value: string | undefined): boolean {
    if (!value) return false;
    return value === '1' || value.toLowerCase() === 'true' || value === 'on';
  }

  private parseMinutes(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }

  private parseHours(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }

  private parsePercent(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : Math.min(100, Math.max(0, num));
  }

  private parseCycleState(value: string | undefined): 'idle' | 'running' | 'paused' | 'complete' {
    if (!value) return 'idle';
    const lower = value.toLowerCase();
    if (lower.includes('run')) return 'running';
    if (lower.includes('pause')) return 'paused';
    if (lower.includes('complete') || lower.includes('done')) return 'complete';
    return 'idle';
  }

  private parseFilterStatus(value: string | undefined): 'good' | 'replace_soon' | 'replace_now' {
    if (!value) return 'good';
    const percent = parseInt(value, 10);
    if (!isNaN(percent)) {
      if (percent < 10) return 'replace_now';
      if (percent < 25) return 'replace_soon';
    }
    return 'good';
  }

  private parseRinseAidLevel(value: string | undefined): 'full' | 'low' | 'empty' {
    if (!value) return 'full';
    const lower = value.toLowerCase();
    if (lower.includes('empty') || lower === '0') return 'empty';
    if (lower.includes('low')) return 'low';
    return 'full';
  }

  private parseOvenStateValue(value: string | undefined): 'off' | 'preheating' | 'cooking' | 'keep_warm' {
    if (!value) return 'off';
    const lower = value.toLowerCase();
    if (lower.includes('preheat')) return 'preheating';
    if (lower.includes('cook') || lower.includes('bake') || lower.includes('broil')) return 'cooking';
    if (lower.includes('warm')) return 'keep_warm';
    return 'off';
  }

  private parseACMode(value: string | undefined): 'cool' | 'heat' | 'fan' | 'auto' | 'eco' {
    if (!value) return 'cool';
    const lower = value.toLowerCase();
    if (lower.includes('heat')) return 'heat';
    if (lower.includes('fan')) return 'fan';
    if (lower.includes('auto')) return 'auto';
    if (lower.includes('eco') || lower.includes('energy')) return 'eco';
    return 'cool';
  }

  private parseFanSpeed(value: string | undefined): 'low' | 'medium' | 'high' | 'auto' {
    if (!value) return 'auto';
    const lower = value.toLowerCase();
    if (lower.includes('low')) return 'low';
    if (lower.includes('high')) return 'high';
    if (lower.includes('med')) return 'medium';
    return 'auto';
  }

  private mapApplianceType(type: string): GEApplianceType {
    const upper = type.toUpperCase();
    const validTypes: GEApplianceType[] = [
      'REFRIGERATOR', 'FREEZER', 'WINE_COOLER', 'DISHWASHER', 'WASHER', 'DRYER',
      'WASHER_DRYER', 'OVEN', 'COOKTOP', 'RANGE', 'MICROWAVE', 'HOOD',
      'AIR_CONDITIONER', 'WATER_HEATER', 'WATER_SOFTENER', 'WATER_FILTER',
      'GARBAGE_DISPOSAL', 'ADVANTIUM', 'COFFEE_MAKER', 'OPAL_ICE_MAKER',
    ];
    if (validTypes.includes(upper as GEApplianceType)) {
      return upper as GEApplianceType;
    }
    return 'UNKNOWN';
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'appliances',
        name: 'Appliances',
        description: 'All connected GE appliances with status',
        widgetTypes: ['ge-appliances'],
      },
      {
        id: 'appliance-detail',
        name: 'Appliance Detail',
        description: 'Detailed state of a single appliance',
        widgetTypes: ['ge-appliance-detail'],
      },
      {
        id: 'refrigerator',
        name: 'Refrigerator',
        description: 'Refrigerator temperatures and status',
        widgetTypes: ['ge-refrigerator'],
      },
      {
        id: 'laundry',
        name: 'Laundry',
        description: 'Washer and dryer status',
        widgetTypes: ['ge-laundry'],
      },
      {
        id: 'dishwasher',
        name: 'Dishwasher',
        description: 'Dishwasher cycle status',
        widgetTypes: ['ge-dishwasher'],
      },
      {
        id: 'oven',
        name: 'Oven',
        description: 'Oven temperature and mode',
        widgetTypes: ['ge-oven'],
      },
      {
        id: 'hvac',
        name: 'HVAC',
        description: 'Air conditioner and water heater status',
        widgetTypes: ['ge-hvac'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-password',
        name: 'Authenticate with Password',
        description: 'Authenticate using GE account email and password',
        method: 'POST',
        endpoint: '/oauth2/token',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'username', type: 'string', required: true, description: 'GE account email' },
          { name: 'password', type: 'string', required: true, description: 'GE account password' },
        ],
        documentationUrl: 'https://github.com/simbaja/gehome',
      },
      {
        id: 'auth-refresh',
        name: 'Refresh Token',
        description: 'Refresh access token using refresh token',
        method: 'POST',
        endpoint: '/oauth2/token',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'refresh_token', type: 'string', required: true, description: 'Refresh token' },
        ],
      },

      // Appliances
      {
        id: 'appliances-list',
        name: 'List Appliances',
        description: 'Get all connected appliances',
        method: 'GET',
        endpoint: '/v1/appliance',
        implemented: true,
        category: 'Appliances',
      },
      {
        id: 'appliance-get',
        name: 'Get Appliance',
        description: 'Get details for a specific appliance',
        method: 'GET',
        endpoint: '/v1/appliance/{applianceId}',
        implemented: true,
        category: 'Appliances',
        parameters: [
          { name: 'applianceId', type: 'string', required: true, description: 'Appliance ID' },
        ],
      },
      {
        id: 'appliance-erd',
        name: 'Get Appliance ERD Data',
        description: 'Get all ERD (Entity-Relationship Diagram) values for an appliance',
        method: 'GET',
        endpoint: '/v1/appliance/{applianceId}/erd',
        implemented: true,
        category: 'Appliances',
        parameters: [
          { name: 'applianceId', type: 'string', required: true, description: 'Appliance ID' },
        ],
      },
      {
        id: 'appliance-features',
        name: 'Get Appliance Features',
        description: 'Get available features for an appliance',
        method: 'GET',
        endpoint: '/v1/appliance/{applianceId}/features',
        implemented: false,
        category: 'Appliances',
        parameters: [
          { name: 'applianceId', type: 'string', required: true, description: 'Appliance ID' },
        ],
      },

      // ERD Control
      {
        id: 'erd-get',
        name: 'Get ERD Value',
        description: 'Get a specific ERD value',
        method: 'GET',
        endpoint: '/v1/appliance/{applianceId}/erd/{erdCode}',
        implemented: false,
        category: 'ERD Control',
        parameters: [
          { name: 'applianceId', type: 'string', required: true, description: 'Appliance ID' },
          { name: 'erdCode', type: 'string', required: true, description: 'ERD code (e.g., 0x0100)' },
        ],
      },
      {
        id: 'erd-set',
        name: 'Set ERD Value',
        description: 'Set an ERD value to control appliance',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/{erdCode}',
        implemented: false,
        category: 'ERD Control',
        parameters: [
          { name: 'applianceId', type: 'string', required: true, description: 'Appliance ID' },
          { name: 'erdCode', type: 'string', required: true, description: 'ERD code' },
          { name: 'value', type: 'string', required: true, description: 'Value to set' },
        ],
      },

      // Refrigerator
      {
        id: 'fridge-temp-set',
        name: 'Set Fridge Temperature',
        description: 'Set refrigerator temperature setpoint',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x0100',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'temperature', type: 'number', required: true, description: 'Temperature in °F' },
        ],
      },
      {
        id: 'freezer-temp-set',
        name: 'Set Freezer Temperature',
        description: 'Set freezer temperature setpoint',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x0102',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'temperature', type: 'number', required: true, description: 'Temperature in °F' },
        ],
      },
      {
        id: 'turbo-cool',
        name: 'Toggle Turbo Cool',
        description: 'Enable or disable turbo cool mode',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x0108',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'enabled', type: 'boolean', required: true },
        ],
      },
      {
        id: 'turbo-freeze',
        name: 'Toggle Turbo Freeze',
        description: 'Enable or disable turbo freeze mode',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x0107',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'enabled', type: 'boolean', required: true },
        ],
      },

      // Laundry
      {
        id: 'washer-start',
        name: 'Start Washer',
        description: 'Start the washer cycle',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/command/start',
        implemented: false,
        category: 'Laundry',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
        ],
      },
      {
        id: 'washer-pause',
        name: 'Pause Washer',
        description: 'Pause the current washer cycle',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/command/pause',
        implemented: false,
        category: 'Laundry',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
        ],
      },
      {
        id: 'dryer-start',
        name: 'Start Dryer',
        description: 'Start the dryer cycle',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/command/start',
        implemented: false,
        category: 'Laundry',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
        ],
      },

      // Oven
      {
        id: 'oven-preheat',
        name: 'Preheat Oven',
        description: 'Start preheating the oven to target temperature',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x5001',
        implemented: false,
        category: 'Oven',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'temperature', type: 'number', required: true, description: 'Temperature in °F' },
          { name: 'mode', type: 'string', required: false, description: 'Bake, Broil, Convection, etc.' },
        ],
      },
      {
        id: 'oven-off',
        name: 'Turn Off Oven',
        description: 'Turn off the oven',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/command/off',
        implemented: false,
        category: 'Oven',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
        ],
      },
      {
        id: 'oven-timer-set',
        name: 'Set Oven Timer',
        description: 'Set or cancel oven timer',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x5004',
        implemented: false,
        category: 'Oven',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'minutes', type: 'number', required: true, description: 'Timer duration in minutes (0 to cancel)' },
        ],
      },

      // Dishwasher
      {
        id: 'dishwasher-start',
        name: 'Start Dishwasher',
        description: 'Start the dishwasher cycle',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/command/start',
        implemented: false,
        category: 'Dishwasher',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
        ],
      },

      // AC/HVAC
      {
        id: 'ac-power',
        name: 'AC Power On/Off',
        description: 'Turn air conditioner on or off',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x6000',
        implemented: false,
        category: 'HVAC',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'power', type: 'boolean', required: true },
        ],
      },
      {
        id: 'ac-temp-set',
        name: 'Set AC Temperature',
        description: 'Set target temperature for AC',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x6003',
        implemented: false,
        category: 'HVAC',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'temperature', type: 'number', required: true, description: 'Temperature in °F' },
        ],
      },
      {
        id: 'ac-mode-set',
        name: 'Set AC Mode',
        description: 'Set AC operating mode',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x6001',
        implemented: false,
        category: 'HVAC',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'mode', type: 'string', required: true, description: 'cool, heat, fan, auto, eco' },
        ],
      },
      {
        id: 'ac-fan-set',
        name: 'Set Fan Speed',
        description: 'Set AC fan speed',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x6002',
        implemented: false,
        category: 'HVAC',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'speed', type: 'string', required: true, description: 'low, medium, high, auto' },
        ],
      },

      // Opal Ice Maker
      {
        id: 'opal-power',
        name: 'Opal Power On/Off',
        description: 'Turn Opal ice maker on or off',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x7000',
        implemented: false,
        category: 'Opal Ice Maker',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'power', type: 'boolean', required: true },
        ],
      },
      {
        id: 'opal-night-light',
        name: 'Toggle Night Light',
        description: 'Toggle Opal night light',
        method: 'POST',
        endpoint: '/v1/appliance/{applianceId}/erd/0x7004',
        implemented: false,
        category: 'Opal Ice Maker',
        parameters: [
          { name: 'applianceId', type: 'string', required: true },
          { name: 'enabled', type: 'boolean', required: true },
        ],
      },

      // WebSocket
      {
        id: 'websocket-connect',
        name: 'Connect WebSocket',
        description: 'Establish WebSocket connection for real-time updates',
        method: 'GET',
        endpoint: 'wss://api.brillion.geappliances.com/',
        implemented: false,
        category: 'WebSocket',
      },
    ];
  }
}
