import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  OPNsenseConfig,
  OPNsenseSystemData,
  OPNsenseInterface,
  OPNsenseFirewallRule,
  OPNsenseAlias,
  OPNsenseGateway,
  OPNsenseOpenVPNInstance,
  OPNsenseIPsecConnection,
  OPNsenseWireGuardServer,
  OPNsenseWireGuardClient,
  OPNsenseService,
  OPNsenseDNSQuery,
  OPNsenseIDSAlert,
} from '../types';
import { logger } from '../services/logger';

export class OPNsenseIntegration extends BaseIntegration {
  readonly type = 'opnsense';
  readonly name = 'OPNsense';

  private createClient(config: OPNsenseConfig): AxiosInstance {
    const port = config.port || 443;
    const baseURL = `https://${config.host}:${port}/api`;

    return axios.create({
      baseURL,
      auth: {
        username: config.apiKey,
        password: config.apiSecret,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL !== false,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const opnConfig = config as OPNsenseConfig;

    try {
      const client = this.createClient(opnConfig);

      // Try to get firmware info as a connection test
      const response = await client.get('/core/firmware/info');

      const version = response.data?.product_version || response.data?.version || 'Unknown';

      return {
        success: true,
        message: `Connected to OPNsense ${version}`,
        details: {
          version,
          product: response.data?.product_name || 'OPNsense',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('opnsense', 'Connection test failed', { error: errorMsg });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Invalid API key or secret. Please check your credentials.',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Access forbidden. API user may lack required privileges.',
          };
        }
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: `Connection refused. Check host and port (${opnConfig.host}:${opnConfig.port || 443}).`,
          };
        }
        if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
          return {
            success: false,
            message: 'SSL certificate error. Try disabling SSL verification if using self-signed cert.',
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
    const opnConfig = config as OPNsenseConfig;
    const client = this.createClient(opnConfig);

    switch (metric) {
      case 'system':
        return this.getSystemData(client);
      case 'interfaces':
        return this.getInterfacesData(client);
      case 'firewall':
        return this.getFirewallData(client);
      case 'gateways':
        return this.getGatewaysData(client);
      case 'vpn':
        return this.getVPNData(client);
      case 'services':
        return this.getServicesData(client);
      case 'dns':
        return this.getDNSData(client);
      case 'ids':
        return this.getIDSData(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getSystemData(client: AxiosInstance): Promise<{ system: OPNsenseSystemData; [key: string]: unknown }> {
    try {
      // Fetch firmware info and system status in parallel
      const [firmwareRes, activityRes] = await Promise.all([
        client.get('/core/firmware/info').catch(() => ({ data: {} })),
        client.get('/diagnostics/activity/getActivity').catch(() => ({ data: {} })),
      ]);

      const firmware = firmwareRes.data;
      const activity = activityRes.data;

      // Parse system info from various sources
      const system: OPNsenseSystemData = {
        hostname: firmware.product_name || 'OPNsense',
        version: firmware.product_version || 'Unknown',
        platform: firmware.product_arch || 'FreeBSD',
        uptime: 0,
        uptimeFormatted: 'Unknown',
        firmware: {
          current: firmware.product_version || 'Unknown',
          available: firmware.upgrade_version,
          updateAvailable: !!firmware.upgrade_version && firmware.upgrade_version !== firmware.product_version,
        },
        cpu: {
          usage: 0,
          model: 'Unknown',
          cores: 0,
        },
        memory: {
          total: 0,
          used: 0,
          percentUsed: 0,
        },
        disk: {
          total: 0,
          used: 0,
          percentUsed: 0,
        },
      };

      // Parse activity data if available
      if (activity.headers && Array.isArray(activity.headers)) {
        // Activity data contains various system info
        const cpuHeader = activity.headers.find((h: { name?: string }) => h.name === 'cpu');
        if (cpuHeader && cpuHeader.value) {
          const cpuMatch = cpuHeader.value.match(/(\d+(?:\.\d+)?)/);
          if (cpuMatch) {
            system.cpu.usage = parseFloat(cpuMatch[1]);
          }
        }
      }

      logger.debug('opnsense', 'Fetched system data', { version: system.version });
      return { system };
    } catch (error) {
      logger.error('opnsense', 'Failed to fetch system data', { error: String(error) });
      throw error;
    }
  }

  private async getInterfacesData(client: AxiosInstance): Promise<{ interfaces: OPNsenseInterface[]; stats: { total: number; up: number; down: number }; [key: string]: unknown }> {
    try {
      const [statsRes, configRes] = await Promise.all([
        client.get('/diagnostics/interface/getInterfaceStatistics').catch(() => ({ data: {} })),
        client.get('/diagnostics/interface/getInterfaceConfig').catch(() => ({ data: {} })),
      ]);

      const statsData = statsRes.data;
      const configData = configRes.data;

      const interfaces: OPNsenseInterface[] = [];

      // Merge stats and config data
      for (const [key, stats] of Object.entries(statsData)) {
        if (typeof stats !== 'object' || stats === null) continue;

        const s = stats as Record<string, unknown>;
        const config = configData[key] as Record<string, unknown> | undefined;

        const iface: OPNsenseInterface = {
          name: key,
          description: (config?.descr as string) || key,
          device: (s.name as string) || key,
          status: (s.status as string) === 'active' ? 'up' : 'down',
          ipv4: config?.ipaddr as string | undefined,
          ipv6: config?.ipaddrv6 as string | undefined,
          mac: (s.macaddr as string) || '',
          mtu: (s.mtu as number) || 1500,
          media: (s.media as string) || '',
          inBytes: (s['received-bytes'] as number) || (s.inbytes as number) || 0,
          outBytes: (s['sent-bytes'] as number) || (s.outbytes as number) || 0,
          inPackets: (s['received-packets'] as number) || (s.inpkts as number) || 0,
          outPackets: (s['sent-packets'] as number) || (s.outpkts as number) || 0,
          inErrors: (s['in-errors'] as number) || (s.inerrs as number) || 0,
          outErrors: (s['out-errors'] as number) || (s.outerrs as number) || 0,
        };

        interfaces.push(iface);
      }

      const stats = {
        total: interfaces.length,
        up: interfaces.filter(i => i.status === 'up').length,
        down: interfaces.filter(i => i.status !== 'up').length,
      };

      logger.debug('opnsense', `Fetched ${interfaces.length} interfaces`);
      return { interfaces, stats };
    } catch (error) {
      logger.error('opnsense', 'Failed to fetch interfaces', { error: String(error) });
      return { interfaces: [], stats: { total: 0, up: 0, down: 0 } };
    }
  }

  private async getFirewallData(client: AxiosInstance): Promise<{ rules: OPNsenseFirewallRule[]; aliases: OPNsenseAlias[]; stats: { total: number; enabled: number; disabled: number }; [key: string]: unknown }> {
    try {
      const [rulesRes, aliasesRes] = await Promise.all([
        client.get('/firewall/filter/searchRule').catch(() => ({ data: { rows: [] } })),
        client.get('/firewall/alias/get').catch(() => ({ data: { alias: { aliases: { alias: [] } } } })),
      ]);

      // Parse rules
      const rulesData = rulesRes.data.rows || [];
      const rules: OPNsenseFirewallRule[] = rulesData.map((r: Record<string, unknown>, index: number) => ({
        uuid: (r.uuid as string) || `rule-${index}`,
        sequence: (r.sequence as number) || index,
        interface: (r.interface as string) || '',
        direction: ((r.direction as string) || 'in') as 'in' | 'out',
        action: ((r.action as string) || 'pass') as 'pass' | 'block' | 'reject',
        protocol: (r.protocol as string) || 'any',
        source: (r.source_net as string) || (r.source as string) || 'any',
        destination: (r.destination_net as string) || (r.destination as string) || 'any',
        description: (r.description as string) || '',
        enabled: r.enabled === '1' || r.enabled === true,
        log: r.log === '1' || r.log === true,
        evaluations: r.evaluations as number | undefined,
        states: r.states as number | undefined,
      }));

      // Parse aliases
      const aliasData = aliasesRes.data?.alias?.aliases?.alias || aliasesRes.data?.aliases || [];
      const aliasEntries = Array.isArray(aliasData) ? aliasData : Object.entries(aliasData).map(([uuid, data]) => ({ uuid, ...(data as object) }));

      const aliases: OPNsenseAlias[] = aliasEntries.map((a: Record<string, unknown>) => ({
        uuid: (a.uuid as string) || '',
        name: (a.name as string) || '',
        type: (a.type as string) || '',
        content: Array.isArray(a.content) ? a.content as string[] : (a.content as string || '').split('\n').filter(Boolean),
        description: (a.description as string) || '',
        enabled: a.enabled !== '0' && a.enabled !== false,
      }));

      const stats = {
        total: rules.length,
        enabled: rules.filter(r => r.enabled).length,
        disabled: rules.filter(r => !r.enabled).length,
      };

      logger.debug('opnsense', `Fetched ${rules.length} firewall rules, ${aliases.length} aliases`);
      return { rules, aliases, stats };
    } catch (error) {
      logger.error('opnsense', 'Failed to fetch firewall data', { error: String(error) });
      return { rules: [], aliases: [], stats: { total: 0, enabled: 0, disabled: 0 } };
    }
  }

  private async getGatewaysData(client: AxiosInstance): Promise<{ gateways: OPNsenseGateway[]; stats: { total: number; online: number; offline: number }; [key: string]: unknown }> {
    try {
      const response = await client.get('/routes/gateway/status');
      const data = response.data?.items || response.data || {};

      const gateways: OPNsenseGateway[] = [];

      for (const [name, gw] of Object.entries(data)) {
        if (typeof gw !== 'object' || gw === null) continue;

        const g = gw as Record<string, unknown>;
        gateways.push({
          name,
          interface: (g.interface as string) || '',
          gateway: (g.gateway as string) || '',
          status: this.parseGatewayStatus(g.status as string | undefined),
          monitor: (g.monitor as string) || '',
          delay: parseFloat(g.delay as string) || 0,
          stddev: parseFloat(g.stddev as string) || 0,
          loss: parseFloat(g.loss as string) || 0,
          default: g.default === true || g.defaultgw === true,
        });
      }

      const stats = {
        total: gateways.length,
        online: gateways.filter(g => g.status === 'online').length,
        offline: gateways.filter(g => g.status === 'offline').length,
      };

      logger.debug('opnsense', `Fetched ${gateways.length} gateways`);
      return { gateways, stats };
    } catch (error) {
      logger.error('opnsense', 'Failed to fetch gateways', { error: String(error) });
      return { gateways: [], stats: { total: 0, online: 0, offline: 0 } };
    }
  }

  private parseGatewayStatus(status: string | undefined): 'online' | 'offline' | 'pending' | 'none' {
    if (!status) return 'none';
    const s = status.toLowerCase();
    if (s.includes('online') || s.includes('up')) return 'online';
    if (s.includes('offline') || s.includes('down')) return 'offline';
    if (s.includes('pending') || s.includes('delay')) return 'pending';
    return 'none';
  }

  private async getVPNData(client: AxiosInstance): Promise<{
    openvpn: { servers: OPNsenseOpenVPNInstance[]; clients: OPNsenseOpenVPNInstance[] };
    ipsec: { connections: OPNsenseIPsecConnection[] };
    wireguard: { servers: OPNsenseWireGuardServer[]; clients: OPNsenseWireGuardClient[] };
    stats: { openvpnActive: number; ipsecActive: number; wireguardActive: number };
    [key: string]: unknown;
  }> {
    try {
      const [ovpnRes, ipsecRes, wgServerRes, wgClientRes] = await Promise.all([
        client.get('/openvpn/instances/search').catch(() => ({ data: { rows: [] } })),
        client.get('/ipsec/connections/searchItem').catch(() => ({ data: { rows: [] } })),
        client.get('/wireguard/server/searchServer').catch(() => ({ data: { rows: [] } })),
        client.get('/wireguard/client/searchClient').catch(() => ({ data: { rows: [] } })),
      ]);

      // Parse OpenVPN instances
      const ovpnData = ovpnRes.data.rows || [];
      const ovpnServers: OPNsenseOpenVPNInstance[] = [];
      const ovpnClients: OPNsenseOpenVPNInstance[] = [];

      for (const inst of ovpnData) {
        const i = inst as Record<string, unknown>;
        const instance: OPNsenseOpenVPNInstance = {
          uuid: (i.uuid as string) || '',
          name: (i.description as string) || (i.name as string) || '',
          role: (i.role as string) === 'server' ? 'server' : 'client',
          status: i.enabled === '1' ? 'up' : 'down',
          protocol: (i.proto as string) || 'udp',
          port: i.port as number | undefined,
          connectedClients: i.connectedClients as number | undefined,
          virtualAddress: i.vpnid as string | undefined,
        };

        if (instance.role === 'server') {
          ovpnServers.push(instance);
        } else {
          ovpnClients.push(instance);
        }
      }

      // Parse IPsec connections
      const ipsecData = ipsecRes.data.rows || [];
      const ipsecConnections: OPNsenseIPsecConnection[] = ipsecData.map((c: Record<string, unknown>) => ({
        uuid: (c.uuid as string) || '',
        name: (c.description as string) || (c.name as string) || '',
        local: (c.local_addrs as string) || '',
        remote: (c.remote_addrs as string) || '',
        status: c.connected === '1' ? 'established' : 'down',
        phase1Up: c.phase1 === '1' || c.connected === '1',
        phase2Up: c.phase2 === '1' || c.connected === '1',
      }));

      // Parse WireGuard servers
      const wgServerData = wgServerRes.data.rows || [];
      const wgServers: OPNsenseWireGuardServer[] = wgServerData.map((s: Record<string, unknown>) => ({
        uuid: (s.uuid as string) || '',
        name: (s.name as string) || '',
        publicKey: (s.pubkey as string) || '',
        listenPort: (s.port as number) || 51820,
        peers: (s.peers as number) || 0,
      }));

      // Parse WireGuard clients
      const wgClientData = wgClientRes.data.rows || [];
      const wgClients: OPNsenseWireGuardClient[] = wgClientData.map((c: Record<string, unknown>) => ({
        uuid: (c.uuid as string) || '',
        name: (c.name as string) || '',
        publicKey: (c.pubkey as string) || '',
        endpoint: c.endpoint as string | undefined,
        allowedIPs: Array.isArray(c.allowedips) ? c.allowedips as string[] : ((c.allowedips as string) || '').split(',').filter(Boolean),
      }));

      const stats = {
        openvpnActive: ovpnServers.filter(s => s.status === 'up').length + ovpnClients.filter(c => c.status === 'up').length,
        ipsecActive: ipsecConnections.filter(c => c.status === 'established').length,
        wireguardActive: wgServers.length,
      };

      logger.debug('opnsense', 'Fetched VPN data', stats);
      return {
        openvpn: { servers: ovpnServers, clients: ovpnClients },
        ipsec: { connections: ipsecConnections },
        wireguard: { servers: wgServers, clients: wgClients },
        stats,
      };
    } catch (error) {
      logger.error('opnsense', 'Failed to fetch VPN data', { error: String(error) });
      return {
        openvpn: { servers: [], clients: [] },
        ipsec: { connections: [] },
        wireguard: { servers: [], clients: [] },
        stats: { openvpnActive: 0, ipsecActive: 0, wireguardActive: 0 },
      };
    }
  }

  private async getServicesData(client: AxiosInstance): Promise<{ services: OPNsenseService[]; stats: { total: number; running: number; stopped: number }; [key: string]: unknown }> {
    try {
      const response = await client.post('/core/service/search', {});
      const data = response.data.rows || [];

      const services: OPNsenseService[] = data.map((s: Record<string, unknown>) => ({
        id: (s.id as string) || (s.name as string) || '',
        name: (s.name as string) || '',
        description: (s.description as string) || '',
        status: s.running === '1' || s.running === true ? 'running' : 'stopped',
        locked: s.locked === '1' || s.locked === true,
      }));

      const stats = {
        total: services.length,
        running: services.filter(s => s.status === 'running').length,
        stopped: services.filter(s => s.status === 'stopped').length,
      };

      logger.debug('opnsense', `Fetched ${services.length} services`);
      return { services, stats };
    } catch (error) {
      logger.error('opnsense', 'Failed to fetch services', { error: String(error) });
      return { services: [], stats: { total: 0, running: 0, stopped: 0 } };
    }
  }

  private async getDNSData(client: AxiosInstance): Promise<{
    status: 'running' | 'stopped';
    stats: { totalQueries: number; cacheHits: number; cacheMisses: number; cacheHitRate: number };
    recentQueries: OPNsenseDNSQuery[];
    [key: string]: unknown;
  }> {
    try {
      const [statusRes, queriesRes] = await Promise.all([
        client.get('/unbound/service/status').catch(() => ({ data: { status: 'unknown' } })),
        client.get('/unbound/overview/searchQueries').catch(() => ({ data: { rows: [] } })),
      ]);

      const isRunning = statusRes.data.status === 'running' || statusRes.data.running === true;

      // Parse recent queries
      const queriesData = queriesRes.data.rows || [];
      const recentQueries: OPNsenseDNSQuery[] = queriesData.slice(0, 50).map((q: Record<string, unknown>) => ({
        time: (q.time as string) || '',
        client: (q.client as string) || '',
        domain: (q.domain as string) || (q.name as string) || '',
        type: (q.type as string) || '',
        status: (q.status as string) || (q.rcode as string) || '',
      }));

      // Mock stats as OPNsense doesn't provide direct cache stats through API
      const stats = {
        totalQueries: queriesData.length,
        cacheHits: 0,
        cacheMisses: 0,
        cacheHitRate: 0,
      };

      logger.debug('opnsense', 'Fetched DNS data', { queries: recentQueries.length });
      return {
        status: isRunning ? 'running' : 'stopped',
        stats,
        recentQueries,
      };
    } catch (error) {
      logger.error('opnsense', 'Failed to fetch DNS data', { error: String(error) });
      return {
        status: 'stopped',
        stats: { totalQueries: 0, cacheHits: 0, cacheMisses: 0, cacheHitRate: 0 },
        recentQueries: [],
      };
    }
  }

  private async getIDSData(client: AxiosInstance): Promise<{
    enabled: boolean;
    status: 'running' | 'stopped';
    alerts: OPNsenseIDSAlert[];
    stats: { total: number; high: number; medium: number; low: number };
    [key: string]: unknown;
  }> {
    try {
      const [statusRes, alertsRes] = await Promise.all([
        client.get('/ids/service/status').catch(() => ({ data: { status: 'unknown' } })),
        client.get('/ids/service/queryAlerts').catch(() => ({ data: { rows: [] } })),
      ]);

      const isRunning = statusRes.data.status === 'running' || statusRes.data.running === true;

      // Parse alerts
      const alertsData = alertsRes.data.rows || alertsRes.data || [];
      const alerts: OPNsenseIDSAlert[] = alertsData.slice(0, 100).map((a: Record<string, unknown>) => {
        const severity = this.parseIDSSeverity(a.alert_severity as string | number | undefined);
        return {
          timestamp: (a.timestamp as string) || (a.date as string) || '',
          severity,
          category: (a.alert_category as string) || (a.category as string) || 'unknown',
          signature: (a.alert_signature as string) || (a.signature as string) || '',
          sourceIp: (a.src_ip as string) || (a.source as string) || '',
          destIp: (a.dest_ip as string) || (a.destination as string) || '',
          protocol: (a.proto as string) || (a.protocol as string) || '',
        };
      });

      const stats = {
        total: alerts.length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
      };

      logger.debug('opnsense', 'Fetched IDS data', { alerts: alerts.length });
      return {
        enabled: isRunning,
        status: isRunning ? 'running' : 'stopped',
        alerts,
        stats,
      };
    } catch (error) {
      logger.error('opnsense', 'Failed to fetch IDS data', { error: String(error) });
      return {
        enabled: false,
        status: 'stopped',
        alerts: [],
        stats: { total: 0, high: 0, medium: 0, low: 0 },
      };
    }
  }

  private parseIDSSeverity(severity: string | number | undefined): 'high' | 'medium' | 'low' {
    if (typeof severity === 'number') {
      if (severity <= 1) return 'high';
      if (severity <= 2) return 'medium';
      return 'low';
    }
    if (typeof severity === 'string') {
      const s = severity.toLowerCase();
      if (s.includes('high') || s.includes('critical') || s === '1') return 'high';
      if (s.includes('medium') || s.includes('warn') || s === '2') return 'medium';
    }
    return 'low';
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'system',
        name: 'System Status',
        description: 'System information and resource usage',
        widgetTypes: ['opnsense-system'],
      },
      {
        id: 'interfaces',
        name: 'Interfaces',
        description: 'Network interface status and traffic',
        widgetTypes: ['opnsense-interfaces'],
      },
      {
        id: 'firewall',
        name: 'Firewall Rules',
        description: 'Firewall rule overview and aliases',
        widgetTypes: ['opnsense-firewall'],
      },
      {
        id: 'gateways',
        name: 'Gateways',
        description: 'Gateway status and health',
        widgetTypes: ['opnsense-gateways'],
      },
      {
        id: 'vpn',
        name: 'VPN Status',
        description: 'OpenVPN, IPsec, and WireGuard tunnels',
        widgetTypes: ['opnsense-vpn'],
      },
      {
        id: 'services',
        name: 'Services',
        description: 'System service status',
        widgetTypes: ['opnsense-services'],
      },
      {
        id: 'dns',
        name: 'DNS Statistics',
        description: 'Unbound DNS resolver statistics',
        widgetTypes: ['opnsense-dns'],
      },
      {
        id: 'ids',
        name: 'IDS/IPS Alerts',
        description: 'Intrusion detection alerts',
        widgetTypes: ['opnsense-ids'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // System
      {
        id: 'firmware-info',
        name: 'Get Firmware Info',
        description: 'Get firmware version and update status',
        method: 'GET',
        endpoint: '/core/firmware/info',
        implemented: true,
        category: 'System',
      },
      {
        id: 'firmware-status',
        name: 'Get Firmware Status',
        description: 'Check firmware update availability',
        method: 'GET',
        endpoint: '/core/firmware/status',
        implemented: true,
        category: 'System',
      },
      {
        id: 'services-search',
        name: 'List Services',
        description: 'Search and list system services',
        method: 'POST',
        endpoint: '/core/service/search',
        implemented: true,
        category: 'System',
      },
      {
        id: 'service-restart',
        name: 'Restart Service',
        description: 'Restart a specific service',
        method: 'POST',
        endpoint: '/core/service/restart/{service}',
        implemented: false,
        category: 'System',
        parameters: [
          { name: 'service', type: 'string', required: true, description: 'Service name' },
        ],
      },

      // Interfaces
      {
        id: 'interface-stats',
        name: 'Get Interface Statistics',
        description: 'Get interface traffic statistics',
        method: 'GET',
        endpoint: '/diagnostics/interface/getInterfaceStatistics',
        implemented: true,
        category: 'Interfaces',
      },
      {
        id: 'interface-config',
        name: 'Get Interface Config',
        description: 'Get interface configuration',
        method: 'GET',
        endpoint: '/diagnostics/interface/getInterfaceConfig',
        implemented: true,
        category: 'Interfaces',
      },
      {
        id: 'arp-table',
        name: 'Get ARP Table',
        description: 'Get ARP table entries',
        method: 'GET',
        endpoint: '/diagnostics/interface/getArp',
        implemented: false,
        category: 'Interfaces',
      },

      // Firewall
      {
        id: 'firewall-rules',
        name: 'Search Firewall Rules',
        description: 'Search and list firewall rules',
        method: 'GET',
        endpoint: '/firewall/filter/searchRule',
        implemented: true,
        category: 'Firewall',
      },
      {
        id: 'firewall-aliases',
        name: 'Get Aliases',
        description: 'Get firewall aliases',
        method: 'GET',
        endpoint: '/firewall/alias/get',
        implemented: true,
        category: 'Firewall',
      },
      {
        id: 'firewall-apply',
        name: 'Apply Firewall Changes',
        description: 'Apply pending firewall changes',
        method: 'POST',
        endpoint: '/firewall/filter/apply',
        implemented: false,
        category: 'Firewall',
      },

      // Gateways
      {
        id: 'gateway-status',
        name: 'Get Gateway Status',
        description: 'Get gateway status and health',
        method: 'GET',
        endpoint: '/routes/gateway/status',
        implemented: true,
        category: 'Gateways',
      },

      // VPN - OpenVPN
      {
        id: 'openvpn-instances',
        name: 'List OpenVPN Instances',
        description: 'Search OpenVPN server/client instances',
        method: 'GET',
        endpoint: '/openvpn/instances/search',
        implemented: true,
        category: 'VPN',
      },
      {
        id: 'openvpn-status',
        name: 'Get OpenVPN Status',
        description: 'Get OpenVPN service status',
        method: 'GET',
        endpoint: '/openvpn/service/status',
        implemented: false,
        category: 'VPN',
      },

      // VPN - IPsec
      {
        id: 'ipsec-connections',
        name: 'List IPsec Connections',
        description: 'Search IPsec connections',
        method: 'GET',
        endpoint: '/ipsec/connections/searchItem',
        implemented: true,
        category: 'VPN',
      },
      {
        id: 'ipsec-status',
        name: 'Get IPsec Status',
        description: 'Get IPsec subsystem status',
        method: 'GET',
        endpoint: '/ipsec/legacy_subsystem/status',
        implemented: false,
        category: 'VPN',
      },

      // VPN - WireGuard
      {
        id: 'wireguard-servers',
        name: 'List WireGuard Servers',
        description: 'Search WireGuard servers',
        method: 'GET',
        endpoint: '/wireguard/server/searchServer',
        implemented: true,
        category: 'VPN',
      },
      {
        id: 'wireguard-clients',
        name: 'List WireGuard Clients',
        description: 'Search WireGuard clients',
        method: 'GET',
        endpoint: '/wireguard/client/searchClient',
        implemented: true,
        category: 'VPN',
      },

      // DNS
      {
        id: 'unbound-status',
        name: 'Get Unbound Status',
        description: 'Get Unbound DNS service status',
        method: 'GET',
        endpoint: '/unbound/service/status',
        implemented: true,
        category: 'DNS',
      },
      {
        id: 'unbound-queries',
        name: 'Search DNS Queries',
        description: 'Search DNS query log',
        method: 'GET',
        endpoint: '/unbound/overview/searchQueries',
        implemented: true,
        category: 'DNS',
      },

      // IDS
      {
        id: 'ids-status',
        name: 'Get IDS Status',
        description: 'Get IDS service status',
        method: 'GET',
        endpoint: '/ids/service/status',
        implemented: true,
        category: 'IDS',
      },
      {
        id: 'ids-alerts',
        name: 'Query IDS Alerts',
        description: 'Query IDS alert log',
        method: 'GET',
        endpoint: '/ids/service/queryAlerts',
        implemented: true,
        category: 'IDS',
      },
    ];
  }
}
