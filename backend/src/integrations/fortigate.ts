import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, MetricInfo, ApiCapability, ConnectionTestResult, CapabilityExecuteResult } from './base';
import { IntegrationConfig, IntegrationData } from '../types';

interface FortiGateConfig {
  host: string;
  port?: number;
  apiToken?: string;
  username?: string;
  password?: string;
  vdom?: string;
  verifySSL?: boolean;
}

interface FGApiResponse<T = unknown> {
  http_method: string;
  results: T;
  vdom?: string;
  status: 'success' | 'error';
  error?: string;
}

export class FortiGateIntegration extends BaseIntegration {
  readonly type = 'fortigate';
  readonly name = 'FortiGate';

  private sessionCookies: Map<string, { cookie: string; expiresAt: number }> = new Map();

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'system',
        name: 'System Status',
        description: 'System information and resource usage',
        widgetTypes: ['fortigate-system'],
      },
      {
        id: 'interfaces',
        name: 'Interfaces',
        description: 'Network interface status and traffic',
        widgetTypes: ['fortigate-interfaces'],
      },
      {
        id: 'policies',
        name: 'Firewall Policies',
        description: 'Policy overview and hit counts',
        widgetTypes: ['fortigate-policies'],
      },
      {
        id: 'vpn',
        name: 'VPN Status',
        description: 'IPsec and SSL VPN tunnel status',
        widgetTypes: ['fortigate-vpn'],
      },
      {
        id: 'sessions',
        name: 'Sessions',
        description: 'Active session statistics',
        widgetTypes: ['fortigate-sessions'],
      },
      {
        id: 'security',
        name: 'Security Events',
        description: 'IPS, antivirus, and web filter stats',
        widgetTypes: ['fortigate-security'],
      },
      {
        id: 'devices',
        name: 'Detected Devices',
        description: 'Network devices detected by FortiGate',
        widgetTypes: ['fortigate-devices'],
      },
      {
        id: 'ha',
        name: 'High Availability',
        description: 'HA cluster status',
        widgetTypes: ['fortigate-ha'],
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
        description: 'LLDP neighbor discovery for network interconnections',
        widgetTypes: ['switch-ports', 'cross-switch-port-overlay'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // System Status
      {
        id: 'system-status',
        name: 'System Status',
        description: 'Get system information and version',
        method: 'GET',
        endpoint: '/api/v2/monitor/system/status',
        implemented: true,
        category: 'System',
      },
      {
        id: 'resource-usage',
        name: 'Resource Usage',
        description: 'Get CPU, memory, and disk usage',
        method: 'GET',
        endpoint: '/api/v2/monitor/system/resource/usage',
        implemented: true,
        category: 'System',
      },
      {
        id: 'performance-status',
        name: 'Performance Status',
        description: 'Get performance metrics',
        method: 'GET',
        endpoint: '/api/v2/monitor/system/performance/status',
        implemented: true,
        category: 'System',
      },
      // Network
      {
        id: 'interfaces-config',
        name: 'Interfaces Config',
        description: 'Get interface configuration',
        method: 'GET',
        endpoint: '/api/v2/cmdb/system/interface',
        implemented: true,
        category: 'Network',
      },
      {
        id: 'interface-stats',
        name: 'Interface Statistics',
        description: 'Get interface traffic statistics',
        method: 'GET',
        endpoint: '/api/v2/monitor/system/interface',
        implemented: true,
        category: 'Network',
      },
      {
        id: 'routing-table',
        name: 'Routing Table',
        description: 'Get IPv4 routing table',
        method: 'GET',
        endpoint: '/api/v2/monitor/router/ipv4',
        implemented: true,
        category: 'Network',
      },
      {
        id: 'arp-table',
        name: 'ARP Table',
        description: 'Get ARP table entries',
        method: 'GET',
        endpoint: '/api/v2/monitor/network/arp',
        implemented: true,
        category: 'Network',
      },
      // Firewall
      {
        id: 'firewall-policies',
        name: 'Firewall Policies',
        description: 'Get firewall policy configuration',
        method: 'GET',
        endpoint: '/api/v2/cmdb/firewall/policy',
        implemented: true,
        category: 'Firewall',
      },
      {
        id: 'policy-stats',
        name: 'Policy Statistics',
        description: 'Get policy hit counts',
        method: 'GET',
        endpoint: '/api/v2/monitor/firewall/policy',
        implemented: true,
        category: 'Firewall',
      },
      {
        id: 'sessions',
        name: 'Active Sessions',
        description: 'Get active session information',
        method: 'GET',
        endpoint: '/api/v2/monitor/firewall/session',
        implemented: true,
        category: 'Firewall',
      },
      {
        id: 'top-sessions',
        name: 'Top Sessions',
        description: 'Get top sessions by traffic',
        method: 'GET',
        endpoint: '/api/v2/monitor/firewall/session-top',
        implemented: true,
        category: 'Firewall',
      },
      // VPN
      {
        id: 'ipsec-tunnels',
        name: 'IPSec Tunnels',
        description: 'Get IPSec tunnel status',
        method: 'GET',
        endpoint: '/api/v2/monitor/vpn/ipsec',
        implemented: true,
        category: 'VPN',
      },
      {
        id: 'sslvpn-status',
        name: 'SSL VPN Status',
        description: 'Get SSL VPN status',
        method: 'GET',
        endpoint: '/api/v2/monitor/vpn/ssl',
        implemented: true,
        category: 'VPN',
      },
      {
        id: 'sslvpn-stats',
        name: 'SSL VPN Statistics',
        description: 'Get SSL VPN statistics',
        method: 'GET',
        endpoint: '/api/v2/monitor/vpn/ssl/stats',
        implemented: true,
        category: 'VPN',
      },
      // Security
      {
        id: 'ips-anomaly',
        name: 'IPS Anomalies',
        description: 'Get IPS anomaly detections',
        method: 'GET',
        endpoint: '/api/v2/monitor/ips/anomaly',
        implemented: true,
        category: 'Security',
      },
      {
        id: 'antivirus-stats',
        name: 'Antivirus Statistics',
        description: 'Get antivirus scan statistics',
        method: 'GET',
        endpoint: '/api/v2/monitor/antivirus/stats',
        implemented: true,
        category: 'Security',
      },
      {
        id: 'webfilter-stats',
        name: 'Web Filter Statistics',
        description: 'Get web filter statistics',
        method: 'GET',
        endpoint: '/api/v2/monitor/webfilter/stats',
        implemented: true,
        category: 'Security',
      },
      // Devices
      {
        id: 'detected-devices',
        name: 'Detected Devices',
        description: 'Get detected network devices',
        method: 'GET',
        endpoint: '/api/v2/monitor/user/detected-device',
        implemented: true,
        category: 'Devices',
      },
      // HA
      {
        id: 'ha-config',
        name: 'HA Configuration',
        description: 'Get HA configuration',
        method: 'GET',
        endpoint: '/api/v2/cmdb/system/ha',
        implemented: true,
        category: 'HA',
      },
      {
        id: 'ha-peer',
        name: 'HA Peer Status',
        description: 'Get HA peer status',
        method: 'GET',
        endpoint: '/api/v2/monitor/system/ha-peer',
        implemented: true,
        category: 'HA',
      },
    ];
  }

  private extractConfig(config: IntegrationConfig): FortiGateConfig {
    const c = config as unknown as { config: FortiGateConfig };
    return c.config || (config as unknown as FortiGateConfig);
  }

  private extractId(config: IntegrationConfig): string {
    const c = config as unknown as { id: string };
    return c.id || 'default';
  }

  createClient(config: IntegrationConfig): AxiosInstance {
    const intConfig = this.extractConfig(config);
    const port = intConfig.port || 443;
    const baseURL = `https://${intConfig.host}:${port}`;

    return axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: intConfig.verifySSL !== false,
      }),
      timeout: 30000,
    });
  }

  private getAuthHeaders(intConfig: FortiGateConfig): Record<string, string> {
    if (intConfig.apiToken) {
      return { Authorization: `Bearer ${intConfig.apiToken}` };
    }
    return {};
  }

  private async ensureSession(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<string | null> {
    if (intConfig.apiToken) {
      return null;
    }

    // Check for cached session
    const cached = this.sessionCookies.get(integrationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.cookie;
    }

    // Login with username/password
    const response = await client.post(
      '/logincheck',
      `username=${encodeURIComponent(intConfig.username!)}&secretkey=${encodeURIComponent(intConfig.password!)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
        validateStatus: (status) => status < 400 || status === 302,
      }
    );

    const cookies = response.headers['set-cookie'];
    if (cookies && Array.isArray(cookies)) {
      const sessionCookie = cookies.map((c: string) => c.split(';')[0]).join('; ');
      // Cache for 30 minutes
      this.sessionCookies.set(integrationId, {
        cookie: sessionCookie,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });
      return sessionCookie;
    }

    throw new Error('Failed to authenticate: No session cookie received');
  }

  private async apiRequest<T>(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string,
    method: string,
    endpoint: string
  ): Promise<T> {
    const sessionCookie = await this.ensureSession(client, intConfig, integrationId);

    const headers: Record<string, string> = {
      ...this.getAuthHeaders(intConfig),
      'Content-Type': 'application/json',
    };

    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }

    const params: Record<string, string> = {};
    if (intConfig.vdom && intConfig.vdom !== 'root') {
      params.vdom = intConfig.vdom;
    }

    const response = await client.request<FGApiResponse<T>>({
      method,
      url: endpoint,
      headers,
      params,
    });

    if (response.data.status !== 'success') {
      throw new Error(response.data.error || 'API request failed');
    }

    return response.data.results;
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const intConfig = this.extractConfig(config);

    if (!intConfig.host) {
      return { success: false, message: 'Host is required' };
    }

    if (!intConfig.apiToken && (!intConfig.username || !intConfig.password)) {
      return {
        success: false,
        message: 'Either API token or username/password is required',
      };
    }

    try {
      const client = this.createClient(config);
      const integrationId = this.extractId(config);
      const status = await this.apiRequest<{
        version: string;
        serial: string;
        hostname: string;
        model: string;
      }>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/status');

      return {
        success: true,
        message: `Connected to ${status.hostname || status.model} (${status.version})`,
        details: {
          hostname: status.hostname,
          model: status.model,
          serial: status.serial,
          version: status.version,
        },
      };
    } catch (error) {
      let message = 'Connection failed';
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          message = 'Connection refused - check host and port';
        } else if (error.code === 'ENOTFOUND') {
          message = 'Host not found - check hostname';
        } else if (error.response?.status === 401) {
          message = 'Authentication failed - check credentials or API token';
        } else if (error.response?.status === 403) {
          message = 'Access forbidden - check API token permissions or trusted hosts';
        } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
          message = 'SSL certificate verification failed';
        } else {
          message = error.message;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }

      return { success: false, message };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const intConfig = this.extractConfig(config);
    const integrationId = this.extractId(config);
    const client = this.createClient(config);

    switch (metric) {
      case 'system':
        return this.getSystemData(client, intConfig, integrationId);
      case 'interfaces':
        return this.getInterfacesData(client, intConfig, integrationId);
      case 'policies':
        return this.getPoliciesData(client, intConfig, integrationId);
      case 'vpn':
        return this.getVPNData(client, intConfig, integrationId);
      case 'sessions':
        return this.getSessionsData(client, intConfig, integrationId);
      case 'security':
        return this.getSecurityData(client, intConfig, integrationId);
      case 'devices':
        return this.getDevicesData(client, intConfig, integrationId);
      case 'ha':
        return this.getHAData(client, intConfig, integrationId);
      case 'switch-ports':
        return this.getSwitchPorts(client, intConfig, integrationId);
      case 'topology':
        return this.getTopology(client, intConfig, integrationId);
      default:
        return { error: `Unknown metric: ${metric}` };
    }
  }

  private async getSystemData(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      const [status, resources] = await Promise.all([
        this.apiRequest<{
          version: string;
          build: number;
          serial: string;
          hostname: string;
          model: string;
          model_number?: string;
        }>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/status'),
        this.apiRequest<{
          cpu: number;
          memory: number;
          disk: number;
          session?: { current: number; max: number };
        }>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/resource/usage'),
      ]);

      // Try to get HA status
      let haEnabled = false;
      try {
        const haConfig = await this.apiRequest<{
          mode?: string;
        }[]>(client, intConfig, integrationId, 'GET', '/api/v2/cmdb/system/ha');
        if (Array.isArray(haConfig) && haConfig.length > 0) {
          haEnabled = haConfig[0].mode !== 'standalone';
        }
      } catch {
        // HA not configured or unavailable
      }

      return {
        hostname: status.hostname || 'FortiGate',
        model: status.model || status.model_number || 'Unknown',
        serial: status.serial,
        version: status.version,
        build: status.build,
        uptime: 0,
        resources: {
          cpu: resources.cpu || 0,
          memory: resources.memory || 0,
          disk: resources.disk || 0,
        },
        sessions: resources.session
          ? {
              current: resources.session.current,
              max: resources.session.max,
              utilizationPercent: Math.round(
                (resources.session.current / resources.session.max) * 100
              ),
            }
          : { current: 0, max: 0, utilizationPercent: 0 },
        haEnabled,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch system data',
      };
    }
  }

  private async getInterfacesData(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      const [configData, statsData] = await Promise.all([
        this.apiRequest<
          {
            name: string;
            type: string;
            alias?: string;
            ip?: string;
            status: string;
            speed?: number;
            duplex?: string;
          }[]
        >(client, intConfig, integrationId, 'GET', '/api/v2/cmdb/system/interface'),
        this.apiRequest<
          {
            name: string;
            link: string;
            speed: number;
            duplex: number;
            tx_bytes: number;
            rx_bytes: number;
            tx_packets: number;
            rx_packets: number;
            tx_errors: number;
            rx_errors: number;
          }[]
        >(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/interface').catch(
          () => []
        ),
      ]);

      const statsMap = new Map<string, (typeof statsData)[0]>();
      if (Array.isArray(statsData)) {
        for (const stat of statsData) {
          statsMap.set(stat.name, stat);
        }
      }

      const interfaces = (Array.isArray(configData) ? configData : []).map((iface) => {
        const stats = statsMap.get(iface.name);
        return {
          name: iface.name,
          type: iface.type || 'physical',
          alias: iface.alias,
          ip: iface.ip,
          status: stats?.link === 'up' || iface.status === 'up' ? 'up' : 'down',
          speed: stats?.speed || iface.speed || 0,
          duplex: stats?.duplex === 1 ? 'full' : stats?.duplex === 0 ? 'half' : 'auto',
          txBytes: stats?.tx_bytes || 0,
          rxBytes: stats?.rx_bytes || 0,
          txPackets: stats?.tx_packets || 0,
          rxPackets: stats?.rx_packets || 0,
          txErrors: stats?.tx_errors || 0,
          rxErrors: stats?.rx_errors || 0,
        };
      });

      const upCount = interfaces.filter((i) => i.status === 'up').length;

      return {
        interfaces,
        stats: {
          total: interfaces.length,
          up: upCount,
          down: interfaces.length - upCount,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch interfaces',
      };
    }
  }

  private async getPoliciesData(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      const [policies, policyStats] = await Promise.all([
        this.apiRequest<
          {
            policyid: number;
            name: string;
            srcintf: { name: string }[];
            dstintf: { name: string }[];
            srcaddr: { name: string }[];
            dstaddr: { name: string }[];
            service: { name: string }[];
            action: string;
            status: string;
            logtraffic: string;
          }[]
        >(client, intConfig, integrationId, 'GET', '/api/v2/cmdb/firewall/policy'),
        this.apiRequest<
          {
            policyid: number;
            hit_count: number;
            bytes: number;
            last_used: number;
          }[]
        >(client, intConfig, integrationId, 'GET', '/api/v2/monitor/firewall/policy').catch(
          () => []
        ),
      ]);

      const statsMap = new Map<number, (typeof policyStats)[0]>();
      if (Array.isArray(policyStats)) {
        for (const stat of policyStats) {
          statsMap.set(stat.policyid, stat);
        }
      }

      const policyList = (Array.isArray(policies) ? policies : []).map((policy) => {
        const stats = statsMap.get(policy.policyid);
        return {
          policyid: policy.policyid,
          name: policy.name || `Policy ${policy.policyid}`,
          srcintf: policy.srcintf?.map((i) => i.name) || [],
          dstintf: policy.dstintf?.map((i) => i.name) || [],
          srcaddr: policy.srcaddr?.map((a) => a.name) || [],
          dstaddr: policy.dstaddr?.map((a) => a.name) || [],
          service: policy.service?.map((s) => s.name) || [],
          action: policy.action || 'accept',
          status: policy.status || 'enable',
          logtraffic: policy.logtraffic || 'disable',
          hitCount: stats?.hit_count || 0,
          bytes: stats?.bytes || 0,
          lastUsed: stats?.last_used || 0,
        };
      });

      const enabledCount = policyList.filter((p) => p.status === 'enable').length;
      const totalHits = policyList.reduce((sum, p) => sum + p.hitCount, 0);
      const totalBytes = policyList.reduce((sum, p) => sum + p.bytes, 0);

      return {
        policies: policyList,
        stats: {
          total: policyList.length,
          enabled: enabledCount,
          disabled: policyList.length - enabledCount,
          totalHits,
          totalBytes,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch policies',
      };
    }
  }

  private async getVPNData(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      interface IPSecData {
        name: string;
        proxyid?: {
          proxy_src?: { subnet: string }[];
          proxy_dst?: { subnet: string }[];
          status: string;
        }[];
        incoming_bytes: number;
        outgoing_bytes: number;
      }

      interface SSLVPNData {
        list?: {
          user_name: string;
          remote_host: string;
          index: number;
          subsessions?: { aip: string; duration: number }[];
        }[];
      }

      const [ipsecData, sslvpnData] = await Promise.all([
        this.apiRequest<IPSecData[]>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/vpn/ipsec').catch(() => []),
        this.apiRequest<SSLVPNData>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/vpn/ssl').catch(() => ({ list: [] })),
      ]);

      const ipsec = (Array.isArray(ipsecData) ? ipsecData : []).map((tunnel) => ({
        name: tunnel.name,
        phase1Name: tunnel.name,
        status: tunnel.proxyid?.some((p) => p.status === 'up') ? 'up' : 'down',
        proxyId:
          tunnel.proxyid?.map((p) => ({
            localSubnet: p.proxy_src?.[0]?.subnet || 'unknown',
            remoteSubnet: p.proxy_dst?.[0]?.subnet || 'unknown',
            status: p.status || 'down',
          })) || [],
        inBytes: tunnel.incoming_bytes || 0,
        outBytes: tunnel.outgoing_bytes || 0,
        uptime: 0,
      }));

      const sslvpnUsers = (sslvpnData.list || []).map((user) => ({
        username: user.user_name,
        remoteHost: user.remote_host,
        tunnelIp: user.subsessions?.[0]?.aip || '',
        loginTime: Date.now(),
        duration: user.subsessions?.[0]?.duration || 0,
      }));

      const ipsecUp = ipsec.filter((t) => t.status === 'up').length;

      return {
        ipsec,
        sslvpn: {
          users: sslvpnUsers,
          stats: {
            maxUsers: 0,
            currentUsers: sslvpnUsers.length,
            totalTunnels: sslvpnUsers.length,
          },
        },
        stats: {
          ipsecTunnels: ipsec.length,
          ipsecUp,
          sslvpnUsers: sslvpnUsers.length,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch VPN data',
      };
    }
  }

  private async getSessionsData(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      const [resources, topSessions] = await Promise.all([
        this.apiRequest<{
          session?: { current: number; max: number };
        }>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/resource/usage'),
        this.apiRequest<
          {
            src: string;
            dst: string;
            service: string;
            bytes: number;
            packets: number;
            duration: number;
          }[]
        >(client, intConfig, integrationId, 'GET', '/api/v2/monitor/firewall/session-top').catch(
          () => []
        ),
      ]);

      const current = resources.session?.current || 0;
      const max = resources.session?.max || 1;

      return {
        stats: {
          current,
          max,
          utilizationPercent: Math.round((current / max) * 100),
          rate: 0,
        },
        topSessions: (Array.isArray(topSessions) ? topSessions : [])
          .slice(0, 10)
          .map((session) => ({
            source: session.src || 'unknown',
            destination: session.dst || 'unknown',
            service: session.service || 'unknown',
            bytes: session.bytes || 0,
            packets: session.packets || 0,
            duration: session.duration || 0,
          })),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch sessions data',
      };
    }
  }

  private async getSecurityData(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      interface IPSData {
        detected?: number;
        blocked?: number;
        anomalies?: number;
      }

      interface AVData {
        scanned?: number;
        detected?: number;
        blocked?: number;
      }

      interface WFData {
        requests?: number;
        blocked?: number;
        categories?: Record<string, number>;
      }

      const [ipsData, avData, wfData] = await Promise.all([
        this.apiRequest<IPSData>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/ips/anomaly').catch(() => ({} as IPSData)),
        this.apiRequest<AVData>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/antivirus/stats').catch(() => ({} as AVData)),
        this.apiRequest<WFData>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/webfilter/stats').catch(() => ({} as WFData)),
      ]);

      const ips = {
        detected: ipsData.detected || 0,
        blocked: ipsData.blocked || 0,
        anomalies: ipsData.anomalies || 0,
      };

      const antivirus = {
        scanned: avData.scanned || 0,
        detected: avData.detected || 0,
        blocked: avData.blocked || 0,
      };

      const webfilter = {
        requests: wfData.requests || 0,
        blocked: wfData.blocked || 0,
        categories: wfData.categories || {},
      };

      return {
        ips,
        antivirus,
        webfilter,
        summary: {
          threatsBlocked: ips.blocked + antivirus.blocked + webfilter.blocked,
          malwareBlocked: antivirus.blocked,
          intrusionsBlocked: ips.blocked,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch security data',
      };
    }
  }

  private async getDevicesData(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      const devices = await this.apiRequest<
        {
          mac: string;
          ipv4_address?: string;
          hostname?: string;
          os?: string;
          type?: string;
          detected_interface?: string;
          last_seen?: number;
          is_online?: boolean;
        }[]
      >(client, intConfig, integrationId, 'GET', '/api/v2/monitor/user/detected-device');

      const deviceList = (Array.isArray(devices) ? devices : []).map((device) => ({
        mac: device.mac || 'unknown',
        ip: device.ipv4_address,
        hostname: device.hostname,
        os: device.os,
        type: device.type,
        interface: device.detected_interface || 'unknown',
        lastSeen: device.last_seen || Date.now() / 1000,
        isOnline: device.is_online !== false,
      }));

      const onlineCount = deviceList.filter((d) => d.isOnline).length;

      return {
        devices: deviceList,
        stats: {
          total: deviceList.length,
          online: onlineCount,
          offline: deviceList.length - onlineCount,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch devices',
      };
    }
  }

  private async getHAData(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      const [haConfig, haPeer] = await Promise.all([
        this.apiRequest<
          {
            mode?: string;
            group_id?: number;
            group_name?: string;
            priority?: number;
          }[]
        >(client, intConfig, integrationId, 'GET', '/api/v2/cmdb/system/ha'),
        this.apiRequest<
          {
            serial_no?: string;
            hostname?: string;
            role?: string;
            priority?: number;
            status?: string;
            uptime?: number;
          }[]
        >(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/ha-peer').catch(() => []),
      ]);

      const config = Array.isArray(haConfig) && haConfig.length > 0 ? haConfig[0] : {};
      const enabled = config.mode && config.mode !== 'standalone';

      if (!enabled) {
        return {
          enabled: false,
          mode: 'standalone',
          groupId: 0,
          groupName: '',
          localRole: 'primary',
          members: [],
          syncStatus: 'synchronized',
        };
      }

      const members = (Array.isArray(haPeer) ? haPeer : []).map((peer) => ({
        serial: peer.serial_no || 'unknown',
        hostname: peer.hostname || 'unknown',
        role: (peer.role || 'secondary') as 'primary' | 'secondary',
        priority: peer.priority || 0,
        status: (peer.status === 'up' ? 'up' : 'down') as 'up' | 'down',
        uptime: peer.uptime || 0,
      }));

      const localRole = members.find((m) => m.role === 'primary')
        ? members[0]?.role === 'primary'
          ? 'primary'
          : 'secondary'
        : 'primary';

      return {
        enabled: true,
        mode: config.mode === 'a-a' ? 'a-a' : 'a-p',
        groupId: config.group_id || 0,
        groupName: config.group_name || '',
        localRole,
        members,
        syncStatus: members.every((m) => m.status === 'up') ? 'synchronized' : 'out-of-sync',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch HA data',
      };
    }
  }

  private async getSwitchPorts(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
    try {
      // Fetch system info and interface data in parallel
      const [systemStatus, interfacesData] = await Promise.all([
        this.apiRequest<{
          hostname: string;
          model: string;
          serial: string;
        }>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/status'),
        this.getInterfacesData(client, intConfig, integrationId),
      ]);

      if (interfacesData.error) {
        return { error: interfacesData.error };
      }

      const interfaces = interfacesData.interfaces as Array<{
        name: string;
        type: string;
        status: string;
        speed: number;
        duplex: string;
        txBytes: number;
        rxBytes: number;
      }>;

      // Filter to physical interfaces only (exclude tunnel, loopback, virtual types)
      const excludedTypes = ['tunnel', 'loopback', 'vlan', 'aggregate', 'redundant', 'switch'];
      const physicalInterfaces = interfaces.filter((iface) => {
        const type = iface.type?.toLowerCase() || '';
        const name = iface.name?.toLowerCase() || '';
        // Exclude virtual interfaces
        if (excludedTypes.some(t => type.includes(t))) return false;
        // Exclude ssl/ipsec tunnels
        if (name.includes('ssl.') || name.includes('tunnel')) return false;
        // Exclude loopback
        if (name.includes('loopback')) return false;
        // Include physical and hardware switch member ports
        return type === 'physical' || type === 'hard-switch' || type === '' ||
               name.match(/^(wan|lan|dmz|port|internal|mgmt|ha)/i);
      });

      // Helper to determine media type from speed
      const getMediaType = (speed: number, name: string): string => {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('sfp28') || speed >= 25000) return 'SFP28';
        if (nameLower.includes('sfp+') || speed >= 10000) return 'SFP+';
        if (nameLower.includes('sfp') || nameLower.includes('fiber')) return 'SFP';
        if (speed >= 10000) return 'SFP+';
        if (speed >= 2500) return 'mGig';
        if (speed >= 1000) return 'GE';
        return 'FE';
      };

      // Transform interfaces to port_table format
      const port_table = physicalInterfaces.map((iface, index) => ({
        port_idx: index + 1,
        name: iface.name,
        up: iface.status === 'up',
        enable: true,
        speed: iface.speed || 0,
        full_duplex: iface.duplex === 'full',
        rx_bytes: iface.txBytes || 0,  // Note: FortiGate swaps perspective
        tx_bytes: iface.rxBytes || 0,
        media: getMediaType(iface.speed || 0, iface.name),
        is_uplink: false, // Not available from FortiGate API
        // Firewalls don't have PoE
        poe_enable: false,
        poe_mode: 'off' as const,
        poe_power: '0',
        poe_voltage: '0',
        poe_current: '0',
      }));

      return {
        device_name: systemStatus.hostname || 'FortiGate',
        model: systemStatus.model || 'Unknown',
        serial: systemStatus.serial || '',
        port_table,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch switch ports',
      };
    }
  }

  private async getTopology(
    client: AxiosInstance,
    intConfig: FortiGateConfig,
    integrationId: string
  ): Promise<IntegrationData> {
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
      // Get local device info
      const systemStatus = await this.apiRequest<{
        hostname: string;
        serial: string;
      }>(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/status');

      const localDeviceId = intConfig.host;
      const localDeviceName = systemStatus.hostname || 'FortiGate';

      // Try to get LLDP neighbors
      // FortiGate uses /api/v2/monitor/system/interface/lldp or similar
      try {
        const lldpData = await this.apiRequest<
          Array<{
            local_port?: string;
            neighbor_port?: string;
            neighbor_system_name?: string;
            neighbor_chassis_id?: string;
            neighbor_port_id?: string;
          }>
        >(client, intConfig, integrationId, 'GET', '/api/v2/monitor/system/interface/lldp');

        if (Array.isArray(lldpData)) {
          for (const neighbor of lldpData) {
            if (!neighbor.neighbor_system_name && !neighbor.neighbor_chassis_id) continue;

            const localPortName = neighbor.local_port || '';
            // Extract port number from interface name (e.g., port1 -> 1)
            const localPortMatch = localPortName.match(/(\d+)$/);
            const localPort = localPortMatch ? parseInt(localPortMatch[1], 10) : 0;

            const remotePortName = neighbor.neighbor_port_id || neighbor.neighbor_port || '';
            const remotePortMatch = remotePortName.match(/(\d+)$/);
            const remotePort = remotePortMatch ? parseInt(remotePortMatch[1], 10) : 0;

            links.push({
              localDeviceId,
              localDeviceName,
              localDeviceMac: '',
              localPort,
              localPortName,
              remoteDeviceId: neighbor.neighbor_system_name || neighbor.neighbor_chassis_id || '',
              remoteDeviceName: neighbor.neighbor_system_name || 'Unknown',
              remoteDeviceMac: neighbor.neighbor_chassis_id || '',
              remotePort,
              remotePortName,
              linkType: 'downlink',
            });
          }
        }
      } catch {
        // LLDP may not be enabled or available
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch topology',
      };
    }

    return { links };
  }

  override async executeCapability(
    config: IntegrationConfig,
    capabilityId: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    _params?: Record<string, unknown>
  ): Promise<CapabilityExecuteResult> {
    const capability = this.getApiCapabilities().find((c) => c.id === capabilityId);
    if (!capability) {
      return { success: false, error: `Unknown capability: ${capabilityId}` };
    }

    const intConfig = this.extractConfig(config);
    const integrationId = this.extractId(config);

    try {
      const client = this.createClient(config);
      const result = await this.apiRequest(
        client,
        intConfig,
        integrationId,
        method,
        endpoint
      );

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Capability execution failed',
      };
    }
  }
}
