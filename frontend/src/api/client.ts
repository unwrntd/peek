import axios from 'axios';
import {
  Integration,
  Widget,
  WidgetWithLayout,
  LogEntry,
  ConnectionTestResult,
  MetricInfo,
  IntegrationType,
  DashboardLayout,
  WidgetGroup,
  GroupMember,
  GroupLayout,
  Dashboard,
  DashboardExport,
  IntegrationMapping,
  BrandingSettings,
  NetworkToolResponse,
  ImageLibrary,
  LibraryImage,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Integration API
export const integrationApi = {
  getAll: async (): Promise<Integration[]> => {
    const response = await api.get('/integrations');
    return response.data;
  },

  getById: async (id: string): Promise<Integration> => {
    const response = await api.get(`/integrations/${id}`);
    return response.data;
  },

  create: async (data: Omit<Integration, 'id' | 'created_at' | 'updated_at'>): Promise<Integration> => {
    const response = await api.post('/integrations', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Integration>): Promise<Integration> => {
    const response = await api.put(`/integrations/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/integrations/${id}`);
  },

  testConnection: async (id: string): Promise<ConnectionTestResult> => {
    const response = await api.post(`/integrations/${id}/test`);
    return response.data;
  },
};

// Widget API
export const widgetApi = {
  getAll: async (): Promise<Widget[]> => {
    const response = await api.get('/widgets');
    return response.data;
  },

  getById: async (id: string): Promise<Widget> => {
    const response = await api.get(`/widgets/${id}`);
    return response.data;
  },

  getByIntegration: async (integrationId: string): Promise<Widget[]> => {
    const response = await api.get(`/widgets/integration/${integrationId}`);
    return response.data;
  },

  create: async (data: Omit<Widget, 'id'>): Promise<Widget> => {
    const response = await api.post('/widgets', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Widget>): Promise<Widget> => {
    const response = await api.put(`/widgets/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/widgets/${id}`);
  },
};

// Dashboard API (for widget layouts within a dashboard)
export const dashboardApi = {
  getLayout: async (dashboardId?: string): Promise<WidgetWithLayout[]> => {
    const params = dashboardId ? { dashboardId } : {};
    const response = await api.get('/dashboard', { params });
    return response.data;
  },

  updateWidgetLayout: async (
    widgetId: string,
    layout: Omit<DashboardLayout, 'widget_id'>,
    dashboardId?: string
  ): Promise<DashboardLayout> => {
    const response = await api.put(`/dashboard/layout/${widgetId}`, { ...layout, dashboardId });
    return response.data;
  },

  updateLayouts: async (layouts: DashboardLayout[], dashboardId?: string): Promise<{ updated: number }> => {
    const response = await api.put('/dashboard/layouts', { layouts, dashboardId });
    return response.data;
  },

  addWidgetToDashboard: async (
    widgetId: string,
    layout: { x: number; y: number; w: number; h: number },
    dashboardId?: string
  ): Promise<DashboardLayout> => {
    const response = await api.post('/dashboard/widgets', { widgetId, ...layout, dashboardId });
    return response.data;
  },

  removeWidgetFromDashboard: async (widgetId: string, dashboardId?: string): Promise<void> => {
    const params = dashboardId ? { dashboardId } : {};
    await api.delete(`/dashboard/widgets/${widgetId}`, { params });
  },
};

// Dashboards API (for managing multiple dashboards)
export const dashboardsApi = {
  getAll: async (): Promise<Dashboard[]> => {
    const response = await api.get('/dashboards');
    return response.data;
  },

  getDefault: async (): Promise<Dashboard> => {
    const response = await api.get('/dashboards/default');
    return response.data;
  },

  getById: async (id: string): Promise<Dashboard> => {
    const response = await api.get(`/dashboards/${id}`);
    return response.data;
  },

  getBySlug: async (slug: string): Promise<Dashboard> => {
    const response = await api.get(`/dashboards/by-slug/${slug}`);
    return response.data;
  },

  create: async (data: { name: string; description?: string }): Promise<Dashboard> => {
    const response = await api.post('/dashboards', data);
    return response.data;
  },

  update: async (id: string, data: { name?: string; description?: string; kiosk_slug?: string }): Promise<Dashboard> => {
    const response = await api.put(`/dashboards/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/dashboards/${id}`);
  },

  setDefault: async (id: string): Promise<Dashboard> => {
    const response = await api.put(`/dashboards/${id}/default`);
    return response.data;
  },

  duplicate: async (id: string, name?: string): Promise<Dashboard> => {
    const response = await api.post(`/dashboards/${id}/duplicate`, { name });
    return response.data;
  },

  export: async (id: string): Promise<DashboardExport> => {
    const response = await api.get(`/dashboards/${id}/export`);
    return response.data;
  },

  import: async (data: DashboardExport, mappings: IntegrationMapping): Promise<Dashboard> => {
    const response = await api.post('/dashboards/import', { data, mappings });
    return response.data;
  },
};

// API Capability type
export interface ApiCapability {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  implemented: boolean;
  category?: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
  documentationUrl?: string;
}

// Capability execution types
export interface CapabilityExecuteRequest {
  capabilityId: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  parameters?: Record<string, unknown>;
}

export interface CapabilityExecuteResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode?: number;
  timing: number;
}

// Data API
export const dataApi = {
  getData: async <T = unknown>(integrationId: string, metric: string, signal?: AbortSignal): Promise<T> => {
    const response = await api.get(`/data/${integrationId}/${metric}`, { signal });
    return response.data;
  },

  getMetrics: async (type: string): Promise<MetricInfo[]> => {
    const response = await api.get(`/data/metrics/${type}`);
    return response.data;
  },

  getCapabilities: async (type: string): Promise<ApiCapability[]> => {
    const response = await api.get(`/data/capabilities/${type}`);
    return response.data;
  },

  executeCapability: async (
    integrationId: string,
    request: CapabilityExecuteRequest
  ): Promise<CapabilityExecuteResponse> => {
    const response = await api.post(`/integrations/${integrationId}/capability`, request, {
      timeout: 60000, // 60 second timeout for capability execution
    });
    return response.data;
  },
};

// Logs API
export const logsApi = {
  getLogs: async (params?: {
    level?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<LogEntry[]> => {
    const response = await api.get('/logs', { params });
    return response.data;
  },

  clearLogs: async (olderThanDays?: number): Promise<void> => {
    await api.delete('/logs', { params: { olderThanDays } });
  },
};

// Integration types API
export const getIntegrationTypes = async (): Promise<IntegrationType[]> => {
  const response = await api.get('/integration-types');
  return response.data;
};

// Groups API
export const groupsApi = {
  getAll: async (dashboardId?: string): Promise<WidgetGroup[]> => {
    const params = dashboardId ? { dashboardId } : {};
    const response = await api.get('/groups', { params });
    return response.data;
  },

  create: async (data: {
    title: string;
    config?: Record<string, unknown>;
    layout?: GroupLayout;
    dashboardId?: string;
  }): Promise<WidgetGroup> => {
    const response = await api.post('/groups', data);
    return response.data;
  },

  // Batch create: creates group with members in a single request
  createWithMembers: async (data: {
    title: string;
    config?: Record<string, unknown>;
    layout?: GroupLayout;
    members?: Array<{ widget_id: string; x?: number; y?: number; w?: number; h?: number }>;
    dashboardId?: string;
  }): Promise<WidgetGroup> => {
    const response = await api.post('/groups/batch', data);
    return response.data;
  },

  update: async (id: string, data: { title?: string; config?: Record<string, unknown> }): Promise<void> => {
    await api.put(`/groups/${id}`, data);
  },

  delete: async (id: string, dashboardId?: string): Promise<void> => {
    const params = dashboardId ? { dashboardId } : {};
    await api.delete(`/groups/${id}`, { params });
  },

  addMember: async (
    groupId: string,
    data: { widget_id: string; x?: number; y?: number; w?: number; h?: number; dashboardId?: string }
  ): Promise<GroupMember> => {
    const response = await api.post(`/groups/${groupId}/members`, data);
    return response.data;
  },

  removeMember: async (groupId: string, widgetId: string, dashboardId?: string): Promise<void> => {
    const params = dashboardId ? { dashboardId } : {};
    await api.delete(`/groups/${groupId}/members/${widgetId}`, { params });
  },

  updateMemberLayouts: async (
    groupId: string,
    layouts: Array<{ widget_id: string; x: number; y: number; w: number; h: number }>,
    dashboardId?: string
  ): Promise<void> => {
    await api.put(`/groups/${groupId}/layouts`, { layouts, dashboardId });
  },

  updateLayout: async (groupId: string, layout: GroupLayout, dashboardId?: string): Promise<void> => {
    await api.put(`/groups/${groupId}/layout`, { ...layout, dashboardId });
  },
};

// Settings API
export const settingsApi = {
  getBranding: async (): Promise<BrandingSettings> => {
    const response = await api.get('/settings/branding');
    return response.data;
  },

  updateBranding: async (data: Partial<BrandingSettings>): Promise<BrandingSettings> => {
    const response = await api.put('/settings/branding', data);
    return response.data;
  },

  uploadLogo: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await api.post('/settings/branding/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadFavicon: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('favicon', file);
    const response = await api.post('/settings/branding/favicon', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  exportConfig: async (): Promise<Record<string, unknown>> => {
    const response = await api.get('/settings/export');
    return response.data;
  },

  importConfig: async (config: unknown): Promise<{
    success: boolean;
    message: string;
    results: {
      integrations: { imported: number; skipped: number; errors: string[] };
      dashboards: { imported: number; skipped: number; errors: string[] };
      widgets: { imported: number; errors: string[] };
      groups: { imported: number; errors: string[] };
      branding: { imported: boolean };
    };
  }> => {
    const response = await api.post('/settings/import', config);
    return response.data;
  },

  resetEverything: async (confirmation: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/settings/reset', { confirmation });
    return response.data;
  },

  getSystemStatus: async (): Promise<{
    cpu: { model: string; cores: number; usage: number };
    memory: { total: number; used: number; free: number; usagePercent: number };
    disk: { total: number; used: number; free: number; usagePercent: number };
    system: { hostname: string; platform: string; arch: string; uptime: number; nodeVersion: string };
    storage: { databaseSize: number; uploadsSize: number; totalAppSize: number };
  }> => {
    const response = await api.get('/settings/system-status');
    return response.data;
  },

  getSwitchTemplates: async (): Promise<SwitchTemplateData[]> => {
    const response = await api.get('/settings/switch-templates');
    return response.data;
  },

  saveSwitchTemplates: async (templates: SwitchTemplateData[]): Promise<SwitchTemplateData[]> => {
    const response = await api.put('/settings/switch-templates', templates);
    return response.data;
  },

  getTemplateEditorSettings: async (): Promise<TemplateEditorSettings> => {
    const response = await api.get('/settings/template-editor');
    return response.data;
  },

  saveTemplateEditorSettings: async (settings: TemplateEditorSettings): Promise<TemplateEditorSettings> => {
    const response = await api.put('/settings/template-editor', settings);
    return response.data;
  },

  getDeviceTemplates: async (): Promise<DeviceTemplateData[]> => {
    const response = await api.get('/settings/device-templates');
    return response.data;
  },

  saveDeviceTemplates: async (templates: DeviceTemplateData[]): Promise<DeviceTemplateData[]> => {
    const response = await api.put('/settings/device-templates', templates);
    return response.data;
  },

  getDeviceTemplateEditorSettings: async (): Promise<TemplateEditorSettings> => {
    const response = await api.get('/settings/device-template-editor');
    return response.data;
  },

  saveDeviceTemplateEditorSettings: async (settings: TemplateEditorSettings): Promise<TemplateEditorSettings> => {
    const response = await api.put('/settings/device-template-editor', settings);
    return response.data;
  },

  // Network configuration
  getNetworkDevices: async (): Promise<NetworkDeviceData[]> => {
    const response = await api.get('/settings/network-devices');
    return response.data;
  },

  saveNetworkDevices: async (devices: NetworkDeviceData[]): Promise<NetworkDeviceData[]> => {
    const response = await api.put('/settings/network-devices', devices);
    return response.data;
  },

  getNetworkConnections: async (): Promise<NetworkConnectionData[]> => {
    const response = await api.get('/settings/network-connections');
    return response.data;
  },

  saveNetworkConnections: async (connections: NetworkConnectionData[]): Promise<NetworkConnectionData[]> => {
    const response = await api.put('/settings/network-connections', connections);
    return response.data;
  },

  getNetworkPortMappings: async (): Promise<PortMappingData[]> => {
    const response = await api.get('/settings/network-port-mappings');
    return response.data;
  },

  saveNetworkPortMappings: async (mappings: PortMappingData[]): Promise<PortMappingData[]> => {
    const response = await api.put('/settings/network-port-mappings', mappings);
    return response.data;
  },

  getNetworkNicMappings: async (): Promise<NicMappingData[]> => {
    const response = await api.get('/settings/network-nic-mappings');
    return response.data;
  },

  saveNetworkNicMappings: async (mappings: NicMappingData[]): Promise<NicMappingData[]> => {
    const response = await api.put('/settings/network-nic-mappings', mappings);
    return response.data;
  },

  getNetworkDeviceConnections: async (): Promise<DeviceConnectionData[]> => {
    const response = await api.get('/settings/network-device-connections');
    return response.data;
  },

  saveNetworkDeviceConnections: async (connections: DeviceConnectionData[]): Promise<DeviceConnectionData[]> => {
    const response = await api.put('/settings/network-device-connections', connections);
    return response.data;
  },

  // Manual switches for network map
  getManualSwitches: async (): Promise<ManualSwitchData[]> => {
    const response = await api.get('/settings/manual-switches');
    return response.data;
  },

  saveManualSwitches: async (switches: ManualSwitchData[]): Promise<ManualSwitchData[]> => {
    const response = await api.put('/settings/manual-switches', switches);
    return response.data;
  },
};

// Manual switch data type
export interface ManualSwitchData {
  id: string;
  name: string;
  model?: string;
  mac?: string;
  ip?: string;
  portCount?: number;
}

// Template editor settings type
export interface TemplateEditorSettings {
  indicatorSize: number;
  snapToGrid: boolean;
  gridSize: number;
}

// Switch template data type for API
export interface SwitchTemplateData {
  id: string;
  vendor: string;
  model: string;
  displayName: string;
  image: { url?: string; embedded?: string };
  aspectRatio: number;
  ports: Array<{
    number: number;
    label?: string;
    x: number;
    y: number;
    type: string;
    row?: number;
  }>;
  modelPatterns?: string[];
}

// Device template data type for API
export interface DeviceTemplateData {
  id: string;
  vendor: string;
  model: string;
  displayName: string;
  deviceType: string;
  deviceNameDisplay?: {
    show: boolean;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    textAlign: 'left' | 'center' | 'right';
  };
  image: { url?: string; embedded?: string };
  aspectRatio: number;
  nics: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    type: string;
    speed?: number;
  }>;
  modelPatterns?: string[];
}

// Network configuration types for API
export interface NetworkDeviceData {
  id: string;
  hostname: string;
  ipAddress?: string;
  macAddress?: string;
  deviceType: 'server' | 'ap' | 'camera' | 'printer' | 'workstation' | 'iot' | 'phone' | 'nas' | 'router' | 'other';
  description?: string;
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkConnectionData {
  localWidgetId: string;
  localPort: number;
  remoteWidgetId: string;
  remotePort: number;
  label?: string;
  discoveryMethod?: 'manual' | 'unifi' | 'lldp' | 'cdp';
}

export interface PortMappingData {
  widgetId: string;
  port: number;
  hostname: string;
  description?: string;
  deviceType?: 'server' | 'ap' | 'camera' | 'printer' | 'workstation' | 'iot' | 'phone' | 'nas' | 'router' | 'other';
  ipAddress?: string;
}

export interface NicMappingData {
  deviceWidgetId: string;
  nicId: string;
  switchWidgetId: string;
  switchPort: number;
  label?: string;
  vlan?: string;
  linkSpeed?: number;
  bondGroup?: string;
}

// Device-based connections (stored by device ID, not widget ID)
export interface DeviceConnectionData {
  localDeviceId: string;
  localDeviceName: string;
  localPort: number;
  remoteDeviceId: string;
  remoteDeviceName: string;
  remotePort: number;
  label?: string;
  discoveryMethod?: 'manual' | 'unifi' | 'lldp' | 'cdp';
}

// Network Tools API
export const networkApi = {
  ping: async (host: string, count?: number): Promise<NetworkToolResponse> => {
    const response = await api.post('/network/ping', { host, count }, { timeout: 60000 });
    return response.data;
  },

  traceroute: async (host: string, maxHops?: number): Promise<NetworkToolResponse> => {
    const response = await api.post('/network/traceroute', { host, maxHops }, { timeout: 180000 });
    return response.data;
  },

  dnsLookup: async (hostname: string): Promise<NetworkToolResponse> => {
    const response = await api.post('/network/dns', { hostname });
    return response.data;
  },

  portCheck: async (host: string, port: number, timeout?: number): Promise<NetworkToolResponse> => {
    const response = await api.post('/network/port', { host, port, timeout });
    return response.data;
  },

  whois: async (host: string): Promise<NetworkToolResponse> => {
    const response = await api.post('/network/whois', { host }, { timeout: 60000 });
    return response.data;
  },
};

// Media API (Image Libraries)
export const mediaApi = {
  // Libraries
  getLibraries: async (): Promise<ImageLibrary[]> => {
    const response = await api.get('/media/libraries');
    return response.data;
  },

  createLibrary: async (data: { name: string; description?: string }): Promise<ImageLibrary> => {
    const response = await api.post('/media/libraries', data);
    return response.data;
  },

  updateLibrary: async (id: string, data: { name?: string; description?: string }): Promise<ImageLibrary> => {
    const response = await api.put(`/media/libraries/${id}`, data);
    return response.data;
  },

  deleteLibrary: async (id: string): Promise<void> => {
    await api.delete(`/media/libraries/${id}`);
  },

  // Images
  getLibraryImages: async (libraryId: string): Promise<LibraryImage[]> => {
    const response = await api.get(`/media/libraries/${libraryId}/images`);
    return response.data;
  },

  uploadImages: async (
    libraryId: string,
    files: File[],
    onProgress?: (progress: number) => void
  ): Promise<LibraryImage[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    const response = await api.post(`/media/libraries/${libraryId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 minute timeout for large uploads
      onUploadProgress: onProgress
        ? (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            onProgress(progress);
          }
        : undefined,
    });
    return response.data;
  },

  updateImage: async (imageId: string, data: { alt_text?: string; original_name?: string }): Promise<LibraryImage> => {
    const response = await api.put(`/media/images/${imageId}`, data);
    return response.data;
  },

  deleteImage: async (imageId: string): Promise<void> => {
    await api.delete(`/media/images/${imageId}`);
  },

  bulkDeleteImages: async (imageIds: string[]): Promise<{ deleted: number }> => {
    const response = await api.post('/media/images/bulk-delete', { imageIds });
    return response.data;
  },

  getUploadLimits: async (): Promise<{ maxFilesPerUpload: number; maxFileSizeMB: number }> => {
    const response = await api.get('/media/limits');
    return response.data;
  },
};

// Package API Types
export interface PackagePreview {
  manifest: {
    version: string;
    appVersion: string;
    created_at: string;
    totalFiles: number;
  };
  summary: {
    dashboards: number;
    widgets: number;
    integrations: number;
    imageLibraries: number;
    totalImages: number;
    hasLogo: boolean;
    hasFavicon: boolean;
    hasBranding: boolean;
    hasEncryptedCredentials?: boolean;
    switchTemplates?: number;
    deviceTemplates?: number;
  };
  warnings: string[];
}

export interface PackageImportResults {
  integrations: { imported: number; skipped: number; errors: string[] };
  dashboards: { imported: number; skipped: number; errors: string[] };
  widgets: { imported: number; errors: string[] };
  groups: { imported: number; errors: string[] };
  branding: { imported: boolean };
  assets: { logo?: boolean; favicon?: boolean };
  imageLibraries: { imported: number; images: number; errors: string[] };
  credentials?: { restored: number; failed: number };
  credentialWarning?: string;
  templates?: { switch: number; device: number };
  cleared?: { integrations: number; dashboards: number; widgets: number; groups: number; imageLibraries: number };
}

// Package API response with credential warning
export interface PackageImportResponse {
  success: boolean;
  results: PackageImportResults;
  credentialWarning?: string;
}

// Package API
export const packageApi = {
  exportPackage: async (password?: string): Promise<Blob> => {
    if (password) {
      // Use POST endpoint with password for encrypted credentials
      const response = await api.post('/package/export', { password }, {
        responseType: 'blob',
        timeout: 300000, // 5 minute timeout for large packages
      });
      return response.data;
    } else {
      // Use GET endpoint for backward compatibility (no credentials)
      const response = await api.get('/package/export', {
        responseType: 'blob',
        timeout: 300000,
      });
      return response.data;
    }
  },

  previewPackage: async (file: File): Promise<PackagePreview> => {
    const formData = new FormData();
    formData.append('package', file);
    const response = await api.post('/package/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  },

  importPackage: async (file: File, options?: { skipValidation?: boolean; password?: string; replaceAll?: boolean }): Promise<PackageImportResponse> => {
    const formData = new FormData();
    formData.append('package', file);
    if (options?.password) {
      formData.append('password', options.password);
    }
    const params: Record<string, string> = {};
    if (options?.skipValidation) params.skipValidation = 'true';
    if (options?.replaceAll) params.replaceAll = 'true';

    const response = await api.post('/package/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: Object.keys(params).length > 0 ? params : undefined,
      timeout: 300000, // 5 minute timeout for large packages
    });
    return response.data;
  },
};

// RSS Feed types
export interface RSSFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  author?: string;
  description?: string;
  content?: string;
  categories?: string[];
  image?: string;
}

export interface RSSFeed {
  title?: string;
  description?: string;
  link?: string;
  image?: string;
  lastBuildDate?: string;
  items: RSSFeedItem[];
}

// RSS API
export const rssApi = {
  fetchFeed: async (url: string): Promise<RSSFeed> => {
    const response = await api.get('/rss/fetch', { params: { url } });
    return response.data;
  },

  clearCache: async (url?: string): Promise<void> => {
    await api.post('/rss/clear-cache', { url });
  },
};

// Dev Tools API Types
export interface CacheEntry {
  key: string;
  integrationId: string;
  metric: string;
  timestamp: number;
  ttlRemaining: number;
  sizeBytes: number;
}

export interface CacheStats {
  entryCount: number;
  estimatedSizeBytes: number;
  entries: CacheEntry[];
}

export interface DetailedConnectionResult {
  success: boolean;
  message: string;
  timing: {
    dnsLookup: number;
    tcpConnect: number;
    tlsHandshake: number;
    firstByte: number;
    total: number;
  };
  ssl?: {
    issuer: string;
    validFrom: string;
    validUntil: string;
    daysRemaining: number;
    protocol: string;
  };
  headers?: Record<string, string>;
}

// Dev Tools API
export const devApi = {
  getCacheStats: async (): Promise<CacheStats> => {
    const response = await api.get('/dev/cache');
    return response.data;
  },

  clearCacheEntry: async (key: string): Promise<void> => {
    await api.delete(`/dev/cache/${encodeURIComponent(key)}`);
  },

  clearAllCache: async (): Promise<void> => {
    await api.delete('/dev/cache');
  },

  testConnectionDetailed: async (integrationId: string): Promise<DetailedConnectionResult> => {
    const response = await api.post(`/integrations/${integrationId}/test-detailed`, {}, {
      timeout: 60000,
    });
    return response.data;
  },
};

export default api;
