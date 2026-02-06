import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  PiKVMConfig,
  PiKVMInfo,
  PiKVMAtx,
  PiKVMMsd,
  PiKVMStreamer,
} from '../types';
import { logger } from '../services/logger';

export class PiKVMIntegration extends BaseIntegration {
  readonly type = 'pikvm';
  readonly name = 'PiKVM';

  private createClient(config: PiKVMConfig): AxiosInstance {
    // PiKVM uses HTTPS by default with self-signed certs
    // verifySSL controls certificate verification, not protocol
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
    const pikvmConfig = config as PiKVMConfig;

    try {
      const client = this.createClient(pikvmConfig);
      const response = await client.get('/api/info');
      const info = response.data.result as PiKVMInfo;

      const version = info.system?.kvmd?.version || 'unknown';
      const platform = info.hw?.platform || 'unknown';

      return {
        success: true,
        message: `Connected to PiKVM v${version} (${platform})`,
        details: {
          version,
          platform,
          type: info.hw?.type,
        },
      };
    } catch (error) {
      let errorMsg = error instanceof Error ? error.message : String(error);

      // Extract more detailed error info from axios errors
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with error status
          const status = error.response.status;
          const data = error.response.data;
          errorMsg = `HTTP ${status}`;
          if (data?.error) {
            errorMsg += `: ${data.error}`;
          } else if (typeof data === 'string' && data.length < 200) {
            errorMsg += `: ${data}`;
          }
          logger.error('pikvm', 'Connection test failed', {
            error: errorMsg,
            status,
            responseData: data,
          });
        } else if (error.code) {
          errorMsg = `${error.code}: ${error.message}`;
          logger.error('pikvm', 'Connection test failed', { error: errorMsg, code: error.code });
        }
      } else {
        logger.error('pikvm', 'Connection test failed', { error: errorMsg });
      }

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const pikvmConfig = config as PiKVMConfig;
    const client = this.createClient(pikvmConfig);

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
      logger.debug('pikvm', 'Fetched info', {
        version: info.system?.kvmd?.version,
        rawKeys: Object.keys(info || {}),
        hwKeys: Object.keys(info?.hw || {}),
        platformKeys: Object.keys(info?.hw?.platform || {}),
        platformType: typeof info?.hw?.platform,
        systemKeys: Object.keys(info?.system || {}),
        metaKeys: Object.keys(info?.meta || {}),
      });
      return { info };
    } catch (error) {
      logger.error('pikvm', 'Failed to fetch info', { error: String(error) });
      throw error;
    }
  }

  private async getAtx(client: AxiosInstance): Promise<{ atx: PiKVMAtx }> {
    try {
      const response = await client.get('/api/atx');
      const atx = response.data.result as PiKVMAtx;
      logger.debug('pikvm', 'Fetched ATX state', { power: atx.leds?.power });
      return { atx };
    } catch (error) {
      logger.error('pikvm', 'Failed to fetch ATX state', { error: String(error) });
      throw error;
    }
  }

  private async getMsd(client: AxiosInstance): Promise<{ msd: PiKVMMsd }> {
    try {
      const response = await client.get('/api/msd');
      const msd = response.data.result as PiKVMMsd;
      logger.debug('pikvm', 'Fetched MSD state', { enabled: msd.enabled, connected: msd.drive?.connected });
      return { msd };
    } catch (error) {
      logger.error('pikvm', 'Failed to fetch MSD state', { error: String(error) });
      throw error;
    }
  }

  private async getStreamer(client: AxiosInstance): Promise<{ streamer: PiKVMStreamer }> {
    try {
      const response = await client.get('/api/streamer');
      const result = response.data.result;

      // PiKVM streamer API returns: {features, limits, params, snapshot, streamer}
      // The actual streamer state is in result.streamer
      const streamerData = result?.streamer || result;

      logger.debug('pikvm', 'Fetched streamer state', {
        rawKeys: Object.keys(result || {}),
        streamerKeys: Object.keys(streamerData || {}),
        online: streamerData?.source?.online,
        clients: streamerData?.stream?.clients,
      });

      // Build a combined streamer object with all relevant data
      const streamer: PiKVMStreamer = {
        // The streamer is "enabled" if we got valid data
        enabled: true,
        features: result?.features,
        params: result?.params,
        source: streamerData?.source,
        stream: streamerData?.stream,
        snapshot: result?.snapshot,
      };

      return { streamer };
    } catch (error) {
      logger.error('pikvm', 'Failed to fetch streamer state', { error: String(error) });
      throw error;
    }
  }

  private async getSnapshot(client: AxiosInstance): Promise<{ snapshot: string }> {
    try {
      const response = await client.get('/api/streamer/snapshot', {
        responseType: 'arraybuffer',
      });

      // Convert to base64 data URL
      const base64 = Buffer.from(response.data).toString('base64');
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const snapshot = `data:${contentType};base64,${base64}`;

      logger.debug('pikvm', 'Fetched snapshot', { size: response.data.length });
      return { snapshot };
    } catch (error) {
      logger.error('pikvm', 'Failed to fetch snapshot', { error: String(error) });
      throw error;
    }
  }

  // Action methods for power control
  async performAction(config: IntegrationConfig, action: string, params?: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const pikvmConfig = config as PiKVMConfig;
    const client = this.createClient(pikvmConfig);

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
      logger.error('pikvm', `Action ${action} failed`, { error: errorMsg });
      return { success: false, message: `Action failed: ${errorMsg}` };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'info',
        name: 'System Info',
        description: 'PiKVM hardware and software information',
        widgetTypes: ['pikvm-system-info'],
      },
      {
        id: 'atx',
        name: 'ATX Power',
        description: 'ATX power state and LED status',
        widgetTypes: ['pikvm-power-status', 'pikvm-power-control'],
      },
      {
        id: 'msd',
        name: 'Mass Storage',
        description: 'Mass storage drive state and mounted images',
        widgetTypes: ['pikvm-msd-status'],
      },
      {
        id: 'streamer',
        name: 'Video Streamer',
        description: 'Video capture status, resolution, and clients',
        widgetTypes: ['pikvm-streamer-status'],
      },
      {
        id: 'snapshot',
        name: 'Snapshot',
        description: 'Live screenshot of target system',
        widgetTypes: ['pikvm-snapshot'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Authentication - Not Implemented
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
      {
        id: 'auth-logout',
        name: 'Logout',
        description: 'Invalidate session token',
        method: 'POST',
        endpoint: '/api/auth/logout',
        implemented: false,
        category: 'Authentication',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // System - Implemented
      {
        id: 'info',
        name: 'Get System Info',
        description: 'Returns general information about the PiKVM device including hardware, software versions, and system state',
        method: 'GET',
        endpoint: '/api/info',
        implemented: true,
        category: 'System',
        parameters: [
          { name: 'fields', type: 'string', required: false, description: 'Comma-separated list of fields to return' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'log',
        name: 'Get System Log',
        description: 'Retrieve service logs with long-polling support',
        method: 'GET',
        endpoint: '/api/log',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'follow', type: 'boolean', required: false, description: 'Enable long-polling for real-time logs' },
          { name: 'seek', type: 'number', required: false, description: 'Start position in log' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // ATX Power Control - Implemented
      {
        id: 'atx-state',
        name: 'Get ATX State',
        description: 'Get current ATX power state and LED indicators (power, HDD)',
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
        description: 'Simulate physical button press (power, reset)',
        method: 'POST',
        endpoint: '/api/atx/click',
        implemented: false,
        category: 'ATX Power Control',
        parameters: [
          { name: 'button', type: 'string', required: true, description: 'Button to press: power, power_long, reset' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // MSD (Mass Storage Device) - Partially Implemented
      {
        id: 'msd-state',
        name: 'Get MSD State',
        description: 'Get mass storage device state, connected images, and available storage',
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
        parameters: [
          { name: 'image', type: 'file', required: true, description: 'Image file to upload' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'msd-write-remote',
        name: 'Upload Image from URL',
        description: 'Download and store an image from HTTP(S) URL',
        method: 'POST',
        endpoint: '/api/msd/write_remote',
        implemented: false,
        category: 'Mass Storage Device',
        parameters: [
          { name: 'url', type: 'string', required: true, description: 'URL of the image to download' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'msd-set-params',
        name: 'Set MSD Parameters',
        description: 'Configure MSD image selection and access mode (read-only/read-write)',
        method: 'POST',
        endpoint: '/api/msd/set_params',
        implemented: false,
        category: 'Mass Storage Device',
        parameters: [
          { name: 'image', type: 'string', required: false, description: 'Image filename to select' },
          { name: 'cdrom', type: 'boolean', required: false, description: 'Present as CD-ROM device' },
          { name: 'rw', type: 'boolean', required: false, description: 'Enable read-write mode' },
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
          { name: 'connected', type: 'boolean', required: true, description: 'True to connect, false to disconnect' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'msd-remove',
        name: 'Remove Image',
        description: 'Delete a stored image from MSD',
        method: 'POST',
        endpoint: '/api/msd/remove',
        implemented: false,
        category: 'Mass Storage Device',
        parameters: [
          { name: 'image', type: 'string', required: true, description: 'Image filename to delete' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'msd-reset',
        name: 'Reset MSD',
        description: 'Reset MSD to default configuration',
        method: 'POST',
        endpoint: '/api/msd/reset',
        implemented: false,
        category: 'Mass Storage Device',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // HID (Human Interface Device) - Not Implemented
      {
        id: 'hid-state',
        name: 'Get HID State',
        description: 'Get keyboard and mouse device connection state and capabilities',
        method: 'GET',
        endpoint: '/api/hid',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-set-params',
        name: 'Set HID Parameters',
        description: 'Configure keyboard/mouse output types and jiggler',
        method: 'POST',
        endpoint: '/api/hid/set_params',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'keyboard.output', type: 'string', required: false, description: 'Keyboard output type: usb, ps2, disabled' },
          { name: 'mouse.output', type: 'string', required: false, description: 'Mouse output type: usb, ps2, disabled' },
          { name: 'jiggler', type: 'boolean', required: false, description: 'Enable mouse jiggler' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-set-connected',
        name: 'Toggle HID Connection',
        description: 'Connect or disconnect HID devices',
        method: 'POST',
        endpoint: '/api/hid/set_connected',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'connected', type: 'boolean', required: true, description: 'True to connect, false to disconnect' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-reset',
        name: 'Reset HID',
        description: 'Reset HID devices to initial state',
        method: 'POST',
        endpoint: '/api/hid/reset',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-keymaps',
        name: 'List Keymaps',
        description: 'Get available keyboard layout mappings',
        method: 'GET',
        endpoint: '/api/hid/keymaps',
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
          { name: 'keymap', type: 'string', required: false, description: 'Keyboard layout to use' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum characters per second' },
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
          { name: 'keys', type: 'string[]', required: true, description: 'Array of key names to press simultaneously' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-send-key',
        name: 'Send Key Event',
        description: 'Send single key press/release event',
        method: 'POST',
        endpoint: '/api/hid/events/send_key',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'key', type: 'string', required: true, description: 'Key name' },
          { name: 'state', type: 'boolean', required: true, description: 'True for press, false for release' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-send-mouse-button',
        name: 'Send Mouse Button',
        description: 'Send mouse button click events',
        method: 'POST',
        endpoint: '/api/hid/events/send_mouse_button',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'button', type: 'string', required: true, description: 'Button: left, right, middle' },
          { name: 'state', type: 'boolean', required: true, description: 'True for press, false for release' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-send-mouse-move',
        name: 'Move Mouse (Absolute)',
        description: 'Move mouse cursor to absolute coordinates',
        method: 'POST',
        endpoint: '/api/hid/events/send_mouse_move',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'to.x', type: 'number', required: true, description: 'X coordinate (0-65535)' },
          { name: 'to.y', type: 'number', required: true, description: 'Y coordinate (0-65535)' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-send-mouse-relative',
        name: 'Move Mouse (Relative)',
        description: 'Move mouse cursor by relative delta',
        method: 'POST',
        endpoint: '/api/hid/events/send_mouse_relative',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'delta.x', type: 'number', required: true, description: 'X delta' },
          { name: 'delta.y', type: 'number', required: true, description: 'Y delta' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'hid-send-mouse-wheel',
        name: 'Send Mouse Wheel',
        description: 'Send mouse scroll wheel events',
        method: 'POST',
        endpoint: '/api/hid/events/send_mouse_wheel',
        implemented: false,
        category: 'HID (Keyboard/Mouse)',
        parameters: [
          { name: 'delta.x', type: 'number', required: false, description: 'Horizontal scroll delta' },
          { name: 'delta.y', type: 'number', required: true, description: 'Vertical scroll delta' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // Video Streamer - Implemented
      {
        id: 'streamer-state',
        name: 'Get Streamer State',
        description: 'Get video capture status, resolution, and connected clients',
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
        parameters: [
          { name: 'ocr', type: 'boolean', required: false, description: 'Include OCR text recognition' },
          { name: 'preview', type: 'boolean', required: false, description: 'Return preview-size image' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'streamer-delete-snapshot',
        name: 'Delete Snapshot',
        description: 'Remove saved screenshot',
        method: 'DELETE',
        endpoint: '/api/streamer/snapshot',
        implemented: false,
        category: 'Video Streamer',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'streamer-ocr',
        name: 'Check OCR Availability',
        description: 'Check if text recognition is available',
        method: 'GET',
        endpoint: '/api/streamer/ocr',
        implemented: false,
        category: 'Video Streamer',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // GPIO - Not Implemented
      {
        id: 'gpio-state',
        name: 'Get GPIO State',
        description: 'Read all GPIO pin states and configurations',
        method: 'GET',
        endpoint: '/api/gpio',
        implemented: false,
        category: 'GPIO',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'gpio-switch',
        name: 'Toggle GPIO Output',
        description: 'Toggle GPIO output channels on/off',
        method: 'POST',
        endpoint: '/api/gpio/switch',
        implemented: false,
        category: 'GPIO',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'GPIO channel name' },
          { name: 'state', type: 'boolean', required: true, description: 'True for on, false for off' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'gpio-pulse',
        name: 'GPIO Pulse',
        description: 'Send brief activation pulse to GPIO output',
        method: 'POST',
        endpoint: '/api/gpio/pulse',
        implemented: false,
        category: 'GPIO',
        parameters: [
          { name: 'channel', type: 'string', required: true, description: 'GPIO channel name' },
          { name: 'delay', type: 'number', required: false, description: 'Pulse duration in seconds' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // PiKVM Switch (Multi-Port KVM) - Not Implemented
      {
        id: 'switch-state',
        name: 'Get Switch State',
        description: 'Get multi-port KVM switch configuration and active port',
        method: 'GET',
        endpoint: '/api/switch',
        implemented: false,
        category: 'KVM Switch',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'switch-set-active',
        name: 'Set Active Port',
        description: 'Switch to a specific KVM port',
        method: 'POST',
        endpoint: '/api/switch/set_active',
        implemented: false,
        category: 'KVM Switch',
        parameters: [
          { name: 'port', type: 'number', required: true, description: 'Port number to activate' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'switch-set-active-prev',
        name: 'Previous Port',
        description: 'Switch to previous KVM port',
        method: 'POST',
        endpoint: '/api/switch/set_active_prev',
        implemented: false,
        category: 'KVM Switch',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'switch-set-active-next',
        name: 'Next Port',
        description: 'Switch to next KVM port',
        method: 'POST',
        endpoint: '/api/switch/set_active_next',
        implemented: false,
        category: 'KVM Switch',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'switch-set-beacon',
        name: 'Set Beacon',
        description: 'Control port indicator lights',
        method: 'POST',
        endpoint: '/api/switch/set_beacon',
        implemented: false,
        category: 'KVM Switch',
        parameters: [
          { name: 'port', type: 'number', required: true, description: 'Port number' },
          { name: 'state', type: 'boolean', required: true, description: 'Beacon on/off' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'switch-set-port-params',
        name: 'Set Port Parameters',
        description: 'Configure EDID and port naming',
        method: 'POST',
        endpoint: '/api/switch/set_port_params',
        implemented: false,
        category: 'KVM Switch',
        parameters: [
          { name: 'port', type: 'number', required: true, description: 'Port number' },
          { name: 'name', type: 'string', required: false, description: 'Port display name' },
          { name: 'edid', type: 'string', required: false, description: 'EDID configuration' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'switch-reset',
        name: 'Reset Switch',
        description: 'Reboot KVM switch device',
        method: 'POST',
        endpoint: '/api/switch/reset',
        implemented: false,
        category: 'KVM Switch',
        parameters: [
          { name: 'bootloader', type: 'boolean', required: false, description: 'Enter bootloader mode' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // Redfish (Industry Standard) - Not Implemented
      {
        id: 'redfish-root',
        name: 'Redfish Service Root',
        description: 'Redfish API service discovery endpoint',
        method: 'GET',
        endpoint: '/api/redfish/v1',
        implemented: false,
        category: 'Redfish API',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'redfish-systems',
        name: 'List Redfish Systems',
        description: 'List managed computer systems',
        method: 'GET',
        endpoint: '/api/redfish/v1/Systems',
        implemented: false,
        category: 'Redfish API',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'redfish-system-info',
        name: 'Get System Info',
        description: 'Get detailed Redfish system information',
        method: 'GET',
        endpoint: '/api/redfish/v1/Systems/0',
        implemented: false,
        category: 'Redfish API',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
      {
        id: 'redfish-system-reset',
        name: 'Redfish Power Control',
        description: 'Control system power via Redfish standard',
        method: 'POST',
        endpoint: '/api/redfish/v1/Systems/0/Actions/ComputerSystem.Reset',
        implemented: false,
        category: 'Redfish API',
        parameters: [
          { name: 'ResetType', type: 'string', required: true, description: 'Reset type: On, ForceOff, GracefulShutdown, GracefulRestart, ForceRestart' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // Prometheus Metrics - Not Implemented
      {
        id: 'prometheus-metrics',
        name: 'Prometheus Metrics',
        description: 'Export monitoring data in Prometheus format',
        method: 'GET',
        endpoint: '/api/export/prometheus/metrics',
        implemented: false,
        category: 'Monitoring',
        documentationUrl: 'https://docs.pikvm.org/api/',
      },

      // WebSocket - Not Implemented
      {
        id: 'websocket',
        name: 'WebSocket Stream',
        description: 'Real-time event stream for state changes and control',
        method: 'GET',
        endpoint: '/api/ws',
        implemented: false,
        category: 'Real-time',
        parameters: [
          { name: 'novideo', type: 'boolean', required: false, description: 'Suppress video stream data' },
        ],
        documentationUrl: 'https://docs.pikvm.org/api/',
      },
    ];
  }
}
