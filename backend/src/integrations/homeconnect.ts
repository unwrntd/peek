import axios, { AxiosInstance } from 'axios';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  HomeConnectConfig,
  HomeConnectAppliance,
  HomeConnectApplianceType,
  HomeConnectStatus,
  HomeConnectProgram,
  HomeConnectProgramOption,
  HomeConnectImage,
  HomeConnectFridgeCamera,
} from '../types';
import { logger } from '../services/logger';

const BASE_URL = 'https://api.home-connect.com/api';
const AUTH_URL = 'https://api.home-connect.com/security/oauth/token';

// Token cache to store access tokens
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}
const tokenCache = new Map<string, TokenCache>();

// Map API type strings to our ApplianceType
function mapApplianceType(apiType: string): HomeConnectApplianceType {
  const typeMap: Record<string, HomeConnectApplianceType> = {
    'Oven': 'Oven',
    'Dishwasher': 'Dishwasher',
    'Washer': 'Washer',
    'Dryer': 'Dryer',
    'WasherDryer': 'WasherDryer',
    'CoffeeMaker': 'CoffeeMaker',
    'Refrigerator': 'Refrigerator',
    'Freezer': 'Freezer',
    'FridgeFreezer': 'FridgeFreezer',
    'Cooktop': 'Cooktop',
    'Hood': 'Hood',
    'CleaningRobot': 'CleaningRobot',
  };
  return typeMap[apiType] || 'Oven';
}

// Map operation state key to friendly name
function mapOperationState(stateKey: string): string {
  const stateMap: Record<string, string> = {
    'BSH.Common.EnumType.OperationState.Inactive': 'Idle',
    'BSH.Common.EnumType.OperationState.Ready': 'Ready',
    'BSH.Common.EnumType.OperationState.DelayedStart': 'Delayed Start',
    'BSH.Common.EnumType.OperationState.Run': 'Running',
    'BSH.Common.EnumType.OperationState.Pause': 'Paused',
    'BSH.Common.EnumType.OperationState.ActionRequired': 'Action Required',
    'BSH.Common.EnumType.OperationState.Finished': 'Finished',
    'BSH.Common.EnumType.OperationState.Error': 'Error',
    'BSH.Common.EnumType.OperationState.Aborting': 'Aborting',
  };
  return stateMap[stateKey] || stateKey.split('.').pop() || 'Unknown';
}

// Map door state key to friendly name
function mapDoorState(stateKey: string): 'Open' | 'Closed' | 'Locked' {
  if (stateKey.includes('Open')) return 'Open';
  if (stateKey.includes('Locked')) return 'Locked';
  return 'Closed';
}

// Extract program name from key
function extractProgramName(programKey: string): string {
  // Format: BSH.Common.Program.Favorite.001 or LaundryCare.Washer.Program.Cotton
  const parts = programKey.split('.');
  return parts[parts.length - 1] || programKey;
}

export class HomeConnectIntegration extends BaseIntegration {
  readonly type = 'homeconnect';
  readonly name = 'Home Connect';

  private getCacheKey(config: HomeConnectConfig): string {
    return `hc_${config.clientId}_${config.refreshToken.substring(0, 20)}`;
  }

  private async getAccessToken(config: HomeConnectConfig): Promise<string> {
    const cacheKey = this.getCacheKey(config);
    const cached = tokenCache.get(cacheKey);

    // Return cached token if still valid (with 5 minute buffer)
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.accessToken;
    }

    // Refresh the token
    try {
      const response = await axios.post(
        AUTH_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: config.refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;
      const accessToken = data.access_token;
      const expiresIn = data.expires_in || 86400; // Default 24 hours

      // Cache the new token
      tokenCache.set(cacheKey, {
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      logger.debug('homeconnect', 'Refreshed access token');
      return accessToken;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('homeconnect', 'Failed to refresh access token', { error: errorMsg });
      throw new Error(`Failed to refresh access token: ${errorMsg}`);
    }
  }

  private async createClient(config: HomeConnectConfig): Promise<AxiosInstance> {
    const accessToken = await this.getAccessToken(config);
    return axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.bsh.sdk.v1+json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const hcConfig = config as HomeConnectConfig;

    if (!hcConfig.clientId) {
      return { success: false, message: 'Client ID is required' };
    }
    if (!hcConfig.clientSecret) {
      return { success: false, message: 'Client Secret is required' };
    }
    if (!hcConfig.refreshToken) {
      return { success: false, message: 'Refresh Token is required' };
    }

    try {
      const client = await this.createClient(hcConfig);
      const response = await client.get('/homeappliances');

      const data = response.data;
      const appliances = data.data?.homeappliances || [];

      return {
        success: true,
        message: `Connected to Home Connect - ${appliances.length} appliance(s) found`,
        details: {
          applianceCount: appliances.length,
          appliances: appliances.map((a: Record<string, unknown>) => ({
            name: a.name,
            type: a.type,
            brand: a.brand,
            connected: a.connected,
          })),
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('homeconnect', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Authentication failed: Access token is invalid or expired. Please re-authenticate.',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Access forbidden: Check your API permissions and scopes.',
          };
        }
        if (error.response?.status === 429) {
          return {
            success: false,
            message: 'Rate limit exceeded: Home Connect allows 1000 requests per day.',
          };
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          return {
            success: false,
            message: 'Connection failed: Unable to reach Home Connect API.',
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
    const hcConfig = config as HomeConnectConfig;
    const client = await this.createClient(hcConfig);

    switch (metric) {
      case 'appliances':
        return this.getAppliances(client);
      case 'appliance-status':
        return this.getAllApplianceStatuses(client);
      case 'active-programs':
        return this.getActivePrograms(client);
      case 'fridge-images':
        return this.getFridgeImages(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getAppliances(client: AxiosInstance): Promise<{ appliances: HomeConnectAppliance[] }> {
    try {
      const response = await client.get('/homeappliances');
      const data = response.data;
      const rawAppliances = data.data?.homeappliances || [];

      const appliances: HomeConnectAppliance[] = rawAppliances.map((a: Record<string, unknown>) => ({
        haId: String(a.haId || ''),
        name: String(a.name || ''),
        brand: String(a.brand || ''),
        type: mapApplianceType(String(a.type || '')),
        vib: String(a.vib || ''),
        enumber: String(a.enumber || ''),
        connected: Boolean(a.connected),
      }));

      return { appliances };
    } catch (error) {
      logger.error('homeconnect', 'Failed to get appliances', { error });
      throw error;
    }
  }

  private async getAllApplianceStatuses(client: AxiosInstance): Promise<{ statuses: HomeConnectStatus[] }> {
    try {
      // First get all appliances
      const appliancesResponse = await client.get('/homeappliances');
      const rawAppliances = appliancesResponse.data.data?.homeappliances || [];

      // Fetch status for each connected appliance
      const statuses: HomeConnectStatus[] = await Promise.all(
        rawAppliances.map(async (appliance: Record<string, unknown>) => {
          const haId = String(appliance.haId || '');
          const connected = Boolean(appliance.connected);

          const baseStatus: HomeConnectStatus = {
            haId,
            name: String(appliance.name || ''),
            type: mapApplianceType(String(appliance.type || '')),
            connected,
          };

          if (!connected) {
            return baseStatus;
          }

          try {
            const statusResponse = await client.get(`/homeappliances/${haId}/status`);
            const statusItems = statusResponse.data.data?.status || [];

            for (const item of statusItems) {
              const key = String(item.key || '');
              const value = item.value;

              if (key.includes('OperationState')) {
                baseStatus.operationState = mapOperationState(String(value));
              } else if (key.includes('DoorState')) {
                baseStatus.doorState = mapDoorState(String(value));
              } else if (key.includes('RemoteControlActive')) {
                baseStatus.remoteControlActive = Boolean(value);
              } else if (key.includes('RemoteControlStartAllowed') || key.includes('RemoteStartAllowed')) {
                baseStatus.remoteStartAllowed = Boolean(value);
              } else if (key.includes('LocalControlActive')) {
                baseStatus.localControlActive = Boolean(value);
              } else if (key.includes('PowerState')) {
                const powerVal = String(value);
                if (powerVal.includes('On')) baseStatus.powerState = 'On';
                else if (powerVal.includes('Standby')) baseStatus.powerState = 'Standby';
                else baseStatus.powerState = 'Off';
              }
            }
          } catch (statusError) {
            // If we can't get status, just return basic info
            logger.debug('homeconnect', `Failed to get status for ${haId}`, { error: statusError });
          }

          return baseStatus;
        })
      );

      return { statuses };
    } catch (error) {
      logger.error('homeconnect', 'Failed to get appliance statuses', { error });
      throw error;
    }
  }

  private async getActivePrograms(client: AxiosInstance): Promise<{ programs: HomeConnectProgram[] }> {
    try {
      // First get all appliances
      const appliancesResponse = await client.get('/homeappliances');
      const rawAppliances = appliancesResponse.data.data?.homeappliances || [];

      const programs: HomeConnectProgram[] = [];

      // Fetch active program for each connected appliance
      for (const appliance of rawAppliances) {
        const haId = String(appliance.haId || '');
        const connected = Boolean(appliance.connected);

        if (!connected) continue;

        try {
          const programResponse = await client.get(`/homeappliances/${haId}/programs/active`);
          const programData = programResponse.data.data;

          if (programData && programData.key) {
            const options: HomeConnectProgramOption[] = (programData.options || []).map((opt: Record<string, unknown>) => ({
              key: String(opt.key || ''),
              name: String(opt.key || '').split('.').pop() || '',
              value: opt.value ?? '',
              unit: opt.unit ? String(opt.unit) : undefined,
            }));

            // Extract progress and time info from options
            let progress: number | undefined;
            let remainingTime: number | undefined;
            let elapsedTime: number | undefined;

            for (const opt of options) {
              if (opt.key.includes('Progress')) {
                progress = typeof opt.value === 'number' ? opt.value : undefined;
              } else if (opt.key.includes('RemainingProgramTime')) {
                remainingTime = typeof opt.value === 'number' ? opt.value : undefined;
              } else if (opt.key.includes('ElapsedProgramTime')) {
                elapsedTime = typeof opt.value === 'number' ? opt.value : undefined;
              }
            }

            programs.push({
              haId,
              applianceName: String(appliance.name || ''),
              applianceType: mapApplianceType(String(appliance.type || '')),
              programKey: String(programData.key),
              programName: extractProgramName(String(programData.key)),
              options,
              progress,
              remainingTime,
              elapsedTime,
            });
          }
        } catch (programError) {
          // No active program or can't access - that's fine
          if (axios.isAxiosError(programError) && programError.response?.status !== 404) {
            logger.debug('homeconnect', `Failed to get active program for ${haId}`, { error: programError });
          }
        }
      }

      return { programs };
    } catch (error) {
      logger.error('homeconnect', 'Failed to get active programs', { error });
      throw error;
    }
  }

  private async getFridgeImages(client: AxiosInstance): Promise<{ fridges: HomeConnectFridgeCamera[] }> {
    try {
      // First get all appliances
      const appliancesResponse = await client.get('/homeappliances');
      const rawAppliances = appliancesResponse.data.data?.homeappliances || [];

      logger.debug('homeconnect', 'All appliances for fridge images', {
        count: rawAppliances.length,
        types: rawAppliances.map((a: Record<string, unknown>) => ({ name: a.name, type: a.type, connected: a.connected })),
      });

      // Filter to only refrigerator types
      const fridgeTypes = ['Refrigerator', 'Freezer', 'FridgeFreezer'];
      const fridgeAppliances = rawAppliances.filter(
        (a: Record<string, unknown>) => fridgeTypes.includes(String(a.type || ''))
      );

      logger.debug('homeconnect', 'Filtered fridge appliances', { count: fridgeAppliances.length });

      const fridges: HomeConnectFridgeCamera[] = [];

      // Fetch images for each fridge (connected or not, so we can show them in dropdown)
      for (const appliance of fridgeAppliances) {
        const haId = String(appliance.haId || '');
        const connected = Boolean(appliance.connected);

        const fridgeCamera: HomeConnectFridgeCamera = {
          haId,
          applianceName: String(appliance.name || ''),
          applianceType: mapApplianceType(String(appliance.type || '')),
          images: [],
          available: false,
        };

        if (!connected) {
          logger.debug('homeconnect', `Fridge ${haId} not connected, skipping image fetch`);
          fridges.push(fridgeCamera);
          continue;
        }

        try {
          // Get list of available images
          logger.debug('homeconnect', `Fetching images for fridge ${haId}`);
          const imagesResponse = await client.get(`/homeappliances/${haId}/images`);
          logger.debug('homeconnect', `Images response for ${haId}`, {
            status: imagesResponse.status,
            data: imagesResponse.data
          });

          // Handle different response structures
          const imageData = imagesResponse.data.data?.images || imagesResponse.data.images || [];

          fridgeCamera.images = imageData.map((img: Record<string, unknown>) => ({
            imageKey: String(img.imagekey || img.imageKey || img.key || ''),
            timestamp: img.timestamp ? String(img.timestamp) : undefined,
          }));
          fridgeCamera.available = fridgeCamera.images.length > 0;

          logger.debug('homeconnect', `Found ${fridgeCamera.images.length} images for ${haId}`);
        } catch (imgError) {
          // Log all errors for debugging
          if (axios.isAxiosError(imgError)) {
            logger.debug('homeconnect', `Failed to get images for ${haId}`, {
              status: imgError.response?.status,
              statusText: imgError.response?.statusText,
              data: imgError.response?.data,
            });
          } else {
            logger.debug('homeconnect', `Failed to get images for ${haId}`, { error: imgError });
          }
        }

        fridges.push(fridgeCamera);
      }

      logger.debug('homeconnect', `Returning ${fridges.length} fridges`);
      return { fridges };
    } catch (error) {
      logger.error('homeconnect', 'Failed to get fridge images', { error });
      throw error;
    }
  }

  // Get a specific image by key (returns base64 encoded image)
  async getImage(config: IntegrationConfig, haId: string, imageKey: string): Promise<{ imageBase64: string; contentType: string }> {
    const hcConfig = config as HomeConnectConfig;
    const client = await this.createClient(hcConfig);

    try {
      const response = await client.get(`/homeappliances/${haId}/images/${imageKey}`, {
        responseType: 'arraybuffer',
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      const imageBase64 = Buffer.from(response.data).toString('base64');

      return { imageBase64, contentType };
    } catch (error) {
      logger.error('homeconnect', `Failed to get image ${imageKey} for ${haId}`, { error });
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'appliances',
        name: 'Appliance List',
        description: 'List of all connected Home Connect appliances',
        widgetTypes: ['homeconnect-appliances'],
      },
      {
        id: 'appliance-status',
        name: 'Appliance Status',
        description: 'Detailed status for all appliances',
        widgetTypes: ['homeconnect-status'],
      },
      {
        id: 'active-programs',
        name: 'Active Programs',
        description: 'Currently running programs with progress',
        widgetTypes: ['homeconnect-programs', 'homeconnect-timer'],
      },
      {
        id: 'fridge-images',
        name: 'Fridge Camera',
        description: 'Interior camera images from refrigerators',
        widgetTypes: ['homeconnect-fridge-camera'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Home Appliances - Implemented
      {
        id: 'appliances-list',
        name: 'List Home Appliances',
        description: 'Get all paired home appliances and their connection status',
        method: 'GET',
        endpoint: '/homeappliances',
        implemented: true,
        category: 'Appliances',
        documentationUrl: 'https://api-docs.home-connect.com/',
      },
      {
        id: 'appliance-get',
        name: 'Get Home Appliance',
        description: 'Get details for a specific home appliance',
        method: 'GET',
        endpoint: '/homeappliances/{haId}',
        implemented: false,
        category: 'Appliances',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },

      // Status - Implemented
      {
        id: 'status-get',
        name: 'Get Appliance Status',
        description: 'Get current status of a home appliance',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/status',
        implemented: true,
        category: 'Status',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
        documentationUrl: 'https://api-docs.home-connect.com/states',
      },
      {
        id: 'status-value-get',
        name: 'Get Status Value',
        description: 'Get a specific status value for an appliance',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/status/{statusKey}',
        implemented: false,
        category: 'Status',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'statusKey', type: 'string', required: true, description: 'Status key (e.g., BSH.Common.Status.OperationState)' },
        ],
      },

      // Programs - Implemented (partially)
      {
        id: 'programs-list',
        name: 'List All Programs',
        description: 'Get all programs of a home appliance',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
        documentationUrl: 'https://api-docs.home-connect.com/programs',
      },
      {
        id: 'programs-available-list',
        name: 'List Available Programs',
        description: 'Get all programs currently available for execution',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs/available',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'programs-available-get',
        name: 'Get Available Program',
        description: 'Get details for a specific available program',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs/available/{programKey}',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'programKey', type: 'string', required: true, description: 'Program key' },
        ],
      },
      {
        id: 'programs-active-get',
        name: 'Get Active Program',
        description: 'Get the currently executing program',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs/active',
        implemented: true,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'programs-active-start',
        name: 'Start Program',
        description: 'Start a program on the appliance',
        method: 'PUT',
        endpoint: '/homeappliances/{haId}/programs/active',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'key', type: 'string', required: true, description: 'Program key to start' },
          { name: 'options', type: 'array', required: false, description: 'Program options' },
        ],
      },
      {
        id: 'programs-active-stop',
        name: 'Stop Program',
        description: 'Stop the currently executing program',
        method: 'DELETE',
        endpoint: '/homeappliances/{haId}/programs/active',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'programs-active-options-get',
        name: 'Get Active Program Options',
        description: 'Get all options for the active program',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs/active/options',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'programs-active-options-set',
        name: 'Set Active Program Options',
        description: 'Update options for the active program',
        method: 'PUT',
        endpoint: '/homeappliances/{haId}/programs/active/options',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'options', type: 'array', required: true, description: 'Options to update' },
        ],
      },
      {
        id: 'programs-active-option-get',
        name: 'Get Active Program Option',
        description: 'Get a specific option for the active program',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs/active/options/{optionKey}',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'optionKey', type: 'string', required: true, description: 'Option key' },
        ],
      },
      {
        id: 'programs-active-option-set',
        name: 'Set Active Program Option',
        description: 'Set a specific option for the active program',
        method: 'PUT',
        endpoint: '/homeappliances/{haId}/programs/active/options/{optionKey}',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'optionKey', type: 'string', required: true, description: 'Option key' },
          { name: 'value', type: 'string|number|boolean', required: true, description: 'Option value' },
        ],
      },
      {
        id: 'programs-selected-get',
        name: 'Get Selected Program',
        description: 'Get the currently selected program',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs/selected',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'programs-selected-set',
        name: 'Select Program',
        description: 'Select a program on the appliance',
        method: 'PUT',
        endpoint: '/homeappliances/{haId}/programs/selected',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'key', type: 'string', required: true, description: 'Program key to select' },
        ],
      },
      {
        id: 'programs-selected-options-get',
        name: 'Get Selected Program Options',
        description: 'Get options for the selected program',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs/selected/options',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'programs-selected-options-set',
        name: 'Set Selected Program Options',
        description: 'Update options for the selected program',
        method: 'PUT',
        endpoint: '/homeappliances/{haId}/programs/selected/options',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'options', type: 'array', required: true, description: 'Options to update' },
        ],
      },
      {
        id: 'programs-selected-option-get',
        name: 'Get Selected Program Option',
        description: 'Get a specific option for the selected program',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/programs/selected/options/{optionKey}',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'optionKey', type: 'string', required: true, description: 'Option key' },
        ],
      },
      {
        id: 'programs-selected-option-set',
        name: 'Set Selected Program Option',
        description: 'Set a specific option for the selected program',
        method: 'PUT',
        endpoint: '/homeappliances/{haId}/programs/selected/options/{optionKey}',
        implemented: false,
        category: 'Programs',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'optionKey', type: 'string', required: true, description: 'Option key' },
          { name: 'value', type: 'string|number|boolean', required: true, description: 'Option value' },
        ],
      },

      // Settings
      {
        id: 'settings-list',
        name: 'List Settings',
        description: 'Get all available settings for an appliance',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/settings',
        implemented: false,
        category: 'Settings',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
        documentationUrl: 'https://api-docs.home-connect.com/settings',
      },
      {
        id: 'settings-get',
        name: 'Get Setting',
        description: 'Get a specific setting value',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/settings/{settingKey}',
        implemented: false,
        category: 'Settings',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'settingKey', type: 'string', required: true, description: 'Setting key' },
        ],
      },
      {
        id: 'settings-set',
        name: 'Set Setting',
        description: 'Update a specific setting value',
        method: 'PUT',
        endpoint: '/homeappliances/{haId}/settings/{settingKey}',
        implemented: false,
        category: 'Settings',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'settingKey', type: 'string', required: true, description: 'Setting key' },
          { name: 'value', type: 'string|number|boolean', required: true, description: 'Setting value' },
        ],
      },

      // Commands
      {
        id: 'commands-list',
        name: 'List Commands',
        description: 'Get all supported commands for an appliance',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/commands',
        implemented: false,
        category: 'Commands',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
        documentationUrl: 'https://api-docs.home-connect.com/commands',
      },
      {
        id: 'commands-execute',
        name: 'Execute Command',
        description: 'Execute a command on the appliance (pause, resume, open door, etc.)',
        method: 'PUT',
        endpoint: '/homeappliances/{haId}/commands/{commandKey}',
        implemented: false,
        category: 'Commands',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'commandKey', type: 'string', required: true, description: 'Command key (e.g., BSH.Common.Command.PauseProgram)' },
          { name: 'value', type: 'boolean', required: true, description: 'Command value (typically true)' },
        ],
      },

      // Events
      {
        id: 'events-all',
        name: 'Stream All Events',
        description: 'Open event monitoring channel for all appliances',
        method: 'GET',
        endpoint: '/homeappliances/events',
        implemented: false,
        category: 'Events',
        documentationUrl: 'https://api-docs.home-connect.com/events',
      },
      {
        id: 'events-appliance',
        name: 'Stream Appliance Events',
        description: 'Open event monitoring channel for a specific appliance',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/events',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },

      // Images - Implemented
      {
        id: 'images-list',
        name: 'List Images',
        description: 'Get available camera images for an appliance (refrigerators)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/images',
        implemented: true,
        category: 'Images',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
        documentationUrl: 'https://api-docs.home-connect.com/images',
      },
      {
        id: 'images-get',
        name: 'Get Image',
        description: 'Get a specific camera image by key',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/images/{imageKey}',
        implemented: true,
        category: 'Images',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
          { name: 'imageKey', type: 'string', required: true, description: 'Image key' },
        ],
      },

      // Authentication
      {
        id: 'auth-authorize',
        name: 'Authorize',
        description: 'Start OAuth2 authorization flow',
        method: 'GET',
        endpoint: 'https://api.home-connect.com/security/oauth/authorize',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'client_id', type: 'string', required: true, description: 'OAuth client ID' },
          { name: 'redirect_uri', type: 'string', required: true, description: 'Callback URL' },
          { name: 'response_type', type: 'string', required: true, description: 'Must be "code"' },
          { name: 'scope', type: 'string', required: true, description: 'API scopes (e.g., IdentifyAppliance)' },
          { name: 'state', type: 'string', required: false, description: 'State parameter for CSRF protection' },
        ],
        documentationUrl: 'https://api-docs.home-connect.com/authorization',
      },
      {
        id: 'auth-token',
        name: 'Get Token',
        description: 'Exchange authorization code for tokens or refresh tokens',
        method: 'POST',
        endpoint: 'https://api.home-connect.com/security/oauth/token',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'grant_type', type: 'string', required: true, description: 'Grant type (authorization_code or refresh_token)' },
          { name: 'client_id', type: 'string', required: true, description: 'OAuth client ID' },
          { name: 'client_secret', type: 'string', required: true, description: 'OAuth client secret' },
          { name: 'code', type: 'string', required: false, description: 'Authorization code (for authorization_code grant)' },
          { name: 'redirect_uri', type: 'string', required: false, description: 'Callback URL (for authorization_code grant)' },
          { name: 'refresh_token', type: 'string', required: false, description: 'Refresh token (for refresh_token grant)' },
        ],
      },

      // Appliance-Specific Features
      {
        id: 'oven-cavity-temperature',
        name: 'Get Oven Cavity Temperature',
        description: 'Get the current oven cavity temperature (Oven only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/status/Cooking.Oven.Status.CurrentCavityTemperature',
        implemented: false,
        category: 'Oven',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'oven-preheat-finished',
        name: 'Get Oven Preheat Status',
        description: 'Check if oven preheat is complete (Oven only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/status/Cooking.Oven.Status.PreheatFinished',
        implemented: false,
        category: 'Oven',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'washer-idos-dosage',
        name: 'Get i-DOS Dosage Level',
        description: 'Get automatic detergent dosage level (Washer only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/settings/LaundryCare.Washer.Setting.IDos1DosingLevel',
        implemented: false,
        category: 'Washer',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'dishwasher-brilliance-dry',
        name: 'Get Brilliance Dry Setting',
        description: 'Get brilliant drying setting (Dishwasher only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/settings/Dishcare.Dishwasher.Setting.BrillianceDry',
        implemented: false,
        category: 'Dishwasher',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'coffee-beverage-counter',
        name: 'Get Beverage Counter',
        description: 'Get total beverages prepared counter (CoffeeMaker only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/status/ConsumerProducts.CoffeeMaker.Status.BeverageCounterCoffee',
        implemented: false,
        category: 'CoffeeMaker',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'fridge-freezer-temperature',
        name: 'Get Freezer Temperature',
        description: 'Get target freezer temperature (Refrigerator only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/settings/Refrigeration.FridgeFreezer.Setting.SetpointTemperatureFreezer',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'fridge-super-mode',
        name: 'Get Super Mode Status',
        description: 'Get super cooling/freezing mode status (Refrigerator only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/settings/Refrigeration.FridgeFreezer.Setting.SuperModeFreezer',
        implemented: false,
        category: 'Refrigerator',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'hood-venting-level',
        name: 'Get Venting Level',
        description: 'Get current venting/fan level (Hood only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/settings/Cooking.Common.Setting.Lighting',
        implemented: false,
        category: 'Hood',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'cleaning-robot-dustbox',
        name: 'Get Dustbox Status',
        description: 'Get dustbox inserted status (CleaningRobot only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/status/BSH.Common.Status.DustBoxInserted',
        implemented: false,
        category: 'CleaningRobot',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
      {
        id: 'cleaning-robot-battery',
        name: 'Get Battery Level',
        description: 'Get battery charging level (CleaningRobot only)',
        method: 'GET',
        endpoint: '/homeappliances/{haId}/status/BSH.Common.Status.BatteryChargingState',
        implemented: false,
        category: 'CleaningRobot',
        parameters: [
          { name: 'haId', type: 'string', required: true, description: 'Home appliance ID' },
        ],
      },
    ];
  }
}
