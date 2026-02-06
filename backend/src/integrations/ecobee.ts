import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  EcobeeConfig,
  EcobeeThermostat,
  EcobeeRemoteSensor,
  EcobeeWeather,
  EcobeeAlert,
  EcobeeReminder,
} from '../types';
import { logger } from '../services/logger';

const API_BASE_URL = 'https://api.ecobee.com';

export class EcobeeIntegration extends BaseIntegration {
  readonly type = 'ecobee';
  readonly name = 'Ecobee';

  private createClient(config: EcobeeConfig): AxiosInstance {
    // Use the access token directly from config
    const accessToken = config.accessToken;
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    return axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const ecobeeConfig = config as EcobeeConfig;

    if (!ecobeeConfig.accessToken) {
      return { success: false, message: 'Access Token is required. Extract it from your browser.' };
    }

    try {
      const client = this.createClient(ecobeeConfig);

      // Get thermostat summary for quick test
      const selectionJson = JSON.stringify({
        selection: {
          selectionType: 'registered',
          selectionMatch: '',
        }
      });

      const response = await client.get(`/1/thermostatSummary`, {
        params: { json: selectionJson },
      });

      const data = response.data;
      const thermostatCount = data.thermostatCount || 0;

      return {
        success: true,
        message: `Connected to Ecobee - ${thermostatCount} thermostat(s) found`,
        details: {
          thermostatCount,
          revisions: data.revisionList || [],
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ecobee', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Authentication failed: Access token is invalid or expired. Please re-authorize.',
          };
        }
        if (error.response?.status === 500) {
          const errorData = error.response.data;
          if (errorData?.status?.code === 14) {
            return {
              success: false,
              message: 'Authorization token expired. Please re-authorize with Ecobee.',
            };
          }
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          return {
            success: false,
            message: 'Connection failed: Unable to reach Ecobee API.',
          };
        }
      }

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const ecobeeConfig = config as EcobeeConfig;
    const client = this.createClient(ecobeeConfig);

    switch (metric) {
      case 'thermostats':
        return this.getThermostats(client);
      case 'sensors':
        return this.getSensors(client);
      case 'weather':
        return this.getWeather(client);
      case 'alerts':
        return this.getAlerts(client);
      case 'equipment':
        return this.getEquipment(client);
      case 'schedule':
        return this.getSchedule(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getThermostats(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const selectionJson = JSON.stringify({
        selection: {
          selectionType: 'registered',
          selectionMatch: '',
          includeRuntime: true,
          includeSettings: true,
          includeEquipmentStatus: true,
          includeEvents: true,
        }
      });

      const response = await client.get('/1/thermostat', {
        params: { json: selectionJson },
      });

      const thermostats: EcobeeThermostat[] = response.data.thermostatList || [];

      // Transform data for widgets
      const transformedThermostats = thermostats.map(t => ({
        identifier: t.identifier,
        name: t.name,
        brand: t.brand,
        modelNumber: t.modelNumber,
        connected: t.runtime?.connected ?? false,
        // Temperature values are in Fahrenheit * 10
        actualTemperature: t.runtime?.actualTemperature ? t.runtime.actualTemperature / 10 : null,
        desiredHeat: t.runtime?.desiredHeat ? t.runtime.desiredHeat / 10 : null,
        desiredCool: t.runtime?.desiredCool ? t.runtime.desiredCool / 10 : null,
        actualHumidity: t.runtime?.actualHumidity ?? null,
        hvacMode: t.settings?.hvacMode || 'off',
        fanMode: t.runtime?.desiredFanMode || 'auto',
        equipmentStatus: t.equipmentStatus || '',
        useCelsius: t.settings?.useCelsius ?? false,
        // Current event/hold
        activeEvent: t.events?.find(e => e.running) || null,
      }));

      return { thermostats: transformedThermostats };
    } catch (error) {
      logger.error('ecobee', 'Failed to get thermostats', { error });
      throw error;
    }
  }

  private async getSensors(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const selectionJson = JSON.stringify({
        selection: {
          selectionType: 'registered',
          selectionMatch: '',
          includeSensors: true,
          includeSettings: true,
        }
      });

      const response = await client.get('/1/thermostat', {
        params: { json: selectionJson },
      });

      const thermostats: EcobeeThermostat[] = response.data.thermostatList || [];

      // Collect all sensors from all thermostats
      const allSensors: Array<{
        id: string;
        name: string;
        type: string;
        thermostatId: string;
        thermostatName: string;
        inUse: boolean;
        temperature: number | null;
        humidity: number | null;
        occupancy: boolean | null;
        useCelsius: boolean;
      }> = [];

      for (const thermostat of thermostats) {
        const useCelsius = thermostat.settings?.useCelsius ?? false;
        const sensors = thermostat.remoteSensors || [];

        for (const sensor of sensors) {
          let temperature: number | null = null;
          let humidity: number | null = null;
          let occupancy: boolean | null = null;

          for (const cap of sensor.capability || []) {
            if (cap.type === 'temperature' && cap.value !== 'unknown') {
              // Ecobee returns temperature in Fahrenheit * 10
              temperature = parseInt(cap.value, 10) / 10;
            } else if (cap.type === 'humidity' && cap.value !== 'unknown') {
              humidity = parseInt(cap.value, 10);
            } else if (cap.type === 'occupancy') {
              occupancy = cap.value === 'true';
            }
          }

          allSensors.push({
            id: sensor.id,
            name: sensor.name,
            type: sensor.type,
            thermostatId: thermostat.identifier,
            thermostatName: thermostat.name,
            inUse: sensor.inUse,
            temperature,
            humidity,
            occupancy,
            useCelsius,
          });
        }
      }

      return { sensors: allSensors };
    } catch (error) {
      logger.error('ecobee', 'Failed to get sensors', { error });
      throw error;
    }
  }

  private async getWeather(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const selectionJson = JSON.stringify({
        selection: {
          selectionType: 'registered',
          selectionMatch: '',
          includeWeather: true,
          includeSettings: true,
        }
      });

      const response = await client.get('/1/thermostat', {
        params: { json: selectionJson },
      });

      const thermostats: EcobeeThermostat[] = response.data.thermostatList || [];

      // Transform weather data from all thermostats
      const weatherData = thermostats.map(t => {
        const weather = t.weather;
        const useCelsius = t.settings?.useCelsius ?? false;

        if (!weather || !weather.forecasts || weather.forecasts.length === 0) {
          return {
            thermostatId: t.identifier,
            thermostatName: t.name,
            available: false,
            useCelsius,
          };
        }

        const current = weather.forecasts[0];
        const forecasts = weather.forecasts.slice(1, 5).map(f => ({
          dateTime: f.dateTime,
          condition: f.condition,
          // Temperature is in Fahrenheit * 10
          temperature: f.temperature / 10,
          tempHigh: f.tempHigh / 10,
          tempLow: f.tempLow / 10,
          humidity: f.relativeHumidity,
          windSpeed: f.windSpeed,
          windDirection: f.windDirection,
          pop: f.pop, // Probability of precipitation
          weatherSymbol: f.weatherSymbol,
        }));

        return {
          thermostatId: t.identifier,
          thermostatName: t.name,
          available: true,
          useCelsius,
          weatherStation: weather.weatherStation,
          current: {
            dateTime: current.dateTime,
            condition: current.condition,
            temperature: current.temperature / 10,
            tempHigh: current.tempHigh / 10,
            tempLow: current.tempLow / 10,
            humidity: current.relativeHumidity,
            windSpeed: current.windSpeed,
            windDirection: current.windDirection,
            pressure: current.pressure,
            dewpoint: current.dewpoint / 10,
            visibility: current.visibility,
            weatherSymbol: current.weatherSymbol,
          },
          forecasts,
        };
      });

      return { weather: weatherData };
    } catch (error) {
      logger.error('ecobee', 'Failed to get weather', { error });
      throw error;
    }
  }

  private async getAlerts(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const selectionJson = JSON.stringify({
        selection: {
          selectionType: 'registered',
          selectionMatch: '',
          includeAlerts: true,
          includeReminders: true,
        }
      });

      const response = await client.get('/1/thermostat', {
        params: { json: selectionJson },
      });

      const thermostats: EcobeeThermostat[] = response.data.thermostatList || [];

      // Collect all alerts and reminders
      const allAlerts: Array<{
        id: string;
        thermostatId: string;
        thermostatName: string;
        type: 'alert' | 'reminder';
        date: string;
        time?: string;
        severity?: string;
        text: string;
        alertType?: string;
        priority?: string;
      }> = [];

      for (const thermostat of thermostats) {
        // Process alerts
        for (const alert of thermostat.alerts || []) {
          allAlerts.push({
            id: alert.acknowledgeRef,
            thermostatId: thermostat.identifier,
            thermostatName: thermostat.name,
            type: 'alert',
            date: alert.date,
            time: alert.time,
            severity: alert.severity,
            text: alert.text,
            alertType: alert.alertType,
          });
        }

        // Process reminders
        for (const reminder of thermostat.reminders || []) {
          if (reminder.enabled) {
            allAlerts.push({
              id: reminder.reminderRef,
              thermostatId: thermostat.identifier,
              thermostatName: thermostat.name,
              type: 'reminder',
              date: reminder.date,
              text: reminder.message,
              priority: reminder.priority,
            });
          }
        }
      }

      // Sort by date (most recent first)
      allAlerts.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time || '00:00:00'}`);
        const dateB = new Date(`${b.date} ${b.time || '00:00:00'}`);
        return dateB.getTime() - dateA.getTime();
      });

      return { alerts: allAlerts };
    } catch (error) {
      logger.error('ecobee', 'Failed to get alerts', { error });
      throw error;
    }
  }

  private async getEquipment(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const selectionJson = JSON.stringify({
        selection: {
          selectionType: 'registered',
          selectionMatch: '',
          includeEquipmentStatus: true,
          includeSettings: true,
        }
      });

      const response = await client.get('/1/thermostat', {
        params: { json: selectionJson },
      });

      const thermostats: EcobeeThermostat[] = response.data.thermostatList || [];

      // Parse equipment status for each thermostat
      const equipmentData = thermostats.map(t => {
        const status = t.equipmentStatus || '';
        const parts = status.split(',').filter(Boolean);

        const equipment = {
          thermostatId: t.identifier,
          thermostatName: t.name,
          hvacMode: t.settings?.hvacMode || 'off',
          statusString: status,
          // Parse individual equipment states
          heatPump: parts.includes('heatPump'),
          heatPump2: parts.includes('heatPump2'),
          heatPump3: parts.includes('heatPump3'),
          compCool1: parts.includes('compCool1'),
          compCool2: parts.includes('compCool2'),
          auxHeat1: parts.includes('auxHeat1'),
          auxHeat2: parts.includes('auxHeat2'),
          auxHeat3: parts.includes('auxHeat3'),
          fan: parts.includes('fan'),
          humidifier: parts.includes('humidifier'),
          dehumidifier: parts.includes('dehumidifier'),
          ventilator: parts.includes('ventilator'),
          economizer: parts.includes('economizer'),
          compHotWater: parts.includes('compHotWater'),
          auxHotWater: parts.includes('auxHotWater'),
          // Equipment capabilities
          hasHeatPump: t.settings?.hasHeatPump ?? false,
          hasForcedAir: t.settings?.hasForcedAir ?? false,
          hasBoiler: t.settings?.hasBoiler ?? false,
          hasHumidifier: t.settings?.hasHumidifier ?? false,
          hasErv: t.settings?.hasErv ?? false,
          hasHrv: t.settings?.hasHrv ?? false,
          heatStages: t.settings?.heatStages ?? 0,
          coolStages: t.settings?.coolStages ?? 0,
        };

        return equipment;
      });

      return { equipment: equipmentData };
    } catch (error) {
      logger.error('ecobee', 'Failed to get equipment', { error });
      throw error;
    }
  }

  private async getSchedule(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const selectionJson = JSON.stringify({
        selection: {
          selectionType: 'registered',
          selectionMatch: '',
          includeProgram: true,
          includeSettings: true,
          includeEvents: true,
        }
      });

      const response = await client.get('/1/thermostat', {
        params: { json: selectionJson },
      });

      const thermostats: EcobeeThermostat[] = response.data.thermostatList || [];

      const scheduleData = thermostats.map(t => {
        const program = t.program;
        const useCelsius = t.settings?.useCelsius ?? false;

        if (!program) {
          return {
            thermostatId: t.identifier,
            thermostatName: t.name,
            useCelsius,
            available: false,
          };
        }

        // Transform climates with temperature conversion
        const climates = (program.climates || []).map(c => ({
          name: c.name,
          climateRef: c.climateRef,
          type: c.type,
          isOccupied: c.isOccupied,
          // Temperatures are in Fahrenheit * 10
          coolTemp: c.coolTemp / 10,
          heatTemp: c.heatTemp / 10,
          colour: c.colour,
        }));

        // Active event (hold, vacation, etc.)
        const activeEvent = t.events?.find(e => e.running) || null;

        return {
          thermostatId: t.identifier,
          thermostatName: t.name,
          useCelsius,
          available: true,
          currentClimateRef: program.currentClimateRef,
          climates,
          schedule: program.schedule, // Day-indexed array of periods
          activeEvent: activeEvent ? {
            type: activeEvent.type,
            name: activeEvent.name,
            endDate: activeEvent.endDate,
            endTime: activeEvent.endTime,
            holdClimateRef: activeEvent.holdClimateRef,
            heatHoldTemp: activeEvent.heatHoldTemp / 10,
            coolHoldTemp: activeEvent.coolHoldTemp / 10,
          } : null,
        };
      });

      return { schedules: scheduleData };
    } catch (error) {
      logger.error('ecobee', 'Failed to get schedule', { error });
      throw error;
    }
  }

  async performAction(
    config: IntegrationConfig,
    action: string,
    params: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; message?: string }> {
    const ecobeeConfig = config as EcobeeConfig;
    const client = this.createClient(ecobeeConfig);
    const thermostatId = params.thermostatId as string;

    if (!thermostatId) {
      return { success: false, message: 'Thermostat ID is required' };
    }

    try {
      switch (action) {
        case 'setHvacMode': {
          const mode = params.mode as string;
          if (!['auto', 'auxHeatOnly', 'cool', 'heat', 'off'].includes(mode)) {
            return { success: false, message: 'Invalid HVAC mode' };
          }

          await client.post('/1/thermostat', {
            selection: {
              selectionType: 'thermostats',
              selectionMatch: thermostatId,
            },
            thermostat: {
              settings: {
                hvacMode: mode,
              },
            },
          }, {
            params: { format: 'json' },
          });

          return { success: true, message: `HVAC mode set to ${mode}` };
        }

        case 'setTemperature': {
          const heatTemp = params.heatTemp as number;
          const coolTemp = params.coolTemp as number;
          const holdType = (params.holdType as string) || 'nextTransition';

          if (heatTemp === undefined && coolTemp === undefined) {
            return { success: false, message: 'Heat or cool temperature is required' };
          }

          const functionParams: Record<string, unknown> = {
            holdType,
          };

          // Convert temperatures to Fahrenheit * 10
          if (heatTemp !== undefined) {
            functionParams.heatHoldTemp = Math.round(heatTemp * 10);
          }
          if (coolTemp !== undefined) {
            functionParams.coolHoldTemp = Math.round(coolTemp * 10);
          }

          await client.post('/1/thermostat', {
            selection: {
              selectionType: 'thermostats',
              selectionMatch: thermostatId,
            },
            functions: [{
              type: 'setHold',
              params: functionParams,
            }],
          }, {
            params: { format: 'json' },
          });

          return { success: true, message: 'Temperature hold set' };
        }

        case 'resumeProgram': {
          const resumeAll = params.resumeAll === true;

          await client.post('/1/thermostat', {
            selection: {
              selectionType: 'thermostats',
              selectionMatch: thermostatId,
            },
            functions: [{
              type: 'resumeProgram',
              params: {
                resumeAll,
              },
            }],
          }, {
            params: { format: 'json' },
          });

          return { success: true, message: 'Resumed scheduled program' };
        }

        case 'setFanMode': {
          const fanMode = params.fanMode as string;
          if (!['auto', 'on'].includes(fanMode)) {
            return { success: false, message: 'Invalid fan mode (auto or on)' };
          }

          // Fan mode is set through a hold
          await client.post('/1/thermostat', {
            selection: {
              selectionType: 'thermostats',
              selectionMatch: thermostatId,
            },
            functions: [{
              type: 'setHold',
              params: {
                holdType: 'nextTransition',
                fan: fanMode,
              },
            }],
          }, {
            params: { format: 'json' },
          });

          return { success: true, message: `Fan mode set to ${fanMode}` };
        }

        case 'setClimate': {
          const climateRef = params.climateRef as string;
          const holdType = (params.holdType as string) || 'nextTransition';

          if (!climateRef) {
            return { success: false, message: 'Climate reference is required' };
          }

          await client.post('/1/thermostat', {
            selection: {
              selectionType: 'thermostats',
              selectionMatch: thermostatId,
            },
            functions: [{
              type: 'setHold',
              params: {
                holdType,
                holdClimateRef: climateRef,
              },
            }],
          }, {
            params: { format: 'json' },
          });

          return { success: true, message: `Climate set to ${climateRef}` };
        }

        case 'acknowledgeAlert': {
          const alertRef = params.alertRef as string;
          if (!alertRef) {
            return { success: false, message: 'Alert reference is required' };
          }

          await client.post('/1/thermostat', {
            selection: {
              selectionType: 'thermostats',
              selectionMatch: thermostatId,
            },
            functions: [{
              type: 'acknowledge',
              params: {
                thermostatIdentifier: thermostatId,
                ackRef: alertRef,
                ackType: 'accept',
              },
            }],
          }, {
            params: { format: 'json' },
          });

          return { success: true, message: 'Alert acknowledged' };
        }

        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('ecobee', 'Action failed', { action, error: errorMsg });
      return { success: false, message: errorMsg };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'thermostats',
        name: 'Thermostats',
        description: 'Thermostat status, temperature, and controls',
        widgetTypes: ['ecobee-thermostat'],
      },
      {
        id: 'sensors',
        name: 'Sensors',
        description: 'Remote sensor temperature and occupancy',
        widgetTypes: ['ecobee-sensors'],
      },
      {
        id: 'weather',
        name: 'Weather',
        description: 'Weather data from thermostat location',
        widgetTypes: ['ecobee-weather'],
      },
      {
        id: 'alerts',
        name: 'Alerts',
        description: 'Active alerts and maintenance reminders',
        widgetTypes: ['ecobee-alerts'],
      },
      {
        id: 'equipment',
        name: 'Equipment',
        description: 'HVAC equipment running status',
        widgetTypes: ['ecobee-equipment'],
      },
      {
        id: 'schedule',
        name: 'Schedule',
        description: 'Program schedule and current climate',
        widgetTypes: ['ecobee-schedule'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Thermostat Operations - Implemented
      {
        id: 'thermostat-summary',
        name: 'Get Thermostat Summary',
        description: 'Get summary information for all thermostats (used for polling)',
        method: 'GET',
        endpoint: '/1/thermostatSummary',
        implemented: true,
        category: 'Thermostats',
        parameters: [
          { name: 'selection', type: 'object', required: true, description: 'Selection criteria for thermostats' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-thermostat-summary.shtml',
      },
      {
        id: 'thermostat-get',
        name: 'Get Thermostats',
        description: 'Get detailed thermostat data with configurable includes',
        method: 'GET',
        endpoint: '/1/thermostat',
        implemented: true,
        category: 'Thermostats',
        parameters: [
          { name: 'selection', type: 'object', required: true, description: 'Selection criteria and include flags' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-thermostats.shtml',
      },
      {
        id: 'thermostat-update',
        name: 'Update Thermostats',
        description: 'Update thermostat settings or execute functions',
        method: 'POST',
        endpoint: '/1/thermostat',
        implemented: true,
        category: 'Thermostats',
        parameters: [
          { name: 'selection', type: 'object', required: true, description: 'Selection criteria for thermostats' },
          { name: 'thermostat', type: 'object', required: false, description: 'Thermostat settings to update' },
          { name: 'functions', type: 'array', required: false, description: 'Functions to execute' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-update-thermostats.shtml',
      },

      // Thermostat Functions - Implemented
      {
        id: 'function-set-hold',
        name: 'Set Hold',
        description: 'Set thermostat to hold at specified temperatures',
        method: 'POST',
        endpoint: '/1/thermostat (function: setHold)',
        implemented: true,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'coolHoldTemp', type: 'integer', required: false, description: 'Cooling setpoint (F * 10)' },
          { name: 'heatHoldTemp', type: 'integer', required: false, description: 'Heating setpoint (F * 10)' },
          { name: 'holdType', type: 'string', required: false, description: 'Hold type: dateTime, nextTransition, indefinite, holdHours' },
          { name: 'holdHours', type: 'integer', required: false, description: 'Number of hours for holdHours type' },
          { name: 'holdClimateRef', type: 'string', required: false, description: 'Climate reference for hold' },
          { name: 'fan', type: 'string', required: false, description: 'Fan mode: auto, on' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/SetHold.shtml',
      },
      {
        id: 'function-resume-program',
        name: 'Resume Program',
        description: 'Resume the scheduled program from a hold',
        method: 'POST',
        endpoint: '/1/thermostat (function: resumeProgram)',
        implemented: true,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'resumeAll', type: 'boolean', required: false, description: 'Resume all events (true) or just current (false)' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/ResumeProgram.shtml',
      },
      {
        id: 'function-acknowledge',
        name: 'Acknowledge Alert',
        description: 'Acknowledge an alert by its acknowledgement reference',
        method: 'POST',
        endpoint: '/1/thermostat (function: acknowledge)',
        implemented: true,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'thermostatIdentifier', type: 'string', required: true, description: 'Thermostat identifier' },
          { name: 'ackRef', type: 'string', required: true, description: 'Alert acknowledgement reference' },
          { name: 'ackType', type: 'string', required: true, description: 'Acknowledgement type: accept, decline, defer, unacknowledged' },
          { name: 'remindMeLater', type: 'boolean', required: false, description: 'Remind later for defer type' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/Acknowledge.shtml',
      },

      // Thermostat Functions - Not Implemented
      {
        id: 'function-create-vacation',
        name: 'Create Vacation',
        description: 'Create a vacation event on the thermostat',
        method: 'POST',
        endpoint: '/1/thermostat (function: createVacation)',
        implemented: false,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Vacation name' },
          { name: 'coolHoldTemp', type: 'integer', required: true, description: 'Cooling setpoint (F * 10)' },
          { name: 'heatHoldTemp', type: 'integer', required: true, description: 'Heating setpoint (F * 10)' },
          { name: 'startDate', type: 'string', required: true, description: 'Start date (YYYY-MM-DD)' },
          { name: 'startTime', type: 'string', required: true, description: 'Start time (HH:MM:SS)' },
          { name: 'endDate', type: 'string', required: true, description: 'End date (YYYY-MM-DD)' },
          { name: 'endTime', type: 'string', required: true, description: 'End time (HH:MM:SS)' },
          { name: 'fan', type: 'string', required: false, description: 'Fan mode during vacation' },
          { name: 'fanMinOnTime', type: 'integer', required: false, description: 'Minimum fan on time per hour' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/CreateVacation.shtml',
      },
      {
        id: 'function-delete-vacation',
        name: 'Delete Vacation',
        description: 'Delete an existing vacation event',
        method: 'POST',
        endpoint: '/1/thermostat (function: deleteVacation)',
        implemented: false,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Name of vacation to delete' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/DeleteVacation.shtml',
      },
      {
        id: 'function-send-message',
        name: 'Send Message',
        description: 'Send a message to be displayed on the thermostat',
        method: 'POST',
        endpoint: '/1/thermostat (function: sendMessage)',
        implemented: false,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'text', type: 'string', required: true, description: 'Message text (max 500 chars)' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/SendMessage.shtml',
      },
      {
        id: 'function-control-plug',
        name: 'Control Plug',
        description: 'Control a smart plug connected to the thermostat',
        method: 'POST',
        endpoint: '/1/thermostat (function: controlPlug)',
        implemented: false,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'plugName', type: 'string', required: true, description: 'Name of the plug to control' },
          { name: 'plugState', type: 'string', required: true, description: 'State: on, off, resume' },
          { name: 'startDate', type: 'string', required: false, description: 'Start date for scheduled control' },
          { name: 'startTime', type: 'string', required: false, description: 'Start time for scheduled control' },
          { name: 'endDate', type: 'string', required: false, description: 'End date for scheduled control' },
          { name: 'endTime', type: 'string', required: false, description: 'End time for scheduled control' },
          { name: 'holdType', type: 'string', required: false, description: 'Hold type: dateTime, nextTransition, indefinite, holdHours' },
          { name: 'holdHours', type: 'integer', required: false, description: 'Number of hours for holdHours type' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/ControlPlug.shtml',
      },
      {
        id: 'function-set-occupied',
        name: 'Set Occupied',
        description: 'Set the thermostat occupied state (EMS only)',
        method: 'POST',
        endpoint: '/1/thermostat (function: setOccupied)',
        implemented: false,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'occupied', type: 'boolean', required: true, description: 'Occupied state' },
          { name: 'holdType', type: 'string', required: false, description: 'Hold type' },
          { name: 'holdHours', type: 'integer', required: false, description: 'Number of hours' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/SetOccupied.shtml',
      },
      {
        id: 'function-reset-preferences',
        name: 'Reset Preferences',
        description: 'Reset thermostat preferences to factory defaults',
        method: 'POST',
        endpoint: '/1/thermostat (function: resetPreferences)',
        implemented: false,
        category: 'Thermostat Functions',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/ResetPreferences.shtml',
      },
      {
        id: 'function-update-sensor',
        name: 'Update Sensor',
        description: 'Update remote sensor name or participation',
        method: 'POST',
        endpoint: '/1/thermostat (function: updateSensor)',
        implemented: false,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'name', type: 'string', required: false, description: 'New sensor name' },
          { name: 'deviceId', type: 'string', required: true, description: 'Sensor device ID' },
          { name: 'sensorId', type: 'string', required: true, description: 'Sensor ID' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/UpdateSensor.shtml',
      },
      {
        id: 'function-unlink-voice-engine',
        name: 'Unlink Voice Engine',
        description: 'Unlink a voice assistant from the thermostat',
        method: 'POST',
        endpoint: '/1/thermostat (function: unlinkVoiceEngine)',
        implemented: false,
        category: 'Thermostat Functions',
        parameters: [
          { name: 'engineName', type: 'string', required: true, description: 'Voice engine name' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/functions/UnlinkVoiceEngine.shtml',
      },

      // Reports
      {
        id: 'runtime-report',
        name: 'Get Runtime Report',
        description: 'Get historical runtime data for thermostats',
        method: 'GET',
        endpoint: '/1/runtimeReport',
        implemented: false,
        category: 'Reports',
        parameters: [
          { name: 'selection', type: 'object', required: true, description: 'Selection criteria' },
          { name: 'startDate', type: 'string', required: true, description: 'Start date (YYYY-MM-DD)' },
          { name: 'endDate', type: 'string', required: true, description: 'End date (YYYY-MM-DD)' },
          { name: 'startInterval', type: 'integer', required: false, description: 'Start 5-minute interval (0-287)' },
          { name: 'endInterval', type: 'integer', required: false, description: 'End 5-minute interval (0-287)' },
          { name: 'columns', type: 'string', required: false, description: 'Comma-separated column names' },
          { name: 'includeSensors', type: 'boolean', required: false, description: 'Include sensor data' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-runtime-report.shtml',
      },
      {
        id: 'meter-report',
        name: 'Get Meter Report',
        description: 'Get historical meter data for thermostats',
        method: 'GET',
        endpoint: '/1/meterReport',
        implemented: false,
        category: 'Reports',
        parameters: [
          { name: 'selection', type: 'object', required: true, description: 'Selection criteria' },
          { name: 'startDate', type: 'string', required: true, description: 'Start date (YYYY-MM-DD)' },
          { name: 'endDate', type: 'string', required: true, description: 'End date (YYYY-MM-DD)' },
          { name: 'columns', type: 'string', required: false, description: 'Comma-separated column names' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-meter-report.shtml',
      },
      {
        id: 'runtime-report-job-create',
        name: 'Create Runtime Report Job',
        description: 'Create a batch runtime report job for async processing',
        method: 'POST',
        endpoint: '/1/runtimeReportJob/create',
        implemented: false,
        category: 'Reports',
        parameters: [
          { name: 'selection', type: 'object', required: true, description: 'Selection criteria' },
          { name: 'startDate', type: 'string', required: true, description: 'Start date' },
          { name: 'endDate', type: 'string', required: true, description: 'End date' },
          { name: 'columns', type: 'string', required: false, description: 'Report columns' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-create-runtime-report-job.shtml',
      },
      {
        id: 'runtime-report-job-status',
        name: 'Get Runtime Report Job Status',
        description: 'Get status of a batch runtime report job',
        method: 'GET',
        endpoint: '/1/runtimeReportJob/status',
        implemented: false,
        category: 'Reports',
        parameters: [
          { name: 'jobId', type: 'string', required: true, description: 'Job ID from create request' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-list-runtime-report-job-status.shtml',
      },
      {
        id: 'runtime-report-job-cancel',
        name: 'Cancel Runtime Report Job',
        description: 'Cancel a pending batch runtime report job',
        method: 'POST',
        endpoint: '/1/runtimeReportJob/cancel',
        implemented: false,
        category: 'Reports',
        parameters: [
          { name: 'jobId', type: 'string', required: true, description: 'Job ID to cancel' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-cancel-runtime-report-job.shtml',
      },

      // Groups
      {
        id: 'group-get',
        name: 'Get Groups',
        description: 'Get thermostat groups for the account',
        method: 'GET',
        endpoint: '/1/group',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'selection', type: 'object', required: true, description: 'Selection criteria' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-group.shtml',
      },
      {
        id: 'group-update',
        name: 'Update Groups',
        description: 'Create, update, or delete thermostat groups',
        method: 'POST',
        endpoint: '/1/group',
        implemented: false,
        category: 'Groups',
        parameters: [
          { name: 'selection', type: 'object', required: true, description: 'Selection criteria' },
          { name: 'groups', type: 'array', required: true, description: 'Array of group objects' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-group-update.shtml',
      },

      // Hierarchy (EMS/Utility)
      {
        id: 'hierarchy-list-sets',
        name: 'List Hierarchy Sets',
        description: 'List sets in the management hierarchy (EMS/Utility only)',
        method: 'GET',
        endpoint: '/1/hierarchy/set',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-list-sets.shtml',
      },
      {
        id: 'hierarchy-list-users',
        name: 'List Hierarchy Users',
        description: 'List users in the management hierarchy (EMS/Utility only)',
        method: 'GET',
        endpoint: '/1/hierarchy/user',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-list-users.shtml',
      },
      {
        id: 'hierarchy-add-set',
        name: 'Add Hierarchy Set',
        description: 'Add a new set to the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/set',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-add-set.shtml',
      },
      {
        id: 'hierarchy-remove-set',
        name: 'Remove Hierarchy Set',
        description: 'Remove a set from the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/set',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-remove-set.shtml',
      },
      {
        id: 'hierarchy-rename-set',
        name: 'Rename Hierarchy Set',
        description: 'Rename a set in the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/set',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-rename-set.shtml',
      },
      {
        id: 'hierarchy-move-set',
        name: 'Move Hierarchy Set',
        description: 'Move a set within the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/set',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-move-set.shtml',
      },
      {
        id: 'hierarchy-add-user',
        name: 'Add Hierarchy User',
        description: 'Add a user to the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/user',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-add-user.shtml',
      },
      {
        id: 'hierarchy-remove-user',
        name: 'Remove Hierarchy User',
        description: 'Remove a user from the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/user',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-remove-user.shtml',
      },
      {
        id: 'hierarchy-update-user',
        name: 'Update Hierarchy User',
        description: 'Update a user in the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/user',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-update-user.shtml',
      },
      {
        id: 'hierarchy-unregister-user',
        name: 'Unregister Hierarchy User',
        description: 'Unregister a user from the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/user',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-unregister-user.shtml',
      },
      {
        id: 'hierarchy-register-thermostat',
        name: 'Register Thermostat',
        description: 'Register a thermostat to the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/thermostat',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-register-thermostat.shtml',
      },
      {
        id: 'hierarchy-unregister-thermostat',
        name: 'Unregister Thermostat',
        description: 'Unregister a thermostat from the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/thermostat',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-unregister-thermostat.shtml',
      },
      {
        id: 'hierarchy-move-thermostat',
        name: 'Move Thermostat',
        description: 'Move a thermostat within the hierarchy (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/thermostat',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-move-thermostat.shtml',
      },
      {
        id: 'hierarchy-assign-thermostat',
        name: 'Assign Thermostat',
        description: 'Assign a thermostat to a set (EMS/Utility only)',
        method: 'POST',
        endpoint: '/1/hierarchy/thermostat',
        implemented: false,
        category: 'Hierarchy',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-assign-thermostat.shtml',
      },

      // Demand Response (Utility)
      {
        id: 'demand-response-list',
        name: 'List Demand Response',
        description: 'List demand response events (Utility only)',
        method: 'GET',
        endpoint: '/1/demandResponse',
        implemented: false,
        category: 'Demand Response',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-list-demand-response.shtml',
      },
      {
        id: 'demand-response-issue',
        name: 'Issue Demand Response',
        description: 'Issue a demand response event (Utility only)',
        method: 'POST',
        endpoint: '/1/demandResponse',
        implemented: false,
        category: 'Demand Response',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-issue-demand-response.shtml',
      },
      {
        id: 'demand-response-cancel',
        name: 'Cancel Demand Response',
        description: 'Cancel a demand response event (Utility only)',
        method: 'POST',
        endpoint: '/1/demandResponse',
        implemented: false,
        category: 'Demand Response',
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/operations/post-cancel-demand-response.shtml',
      },

      // Authentication
      {
        id: 'auth-authorize',
        name: 'Get Authorization Code',
        description: 'Get PIN/authorization code for user authorization',
        method: 'GET',
        endpoint: '/authorize',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'response_type', type: 'string', required: true, description: 'Must be "ecobeePin"' },
          { name: 'client_id', type: 'string', required: true, description: 'API key' },
          { name: 'scope', type: 'string', required: true, description: 'Permission scope' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/auth/pin-api-authorization.shtml',
      },
      {
        id: 'auth-token',
        name: 'Get Access Token',
        description: 'Exchange authorization code for access/refresh tokens',
        method: 'POST',
        endpoint: '/token',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'grant_type', type: 'string', required: true, description: 'Grant type (ecobeePin or refresh_token)' },
          { name: 'code', type: 'string', required: false, description: 'Authorization code (for ecobeePin)' },
          { name: 'refresh_token', type: 'string', required: false, description: 'Refresh token (for refresh_token)' },
          { name: 'client_id', type: 'string', required: true, description: 'API key' },
        ],
        documentationUrl: 'https://www.ecobee.com/home/developer/api/documentation/v1/auth/token-refresh.shtml',
      },
    ];
  }
}
