import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import { IntegrationConfig, IntegrationData, PANOSConfig } from '../types';

// Cache API keys generated from username/password
const apiKeyCache = new Map<string, { key: string; expiresAt: number }>();

export class PANOSIntegration extends BaseIntegration {
  readonly type = 'panos';
  readonly name = 'Palo Alto PAN-OS';

  private getConfigKey(config: PANOSConfig): string {
    return `panos_${config.host}_${config.username || 'api'}`;
  }

  private async ensureApiKey(config: PANOSConfig): Promise<string> {
    if (config.apiKey) {
      return config.apiKey;
    }

    const configKey = this.getConfigKey(config);
    const cached = apiKeyCache.get(configKey);

    // Return cached key if still valid (with 5 min buffer)
    if (cached && cached.expiresAt > Date.now() + 300000) {
      return cached.key;
    }

    if (!config.username || !config.password) {
      throw new Error('Either API key or username/password required');
    }

    // Generate API key from username/password
    const port = config.port || 443;
    const baseUrl = `https://${config.host}:${port}`;

    const response = await axios.get(`${baseUrl}/api/`, {
      params: {
        type: 'keygen',
        user: config.username,
        password: config.password,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL !== false,
      }),
      timeout: 15000,
    });

    const result = await this.parseXmlResponse(response.data);
    if (!result || !result.key) {
      throw new Error('Failed to generate API key');
    }

    const apiKey = Array.isArray(result.key) ? result.key[0] : result.key;

    // Cache the key for 24 hours
    apiKeyCache.set(configKey, {
      key: apiKey,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return apiKey;
  }

  private createClient(config: PANOSConfig): AxiosInstance {
    const port = config.port || 443;

    return axios.create({
      baseURL: `https://${config.host}:${port}/api`,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL !== false,
      }),
      timeout: 30000,
    });
  }

  private async parseXmlResponse(data: string): Promise<any> {
    const result = await parseStringPromise(data, {
      explicitArray: false,
      ignoreAttrs: false,
    });

    if (result.response && result.response.$ && result.response.$.status !== 'success') {
      const msg = result.response.result?.msg || result.response.msg || 'API request failed';
      throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    }

    return result.response?.result || result.response;
  }

  private async xmlApiRequest(
    config: PANOSConfig,
    type: string,
    cmd?: string,
    params?: Record<string, string>
  ): Promise<any> {
    const key = await this.ensureApiKey(config);
    const client = this.createClient(config);

    const response = await client.get('/', {
      params: {
        type,
        key,
        cmd,
        ...params,
      },
    });

    return this.parseXmlResponse(response.data);
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const panosConfig = config as PANOSConfig;

    if (!panosConfig.host) {
      return { success: false, message: 'Host is required' };
    }

    if (!panosConfig.apiKey && (!panosConfig.username || !panosConfig.password)) {
      return { success: false, message: 'API key or username/password required' };
    }

    try {
      await this.ensureApiKey(panosConfig);
      const result = await this.xmlApiRequest(
        panosConfig,
        'op',
        '<show><system><info></info></system></show>'
      );

      const system = result.system;
      const hostname = system?.hostname || 'Unknown';
      const model = system?.model || 'Unknown';
      const version = system?.['sw-version'] || 'Unknown';

      return {
        success: true,
        message: `Connected to ${hostname} (${model}) running PAN-OS ${version}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const panosConfig = config as PANOSConfig;

    switch (metric) {
      case 'system':
        return this.getSystemInfo(panosConfig);
      case 'interfaces':
        return this.getInterfaces(panosConfig);
      case 'vpn':
        return this.getVPN(panosConfig);
      case 'policies':
        return this.getPolicies(panosConfig);
      case 'threats':
        return this.getThreats(panosConfig);
      case 'sessions':
        return this.getSessions(panosConfig);
      case 'ha':
        return this.getHA(panosConfig);
      case 'switch-ports':
        return this.getSwitchPorts(panosConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getSystemInfo(config: PANOSConfig): Promise<IntegrationData> {
    const result = await this.xmlApiRequest(
      config,
      'op',
      '<show><system><info></info></system></show>'
    );
    const system = result.system;

    return {
      hostname: system?.hostname || 'Unknown',
      model: system?.model || 'Unknown',
      serial: system?.serial || 'Unknown',
      ipAddress: system?.['ip-address'] || 'Unknown',
      software: {
        version: system?.['sw-version'] || 'Unknown',
        appVersion: system?.['app-version'] || 'Unknown',
        threatVersion: system?.['threat-version'] || 'Unknown',
        wildfireVersion: system?.['wildfire-version'] || 'Unknown',
      },
      uptime: system?.uptime || 'Unknown',
      uptimeSeconds: this.parseUptime(system?.uptime || ''),
      multiVsys: system?.['multi-vsys'] === 'on',
      operationalMode: system?.['operational-mode'] || 'normal',
    };
  }

  private parseUptime(uptime: string): number {
    // Parse uptime like "15 days, 3:45:22"
    const match = uptime.match(/(\d+)\s*days?,?\s*(\d+):(\d+):(\d+)/);
    if (match) {
      const days = parseInt(match[1], 10);
      const hours = parseInt(match[2], 10);
      const minutes = parseInt(match[3], 10);
      const seconds = parseInt(match[4], 10);
      return days * 86400 + hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  }

  private async getInterfaces(config: PANOSConfig): Promise<IntegrationData> {
    const result = await this.xmlApiRequest(
      config,
      'op',
      '<show><interface>all</interface></show>'
    );

    // Handle different response structures
    const ifnet = result.ifnet?.entry || result.hw?.entry || [];
    const entries = Array.isArray(ifnet) ? ifnet : [ifnet].filter(Boolean);

    const interfaces = entries.map((iface: any) => ({
      name: iface.name || iface.$?.name || 'Unknown',
      zone: iface.zone || 'N/A',
      ip: iface.ip || 'N/A',
      state: (iface.state || 'down').toLowerCase(),
      speed: iface.speed || 'N/A',
      duplex: iface.duplex || 'N/A',
      rxBytes: parseInt(iface['rx-bytes'] || '0', 10),
      txBytes: parseInt(iface['tx-bytes'] || '0', 10),
      rxPackets: parseInt(iface['rx-packets'] || '0', 10),
      txPackets: parseInt(iface['tx-packets'] || '0', 10),
    }));

    const stats = {
      total: interfaces.length,
      up: interfaces.filter((i: any) => i.state === 'up').length,
      down: interfaces.filter((i: any) => i.state !== 'up').length,
    };

    return { interfaces, stats };
  }

  private async getVPN(config: PANOSConfig): Promise<IntegrationData> {
    // Get IPsec tunnels
    let ipsecTunnels: any[] = [];
    try {
      const ipsecResult = await this.xmlApiRequest(
        config,
        'op',
        '<show><vpn><ipsec-sa></ipsec-sa></vpn></show>'
      );
      const entries = ipsecResult.entries?.entry || [];
      const tunnelEntries = Array.isArray(entries) ? entries : [entries].filter(Boolean);

      ipsecTunnels = tunnelEntries.map((t: any) => ({
        name: t.name || t.$?.name || 'Unknown',
        gateway: t.gateway || 'N/A',
        state: (t.state || 'down').toLowerCase(),
        localProxy: t['local-ip'] || t['local-proxy'] || 'N/A',
        remoteProxy: t['remote-ip'] || t['remote-proxy'] || 'N/A',
        encryptionAlgo: t['enc-algo'] || t.encryption || 'N/A',
        lifetime: parseInt(t.lifetime || '0', 10),
      }));
    } catch {
      // VPN may not be configured
    }

    // Get VPN gateways
    let gateways: any[] = [];
    try {
      const gwResult = await this.xmlApiRequest(
        config,
        'op',
        '<show><vpn><gateway></gateway></vpn></show>'
      );
      const gwEntries = gwResult.entry || gwResult.Gateway?.entry || [];
      const gatewayEntries = Array.isArray(gwEntries) ? gwEntries : [gwEntries].filter(Boolean);

      gateways = gatewayEntries.map((g: any) => ({
        name: g.name || g.$?.name || 'Unknown',
        peerAddress: g['peer-address'] || g.remote || 'N/A',
        localAddress: g['local-address'] || g.local || 'N/A',
        state: (g.state || 'down').toLowerCase(),
      }));
    } catch {
      // VPN gateways may not be configured
    }

    const stats = {
      totalTunnels: ipsecTunnels.length,
      activeTunnels: ipsecTunnels.filter((t: any) => t.state === 'active').length,
      totalGateways: gateways.length,
      activeGateways: gateways.filter((g: any) => g.state === 'active').length,
    };

    return { ipsecTunnels, gateways, stats };
  }

  private async getPolicies(config: PANOSConfig): Promise<IntegrationData> {
    const vsys = config.vsys || 'vsys1';
    const xpath = `/config/devices/entry/vsys/entry[@name='${vsys}']/rulebase/security/rules`;

    try {
      const result = await this.xmlApiRequest(config, 'config', undefined, {
        action: 'get',
        xpath,
      });

      const rulesContainer = result.rules?.entry || [];
      const ruleEntries = Array.isArray(rulesContainer)
        ? rulesContainer
        : [rulesContainer].filter(Boolean);

      const rules = ruleEntries.map((r: any) => ({
        name: r.$?.name || 'Unknown',
        uuid: r.uuid || '',
        source: this.parseListElement(r.source?.member),
        destination: this.parseListElement(r.destination?.member),
        application: this.parseListElement(r.application?.member),
        service: this.parseListElement(r.service?.member),
        action: r.action || 'deny',
        disabled: r.disabled === 'yes',
        hitCount: parseInt(r['hit-count'] || '0', 10),
        logStart: r['log-start'] === 'yes',
        logEnd: r['log-end'] === 'yes',
      }));

      const stats = {
        total: rules.length,
        enabled: rules.filter((r: any) => !r.disabled).length,
        disabled: rules.filter((r: any) => r.disabled).length,
        hitCount: rules.reduce((sum: number, r: any) => sum + r.hitCount, 0),
      };

      return { rules, stats };
    } catch {
      return {
        rules: [],
        stats: { total: 0, enabled: 0, disabled: 0, hitCount: 0 },
      };
    }
  }

  private parseListElement(element: any): string[] {
    if (!element) return ['any'];
    if (Array.isArray(element)) return element;
    return [element];
  }

  private async getThreats(config: PANOSConfig): Promise<IntegrationData> {
    let summary = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };
    let recent: any[] = [];
    let topThreats: any[] = [];

    try {
      // Get threat logs
      const logsResult = await this.xmlApiRequest(config, 'log', undefined, {
        'log-type': 'threat',
        nlogs: '50',
      });

      const logEntries = logsResult.logs?.entry || [];
      const entries = Array.isArray(logEntries) ? logEntries : [logEntries].filter(Boolean);

      recent = entries.slice(0, 20).map((e: any) => ({
        id: e.seqno || e.$?.seqno || '',
        time: e['receive_time'] || e.time || '',
        severity: (e.severity || 'informational').toLowerCase(),
        type: e.type || e.subtype || 'Unknown',
        name: e.threat || e.threatid || 'Unknown',
        sourceIP: e.src || e.srcip || 'N/A',
        destinationIP: e.dst || e.dstip || 'N/A',
        action: e.action || 'N/A',
      }));

      // Count by severity
      entries.forEach((e: any) => {
        const sev = (e.severity || 'informational').toLowerCase();
        summary.total++;
        if (sev === 'critical') summary.critical++;
        else if (sev === 'high') summary.high++;
        else if (sev === 'medium') summary.medium++;
        else if (sev === 'low') summary.low++;
        else summary.informational++;
      });

      // Group by threat name for top threats
      const threatCounts: Record<string, { count: number; severity: string }> = {};
      entries.forEach((e: any) => {
        const name = e.threat || e.threatid || 'Unknown';
        if (!threatCounts[name]) {
          threatCounts[name] = { count: 0, severity: e.severity || 'informational' };
        }
        threatCounts[name].count++;
      });

      topThreats = Object.entries(threatCounts)
        .map(([name, data]) => ({ name, count: data.count, severity: data.severity }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch {
      // Threat logs may be empty or access denied
    }

    return { summary, recent, topThreats };
  }

  private async getSessions(config: PANOSConfig): Promise<IntegrationData> {
    const result = await this.xmlApiRequest(
      config,
      'op',
      '<show><session><info></info></session></show>'
    );

    // Parse session info
    const info = result || {};

    return {
      stats: {
        activeSessions: parseInt(info['num-active'] || info['active-sessions'] || '0', 10),
        maxSessions: parseInt(info['num-max'] || info['max-sessions'] || '0', 10),
        utilizationPercent: Math.round(
          (parseInt(info['num-active'] || '0', 10) /
            Math.max(parseInt(info['num-max'] || '1', 10), 1)) *
            100
        ),
        tcpSessions: parseInt(info['num-tcp'] || '0', 10),
        udpSessions: parseInt(info['num-udp'] || '0', 10),
        icmpSessions: parseInt(info['num-icmp'] || '0', 10),
      },
      throughput: {
        kbps: parseInt(info.kbps || '0', 10),
        pps: parseInt(info.pps || info['cps'] || '0', 10),
      },
    };
  }

  private async getHA(config: PANOSConfig): Promise<IntegrationData> {
    try {
      const result = await this.xmlApiRequest(
        config,
        'op',
        '<show><high-availability><state></state></high-availability></show>'
      );

      const group = result.group || result;
      const local = group['local-info'] || {};
      const peer = group['peer-info'] || {};

      // Parse HA links
      const linkInfo = group['link-monitoring']?.groups?.entry || [];
      const linkEntries = Array.isArray(linkInfo) ? linkInfo : [linkInfo].filter(Boolean);

      const links = linkEntries.map((l: any) => ({
        name: l.name || l.$?.name || 'Unknown',
        state: (l.state || 'down').toLowerCase(),
        type: (l.interface?.name || 'unknown').split('/')[0] || 'ha',
      }));

      return {
        enabled: group.enabled !== 'no',
        mode: group.mode || 'active-passive',
        localState: (local.state || 'initial').toLowerCase(),
        peerState: (peer.state || 'unknown').toLowerCase(),
        peerAddress: peer['mgmt-ip'] || peer.address || 'N/A',
        configSynced: local['config-sync'] === 'synchronized',
        links,
      };
    } catch {
      // HA may not be configured
      return {
        enabled: false,
        mode: 'standalone',
        localState: 'standalone',
        peerState: 'N/A',
        peerAddress: 'N/A',
        configSynced: false,
        links: [],
      };
    }
  }

  private async getSwitchPorts(config: PANOSConfig): Promise<IntegrationData> {
    try {
      // Fetch system info and interface data
      const [systemResult, interfaceResult] = await Promise.all([
        this.xmlApiRequest(
          config,
          'op',
          '<show><system><info></info></system></show>'
        ),
        this.xmlApiRequest(
          config,
          'op',
          '<show><interface>all</interface></show>'
        ),
      ]);

      const system = systemResult.system || {};
      const hostname = system?.hostname || 'Palo Alto';
      const model = system?.model || 'Unknown';
      const serial = system?.serial || '';

      // Parse interface data
      const ifnet = interfaceResult.ifnet?.entry || interfaceResult.hw?.entry || [];
      const entries = Array.isArray(ifnet) ? ifnet : [ifnet].filter(Boolean);

      // Helper to extract port number from ethernet names like "ethernet1/5"
      const extractPortNumber = (name: string): number => {
        const match = name.match(/ethernet\d+\/(\d+)/i);
        if (match) return parseInt(match[1], 10);
        const numMatch = name.match(/(\d+)/);
        return numMatch ? parseInt(numMatch[1], 10) : 999;
      };

      // Filter to physical ethernet interfaces only
      const physicalInterfaces = entries.filter((iface: any) => {
        const name = (iface.name || iface.$?.name || '').toLowerCase();
        // Include ethernet ports (data plane interfaces)
        if (name.startsWith('ethernet')) return true;
        // Include management interface
        if (name === 'management' || name === 'mgmt') return true;
        return false;
      });

      // Sort interfaces by port number
      physicalInterfaces.sort((a: any, b: any) => {
        const nameA = a.name || a.$?.name || '';
        const nameB = b.name || b.$?.name || '';
        return extractPortNumber(nameA) - extractPortNumber(nameB);
      });

      // Helper to determine media type from speed
      const getMediaType = (speed: string, name: string): string => {
        const nameLower = name.toLowerCase();
        const speedNum = parseInt(speed, 10) || 0;
        if (nameLower.includes('sfp28') || speedNum >= 25000) return 'SFP28';
        if (nameLower.includes('sfp+') || speedNum >= 10000) return 'SFP+';
        if (nameLower.includes('sfp') || speedNum >= 10000) return 'SFP+';
        if (speedNum >= 2500) return 'mGig';
        if (speedNum >= 1000 || speed.toLowerCase().includes('1000')) return 'GE';
        return 'GE';
      };

      // Transform interfaces to port_table format
      const port_table = physicalInterfaces.map((iface: any, index: number) => {
        const name = iface.name || iface.$?.name || 'Unknown';
        const state = (iface.state || 'down').toLowerCase();
        const speed = iface.speed || '1000';
        const speedNum = parseInt(speed, 10) || 1000;

        return {
          port_idx: index + 1,
          name,
          up: state === 'up',
          enable: true,
          speed: speedNum,
          full_duplex: (iface.duplex || '').toLowerCase() !== 'half',
          rx_bytes: parseInt(iface['rx-bytes'] || '0', 10),
          tx_bytes: parseInt(iface['tx-bytes'] || '0', 10),
          media: getMediaType(speed, name),
          is_uplink: false, // Not available from PAN-OS API
          // Firewalls don't have PoE
          poe_enable: false,
          poe_mode: 'off' as const,
          poe_power: '0',
          poe_voltage: '0',
          poe_current: '0',
        };
      });

      return {
        device_name: hostname,
        model,
        serial,
        port_table,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch switch ports',
      };
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'system',
        name: 'System Status',
        description: 'Firewall system information and health',
        widgetTypes: ['panos-system'],
      },
      {
        id: 'interfaces',
        name: 'Interfaces',
        description: 'Network interface status and traffic',
        widgetTypes: ['panos-interfaces'],
      },
      {
        id: 'vpn',
        name: 'VPN Tunnels',
        description: 'IPsec tunnel and gateway status',
        widgetTypes: ['panos-vpn'],
      },
      {
        id: 'policies',
        name: 'Security Policies',
        description: 'Security rule overview',
        widgetTypes: ['panos-policies'],
      },
      {
        id: 'threats',
        name: 'Threats',
        description: 'Threat detection summary',
        widgetTypes: ['panos-threats'],
      },
      {
        id: 'sessions',
        name: 'Sessions',
        description: 'Active session statistics',
        widgetTypes: ['panos-sessions'],
      },
      {
        id: 'ha',
        name: 'High Availability',
        description: 'HA cluster status',
        widgetTypes: ['panos-ha'],
      },
      {
        id: 'switch-ports',
        name: 'Switch Ports',
        description: 'Port status for Switch Port Overlay widget',
        widgetTypes: ['cross-switch-port-overlay'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // System
      {
        id: 'system-info',
        name: 'System Information',
        description: 'Get firewall system information',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><system><info></info></system></show>',
        implemented: true,
        category: 'System',
      },
      {
        id: 'resource-monitor',
        name: 'Resource Monitor',
        description: 'Get resource usage statistics',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><running><resource-monitor></resource-monitor></running></show>',
        implemented: true,
        category: 'System',
      },
      // Interfaces
      {
        id: 'interfaces-all',
        name: 'All Interfaces',
        description: 'Get all network interfaces',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><interface>all</interface></show>',
        implemented: true,
        category: 'Network',
      },
      {
        id: 'arp-table',
        name: 'ARP Table',
        description: 'Get ARP table entries',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><arp><entry name="all"/></arp></show>',
        implemented: true,
        category: 'Network',
      },
      {
        id: 'routing-table',
        name: 'Routing Table',
        description: 'Get routing table',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><routing><route></route></routing></show>',
        implemented: true,
        category: 'Network',
      },
      // VPN
      {
        id: 'ipsec-sa',
        name: 'IPsec SA',
        description: 'Get IPsec security associations',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><vpn><ipsec-sa></ipsec-sa></vpn></show>',
        implemented: true,
        category: 'VPN',
      },
      {
        id: 'vpn-gateway',
        name: 'VPN Gateways',
        description: 'Get VPN gateway status',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><vpn><gateway></gateway></vpn></show>',
        implemented: true,
        category: 'VPN',
      },
      // Sessions
      {
        id: 'session-info',
        name: 'Session Info',
        description: 'Get session statistics',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><session><info></info></session></show>',
        implemented: true,
        category: 'Sessions',
      },
      {
        id: 'session-all',
        name: 'All Sessions',
        description: 'Get all active sessions',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><session><all></all></session></show>',
        implemented: true,
        category: 'Sessions',
      },
      // HA
      {
        id: 'ha-state',
        name: 'HA State',
        description: 'Get high availability state',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><high-availability><state></state></high-availability></show>',
        implemented: true,
        category: 'HA',
      },
      // Logs
      {
        id: 'traffic-logs',
        name: 'Traffic Logs',
        description: 'Get recent traffic logs',
        method: 'GET',
        endpoint: '/api/?type=log&log-type=traffic&nlogs=50',
        implemented: true,
        category: 'Logs',
      },
      {
        id: 'threat-logs',
        name: 'Threat Logs',
        description: 'Get recent threat logs',
        method: 'GET',
        endpoint: '/api/?type=log&log-type=threat&nlogs=50',
        implemented: true,
        category: 'Logs',
      },
      {
        id: 'system-logs',
        name: 'System Logs',
        description: 'Get system logs',
        method: 'GET',
        endpoint: '/api/?type=log&log-type=system&nlogs=50',
        implemented: true,
        category: 'Logs',
      },
      // Counters
      {
        id: 'global-counters',
        name: 'Global Counters',
        description: 'Get global counters',
        method: 'GET',
        endpoint: '/api/?type=op&cmd=<show><counter><global></global></counter></show>',
        implemented: true,
        category: 'Statistics',
      },
    ];
  }
}
