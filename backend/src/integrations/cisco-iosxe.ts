import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { BaseIntegration, ConnectionTestResult, MetricInfo, ApiCapability } from './base';
import {
  IntegrationConfig,
  IntegrationData,
  CiscoIOSXEConfig,
  CiscoDeviceInfo,
  CiscoInterface,
  CiscoResourceUsage,
  CiscoEnvironmentSensor,
  CiscoVlan,
  CiscoPoeStatus,
  CiscoPoePort,
  CiscoSpanningTreeInstance,
  CiscoSpanningTreePort,
  CiscoStackMember,
} from '../types';
import { logger } from '../services/logger';

export class CiscoIOSXEIntegration extends BaseIntegration {
  readonly type = 'cisco-iosxe';
  readonly name = 'Cisco IOS-XE';

  private createClient(config: CiscoIOSXEConfig): AxiosInstance {
    const baseURL = `https://${config.host}:${config.port || 443}/restconf`;

    return axios.create({
      baseURL,
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: {
        'Accept': 'application/yang-data+json',
        'Content-Type': 'application/yang-data+json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySSL ?? false,
      }),
      timeout: 15000,
    });
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const iosxeConfig = config as CiscoIOSXEConfig;

    try {
      const client = this.createClient(iosxeConfig);

      // Try to get device hostname from native config
      const response = await client.get('/data/Cisco-IOS-XE-native:native/hostname');
      const hostname = response.data?.['Cisco-IOS-XE-native:hostname'] || 'Unknown';

      return {
        success: true,
        message: `Connected to ${hostname}`,
        details: {
          hostname,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('cisco-iosxe', 'Connection test failed', { error: errorMsg });

      // Check for specific error types
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return { success: false, message: 'Authentication failed: Invalid credentials' };
        }
        if (error.response?.status === 404) {
          return { success: false, message: 'RESTCONF not enabled or endpoint not found' };
        }
        if (error.code === 'ECONNREFUSED') {
          return { success: false, message: 'Connection refused: Check host and port' };
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          return { success: false, message: 'Connection timed out' };
        }
      }

      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
      };
    }
  }

  async getData(config: IntegrationConfig, metric: string): Promise<IntegrationData> {
    const iosxeConfig = config as CiscoIOSXEConfig;
    const client = this.createClient(iosxeConfig);

    switch (metric) {
      case 'device-info':
        return this.getDeviceInfo(client);
      case 'interfaces':
        return this.getInterfaces(client);
      case 'resources':
        return this.getResources(client);
      case 'environment':
        return this.getEnvironment(client);
      case 'vlans':
        return this.getVlans(client);
      case 'poe':
        return this.getPoe(client);
      case 'spanning-tree':
        return this.getSpanningTree(client);
      case 'stack':
        return this.getStack(client);
      case 'switch-ports':
        return this.getSwitchPorts(client, iosxeConfig);
      case 'topology':
        return this.getTopology(client, iosxeConfig);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getDeviceInfo(client: AxiosInstance): Promise<{ deviceInfo: CiscoDeviceInfo }> {
    let hostname = 'Unknown';
    let model = 'Unknown';
    let serialNumber = 'Unknown';
    let softwareVersion = 'Unknown';
    let uptime = 0;
    let systemDescription = '';

    // Get hostname
    try {
      const hostnameRes = await client.get('/data/Cisco-IOS-XE-native:native/hostname');
      hostname = hostnameRes.data?.['Cisco-IOS-XE-native:hostname'] || 'Unknown';
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get hostname', { error: String(e) });
    }

    // Get device hardware info (model, serial)
    try {
      const hardwareRes = await client.get('/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware');
      const hardware = hardwareRes.data?.['Cisco-IOS-XE-device-hardware-oper:device-hardware'];

      if (hardware?.['device-inventory']) {
        const inventory = Array.isArray(hardware['device-inventory'])
          ? hardware['device-inventory'][0]
          : hardware['device-inventory'];
        model = inventory?.['part-number'] || inventory?.['hw-description'] || 'Unknown';
        serialNumber = inventory?.['serial-number'] || 'Unknown';
      }

      if (hardware?.['device-system-data']) {
        const sysData = hardware['device-system-data'];
        softwareVersion = sysData?.['software-version'] || sysData?.['boot-time'] || 'Unknown';

        // Calculate uptime from boot time if available
        if (sysData?.['current-time'] && sysData?.['boot-time']) {
          const currentTime = new Date(sysData['current-time']).getTime();
          const bootTime = new Date(sysData['boot-time']).getTime();
          uptime = Math.floor((currentTime - bootTime) / 1000);
        }
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get device hardware', { error: String(e) });
    }

    // Try alternative version endpoint
    if (softwareVersion === 'Unknown') {
      try {
        const versionRes = await client.get('/data/Cisco-IOS-XE-native:native/version');
        softwareVersion = versionRes.data?.['Cisco-IOS-XE-native:version'] || 'Unknown';
      } catch (e) {
        logger.debug('cisco-iosxe', 'Failed to get version', { error: String(e) });
      }
    }

    const deviceInfo: CiscoDeviceInfo = {
      hostname,
      model,
      serialNumber,
      softwareVersion,
      uptime,
      systemDescription,
    };

    logger.debug('cisco-iosxe', 'Fetched device info', { hostname, model });
    return { deviceInfo };
  }

  private async getInterfaces(client: AxiosInstance): Promise<{ interfaces: CiscoInterface[] }> {
    const interfaces: CiscoInterface[] = [];

    try {
      // Get interface operational state
      const response = await client.get('/data/ietf-interfaces:interfaces-state');
      const ifaceData = response.data?.['ietf-interfaces:interfaces-state']?.interface || [];
      const ifaceArray = Array.isArray(ifaceData) ? ifaceData : [ifaceData];

      for (const iface of ifaceArray) {
        if (!iface.name) continue;

        interfaces.push({
          name: iface.name,
          description: iface.description || '',
          type: iface.type || 'unknown',
          adminStatus: iface['admin-status'] === 'up' ? 'up' : 'down',
          operStatus: this.mapOperStatus(iface['oper-status']),
          speed: iface.speed || 0,
          mtu: iface.mtu || 0,
          macAddress: iface['phys-address'] || '',
          inOctets: iface.statistics?.['in-octets'] || 0,
          outOctets: iface.statistics?.['out-octets'] || 0,
          inErrors: iface.statistics?.['in-errors'] || 0,
          outErrors: iface.statistics?.['out-errors'] || 0,
          inDiscards: iface.statistics?.['in-discards'] || 0,
          outDiscards: iface.statistics?.['out-discards'] || 0,
          lastChange: iface['last-change'] ? new Date(iface['last-change']).getTime() : 0,
        });
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get interfaces-state, trying alternative', { error: String(e) });

      // Try alternative endpoint
      try {
        const response = await client.get('/data/Cisco-IOS-XE-interfaces-oper:interfaces/interface');
        const ifaceData = response.data?.['Cisco-IOS-XE-interfaces-oper:interface'] || [];
        const ifaceArray = Array.isArray(ifaceData) ? ifaceData : [ifaceData];

        for (const iface of ifaceArray) {
          if (!iface.name) continue;

          interfaces.push({
            name: iface.name,
            description: iface.description || '',
            type: iface['interface-type'] || 'unknown',
            adminStatus: iface['admin-status'] === 'if-state-up' ? 'up' : 'down',
            operStatus: iface['oper-status'] === 'if-oper-state-ready' ? 'up' : 'down',
            speed: iface.statistics?.['speed'] || 0,
            mtu: iface.mtu || 0,
            macAddress: iface['ether-state']?.['negotiated-port-speed'] || '',
            inOctets: iface.statistics?.['in-octets'] || 0,
            outOctets: iface.statistics?.['out-octets'] || 0,
            inErrors: iface.statistics?.['in-errors'] || 0,
            outErrors: iface.statistics?.['out-errors'] || 0,
            inDiscards: iface.statistics?.['in-discards-64'] || 0,
            outDiscards: iface.statistics?.['out-discards'] || 0,
            lastChange: 0,
          });
        }
      } catch (e2) {
        logger.error('cisco-iosxe', 'Failed to get interfaces', { error: String(e2) });
      }
    }

    logger.debug('cisco-iosxe', `Fetched ${interfaces.length} interfaces`);
    return { interfaces };
  }

  private mapOperStatus(status: string): CiscoInterface['operStatus'] {
    switch (status?.toLowerCase()) {
      case 'up':
      case 'if-oper-state-ready':
        return 'up';
      case 'down':
      case 'if-oper-state-no-pass':
        return 'down';
      case 'testing':
        return 'testing';
      case 'dormant':
        return 'dormant';
      case 'notpresent':
        return 'notPresent';
      case 'lowerlayerdown':
        return 'lowerLayerDown';
      default:
        return 'unknown';
    }
  }

  private async getResources(client: AxiosInstance): Promise<{ resources: CiscoResourceUsage }> {
    let cpuUsage: number | null = null;
    let memoryUsed = 0;
    let memoryFree = 0;
    let memoryTotal = 0;

    // Get CPU usage - try multiple endpoints
    try {
      const cpuRes = await client.get('/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization');
      const cpuData = cpuRes.data?.['Cisco-IOS-XE-process-cpu-oper:cpu-utilization'];

      logger.debug('cisco-iosxe', 'CPU response data', { data: JSON.stringify(cpuData) });

      // Get 5-second average - check multiple possible field names
      if (cpuData) {
        cpuUsage = cpuData['five-seconds'] ?? cpuData['five-seconds-intr'] ??
                   cpuData['one-minute'] ?? cpuData['cpu-usage-processes']?.['five-seconds'] ?? null;
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get CPU usage from primary endpoint', { error: String(e) });

      // Try alternate endpoint
      try {
        const cpuRes = await client.get('/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage');
        const cpuData = cpuRes.data?.['Cisco-IOS-XE-process-cpu-oper:cpu-usage'];
        const utilization = cpuData?.['cpu-utilization'];

        logger.debug('cisco-iosxe', 'CPU alternate response', { data: JSON.stringify(utilization) });

        if (utilization) {
          cpuUsage = utilization['five-seconds'] ?? utilization['one-minute'] ?? null;
        }
      } catch (e2) {
        logger.debug('cisco-iosxe', 'Failed to get CPU usage from alternate endpoint', { error: String(e2) });
      }
    }

    // Get memory statistics
    try {
      const memRes = await client.get('/data/Cisco-IOS-XE-process-memory-oper:memory-statistics/memory-statistic');
      const memData = memRes.data?.['Cisco-IOS-XE-process-memory-oper:memory-statistic'];

      logger.debug('cisco-iosxe', 'Memory response data', { data: JSON.stringify(memData)?.slice(0, 500) });

      const memArray = Array.isArray(memData) ? memData : (memData ? [memData] : []);

      // Sum up processor memory pools
      for (const pool of memArray) {
        if (pool?.name?.toLowerCase().includes('processor')) {
          memoryTotal += pool['total-memory'] || 0;
          memoryUsed += pool['used-memory'] || 0;
          memoryFree += pool['free-memory'] || 0;
        }
      }

      // If no processor pool found, use first available
      if (memoryTotal === 0 && memArray.length > 0) {
        const pool = memArray[0];
        memoryTotal = pool?.['total-memory'] || 0;
        memoryUsed = pool?.['used-memory'] || 0;
        memoryFree = pool?.['free-memory'] || 0;
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get memory statistics from primary endpoint', { error: String(e) });

      // Try alternate endpoint
      try {
        const memRes = await client.get('/data/Cisco-IOS-XE-process-memory-oper:memory-statistics');
        const memStats = memRes.data?.['Cisco-IOS-XE-process-memory-oper:memory-statistics'];
        const memData = memStats?.['memory-statistic'];

        logger.debug('cisco-iosxe', 'Memory alternate response', { data: JSON.stringify(memData)?.slice(0, 500) });

        const memArray = Array.isArray(memData) ? memData : (memData ? [memData] : []);

        for (const pool of memArray) {
          if (pool?.name?.toLowerCase().includes('processor')) {
            memoryTotal += pool['total-memory'] || 0;
            memoryUsed += pool['used-memory'] || 0;
            memoryFree += pool['free-memory'] || 0;
          }
        }

        if (memoryTotal === 0 && memArray.length > 0) {
          const pool = memArray[0];
          memoryTotal = pool?.['total-memory'] || 0;
          memoryUsed = pool?.['used-memory'] || 0;
          memoryFree = pool?.['free-memory'] || 0;
        }
      } catch (e2) {
        logger.debug('cisco-iosxe', 'Failed to get memory from alternate endpoint', { error: String(e2) });
      }
    }

    const memoryUsagePercent = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : null;

    const resources: CiscoResourceUsage = {
      cpuUsage: cpuUsage ?? 0,
      memoryUsed,
      memoryFree,
      memoryTotal,
      memoryUsagePercent: memoryUsagePercent ?? 0,
    };

    logger.debug('cisco-iosxe', 'Fetched resources', { cpu: cpuUsage, memPercent: memoryUsagePercent, memTotal: memoryTotal });
    return { resources };
  }

  private async getEnvironment(client: AxiosInstance): Promise<{ sensors: CiscoEnvironmentSensor[] }> {
    const sensors: CiscoEnvironmentSensor[] = [];

    try {
      const response = await client.get('/data/Cisco-IOS-XE-environment-oper:environment-sensors');
      const sensorData = response.data?.['Cisco-IOS-XE-environment-oper:environment-sensors']?.['environment-sensor'] || [];
      const sensorArray = Array.isArray(sensorData) ? sensorData : [sensorData];

      for (const sensor of sensorArray) {
        if (!sensor.name) continue;

        sensors.push({
          name: sensor.name,
          type: this.mapSensorType(sensor['sensor-type'] || sensor.name),
          value: sensor['current-reading'] || 0,
          unit: sensor['sensor-units'] || this.guessSensorUnit(sensor.name),
          status: this.mapSensorStatus(sensor.state || sensor.status),
          thresholdLow: sensor['low-critical-threshold'],
          thresholdHigh: sensor['high-critical-threshold'],
        });
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get environment sensors', { error: String(e) });
    }

    logger.debug('cisco-iosxe', `Fetched ${sensors.length} environment sensors`);
    return { sensors };
  }

  private mapSensorType(type: string): CiscoEnvironmentSensor['type'] {
    const lower = type.toLowerCase();
    if (lower.includes('temp')) return 'temperature';
    if (lower.includes('fan')) return 'fan';
    if (lower.includes('power') || lower.includes('psu') || lower.includes('ps')) return 'power';
    if (lower.includes('volt')) return 'voltage';
    if (lower.includes('current') || lower.includes('amp')) return 'current';
    return 'other';
  }

  private guessSensorUnit(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('temp')) return 'Celsius';
    if (lower.includes('fan') || lower.includes('rpm')) return 'RPM';
    if (lower.includes('volt')) return 'V';
    if (lower.includes('current') || lower.includes('amp')) return 'A';
    if (lower.includes('power') || lower.includes('watt')) return 'W';
    return '';
  }

  private mapSensorStatus(status: string): CiscoEnvironmentSensor['status'] {
    const lower = status?.toLowerCase() || '';
    if (lower.includes('normal') || lower.includes('ok') || lower.includes('green')) return 'ok';
    if (lower.includes('warning') || lower.includes('yellow')) return 'warning';
    if (lower.includes('critical') || lower.includes('red')) return 'critical';
    if (lower.includes('shutdown')) return 'shutdown';
    if (lower.includes('notpresent') || lower.includes('not present')) return 'notPresent';
    if (lower.includes('notfunction') || lower.includes('not function')) return 'notFunctioning';
    return 'ok';
  }

  private async getVlans(client: AxiosInstance): Promise<{ vlans: CiscoVlan[] }> {
    const vlans: CiscoVlan[] = [];

    try {
      const response = await client.get('/data/Cisco-IOS-XE-vlan-oper:vlans/vlan');
      const vlanData = response.data?.['Cisco-IOS-XE-vlan-oper:vlan'] || [];
      const vlanArray = Array.isArray(vlanData) ? vlanData : [vlanData];

      for (const vlan of vlanArray) {
        if (!vlan.id) continue;

        const ports: string[] = [];
        if (vlan['vlan-interfaces']) {
          const ifaceList = Array.isArray(vlan['vlan-interfaces'])
            ? vlan['vlan-interfaces']
            : [vlan['vlan-interfaces']];
          for (const iface of ifaceList) {
            if (iface.interface) ports.push(iface.interface);
          }
        }

        vlans.push({
          id: vlan.id,
          name: vlan.name || `VLAN${vlan.id}`,
          status: vlan['vlan-state'] === 'active' ? 'active' : 'suspend',
          ports,
        });
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get VLANs', { error: String(e) });
    }

    logger.debug('cisco-iosxe', `Fetched ${vlans.length} VLANs`);
    return { vlans };
  }

  private async getPoe(client: AxiosInstance): Promise<{ poe: CiscoPoeStatus[] }> {
    const poeModules: CiscoPoeStatus[] = [];

    try {
      const response = await client.get('/data/Cisco-IOS-XE-poe-oper:poe-oper-data');
      const poeData = response.data?.['Cisco-IOS-XE-poe-oper:poe-oper-data'];

      // Get module-level PoE info
      const modules = poeData?.['poe-module'] || [];
      const moduleArray = Array.isArray(modules) ? modules : [modules];

      for (const mod of moduleArray) {
        const ports: CiscoPoePort[] = [];

        // Get port-level PoE info
        const portData = poeData?.['poe-port'] || [];
        const portArray = Array.isArray(portData) ? portData : [portData];

        for (const port of portArray) {
          // Filter ports by module if module info is available
          if (mod.module && port.module && port.module !== mod.module) continue;

          ports.push({
            interface: port['intf-name'] || '',
            adminStatus: port['poe-intf-admin'] === 'auto' ? 'auto' : (port['poe-intf-admin'] === 'off' ? 'off' : 'static'),
            operStatus: port['poe-intf-oper'] === 'on' ? 'on' : (port['poe-intf-oper'] === 'faulty' ? 'faulty' : 'off'),
            power: port['power-used'] || 0,
            maxPower: port['power-available'] || 0,
            device: port['pd-description'] || '',
            class: port['power-class'] || '',
          });
        }

        poeModules.push({
          module: mod.module || 1,
          availablePower: mod['available-power'] || 0,
          usedPower: mod['used-power'] || 0,
          remainingPower: mod['remaining-power'] || 0,
          ports,
        });
      }

      // If no module info, create a single module with all ports
      if (poeModules.length === 0) {
        const ports: CiscoPoePort[] = [];
        const portData = poeData?.['poe-port'] || [];
        const portArray = Array.isArray(portData) ? portData : [portData];

        for (const port of portArray) {
          ports.push({
            interface: port['intf-name'] || '',
            adminStatus: port['poe-intf-admin'] === 'auto' ? 'auto' : (port['poe-intf-admin'] === 'off' ? 'off' : 'static'),
            operStatus: port['poe-intf-oper'] === 'on' ? 'on' : (port['poe-intf-oper'] === 'faulty' ? 'faulty' : 'off'),
            power: port['power-used'] || 0,
            maxPower: port['power-available'] || 0,
            device: port['pd-description'] || '',
            class: port['power-class'] || '',
          });
        }

        if (ports.length > 0) {
          const totalUsed = ports.reduce((sum, p) => sum + p.power, 0);
          const totalMax = ports.reduce((sum, p) => sum + p.maxPower, 0);

          poeModules.push({
            module: 1,
            availablePower: totalMax,
            usedPower: totalUsed,
            remainingPower: totalMax - totalUsed,
            ports,
          });
        }
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get PoE data (may not be a PoE switch)', { error: String(e) });
    }

    logger.debug('cisco-iosxe', `Fetched ${poeModules.length} PoE modules`);
    return { poe: poeModules };
  }

  private async getSpanningTree(client: AxiosInstance): Promise<{
    instances: CiscoSpanningTreeInstance[];
    ports: CiscoSpanningTreePort[];
  }> {
    const instances: CiscoSpanningTreeInstance[] = [];
    const ports: CiscoSpanningTreePort[] = [];

    try {
      const response = await client.get('/data/Cisco-IOS-XE-spanning-tree-oper:stp-details');
      const stpData = response.data?.['Cisco-IOS-XE-spanning-tree-oper:stp-details'];

      // Get STP instances
      const stpInstances = stpData?.['stp-instance'] || [];
      const instanceArray = Array.isArray(stpInstances) ? stpInstances : [stpInstances];

      for (const inst of instanceArray) {
        if (!inst) continue;

        instances.push({
          vlan: inst['instance-id'] || 0,
          rootBridge: inst['designated-root-address'] || '',
          rootCost: inst['root-cost'] || 0,
          rootPort: inst['root-port'] || '',
          localBridge: inst['bridge-address'] || '',
          localPriority: inst['bridge-priority'] || 32768,
          topologyChanges: inst['topology-change-count'] || 0,
          lastTopologyChange: inst['time-since-topology-change'] || 0,
        });

        // Get port states for this instance
        const instPorts = inst['stp-port'] || [];
        const portArray = Array.isArray(instPorts) ? instPorts : [instPorts];

        for (const port of portArray) {
          if (!port) continue;

          ports.push({
            interface: port['port-name'] || '',
            vlan: inst['instance-id'] || 0,
            role: this.mapStpRole(port['port-role']),
            state: this.mapStpState(port['port-state']),
            cost: port['port-cost'] || 0,
            priority: port['port-priority'] || 128,
            type: port['port-type'] || '',
          });
        }
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get STP data', { error: String(e) });
    }

    logger.debug('cisco-iosxe', `Fetched ${instances.length} STP instances, ${ports.length} ports`);
    return { instances, ports };
  }

  private mapStpRole(role: string): CiscoSpanningTreePort['role'] {
    const lower = role?.toLowerCase() || '';
    if (lower.includes('root')) return 'root';
    if (lower.includes('designated')) return 'designated';
    if (lower.includes('alternate')) return 'alternate';
    if (lower.includes('backup')) return 'backup';
    return 'disabled';
  }

  private mapStpState(state: string): CiscoSpanningTreePort['state'] {
    const lower = state?.toLowerCase() || '';
    if (lower.includes('forwarding')) return 'forwarding';
    if (lower.includes('learning')) return 'learning';
    if (lower.includes('listening')) return 'listening';
    if (lower.includes('blocking')) return 'blocking';
    return 'disabled';
  }

  private async getStack(client: AxiosInstance): Promise<{ members: CiscoStackMember[] }> {
    const members: CiscoStackMember[] = [];

    try {
      const response = await client.get('/data/Cisco-IOS-XE-stack-oper:stack-oper-data');
      const stackData = response.data?.['Cisco-IOS-XE-stack-oper:stack-oper-data'];

      const stackMembers = stackData?.['stack-member'] || [];
      const memberArray = Array.isArray(stackMembers) ? stackMembers : [stackMembers];

      for (const member of memberArray) {
        if (!member) continue;

        members.push({
          switchNumber: member['switch-num'] || 0,
          role: this.mapStackRole(member.role),
          priority: member.priority || 1,
          state: this.mapStackState(member.state),
          macAddress: member['mac-address'] || '',
          model: member['hw-version'] || '',
          serialNumber: member['serial-number'] || '',
          softwareImage: member['sw-image'] || '',
        });
      }
    } catch (e) {
      logger.debug('cisco-iosxe', 'Failed to get stack data (may not be a stacked switch)', { error: String(e) });
    }

    logger.debug('cisco-iosxe', `Fetched ${members.length} stack members`);
    return { members };
  }

  private mapStackRole(role: string): CiscoStackMember['role'] {
    const lower = role?.toLowerCase() || '';
    if (lower.includes('active') || lower.includes('master')) return 'active';
    if (lower.includes('standby')) return 'standby';
    return 'member';
  }

  private mapStackState(state: string): CiscoStackMember['state'] {
    const lower = state?.toLowerCase() || '';
    if (lower.includes('ready')) return 'ready';
    if (lower.includes('init')) return 'initializing';
    if (lower.includes('version') || lower.includes('mismatch')) return 'version-mismatch';
    if (lower.includes('waiting')) return 'waiting';
    if (lower.includes('progress')) return 'progressing';
    return 'invalid';
  }

  /**
   * Get switch ports in UniFi-compatible format for the Switch Port Overlay widget
   */
  private async getSwitchPorts(client: AxiosInstance, config: CiscoIOSXEConfig): Promise<IntegrationData> {
    // Get device info
    const { deviceInfo } = await this.getDeviceInfo(client);

    // Get interfaces
    const { interfaces } = await this.getInterfaces(client);

    // Get PoE data if available
    let poeData: CiscoPoeStatus[] = [];
    try {
      const { poe } = await this.getPoe(client);
      poeData = poe;
    } catch (e) {
      // PoE may not be available on all switches
      logger.debug('cisco-iosxe', 'PoE data not available', { error: String(e) });
    }

    // Create a map of interface name to PoE port data
    const poePortMap = new Map<string, CiscoPoePort>();
    for (const module of poeData) {
      for (const port of module.ports) {
        if (port.interface) {
          poePortMap.set(port.interface.toLowerCase(), port);
        }
      }
    }

    // Filter to physical front-panel Ethernet ports only
    // Exclude: Vlan, Loopback, Port-channel, Tunnel, Management, AppGigabitEthernet, NVE, BDI

    // First, check if switch has higher-speed interfaces (mGig, 10G, 25G, etc.)
    // If so, GigabitEthernet interfaces may be internal aliases and should be excluded
    const hasHighSpeedPorts = interfaces.some(iface => {
      const name = iface.name.toLowerCase();
      return name.startsWith('tengigabitethernet') ||
             name.startsWith('twentyfivegige') ||
             name.startsWith('fortygigabitethernet') ||
             name.startsWith('hundredgige') ||
             name.startsWith('multigig') ||
             name.match(/^te\d/) !== null ||
             name.match(/^twe\d/) !== null ||
             name.match(/^fo\d/) !== null ||
             name.match(/^hu\d/) !== null;
    });

    const physicalPorts = interfaces.filter(iface => {
      const name = iface.name.toLowerCase();

      // Exclude non-physical interfaces
      if (name.startsWith('vlan') ||
          name.startsWith('loopback') ||
          name.startsWith('lo') ||
          name.startsWith('port-channel') ||
          name.startsWith('po') ||
          name.startsWith('tunnel') ||
          name.startsWith('tu') ||
          name.startsWith('mgmt') ||
          name.startsWith('management') ||
          name.startsWith('appgigabit') ||
          name.startsWith('app') ||
          name.startsWith('nve') ||
          name.startsWith('bdi') ||
          name.startsWith('null') ||
          name.startsWith('virtual') ||
          name.startsWith('ucse') ||
          name.startsWith('internal') ||
          name.startsWith('service')) {
        return false;
      }

      // For Catalyst 9000 series and other modern switches with mGig ports,
      // exclude plain GigabitEthernet interfaces as they may be internal aliases
      if (hasHighSpeedPorts) {
        if (name.startsWith('gigabitethernet') || name.match(/^gi\d/) !== null) {
          return false;
        }
      }

      // Include only physical Ethernet ports
      // Match patterns like: Gi1/0/1, GigabitEthernet1/0/1, Te1/0/1, Fa0/1, etc.
      return name.startsWith('gigabitethernet') ||
             name.startsWith('tengigabitethernet') ||
             name.startsWith('twentyfivegige') ||
             name.startsWith('fortygigabitethernet') ||
             name.startsWith('hundredgige') ||
             name.startsWith('fastethernet') ||
             name.startsWith('multigig') ||
             name.match(/^gi\d/) !== null ||
             name.match(/^te\d/) !== null ||
             name.match(/^twe\d/) !== null ||
             name.match(/^fo\d/) !== null ||
             name.match(/^hu\d/) !== null ||
             name.match(/^fa\d/) !== null ||
             name.match(/^mg\d/) !== null ||
             name.match(/^eth\d/) !== null;
    });

    // Sort ports by interface name to get consistent ordering
    physicalPorts.sort((a, b) => {
      const aNum = this.extractSortablePortNumber(a.name);
      const bNum = this.extractSortablePortNumber(b.name);
      return aNum - bNum;
    });

    // Calculate front panel port count (ports on module slot 0)
    const frontPanelPortCount = physicalPorts.filter(iface => {
      const match = iface.name.match(/(\d+)\/(\d+)\/(\d+)$/);
      return match && parseInt(match[2]) === 0;
    }).length || 24; // Default to 24 if we can't determine

    // Transform to UniFi-compatible port_table format
    const portTable = physicalPorts.map((iface) => {
      const poePort = poePortMap.get(iface.name.toLowerCase());
      // Use the actual physical port number from the interface name
      const portIdx = this.extractPhysicalPortNumber(iface.name, frontPanelPortCount);

      // Map speed to Mbps
      let speed = 0;
      if (iface.speed) {
        // Speed might be in bits/sec or already in Mbps
        speed = iface.speed > 100000 ? Math.round(iface.speed / 1000000) : iface.speed;
      }

      return {
        port_idx: portIdx,
        name: iface.name,
        up: iface.operStatus === 'up',
        enable: iface.adminStatus === 'up',
        speed: speed,
        full_duplex: true, // Most modern ports are full duplex
        poe_enable: poePort?.adminStatus === 'auto' || poePort?.adminStatus === 'static',
        poe_power: poePort?.power || 0,
        rx_bytes: iface.inOctets || 0,
        tx_bytes: iface.outOctets || 0,
        media: this.getMediaType(iface.name, speed),
        port_poe: !!poePort,
        is_uplink: false, // Not available from Cisco API
      };
    });

    // Create synthetic UniFi-compatible device
    const device = {
      _id: config.host,
      mac: '',
      model: deviceInfo.model,
      name: deviceInfo.hostname,
      type: 'usw', // Switch type
      state: 1, // Online
      port_table: portTable,
    };

    logger.debug('cisco-iosxe', `Created switch-ports data with ${portTable.length} ports`);
    return { devices: [device] };
  }

  /**
   * Extract sortable numeric identifier from interface name (for sorting)
   * Returns a compound number that maintains correct ordering across stacks/modules
   */
  private extractSortablePortNumber(name: string): number {
    // Match patterns like Gi1/0/1, Te1/0/24, TwentyFiveGigE1/0/1, etc.
    const match = name.match(/(\d+)\/(\d+)\/(\d+)$/) ||
                  name.match(/(\d+)\/(\d+)$/) ||
                  name.match(/(\d+)$/);
    if (match) {
      // Create a sortable number from the components
      // Format: stack * 10000 + module * 100 + port
      if (match.length === 4) {
        return parseInt(match[1]) * 10000 + parseInt(match[2]) * 100 + parseInt(match[3]);
      } else if (match.length === 3) {
        return parseInt(match[1]) * 100 + parseInt(match[2]);
      }
      return parseInt(match[1]);
    }
    return 0;
  }
  /**
   * Extract the physical port number from interface name (for port_idx mapping)
   * Handles both front panel ports and expansion module ports
   * Examples:
   *   TwentyFiveGigE1/0/1 -> 1 (front panel, module 0)
   *   TwentyFiveGigE1/0/24 -> 24 (front panel, module 0)
   *   TenGigabitEthernet1/1/1 -> 25 (expansion module, module 1, offset by 24)
   *   TenGigabitEthernet1/1/4 -> 28 (expansion module, module 1, offset by 24)
   */
  private extractPhysicalPortNumber(name: string, frontPanelPortCount: number = 24): number {
    // Match patterns like 1/0/24 or 1/1/4 (stack/module/port)
    const match = name.match(/(\d+)\/(\d+)\/(\d+)$/);
    if (match) {
      const moduleSlot = parseInt(match[2]);
      const portNum = parseInt(match[3]);

      // Module slot 0 = front panel ports (1-24)
      // Module slot 1+ = expansion/uplink module ports (25+)
      if (moduleSlot >= 1) {
        // Expansion module port - add offset based on front panel port count
        return frontPanelPortCount + portNum;
      }
      return portNum;
    }

    // Match patterns like 0/24 (module/port) for older switches
    const twoPartMatch = name.match(/(\d+)\/(\d+)$/);
    if (twoPartMatch) {
      const moduleSlot = parseInt(twoPartMatch[1]);
      const portNum = parseInt(twoPartMatch[2]);

      if (moduleSlot >= 1) {
        return frontPanelPortCount + portNum;
      }
      return portNum;
    }

    // Fallback: try to get any trailing number
    const trailingMatch = name.match(/(\d+)$/);
    if (trailingMatch) {
      return parseInt(trailingMatch[1]);
    }
    return 0;
  }

  /**
   * Get network topology via CDP and LLDP neighbor discovery
   */
  private async getTopology(client: AxiosInstance, config: CiscoIOSXEConfig): Promise<{
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

    // Get local device info
    const { deviceInfo } = await this.getDeviceInfo(client);
    const localDeviceId = config.host;
    const localDeviceName = deviceInfo.hostname;

    // Try CDP neighbors first
    try {
      const cdpResponse = await client.get('/data/Cisco-IOS-XE-cdp-oper:cdp-neighbor-details/cdp-neighbor-detail');
      const cdpData = cdpResponse.data?.['Cisco-IOS-XE-cdp-oper:cdp-neighbor-detail'];
      const cdpNeighbors = Array.isArray(cdpData) ? cdpData : (cdpData ? [cdpData] : []);

      for (const neighbor of cdpNeighbors) {
        if (!neighbor['device-name']) continue;

        const localPortName = neighbor['local-intf-name'] || '';
        const localPort = this.extractPhysicalPortNumber(localPortName);
        const remotePortName = neighbor['port-id'] || '';
        const remotePort = this.extractPhysicalPortNumber(remotePortName);

        links.push({
          localDeviceId,
          localDeviceName,
          localDeviceMac: '',
          localPort,
          localPortName,
          remoteDeviceId: neighbor['device-name'] || '',
          remoteDeviceName: neighbor['device-name'] || '',
          remoteDeviceMac: '',
          remotePort,
          remotePortName,
          linkType: 'downlink', // CDP doesn't distinguish, assume downlink
        });
      }
      logger.debug('cisco-iosxe', `Found ${cdpNeighbors.length} CDP neighbors`);
    } catch (e) {
      logger.debug('cisco-iosxe', 'CDP neighbor discovery not available', { error: String(e) });
    }

    // Also try LLDP neighbors
    try {
      const lldpResponse = await client.get('/data/Cisco-IOS-XE-lldp-oper:lldp-entries/lldp-entry');
      const lldpData = lldpResponse.data?.['Cisco-IOS-XE-lldp-oper:lldp-entry'];
      const lldpNeighbors = Array.isArray(lldpData) ? lldpData : (lldpData ? [lldpData] : []);

      for (const neighbor of lldpNeighbors) {
        // Skip if we already have this connection from CDP
        const localPortName = neighbor['local-interface'] || '';
        const existingLink = links.find(l => l.localPortName === localPortName);
        if (existingLink) continue;

        const localPort = this.extractPhysicalPortNumber(localPortName);
        const remotePortName = neighbor['connecting-interface'] || '';
        const remotePort = this.extractPhysicalPortNumber(remotePortName);

        links.push({
          localDeviceId,
          localDeviceName,
          localDeviceMac: '',
          localPort,
          localPortName,
          remoteDeviceId: neighbor['device-id'] || neighbor['chassis-id'] || '',
          remoteDeviceName: neighbor['device-id'] || neighbor['chassis-id'] || '',
          remoteDeviceMac: neighbor['chassis-id'] || '',
          remotePort,
          remotePortName,
          linkType: 'downlink',
        });
      }
      logger.debug('cisco-iosxe', `Found ${lldpNeighbors.length} LLDP neighbors`);
    } catch (e) {
      logger.debug('cisco-iosxe', 'LLDP neighbor discovery not available', { error: String(e) });
    }

    logger.debug('cisco-iosxe', `Total topology links: ${links.length}`);
    return { links };
  }

  /**
   * Get media type string from interface name and speed
   */
  private getMediaType(interfaceName: string, speed: number): string {
    const name = interfaceName.toLowerCase();

    // Check interface name for SFP indicators
    // SFP ports are typically named with specific patterns
    if (name.includes('sfp') ||
        name.includes('fiber') ||
        name.includes('hundredgig') ||
        name.includes('fortygig') ||
        name.match(/^hu\d/) ||
        name.match(/^fo\d/)) {
      return 'SFP+';
    }

    // mGig/TwentyFiveGig/TenGig copper ports - NOT SFP
    if (name.includes('twentyfivegig') ||
        name.includes('multigig') ||
        name.match(/^twe\d/) ||
        name.match(/^mg\d/)) {
      return speed >= 10000 ? '10GBase-T' : speed >= 1000 ? 'GE' : 'FE';
    }

    // TenGigabitEthernet could be copper or fiber - check if it's in an uplink module slot
    // Ports on 1/1/X are typically uplink modules (often SFP)
    if (name.includes('tengig') || name.match(/^te\d/)) {
      // Check if it's in module slot 1 (uplink) vs slot 0 (front panel)
      const slotMatch = name.match(/(\d+)\/(\d+)\/(\d+)/);
      if (slotMatch && parseInt(slotMatch[2]) >= 1) {
        return 'SFP+'; // Uplink module - likely SFP
      }
      return '10GBase-T'; // Front panel - likely copper
    }

    if (speed >= 1000) {
      return 'GE';
    }
    return 'FE';
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      {
        id: 'device-info',
        name: 'Device Information',
        description: 'Hostname, model, serial, software version, uptime',
        widgetTypes: ['device-overview'],
      },
      {
        id: 'interfaces',
        name: 'Interface Status',
        description: 'Port status, speed, traffic statistics, errors',
        widgetTypes: ['interface-list', 'interface-count'],
      },
      {
        id: 'resources',
        name: 'Resource Usage',
        description: 'CPU and memory utilization',
        widgetTypes: ['resource-usage'],
      },
      {
        id: 'environment',
        name: 'Environment Sensors',
        description: 'Temperature, fan, power supply status',
        widgetTypes: ['environment-status'],
      },
      {
        id: 'vlans',
        name: 'VLAN Status',
        description: 'VLAN list with names and port assignments',
        widgetTypes: ['vlan-list'],
      },
      {
        id: 'poe',
        name: 'PoE Status',
        description: 'Power over Ethernet budget and port consumption',
        widgetTypes: ['poe-status'],
      },
      {
        id: 'spanning-tree',
        name: 'Spanning Tree',
        description: 'STP instance and port states',
        widgetTypes: ['spanning-tree-status'],
      },
      {
        id: 'stack',
        name: 'Stack Status',
        description: 'Stack member roles and health',
        widgetTypes: ['stack-status'],
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
        description: 'CDP/LLDP neighbor discovery for switch interconnections',
        widgetTypes: ['switch-ports', 'cross-switch-port-overlay'],
      },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // ============================================
      // SYSTEM - Device Information & Configuration
      // ============================================
      {
        id: 'native-hostname',
        name: 'Get Hostname',
        description: 'Get device hostname from native configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/hostname',
        implemented: true,
        category: 'System',
        documentationUrl: 'https://github.com/YangModels/yang/tree/main/vendor/cisco/xe',
      },
      {
        id: 'native-version',
        name: 'Get Software Version',
        description: 'Get IOS-XE software version',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/version',
        implemented: true,
        category: 'System',
      },
      {
        id: 'device-hardware',
        name: 'Get Device Hardware Info',
        description: 'Get device hardware inventory including model, serial number, and system data',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware',
        implemented: true,
        category: 'System',
      },
      {
        id: 'native-config',
        name: 'Get Full Native Configuration',
        description: 'Get complete device configuration in YANG native format',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native',
        implemented: false,
        category: 'System',
      },
      {
        id: 'native-banner',
        name: 'Get/Set Banner',
        description: 'Manage device login and MOTD banners',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/banner',
        implemented: false,
        category: 'System',
      },
      {
        id: 'native-clock',
        name: 'Get/Set Clock Settings',
        description: 'Manage device clock and timezone configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/clock',
        implemented: false,
        category: 'System',
      },
      {
        id: 'native-ntp',
        name: 'Get/Set NTP Configuration',
        description: 'Manage NTP server and peer settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ntp',
        implemented: false,
        category: 'System',
      },
      {
        id: 'native-logging',
        name: 'Get/Set Logging Configuration',
        description: 'Manage syslog and logging settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/logging',
        implemented: false,
        category: 'System',
      },
      {
        id: 'native-archive',
        name: 'Get/Set Archive Configuration',
        description: 'Manage configuration archive settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/archive',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-reload',
        name: 'Reload Device',
        description: 'Initiate device reload/restart',
        method: 'POST',
        endpoint: '/operations/Cisco-IOS-XE-rpc:reload',
        implemented: false,
        category: 'System',
      },
      {
        id: 'system-save-config',
        name: 'Save Configuration',
        description: 'Save running configuration to startup',
        method: 'POST',
        endpoint: '/operations/cisco-ia:save-config',
        implemented: false,
        category: 'System',
      },

      // ============================================
      // INTERFACES - Interface Management
      // ============================================
      {
        id: 'interfaces-state',
        name: 'Get Interface State (IETF)',
        description: 'Get operational state of all interfaces using IETF model',
        method: 'GET',
        endpoint: '/data/ietf-interfaces:interfaces-state',
        implemented: true,
        category: 'Interfaces',
        documentationUrl: 'https://tools.ietf.org/html/rfc8343',
      },
      {
        id: 'interfaces-oper',
        name: 'Get Interface State (Cisco)',
        description: 'Get operational state of all interfaces using Cisco native model',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-interfaces-oper:interfaces/interface',
        implemented: true,
        category: 'Interfaces',
      },
      {
        id: 'interfaces-config',
        name: 'Get Interface Configuration (IETF)',
        description: 'Get configuration of all interfaces using IETF model',
        method: 'GET',
        endpoint: '/data/ietf-interfaces:interfaces',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'native-interface-gigabit',
        name: 'Get/Set GigabitEthernet Interfaces',
        description: 'Manage GigabitEthernet interface configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet',
        implemented: false,
        category: 'Interfaces',
        parameters: [
          { name: 'name', type: 'string', required: false, description: 'Interface name (e.g., 0/0/1)' },
        ],
      },
      {
        id: 'native-interface-tengigabit',
        name: 'Get/Set TenGigabitEthernet Interfaces',
        description: 'Manage TenGigabitEthernet interface configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/interface/TenGigabitEthernet',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'native-interface-vlan',
        name: 'Get/Set VLAN Interfaces (SVIs)',
        description: 'Manage VLAN interface (SVI) configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/interface/Vlan',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'native-interface-loopback',
        name: 'Get/Set Loopback Interfaces',
        description: 'Manage Loopback interface configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/interface/Loopback',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'native-interface-port-channel',
        name: 'Get/Set Port-Channel Interfaces',
        description: 'Manage Port-Channel (LAG) interface configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/interface/Port-channel',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'native-interface-tunnel',
        name: 'Get/Set Tunnel Interfaces',
        description: 'Manage Tunnel interface configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/interface/Tunnel',
        implemented: false,
        category: 'Interfaces',
      },
      {
        id: 'interface-shutdown',
        name: 'Shutdown Interface',
        description: 'Administratively shut down an interface',
        method: 'PATCH',
        endpoint: '/data/Cisco-IOS-XE-native:native/interface/{type}={name}',
        implemented: false,
        category: 'Interfaces',
        parameters: [
          { name: 'type', type: 'string', required: true, description: 'Interface type (e.g., GigabitEthernet)' },
          { name: 'name', type: 'string', required: true, description: 'Interface name (e.g., 0/0/1)' },
        ],
      },

      // ============================================
      // RESOURCE USAGE - CPU, Memory, Processes
      // ============================================
      {
        id: 'cpu-usage',
        name: 'Get CPU Usage',
        description: 'Get CPU utilization statistics (5-sec, 1-min, 5-min averages)',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization',
        implemented: true,
        category: 'Resources',
      },
      {
        id: 'memory-statistics',
        name: 'Get Memory Statistics',
        description: 'Get memory pool statistics (processor, I/O)',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-process-memory-oper:memory-statistics/memory-statistic',
        implemented: true,
        category: 'Resources',
      },
      {
        id: 'process-list',
        name: 'Get Process List',
        description: 'Get list of running processes with CPU usage',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization/cpu-usage-processes',
        implemented: false,
        category: 'Resources',
      },
      {
        id: 'platform-software',
        name: 'Get Platform Software State',
        description: 'Get platform software component status',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-platform-software-oper:cisco-platform-software',
        implemented: false,
        category: 'Resources',
      },

      // ============================================
      // ENVIRONMENT - Sensors, Fans, Power
      // ============================================
      {
        id: 'environment-sensors',
        name: 'Get Environment Sensors',
        description: 'Get temperature, fan, and power supply sensor readings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-environment-oper:environment-sensors',
        implemented: true,
        category: 'Environment',
      },
      {
        id: 'transceiver-oper',
        name: 'Get Transceiver Information',
        description: 'Get SFP/transceiver module information and DOM readings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-transceiver-oper:transceiver-oper-data',
        implemented: false,
        category: 'Environment',
      },

      // ============================================
      // VLANS - VLAN Management
      // ============================================
      {
        id: 'vlan-oper',
        name: 'Get VLAN Operational State',
        description: 'Get operational state of all VLANs',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-vlan-oper:vlans/vlan',
        implemented: true,
        category: 'VLANs',
      },
      {
        id: 'native-vlan-config',
        name: 'Get/Set VLAN Configuration',
        description: 'Manage VLAN database configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/vlan',
        implemented: false,
        category: 'VLANs',
      },
      {
        id: 'vlan-create',
        name: 'Create VLAN',
        description: 'Create a new VLAN',
        method: 'POST',
        endpoint: '/data/Cisco-IOS-XE-native:native/vlan/vlan-list',
        implemented: false,
        category: 'VLANs',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'VLAN ID (1-4094)' },
          { name: 'name', type: 'string', required: false, description: 'VLAN name' },
        ],
      },
      {
        id: 'vlan-delete',
        name: 'Delete VLAN',
        description: 'Delete an existing VLAN',
        method: 'DELETE',
        endpoint: '/data/Cisco-IOS-XE-native:native/vlan/vlan-list={id}',
        implemented: false,
        category: 'VLANs',
        parameters: [
          { name: 'id', type: 'number', required: true, description: 'VLAN ID' },
        ],
      },

      // ============================================
      // POE - Power over Ethernet
      // ============================================
      {
        id: 'poe-oper',
        name: 'Get PoE Operational State',
        description: 'Get Power over Ethernet status for all ports',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-poe-oper:poe-oper-data',
        implemented: true,
        category: 'PoE',
      },
      {
        id: 'native-poe-config',
        name: 'Get/Set PoE Configuration',
        description: 'Manage PoE port configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet={name}/power',
        implemented: false,
        category: 'PoE',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Interface name' },
        ],
      },

      // ============================================
      // SPANNING TREE - STP Management
      // ============================================
      {
        id: 'stp-details',
        name: 'Get Spanning Tree Details',
        description: 'Get Spanning Tree protocol state for all instances',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-spanning-tree-oper:stp-details',
        implemented: true,
        category: 'Spanning Tree',
      },
      {
        id: 'native-stp-config',
        name: 'Get/Set Spanning Tree Configuration',
        description: 'Manage Spanning Tree global configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/spanning-tree',
        implemented: false,
        category: 'Spanning Tree',
      },

      // ============================================
      // STACK - Switch Stack Management
      // ============================================
      {
        id: 'stack-oper',
        name: 'Get Stack Operational State',
        description: 'Get switch stack member status and roles',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-stack-oper:stack-oper-data',
        implemented: true,
        category: 'Stack',
      },
      {
        id: 'native-stack-config',
        name: 'Get/Set Stack Configuration',
        description: 'Manage switch stack configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/switch',
        implemented: false,
        category: 'Stack',
      },

      // ============================================
      // ROUTING - Static Routes, Routing Protocols
      // ============================================
      {
        id: 'routing-state',
        name: 'Get Routing State (IETF)',
        description: 'Get routing table using IETF model',
        method: 'GET',
        endpoint: '/data/ietf-routing:routing-state',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'fib-oper',
        name: 'Get FIB (Forwarding Information Base)',
        description: 'Get Forwarding Information Base entries',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-fib-oper:fib-oper-data',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'native-ip-route',
        name: 'Get/Set Static Routes',
        description: 'Manage static route configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ip/route',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'native-router-ospf',
        name: 'Get/Set OSPF Configuration',
        description: 'Manage OSPF routing protocol configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/router/router-ospf',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'ospf-oper',
        name: 'Get OSPF Operational State',
        description: 'Get OSPF neighbors, routes, and protocol state',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-ospf-oper:ospf-oper-data',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'native-router-eigrp',
        name: 'Get/Set EIGRP Configuration',
        description: 'Manage EIGRP routing protocol configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/router/eigrp',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'eigrp-oper',
        name: 'Get EIGRP Operational State',
        description: 'Get EIGRP neighbors and topology state',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-eigrp-oper:eigrp-oper-data',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'native-router-bgp',
        name: 'Get/Set BGP Configuration',
        description: 'Manage BGP routing protocol configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/router/bgp',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'bgp-oper',
        name: 'Get BGP Operational State',
        description: 'Get BGP neighbors, routes, and protocol state',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-bgp-oper:bgp-state-data',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'native-router-rip',
        name: 'Get/Set RIP Configuration',
        description: 'Manage RIP routing protocol configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/router/rip',
        implemented: false,
        category: 'Routing',
      },
      {
        id: 'vrf-config',
        name: 'Get/Set VRF Configuration',
        description: 'Manage VRF (Virtual Routing and Forwarding) configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/vrf',
        implemented: false,
        category: 'Routing',
      },

      // ============================================
      // ACL - Access Control Lists
      // ============================================
      {
        id: 'native-ip-access-list-standard',
        name: 'Get/Set Standard ACLs',
        description: 'Manage standard IP access control lists',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ip/access-list/standard',
        implemented: false,
        category: 'ACL',
      },
      {
        id: 'native-ip-access-list-extended',
        name: 'Get/Set Extended ACLs',
        description: 'Manage extended IP access control lists',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ip/access-list/extended',
        implemented: false,
        category: 'ACL',
      },
      {
        id: 'acl-oper',
        name: 'Get ACL Operational Data',
        description: 'Get ACL hit counts and statistics',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-acl-oper:access-lists',
        implemented: false,
        category: 'ACL',
      },

      // ============================================
      // NAT - Network Address Translation
      // ============================================
      {
        id: 'native-ip-nat',
        name: 'Get/Set NAT Configuration',
        description: 'Manage NAT pool and translation configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ip/nat',
        implemented: false,
        category: 'NAT',
      },
      {
        id: 'nat-oper',
        name: 'Get NAT Translations',
        description: 'Get active NAT translation entries',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-nat-oper:nat-data',
        implemented: false,
        category: 'NAT',
      },

      // ============================================
      // QOS - Quality of Service
      // ============================================
      {
        id: 'native-policy-map',
        name: 'Get/Set Policy Maps',
        description: 'Manage QoS policy-map configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/policy/policy-map',
        implemented: false,
        category: 'QoS',
      },
      {
        id: 'native-class-map',
        name: 'Get/Set Class Maps',
        description: 'Manage QoS class-map configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/policy/class-map',
        implemented: false,
        category: 'QoS',
      },
      {
        id: 'qos-oper',
        name: 'Get QoS Statistics',
        description: 'Get QoS policy statistics and counters',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-interfaces-oper:interfaces/interface/diffserv-info',
        implemented: false,
        category: 'QoS',
      },

      // ============================================
      // AAA - Authentication, Authorization, Accounting
      // ============================================
      {
        id: 'native-aaa',
        name: 'Get/Set AAA Configuration',
        description: 'Manage AAA authentication and authorization settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/aaa',
        implemented: false,
        category: 'AAA',
      },
      {
        id: 'native-username',
        name: 'Get/Set Local Users',
        description: 'Manage local user accounts',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/username',
        implemented: false,
        category: 'AAA',
      },
      {
        id: 'native-tacacs',
        name: 'Get/Set TACACS+ Configuration',
        description: 'Manage TACACS+ server configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/tacacs',
        implemented: false,
        category: 'AAA',
      },
      {
        id: 'native-radius',
        name: 'Get/Set RADIUS Configuration',
        description: 'Manage RADIUS server configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/radius',
        implemented: false,
        category: 'AAA',
      },

      // ============================================
      // SNMP - Simple Network Management Protocol
      // ============================================
      {
        id: 'native-snmp',
        name: 'Get/Set SNMP Configuration',
        description: 'Manage SNMP community strings and trap settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/snmp-server',
        implemented: false,
        category: 'SNMP',
      },

      // ============================================
      // DHCP - Dynamic Host Configuration Protocol
      // ============================================
      {
        id: 'native-dhcp',
        name: 'Get/Set DHCP Configuration',
        description: 'Manage DHCP server and pool configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ip/dhcp',
        implemented: false,
        category: 'DHCP',
      },
      {
        id: 'dhcp-oper',
        name: 'Get DHCP Bindings',
        description: 'Get active DHCP lease bindings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-dhcp-oper:dhcp-oper-data',
        implemented: false,
        category: 'DHCP',
      },

      // ============================================
      // ARP - Address Resolution Protocol
      // ============================================
      {
        id: 'arp-oper',
        name: 'Get ARP Table',
        description: 'Get ARP cache entries',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-arp-oper:arp-data',
        implemented: false,
        category: 'ARP',
      },
      {
        id: 'native-arp',
        name: 'Get/Set Static ARP Entries',
        description: 'Manage static ARP entries',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/arp',
        implemented: false,
        category: 'ARP',
      },

      // ============================================
      // CDP/LLDP - Discovery Protocols
      // ============================================
      {
        id: 'cdp-neighbor-details',
        name: 'Get CDP Neighbors',
        description: 'Get CDP neighbor discovery information',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-cdp-oper:cdp-neighbor-details',
        implemented: false,
        category: 'Discovery',
      },
      {
        id: 'lldp-entries',
        name: 'Get LLDP Neighbors',
        description: 'Get LLDP neighbor discovery information',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-lldp-oper:lldp-entries',
        implemented: false,
        category: 'Discovery',
      },
      {
        id: 'native-cdp',
        name: 'Get/Set CDP Configuration',
        description: 'Manage CDP global and interface settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/cdp',
        implemented: false,
        category: 'Discovery',
      },
      {
        id: 'native-lldp',
        name: 'Get/Set LLDP Configuration',
        description: 'Manage LLDP global and interface settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/lldp',
        implemented: false,
        category: 'Discovery',
      },

      // ============================================
      // ETHERNET / L2 - Layer 2 Features
      // ============================================
      {
        id: 'mac-address-table',
        name: 'Get MAC Address Table',
        description: 'Get MAC address table entries',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-matm-oper:matm-oper-data',
        implemented: false,
        category: 'Layer 2',
      },
      {
        id: 'native-mac-acl',
        name: 'Get/Set MAC Access Lists',
        description: 'Manage MAC address access lists',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/mac/access-list',
        implemented: false,
        category: 'Layer 2',
      },
      {
        id: 'etherchannel-oper',
        name: 'Get EtherChannel Status',
        description: 'Get port-channel operational state',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-ethernet-oper:ethernet-oper-data',
        implemented: false,
        category: 'Layer 2',
      },

      // ============================================
      // WIRELESS - Wireless LAN (for wireless controllers)
      // ============================================
      {
        id: 'wireless-client-oper',
        name: 'Get Wireless Clients',
        description: 'Get connected wireless client information',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-wireless-client-oper:client-oper-data',
        implemented: false,
        category: 'Wireless',
      },
      {
        id: 'wireless-ap-oper',
        name: 'Get Access Point Status',
        description: 'Get wireless access point operational state',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-wireless-access-point-oper:access-point-oper-data',
        implemented: false,
        category: 'Wireless',
      },
      {
        id: 'wireless-wlan-config',
        name: 'Get/Set WLAN Configuration',
        description: 'Manage WLAN/SSID configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-data',
        implemented: false,
        category: 'Wireless',
      },

      // ============================================
      // VPN / CRYPTO - VPN and Encryption
      // ============================================
      {
        id: 'native-crypto',
        name: 'Get/Set Crypto Configuration',
        description: 'Manage IPSec and crypto settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/crypto',
        implemented: false,
        category: 'VPN',
      },
      {
        id: 'crypto-ipsec-sa',
        name: 'Get IPSec Security Associations',
        description: 'Get active IPSec SA information',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-crypto-oper:crypto-oper-data',
        implemented: false,
        category: 'VPN',
      },

      // ============================================
      // MULTICAST - Multicast Routing
      // ============================================
      {
        id: 'mcast-oper',
        name: 'Get Multicast State',
        description: 'Get multicast routing and group information',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-mcast-oper:mcast-oper-data',
        implemented: false,
        category: 'Multicast',
      },
      {
        id: 'native-ip-pim',
        name: 'Get/Set PIM Configuration',
        description: 'Manage PIM multicast routing configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ip/pim',
        implemented: false,
        category: 'Multicast',
      },
      {
        id: 'native-ip-igmp',
        name: 'Get/Set IGMP Configuration',
        description: 'Manage IGMP snooping and settings',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ip/igmp',
        implemented: false,
        category: 'Multicast',
      },

      // ============================================
      // NETFLOW - Traffic Monitoring
      // ============================================
      {
        id: 'native-flow',
        name: 'Get/Set NetFlow Configuration',
        description: 'Manage NetFlow/Flexible NetFlow configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/flow',
        implemented: false,
        category: 'NetFlow',
      },
      {
        id: 'netflow-oper',
        name: 'Get NetFlow Statistics',
        description: 'Get NetFlow cache and export statistics',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-flow-monitor-oper:flow-monitors',
        implemented: false,
        category: 'NetFlow',
      },

      // ============================================
      // IP SLA - IP Service Level Agreements
      // ============================================
      {
        id: 'native-ip-sla',
        name: 'Get/Set IP SLA Configuration',
        description: 'Manage IP SLA probe configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/ip/sla',
        implemented: false,
        category: 'IP SLA',
      },
      {
        id: 'ip-sla-stats',
        name: 'Get IP SLA Statistics',
        description: 'Get IP SLA probe results and statistics',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-ip-sla-oper:ip-sla-stats',
        implemented: false,
        category: 'IP SLA',
      },

      // ============================================
      // OBJECT TRACKING
      // ============================================
      {
        id: 'native-track',
        name: 'Get/Set Object Tracking Configuration',
        description: 'Manage object tracking configuration',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-native:native/track',
        implemented: false,
        category: 'Tracking',
      },

      // ============================================
      // HSRP/VRRP - First Hop Redundancy
      // ============================================
      {
        id: 'hsrp-oper',
        name: 'Get HSRP State',
        description: 'Get HSRP group operational state',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-hsrp-oper:hsrp-oper-data',
        implemented: false,
        category: 'FHRP',
      },
      {
        id: 'vrrp-oper',
        name: 'Get VRRP State',
        description: 'Get VRRP group operational state',
        method: 'GET',
        endpoint: '/data/Cisco-IOS-XE-vrrp-oper:vrrp-oper-data',
        implemented: false,
        category: 'FHRP',
      },
    ];
  }
}
