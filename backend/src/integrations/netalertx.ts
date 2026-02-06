import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  NetAlertXConfig,
  NetAlertXDevice,
  NetAlertXDeviceTotals,
  NetAlertXEvent,
  NetAlertXTopology,
  NetAlertXInternetInfo,
  NetAlertXInterface,
  NetAlertXSessionTotals,
} from '../types';
import { logger } from '../services/logger';

export class NetAlertXIntegration extends BaseIntegration {
  readonly type = 'netalertx';
  readonly name = 'NetAlertX';

  private getBaseUrl(config: NetAlertXConfig): string {
    const protocol = config.verifySSL === true ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  private createClient(config: NetAlertXConfig): AxiosInstance {
    return axios.create({
      baseURL: this.getBaseUrl(config),
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const naxConfig = config as NetAlertXConfig;

    if (!naxConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!naxConfig.apiToken) {
      return { success: false, message: 'API token is required' };
    }

    try {
      const client = this.createClient(naxConfig);

      // Test connection by getting device totals
      const response = await client.get('/devices/totals');
      const [all, connected, favorites, newDevices, down, archived] = response.data;

      return {
        success: true,
        message: `Connected to NetAlertX - ${all} devices (${connected} online)`,
        details: {
          totalDevices: all,
          connectedDevices: connected,
          favoriteDevices: favorites,
          newDevices,
          downDevices: down,
          archivedDevices: archived,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('netalertx', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          return { success: false, message: 'Authentication failed: Invalid API token' };
        }
        if (error.code === 'ECONNREFUSED') {
          return { success: false, message: `Connection refused. Is NetAlertX running on ${naxConfig.host}:${naxConfig.port}?` };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
          return { success: false, message: `Cannot reach ${naxConfig.host}:${naxConfig.port}` };
        }
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const naxConfig = config as NetAlertXConfig;
    const client = this.createClient(naxConfig);

    switch (metric) {
      case 'device-totals':
        return this.getDeviceTotals(client);
      case 'devices':
        return this.getDevices(client);
      case 'devices-online':
        return this.getDevicesByStatus(client, 'online');
      case 'devices-offline':
        return this.getDevicesByStatus(client, 'offline');
      case 'devices-down':
        return this.getDevicesByStatus(client, 'down');
      case 'devices-new':
        return this.getDevicesByStatus(client, 'new');
      case 'devices-favorites':
        return this.getDevicesByStatus(client, 'favorites');
      case 'recent-events':
        return this.getRecentEvents(client);
      case 'network-topology':
        return this.getNetworkTopology(client);
      case 'session-stats':
        return this.getSessionStats(client);
      case 'internet-info':
        return this.getInternetInfo(client);
      case 'interfaces':
        return this.getInterfaces(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getDeviceTotals(client: AxiosInstance): Promise<{ totals: NetAlertXDeviceTotals }> {
    try {
      const response = await client.get('/devices/totals');
      const [all, connected, favorites, newDevices, down, archived] = response.data;

      return {
        totals: {
          all,
          connected,
          favorites,
          new: newDevices,
          down,
          archived,
        },
      };
    } catch (error) {
      logger.error('netalertx', 'Failed to get device totals', { error });
      throw error;
    }
  }

  private async getDevices(client: AxiosInstance): Promise<{ devices: NetAlertXDevice[] }> {
    try {
      const response = await client.get('/devices');
      return { devices: response.data };
    } catch (error) {
      logger.error('netalertx', 'Failed to get devices', { error });
      throw error;
    }
  }

  private async getDevicesByStatus(
    client: AxiosInstance,
    status: 'online' | 'offline' | 'down' | 'new' | 'favorites' | 'archived'
  ): Promise<{ devices: NetAlertXDevice[] }> {
    try {
      const response = await client.get('/devices/by-status', { params: { status } });
      return { devices: response.data };
    } catch (error) {
      logger.error('netalertx', `Failed to get ${status} devices`, { error });
      throw error;
    }
  }

  private async getRecentEvents(client: AxiosInstance): Promise<{ events: NetAlertXEvent[] }> {
    try {
      const response = await client.get('/events/recent');
      return { events: response.data };
    } catch (error) {
      logger.error('netalertx', 'Failed to get recent events', { error });
      throw error;
    }
  }

  private async getNetworkTopology(client: AxiosInstance): Promise<{ topology: NetAlertXTopology }> {
    try {
      const response = await client.get('/devices/network/topology');
      return { topology: response.data };
    } catch (error) {
      logger.error('netalertx', 'Failed to get network topology', { error });
      throw error;
    }
  }

  private async getSessionStats(client: AxiosInstance): Promise<{ stats: NetAlertXSessionTotals }> {
    try {
      const response = await client.get('/sessions/totals', { params: { period: '7 days' } });
      const [total, sessions, missing, voided, newDevices, down] = response.data;

      return {
        stats: {
          total,
          sessions,
          missing,
          voided,
          newDevices,
          down,
        },
      };
    } catch (error) {
      logger.error('netalertx', 'Failed to get session stats', { error });
      throw error;
    }
  }

  private async getInternetInfo(client: AxiosInstance): Promise<{ info: NetAlertXInternetInfo }> {
    try {
      const response = await client.get('/nettools/internetinfo');
      return { info: response.data.output || response.data };
    } catch (error) {
      logger.error('netalertx', 'Failed to get internet info', { error });
      throw error;
    }
  }

  private async getInterfaces(client: AxiosInstance): Promise<{ interfaces: NetAlertXInterface[] }> {
    try {
      const response = await client.get('/nettools/interfaces');
      return { interfaces: response.data.interfaces || response.data };
    } catch (error) {
      logger.error('netalertx', 'Failed to get interfaces', { error });
      throw error;
    }
  }

  // Wake-on-LAN action
  async wakeOnLan(
    config: IntegrationConfig,
    mac: string
  ): Promise<{ success: boolean; output: string }> {
    const naxConfig = config as NetAlertXConfig;
    const client = this.createClient(naxConfig);

    try {
      const response = await client.post('/nettools/wakeonlan', { devMac: mac });
      logger.debug('netalertx', `Wake-on-LAN sent to ${mac}`);
      return response.data;
    } catch (error) {
      logger.error('netalertx', 'Wake-on-LAN failed', { error, mac });
      throw error;
    }
  }

  // Perform action (used by routes/integrations.ts action endpoint)
  async performAction(
    config: IntegrationConfig,
    action: string,
    params: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; message?: string }> {
    try {
      switch (action) {
        case 'wakeOnLan': {
          const { mac } = params as { mac: string };
          if (!mac) {
            return { success: false, message: 'MAC address is required' };
          }
          const result = await this.wakeOnLan(config, mac);
          return { success: result.success, data: result, message: result.output };
        }
        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, message: errorMsg };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'device-totals',
        name: 'Device Totals',
        description: 'Summary counts of all devices by status',
        widgetTypes: ['netalertx-device-overview'],
      },
      {
        id: 'devices',
        name: 'All Devices',
        description: 'List of all network devices',
        widgetTypes: ['netalertx-device-list'],
      },
      {
        id: 'devices-online',
        name: 'Online Devices',
        description: 'Devices currently online',
        widgetTypes: ['netalertx-device-list'],
      },
      {
        id: 'devices-offline',
        name: 'Offline Devices',
        description: 'Devices currently offline',
        widgetTypes: ['netalertx-device-list'],
      },
      {
        id: 'devices-down',
        name: 'Down Devices',
        description: 'Devices marked as down',
        widgetTypes: ['netalertx-device-list'],
      },
      {
        id: 'devices-new',
        name: 'New Devices',
        description: 'Recently discovered devices',
        widgetTypes: ['netalertx-device-list'],
      },
      {
        id: 'devices-favorites',
        name: 'Favorite Devices',
        description: 'User-marked favorite devices',
        widgetTypes: ['netalertx-device-list'],
      },
      {
        id: 'recent-events',
        name: 'Recent Events',
        description: 'Network events from the last 24 hours',
        widgetTypes: ['netalertx-recent-events'],
      },
      {
        id: 'network-topology',
        name: 'Network Topology',
        description: 'Visual network device map',
        widgetTypes: ['netalertx-network-topology'],
      },
      {
        id: 'session-stats',
        name: 'Session Statistics',
        description: 'Connection session metrics',
        widgetTypes: ['netalertx-session-stats'],
      },
      {
        id: 'internet-info',
        name: 'Internet Info',
        description: 'Public IP and ISP information',
        widgetTypes: ['netalertx-internet-info'],
      },
      {
        id: 'interfaces',
        name: 'Network Interfaces',
        description: 'Server network interface statistics',
        widgetTypes: ['netalertx-interfaces'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Device Endpoints - Implemented
      {
        id: 'devices-totals',
        name: 'Get Device Totals',
        description: 'Get summary counts of all devices by status (all, connected, favorites, new, down, archived)',
        method: 'GET',
        endpoint: '/devices/totals',
        implemented: true,
        category: 'Devices',
        documentationUrl: 'https://github.com/jokob-sk/NetAlertX/blob/main/docs/API.md',
      },
      {
        id: 'devices-all',
        name: 'Get All Devices',
        description: 'Get list of all network devices with full details',
        method: 'GET',
        endpoint: '/devices',
        implemented: true,
        category: 'Devices',
      },
      {
        id: 'devices-by-status',
        name: 'Get Devices by Status',
        description: 'Get devices filtered by status (online, offline, down, new, favorites, archived)',
        method: 'GET',
        endpoint: '/devices/by-status',
        implemented: true,
        category: 'Devices',
        parameters: [
          { name: 'status', type: 'string', required: true, description: 'Status filter: online, offline, down, new, favorites, archived' },
        ],
      },
      {
        id: 'device-get',
        name: 'Get Device Details',
        description: 'Fetch all details for a single device by MAC address, including computed status, session and event counts',
        method: 'GET',
        endpoint: '/device/<mac>',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Device MAC address (use "new" for template)' },
        ],
      },
      {
        id: 'device-create-update',
        name: 'Create or Update Device',
        description: 'Create a new device record or update an existing one',
        method: 'POST',
        endpoint: '/device/<mac>',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Device MAC address' },
        ],
      },
      {
        id: 'device-delete',
        name: 'Delete Device',
        description: 'Delete a device from the database',
        method: 'DELETE',
        endpoint: '/device/<mac>/delete',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Device MAC address' },
        ],
      },
      {
        id: 'device-reset-props',
        name: 'Reset Device Properties',
        description: 'Reset a device\'s custom properties to default values',
        method: 'POST',
        endpoint: '/device/<mac>/reset-props',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Device MAC address' },
        ],
      },
      {
        id: 'device-copy',
        name: 'Copy Device Data',
        description: 'Copy data from one device to another',
        method: 'POST',
        endpoint: '/device/<mac>/copy/<target_mac>',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Source device MAC address' },
          { name: 'target_mac', type: 'string', required: true, description: 'Target device MAC address' },
        ],
      },

      // Network Topology - Implemented
      {
        id: 'network-topology',
        name: 'Get Network Topology',
        description: 'Get visual network device map with parent-child relationships',
        method: 'GET',
        endpoint: '/devices/network/topology',
        implemented: true,
        category: 'Network',
      },

      // Events Endpoints - Partially Implemented
      {
        id: 'events-recent',
        name: 'Get Recent Events',
        description: 'Get network events from the last 24 hours',
        method: 'GET',
        endpoint: '/events/recent',
        implemented: true,
        category: 'Events',
      },
      {
        id: 'events-all',
        name: 'Get All Events',
        description: 'Get all events with pagination and filtering options',
        method: 'GET',
        endpoint: '/events',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'limit', type: 'number', required: false, description: 'Maximum number of events to return' },
          { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
          { name: 'type', type: 'string', required: false, description: 'Event type filter' },
        ],
      },
      {
        id: 'events-by-device',
        name: 'Get Device Events',
        description: 'Get all events for a specific device',
        method: 'GET',
        endpoint: '/events/device/<mac>',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Device MAC address' },
        ],
      },
      {
        id: 'device-events-delete',
        name: 'Delete Device Events',
        description: 'Remove all events associated with a device',
        method: 'DELETE',
        endpoint: '/device/<mac>/events/delete',
        implemented: false,
        category: 'Events',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Device MAC address' },
        ],
      },

      // Sessions Endpoints - Implemented
      {
        id: 'sessions-totals',
        name: 'Get Session Totals',
        description: 'Get connection session statistics for a time period',
        method: 'GET',
        endpoint: '/sessions/totals',
        implemented: true,
        category: 'Sessions',
        parameters: [
          { name: 'period', type: 'string', required: false, description: 'Time period (e.g., "7 days")' },
        ],
      },
      {
        id: 'sessions-all',
        name: 'Get All Sessions',
        description: 'Get all session records',
        method: 'GET',
        endpoint: '/sessions',
        implemented: false,
        category: 'Sessions',
      },
      {
        id: 'sessions-by-device',
        name: 'Get Device Sessions',
        description: 'Get session history for a specific device',
        method: 'GET',
        endpoint: '/sessions/device/<mac>',
        implemented: false,
        category: 'Sessions',
        parameters: [
          { name: 'mac', type: 'string', required: true, description: 'Device MAC address' },
        ],
      },

      // Network Tools - Partially Implemented
      {
        id: 'nettools-internet-info',
        name: 'Get Internet Info',
        description: 'Get public IP address and ISP information',
        method: 'GET',
        endpoint: '/nettools/internetinfo',
        implemented: true,
        category: 'Network Tools',
      },
      {
        id: 'nettools-interfaces',
        name: 'Get Network Interfaces',
        description: 'Get server network interface statistics',
        method: 'GET',
        endpoint: '/nettools/interfaces',
        implemented: true,
        category: 'Network Tools',
      },
      {
        id: 'nettools-wake-on-lan',
        name: 'Wake on LAN',
        description: 'Send Wake-on-LAN magic packet to a device',
        method: 'POST',
        endpoint: '/nettools/wakeonlan',
        implemented: true,
        category: 'Network Tools',
        parameters: [
          { name: 'devMac', type: 'string', required: true, description: 'Target device MAC address' },
        ],
      },
      {
        id: 'nettools-ping',
        name: 'Ping Host',
        description: 'Ping a host by IP address or hostname',
        method: 'POST',
        endpoint: '/nettools/ping',
        implemented: false,
        category: 'Network Tools',
        parameters: [
          { name: 'host', type: 'string', required: true, description: 'IP address or hostname to ping' },
        ],
      },
      {
        id: 'nettools-arp',
        name: 'ARP Scan',
        description: 'Perform ARP scan on a subnet',
        method: 'POST',
        endpoint: '/nettools/arp',
        implemented: false,
        category: 'Network Tools',
        parameters: [
          { name: 'subnet', type: 'string', required: false, description: 'Subnet to scan' },
        ],
      },
      {
        id: 'nettools-nmap',
        name: 'Nmap Scan',
        description: 'Run nmap scan on a target',
        method: 'POST',
        endpoint: '/nettools/nmap',
        implemented: false,
        category: 'Network Tools',
        parameters: [
          { name: 'target', type: 'string', required: true, description: 'Target IP or range' },
          { name: 'options', type: 'string', required: false, description: 'Additional nmap options' },
        ],
      },
      {
        id: 'nettools-dns-lookup',
        name: 'DNS Lookup',
        description: 'Perform DNS lookup for a hostname',
        method: 'POST',
        endpoint: '/nettools/dns',
        implemented: false,
        category: 'Network Tools',
        parameters: [
          { name: 'host', type: 'string', required: true, description: 'Hostname to look up' },
        ],
      },

      // Settings & Configuration
      {
        id: 'settings-get',
        name: 'Get Settings',
        description: 'Get application settings',
        method: 'GET',
        endpoint: '/settings',
        implemented: false,
        category: 'Settings',
      },
      {
        id: 'settings-update',
        name: 'Update Settings',
        description: 'Update application settings',
        method: 'POST',
        endpoint: '/settings',
        implemented: false,
        category: 'Settings',
      },

      // Plugins
      {
        id: 'plugins-list',
        name: 'List Plugins',
        description: 'Get list of installed plugins and their status',
        method: 'GET',
        endpoint: '/plugins',
        implemented: false,
        category: 'Plugins',
      },
      {
        id: 'plugins-run',
        name: 'Run Plugin',
        description: 'Trigger a plugin scan manually',
        method: 'POST',
        endpoint: '/plugins/<plugin_id>/run',
        implemented: false,
        category: 'Plugins',
        parameters: [
          { name: 'plugin_id', type: 'string', required: true, description: 'Plugin identifier' },
        ],
      },

      // Sync
      {
        id: 'sync-status',
        name: 'Get Sync Status',
        description: 'Get multi-instance sync hub status',
        method: 'GET',
        endpoint: '/sync/status',
        implemented: false,
        category: 'Sync',
      },
      {
        id: 'sync-push',
        name: 'Push Sync Data',
        description: 'Push device data to sync hub',
        method: 'POST',
        endpoint: '/sync/push',
        implemented: false,
        category: 'Sync',
      },
      {
        id: 'sync-pull',
        name: 'Pull Sync Data',
        description: 'Pull device data from sync hub',
        method: 'POST',
        endpoint: '/sync/pull',
        implemented: false,
        category: 'Sync',
      },

      // Metrics & Monitoring
      {
        id: 'metrics-prometheus',
        name: 'Prometheus Metrics',
        description: 'Get Prometheus-compatible metrics for monitoring',
        method: 'GET',
        endpoint: '/metrics',
        implemented: false,
        category: 'Monitoring',
        documentationUrl: 'https://github.com/jokob-sk/NetAlertX/blob/main/docs/API.md',
      },

      // Notifications
      {
        id: 'notifications-list',
        name: 'Get Notifications',
        description: 'Get pending notifications',
        method: 'GET',
        endpoint: '/notifications',
        implemented: false,
        category: 'Notifications',
      },
      {
        id: 'notifications-dismiss',
        name: 'Dismiss Notification',
        description: 'Dismiss a notification',
        method: 'POST',
        endpoint: '/notifications/<id>/dismiss',
        implemented: false,
        category: 'Notifications',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Notification ID' },
        ],
      },

      // Database Operations
      {
        id: 'db-backup',
        name: 'Database Backup',
        description: 'Create a database backup',
        method: 'POST',
        endpoint: '/db/backup',
        implemented: false,
        category: 'Database',
      },
      {
        id: 'db-restore',
        name: 'Database Restore',
        description: 'Restore database from backup',
        method: 'POST',
        endpoint: '/db/restore',
        implemented: false,
        category: 'Database',
      },
      {
        id: 'db-maintenance',
        name: 'Database Maintenance',
        description: 'Run database maintenance and cleanup tasks',
        method: 'POST',
        endpoint: '/db/maintenance',
        implemented: false,
        category: 'Database',
      },

      // GraphQL
      {
        id: 'graphql',
        name: 'GraphQL Endpoint',
        description: 'Execute GraphQL queries for flexible data retrieval',
        method: 'POST',
        endpoint: '/graphql',
        implemented: false,
        category: 'GraphQL',
        documentationUrl: 'https://github.com/jokob-sk/NetAlertX/blob/main/docs/API.md',
      },
    ];
  }
}
