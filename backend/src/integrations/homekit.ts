import {
  IPDiscovery,
  HttpClient,
  PairingData,
} from 'hap-controller';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import { IntegrationConfig, IntegrationData } from '../types';
import { logger } from '../services/logger';

// HomeKit service type mappings
const SERVICE_TYPES: Record<string, { name: string; icon: string; category: string }> = {
  '43': { name: 'Light Bulb', icon: 'lightbulb', category: 'lights' },
  '47': { name: 'Outlet', icon: 'plug', category: 'switches' },
  '49': { name: 'Switch', icon: 'toggle', category: 'switches' },
  '4A': { name: 'Thermostat', icon: 'thermometer', category: 'climate' },
  '80': { name: 'Contact Sensor', icon: 'door', category: 'sensors' },
  '82': { name: 'Humidity Sensor', icon: 'droplet', category: 'sensors' },
  '83': { name: 'Leak Sensor', icon: 'water', category: 'sensors' },
  '84': { name: 'Light Sensor', icon: 'sun', category: 'sensors' },
  '85': { name: 'Motion Sensor', icon: 'motion', category: 'sensors' },
  '86': { name: 'Occupancy Sensor', icon: 'user', category: 'sensors' },
  '87': { name: 'Smoke Sensor', icon: 'smoke', category: 'sensors' },
  '89': { name: 'Temperature Sensor', icon: 'temperature', category: 'sensors' },
  '41': { name: 'Garage Door Opener', icon: 'garage', category: 'doors' },
  '45': { name: 'Lock Mechanism', icon: 'lock', category: 'locks' },
  '8A': { name: 'Window', icon: 'window', category: 'windows' },
  '8B': { name: 'Window Covering', icon: 'blinds', category: 'windows' },
  '8C': { name: 'Battery Service', icon: 'battery', category: 'system' },
  'BC': { name: 'Television', icon: 'tv', category: 'media' },
  'D8': { name: 'Television Speaker', icon: 'speaker', category: 'media' },
  '40': { name: 'Fan', icon: 'fan', category: 'climate' },
  'B7': { name: 'Fan v2', icon: 'fan', category: 'climate' },
  '7E': { name: 'Security System', icon: 'shield', category: 'security' },
  '3E': { name: 'Accessory Information', icon: 'info', category: 'system' },
};

// Characteristic type mappings
const CHARACTERISTIC_TYPES: Record<string, string> = {
  '25': 'On',
  '8': 'Brightness',
  '13': 'Hue',
  '2F': 'Saturation',
  '23': 'Name',
  '11': 'CurrentTemperature',
  '35': 'TargetTemperature',
  '10': 'CurrentRelativeHumidity',
  '34': 'TargetRelativeHumidity',
  '0F': 'CurrentHeatingCoolingState',
  '33': 'TargetHeatingCoolingState',
  '1E': 'LockCurrentState',
  '19': 'LockTargetState',
  '6D': 'ContactSensorState',
  '22': 'MotionDetected',
  '70': 'LeakDetected',
  '6B': 'CurrentAmbientLightLevel',
  '68': 'BatteryLevel',
  '79': 'StatusLowBattery',
  '8F': 'ChargingState',
  '20': 'Manufacturer',
  '21': 'Model',
  '30': 'SerialNumber',
  '52': 'FirmwareRevision',
  'CE': 'ColorTemperature',
  'B6': 'Active',
  '29': 'RotationDirection',
  '28': 'RotationSpeed',
  'BF': 'SwingMode',
};

// Category mappings from HAP
const CATEGORY_NAMES: Record<number, string> = {
  1: 'Other',
  2: 'Bridge',
  3: 'Fan',
  4: 'Garage Door Opener',
  5: 'Lightbulb',
  6: 'Door Lock',
  7: 'Outlet',
  8: 'Switch',
  9: 'Thermostat',
  10: 'Sensor',
  11: 'Security System',
  12: 'Door',
  13: 'Window',
  14: 'Window Covering',
  15: 'Programmable Switch',
  16: 'Range Extender',
  17: 'IP Camera',
  18: 'Video Doorbell',
  19: 'Air Purifier',
  20: 'Heater',
  21: 'Air Conditioner',
  22: 'Humidifier',
  23: 'Dehumidifier',
  28: 'Sprinkler',
  29: 'Faucet',
  30: 'Shower System',
  31: 'Television',
  32: 'Remote',
};

export interface HomeKitConfig {
  discoveryMode: 'auto' | 'manual';
  devices?: HomeKitDeviceEntry[];
  pairings?: Record<string, StoredPairingData>;
  discoveryTimeout?: number;
}

interface HomeKitDeviceEntry {
  id: string;
  name: string;
  address: string;
  port: number;
}

interface StoredPairingData {
  iOSDevicePairingID: string;
  iOSDeviceLTSK: string;
  iOSDeviceLTPK: string;
  AccessoryPairingID: string;
  AccessoryLTPK: string;
}

interface DiscoveredDevice {
  id: string;
  name: string;
  address: string;
  port: number;
  paired: boolean;
  category: string;
  categoryId: number;
  configNumber: number;
  stateNumber: number;
}

interface HomeKitAccessory {
  aid: number;
  services: HomeKitService[];
}

interface HomeKitService {
  iid: number;
  type: string;
  typeName: string;
  category: string;
  icon: string;
  characteristics: HomeKitCharacteristic[];
  primary?: boolean;
}

interface HomeKitCharacteristic {
  aid: number;
  iid: number;
  type: string;
  typeName: string;
  value: unknown;
  perms: string[];
  format: string;
  minValue?: number;
  maxValue?: number;
  minStep?: number;
  unit?: string;
}

interface HomeKitDevice {
  id: string;
  name: string;
  address: string;
  port: number;
  paired: boolean;
  category: string;
  categoryId: number;
  online: boolean;
  accessories?: HomeKitAccessory[];
  primaryService?: {
    type: string;
    typeName: string;
    state: Record<string, unknown>;
  };
}

interface LightDevice {
  id: string;
  deviceId: string;
  name: string;
  aid: number;
  iid: number;
  on: boolean;
  brightness?: number;
  hue?: number;
  saturation?: number;
  colorTemperature?: number;
  reachable: boolean;
}

interface ClimateDevice {
  id: string;
  deviceId: string;
  name: string;
  aid: number;
  iid: number;
  type: 'thermostat' | 'sensor' | 'fan';
  currentTemperature?: number;
  targetTemperature?: number;
  currentHumidity?: number;
  heatingCoolingState?: number;
  targetHeatingCoolingState?: number;
  fanActive?: boolean;
  fanSpeed?: number;
  unit: string;
  reachable: boolean;
}

interface SensorDevice {
  id: string;
  deviceId: string;
  name: string;
  aid: number;
  iid: number;
  type: string;
  typeName: string;
  icon: string;
  value: unknown;
  unit?: string;
  batteryLevel?: number;
  lowBattery?: boolean;
  reachable: boolean;
}

export class HomeKitIntegration extends BaseIntegration {
  readonly type = 'homekit';
  readonly name = 'Apple HomeKit';

  private activeClients: Map<string, HttpClient> = new Map();

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const hkConfig = config as HomeKitConfig;

    try {
      if (hkConfig.discoveryMode === 'auto') {
        // Try to discover devices
        const devices = await this.discoverDevices(5000);

        if (devices.length === 0) {
          return {
            success: true,
            message: 'No HomeKit devices found on network. Ensure devices are in pairing mode or already paired.',
            details: {
              discoveryMode: 'auto',
              devicesFound: 0,
            },
          };
        }

        const pairedCount = devices.filter(d => d.paired).length;
        const unppairedCount = devices.length - pairedCount;

        return {
          success: true,
          message: `Found ${devices.length} HomeKit device(s)`,
          details: {
            discoveryMode: 'auto',
            devicesFound: devices.length,
            paired: pairedCount,
            unpaired: unppairedCount,
            devices: devices.map(d => ({
              name: d.name,
              category: d.category,
              paired: d.paired,
            })),
          },
        };
      } else {
        // Manual mode - check configured devices
        const devices = hkConfig.devices || [];

        if (devices.length === 0) {
          return {
            success: false,
            message: 'No devices configured. Add device IP addresses to connect.',
          };
        }

        const pairings = hkConfig.pairings || {};
        const pairedCount = devices.filter(d => pairings[d.id]).length;

        return {
          success: true,
          message: `${devices.length} device(s) configured, ${pairedCount} paired`,
          details: {
            discoveryMode: 'manual',
            devicesConfigured: devices.length,
            paired: pairedCount,
          },
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('homekit', 'Connection test failed', { error: errorMsg });
      return { success: false, message: `Discovery failed: ${errorMsg}` };
    }
  }

  async discoverDevices(timeout: number = 10000): Promise<DiscoveredDevice[]> {
    return new Promise((resolve, reject) => {
      try {
        const discovery = new IPDiscovery();
        const devices: DiscoveredDevice[] = [];
        const seenIds = new Set<string>();

        discovery.on('serviceUp', (service: {
          id: string;
          name: string;
          address: string;
          port: number;
          c_sharp?: number;
          ci?: number;
          sf?: number;
          s_sharp?: number;
        }) => {
          if (seenIds.has(service.id)) return;
          seenIds.add(service.id);

          const categoryId = service.ci || 1;
          devices.push({
            id: service.id,
            name: service.name || 'Unknown Device',
            address: service.address,
            port: service.port,
            paired: (service.sf || 0) === 0, // sf=0 means paired
            category: CATEGORY_NAMES[categoryId] || 'Other',
            categoryId,
            configNumber: service.c_sharp || 1,
            stateNumber: service.s_sharp || 1,
          });

          logger.debug('homekit', `Discovered device: ${service.name} at ${service.address}:${service.port}`);
        });

        discovery.on('error', (error: Error) => {
          logger.error('homekit', 'Discovery error', { error: error.message });
        });

        discovery.start();

        setTimeout(() => {
          discovery.stop();
          logger.debug('homekit', `Discovery complete, found ${devices.length} devices`);
          resolve(devices);
        }, timeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  async pairDevice(
    deviceId: string,
    address: string,
    port: number,
    pin: string
  ): Promise<StoredPairingData> {
    const client = new HttpClient(deviceId, address, port);

    try {
      logger.info('homekit', `Pairing with device at ${address}:${port}`);
      await client.pairSetup(pin);
      const pairingData = client.getLongTermData() as PairingData;

      return {
        iOSDevicePairingID: pairingData.iOSDevicePairingID,
        iOSDeviceLTSK: pairingData.iOSDeviceLTSK,
        iOSDeviceLTPK: pairingData.iOSDeviceLTPK,
        AccessoryPairingID: pairingData.AccessoryPairingID,
        AccessoryLTPK: pairingData.AccessoryLTPK,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('homekit', `Pairing failed: ${errorMsg}`);

      if (errorMsg.includes('M4') || errorMsg.includes('authentication')) {
        throw new Error('Invalid PIN code');
      }
      if (errorMsg.includes('M2') || errorMsg.includes('unavailable')) {
        throw new Error('Device is not in pairing mode');
      }
      throw error;
    }
  }

  async unpairDevice(
    deviceId: string,
    address: string,
    port: number,
    pairingData: StoredPairingData
  ): Promise<void> {
    const client = new HttpClient(deviceId, address, port, pairingData as unknown as PairingData);

    try {
      // The client will automatically verify the pairing when making requests
      await client.removePairing(pairingData.iOSDevicePairingID);
      logger.info('homekit', `Unpaired from device ${deviceId}`);
    } finally {
      await this.closeClient(client);
    }
  }

  private async getClient(
    deviceId: string,
    address: string,
    port: number,
    pairingData: StoredPairingData
  ): Promise<HttpClient> {
    const key = `${deviceId}:${address}:${port}`;

    // Return existing client if available
    let client = this.activeClients.get(key);
    if (client) {
      return client;
    }

    // Create new client - pairing verification happens automatically on first request
    client = new HttpClient(deviceId, address, port, pairingData as unknown as PairingData);
    this.activeClients.set(key, client);
    return client;
  }

  private async closeClient(client: HttpClient): Promise<void> {
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }
  }

  private parseServiceType(typeUuid: string): { type: string; info: { name: string; icon: string; category: string } } {
    // Extract short type from UUID (e.g., "00000043-0000-1000-8000-0026BB765291" -> "43")
    const shortType = typeUuid.split('-')[0].replace(/^0+/, '').toUpperCase();
    const info = SERVICE_TYPES[shortType] || { name: 'Unknown', icon: 'device', category: 'other' };
    return { type: shortType, info };
  }

  private parseCharacteristicType(typeUuid: string): string {
    const shortType = typeUuid.split('-')[0].replace(/^0+/, '').toUpperCase();
    return CHARACTERISTIC_TYPES[shortType] || shortType;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseAccessories(data: any): HomeKitAccessory[] {
    if (!data?.accessories) return [];

    return data.accessories.map((acc: any) => ({
      aid: acc.aid || 0,
      services: (acc.services || []).map((svc: any) => {
        const { type, info } = this.parseServiceType(svc.type || '');
        return {
          iid: svc.iid || 0,
          type,
          typeName: info.name,
          category: info.category,
          icon: info.icon,
          primary: svc.primary,
          characteristics: (svc.characteristics || []).map((char: any) => ({
            aid: acc.aid || 0,
            iid: char.iid || 0,
            type: this.parseCharacteristicType(char.type || ''),
            typeName: this.parseCharacteristicType(char.type || ''),
            value: char.value,
            perms: char.perms || [],
            format: char.format || 'string',
            minValue: char.minValue,
            maxValue: char.maxValue,
            minStep: char.minStep,
            unit: char.unit,
          })),
        };
      }),
    }));
  }

  private findCharacteristic(
    accessories: HomeKitAccessory[],
    typeName: string
  ): HomeKitCharacteristic | undefined {
    for (const acc of accessories) {
      for (const svc of acc.services) {
        const char = svc.characteristics.find(c => c.typeName === typeName);
        if (char) return char;
      }
    }
    return undefined;
  }

  private getCharacteristicValue(
    accessories: HomeKitAccessory[],
    serviceType: string,
    charTypeName: string
  ): unknown {
    for (const acc of accessories) {
      const svc = acc.services.find(s => s.type === serviceType);
      if (svc) {
        const char = svc.characteristics.find(c => c.typeName === charTypeName);
        if (char) return char.value;
      }
    }
    return undefined;
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const hkConfig = config as HomeKitConfig;

    // Handle device-specific metrics
    if (metric.startsWith('device:')) {
      const deviceId = metric.split(':')[1];
      return this.getDeviceData(hkConfig, deviceId);
    }

    switch (metric) {
      case 'devices':
        return this.getAllDevices(hkConfig);
      case 'lights':
        return this.getLights(hkConfig);
      case 'climate':
        return this.getClimate(hkConfig);
      case 'sensors':
        return this.getSensors(hkConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getAllDevices(config: HomeKitConfig): Promise<{
    devices: HomeKitDevice[];
    stats: { total: number; online: number; offline: number; byCategory: Record<string, number> };
  }> {
    const devices: HomeKitDevice[] = [];
    const pairings = config.pairings || {};

    // Get devices from discovery or manual config
    let deviceList: Array<{ id: string; name: string; address: string; port: number }> = [];

    if (config.discoveryMode === 'auto') {
      const discovered = await this.discoverDevices(config.discoveryTimeout || 5000);
      deviceList = discovered.map(d => ({
        id: d.id,
        name: d.name,
        address: d.address,
        port: d.port,
      }));
    } else {
      deviceList = config.devices || [];
    }

    // Fetch data from each paired device
    for (const device of deviceList) {
      const pairing = pairings[device.id];

      if (!pairing) {
        devices.push({
          id: device.id,
          name: device.name,
          address: device.address,
          port: device.port,
          paired: false,
          category: 'Unknown',
          categoryId: 1,
          online: false,
        });
        continue;
      }

      try {
        const client = await this.getClient(device.id, device.address, device.port, pairing);
        const accessoryData = await client.getAccessories();
        const accessories = this.parseAccessories(accessoryData);

        // Find primary service for category determination
        let primaryService: HomeKitService | undefined;
        for (const acc of accessories) {
          primaryService = acc.services.find(s => s.primary && s.type !== '3E');
          if (primaryService) break;
        }
        if (!primaryService) {
          primaryService = accessories[0]?.services.find(s => s.type !== '3E');
        }

        // Get device name from Accessory Information service
        const nameChar = this.findCharacteristic(accessories, 'Name');
        const deviceName = (nameChar?.value as string) || device.name;

        devices.push({
          id: device.id,
          name: deviceName,
          address: device.address,
          port: device.port,
          paired: true,
          category: primaryService?.category || 'other',
          categoryId: 1,
          online: true,
          accessories,
          primaryService: primaryService ? {
            type: primaryService.type,
            typeName: primaryService.typeName,
            state: this.extractServiceState(primaryService),
          } : undefined,
        });
      } catch (error) {
        logger.warn('homekit', `Failed to get data from device ${device.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });

        devices.push({
          id: device.id,
          name: device.name,
          address: device.address,
          port: device.port,
          paired: true,
          category: 'Unknown',
          categoryId: 1,
          online: false,
        });
      }
    }

    // Calculate stats
    const stats = {
      total: devices.length,
      online: devices.filter(d => d.online).length,
      offline: devices.filter(d => !d.online).length,
      byCategory: devices.reduce((acc, d) => {
        acc[d.category] = (acc[d.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return { devices, stats };
  }

  private extractServiceState(service: HomeKitService): Record<string, unknown> {
    const state: Record<string, unknown> = {};

    for (const char of service.characteristics) {
      if (char.perms.includes('pr') && char.value !== undefined) {
        state[char.typeName] = char.value;
      }
    }

    return state;
  }

  private async getLights(config: HomeKitConfig): Promise<{
    lights: LightDevice[];
    stats: { total: number; on: number; off: number; unreachable: number };
  }> {
    const { devices } = await this.getAllDevices(config);
    const lights: LightDevice[] = [];

    for (const device of devices) {
      if (!device.online || !device.accessories) continue;

      for (const acc of device.accessories) {
        for (const svc of acc.services) {
          if (svc.type === '43' || svc.typeName === 'Light Bulb') {
            const nameChar = svc.characteristics.find(c => c.typeName === 'Name');
            const onChar = svc.characteristics.find(c => c.typeName === 'On');
            const brightnessChar = svc.characteristics.find(c => c.typeName === 'Brightness');
            const hueChar = svc.characteristics.find(c => c.typeName === 'Hue');
            const satChar = svc.characteristics.find(c => c.typeName === 'Saturation');
            const ctChar = svc.characteristics.find(c => c.typeName === 'ColorTemperature');

            lights.push({
              id: `${device.id}:${acc.aid}:${svc.iid}`,
              deviceId: device.id,
              name: (nameChar?.value as string) || device.name,
              aid: acc.aid,
              iid: svc.iid,
              on: (onChar?.value as boolean) || false,
              brightness: brightnessChar?.value as number | undefined,
              hue: hueChar?.value as number | undefined,
              saturation: satChar?.value as number | undefined,
              colorTemperature: ctChar?.value as number | undefined,
              reachable: true,
            });
          }
        }
      }
    }

    const stats = {
      total: lights.length,
      on: lights.filter(l => l.on).length,
      off: lights.filter(l => !l.on).length,
      unreachable: lights.filter(l => !l.reachable).length,
    };

    return { lights, stats };
  }

  private async getClimate(config: HomeKitConfig): Promise<{
    devices: ClimateDevice[];
    stats: { thermostats: number; sensors: number; fans: number };
  }> {
    const { devices: allDevices } = await this.getAllDevices(config);
    const climateDevices: ClimateDevice[] = [];

    for (const device of allDevices) {
      if (!device.online || !device.accessories) continue;

      for (const acc of device.accessories) {
        for (const svc of acc.services) {
          // Thermostat
          if (svc.type === '4A' || svc.typeName === 'Thermostat') {
            const nameChar = svc.characteristics.find(c => c.typeName === 'Name');
            const currentTempChar = svc.characteristics.find(c => c.typeName === 'CurrentTemperature');
            const targetTempChar = svc.characteristics.find(c => c.typeName === 'TargetTemperature');
            const currentHumidityChar = svc.characteristics.find(c => c.typeName === 'CurrentRelativeHumidity');
            const currentStateChar = svc.characteristics.find(c => c.typeName === 'CurrentHeatingCoolingState');
            const targetStateChar = svc.characteristics.find(c => c.typeName === 'TargetHeatingCoolingState');

            climateDevices.push({
              id: `${device.id}:${acc.aid}:${svc.iid}`,
              deviceId: device.id,
              name: (nameChar?.value as string) || device.name,
              aid: acc.aid,
              iid: svc.iid,
              type: 'thermostat',
              currentTemperature: currentTempChar?.value as number | undefined,
              targetTemperature: targetTempChar?.value as number | undefined,
              currentHumidity: currentHumidityChar?.value as number | undefined,
              heatingCoolingState: currentStateChar?.value as number | undefined,
              targetHeatingCoolingState: targetStateChar?.value as number | undefined,
              unit: currentTempChar?.unit || 'celsius',
              reachable: true,
            });
          }

          // Temperature Sensor
          if (svc.type === '89' || svc.typeName === 'Temperature Sensor') {
            const nameChar = svc.characteristics.find(c => c.typeName === 'Name');
            const tempChar = svc.characteristics.find(c => c.typeName === 'CurrentTemperature');

            climateDevices.push({
              id: `${device.id}:${acc.aid}:${svc.iid}`,
              deviceId: device.id,
              name: (nameChar?.value as string) || device.name,
              aid: acc.aid,
              iid: svc.iid,
              type: 'sensor',
              currentTemperature: tempChar?.value as number | undefined,
              unit: tempChar?.unit || 'celsius',
              reachable: true,
            });
          }

          // Fan
          if (svc.type === '40' || svc.type === 'B7' || svc.typeName === 'Fan' || svc.typeName === 'Fan v2') {
            const nameChar = svc.characteristics.find(c => c.typeName === 'Name');
            const activeChar = svc.characteristics.find(c => c.typeName === 'Active' || c.typeName === 'On');
            const speedChar = svc.characteristics.find(c => c.typeName === 'RotationSpeed');

            climateDevices.push({
              id: `${device.id}:${acc.aid}:${svc.iid}`,
              deviceId: device.id,
              name: (nameChar?.value as string) || device.name,
              aid: acc.aid,
              iid: svc.iid,
              type: 'fan',
              fanActive: (activeChar?.value as boolean | number) === true || activeChar?.value === 1,
              fanSpeed: speedChar?.value as number | undefined,
              unit: 'percentage',
              reachable: true,
            });
          }
        }
      }
    }

    const stats = {
      thermostats: climateDevices.filter(d => d.type === 'thermostat').length,
      sensors: climateDevices.filter(d => d.type === 'sensor').length,
      fans: climateDevices.filter(d => d.type === 'fan').length,
    };

    return { devices: climateDevices, stats };
  }

  private async getSensors(config: HomeKitConfig): Promise<{
    sensors: SensorDevice[];
    stats: { total: number; byType: Record<string, number>; lowBattery: number };
  }> {
    const { devices: allDevices } = await this.getAllDevices(config);
    const sensors: SensorDevice[] = [];

    const sensorTypes = ['80', '82', '83', '84', '85', '86', '87', '89'];

    for (const device of allDevices) {
      if (!device.online || !device.accessories) continue;

      for (const acc of device.accessories) {
        // Find battery service for this accessory
        const batterySvc = acc.services.find(s => s.type === '8C');
        const batteryLevel = batterySvc?.characteristics.find(c => c.typeName === 'BatteryLevel')?.value as number | undefined;
        const lowBattery = batterySvc?.characteristics.find(c => c.typeName === 'StatusLowBattery')?.value as number | undefined;

        for (const svc of acc.services) {
          if (!sensorTypes.includes(svc.type)) continue;

          const nameChar = svc.characteristics.find(c => c.typeName === 'Name');

          // Get the primary value characteristic based on sensor type
          let valueChar: HomeKitCharacteristic | undefined;
          let unit: string | undefined;

          switch (svc.type) {
            case '80': // Contact Sensor
              valueChar = svc.characteristics.find(c => c.typeName === 'ContactSensorState');
              break;
            case '82': // Humidity Sensor
              valueChar = svc.characteristics.find(c => c.typeName === 'CurrentRelativeHumidity');
              unit = '%';
              break;
            case '83': // Leak Sensor
              valueChar = svc.characteristics.find(c => c.typeName === 'LeakDetected');
              break;
            case '84': // Light Sensor
              valueChar = svc.characteristics.find(c => c.typeName === 'CurrentAmbientLightLevel');
              unit = 'lux';
              break;
            case '85': // Motion Sensor
              valueChar = svc.characteristics.find(c => c.typeName === 'MotionDetected');
              break;
            case '86': // Occupancy Sensor
              valueChar = svc.characteristics.find(c => c.typeName === 'OccupancyDetected');
              break;
            case '87': // Smoke Sensor
              valueChar = svc.characteristics.find(c => c.typeName === 'SmokeDetected');
              break;
            case '89': // Temperature Sensor
              valueChar = svc.characteristics.find(c => c.typeName === 'CurrentTemperature');
              unit = valueChar?.unit || '°C';
              break;
          }

          sensors.push({
            id: `${device.id}:${acc.aid}:${svc.iid}`,
            deviceId: device.id,
            name: (nameChar?.value as string) || device.name,
            aid: acc.aid,
            iid: svc.iid,
            type: svc.type,
            typeName: svc.typeName,
            icon: svc.icon,
            value: valueChar?.value,
            unit,
            batteryLevel,
            lowBattery: lowBattery === 1,
            reachable: true,
          });
        }
      }
    }

    const stats = {
      total: sensors.length,
      byType: sensors.reduce((acc, s) => {
        acc[s.typeName] = (acc[s.typeName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      lowBattery: sensors.filter(s => s.lowBattery).length,
    };

    return { sensors, stats };
  }

  private async getDeviceData(config: HomeKitConfig, deviceId: string): Promise<{
    device: HomeKitDevice | null;
    accessories: HomeKitAccessory[];
  }> {
    const { devices } = await this.getAllDevices(config);
    const device = devices.find(d => d.id === deviceId);

    return {
      device: device || null,
      accessories: device?.accessories || [],
    };
  }

  async setCharacteristic(
    config: IntegrationConfig,
    deviceId: string,
    aid: number,
    iid: number,
    value: unknown
  ): Promise<void> {
    const hkConfig = config as HomeKitConfig;
    const pairings = hkConfig.pairings || {};
    const pairing = pairings[deviceId];

    if (!pairing) {
      throw new Error(`Device ${deviceId} is not paired`);
    }

    // Find device info
    let address: string;
    let port: number;

    if (hkConfig.discoveryMode === 'auto') {
      const discovered = await this.discoverDevices(5000);
      const device = discovered.find(d => d.id === deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found on network`);
      }
      address = device.address;
      port = device.port;
    } else {
      const device = hkConfig.devices?.find(d => d.id === deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not configured`);
      }
      address = device.address;
      port = device.port;
    }

    const client = await this.getClient(deviceId, address, port, pairing);

    try {
      await client.setCharacteristics({ [`${aid}.${iid}`]: value });
      logger.debug('homekit', `Set characteristic ${aid}.${iid} to ${value} on device ${deviceId}`);
    } catch (error) {
      logger.error('homekit', `Failed to set characteristic: ${error}`);
      throw error;
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'devices',
        name: 'All Devices',
        description: 'All paired HomeKit devices with current state',
        widgetTypes: ['homekit-devices'],
      },
      {
        id: 'lights',
        name: 'Lights',
        description: 'Light bulbs and dimmers',
        widgetTypes: ['homekit-lights'],
      },
      {
        id: 'climate',
        name: 'Climate',
        description: 'Thermostats, temperature sensors, and fans',
        widgetTypes: ['homekit-climate'],
      },
      {
        id: 'sensors',
        name: 'Sensors',
        description: 'Motion, contact, temperature, and other sensors',
        widgetTypes: ['homekit-sensors'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Discovery
      {
        id: 'discover-devices',
        name: 'Discover Devices',
        description: 'Scan network for HomeKit devices via mDNS/Bonjour',
        method: 'GET',
        endpoint: '/discover',
        implemented: true,
        category: 'Discovery',
        parameters: [
          { name: 'timeout', type: 'number', required: false, description: 'Discovery timeout in ms (default: 10000)' },
        ],
      },
      // Pairing
      {
        id: 'pair-device',
        name: 'Pair Device',
        description: 'Pair with a HomeKit device using 8-digit setup PIN',
        method: 'POST',
        endpoint: '/pair',
        implemented: true,
        category: 'Pairing',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device identifier' },
          { name: 'address', type: 'string', required: true, description: 'IP address' },
          { name: 'port', type: 'number', required: true, description: 'HAP port' },
          { name: 'pin', type: 'string', required: true, description: '8-digit setup PIN (XXX-XX-XXX)' },
        ],
      },
      {
        id: 'unpair-device',
        name: 'Unpair Device',
        description: 'Remove pairing from a HomeKit device',
        method: 'DELETE',
        endpoint: '/pair/{deviceId}',
        implemented: true,
        category: 'Pairing',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device identifier' },
        ],
      },
      {
        id: 'list-pairings',
        name: 'List Pairings',
        description: 'List all controllers paired with a device',
        method: 'GET',
        endpoint: '/devices/{deviceId}/pairings',
        implemented: false,
        category: 'Pairing',
      },
      // Accessories
      {
        id: 'get-accessories',
        name: 'Get Accessories',
        description: 'Get all accessories and services from a device',
        method: 'GET',
        endpoint: '/devices/{deviceId}/accessories',
        implemented: true,
        category: 'Accessories',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device identifier' },
        ],
      },
      // Characteristics
      {
        id: 'get-characteristics',
        name: 'Get Characteristics',
        description: 'Read one or more characteristic values',
        method: 'GET',
        endpoint: '/devices/{deviceId}/characteristics',
        implemented: true,
        category: 'Characteristics',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device identifier' },
          { name: 'ids', type: 'string', required: true, description: 'Comma-separated aid.iid pairs' },
        ],
      },
      {
        id: 'set-characteristics',
        name: 'Set Characteristics',
        description: 'Write characteristic values to control devices',
        method: 'PUT',
        endpoint: '/devices/{deviceId}/characteristics',
        implemented: true,
        category: 'Characteristics',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device identifier' },
          { name: 'characteristics', type: 'object', required: true, description: 'Map of aid.iid to value' },
        ],
      },
      {
        id: 'subscribe-characteristics',
        name: 'Subscribe to Events',
        description: 'Subscribe to characteristic change events',
        method: 'POST',
        endpoint: '/devices/{deviceId}/subscribe',
        implemented: false,
        category: 'Characteristics',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device identifier' },
          { name: 'characteristics', type: 'array', required: true, description: 'List of aid.iid to subscribe' },
        ],
      },
      // Convenience endpoints
      {
        id: 'set-light-on',
        name: 'Turn Light On/Off',
        description: 'Simple endpoint to turn a light on or off',
        method: 'PUT',
        endpoint: '/lights/{lightId}/on',
        implemented: true,
        category: 'Lights',
        parameters: [
          { name: 'lightId', type: 'string', required: true, description: 'Light identifier (deviceId:aid:iid)' },
          { name: 'on', type: 'boolean', required: true, description: 'On state' },
        ],
      },
      {
        id: 'set-light-brightness',
        name: 'Set Light Brightness',
        description: 'Set brightness level for a light',
        method: 'PUT',
        endpoint: '/lights/{lightId}/brightness',
        implemented: true,
        category: 'Lights',
        parameters: [
          { name: 'lightId', type: 'string', required: true, description: 'Light identifier' },
          { name: 'brightness', type: 'number', required: true, description: 'Brightness 0-100' },
        ],
      },
      {
        id: 'set-thermostat-target',
        name: 'Set Thermostat Target',
        description: 'Set target temperature for a thermostat',
        method: 'PUT',
        endpoint: '/climate/{deviceId}/target-temperature',
        implemented: true,
        category: 'Climate',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device identifier' },
          { name: 'temperature', type: 'number', required: true, description: 'Target temperature' },
        ],
      },
      {
        id: 'set-thermostat-mode',
        name: 'Set Thermostat Mode',
        description: 'Set heating/cooling mode for a thermostat',
        method: 'PUT',
        endpoint: '/climate/{deviceId}/mode',
        implemented: true,
        category: 'Climate',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device identifier' },
          { name: 'mode', type: 'number', required: true, description: '0=Off, 1=Heat, 2=Cool, 3=Auto' },
        ],
      },
    ];
  }
}
