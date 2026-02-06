import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  GLKVMConfig,
  PiKVMInfo,
  PiKVMAtx,
  PiKVMMsd,
  PiKVMStreamer,
} from '../types';
import { logger } from '../services/logger';

export class GLKVMIntegration extends BaseIntegration {
  readonly type = 'glkvm';
  readonly name = 'GL.iNet KVM';

  private createClient(config: GLKVMConfig): AxiosInstance {
    // GL-RM1 uses HTTPS by default with self-signed certs (same as PiKVM)
    const baseURL = `https://${config.host}:${config.port || 443}`;

    return axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      headers: {
        'X-KVMD-User': config.username,
        'X-KVMD-Passwd': config.password,
        'Accept': 'application/json',
      },
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const glkvmConfig = config as GLKVMConfig;

    try {
      const client = this.createClient(glkvmConfig);
      const response = await client.get('/api/info');
      const info = response.data.result as PiKVMInfo;

      const version = info.system?.kvmd?.version || 'unknown';
      const platform = info.hw?.platform || 'unknown';

      return {
        success: true,
        message: `Connected to GL.iNet KVM v${version} (${typeof platform === 'string' ? platform : 'GL-RM1'})`,
        details: {
          version,
          platform,
          type: info.hw?.type,
        },
      };
    } catch (error) {
      let errorMsg = error instanceof Error ? error.message : String(error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          errorMsg = `HTTP ${status}`;
          if (data?.error) {
            errorMsg += `: ${data.error}`;
          } else if (typeof data === 'string' && data.length < 200) {
            errorMsg += `: ${data}`;
          }

          // Add helpful hints based on status code
          if (status === 404) {
            errorMsg += ' - PiKVM interface not enabled. Edit /etc/kvmd/nginx-kvmd.conf to enable port 8888';
          } else if (status === 403) {
            errorMsg += ' - Invalid credentials. Run "kvmd-htpasswd set admin" on the device to set the password';
          }

          logger.error('glkvm', 'Connection test failed', {
            error: errorMsg,
            status,
            responseData: data,
          });
        } else if (error.code) {
          errorMsg = `${error.code}: ${error.message}`;
          logger.error('glkvm', 'Connection test failed', { error: errorMsg, code: error.code });
        }
      } else {
        logger.error('glkvm', 'Connection test failed', { error: errorMsg });
      }

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const glkvmConfig = config as GLKVMConfig;
    const client = this.createClient(glkvmConfig);

    switch (metric) {
      case 'info':
        return this.getInfo(client);
      case 'atx':
        return this.getAtx(client);
      case 'msd':
        return this.getMsd(client);
      case 'streamer':
        return this.getStreamer(client);
      case 'snapshot':
        return this.getSnapshot(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getInfo(client: AxiosInstance): Promise<{ info: PiKVMInfo }> {
    try {
      const response = await client.get('/api/info');
      const info = response.data.result as PiKVMInfo;
      logger.debug('glkvm', 'Fetched info', {
        version: info.system?.kvmd?.version,
      });
      return { info };
    } catch (error) {
      logger.error('glkvm', 'Failed to fetch info', { error: String(error) });
      throw error;
    }
  }

  private async getAtx(client: AxiosInstance): Promise<{ atx: PiKVMAtx }> {
    try {
      const response = await client.get('/api/atx');
      const atx = response.data.result as PiKVMAtx;
      logger.debug('glkvm', 'Fetched ATX state', {
        enabled: atx.enabled,
        busy: atx.busy,
        leds: atx.leds,
        rawResult: JSON.stringify(response.data.result).substring(0, 200),
      });
      return { atx };
    } catch (error) {
      logger.error('glkvm', 'Failed to fetch ATX state', { error: String(error) });
      throw error;
    }
  }

  private async getMsd(client: AxiosInstance): Promise<{ msd: PiKVMMsd }> {
    try {
      const response = await client.get('/api/msd');
      const msd = response.data.result as PiKVMMsd;
      logger.debug('glkvm', 'Fetched MSD state', { enabled: msd.enabled, connected: msd.drive?.connected });
      return { msd };
    } catch (error) {
      logger.error('glkvm', 'Failed to fetch MSD state', { error: String(error) });
      throw error;
    }
  }

  private async getStreamer(client: AxiosInstance): Promise<{ streamer: PiKVMStreamer }> {
    try {
      const response = await client.get('/api/streamer');
      const result = response.data.result;

      const streamerData = result?.streamer || result;

      logger.debug('glkvm', 'Fetched streamer state', {
        online: streamerData?.source?.online,
        clients: streamerData?.stream?.clients,
      });

      const streamer: PiKVMStreamer = {
        enabled: true,
        features: result?.features,
        params: result?.params,
        source: streamerData?.source,
        stream: streamerData?.stream,
        snapshot: result?.snapshot,
      };

      return { streamer };
    } catch (error) {
      logger.error('glkvm', 'Failed to fetch streamer state', { error: String(error) });
      throw error;
    }
  }

  private async getSnapshot(client: AxiosInstance): Promise<{ snapshot: string }> {
    try {
      // GL-RM1 snapshot endpoint - doesn't support preview params like PiKVM
      const response = await client.get('/api/streamer/snapshot', {
        responseType: 'arraybuffer',
      });

      const dataLength = response.data.length;
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const dataBuffer = Buffer.from(response.data);

      // Check for valid JPEG magic bytes (FFD8FF)
      const isJpeg = dataBuffer.length >= 3 &&
        dataBuffer[0] === 0xFF && dataBuffer[1] === 0xD8 && dataBuffer[2] === 0xFF;

      // Check if response is too small or not a valid JPEG
      if (dataLength < 1000 || !isJpeg) {
        // Check if it's H.264 data (starts with NAL start code 00 00 00 01)
        const isH264 = dataBuffer.length >= 4 &&
          dataBuffer[0] === 0x00 && dataBuffer[1] === 0x00 &&
          dataBuffer[2] === 0x00 && dataBuffer[3] === 0x01;

        if (isH264) {
          logger.warn('glkvm', 'Snapshot returned H.264 video data instead of JPEG', {
            size: dataLength,
            note: 'GL-RM1 may not support JPEG snapshots or video source is not ready',
          });
          throw new Error('Snapshot not available - device returned video stream data instead of JPEG. Try refreshing or check video source.');
        }

        // Try to parse as text to see if it's an error message
        const textContent = dataBuffer.toString('utf-8');
        logger.warn('glkvm', 'Snapshot response too small or invalid', {
          size: dataLength,
          contentType,
          isJpeg,
          content: textContent.substring(0, 200),
        });

        if (textContent.includes('"ok"') || textContent.includes('"error"')) {
          throw new Error(`Snapshot error: ${textContent}`);
        }
      }

      const base64 = dataBuffer.toString('base64');
      const snapshot = `data:${contentType};base64,${base64}`;

      logger.debug('glkvm', 'Fetched snapshot', { size: dataLength, contentType, isJpeg });
      return { snapshot };
    } catch (error) {
      logger.error('glkvm', 'Failed to fetch snapshot', { error: String(error) });
      throw error;
    }
  }

  // Action methods for power control
  async performAction(config: IntegrationConfig, action: string, params?: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const glkvmConfig = config as GLKVMConfig;
    const client = this.createClient(glkvmConfig);

    try {
      switch (action) {
        case 'power_on':
          await client.post('/api/atx/power', null, { params: { action: 'on' } });
          return { success: true, message: 'Power on command sent' };

        case 'power_off':
          await client.post('/api/atx/power', null, { params: { action: 'off' } });
          return { success: true, message: 'Power off command sent' };

        case 'power_off_hard':
          await client.post('/api/atx/power', null, { params: { action: 'off_hard' } });
          return { success: true, message: 'Force power off command sent' };

        case 'reset_hard':
          await client.post('/api/atx/power', null, { params: { action: 'reset_hard' } });
          return { success: true, message: 'Hard reset command sent' };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('glkvm', `Action ${action} failed`, { error: errorMsg });
      return { success: false, message: `Action failed: ${errorMsg}` };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'info',
        name: 'System Info',
        description: 'GL.iNet KVM hardware and software information',
        widgetTypes: ['glkvm-system-info'],
      },
      {
        id: 'atx',
        name: 'ATX Power',
        description: 'ATX power state and LED status',
        widgetTypes: ['glkvm-power-status', 'glkvm-power-control'],
      },
      {
        id: 'msd',
        name: 'Mass Storage',
        description: 'Mass storage drive state and mounted images',
        widgetTypes: ['glkvm-msd-status'],
      },
      {
        id: 'streamer',
        name: 'Video Streamer',
        description: 'Video capture status, resolution, and clients',
        widgetTypes: ['glkvm-streamer-status'],
      },
      {
        id: 'snapshot',
        name: 'Snapshot',
        description: 'Live screenshot of target system',
        widgetTypes: ['glkvm-snapshot'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication
      {
        id: 'auth-login',
        name: 'Login',
        description: 'Obtain session token via credentials',
        method: 'POST',
        endpoint: '/api/auth/login',
        implemented: false,
        category: 'Authentication',
        parameters: [
          { name: 'user', type: 'string', required: true, description: 'Username' },
          { name: 'passwd', type: 'string', required: true, description: 'Password' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'auth-check',
        name: 'Check Auth',
        description: 'Verify authentication status',
        method: 'GET',
        endpoint: '/api/auth/check',
        implemented: false,
        category: 'Authentication',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // System
      {
        id: 'info',
        name: 'Get System Info',
        description: 'Returns general information about the GL.iNet KVM device',
        method: 'GET',
        endpoint: '/api/info',
        implemented: true,
        category: 'System',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'log',
        name: 'Get System Log',
        description: 'Retrieve service logs',
        method: 'GET',
        endpoint: '/api/log',
        implemented: false,
        category: 'System',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // ATX Power Control
      {
        id: 'atx-state',
        name: 'Get ATX State',
        description: 'Get current ATX power state and LED indicators',
        method: 'GET',
        endpoint: '/api/atx',
        implemented: true,
        category: 'ATX Power Control',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'atx-power',
        name: 'ATX Power Control',
        description: 'Control system power (on, off, off_hard, reset_hard)',
        method: 'POST',
        endpoint: '/api/atx/power',
        implemented: true,
        category: 'ATX Power Control',
        parameters: [
          { name: 'action', type: 'string', required: true, description: 'Power action: on, off, off_hard, reset_hard' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'atx-click',
        name: 'ATX Button Click',
        description: 'Simulate physical button press',
        method: 'POST',
        endpoint: '/api/atx/click',
        implemented: false,
        category: 'ATX Power Control',
        parameters: [
          { name: 'button', type: 'string', required: true, description: 'Button: power, power_long, reset' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // MSD (Mass Storage Device)
      {
        id: 'msd-state',
        name: 'Get MSD State',
        description: 'Get mass storage device state and mounted images',
        method: 'GET',
        endpoint: '/api/msd',
        implemented: true,
        category: 'Mass Storage Device',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'msd-write',
        name: 'Upload Image',
        description: 'Upload an ISO/IMG file to MSD storage',
        method: 'POST',
        endpoint: '/api/msd/write',
        implemented: false,
        category: 'Mass Storage Device',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'msd-set-params',
        name: 'Set MSD Parameters',
        description: 'Configure MSD image selection and access mode',
        method: 'POST',
        endpoint: '/api/msd/set_params',
        implemented: false,
        category: 'Mass Storage Device',
        parameters: [
          { name: 'image', type: 'string', required: false, description: 'Image filename' },
          { name: 'cdrom', type: 'boolean', required: false, description: 'Present as CD-ROM' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'msd-connect',
        name: 'Connect/Disconnect MSD',
        description: 'Mount or unmount the virtual storage device',
        method: 'POST',
        endpoint: '/api/msd/set_connected',
        implemented: false,
        category: 'Mass Storage Device',
        parameters: [
          { name: 'connected', type: 'boolean', required: true, description: 'True to connect' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // HID (Keyboard/Mouse)
      {
        id: 'hid-state',
        name: 'Get HID State',
        description: 'Get keyboard and mouse device state',
        method: 'GET',
        endpoint: '/api/hid',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-print',
        name: 'Type Text',
        description: 'Send typed text to the target system',
        method: 'POST',
        endpoint: '/api/hid/print',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'text', type: 'string', required: true, description: 'Text to type' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-send-shortcut',
        name: 'Send Keyboard Shortcut',
        description: 'Send key combinations (e.g., Ctrl+Alt+Delete)',
        method: 'POST',
        endpoint: '/api/hid/events/send_shortcut',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'keys', type: 'string[]', required: true, description: 'Array of key names' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // Video Streamer
      {
        id: 'streamer-state',
        name: 'Get Streamer State',
        description: 'Get video capture status and resolution',
        method: 'GET',
        endpoint: '/api/streamer',
        implemented: true,
        category: 'Video Streamer',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'streamer-snapshot',
        name: 'Get Snapshot',
        description: 'Capture current video frame as image',
        method: 'GET',
        endpoint: '/api/streamer/snapshot',
        implemented: true,
        category: 'Video Streamer',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // GPIO (for ATX power board)
      {
        id: 'gpio-state',
        name: 'Get GPIO State',
        description: 'Read GPIO pin states (used by ATX power board)',
        method: 'GET',
        endpoint: '/api/gpio',
        implemented: false,
        category: 'GPIO',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'gpio-switch',
        name: 'Toggle GPIO Output',
        description: 'Toggle GPIO output channels',
        method: 'POST',
        endpoint: '/api/gpio/switch',
        implemented: false,
        category: 'GPIO',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'GPIO channel name' },
          { name: 'state', type: 'boolean', required: true, description: 'On/off state' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
    ];
  }
}
