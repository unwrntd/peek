import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  MikroTikConfig,
  MikroTikSystemResource,
  MikroTikIdentity,
  MikroTikRouterboard,
  MikroTikInterface,
  MikroTikWirelessClient,
  MikroTikDHCPLease,
  MikroTikFirewallRule,
  MikroTikConnection,
  MikroTikLogEntry,
  MikroTikRoute,
  MikroTikArpEntry,
} from '../types';
import { logger } from '../services/logger';

export class MikroTikIntegration extends BaseIntegration {
  readonly type = 'mikrotik';
  readonly name = 'MikroTik RouterOS';

  private getBaseUrl(config: MikroTikConfig): string {
    const protocol = config.useSSL !== false ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}/rest`;
  }

  private createClient(config: MikroTikConfig): AxiosInstance {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: config.verifySSL !== false,
    });

    return axios.create({
      baseURL: this.getBaseUrl(config),
      auth: {
        username: config.username,
        password: config.password,
      },
      httpsAgent,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const mtConfig = config as MikroTikConfig;

    if (!mtConfig.host) {
      return { success: false, message: 'Host is required' };
    }
    if (!mtConfig.username) {
      return { success: false, message: 'Username is required' };
    }

    try {
      const client = this.createClient(mtConfig);

      // Get identity and system resources for a comprehensive test
      const [identityRes, resourceRes] = await Promise.all([
        client.get('/system/identity'),
        client.get('/system/resource'),
      ]);

      const identity = identityRes.data as MikroTikIdentity;
      const resource = resourceRes.data as MikroTikSystemResource;

      return {
        success: true,
        message: `Connected to ${identity.name} (${resource['board-name']}, RouterOS ${resource.version})`,
        details: {
          name: identity.name,
          model: resource['board-name'],
          version: resource.version,
          uptime: resource.uptime,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('mikrotik', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return { success: false, message: 'Authentication failed: Invalid username or password' };
        }
        if (error.response?.status === 404) {
          return { success: false, message: 'REST API not found. RouterOS v7.1+ is required.' };
        }
        if (error.code === 'ECONNREFUSED') {
          return { success: false, message: 'Connection refused. Check the host and port.' };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
          return { success: false, message: 'Connection timed out. Check the host address.' };
        }
        if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED') {
          return { success: false, message: 'SSL certificate verification failed. Try disabling SSL verification.' };
        }
      }

      return { success: false, message: `Connection failed: ${errorMsg}` };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const mtConfig = config as MikroTikConfig;
    const client = this.createClient(mtConfig);

    switch (metric) {
      case 'system':
        return this.getSystemData(client);
      case 'interfaces':
        return this.getInterfacesData(client);
      case 'wireless-clients':
        return this.getWirelessClientsData(client);
      case 'dhcp-leases':
        return this.getDHCPLeasesData(client);
      case 'firewall':
        return this.getFirewallData(client);
      case 'connections':
        return this.getConnectionsData(client);
      case 'routes':
        return this.getRoutesData(client);
      case 'arp':
        return this.getArpData(client);
      case 'log':
        return this.getLogData(client);
      case 'switch-ports':
        return this.getSwitchPorts(client, mtConfig);
      case 'topology':
        return this.getTopology(client, mtConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getSystemData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [identityRes, resourceRes, routerboardRes] = await Promise.all([
        client.get('/system/identity'),
        client.get('/system/resource'),
        client.get('/system/routerboard').catch(() => ({ data: null })),
      ]);

      const identity = identityRes.data as MikroTikIdentity;
      const resource = resourceRes.data as MikroTikSystemResource;
      const routerboard = routerboardRes.data as MikroTikRouterboard | null;

      // Parse memory values (they come as strings in bytes)
      const freeMemory = parseInt(resource['free-memory'] || '0', 10);
      const totalMemory = parseInt(resource['total-memory'] || '0', 10);
      const memoryUsedPercent = totalMemory > 0 ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100) : 0;

      // Parse HDD values
      const freeHdd = parseInt(resource['free-hdd-space'] || '0', 10);
      const totalHdd = parseInt(resource['total-hdd-space'] || '0', 10);
      const hddUsedPercent = totalHdd > 0 ? Math.round(((totalHdd - freeHdd) / totalHdd) * 100) : 0;

      return {
        system: {
          identity: identity.name,
          version: resource.version,
          buildTime: resource['build-time'],
          uptime: resource.uptime,
          cpu: resource.cpu,
          cpuCount: parseInt(resource['cpu-count'] || '1', 10),
          cpuFrequency: parseInt(resource['cpu-frequency'] || '0', 10),
          cpuLoad: parseInt(resource['cpu-load'] || '0', 10),
          memoryFree: freeMemory,
          memoryTotal: totalMemory,
          memoryUsedPercent,
          hddFree: freeHdd,
          hddTotal: totalHdd,
          hddUsedPercent,
          architecture: resource['architecture-name'],
          boardName: resource['board-name'],
          platform: resource.platform,
          routerboard: routerboard ? {
            model: routerboard.model,
            serialNumber: routerboard['serial-number'],
            firmwareType: routerboard['firmware-type'],
            currentFirmware: routerboard['current-firmware'],
            upgradeFirmware: routerboard['upgrade-firmware'],
          } : null,
        },
      };
    } catch (error) {
      logger.error('mikrotik', 'Failed to get system data', { error });
      throw error;
    }
  }

  private async getInterfacesData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/interface');
      const interfaces = response.data as MikroTikInterface[];

      const transformed = interfaces.map(iface => ({
        id: iface['.id'],
        name: iface.name,
        type: iface.type,
        mtu: parseInt(iface.mtu || '0', 10),
        actualMtu: parseInt(iface['actual-mtu'] || '0', 10),
        macAddress: iface['mac-address'],
        running: iface.running === 'true',
        disabled: iface.disabled === 'true',
        comment: iface.comment || null,
        rxBytes: parseInt(iface['rx-byte'] || '0', 10),
        txBytes: parseInt(iface['tx-byte'] || '0', 10),
        rxPackets: parseInt(iface['rx-packet'] || '0', 10),
        txPackets: parseInt(iface['tx-packet'] || '0', 10),
        rxErrors: parseInt(iface['rx-error'] || '0', 10),
        txErrors: parseInt(iface['tx-error'] || '0', 10),
        rxDrops: parseInt(iface['rx-drop'] || '0', 10),
        txDrops: parseInt(iface['tx-drop'] || '0', 10),
        linkDowns: parseInt(iface['link-downs'] || '0', 10),
      }));

      return { interfaces: transformed };
    } catch (error) {
      logger.error('mikrotik', 'Failed to get interfaces', { error });
      throw error;
    }
  }

  private async getWirelessClientsData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/interface/wireless/registration-table');
      const clients = response.data as MikroTikWirelessClient[];

      const transformed = clients.map(c => ({
        id: c['.id'],
        interface: c.interface,
        macAddress: c['mac-address'],
        ap: c.ap === 'true',
        uptime: c.uptime,
        lastActivity: c['last-activity'],
        signalStrength: c['signal-strength'],
        signalToNoise: c['signal-to-noise'],
        txRate: c['tx-rate'],
        rxRate: c['rx-rate'],
        packets: c.packets,
        bytes: c.bytes,
      }));

      return { wirelessClients: transformed };
    } catch (error) {
      // Wireless may not be available on all models
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { wirelessClients: [], message: 'No wireless interfaces found' };
      }
      logger.error('mikrotik', 'Failed to get wireless clients', { error });
      throw error;
    }
  }

  private async getDHCPLeasesData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/ip/dhcp-server/lease');
      const leases = response.data as MikroTikDHCPLease[];

      const transformed = leases.map(lease => ({
        id: lease['.id'],
        address: lease.address,
        macAddress: lease['mac-address'],
        clientId: lease['client-id'] || null,
        hostName: lease['host-name'] || null,
        server: lease.server,
        status: lease.status,
        lastSeen: lease['last-seen'] || null,
        expiresAfter: lease['expires-after'] || null,
        activeAddress: lease['active-address'] || null,
        activeMacAddress: lease['active-mac-address'] || null,
        dynamic: lease.dynamic === 'true',
        disabled: lease.disabled === 'true',
        comment: lease.comment || null,
      }));

      return { dhcpLeases: transformed };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { dhcpLeases: [], message: 'No DHCP server configured' };
      }
      logger.error('mikrotik', 'Failed to get DHCP leases', { error });
      throw error;
    }
  }

  private async getFirewallData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/ip/firewall/filter');
      const rules = response.data as MikroTikFirewallRule[];

      const transformed = rules.map(rule => ({
        id: rule['.id'],
        chain: rule.chain,
        action: rule.action,
        protocol: rule.protocol || null,
        srcAddress: rule['src-address'] || null,
        dstAddress: rule['dst-address'] || null,
        srcPort: rule['src-port'] || null,
        dstPort: rule['dst-port'] || null,
        inInterface: rule['in-interface'] || null,
        outInterface: rule['out-interface'] || null,
        bytes: parseInt(rule.bytes || '0', 10),
        packets: parseInt(rule.packets || '0', 10),
        disabled: rule.disabled === 'true',
        dynamic: rule.dynamic === 'true',
        comment: rule.comment || null,
      }));

      return { firewallRules: transformed };
    } catch (error) {
      logger.error('mikrotik', 'Failed to get firewall rules', { error });
      throw error;
    }
  }

  private async getConnectionsData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/ip/firewall/connection');
      const connections = response.data as MikroTikConnection[];

      // Limit to first 500 connections to avoid overwhelming the UI
      const limited = connections.slice(0, 500);

      const transformed = limited.map(conn => ({
        id: conn['.id'],
        protocol: conn.protocol,
        srcAddress: conn['src-address'],
        dstAddress: conn['dst-address'],
        replySrcAddress: conn['reply-src-address'],
        replyDstAddress: conn['reply-dst-address'],
        tcpState: conn['tcp-state'] || null,
        timeout: conn.timeout,
        origBytes: parseInt(conn['orig-bytes'] || '0', 10),
        replBytes: parseInt(conn['repl-bytes'] || '0', 10),
        origPackets: parseInt(conn['orig-packets'] || '0', 10),
        replPackets: parseInt(conn['repl-packets'] || '0', 10),
      }));

      return {
        connections: transformed,
        totalConnections: connections.length,
      };
    } catch (error) {
      logger.error('mikrotik', 'Failed to get connections', { error });
      throw error;
    }
  }

  private async getRoutesData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/ip/route');
      const routes = response.data as MikroTikRoute[];

      const transformed = routes.map(route => ({
        id: route['.id'],
        dstAddress: route['dst-address'],
        gateway: route.gateway,
        gatewayStatus: route['gateway-status'] || null,
        distance: parseInt(route.distance || '0', 10),
        scope: parseInt(route.scope || '0', 10),
        targetScope: parseInt(route['target-scope'] || '0', 10),
        active: route.active === 'true',
        dynamic: route.dynamic === 'true',
        disabled: route.disabled === 'true',
        comment: route.comment || null,
      }));

      return { routes: transformed };
    } catch (error) {
      logger.error('mikrotik', 'Failed to get routes', { error });
      throw error;
    }
  }

  private async getArpData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/ip/arp');
      const entries = response.data as MikroTikArpEntry[];

      const transformed = entries.map(entry => ({
        id: entry['.id'],
        address: entry.address,
        macAddress: entry['mac-address'],
        interface: entry.interface,
        dynamic: entry.dynamic === 'true',
        complete: entry.complete === 'true',
        disabled: entry.disabled === 'true',
        published: entry.published === 'true',
      }));

      return { arpTable: transformed };
    } catch (error) {
      logger.error('mikrotik', 'Failed to get ARP table', { error });
      throw error;
    }
  }

  private async getLogData(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/log');
      const entries = response.data as MikroTikLogEntry[];

      // Get last 100 entries, most recent first
      const recent = entries.slice(-100).reverse();

      const transformed = recent.map(entry => ({
        id: entry['.id'],
        time: entry.time,
        topics: entry.topics,
        message: entry.message,
      }));

      return { logEntries: transformed };
    } catch (error) {
      logger.error('mikrotik', 'Failed to get log', { error });
      throw error;
    }
  }

  /**
   * Get switch ports in UniFi-compatible format for the Switch Port Overlay widget
   */
  private async getSwitchPorts(client: AxiosInstance, config: MikroTikConfig): Promise<IntegrationData> {
    try {
      // Get system identity and resources
      const [identityRes, resourceRes] = await Promise.all([
        client.get('/system/identity'),
        client.get('/system/resource'),
      ]);

      const identity = identityRes.data as MikroTikIdentity;
      const resource = resourceRes.data as MikroTikSystemResource;

      // Get ethernet interfaces (physical switch ports)
      let interfaces: MikroTikInterface[] = [];
      try {
        const response = await client.get('/interface/ethernet');
        interfaces = response.data as MikroTikInterface[];
      } catch {
        // Fall back to all interfaces
        const response = await client.get('/interface');
        interfaces = (response.data as MikroTikInterface[]).filter(
          iface => iface.type === 'ether' || iface.type === 'ethernet'
        );
      }

      // Sort interfaces by name to get consistent ordering
      interfaces.sort((a, b) => {
        const aNum = this.extractPortNumber(a.name);
        const bNum = this.extractPortNumber(b.name);
        return aNum - bNum;
      });

      // Transform to UniFi-compatible port_table format
      const portTable = interfaces.map((iface) => {
        // Use the actual port number from the interface name (e.g., ether1 -> 1, sfp-sfpplus1 -> 1)
        const portIdx = this.extractPortNumber(iface.name) || 1;
        // Cast to access extended ethernet interface properties
        const extIface = iface as MikroTikInterface & { speed?: string; rate?: string };

        // Parse speed from interface - MikroTik returns speed as string like "1Gbps"
        let speed = 0;
        const speedStr = extIface.speed || extIface.rate || '';
        if (speedStr) {
          const speedMatch = speedStr.match(/(\d+)/);
          if (speedMatch) {
            speed = parseInt(speedMatch[1], 10);
            if (speedStr.toLowerCase().includes('gbps') || speedStr.toLowerCase().includes('g')) {
              speed *= 1000;
            }
          }
        }

        // Infer speed from interface name if not available
        if (speed === 0) {
          const name = iface.name.toLowerCase();
          if (name.includes('sfp+') || name.includes('sfpp')) {
            speed = 10000;
          } else if (name.includes('sfp')) {
            speed = 1000;
          } else if (name.includes('ether')) {
            speed = 1000; // Default to GbE for ethernet ports
          }
        }

        return {
          port_idx: portIdx,
          name: iface.name,
          up: iface.running === 'true',
          enable: iface.disabled !== 'true',
          speed: speed,
          full_duplex: true,
          poe_enable: false,
          poe_power: 0,
          rx_bytes: parseInt(iface['rx-byte'] || '0', 10),
          tx_bytes: parseInt(iface['tx-byte'] || '0', 10),
          media: speed >= 10000 ? 'SFP+' : speed >= 1000 ? 'GE' : 'FE',
          port_poe: false,
          is_uplink: false, // Not available from MikroTik API
        };
      });

      // Create synthetic UniFi-compatible device
      const device = {
        _id: config.host,
        mac: '',
        model: resource['board-name'] || 'MikroTik',
        name: identity.name,
        type: 'usw',
        state: 1,
        port_table: portTable,
      };

      logger.debug('mikrotik', `Created switch-ports data with ${portTable.length} ports`);
      return { devices: [device] };
    } catch (error) {
      logger.error('mikrotik', 'Failed to get switch ports', { error });
      throw error;
    }
  }

  /**
   * Get network topology via MikroTik Neighbor Discovery (MNDP/CDP/LLDP)
   */
  private async getTopology(client: AxiosInstance, config: MikroTikConfig): Promise<{
    links: Array<{
      localDeviceId: string;
      localDeviceName: string;
      localDeviceMac: string;
      localPort: number;
      localPortName: string;
      remoteDeviceId: string;
      remoteDeviceName: string;
      remoteDeviceMac: string;
      remotePort: number;
      remotePortName: string;
      linkType: 'uplink' | 'downlink';
    }>;
  }> {
    const links: Array<{
      localDeviceId: string;
      localDeviceName: string;
      localDeviceMac: string;
      localPort: number;
      localPortName: string;
      remoteDeviceId: string;
      remoteDeviceName: string;
      remoteDeviceMac: string;
      remotePort: number;
      remotePortName: string;
      linkType: 'uplink' | 'downlink';
    }> = [];

    try {
      // Get local device identity
      const identityRes = await client.get('/system/identity');
      const identity = identityRes.data as MikroTikIdentity;
      const localDeviceId = config.host;
      const localDeviceName = identity.name;

      // Get neighbors from MikroTik Neighbor Discovery Protocol (MNDP)
      // This also picks up CDP and LLDP neighbors
      const neighborsRes = await client.get('/ip/neighbor');
      const neighbors = neighborsRes.data as Array<{
        ['.id']: string;
        interface: string;
        'mac-address': string;
        address?: string;
        identity?: string;
        platform?: string;
        version?: string;
        board?: string;
        'interface-name'?: string;
      }>;

      for (const neighbor of neighbors) {
        const localPortName = neighbor.interface || '';
        const localPort = this.extractPortNumber(localPortName);

        links.push({
          localDeviceId,
          localDeviceName,
          localDeviceMac: '',
          localPort,
          localPortName,
          remoteDeviceId: neighbor.identity || neighbor['mac-address'] || '',
          remoteDeviceName: neighbor.identity || neighbor.platform || 'Unknown',
          remoteDeviceMac: neighbor['mac-address'] || '',
          remotePort: 0, // MNDP doesn't provide remote port info
          remotePortName: '',
          linkType: 'downlink', // Assume downlink for discovered neighbors
        });
      }

      logger.debug('mikrotik', `Found ${neighbors.length} topology neighbors`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.debug('mikrotik', 'Neighbor discovery not available');
      } else {
        logger.error('mikrotik', 'Failed to get topology', { error });
      }
    }

    return { links };
  }

  /**
   * Extract numeric port identifier from interface name
   */
  private extractPortNumber(name: string): number {
    const match = name.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'system',
        name: 'System Status',
        description: 'Router identity, version, CPU, memory, and uptime',
        widgetTypes: ['mikrotik-system'],
      },
      {
        id: 'interfaces',
        name: 'Interfaces',
        description: 'Network interfaces with traffic statistics',
        widgetTypes: ['mikrotik-interfaces'],
      },
      {
        id: 'wireless-clients',
        name: 'Wireless Clients',
        description: 'Connected wireless clients with signal strength',
        widgetTypes: ['mikrotik-wireless'],
      },
      {
        id: 'dhcp-leases',
        name: 'DHCP Leases',
        description: 'DHCP server leases and clients',
        widgetTypes: ['mikrotik-dhcp'],
      },
      {
        id: 'firewall',
        name: 'Firewall Rules',
        description: 'Firewall filter rules with hit counts',
        widgetTypes: ['mikrotik-firewall'],
      },
      {
        id: 'connections',
        name: 'Active Connections',
        description: 'Active network connections through the router',
        widgetTypes: ['mikrotik-connections'],
      },
      {
        id: 'routes',
        name: 'Routing Table',
        description: 'IP routing table',
        widgetTypes: ['mikrotik-routes'],
      },
      {
        id: 'arp',
        name: 'ARP Table',
        description: 'ARP cache entries',
        widgetTypes: ['mikrotik-arp'],
      },
      {
        id: 'log',
        name: 'System Log',
        description: 'Recent system log entries',
        widgetTypes: ['mikrotik-log'],
      },
      {
        id: 'switch-ports',
        name: 'Switch Ports',
        description: 'Port status for Switch Port Overlay widget',
        widgetTypes: ['cross-switch-port-overlay'],
      },
      {
        id: 'topology',
        name: 'Network Topology',
        description: 'MNDP/CDP/LLDP neighbor discovery for switch interconnections',
        widgetTypes: ['switch-ports', 'cross-switch-port-overlay'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // ============================================
      // SYSTEM - Device Information & Management
      // ============================================
      {
        id: 'system-identity',
        name: 'Get System Identity',
        description: 'Get router hostname/identity',
        method: 'GET',
        endpoint: '/rest/system/identity',
        implemented: true,
        category: 'System',
        documentationUrl: 'https://help.mikrotik.com/docs/spaces/ROS/pages/47579162/REST+API',
      },
      {
        id: 'system-identity-set',
        name: 'Set System Identity',
        description: 'Set router hostname/identity',
        method: 'PATCH',
        endpoint: '/rest/system/identity',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'New router identity/hostname' },
        ],
      },
      {
        id: 'system-resource',
        name: 'Get System Resources',
        description: 'Get CPU, memory, storage, uptime, and system information',
        method: 'GET',
        endpoint: '/rest/system/resource',
        implemented: true,
        category: 'System',
      },
      {
        id: 'system-routerboard',
        name: 'Get RouterBoard Info',
        description: 'Get hardware model, serial number, and firmware versions',
        method: 'GET',
        endpoint: '/rest/system/routerboard',
        implemented: true,
        category: 'System',
      },
      {
        id: 'system-package',
        name: 'Get Installed Packages',
        description: 'Get list of installed RouterOS packages',
        method: 'GET',
        endpoint: '/rest/system/package',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-package-update',
        name: 'Check for Updates',
        description: 'Check for RouterOS package updates',
        method: 'POST',
        endpoint: '/rest/system/package/update/check-for-updates',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-package-install',
        name: 'Install Updates',
        description: 'Install available RouterOS updates',
        method: 'POST',
        endpoint: '/rest/system/package/update/install',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-clock',
        name: 'Get System Clock',
        description: 'Get current system date and time',
        method: 'GET',
        endpoint: '/rest/system/clock',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-clock-set',
        name: 'Set System Clock',
        description: 'Set system date and time',
        method: 'PATCH',
        endpoint: '/rest/system/clock',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'time', type: 'string', required: false, description: 'Time in HH:MM:SS format' },
          { name: 'date', type: 'string', required: false, description: 'Date in MMM/DD/YYYY format' },
        ],
      },
      {
        id: 'system-ntp-client',
        name: 'Get NTP Client Config',
        description: 'Get NTP client configuration',
        method: 'GET',
        endpoint: '/rest/system/ntp/client',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-history',
        name: 'Get System History',
        description: 'Get command history and system changes',
        method: 'GET',
        endpoint: '/rest/system/history',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-health',
        name: 'Get System Health',
        description: 'Get hardware health metrics (temperature, voltage, fan speed)',
        method: 'GET',
        endpoint: '/rest/system/health',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-license',
        name: 'Get License Info',
        description: 'Get RouterOS license information',
        method: 'GET',
        endpoint: '/rest/system/license',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-reboot',
        name: 'Reboot Router',
        description: 'Reboot the router',
        method: 'POST',
        endpoint: '/rest/system/reboot',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-shutdown',
        name: 'Shutdown Router',
        description: 'Shutdown the router',
        method: 'POST',
        endpoint: '/rest/system/shutdown',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-backup',
        name: 'Create Backup',
        description: 'Create system configuration backup',
        method: 'POST',
        endpoint: '/rest/system/backup/save',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'name', type: 'string', required: false, description: 'Backup file name' },
          { name: 'password', type: 'string', required: false, description: 'Encryption password' },
        ],
      },
      {
        id: 'system-export',
        name: 'Export Configuration',
        description: 'Export configuration as script',
        method: 'POST',
        endpoint: '/rest/export',
        implemented: false,
        category: 'System',
      },

      // ============================================
      // INTERFACES - Network Interface Management
      // ============================================
      {
        id: 'interface-list',
        name: 'List All Interfaces',
        description: 'Get all network interfaces with statistics',
        method: 'GET',
        endpoint: '/rest/interface',
        implemented: true,
        category: 'Interfaces',
      },
      {
        id: 'interface-detail',
        name: 'Get Interface Detail',
        description: 'Get detailed information about a specific interface',
        method: 'GET',
        endpoint: '/rest/interface/{id}',
        implemented: false,
        category: 'Interfaces',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Interface ID or name' },
        ],
      },
      {
        id: 'interface-enable',
        name: 'Enable Interface',
        description: 'Enable a disabled interface',
        method: 'POST',
        endpoint: '/rest/interface/{id}/enable',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-disable',
        name: 'Disable Interface',
        description: 'Disable an interface',
        method: 'POST',
        endpoint: '/rest/interface/{id}/disable',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-reset-counters',
        name: 'Reset Interface Counters',
        description: 'Reset traffic counters on an interface',
        method: 'POST',
        endpoint: '/rest/interface/{id}/reset-counters',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-ethernet',
        name: 'List Ethernet Interfaces',
        description: 'Get all ethernet interfaces',
        method: 'GET',
        endpoint: '/rest/interface/ethernet',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-vlan',
        name: 'List VLAN Interfaces',
        description: 'Get all VLAN interfaces',
        method: 'GET',
        endpoint: '/rest/interface/vlan',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-vlan-add',
        name: 'Create VLAN Interface',
        description: 'Create a new VLAN interface',
        method: 'PUT',
        endpoint: '/rest/interface/vlan',
        implemented: false,
        category: 'Interfaces',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'VLAN interface name' },
          { name: 'vlan-id', type: 'number', required: true, description: 'VLAN ID (1-4094)' },
          { name: 'interface', type: 'string', required: true, description: 'Parent interface' },
        ],
      },
      {
        id: 'interface-bridge',
        name: 'List Bridge Interfaces',
        description: 'Get all bridge interfaces',
        method: 'GET',
        endpoint: '/rest/interface/bridge',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-bridge-add',
        name: 'Create Bridge',
        description: 'Create a new bridge interface',
        method: 'PUT',
        endpoint: '/rest/interface/bridge',
        implemented: false,
        category: 'Interfaces',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Bridge name' },
        ],
      },
      {
        id: 'interface-bridge-port',
        name: 'List Bridge Ports',
        description: 'Get bridge port assignments',
        method: 'GET',
        endpoint: '/rest/interface/bridge/port',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-bridge-port-add',
        name: 'Add Bridge Port',
        description: 'Add interface to a bridge',
        method: 'PUT',
        endpoint: '/rest/interface/bridge/port',
        implemented: false,
        category: 'Interfaces',
        parameters: [
          { name: 'bridge', type: 'string', required: true, description: 'Bridge name' },
          { name: 'interface', type: 'string', required: true, description: 'Interface to add' },
        ],
      },
      {
        id: 'interface-bonding',
        name: 'List Bonding Interfaces',
        description: 'Get all bonding/LAG interfaces',
        method: 'GET',
        endpoint: '/rest/interface/bonding',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-pppoe-client',
        name: 'List PPPoE Clients',
        description: 'Get PPPoE client interfaces',
        method: 'GET',
        endpoint: '/rest/interface/pppoe-client',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-l2tp-client',
        name: 'List L2TP Clients',
        description: 'Get L2TP client interfaces',
        method: 'GET',
        endpoint: '/rest/interface/l2tp-client',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-gre',
        name: 'List GRE Tunnels',
        description: 'Get GRE tunnel interfaces',
        method: 'GET',
        endpoint: '/rest/interface/gre',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-eoip',
        name: 'List EoIP Tunnels',
        description: 'Get EoIP tunnel interfaces',
        method: 'GET',
        endpoint: '/rest/interface/eoip',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-wireguard',
        name: 'List WireGuard Interfaces',
        description: 'Get WireGuard VPN interfaces',
        method: 'GET',
        endpoint: '/rest/interface/wireguard',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-wireguard-peers',
        name: 'List WireGuard Peers',
        description: 'Get WireGuard peer configurations',
        method: 'GET',
        endpoint: '/rest/interface/wireguard/peers',
        implemented: false,
        category: 'Interfaces',
      },

      // ============================================
      // WIRELESS - Wireless Interface Management
      // ============================================
      {
        id: 'wireless-interface',
        name: 'List Wireless Interfaces',
        description: 'Get all wireless interfaces',
        method: 'GET',
        endpoint: '/rest/interface/wireless',
        implemented: false,
        category: 'Wireless',
      },
      {
        id: 'wireless-registration',
        name: 'Get Wireless Clients',
        description: 'Get connected wireless client registration table',
        method: 'GET',
        endpoint: '/rest/interface/wireless/registration-table',
        implemented: true,
        category: 'Wireless',
      },
      {
        id: 'wireless-security-profiles',
        name: 'List Security Profiles',
        description: 'Get wireless security profiles',
        method: 'GET',
        endpoint: '/rest/interface/wireless/security-profiles',
        implemented: false,
        category: 'Wireless',
      },
      {
        id: 'wireless-access-list',
        name: 'Get Wireless Access List',
        description: 'Get wireless MAC access control list',
        method: 'GET',
        endpoint: '/rest/interface/wireless/access-list',
        implemented: false,
        category: 'Wireless',
      },
      {
        id: 'wireless-connect-list',
        name: 'Get Wireless Connect List',
        description: 'Get wireless connection rules',
        method: 'GET',
        endpoint: '/rest/interface/wireless/connect-list',
        implemented: false,
        category: 'Wireless',
      },
      {
        id: 'caps-man-interface',
        name: 'List CAPsMAN Interfaces',
        description: 'Get CAPsMAN controlled wireless interfaces',
        method: 'GET',
        endpoint: '/rest/caps-man/interface',
        implemented: false,
        category: 'Wireless',
      },
      {
        id: 'caps-man-registration',
        name: 'Get CAPsMAN Clients',
        description: 'Get CAPsMAN wireless client registrations',
        method: 'GET',
        endpoint: '/rest/caps-man/registration-table',
        implemented: false,
        category: 'Wireless',
      },

      // ============================================
      // IP - IP Address Management
      // ============================================
      {
        id: 'ip-address',
        name: 'List IP Addresses',
        description: 'Get all IP addresses configured on interfaces',
        method: 'GET',
        endpoint: '/rest/ip/address',
        implemented: false,
        category: 'IP',
      },
      {
        id: 'ip-address-add',
        name: 'Add IP Address',
        description: 'Add an IP address to an interface',
        method: 'PUT',
        endpoint: '/rest/ip/address',
        implemented: false,
        category: 'IP',
        parameters: [
          { name: 'address', type: 'string', required: true, description: 'IP address with CIDR (e.g., 192.168.1.1/24)' },
          { name: 'interface', type: 'string', required: true, description: 'Interface name' },
        ],
      },
      {
        id: 'ip-address-delete',
        name: 'Delete IP Address',
        description: 'Remove an IP address',
        method: 'DELETE',
        endpoint: '/rest/ip/address/{id}',
        implemented: false,
        category: 'IP',
      },
      {
        id: 'ip-pool',
        name: 'List IP Pools',
        description: 'Get IP address pools',
        method: 'GET',
        endpoint: '/rest/ip/pool',
        implemented: false,
        category: 'IP',
      },
      {
        id: 'ip-dns',
        name: 'Get DNS Settings',
        description: 'Get DNS server configuration',
        method: 'GET',
        endpoint: '/rest/ip/dns',
        implemented: false,
        category: 'IP',
      },
      {
        id: 'ip-dns-static',
        name: 'List Static DNS Entries',
        description: 'Get static DNS A/AAAA records',
        method: 'GET',
        endpoint: '/rest/ip/dns/static',
        implemented: false,
        category: 'IP',
      },
      {
        id: 'ip-dns-cache',
        name: 'Get DNS Cache',
        description: 'View DNS resolver cache',
        method: 'GET',
        endpoint: '/rest/ip/dns/cache',
        implemented: false,
        category: 'IP',
      },

      // ============================================
      // ROUTING - IP Routes
      // ============================================
      {
        id: 'ip-route',
        name: 'List IP Routes',
        description: 'Get IP routing table',
        method: 'GET',
        endpoint: '/rest/ip/route',
        implemented: true,
        category: 'Routing',
      },
      {
        id: 'ip-route-add',
        name: 'Add Static Route',
        description: 'Add a static route',
        method: 'PUT',
        endpoint: '/rest/ip/route',
        implemented: false,
        category: 'Routing',
        parameters: [
          { name: 'dst-address', type: 'string', required: true, description: 'Destination network (e.g., 10.0.0.0/8)' },
          { name: 'gateway', type: 'string', required: true, description: 'Next hop gateway IP' },
        ],
      },
      {
        id: 'ip-route-delete',
        name: 'Delete Route',
        description: 'Remove a route',
        method: 'DELETE',
        endpoint: '/rest/ip/route/{id}',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'routing-bgp-connection',
        name: 'List BGP Connections',
        description: 'Get BGP peer connections (RouterOS v7+)',
        method: 'GET',
        endpoint: '/rest/routing/bgp/connection',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'routing-bgp-session',
        name: 'Get BGP Sessions',
        description: 'Get BGP session status',
        method: 'GET',
        endpoint: '/rest/routing/bgp/session',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'routing-ospf-instance',
        name: 'List OSPF Instances',
        description: 'Get OSPF routing instances',
        method: 'GET',
        endpoint: '/rest/routing/ospf/instance',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'routing-ospf-neighbor',
        name: 'Get OSPF Neighbors',
        description: 'Get OSPF neighbor adjacencies',
        method: 'GET',
        endpoint: '/rest/routing/ospf/neighbor',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'routing-table',
        name: 'Get Routing Tables',
        description: 'Get all routing tables (RouterOS v7+)',
        method: 'GET',
        endpoint: '/rest/routing/table',
        implemented: false,
        category: 'Routing',
      },

      // ============================================
      // ARP - Address Resolution
      // ============================================
      {
        id: 'ip-arp',
        name: 'Get ARP Table',
        description: 'Get ARP cache entries',
        method: 'GET',
        endpoint: '/rest/ip/arp',
        implemented: true,
        category: 'ARP',
      },
      {
        id: 'ip-arp-add',
        name: 'Add Static ARP Entry',
        description: 'Add a static ARP entry',
        method: 'PUT',
        endpoint: '/rest/ip/arp',
        implemented: false,
        category: 'ARP',
        parameters: [
          { name: 'address', type: 'string', required: true, description: 'IP address' },
          { name: 'mac-address', type: 'string', required: true, description: 'MAC address' },
          { name: 'interface', type: 'string', required: true, description: 'Interface name' },
        ],
      },
      {
        id: 'ip-arp-delete',
        name: 'Delete ARP Entry',
        description: 'Remove an ARP entry',
        method: 'DELETE',
        endpoint: '/rest/ip/arp/{id}',
        implemented: false,
        category: 'ARP',
      },

      // ============================================
      // DHCP - DHCP Server & Client
      // ============================================
      {
        id: 'dhcp-server',
        name: 'List DHCP Servers',
        description: 'Get DHCP server configurations',
        method: 'GET',
        endpoint: '/rest/ip/dhcp-server',
        implemented: false,
        category: 'DHCP',
      },
      {
        id: 'dhcp-server-lease',
        name: 'Get DHCP Leases',
        description: 'Get DHCP server lease table',
        method: 'GET',
        endpoint: '/rest/ip/dhcp-server/lease',
        implemented: true,
        category: 'DHCP',
      },
      {
        id: 'dhcp-server-lease-add',
        name: 'Add Static DHCP Lease',
        description: 'Create a static DHCP reservation',
        method: 'PUT',
        endpoint: '/rest/ip/dhcp-server/lease',
        implemented: false,
        category: 'DHCP',
        parameters: [
          { name: 'address', type: 'string', required: true, description: 'IP address to assign' },
          { name: 'mac-address', type: 'string', required: true, description: 'Client MAC address' },
          { name: 'server', type: 'string', required: true, description: 'DHCP server name' },
        ],
      },
      {
        id: 'dhcp-server-lease-delete',
        name: 'Delete DHCP Lease',
        description: 'Remove a DHCP lease or reservation',
        method: 'DELETE',
        endpoint: '/rest/ip/dhcp-server/lease/{id}',
        implemented: false,
        category: 'DHCP',
      },
      {
        id: 'dhcp-server-network',
        name: 'List DHCP Networks',
        description: 'Get DHCP network configurations (gateway, DNS, etc.)',
        method: 'GET',
        endpoint: '/rest/ip/dhcp-server/network',
        implemented: false,
        category: 'DHCP',
      },
      {
        id: 'dhcp-client',
        name: 'List DHCP Clients',
        description: 'Get DHCP client configurations',
        method: 'GET',
        endpoint: '/rest/ip/dhcp-client',
        implemented: false,
        category: 'DHCP',
      },

      // ============================================
      // FIREWALL - Firewall Rules & NAT
      // ============================================
      {
        id: 'firewall-filter',
        name: 'List Firewall Filter Rules',
        description: 'Get firewall filter rules',
        method: 'GET',
        endpoint: '/rest/ip/firewall/filter',
        implemented: true,
        category: 'Firewall',
      },
      {
        id: 'firewall-filter-add',
        name: 'Add Firewall Rule',
        description: 'Add a new firewall filter rule',
        method: 'PUT',
        endpoint: '/rest/ip/firewall/filter',
        implemented: false,
        category: 'Firewall',
        parameters: [
          { name: 'chain', type: 'string', required: true, description: 'Chain (input, forward, output)' },
          { name: 'action', type: 'string', required: true, description: 'Action (accept, drop, reject, etc.)' },
          { name: 'src-address', type: 'string', required: false, description: 'Source IP/network' },
          { name: 'dst-address', type: 'string', required: false, description: 'Destination IP/network' },
          { name: 'protocol', type: 'string', required: false, description: 'Protocol (tcp, udp, icmp)' },
          { name: 'dst-port', type: 'string', required: false, description: 'Destination port(s)' },
        ],
      },
      {
        id: 'firewall-filter-delete',
        name: 'Delete Firewall Rule',
        description: 'Remove a firewall filter rule',
        method: 'DELETE',
        endpoint: '/rest/ip/firewall/filter/{id}',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-filter-enable',
        name: 'Enable Firewall Rule',
        description: 'Enable a disabled firewall rule',
        method: 'POST',
        endpoint: '/rest/ip/firewall/filter/{id}/enable',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-filter-disable',
        name: 'Disable Firewall Rule',
        description: 'Disable a firewall rule',
        method: 'POST',
        endpoint: '/rest/ip/firewall/filter/{id}/disable',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-nat',
        name: 'List NAT Rules',
        description: 'Get NAT (Network Address Translation) rules',
        method: 'GET',
        endpoint: '/rest/ip/firewall/nat',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-nat-add',
        name: 'Add NAT Rule',
        description: 'Add a new NAT rule',
        method: 'PUT',
        endpoint: '/rest/ip/firewall/nat',
        implemented: false,
        category: 'Firewall',
        parameters: [
          { name: 'chain', type: 'string', required: true, description: 'Chain (srcnat, dstnat)' },
          { name: 'action', type: 'string', required: true, description: 'Action (masquerade, dst-nat, src-nat)' },
          { name: 'to-addresses', type: 'string', required: false, description: 'NAT target address' },
          { name: 'to-ports', type: 'string', required: false, description: 'NAT target port' },
        ],
      },
      {
        id: 'firewall-mangle',
        name: 'List Mangle Rules',
        description: 'Get mangle rules for packet marking',
        method: 'GET',
        endpoint: '/rest/ip/firewall/mangle',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-raw',
        name: 'List Raw Rules',
        description: 'Get raw firewall rules (pre-connection tracking)',
        method: 'GET',
        endpoint: '/rest/ip/firewall/raw',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-connection',
        name: 'Get Active Connections',
        description: 'Get connection tracking table',
        method: 'GET',
        endpoint: '/rest/ip/firewall/connection',
        implemented: true,
        category: 'Firewall',
      },
      {
        id: 'firewall-address-list',
        name: 'List Address Lists',
        description: 'Get firewall address lists',
        method: 'GET',
        endpoint: '/rest/ip/firewall/address-list',
        implemented: false,
        category: 'Firewall',
      },
      {
        id: 'firewall-address-list-add',
        name: 'Add to Address List',
        description: 'Add an address to a firewall address list',
        method: 'PUT',
        endpoint: '/rest/ip/firewall/address-list',
        implemented: false,
        category: 'Firewall',
        parameters: [
          { name: 'list', type: 'string', required: true, description: 'Address list name' },
          { name: 'address', type: 'string', required: true, description: 'IP address or network' },
        ],
      },
      {
        id: 'firewall-layer7-protocol',
        name: 'List Layer7 Protocols',
        description: 'Get Layer7 protocol definitions',
        method: 'GET',
        endpoint: '/rest/ip/firewall/layer7-protocol',
        implemented: false,
        category: 'Firewall',
      },

      // ============================================
      // QUEUE - Bandwidth Management
      // ============================================
      {
        id: 'queue-simple',
        name: 'List Simple Queues',
        description: 'Get simple queue configurations',
        method: 'GET',
        endpoint: '/rest/queue/simple',
        implemented: false,
        category: 'QoS',
      },
      {
        id: 'queue-simple-add',
        name: 'Add Simple Queue',
        description: 'Create a simple bandwidth queue',
        method: 'PUT',
        endpoint: '/rest/queue/simple',
        implemented: false,
        category: 'QoS',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Queue name' },
          { name: 'target', type: 'string', required: true, description: 'Target IP or interface' },
          { name: 'max-limit', type: 'string', required: false, description: 'Max bandwidth (upload/download)' },
        ],
      },
      {
        id: 'queue-tree',
        name: 'List Queue Trees',
        description: 'Get hierarchical queue tree configurations',
        method: 'GET',
        endpoint: '/rest/queue/tree',
        implemented: false,
        category: 'QoS',
      },
      {
        id: 'queue-type',
        name: 'List Queue Types',
        description: 'Get queue discipline types (PCQ, SFQ, etc.)',
        method: 'GET',
        endpoint: '/rest/queue/type',
        implemented: false,
        category: 'QoS',
      },

      // ============================================
      // HOTSPOT - Hotspot Server
      // ============================================
      {
        id: 'hotspot-user',
        name: 'List Hotspot Users',
        description: 'Get hotspot user accounts',
        method: 'GET',
        endpoint: '/rest/ip/hotspot/user',
        implemented: false,
        category: 'Hotspot',
      },
      {
        id: 'hotspot-user-add',
        name: 'Add Hotspot User',
        description: 'Create a hotspot user account',
        method: 'PUT',
        endpoint: '/rest/ip/hotspot/user',
        implemented: false,
        category: 'Hotspot',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: false, description: 'Password' },
          { name: 'profile', type: 'string', required: false, description: 'User profile' },
        ],
      },
      {
        id: 'hotspot-active',
        name: 'Get Hotspot Active Users',
        description: 'Get currently connected hotspot users',
        method: 'GET',
        endpoint: '/rest/ip/hotspot/active',
        implemented: false,
        category: 'Hotspot',
      },
      {
        id: 'hotspot-host',
        name: 'Get Hotspot Hosts',
        description: 'Get hosts detected by hotspot',
        method: 'GET',
        endpoint: '/rest/ip/hotspot/host',
        implemented: false,
        category: 'Hotspot',
      },
      {
        id: 'hotspot-ip-binding',
        name: 'List Hotspot IP Bindings',
        description: 'Get hotspot IP to MAC bindings',
        method: 'GET',
        endpoint: '/rest/ip/hotspot/ip-binding',
        implemented: false,
        category: 'Hotspot',
      },

      // ============================================
      // PPP - PPP Server & Secrets
      // ============================================
      {
        id: 'ppp-secret',
        name: 'List PPP Secrets',
        description: 'Get PPP user accounts (VPN users)',
        method: 'GET',
        endpoint: '/rest/ppp/secret',
        implemented: false,
        category: 'PPP/VPN',
      },
      {
        id: 'ppp-secret-add',
        name: 'Add PPP Secret',
        description: 'Create a PPP/VPN user account',
        method: 'PUT',
        endpoint: '/rest/ppp/secret',
        implemented: false,
        category: 'PPP/VPN',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
          { name: 'service', type: 'string', required: false, description: 'Service type (any, pptp, l2tp, etc.)' },
          { name: 'profile', type: 'string', required: false, description: 'PPP profile' },
        ],
      },
      {
        id: 'ppp-active',
        name: 'Get Active PPP Sessions',
        description: 'Get currently connected PPP/VPN sessions',
        method: 'GET',
        endpoint: '/rest/ppp/active',
        implemented: false,
        category: 'PPP/VPN',
      },
      {
        id: 'ppp-profile',
        name: 'List PPP Profiles',
        description: 'Get PPP connection profiles',
        method: 'GET',
        endpoint: '/rest/ppp/profile',
        implemented: false,
        category: 'PPP/VPN',
      },
      {
        id: 'l2tp-server',
        name: 'Get L2TP Server Config',
        description: 'Get L2TP VPN server configuration',
        method: 'GET',
        endpoint: '/rest/interface/l2tp-server/server',
        implemented: false,
        category: 'PPP/VPN',
      },
      {
        id: 'pptp-server',
        name: 'Get PPTP Server Config',
        description: 'Get PPTP VPN server configuration',
        method: 'GET',
        endpoint: '/rest/interface/pptp-server/server',
        implemented: false,
        category: 'PPP/VPN',
      },
      {
        id: 'sstp-server',
        name: 'Get SSTP Server Config',
        description: 'Get SSTP VPN server configuration',
        method: 'GET',
        endpoint: '/rest/interface/sstp-server/server',
        implemented: false,
        category: 'PPP/VPN',
      },
      {
        id: 'ovpn-server',
        name: 'Get OpenVPN Server Config',
        description: 'Get OpenVPN server configuration',
        method: 'GET',
        endpoint: '/rest/interface/ovpn-server/server',
        implemented: false,
        category: 'PPP/VPN',
      },

      // ============================================
      // IPSEC - IPSec VPN
      // ============================================
      {
        id: 'ipsec-peer',
        name: 'List IPSec Peers',
        description: 'Get IPSec peer configurations',
        method: 'GET',
        endpoint: '/rest/ip/ipsec/peer',
        implemented: false,
        category: 'IPSec',
      },
      {
        id: 'ipsec-policy',
        name: 'List IPSec Policies',
        description: 'Get IPSec security policies',
        method: 'GET',
        endpoint: '/rest/ip/ipsec/policy',
        implemented: false,
        category: 'IPSec',
      },
      {
        id: 'ipsec-installed-sa',
        name: 'Get IPSec Active SAs',
        description: 'Get installed IPSec Security Associations',
        method: 'GET',
        endpoint: '/rest/ip/ipsec/installed-sa',
        implemented: false,
        category: 'IPSec',
      },
      {
        id: 'ipsec-active-peers',
        name: 'Get IPSec Active Peers',
        description: 'Get active IPSec peer connections',
        method: 'GET',
        endpoint: '/rest/ip/ipsec/active-peers',
        implemented: false,
        category: 'IPSec',
      },

      // ============================================
      // USER - User Management
      // ============================================
      {
        id: 'user',
        name: 'List Users',
        description: 'Get router user accounts',
        method: 'GET',
        endpoint: '/rest/user',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-add',
        name: 'Add User',
        description: 'Create a new router user',
        method: 'PUT',
        endpoint: '/rest/user',
        implemented: false,
        category: 'Users',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: true, description: 'Password' },
          { name: 'group', type: 'string', required: true, description: 'User group (full, read, write)' },
        ],
      },
      {
        id: 'user-active',
        name: 'Get Active User Sessions',
        description: 'Get currently logged in users',
        method: 'GET',
        endpoint: '/rest/user/active',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'user-group',
        name: 'List User Groups',
        description: 'Get user permission groups',
        method: 'GET',
        endpoint: '/rest/user/group',
        implemented: false,
        category: 'Users',
      },

      // ============================================
      // LOG - System Logging
      // ============================================
      {
        id: 'log',
        name: 'Get System Log',
        description: 'Get system log entries',
        method: 'GET',
        endpoint: '/rest/log',
        implemented: true,
        category: 'Logging',
      },
      {
        id: 'log-action',
        name: 'List Log Actions',
        description: 'Get logging action configurations',
        method: 'GET',
        endpoint: '/rest/system/logging/action',
        implemented: false,
        category: 'Logging',
      },
      {
        id: 'log-rule',
        name: 'List Log Rules',
        description: 'Get logging rule configurations',
        method: 'GET',
        endpoint: '/rest/system/logging',
        implemented: false,
        category: 'Logging',
      },

      // ============================================
      // CERTIFICATE - SSL/TLS Certificates
      // ============================================
      {
        id: 'certificate',
        name: 'List Certificates',
        description: 'Get installed SSL/TLS certificates',
        method: 'GET',
        endpoint: '/rest/certificate',
        implemented: false,
        category: 'Certificates',
      },
      {
        id: 'certificate-add',
        name: 'Create Certificate',
        description: 'Generate a new certificate',
        method: 'PUT',
        endpoint: '/rest/certificate',
        implemented: false,
        category: 'Certificates',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Certificate name' },
          { name: 'common-name', type: 'string', required: true, description: 'Common Name (CN)' },
          { name: 'key-size', type: 'number', required: false, description: 'Key size (2048, 4096)' },
        ],
      },

      // ============================================
      // SNMP - SNMP Configuration
      // ============================================
      {
        id: 'snmp',
        name: 'Get SNMP Config',
        description: 'Get SNMP agent configuration',
        method: 'GET',
        endpoint: '/rest/snmp',
        implemented: false,
        category: 'SNMP',
      },
      {
        id: 'snmp-community',
        name: 'List SNMP Communities',
        description: 'Get SNMP community strings',
        method: 'GET',
        endpoint: '/rest/snmp/community',
        implemented: false,
        category: 'SNMP',
      },

      // ============================================
      // TOOLS - Network Tools & Diagnostics
      // ============================================
      {
        id: 'tool-ping',
        name: 'Ping',
        description: 'Execute ping to a host',
        method: 'POST',
        endpoint: '/rest/ping',
        implemented: false,
        category: 'Tools',
        parameters: [
          { name: 'address', type: 'string', required: true, description: 'Target IP or hostname' },
          { name: 'count', type: 'number', required: false, description: 'Number of pings' },
        ],
      },
      {
        id: 'tool-traceroute',
        name: 'Traceroute',
        description: 'Execute traceroute to a host',
        method: 'POST',
        endpoint: '/rest/tool/traceroute',
        implemented: false,
        category: 'Tools',
        parameters: [
          { name: 'address', type: 'string', required: true, description: 'Target IP or hostname' },
        ],
      },
      {
        id: 'tool-bandwidth-test',
        name: 'Bandwidth Test',
        description: 'Run bandwidth test to another MikroTik',
        method: 'POST',
        endpoint: '/rest/tool/bandwidth-test',
        implemented: false,
        category: 'Tools',
        parameters: [
          { name: 'address', type: 'string', required: true, description: 'Target router IP' },
          { name: 'user', type: 'string', required: true, description: 'Username' },
          { name: 'password', type: 'string', required: false, description: 'Password' },
        ],
      },
      {
        id: 'tool-torch',
        name: 'Torch (Traffic Monitor)',
        description: 'Real-time traffic monitoring on an interface',
        method: 'POST',
        endpoint: '/rest/tool/torch',
        implemented: false,
        category: 'Tools',
        parameters: [
          { name: 'interface', type: 'string', required: true, description: 'Interface to monitor' },
        ],
      },
      {
        id: 'tool-netwatch',
        name: 'List Netwatch',
        description: 'Get network host monitoring configurations',
        method: 'GET',
        endpoint: '/rest/tool/netwatch',
        implemented: false,
        category: 'Tools',
      },
      {
        id: 'tool-graphing-interface',
        name: 'Get Interface Graphs',
        description: 'Get interface graphing data',
        method: 'GET',
        endpoint: '/rest/tool/graphing/interface',
        implemented: false,
        category: 'Tools',
      },
      {
        id: 'tool-profile',
        name: 'Get CPU Profile',
        description: 'Get CPU profiler data',
        method: 'GET',
        endpoint: '/rest/tool/profile',
        implemented: false,
        category: 'Tools',
      },
      {
        id: 'tool-sniffer',
        name: 'Packet Sniffer',
        description: 'Control packet sniffer',
        method: 'GET',
        endpoint: '/rest/tool/sniffer',
        implemented: false,
        category: 'Tools',
      },

      // ============================================
      // SCHEDULER - Task Scheduling
      // ============================================
      {
        id: 'scheduler',
        name: 'List Scheduled Tasks',
        description: 'Get scheduled task configurations',
        method: 'GET',
        endpoint: '/rest/system/scheduler',
        implemented: false,
        category: 'Scheduler',
      },
      {
        id: 'scheduler-add',
        name: 'Add Scheduled Task',
        description: 'Create a new scheduled task',
        method: 'PUT',
        endpoint: '/rest/system/scheduler',
        implemented: false,
        category: 'Scheduler',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Task name' },
          { name: 'on-event', type: 'string', required: true, description: 'Script to run' },
          { name: 'interval', type: 'string', required: false, description: 'Run interval (e.g., 1d, 1h, 30m)' },
          { name: 'start-time', type: 'string', required: false, description: 'Start time' },
        ],
      },

      // ============================================
      // SCRIPTS - Script Management
      // ============================================
      {
        id: 'script',
        name: 'List Scripts',
        description: 'Get stored scripts',
        method: 'GET',
        endpoint: '/rest/system/script',
        implemented: false,
        category: 'Scripts',
      },
      {
        id: 'script-add',
        name: 'Add Script',
        description: 'Create a new script',
        method: 'PUT',
        endpoint: '/rest/system/script',
        implemented: false,
        category: 'Scripts',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Script name' },
          { name: 'source', type: 'string', required: true, description: 'Script source code' },
        ],
      },
      {
        id: 'script-run',
        name: 'Run Script',
        description: 'Execute a stored script',
        method: 'POST',
        endpoint: '/rest/system/script/{id}/run',
        implemented: false,
        category: 'Scripts',
      },

      // ============================================
      // FILES - File Management
      // ============================================
      {
        id: 'file',
        name: 'List Files',
        description: 'Get files on the router',
        method: 'GET',
        endpoint: '/rest/file',
        implemented: false,
        category: 'Files',
      },
      {
        id: 'file-delete',
        name: 'Delete File',
        description: 'Remove a file from the router',
        method: 'DELETE',
        endpoint: '/rest/file/{id}',
        implemented: false,
        category: 'Files',
      },

      // ============================================
      // NEIGHBOR DISCOVERY
      // ============================================
      {
        id: 'neighbor',
        name: 'Get Neighbors',
        description: 'Get discovered network neighbors (MNDP/CDP/LLDP)',
        method: 'GET',
        endpoint: '/rest/ip/neighbor',
        implemented: false,
        category: 'Discovery',
      },
      {
        id: 'neighbor-discovery',
        name: 'Get Neighbor Discovery Settings',
        description: 'Get neighbor discovery protocol settings',
        method: 'GET',
        endpoint: '/rest/ip/neighbor/discovery-settings',
        implemented: false,
        category: 'Discovery',
      },
    ];
  }
}
