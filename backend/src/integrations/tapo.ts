import { cloudLogin, loginDeviceByIp, TapoDevice as TapoLibDevice, TapoDeviceInfo as TapoLibDeviceInfo } from 'tp-link-tapo-connect';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  TapoConfig,
  TapoDevice,
  TapoDeviceInfo,
  TapoEnergyUsage,
  TapoDeviceType,
  TapoSensor,
  TapoSensorType,
} from '../types';
import { logger } from '../services/logger';

export class TapoIntegration extends BaseIntegration {
  readonly type = 'tapo';
  readonly name = 'TP-Link Tapo';

  // Parse deviceIps from comma-separated string or array
  private parseDeviceIps(config: TapoConfig): string[] {
    const deviceIps = config.deviceIps;
    if (!deviceIps) return [];
    if (Array.isArray(deviceIps)) return deviceIps.filter((ip: string) => ip.trim());
    if (typeof deviceIps === 'string') {
      return deviceIps.split(',').map((ip: string) => ip.trim()).filter((ip: string) => ip);
    }
    return [];
  }

  // Parse hubIps from comma-separated string or array
  private parseHubIps(config: TapoConfig): string[] {
    const hubIps = config.hubIps;
    if (!hubIps) return [];
    if (Array.isArray(hubIps)) return hubIps.filter((ip: string) => ip.trim());
    if (typeof hubIps === 'string') {
      return hubIps.split(',').map((ip: string) => ip.trim()).filter((ip: string) => ip);
    }
    return [];
  }

  private getDeviceType(model: string): TapoDeviceType {
    const modelUpper = model.toUpperCase();
    if (modelUpper.includes('P110') || modelUpper.includes('P115')) {
      return 'plug_energy';
    }
    if (modelUpper.includes('P100') || modelUpper.includes('P105')) {
      return 'plug';
    }
    if (modelUpper.includes('L530') || modelUpper.includes('L630')) {
      return 'bulb_color';
    }
    if (modelUpper.includes('L510') || modelUpper.includes('L610')) {
      return 'bulb';
    }
    if (modelUpper.includes('L900') || modelUpper.includes('L920') || modelUpper.includes('L930')) {
      return 'strip';
    }
    return 'plug';
  }

  private hasEnergyMonitoring(model: string): boolean {
    const modelUpper = model.toUpperCase();
    return modelUpper.includes('P110') || modelUpper.includes('P115');
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const tapoConfig = config as TapoConfig;

    try {
      logger.debug('tapo', 'Testing connection with cloud login');

      const cloudApi = await cloudLogin(tapoConfig.email, tapoConfig.password);
      const devices = await cloudApi.listDevices();

      logger.debug('tapo', `Found ${devices.length} devices`);

      return {
        success: true,
        message: `Connected to Tapo cloud (${devices.length} device${devices.length !== 1 ? 's' : ''} found)`,
        details: {
          deviceCount: devices.length,
          devices: devices.map(d => ({
            alias: d.alias,
            model: d.deviceModel,
          })),
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('tapo', 'Connection test failed', { error: errorMsg });

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const tapoConfig = config as TapoConfig;

    switch (metric) {
      case 'devices':
        return this.getDevices(tapoConfig);
      case 'device-info':
        return this.getDeviceInfo(tapoConfig);
      case 'energy-usage':
        return this.getEnergyUsage(tapoConfig);
      case 'sensors':
        return this.getSensors(tapoConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getDevices(config: TapoConfig): Promise<{ devices: TapoDevice[] }> {
    try {
      const cloudApi = await cloudLogin(config.email, config.password);
      const cloudDevices = await cloudApi.listDevices();

      const devices: TapoDevice[] = cloudDevices.map((device: TapoLibDevice) => ({
        deviceId: device.deviceId,
        alias: device.alias,
        deviceType: this.getDeviceType(device.deviceModel),
        deviceModel: device.deviceModel,
        deviceMac: device.deviceMac,
        deviceOn: false, // Unknown without local access
        fwVersion: device.fwVer,
        hwVersion: device.deviceHwVer,
        hasEnergyMonitoring: this.hasEnergyMonitoring(device.deviceModel),
      }));

      // Try to get online status for each device if IPs are provided
      const deviceIps = this.parseDeviceIps(config);
      if (deviceIps.length > 0) {
        for (const ip of deviceIps) {
          try {
            const cleanIp = ip.split(':')[0] || ip;

            // Add timeout to prevent long waits
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Connection timeout')), 5000)
            );

            const deviceApi = await Promise.race([
              loginDeviceByIp(config.email, config.password, cleanIp),
              timeoutPromise
            ]);

            const info = await deviceApi.getDeviceInfo();

            // Find matching cloud device by MAC or name and update status
            const matchingDevice = devices.find(
              d => d.deviceMac === info.mac || d.alias === info.nickname
            );
            if (matchingDevice) {
              matchingDevice.deviceOn = info.device_on || false;
              matchingDevice.ipAddress = cleanIp;
            }
          } catch (e) {
            // Device might be offline or unreachable - continue with others
            logger.debug('tapo', `Could not get status for device at ${ip}`, { error: String(e) });
          }
        }
      }

      logger.debug('tapo', `Fetched ${devices.length} devices`);
      return { devices };
    } catch (error) {
      logger.error('tapo', 'Failed to fetch devices', { error: String(error) });
      return { devices: [] };
    }
  }

  private async getDeviceInfo(config: TapoConfig): Promise<{ devices: TapoDeviceInfo[] }> {
    try {
      const cloudApi = await cloudLogin(config.email, config.password);
      const cloudDevices = await cloudApi.listDevices();

      // Always start with cloud devices as base
      const deviceMap = new Map<string, TapoDeviceInfo>();
      for (const device of cloudDevices) {
        deviceMap.set(device.deviceId, {
          deviceId: device.deviceId,
          alias: device.alias,
          deviceType: this.getDeviceType(device.deviceModel),
          deviceModel: device.deviceModel,
          deviceMac: device.deviceMac,
          deviceOn: false, // Unknown without local access
          fwVersion: device.fwVer,
          hwVersion: device.deviceHwVer,
          hasEnergyMonitoring: this.hasEnergyMonitoring(device.deviceModel),
          signalLevel: 0,
          overheated: false,
          onTime: 0,
        });
      }

      // If we have device IPs, try to get detailed info (with timeout)
      const deviceIps = this.parseDeviceIps(config);
      if (deviceIps.length > 0) {
        for (const ip of deviceIps) {
          try {
            const cleanIp = ip.split(':')[0] || ip;

            // Add timeout to prevent long waits
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Connection timeout')), 5000)
            );

            const deviceApi = await Promise.race([
              loginDeviceByIp(config.email, config.password, cleanIp),
              timeoutPromise
            ]);

            const info: TapoLibDeviceInfo & { brightness?: number; color_temp?: number; hue?: number; saturation?: number } = await deviceApi.getDeviceInfo();

            // Find matching cloud device and update with local info
            const cloudDevice = cloudDevices.find(
              (d: TapoLibDevice) => d.deviceMac === info.mac || d.alias === info.nickname
            );

            const deviceId = cloudDevice?.deviceId || info.device_id || cleanIp;
            deviceMap.set(deviceId, {
              deviceId,
              alias: info.nickname || cloudDevice?.alias || 'Unknown',
              deviceType: this.getDeviceType(info.model || cloudDevice?.deviceModel || ''),
              deviceModel: info.model || cloudDevice?.deviceModel || 'Unknown',
              deviceMac: info.mac || cloudDevice?.deviceMac || '',
              deviceOn: info.device_on || false,
              ipAddress: cleanIp,
              fwVersion: info.fw_ver || cloudDevice?.fwVer,
              hwVersion: info.hw_ver || cloudDevice?.deviceHwVer,
              hasEnergyMonitoring: this.hasEnergyMonitoring(info.model || cloudDevice?.deviceModel || ''),
              signalLevel: info.rssi || info.signal_level || 0,
              overheated: info.overheated || false,
              onTime: info.on_time || 0,
              brightness: info.brightness,
              colorTemp: info.color_temp,
              hue: info.hue,
              saturation: info.saturation,
            });
          } catch (e) {
            logger.debug('tapo', `Could not get info for device at ${ip}`, { error: String(e) });
            // Continue with cloud data for this device
          }
        }
      }

      const devices = Array.from(deviceMap.values());
      logger.debug('tapo', `Fetched info for ${devices.length} devices`);
      return { devices };
    } catch (error) {
      logger.error('tapo', 'Failed to fetch device info', { error: String(error) });
      return { devices: [] };
    }
  }

  private async getEnergyUsage(config: TapoConfig): Promise<{ devices: TapoEnergyUsage[] }> {
    try {
      const cloudApi = await cloudLogin(config.email, config.password);
      const cloudDevices = await cloudApi.listDevices();

      const energyDevices: TapoEnergyUsage[] = [];

      // Filter to only energy monitoring devices
      const energyCapableDevices = cloudDevices.filter(
        (d: TapoLibDevice) => this.hasEnergyMonitoring(d.deviceModel)
      );

      const deviceIps = this.parseDeviceIps(config);
      if (deviceIps.length > 0) {
        for (const ip of deviceIps) {
          try {
            const cleanIp = ip.split(':')[0] || ip;

            // Add timeout to prevent long waits
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Connection timeout')), 5000)
            );

            const deviceApi = await Promise.race([
              loginDeviceByIp(config.email, config.password, cleanIp),
              timeoutPromise
            ]);

            const info: TapoLibDeviceInfo = await deviceApi.getDeviceInfo();

            // Check if this device supports energy monitoring
            if (!this.hasEnergyMonitoring(info.model || '')) {
              continue;
            }

            // Get energy usage
            let energyData: Record<string, unknown> = {};
            try {
              energyData = (await deviceApi.getEnergyUsage()) as Record<string, unknown>;
            } catch {
              logger.debug('tapo', `Energy usage not available for ${info.nickname}`);
            }

            // Find matching cloud device
            const cloudDevice = cloudDevices.find(
              (d: TapoLibDevice) => d.deviceMac === info.mac || d.alias === info.nickname
            );

            energyDevices.push({
              deviceId: cloudDevice?.deviceId || info.device_id || cleanIp,
              alias: info.nickname || cloudDevice?.alias || 'Unknown',
              currentPower: (energyData.current_power as number) || 0,
              todayEnergy: (energyData.today_energy as number) || 0,
              monthEnergy: (energyData.month_energy as number) || 0,
              todayRuntime: (energyData.today_runtime as number) || 0,
              monthRuntime: (energyData.month_runtime as number) || 0,
            });
          } catch (e) {
            logger.debug('tapo', `Could not get energy for device at ${ip}`, { error: String(e) });
          }
        }
      }

      logger.debug('tapo', `Fetched energy for ${energyDevices.length} devices`);
      return { devices: energyDevices };
    } catch (error) {
      logger.error('tapo', 'Failed to fetch energy usage', { error: String(error) });
      return { devices: [] };
    }
  }

  private isHubDevice(model: string): boolean {
    const modelUpper = model.toUpperCase();
    return modelUpper.includes('H100') || modelUpper.includes('H200');
  }

  private getSensorType(model: string): TapoSensorType {
    const modelUpper = model.toUpperCase();
    // Temperature/humidity sensors
    if (modelUpper.includes('T310') || modelUpper.includes('T315')) {
      return 'temperature';
    }
    // Motion sensors
    if (modelUpper.includes('T100')) {
      return 'motion';
    }
    // Contact sensors (door/window)
    if (modelUpper.includes('T110')) {
      return 'contact';
    }
    // Water leak sensors
    if (modelUpper.includes('T300')) {
      return 'water_leak';
    }
    // Smart buttons
    if (modelUpper.includes('S200')) {
      return 'button';
    }
    return 'unknown';
  }

  private async getSensors(config: TapoConfig): Promise<{ sensors: TapoSensor[] }> {
    try {
      const cloudApi = await cloudLogin(config.email, config.password);
      const cloudDevices = await cloudApi.listDevices();

      const sensors: TapoSensor[] = [];
      const hubIps = this.parseHubIps(config);

      // Find hub devices and get their child sensors
      const hubDevices = cloudDevices.filter((d: { deviceModel: string }) => this.isHubDevice(d.deviceModel));

      if (hubDevices.length === 0) {
        logger.debug('tapo', 'No hub devices found in cloud');
        return { sensors: [] };
      }

      if (hubIps.length === 0) {
        logger.debug('tapo', 'No hub IPs configured');
        return { sensors: [] };
      }

      // Try to connect to hubs via IP and get child device info
      for (const ip of hubIps) {
        try {
          const cleanIp = ip.split(':')[0] || ip;

          // Add timeout to prevent long waits
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 5000)
          );

          const deviceApi = await Promise.race([
            loginDeviceByIp(config.email, config.password, cleanIp),
            timeoutPromise
          ]);

          const info = await deviceApi.getDeviceInfo();

          // Check if this is a hub
          if (!this.isHubDevice(info.model || '')) {
            continue;
          }

          // Get child devices (sensors) from the hub
          // Note: Field names vary by sensor type and firmware version
          let childDevices: Array<{
            device_id?: string;
            nickname?: string;
            model?: string;
            status?: string;
            at_low_battery?: boolean;
            battery_percentage?: number;
            // Temperature sensor fields
            current_temp?: number;
            temp_unit?: string;
            current_humidity?: number;
            // Motion sensor fields - multiple possible field names
            detected?: boolean;
            motion_detected?: boolean;
            lastDetectedTime?: number;
            last_detected_time?: number;
            trigger_logs?: Array<{ timestamp: number }>;
            // Contact sensor fields
            is_open?: boolean;
            open?: boolean;
            last_open_time?: number;
            last_close_time?: number;
            // Water leak sensor fields
            water_leak_status?: string;
            water_detected?: boolean;
            // Common fields
            report_interval?: number;
            lastOnboardingTimestamp?: number;
            // Catch-all for debugging
            [key: string]: unknown;
          }> = [];
          try {
            childDevices = await (deviceApi as unknown as { getChildDeviceList: () => Promise<typeof childDevices> }).getChildDeviceList();
          } catch {
            // Try alternative method name
            try {
              childDevices = await (deviceApi as unknown as { getChildDevicesInfo: () => Promise<typeof childDevices> }).getChildDevicesInfo();
            } catch (e) {
              logger.debug('tapo', `Could not get child devices from hub at ${cleanIp}`, { error: String(e) });
              continue;
            }
          }

          // Find matching cloud hub device
          const cloudHub = hubDevices.find(
            (d: { deviceMac?: string; alias?: string }) => d.deviceMac === info.mac || d.alias === info.nickname
          );

          // Process child devices (sensors)
          for (const child of childDevices) {
            const sensorType = this.getSensorType(child.model || '');

            const sensor: TapoSensor = {
              deviceId: child.device_id || `${cleanIp}-${child.nickname}`,
              alias: child.nickname || 'Unknown Sensor',
              model: child.model || 'Unknown',
              sensorType,
              parentDeviceId: cloudHub?.deviceId || cleanIp,
              status: child.status === 'online' ? 'online' : 'offline',
              batteryPercentage: child.battery_percentage,
              reportInterval: child.report_interval,
              lastUpdate: child.lastOnboardingTimestamp
                ? new Date(child.lastOnboardingTimestamp * 1000).toISOString()
                : undefined,
            };

            // Add type-specific fields
            if (sensorType === 'temperature') {
              sensor.temperature = child.current_temp;
              sensor.temperatureUnit = child.temp_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
              sensor.humidity = child.current_humidity;
            } else if (sensorType === 'motion') {
              // Log raw child data to help debug field names
              logger.debug('tapo', `Motion sensor raw data for ${child.nickname}`, {
                data: JSON.stringify(child).slice(0, 1000)
              });

              // Check multiple possible field names for motion detection
              const isDetected = child.detected ?? child.motion_detected ?? false;
              sensor.detected = isDetected;

              // Check multiple possible field names for last detected time
              let lastDetectedTs = child.lastDetectedTime ?? child.last_detected_time;
              // Also check trigger_logs if available
              if (!lastDetectedTs && child.trigger_logs && child.trigger_logs.length > 0) {
                lastDetectedTs = child.trigger_logs[0].timestamp;
              }
              sensor.lastDetectedTime = lastDetectedTs
                ? new Date(lastDetectedTs * 1000).toISOString()
                : undefined;
            } else if (sensorType === 'contact') {
              sensor.isOpen = child.is_open ?? child.open ?? false;
              sensor.lastOpenTime = child.last_open_time
                ? new Date(child.last_open_time * 1000).toISOString()
                : undefined;
              sensor.lastCloseTime = child.last_close_time
                ? new Date(child.last_close_time * 1000).toISOString()
                : undefined;
            } else if (sensorType === 'water_leak') {
              sensor.waterDetected = child.water_detected ?? child.water_leak_status === 'water_leak';
            }

            logger.debug('tapo', `Found sensor: ${sensor.alias}, type: ${sensorType}, model: ${child.model}, detected: ${sensor.detected}`);
            sensors.push(sensor);
          }
        } catch (e) {
          logger.debug('tapo', `Could not get sensors from device at ${ip}`, { error: String(e) });
        }
      }

      logger.debug('tapo', `Fetched ${sensors.length} sensors from ${hubDevices.length} hub(s)`);
      return { sensors };
    } catch (error) {
      logger.error('tapo', 'Failed to fetch sensors', { error: String(error) });
      return { sensors: [] };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'devices',
        name: 'Devices',
        description: 'List of all Tapo devices',
        widgetTypes: ['device-list'],
      },
      {
        id: 'device-info',
        name: 'Device Info',
        description: 'Detailed device information with status',
        widgetTypes: ['device-status'],
      },
      {
        id: 'energy-usage',
        name: 'Energy Usage',
        description: 'Power consumption for P110/P115 devices',
        widgetTypes: ['energy-overview', 'power-monitor'],
      },
      {
        id: 'sensors',
        name: 'Sensors',
        description: 'Temperature and humidity sensors connected to Tapo Hubs (H100/H200)',
        widgetTypes: ['sensor-list'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Cloud API - Implemented
      {
        id: 'cloud-login',
        name: 'Cloud Login',
        description: 'Authenticate with TP-Link cloud using email and password',
        method: 'POST',
        endpoint: 'cloudLogin',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'TP-Link account email' },
          { name: 'password', type: 'string', required: true, description: 'TP-Link account password' },
        ],
        documentationUrl: 'https://github.com/dickydoouk/tp-link-tapo-connect',
      },
      {
        id: 'list-devices',
        name: 'List Devices',
        description: 'List all Tapo devices registered to the cloud account',
        method: 'GET',
        endpoint: 'listDevices',
        implemented: true,
        category: 'Cloud',
      },
      {
        id: 'list-devices-by-type',
        name: 'List Devices by Type',
        description: 'List Tapo devices filtered by device type',
        method: 'GET',
        endpoint: 'listDevicesByType',
        implemented: false,
        category: 'Cloud',
        parameters: [
          { name: 'deviceType', type: 'string', required: true, description: 'Device type filter (e.g., SMART.TAPOPLUG)' },
        ],
      },

      // Local Device Connection - Implemented
      {
        id: 'login-device-by-ip',
        name: 'Login Device by IP',
        description: 'Connect to a device directly using its local IP address (requires cloud credentials)',
        method: 'POST',
        endpoint: 'loginDeviceByIp',
        implemented: true,
        category: 'Authentication',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'TP-Link account email' },
          { name: 'password', type: 'string', required: true, description: 'TP-Link account password' },
          { name: 'ipAddress', type: 'string', required: true, description: 'Device local IP address' },
        ],
      },

      // Device Information - Implemented
      {
        id: 'get-device-info',
        name: 'Get Device Info',
        description: 'Get detailed device information including model, firmware, MAC, state, brightness, and color settings',
        method: 'GET',
        endpoint: 'get_device_info',
        implemented: true,
        category: 'Device Info',
      },

      // Device Control - Not Implemented
      {
        id: 'turn-on',
        name: 'Turn On',
        description: 'Turn the device on',
        method: 'POST',
        endpoint: 'turnOn',
        implemented: false,
        category: 'Device Control',
      },
      {
        id: 'turn-off',
        name: 'Turn Off',
        description: 'Turn the device off',
        method: 'POST',
        endpoint: 'turnOff',
        implemented: false,
        category: 'Device Control',
      },
      {
        id: 'toggle',
        name: 'Toggle',
        description: 'Toggle the device on/off state',
        method: 'POST',
        endpoint: 'toggle',
        implemented: false,
        category: 'Device Control',
      },
      {
        id: 'set-device-info',
        name: 'Set Device Info',
        description: 'Update device settings like nickname',
        method: 'POST',
        endpoint: 'set_device_info',
        implemented: false,
        category: 'Device Control',
        parameters: [
          { name: 'nickname', type: 'string', required: false, description: 'New device nickname (base64 encoded)' },
        ],
      },

      // Energy Monitoring - Implemented
      {
        id: 'get-energy-usage',
        name: 'Get Energy Usage',
        description: 'Get current power consumption and energy statistics (P110/P115 only)',
        method: 'GET',
        endpoint: 'get_energy_usage',
        implemented: true,
        category: 'Energy Monitoring',
      },
      {
        id: 'get-current-power',
        name: 'Get Current Power',
        description: 'Get real-time power consumption in watts',
        method: 'GET',
        endpoint: 'get_current_power',
        implemented: false,
        category: 'Energy Monitoring',
      },
      {
        id: 'get-energy-data',
        name: 'Get Energy Data',
        description: 'Get detailed energy consumption data over time',
        method: 'GET',
        endpoint: 'get_energy_data',
        implemented: false,
        category: 'Energy Monitoring',
        parameters: [
          { name: 'start_timestamp', type: 'number', required: false, description: 'Start timestamp for data range' },
          { name: 'end_timestamp', type: 'number', required: false, description: 'End timestamp for data range' },
          { name: 'interval', type: 'number', required: false, description: 'Data interval in minutes' },
        ],
      },

      // Light Controls - Not Implemented
      {
        id: 'set-brightness',
        name: 'Set Brightness',
        description: 'Set the brightness level (for bulbs L510, L520, L530, L610, L630)',
        method: 'POST',
        endpoint: 'setBrightness',
        implemented: false,
        category: 'Light Control',
        parameters: [
          { name: 'brightness', type: 'number', required: true, description: 'Brightness level (1-100)' },
        ],
      },
      {
        id: 'set-colour',
        name: 'Set Color',
        description: 'Set the light color using color name or hex value (for color bulbs L530, L630)',
        method: 'POST',
        endpoint: 'setColour',
        implemented: false,
        category: 'Light Control',
        parameters: [
          { name: 'colour', type: 'string', required: true, description: 'Color name (e.g., "white", "red") or hex value (e.g., "#FF00FF")' },
        ],
      },
      {
        id: 'set-color-temp',
        name: 'Set Color Temperature',
        description: 'Set the color temperature in Kelvin (for tunable bulbs)',
        method: 'POST',
        endpoint: 'set_color_temp',
        implemented: false,
        category: 'Light Control',
        parameters: [
          { name: 'color_temp', type: 'number', required: true, description: 'Color temperature in Kelvin (2500-6500)' },
        ],
      },
      {
        id: 'set-hue-saturation',
        name: 'Set Hue and Saturation',
        description: 'Set the hue and saturation values (for color bulbs)',
        method: 'POST',
        endpoint: 'set_hue_saturation',
        implemented: false,
        category: 'Light Control',
        parameters: [
          { name: 'hue', type: 'number', required: true, description: 'Hue value (0-360)' },
          { name: 'saturation', type: 'number', required: true, description: 'Saturation value (0-100)' },
        ],
      },
      {
        id: 'set-light-state',
        name: 'Set Light State',
        description: 'Set multiple light parameters at once (brightness, color temp, hue, saturation)',
        method: 'POST',
        endpoint: 'set_light_state',
        implemented: false,
        category: 'Light Control',
        parameters: [
          { name: 'on_off', type: 'boolean', required: false, description: 'Turn light on/off' },
          { name: 'brightness', type: 'number', required: false, description: 'Brightness (1-100)' },
          { name: 'hue', type: 'number', required: false, description: 'Hue (0-360)' },
          { name: 'saturation', type: 'number', required: false, description: 'Saturation (0-100)' },
          { name: 'color_temp', type: 'number', required: false, description: 'Color temperature in Kelvin' },
        ],
      },
      {
        id: 'get-light-effect',
        name: 'Get Light Effect',
        description: 'Get current light effect settings (for light strips L900, L920, L930)',
        method: 'GET',
        endpoint: 'get_light_effect',
        implemented: false,
        category: 'Light Control',
      },
      {
        id: 'set-light-effect',
        name: 'Set Light Effect',
        description: 'Activate a preset light effect',
        method: 'POST',
        endpoint: 'set_light_effect',
        implemented: false,
        category: 'Light Control',
        parameters: [
          { name: 'effect_id', type: 'string', required: true, description: 'Effect preset ID' },
        ],
      },

      // Schedule - Not Implemented
      {
        id: 'get-schedule-rules',
        name: 'Get Schedule Rules',
        description: 'Get all scheduled on/off rules',
        method: 'GET',
        endpoint: 'get_schedule_rules',
        implemented: false,
        category: 'Scheduling',
      },
      {
        id: 'add-schedule-rule',
        name: 'Add Schedule Rule',
        description: 'Add a new scheduled on/off rule',
        method: 'POST',
        endpoint: 'add_schedule_rule',
        implemented: false,
        category: 'Scheduling',
        parameters: [
          { name: 'start_time', type: 'number', required: true, description: 'Start time in minutes from midnight' },
          { name: 'end_time', type: 'number', required: false, description: 'End time in minutes from midnight' },
          { name: 'enable', type: 'boolean', required: true, description: 'Enable the schedule' },
          { name: 'repeat_type', type: 'string', required: true, description: 'Repeat type (once, daily, weekly)' },
          { name: 'week_days', type: 'array', required: false, description: 'Days of week for weekly repeat' },
        ],
      },
      {
        id: 'edit-schedule-rule',
        name: 'Edit Schedule Rule',
        description: 'Edit an existing schedule rule',
        method: 'POST',
        endpoint: 'edit_schedule_rule',
        implemented: false,
        category: 'Scheduling',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Schedule rule ID' },
        ],
      },
      {
        id: 'remove-schedule-rule',
        name: 'Remove Schedule Rule',
        description: 'Delete a schedule rule',
        method: 'POST',
        endpoint: 'remove_schedule_rule',
        implemented: false,
        category: 'Scheduling',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Schedule rule ID' },
        ],
      },

      // Countdown Timer - Not Implemented
      {
        id: 'get-countdown-rules',
        name: 'Get Countdown Rules',
        description: 'Get countdown timer rules',
        method: 'GET',
        endpoint: 'get_countdown_rules',
        implemented: false,
        category: 'Timer',
      },
      {
        id: 'add-countdown-rule',
        name: 'Add Countdown Rule',
        description: 'Add a countdown timer to turn on/off after a delay',
        method: 'POST',
        endpoint: 'add_countdown_rule',
        implemented: false,
        category: 'Timer',
        parameters: [
          { name: 'enable', type: 'boolean', required: true, description: 'Enable the countdown' },
          { name: 'delay', type: 'number', required: true, description: 'Delay in seconds' },
          { name: 'on_off', type: 'boolean', required: true, description: 'Turn on (true) or off (false) when timer expires' },
        ],
      },

      // Hub Features - Implemented (Partial)
      {
        id: 'get-child-device-list',
        name: 'Get Child Device List',
        description: 'Get list of sensors and devices connected to the hub (H100/H200)',
        method: 'GET',
        endpoint: 'getChildDeviceList',
        implemented: true,
        category: 'Hub',
      },
      {
        id: 'get-child-device-info',
        name: 'Get Child Device Info',
        description: 'Get detailed information about a specific hub-connected device',
        method: 'GET',
        endpoint: 'getChildDeviceInfo',
        implemented: false,
        category: 'Hub',
        parameters: [
          { name: 'device_id', type: 'string', required: true, description: 'Child device ID' },
        ],
      },
      {
        id: 'control-child-device',
        name: 'Control Child Device',
        description: 'Send control command to a hub-connected device',
        method: 'POST',
        endpoint: 'controlChildDevice',
        implemented: false,
        category: 'Hub',
        parameters: [
          { name: 'device_id', type: 'string', required: true, description: 'Child device ID' },
          { name: 'action', type: 'string', required: true, description: 'Control action' },
        ],
      },

      // Sensor Data - Implemented (Partial)
      {
        id: 'get-temperature-humidity',
        name: 'Get Temperature/Humidity',
        description: 'Get temperature and humidity readings from T310/T315 sensors',
        method: 'GET',
        endpoint: 'get_temperature_humidity_records',
        implemented: true,
        category: 'Sensors',
      },
      {
        id: 'get-motion-detection',
        name: 'Get Motion Detection',
        description: 'Get motion detection status and history from T100 sensors',
        method: 'GET',
        endpoint: 'get_motion_detection',
        implemented: true,
        category: 'Sensors',
      },
      {
        id: 'get-contact-sensor',
        name: 'Get Contact Sensor',
        description: 'Get door/window open/close status from T110 sensors',
        method: 'GET',
        endpoint: 'get_contact_sensor_status',
        implemented: true,
        category: 'Sensors',
      },
      {
        id: 'get-water-leak',
        name: 'Get Water Leak Status',
        description: 'Get water leak detection status from T300 sensors',
        method: 'GET',
        endpoint: 'get_water_leak_status',
        implemented: true,
        category: 'Sensors',
      },
      {
        id: 'get-trigger-logs',
        name: 'Get Trigger Logs',
        description: 'Get historical trigger event logs from sensors',
        method: 'GET',
        endpoint: 'get_trigger_logs',
        implemented: false,
        category: 'Sensors',
        parameters: [
          { name: 'device_id', type: 'string', required: true, description: 'Sensor device ID' },
          { name: 'page_size', type: 'number', required: false, description: 'Number of records to fetch' },
          { name: 'start_id', type: 'number', required: false, description: 'Starting record ID for pagination' },
        ],
      },

      // Hub Siren - Not Implemented
      {
        id: 'play-siren',
        name: 'Play Siren',
        description: 'Trigger the hub siren/alarm (H100/H200)',
        method: 'POST',
        endpoint: 'play_alarm',
        implemented: false,
        category: 'Hub',
      },
      {
        id: 'stop-siren',
        name: 'Stop Siren',
        description: 'Stop the hub siren/alarm',
        method: 'POST',
        endpoint: 'stop_alarm',
        implemented: false,
        category: 'Hub',
      },
      {
        id: 'get-siren-config',
        name: 'Get Siren Config',
        description: 'Get siren alarm configuration',
        method: 'GET',
        endpoint: 'get_alarm_config',
        implemented: false,
        category: 'Hub',
      },

      // Power Strip - Not Implemented
      {
        id: 'get-plug-info',
        name: 'Get Plug Info',
        description: 'Get information about individual plugs on a power strip (P300)',
        method: 'GET',
        endpoint: 'get_plug_info',
        implemented: false,
        category: 'Power Strip',
      },
      {
        id: 'set-plug-state',
        name: 'Set Plug State',
        description: 'Control individual outlets on a power strip',
        method: 'POST',
        endpoint: 'set_plug_info',
        implemented: false,
        category: 'Power Strip',
        parameters: [
          { name: 'index', type: 'number', required: true, description: 'Outlet index (0-based)' },
          { name: 'on_off', type: 'boolean', required: true, description: 'Turn outlet on/off' },
        ],
      },

      // Firmware - Not Implemented
      {
        id: 'get-firmware-info',
        name: 'Get Firmware Info',
        description: 'Get current firmware version information',
        method: 'GET',
        endpoint: 'get_fw_download_state',
        implemented: false,
        category: 'Firmware',
      },
      {
        id: 'check-firmware-update',
        name: 'Check Firmware Update',
        description: 'Check if firmware update is available',
        method: 'GET',
        endpoint: 'get_latest_fw',
        implemented: false,
        category: 'Firmware',
      },

      // WiFi - Not Implemented
      {
        id: 'get-wifi-info',
        name: 'Get WiFi Info',
        description: 'Get current WiFi connection information (SSID, signal strength)',
        method: 'GET',
        endpoint: 'get_wireless_scan_info',
        implemented: false,
        category: 'WiFi',
      },

      // Device Time - Not Implemented
      {
        id: 'get-device-time',
        name: 'Get Device Time',
        description: 'Get the current time configured on the device',
        method: 'GET',
        endpoint: 'get_device_time',
        implemented: false,
        category: 'Time',
      },
      {
        id: 'set-device-time',
        name: 'Set Device Time',
        description: 'Set the device time and timezone',
        method: 'POST',
        endpoint: 'set_device_time',
        implemented: false,
        category: 'Time',
        parameters: [
          { name: 'timestamp', type: 'number', required: true, description: 'Unix timestamp' },
          { name: 'timezone', type: 'string', required: false, description: 'Timezone string' },
        ],
      },

      // Components/Features - Not Implemented
      {
        id: 'get-component-list',
        name: 'Get Component List',
        description: 'Get list of supported components/features for the device',
        method: 'GET',
        endpoint: 'component_nego',
        implemented: false,
        category: 'Device Info',
      },

      // Raw Command - Not Implemented
      {
        id: 'send-raw-command',
        name: 'Send Raw Command',
        description: 'Send a raw command to the device (advanced use)',
        method: 'POST',
        endpoint: 'securePassthrough',
        implemented: false,
        category: 'Advanced',
        parameters: [
          { name: 'method', type: 'string', required: true, description: 'API method name' },
          { name: 'params', type: 'object', required: false, description: 'Method parameters' },
        ],
      },

      // Thermostatic Radiator Valve (KE100) - Not Implemented
      {
        id: 'get-trv-info',
        name: 'Get TRV Info',
        description: 'Get thermostatic radiator valve (KE100) information',
        method: 'GET',
        endpoint: 'get_device_info',
        implemented: false,
        category: 'Climate Control',
      },
      {
        id: 'set-target-temp',
        name: 'Set Target Temperature',
        description: 'Set target temperature for TRV',
        method: 'POST',
        endpoint: 'set_temp',
        implemented: false,
        category: 'Climate Control',
        parameters: [
          { name: 'target_temp', type: 'number', required: true, description: 'Target temperature in Celsius' },
        ],
      },
      {
        id: 'set-frost-protection',
        name: 'Set Frost Protection',
        description: 'Enable/disable frost protection mode on TRV',
        method: 'POST',
        endpoint: 'set_frost_protection',
        implemented: false,
        category: 'Climate Control',
        parameters: [
          { name: 'enabled', type: 'boolean', required: true, description: 'Enable frost protection' },
        ],
      },

      // Smart Switch (S200B/S200D) - Not Implemented
      {
        id: 'get-button-logs',
        name: 'Get Button Logs',
        description: 'Get button press event logs from smart switches (S200B/S200D)',
        method: 'GET',
        endpoint: 'get_button_logs',
        implemented: false,
        category: 'Smart Switch',
      },
    ];
  }
}
