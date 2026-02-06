import axios, { AxiosInstance } from 'axios';
import {
  BaseIntegration,
  ConnectionTestResult,
  MetricInfo,
  ApiCapability,
} from './base';
import { IntegrationData } from '../types';
import {
  ControlDConfig,
  ControlDProfile,
  ControlDDevice,
  ControlDFilter,
  ControlDService,
  ControlDServiceCategory,
  ControlDCustomRule,
  ControlDRuleFolder,
  ControlDKnownIP,
  ControlDProxy,
  ControlDUser,
} from '../types';

export class ControlDIntegration extends BaseIntegration {
  readonly type = 'controld';
  readonly name = 'ControlD';

  private createClient(config: ControlDConfig): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.controld.com',
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(config: ControlDConfig): Promise<ConnectionTestResult> {
    try {
      const client = this.createClient(config);
      const response = await client.get('/users');

      if (response.data?.success && response.data?.body) {
        const user = response.data.body as ControlDUser;
        return {
          success: true,
          message: `Connected as ${user.email}${user.org ? ` (${user.org.name})` : ''}`,
        };
      }

      return {
        success: false,
        message: 'Invalid API response',
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number; data?: { message?: string } } };
      if (err.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid API token',
        };
      }
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
      };
    }
  }

  async getData(config: ControlDConfig, metric: string): Promise<IntegrationData> {
    const client = this.createClient(config);

    switch (metric) {
      case 'overview':
        return this.getOverview(client);
      case 'devices':
        return this.getDevices(client);
      case 'profiles':
        return this.getProfiles(client);
      case 'filters':
        return this.getFilters(client);
      case 'services':
        return this.getServices(client);
      case 'rules':
        return this.getRules(client);
      case 'known-ips':
        return this.getKnownIPs(client);
      case 'proxies':
        return this.getProxies(client);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private async getOverview(client: AxiosInstance): Promise<IntegrationData> {
    const [userResp, profilesResp, devicesResp] = await Promise.all([
      client.get('/users'),
      client.get('/profiles'),
      client.get('/devices'),
    ]);

    const user = userResp.data.body as ControlDUser;
    const profiles = (profilesResp.data.body?.profiles || []) as ControlDProfile[];
    const devices = (devicesResp.data.body?.devices || []) as ControlDDevice[];

    const activeDevices = devices.filter(d => d.status === 1).length;
    const pendingDevices = devices.filter(d => d.status === 0).length;
    const disabledDevices = devices.filter(d => d.status === 2 || d.status === 3).length;

    const totalFilters = profiles.reduce((sum, p) => sum + (p.profile?.flt?.count ?? 0), 0);
    const totalRules = profiles.reduce((sum, p) => sum + (p.profile?.rule?.count ?? 0), 0);
    const totalServices = profiles.reduce((sum, p) => sum + (p.profile?.svc?.count ?? 0), 0);

    return {
      user: {
        email: user?.email || 'Unknown',
        organization: user?.org?.name || null,
        role: user?.org?.role || null,
      },
      counts: {
        profiles: profiles.length,
        devices: devices.length,
        activeDevices,
        pendingDevices,
        disabledDevices,
      },
      stats: {
        totalFilters,
        totalRules,
        totalServices,
      },
    };
  }

  private async getDevices(client: AxiosInstance): Promise<IntegrationData> {
    const response = await client.get('/devices');
    const devices = (response.data.body?.devices || []) as ControlDDevice[];

    return {
      devices: devices.map(device => ({
        pk: device.PK,
        name: device.name || 'Unnamed Device',
        description: device.desc || '',
        deviceId: device.device_id || '',
        status: device.status ?? 0,
        statusLabel: this.getDeviceStatusLabel(device.status ?? 0),
        learnIp: device.learn_ip === 1,
        restricted: device.restricted === 1,
        analyticsLevel: device.stats ?? 0,
        icon: device.icon || '',
        profile: device.profile ? {
          pk: device.profile.PK || '',
          name: device.profile.name || 'Default',
        } : { pk: '', name: 'Unknown' },
        resolvers: device.resolvers ? {
          uid: device.resolvers.uid || '',
          doh: device.resolvers.doh || '',
          dot: device.resolvers.dot || '',
          ipv4: device.resolvers.ipv4 || [],
          ipv6: device.resolvers.ipv6 || [],
        } : { uid: '', doh: '', dot: '', ipv4: [], ipv6: [] },
        ddns: device.ddns?.status === 1 ? {
          hostname: device.ddns.hostname || '',
          subdomain: device.ddns.subdomain || '',
        } : null,
        created: device.ts || 0,
      })),
      total: devices.length,
    };
  }

  private async getProfiles(client: AxiosInstance): Promise<IntegrationData> {
    const response = await client.get('/profiles');
    const profiles = (response.data.body?.profiles || []) as ControlDProfile[];

    return {
      profiles: profiles.map(profile => ({
        pk: profile.PK,
        name: profile.name || 'Unknown',
        updated: profile.updated || 0,
        analyticsLevel: profile.stats ?? 0,
        counts: {
          filters: profile.profile?.flt?.count ?? 0,
          counterFilters: profile.profile?.cflt?.count ?? 0,
          ipFilters: profile.profile?.ipflt?.count ?? 0,
          rules: profile.profile?.rule?.count ?? 0,
          services: profile.profile?.svc?.count ?? 0,
          folders: profile.profile?.grp?.count ?? 0,
          options: profile.profile?.opt?.count ?? 0,
        },
        deviceCount: profile.profile?.da?.length ?? 0,
      })),
      total: profiles.length,
    };
  }

  private async getFilters(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [nativeResp, thirdPartyResp] = await Promise.allSettled([
        client.get('/filters'),
        client.get('/filters3'),
      ]);

      const nativeFilters = nativeResp.status === 'fulfilled'
        ? ((nativeResp.value.data.body?.filters || []) as ControlDFilter[])
        : [];
      const thirdPartyFilters = thirdPartyResp.status === 'fulfilled'
        ? ((thirdPartyResp.value.data.body?.filters || []) as ControlDFilter[])
        : [];

      return {
        nativeFilters: nativeFilters.map(f => ({
          pk: f.PK,
          name: f.name || 'Unknown',
          description: f.description || '',
          category: f.category || 'Unknown',
          sources: f.sources || 0,
          domainCount: f.count || 0,
          type: 'native',
        })),
        thirdPartyFilters: thirdPartyFilters.map(f => ({
          pk: f.PK,
          name: f.name || 'Unknown',
          description: f.description || '',
          category: f.category || 'Unknown',
          sources: f.sources || 0,
          domainCount: f.count || 0,
          type: 'thirdparty',
        })),
        totalNative: nativeFilters.length,
        totalThirdParty: thirdPartyFilters.length,
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number } };
      if (err.response?.status === 403 || err.response?.status === 404) {
        return {
          nativeFilters: [],
          thirdPartyFilters: [],
          totalNative: 0,
          totalThirdParty: 0,
          message: 'Filters feature requires elevated permissions'
        };
      }
      throw error;
    }
  }

  private async getServices(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const [servicesResp, categoriesResp] = await Promise.allSettled([
        client.get('/services'),
        client.get('/services/categories'),
      ]);

      const services = servicesResp.status === 'fulfilled'
        ? ((servicesResp.value.data.body?.services || []) as ControlDService[])
        : [];
      const categories = categoriesResp.status === 'fulfilled'
        ? ((categoriesResp.value.data.body?.categories || []) as ControlDServiceCategory[])
        : [];

      return {
        services: services.map(s => ({
          pk: s.PK,
          name: s.name || 'Unknown',
          description: s.description || '',
          category: s.category || 'Unknown',
          icon: s.icon || '',
          warning: s.warning || null,
          unlockLocations: s.unlock_location || [],
        })),
        categories: categories.map(c => ({
          pk: c.PK,
          name: c.name || 'Unknown',
          count: c.count || 0,
        })),
        totalServices: services.length,
        totalCategories: categories.length,
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number } };
      if (err.response?.status === 404) {
        return {
          services: [],
          categories: [],
          totalServices: 0,
          totalCategories: 0,
          message: 'Services feature not available'
        };
      }
      throw error;
    }
  }

  private async getRules(client: AxiosInstance): Promise<IntegrationData> {
    try {
      // Get profiles first to fetch rules from each
      const profilesResp = await client.get('/profiles');
      const profiles = (profilesResp.data.body?.profiles || []) as ControlDProfile[];

      const allRules: Array<{
        profilePk: string;
        profileName: string;
        rules: Array<{
          pk: string;
          order: number;
          group: string;
          action: number;
          actionLabel: string;
          actionTarget: string;
          hostnames: string[];
          created: number;
        }>;
        folders: Array<{
          pk: string;
          name: string;
          count: number;
          order: number;
        }>;
      }> = [];

      // Fetch rules for each profile (limit to first 5 profiles to avoid rate limiting)
      for (const profile of profiles.slice(0, 5)) {
        try {
          const [rulesResp, foldersResp] = await Promise.allSettled([
            client.get(`/profiles/${profile.PK}/rules`),
            client.get(`/profiles/${profile.PK}/groups`),
          ]);

          const rules = rulesResp.status === 'fulfilled'
            ? ((rulesResp.value.data.body?.rules || []) as ControlDCustomRule[])
            : [];
          const folders = foldersResp.status === 'fulfilled'
            ? ((foldersResp.value.data.body?.groups || []) as ControlDRuleFolder[])
            : [];

          allRules.push({
            profilePk: profile.PK,
            profileName: profile.name || 'Unknown',
            rules: rules.map(r => ({
              pk: r.PK,
              order: r.order || 0,
              group: r.group || '',
              action: r.action?.status ?? 0,
              actionLabel: this.getRuleActionLabel(r.action?.status ?? 0),
              actionTarget: r.action?.do || '',
              hostnames: r.hostnames || [],
              created: r.ts || 0,
            })),
            folders: folders.map(f => ({
              pk: f.PK,
              name: f.name || 'Unknown',
              count: f.count || 0,
              order: f.order || 0,
            })),
          });
        } catch {
          // Skip profiles with no access to rules
        }
      }

      return {
        profileRules: allRules,
        totalProfiles: allRules.length,
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number } };
      if (err.response?.status === 403 || err.response?.status === 404) {
        return { profileRules: [], totalProfiles: 0, message: 'Rules feature not available' };
      }
      throw error;
    }
  }

  private async getKnownIPs(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/access');
      const ips = (response.data.body?.ips || []) as ControlDKnownIP[];

      return {
        knownIPs: ips.map(ip => ({
          pk: ip.PK,
          ip: ip.ip || 'Unknown',
          created: ip.ts || 0,
          lastUsed: ip.last_used || 0,
          geo: ip.geo ? {
            country: ip.geo.country || 'Unknown',
            city: ip.geo.city || 'Unknown',
            asn: ip.geo.asn || 0,
            asnOrg: ip.geo.asn_org || 'Unknown',
          } : { country: 'Unknown', city: 'Unknown', asn: 0, asnOrg: 'Unknown' },
        })),
        total: ips.length,
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number } };
      // 400/404 may indicate feature not available for this account
      if (err.response?.status === 400 || err.response?.status === 404) {
        return { knownIPs: [], total: 0, message: 'Known IPs feature not available' };
      }
      throw error;
    }
  }

  private async getProxies(client: AxiosInstance): Promise<IntegrationData> {
    try {
      const response = await client.get('/proxies');
      const proxies = (response.data.body?.proxies || []) as ControlDProxy[];

      // Group by country
      const byCountry: Record<string, ControlDProxy[]> = {};
      for (const proxy of proxies) {
        const country = proxy.country || 'Unknown';
        if (!byCountry[country]) {
          byCountry[country] = [];
        }
        byCountry[country].push(proxy);
      }

      return {
        proxies: proxies.map(p => ({
          pk: p.PK,
          city: p.city || 'Unknown',
          country: p.country || 'Unknown',
          countryName: p.country_name || p.country || 'Unknown',
          latitude: p.gps?.lat ?? null,
          longitude: p.gps?.long ?? null,
        })),
        byCountry: Object.entries(byCountry).map(([country, locs]) => ({
          country,
          countryName: locs[0]?.country_name || country,
          locations: locs.map(l => ({ pk: l.PK, city: l.city || 'Unknown' })),
          count: locs.length,
        })),
        total: proxies.length,
        totalCountries: Object.keys(byCountry).length,
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { status?: number } };
      if (err.response?.status === 404) {
        return { proxies: [], byCountry: [], total: 0, totalCountries: 0 };
      }
      throw error;
    }
  }

  private getDeviceStatusLabel(status: number): string {
    switch (status) {
      case 0:
        return 'Pending';
      case 1:
        return 'Active';
      case 2:
        return 'Soft Disabled';
      case 3:
        return 'Hard Disabled';
      default:
        return 'Unknown';
    }
  }

  private getRuleActionLabel(action: number): string {
    switch (action) {
      case 0:
        return 'Bypass';
      case 1:
        return 'Block';
      case 2:
        return 'Redirect';
      case 3:
        return 'Spoof';
      default:
        return 'Unknown';
    }
  }

  getAvailableMetrics(): MetricInfo[] {
    return [
      { id: 'overview', name: 'Overview', description: 'Account summary with device and profile counts', widgetTypes: ['controld-overview'] },
      { id: 'devices', name: 'Devices', description: 'DNS endpoints with status and profiles', widgetTypes: ['controld-devices'] },
      { id: 'profiles', name: 'Profiles', description: 'DNS profiles with filter and rule counts', widgetTypes: ['controld-profiles'] },
      { id: 'filters', name: 'Filters', description: 'Available native and third-party filters', widgetTypes: ['controld-filters'] },
      { id: 'services', name: 'Services', description: 'Available services by category', widgetTypes: ['controld-services'] },
      { id: 'rules', name: 'Custom Rules', description: 'Custom DNS rules by profile', widgetTypes: ['controld-rules'] },
      { id: 'known-ips', name: 'Known IPs', description: 'Authorized IP addresses', widgetTypes: ['controld-ips'] },
      { id: 'proxies', name: 'Proxy Locations', description: 'Available proxy endpoints', widgetTypes: ['controld-proxies'] },
    ];
  }

  getApiCapabilities(): ApiCapability[] {
    return [
      // Users - Implemented
      {
        id: 'users-get',
        name: 'Get User',
        description: 'Get current user account information including email and organization',
        method: 'GET',
        endpoint: '/users',
        implemented: true,
        category: 'Users',
        documentationUrl: 'https://docs.controld.com/reference/get_users',
      },
      {
        id: 'users-update',
        name: 'Update User',
        description: 'Update user account settings',
        method: 'PUT',
        endpoint: '/users',
        implemented: false,
        category: 'Users',
      },
      {
        id: 'users-delete',
        name: 'Delete User',
        description: 'Delete user account',
        method: 'DELETE',
        endpoint: '/users',
        implemented: false,
        category: 'Users',
      },

      // Profiles - Implemented
      {
        id: 'profiles-list',
        name: 'List Profiles',
        description: 'Get all DNS profiles with their filter, rule, and service counts',
        method: 'GET',
        endpoint: '/profiles',
        implemented: true,
        category: 'Profiles',
        documentationUrl: 'https://docs.controld.com/reference/get_profiles',
      },
      {
        id: 'profiles-get',
        name: 'Get Profile',
        description: 'Get a specific profile by ID',
        method: 'GET',
        endpoint: '/profiles/{profileId}',
        implemented: false,
        category: 'Profiles',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
        ],
      },
      {
        id: 'profiles-create',
        name: 'Create Profile',
        description: 'Create a new DNS profile',
        method: 'POST',
        endpoint: '/profiles',
        implemented: false,
        category: 'Profiles',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Profile name' },
          { name: 'stats', type: 'number', required: false, description: 'Analytics level (0-2)' },
        ],
      },
      {
        id: 'profiles-update',
        name: 'Update Profile',
        description: 'Update a profile name or settings',
        method: 'PUT',
        endpoint: '/profiles/{profileId}',
        implemented: false,
        category: 'Profiles',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'name', type: 'string', required: false, description: 'Profile name' },
          { name: 'stats', type: 'number', required: false, description: 'Analytics level' },
        ],
      },
      {
        id: 'profiles-delete',
        name: 'Delete Profile',
        description: 'Delete a DNS profile',
        method: 'DELETE',
        endpoint: '/profiles/{profileId}',
        implemented: false,
        category: 'Profiles',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
        ],
      },
      {
        id: 'profiles-clone',
        name: 'Clone Profile',
        description: 'Clone an existing profile',
        method: 'POST',
        endpoint: '/profiles/{profileId}/clone',
        implemented: false,
        category: 'Profiles',
      },

      // Profile Filters
      {
        id: 'profile-filters-list',
        name: 'List Profile Filters',
        description: 'Get filters enabled on a profile',
        method: 'GET',
        endpoint: '/profiles/{profileId}/filters',
        implemented: false,
        category: 'Profile Filters',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
        ],
      },
      {
        id: 'profile-filters-add',
        name: 'Add Profile Filter',
        description: 'Enable a filter on a profile',
        method: 'POST',
        endpoint: '/profiles/{profileId}/filters/{filterId}',
        implemented: false,
        category: 'Profile Filters',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'filterId', type: 'string', required: true, description: 'Filter ID' },
          { name: 'status', type: 'number', required: false, description: 'Filter status (1=block)' },
        ],
      },
      {
        id: 'profile-filters-remove',
        name: 'Remove Profile Filter',
        description: 'Disable a filter on a profile',
        method: 'DELETE',
        endpoint: '/profiles/{profileId}/filters/{filterId}',
        implemented: false,
        category: 'Profile Filters',
      },

      // Profile Services
      {
        id: 'profile-services-list',
        name: 'List Profile Services',
        description: 'Get services configured on a profile',
        method: 'GET',
        endpoint: '/profiles/{profileId}/services',
        implemented: false,
        category: 'Profile Services',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
        ],
      },
      {
        id: 'profile-services-add',
        name: 'Add Profile Service',
        description: 'Configure a service on a profile (block, bypass, or redirect)',
        method: 'POST',
        endpoint: '/profiles/{profileId}/services/{serviceId}',
        implemented: false,
        category: 'Profile Services',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'serviceId', type: 'string', required: true, description: 'Service ID' },
          { name: 'status', type: 'number', required: true, description: 'Action (0=bypass, 1=block, 2=redirect)' },
          { name: 'do', type: 'string', required: false, description: 'Redirect location (for status=2)' },
        ],
      },
      {
        id: 'profile-services-remove',
        name: 'Remove Profile Service',
        description: 'Remove a service configuration from a profile',
        method: 'DELETE',
        endpoint: '/profiles/{profileId}/services/{serviceId}',
        implemented: false,
        category: 'Profile Services',
      },

      // Custom Rules - Partially Implemented
      {
        id: 'profile-rules-list',
        name: 'List Custom Rules',
        description: 'Get custom DNS rules for a profile',
        method: 'GET',
        endpoint: '/profiles/{profileId}/rules',
        implemented: true,
        category: 'Custom Rules',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
        ],
        documentationUrl: 'https://docs.controld.com/reference/get_profiles-profile_pk-rules',
      },
      {
        id: 'profile-rules-create',
        name: 'Create Custom Rule',
        description: 'Create a new custom DNS rule',
        method: 'POST',
        endpoint: '/profiles/{profileId}/rules',
        implemented: false,
        category: 'Custom Rules',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'hostnames', type: 'array', required: true, description: 'Array of hostnames to match' },
          { name: 'action', type: 'object', required: true, description: 'Action object with status and optional do' },
          { name: 'group', type: 'string', required: false, description: 'Folder/group ID' },
        ],
      },
      {
        id: 'profile-rules-update',
        name: 'Update Custom Rule',
        description: 'Update an existing custom rule',
        method: 'PUT',
        endpoint: '/profiles/{profileId}/rules/{ruleId}',
        implemented: false,
        category: 'Custom Rules',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'ruleId', type: 'string', required: true, description: 'Rule ID' },
        ],
      },
      {
        id: 'profile-rules-delete',
        name: 'Delete Custom Rule',
        description: 'Delete a custom rule',
        method: 'DELETE',
        endpoint: '/profiles/{profileId}/rules/{ruleId}',
        implemented: false,
        category: 'Custom Rules',
      },

      // Rule Folders/Groups - Implemented
      {
        id: 'profile-groups-list',
        name: 'List Rule Folders',
        description: 'Get rule folders/groups for a profile',
        method: 'GET',
        endpoint: '/profiles/{profileId}/groups',
        implemented: true,
        category: 'Custom Rules',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
        ],
      },
      {
        id: 'profile-groups-create',
        name: 'Create Rule Folder',
        description: 'Create a new rule folder/group',
        method: 'POST',
        endpoint: '/profiles/{profileId}/groups',
        implemented: false,
        category: 'Custom Rules',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'name', type: 'string', required: true, description: 'Folder name' },
        ],
      },
      {
        id: 'profile-groups-delete',
        name: 'Delete Rule Folder',
        description: 'Delete a rule folder/group',
        method: 'DELETE',
        endpoint: '/profiles/{profileId}/groups/{groupId}',
        implemented: false,
        category: 'Custom Rules',
      },

      // Profile Options
      {
        id: 'profile-options-get',
        name: 'Get Profile Options',
        description: 'Get profile DNS options (TTL, DNSSEC, etc.)',
        method: 'GET',
        endpoint: '/profiles/{profileId}/options',
        implemented: false,
        category: 'Profile Options',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
        ],
      },
      {
        id: 'profile-options-set',
        name: 'Set Profile Option',
        description: 'Configure a profile DNS option',
        method: 'POST',
        endpoint: '/profiles/{profileId}/options/{optionId}',
        implemented: false,
        category: 'Profile Options',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'optionId', type: 'string', required: true, description: 'Option ID' },
          { name: 'value', type: 'any', required: true, description: 'Option value' },
        ],
      },

      // Default Rule
      {
        id: 'profile-default-rule-get',
        name: 'Get Default Rule',
        description: 'Get the default rule for unmatched queries',
        method: 'GET',
        endpoint: '/profiles/{profileId}/default',
        implemented: false,
        category: 'Default Rule',
      },
      {
        id: 'profile-default-rule-set',
        name: 'Set Default Rule',
        description: 'Set the default action for unmatched queries',
        method: 'PUT',
        endpoint: '/profiles/{profileId}/default',
        implemented: false,
        category: 'Default Rule',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'status', type: 'number', required: true, description: 'Action (0=bypass, 2=redirect)' },
          { name: 'do', type: 'string', required: false, description: 'Redirect location' },
        ],
      },

      // Devices - Implemented
      {
        id: 'devices-list',
        name: 'List Devices',
        description: 'Get all DNS endpoints/devices',
        method: 'GET',
        endpoint: '/devices',
        implemented: true,
        category: 'Devices',
        documentationUrl: 'https://docs.controld.com/reference/get_devices',
      },
      {
        id: 'devices-list-users',
        name: 'List User Devices',
        description: 'Get only User type devices',
        method: 'GET',
        endpoint: '/devices/users',
        implemented: false,
        category: 'Devices',
      },
      {
        id: 'devices-list-routers',
        name: 'List Router Devices',
        description: 'Get only Router type devices',
        method: 'GET',
        endpoint: '/devices/routers',
        implemented: false,
        category: 'Devices',
      },
      {
        id: 'devices-get',
        name: 'Get Device',
        description: 'Get a specific device by ID',
        method: 'GET',
        endpoint: '/devices/{deviceId}',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
        ],
      },
      {
        id: 'devices-create',
        name: 'Create Device',
        description: 'Create a new DNS endpoint/device',
        method: 'POST',
        endpoint: '/devices',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Device name' },
          { name: 'profile_id', type: 'string', required: true, description: 'Profile ID to enforce' },
          { name: 'icon', type: 'string', required: false, description: 'Device icon' },
          { name: 'desc', type: 'string', required: false, description: 'Device description' },
        ],
      },
      {
        id: 'devices-update',
        name: 'Update Device',
        description: 'Update device settings',
        method: 'PUT',
        endpoint: '/devices/{deviceId}',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
          { name: 'name', type: 'string', required: false, description: 'Device name' },
          { name: 'profile_id', type: 'string', required: false, description: 'Profile ID' },
          { name: 'status', type: 'number', required: false, description: 'Status (0-3)' },
        ],
      },
      {
        id: 'devices-delete',
        name: 'Delete Device',
        description: 'Delete a device',
        method: 'DELETE',
        endpoint: '/devices/{deviceId}',
        implemented: false,
        category: 'Devices',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
        ],
      },

      // Device DDNS
      {
        id: 'devices-ddns-get',
        name: 'Get Device DDNS',
        description: 'Get DDNS settings for a device',
        method: 'GET',
        endpoint: '/devices/{deviceId}/ddns',
        implemented: false,
        category: 'Device DDNS',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
        ],
      },
      {
        id: 'devices-ddns-set',
        name: 'Set Device DDNS',
        description: 'Configure DDNS for a device',
        method: 'PUT',
        endpoint: '/devices/{deviceId}/ddns',
        implemented: false,
        category: 'Device DDNS',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Device ID' },
          { name: 'status', type: 'number', required: true, description: 'DDNS status (0=off, 1=on)' },
          { name: 'subdomain', type: 'string', required: false, description: 'DDNS subdomain' },
        ],
      },

      // Device Clients (Router sub-devices)
      {
        id: 'device-clients-list',
        name: 'List Device Clients',
        description: 'Get clients connected to a router device',
        method: 'GET',
        endpoint: '/devices/{deviceId}/clients',
        implemented: false,
        category: 'Device Clients',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Router device ID' },
        ],
      },
      {
        id: 'device-clients-create',
        name: 'Create Device Client',
        description: 'Create a client under a router device',
        method: 'POST',
        endpoint: '/devices/{deviceId}/clients',
        implemented: false,
        category: 'Device Clients',
        parameters: [
          { name: 'deviceId', type: 'string', required: true, description: 'Router device ID' },
          { name: 'name', type: 'string', required: true, description: 'Client name' },
          { name: 'client_id', type: 'string', required: true, description: 'Client identifier (IP or MAC)' },
        ],
      },

      // Filters - Implemented
      {
        id: 'filters-native',
        name: 'List Native Filters',
        description: 'Get all available native filters',
        method: 'GET',
        endpoint: '/filters',
        implemented: true,
        category: 'Filters',
        documentationUrl: 'https://docs.controld.com/reference/get_filters',
      },
      {
        id: 'filters-thirdparty',
        name: 'List Third-Party Filters',
        description: 'Get all available third-party filters',
        method: 'GET',
        endpoint: '/filters3',
        implemented: true,
        category: 'Filters',
      },

      // Services - Implemented
      {
        id: 'services-list',
        name: 'List Services',
        description: 'Get all available services',
        method: 'GET',
        endpoint: '/services',
        implemented: true,
        category: 'Services',
        documentationUrl: 'https://docs.controld.com/reference/get_services',
      },
      {
        id: 'services-categories',
        name: 'List Service Categories',
        description: 'Get service categories',
        method: 'GET',
        endpoint: '/services/categories',
        implemented: true,
        category: 'Services',
      },

      // Proxies - Implemented
      {
        id: 'proxies-list',
        name: 'List Proxy Locations',
        description: 'Get all available proxy exit locations',
        method: 'GET',
        endpoint: '/proxies',
        implemented: true,
        category: 'Proxies',
        documentationUrl: 'https://docs.controld.com/reference/get_proxies',
      },

      // Access / Known IPs - Implemented
      {
        id: 'access-list',
        name: 'List Known IPs',
        description: 'Get all authorized IP addresses',
        method: 'GET',
        endpoint: '/access',
        implemented: true,
        category: 'Access',
        documentationUrl: 'https://docs.controld.com/reference/get_access',
      },
      {
        id: 'access-add',
        name: 'Add Known IP',
        description: 'Add a new authorized IP address',
        method: 'POST',
        endpoint: '/access',
        implemented: false,
        category: 'Access',
        parameters: [
          { name: 'ip', type: 'string', required: true, description: 'IP address to authorize' },
        ],
      },
      {
        id: 'access-delete',
        name: 'Delete Known IP',
        description: 'Remove an authorized IP address',
        method: 'DELETE',
        endpoint: '/access/{ipId}',
        implemented: false,
        category: 'Access',
        parameters: [
          { name: 'ipId', type: 'string', required: true, description: 'Known IP ID' },
        ],
      },

      // Analytics / Statistics
      {
        id: 'analytics-queries',
        name: 'Get Query Analytics',
        description: 'Get DNS query analytics and statistics',
        method: 'GET',
        endpoint: '/analytics/queries',
        implemented: false,
        category: 'Analytics',
        parameters: [
          { name: 'profile_id', type: 'string', required: false, description: 'Filter by profile' },
          { name: 'device_id', type: 'string', required: false, description: 'Filter by device' },
          { name: 'start', type: 'string', required: false, description: 'Start timestamp' },
          { name: 'end', type: 'string', required: false, description: 'End timestamp' },
        ],
      },
      {
        id: 'analytics-top-blocked',
        name: 'Get Top Blocked Domains',
        description: 'Get most frequently blocked domains',
        method: 'GET',
        endpoint: '/analytics/top/blocked',
        implemented: false,
        category: 'Analytics',
      },
      {
        id: 'analytics-top-resolved',
        name: 'Get Top Resolved Domains',
        description: 'Get most frequently resolved domains',
        method: 'GET',
        endpoint: '/analytics/top/resolved',
        implemented: false,
        category: 'Analytics',
      },
      {
        id: 'analytics-top-clients',
        name: 'Get Top Clients',
        description: 'Get clients with most queries',
        method: 'GET',
        endpoint: '/analytics/top/clients',
        implemented: false,
        category: 'Analytics',
      },

      // Query Log
      {
        id: 'logs-queries',
        name: 'Get Query Logs',
        description: 'Get raw DNS query logs',
        method: 'GET',
        endpoint: '/logs/queries',
        implemented: false,
        category: 'Logs',
        parameters: [
          { name: 'profile_id', type: 'string', required: false, description: 'Filter by profile' },
          { name: 'device_id', type: 'string', required: false, description: 'Filter by device' },
          { name: 'action', type: 'string', required: false, description: 'Filter by action (block, bypass, redirect)' },
          { name: 'limit', type: 'number', required: false, description: 'Number of entries to return' },
        ],
      },

      // Organizations
      {
        id: 'orgs-list',
        name: 'List Organizations',
        description: 'Get sub-organizations (for business accounts)',
        method: 'GET',
        endpoint: '/organizations',
        implemented: false,
        category: 'Organizations',
        documentationUrl: 'https://docs.controld.com/reference/get_organizations',
      },
      {
        id: 'orgs-get',
        name: 'Get Organization',
        description: 'Get a specific sub-organization',
        method: 'GET',
        endpoint: '/organizations/{orgId}',
        implemented: false,
        category: 'Organizations',
      },
      {
        id: 'orgs-create',
        name: 'Create Organization',
        description: 'Create a new sub-organization',
        method: 'POST',
        endpoint: '/organizations',
        implemented: false,
        category: 'Organizations',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Organization name' },
        ],
      },
      {
        id: 'orgs-delete',
        name: 'Delete Organization',
        description: 'Delete a sub-organization',
        method: 'DELETE',
        endpoint: '/organizations/{orgId}',
        implemented: false,
        category: 'Organizations',
      },

      // Members
      {
        id: 'members-list',
        name: 'List Members',
        description: 'Get organization members',
        method: 'GET',
        endpoint: '/members',
        implemented: false,
        category: 'Members',
      },
      {
        id: 'members-invite',
        name: 'Invite Member',
        description: 'Invite a new organization member',
        method: 'POST',
        endpoint: '/members',
        implemented: false,
        category: 'Members',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'Member email' },
          { name: 'role', type: 'string', required: true, description: 'Member role' },
        ],
      },
      {
        id: 'members-update',
        name: 'Update Member',
        description: 'Update member role or permissions',
        method: 'PUT',
        endpoint: '/members/{memberId}',
        implemented: false,
        category: 'Members',
      },
      {
        id: 'members-remove',
        name: 'Remove Member',
        description: 'Remove a member from organization',
        method: 'DELETE',
        endpoint: '/members/{memberId}',
        implemented: false,
        category: 'Members',
      },

      // API Tokens
      {
        id: 'tokens-list',
        name: 'List API Tokens',
        description: 'Get all API tokens',
        method: 'GET',
        endpoint: '/tokens',
        implemented: false,
        category: 'API Tokens',
      },
      {
        id: 'tokens-create',
        name: 'Create API Token',
        description: 'Create a new API token',
        method: 'POST',
        endpoint: '/tokens',
        implemented: false,
        category: 'API Tokens',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Token name' },
          { name: 'type', type: 'string', required: true, description: 'Token type (read/write)' },
        ],
      },
      {
        id: 'tokens-update',
        name: 'Update API Token',
        description: 'Update token name or settings',
        method: 'PUT',
        endpoint: '/tokens/{tokenId}',
        implemented: false,
        category: 'API Tokens',
      },
      {
        id: 'tokens-delete',
        name: 'Delete API Token',
        description: 'Revoke an API token',
        method: 'DELETE',
        endpoint: '/tokens/{tokenId}',
        implemented: false,
        category: 'API Tokens',
      },

      // Schedules
      {
        id: 'schedules-list',
        name: 'List Schedules',
        description: 'Get all scheduled rule changes',
        method: 'GET',
        endpoint: '/schedules',
        implemented: false,
        category: 'Schedules',
      },
      {
        id: 'schedules-create',
        name: 'Create Schedule',
        description: 'Create a new schedule for automatic rule changes',
        method: 'POST',
        endpoint: '/schedules',
        implemented: false,
        category: 'Schedules',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Schedule name' },
          { name: 'profile_id', type: 'string', required: true, description: 'Profile to modify' },
          { name: 'start', type: 'string', required: true, description: 'Start time' },
          { name: 'end', type: 'string', required: true, description: 'End time' },
        ],
      },
      {
        id: 'schedules-delete',
        name: 'Delete Schedule',
        description: 'Delete a schedule',
        method: 'DELETE',
        endpoint: '/schedules/{scheduleId}',
        implemented: false,
        category: 'Schedules',
      },

      // IP Filters
      {
        id: 'profile-ipfilters-list',
        name: 'List IP Filters',
        description: 'Get IP-based filters for a profile',
        method: 'GET',
        endpoint: '/profiles/{profileId}/ipfilters',
        implemented: false,
        category: 'IP Filters',
      },
      {
        id: 'profile-ipfilters-add',
        name: 'Add IP Filter',
        description: 'Add an IP-based filter rule',
        method: 'POST',
        endpoint: '/profiles/{profileId}/ipfilters',
        implemented: false,
        category: 'IP Filters',
        parameters: [
          { name: 'profileId', type: 'string', required: true, description: 'Profile ID' },
          { name: 'ip', type: 'string', required: true, description: 'IP address or CIDR range' },
          { name: 'action', type: 'number', required: true, description: 'Action (0=bypass, 1=block)' },
        ],
      },

      // Counter Filters
      {
        id: 'profile-counterfilters-list',
        name: 'List Counter Filters',
        description: 'Get counter-filter exclusions for a profile',
        method: 'GET',
        endpoint: '/profiles/{profileId}/counterfilters',
        implemented: false,
        category: 'Counter Filters',
      },
      {
        id: 'profile-counterfilters-add',
        name: 'Add Counter Filter',
        description: 'Add a counter-filter exclusion',
        method: 'POST',
        endpoint: '/profiles/{profileId}/counterfilters',
        implemented: false,
        category: 'Counter Filters',
      },
    ];
  }
}
