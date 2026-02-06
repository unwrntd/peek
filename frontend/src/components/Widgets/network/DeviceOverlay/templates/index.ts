// Device templates define NIC positions for overlay visualization
// Positions are percentages (0-100) from top-left corner

export interface NicDefinition {
  id: string;           // Unique identifier (e.g., 'eth0', 'nic1', 'mgmt')
  label: string;        // Display label (e.g., 'NIC 1', 'MGMT', 'iLO')
  x: number;            // X position as percentage
  y: number;            // Y position as percentage
  type: 'rj45' | 'sfp' | 'sfp+' | 'qsfp' | '10gbase-t' | 'mgmt' | 'ipmi';
  speed?: number;       // Max speed in Mbps (1000, 10000, 25000, etc.)
}

// Device name display configuration
export interface DeviceNameDisplay {
  show: boolean;
  x: number;            // X position as percentage
  y: number;            // Y position as percentage
  color: string;        // CSS color
  fontSize: number;     // Font size in pixels
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
}

export type DeviceType = 'server' | 'nas' | 'router' | 'firewall' | 'workstation' | 'other';
export type DeviceVendor = 'dell' | 'hp' | 'supermicro' | 'synology' | 'qnap' | 'asustor' | 'generic' | 'custom';

export interface DeviceTemplate {
  id: string;
  vendor: DeviceVendor;
  model: string;
  displayName: string;
  deviceType: DeviceType;
  deviceNameDisplay?: DeviceNameDisplay;
  image: {
    url?: string;
    embedded?: string;
  };
  aspectRatio: number;  // width / height
  nics: NicDefinition[];
  modelPatterns?: string[];
}

// Custom templates - stored in database via API, cached locally
import { settingsApi } from '../../../../../api/client';

// Local cache for custom templates
let customTemplatesCache: DeviceTemplate[] = [];
let cacheLoaded = false;
let loadPromise: Promise<DeviceTemplate[]> | null = null;

// Load custom templates from API (async)
export async function fetchCustomDeviceTemplates(): Promise<DeviceTemplate[]> {
  try {
    const templates = await settingsApi.getDeviceTemplates();
    customTemplatesCache = templates as DeviceTemplate[];
    cacheLoaded = true;
    return customTemplatesCache;
  } catch (error) {
    console.error('Failed to fetch custom device templates:', error);
    return [];
  }
}

// Initialize templates on app load
export function initCustomDeviceTemplates(): Promise<DeviceTemplate[]> {
  if (cacheLoaded) return Promise.resolve(customTemplatesCache);
  if (loadPromise) return loadPromise;
  loadPromise = fetchCustomDeviceTemplates();
  return loadPromise;
}

// Load custom templates (sync - returns cached data)
export function loadCustomDeviceTemplates(): DeviceTemplate[] {
  // Trigger async load if not loaded yet
  if (!cacheLoaded && !loadPromise) {
    initCustomDeviceTemplates();
  }
  return customTemplatesCache;
}

// Save custom templates to API
export async function saveCustomDeviceTemplates(templates: DeviceTemplate[]): Promise<void> {
  try {
    await settingsApi.saveDeviceTemplates(templates);
    customTemplatesCache = templates;
    cacheLoaded = true;
  } catch (error) {
    console.error('Failed to save custom device templates:', error);
    throw error;
  }
}

// Save custom templates (sync wrapper for compatibility - saves async in background)
export function saveCustomDeviceTemplatesSync(templates: DeviceTemplate[]): void {
  customTemplatesCache = templates;
  saveCustomDeviceTemplates(templates).catch(console.error);
}

// Get all templates (built-in + custom)
export function getAllDeviceTemplates(): DeviceTemplate[] {
  return [...DEVICE_TEMPLATES, ...loadCustomDeviceTemplates()];
}

// Get all templates async (ensures custom templates are loaded)
export async function getAllDeviceTemplatesAsync(): Promise<DeviceTemplate[]> {
  await initCustomDeviceTemplates();
  return [...DEVICE_TEMPLATES, ...customTemplatesCache];
}

// Cache buster for device images (increment to force reload)
const IMG_VERSION = 'v1';

// ============================================================================
// Dell Server Templates
// ============================================================================

export const DELL_R740_REAR: DeviceTemplate = {
  id: 'dell-r740-rear',
  vendor: 'dell',
  model: 'PowerEdge R740',
  displayName: 'Dell R740 (Rear)',
  deviceType: 'server',
  image: {
    url: `/images/devices/dell-r740-rear.png?${IMG_VERSION}`,
  },
  aspectRatio: 8.0,
  modelPatterns: ['R740', 'PowerEdge R740', 'Dell R740'],
  nics: [
    { id: 'idrac', label: 'iDRAC', x: 8, y: 50, type: 'mgmt' },
    { id: 'nic1', label: 'NIC 1', x: 18, y: 35, type: 'rj45', speed: 1000 },
    { id: 'nic2', label: 'NIC 2', x: 24, y: 35, type: 'rj45', speed: 1000 },
    { id: 'nic3', label: 'NIC 3', x: 18, y: 65, type: 'rj45', speed: 1000 },
    { id: 'nic4', label: 'NIC 4', x: 24, y: 65, type: 'rj45', speed: 1000 },
  ],
};

export const DELL_R640_REAR: DeviceTemplate = {
  id: 'dell-r640-rear',
  vendor: 'dell',
  model: 'PowerEdge R640',
  displayName: 'Dell R640 (Rear)',
  deviceType: 'server',
  image: {
    url: `/images/devices/dell-r640-rear.png?${IMG_VERSION}`,
  },
  aspectRatio: 10.0,
  modelPatterns: ['R640', 'PowerEdge R640', 'Dell R640'],
  nics: [
    { id: 'idrac', label: 'iDRAC', x: 6, y: 50, type: 'mgmt' },
    { id: 'nic1', label: 'NIC 1', x: 14, y: 35, type: 'rj45', speed: 1000 },
    { id: 'nic2', label: 'NIC 2', x: 20, y: 35, type: 'rj45', speed: 1000 },
    { id: 'nic3', label: 'NIC 3', x: 14, y: 65, type: 'rj45', speed: 1000 },
    { id: 'nic4', label: 'NIC 4', x: 20, y: 65, type: 'rj45', speed: 1000 },
  ],
};

// ============================================================================
// HP/HPE Server Templates
// ============================================================================

export const HP_DL380_GEN10_REAR: DeviceTemplate = {
  id: 'hp-dl380-gen10-rear',
  vendor: 'hp',
  model: 'ProLiant DL380 Gen10',
  displayName: 'HP DL380 Gen10 (Rear)',
  deviceType: 'server',
  image: {
    url: `/images/devices/hp-dl380-gen10-rear.png?${IMG_VERSION}`,
  },
  aspectRatio: 8.5,
  modelPatterns: ['DL380', 'DL380 Gen10', 'ProLiant DL380'],
  nics: [
    { id: 'ilo', label: 'iLO', x: 8, y: 50, type: 'ipmi' },
    { id: 'nic1', label: 'NIC 1', x: 18, y: 35, type: 'rj45', speed: 1000 },
    { id: 'nic2', label: 'NIC 2', x: 24, y: 35, type: 'rj45', speed: 1000 },
    { id: 'nic3', label: 'NIC 3', x: 18, y: 65, type: 'rj45', speed: 1000 },
    { id: 'nic4', label: 'NIC 4', x: 24, y: 65, type: 'rj45', speed: 1000 },
  ],
};

// ============================================================================
// Synology NAS Templates
// ============================================================================

export const SYNOLOGY_DS920_REAR: DeviceTemplate = {
  id: 'synology-ds920-rear',
  vendor: 'synology',
  model: 'DS920+',
  displayName: 'Synology DS920+ (Rear)',
  deviceType: 'nas',
  image: {
    url: `/images/devices/synology-ds920-rear.png?${IMG_VERSION}`,
  },
  aspectRatio: 2.5,
  modelPatterns: ['DS920', 'DS920+', 'Synology DS920'],
  nics: [
    { id: 'lan1', label: 'LAN 1', x: 35, y: 50, type: 'rj45', speed: 1000 },
    { id: 'lan2', label: 'LAN 2', x: 50, y: 50, type: 'rj45', speed: 1000 },
  ],
};

export const SYNOLOGY_DS1821_REAR: DeviceTemplate = {
  id: 'synology-ds1821-rear',
  vendor: 'synology',
  model: 'DS1821+',
  displayName: 'Synology DS1821+ (Rear)',
  deviceType: 'nas',
  image: {
    url: `/images/devices/synology-ds1821-rear.png?${IMG_VERSION}`,
  },
  aspectRatio: 3.0,
  modelPatterns: ['DS1821', 'DS1821+', 'Synology DS1821'],
  nics: [
    { id: 'lan1', label: 'LAN 1', x: 25, y: 40, type: 'rj45', speed: 1000 },
    { id: 'lan2', label: 'LAN 2', x: 35, y: 40, type: 'rj45', speed: 1000 },
    { id: 'lan3', label: 'LAN 3', x: 25, y: 60, type: 'rj45', speed: 1000 },
    { id: 'lan4', label: 'LAN 4', x: 35, y: 60, type: 'rj45', speed: 1000 },
  ],
};

export const SYNOLOGY_RS1221_REAR: DeviceTemplate = {
  id: 'synology-rs1221-rear',
  vendor: 'synology',
  model: 'RS1221+',
  displayName: 'Synology RS1221+ (Rear)',
  deviceType: 'nas',
  image: {
    url: `/images/devices/synology-rs1221-rear.png?${IMG_VERSION}`,
  },
  aspectRatio: 8.0,
  modelPatterns: ['RS1221', 'RS1221+', 'Synology RS1221'],
  nics: [
    { id: 'lan1', label: 'LAN 1', x: 15, y: 40, type: 'rj45', speed: 1000 },
    { id: 'lan2', label: 'LAN 2', x: 22, y: 40, type: 'rj45', speed: 1000 },
    { id: 'lan3', label: 'LAN 3', x: 15, y: 60, type: 'rj45', speed: 1000 },
    { id: 'lan4', label: 'LAN 4', x: 22, y: 60, type: 'rj45', speed: 1000 },
  ],
};

// ============================================================================
// QNAP NAS Templates
// ============================================================================

export const QNAP_TS453D_REAR: DeviceTemplate = {
  id: 'qnap-ts453d-rear',
  vendor: 'qnap',
  model: 'TS-453D',
  displayName: 'QNAP TS-453D (Rear)',
  deviceType: 'nas',
  image: {
    url: `/images/devices/qnap-ts453d-rear.png?${IMG_VERSION}`,
  },
  aspectRatio: 2.5,
  modelPatterns: ['TS-453D', 'TS453D', 'QNAP TS-453'],
  nics: [
    { id: 'lan1', label: 'LAN 1', x: 35, y: 50, type: 'rj45', speed: 2500 },
    { id: 'lan2', label: 'LAN 2', x: 50, y: 50, type: 'rj45', speed: 2500 },
  ],
};

// ============================================================================
// Generic Templates
// ============================================================================

export const GENERIC_1U_2NIC: DeviceTemplate = {
  id: 'generic-1u-2nic',
  vendor: 'generic',
  model: '1U Server 2-Port',
  displayName: 'Generic 1U (2 NIC)',
  deviceType: 'server',
  image: {},
  aspectRatio: 8.0,
  nics: [
    { id: 'mgmt', label: 'MGMT', x: 12, y: 50, type: 'mgmt' },
    { id: 'nic1', label: 'NIC 1', x: 25, y: 50, type: 'rj45', speed: 1000 },
    { id: 'nic2', label: 'NIC 2', x: 35, y: 50, type: 'rj45', speed: 1000 },
  ],
};

export const GENERIC_1U_4NIC: DeviceTemplate = {
  id: 'generic-1u-4nic',
  vendor: 'generic',
  model: '1U Server 4-Port',
  displayName: 'Generic 1U (4 NIC)',
  deviceType: 'server',
  image: {},
  aspectRatio: 8.0,
  nics: [
    { id: 'mgmt', label: 'MGMT', x: 10, y: 50, type: 'mgmt' },
    { id: 'nic1', label: 'NIC 1', x: 22, y: 50, type: 'rj45', speed: 1000 },
    { id: 'nic2', label: 'NIC 2', x: 30, y: 50, type: 'rj45', speed: 1000 },
    { id: 'nic3', label: 'NIC 3', x: 38, y: 50, type: 'rj45', speed: 1000 },
    { id: 'nic4', label: 'NIC 4', x: 46, y: 50, type: 'rj45', speed: 1000 },
  ],
};

export const GENERIC_2U_4NIC: DeviceTemplate = {
  id: 'generic-2u-4nic',
  vendor: 'generic',
  model: '2U Server 4-Port',
  displayName: 'Generic 2U (4 NIC)',
  deviceType: 'server',
  image: {},
  aspectRatio: 4.0,
  nics: [
    { id: 'mgmt', label: 'MGMT', x: 12, y: 50, type: 'mgmt' },
    { id: 'nic1', label: 'NIC 1', x: 25, y: 35, type: 'rj45', speed: 1000 },
    { id: 'nic2', label: 'NIC 2', x: 35, y: 35, type: 'rj45', speed: 1000 },
    { id: 'nic3', label: 'NIC 3', x: 25, y: 65, type: 'rj45', speed: 1000 },
    { id: 'nic4', label: 'NIC 4', x: 35, y: 65, type: 'rj45', speed: 1000 },
  ],
};

export const GENERIC_NAS_2NIC: DeviceTemplate = {
  id: 'generic-nas-2nic',
  vendor: 'generic',
  model: 'NAS 2-Port',
  displayName: 'Generic NAS (2 NIC)',
  deviceType: 'nas',
  image: {},
  aspectRatio: 2.5,
  nics: [
    { id: 'lan1', label: 'LAN 1', x: 35, y: 50, type: 'rj45', speed: 1000 },
    { id: 'lan2', label: 'LAN 2', x: 55, y: 50, type: 'rj45', speed: 1000 },
  ],
};

export const GENERIC_NAS_4NIC: DeviceTemplate = {
  id: 'generic-nas-4nic',
  vendor: 'generic',
  model: 'NAS 4-Port',
  displayName: 'Generic NAS (4 NIC)',
  deviceType: 'nas',
  image: {},
  aspectRatio: 3.0,
  nics: [
    { id: 'lan1', label: 'LAN 1', x: 25, y: 35, type: 'rj45', speed: 1000 },
    { id: 'lan2', label: 'LAN 2', x: 40, y: 35, type: 'rj45', speed: 1000 },
    { id: 'lan3', label: 'LAN 3', x: 25, y: 65, type: 'rj45', speed: 1000 },
    { id: 'lan4', label: 'LAN 4', x: 40, y: 65, type: 'rj45', speed: 1000 },
  ],
};

export const GENERIC_WORKSTATION: DeviceTemplate = {
  id: 'generic-workstation',
  vendor: 'generic',
  model: 'Workstation',
  displayName: 'Generic Workstation',
  deviceType: 'workstation',
  image: {},
  aspectRatio: 1.5,
  nics: [
    { id: 'nic1', label: 'Ethernet', x: 50, y: 70, type: 'rj45', speed: 1000 },
  ],
};

export const GENERIC_MINI_PC: DeviceTemplate = {
  id: 'generic-mini-pc',
  vendor: 'generic',
  model: 'Mini PC',
  displayName: 'Generic Mini PC',
  deviceType: 'workstation',
  image: {},
  aspectRatio: 1.2,
  nics: [
    { id: 'nic1', label: 'LAN 1', x: 30, y: 70, type: 'rj45', speed: 2500 },
    { id: 'nic2', label: 'LAN 2', x: 55, y: 70, type: 'rj45', speed: 2500 },
  ],
};

// ============================================================================
// All Device Templates Registry
// ============================================================================

export const DEVICE_TEMPLATES: DeviceTemplate[] = [
  // Dell
  DELL_R740_REAR,
  DELL_R640_REAR,
  // HP/HPE
  HP_DL380_GEN10_REAR,
  // Synology
  SYNOLOGY_DS920_REAR,
  SYNOLOGY_DS1821_REAR,
  SYNOLOGY_RS1221_REAR,
  // QNAP
  QNAP_TS453D_REAR,
  // Generic
  GENERIC_1U_2NIC,
  GENERIC_1U_4NIC,
  GENERIC_2U_4NIC,
  GENERIC_NAS_2NIC,
  GENERIC_NAS_4NIC,
  GENERIC_WORKSTATION,
  GENERIC_MINI_PC,
];

// Find template by ID (checks custom templates first)
export function getDeviceTemplateById(id: string): DeviceTemplate | undefined {
  // Check custom templates first (allows overriding built-in)
  const customTemplates = loadCustomDeviceTemplates();
  const custom = customTemplates.find(t => t.id === id);
  if (custom) return custom;

  return DEVICE_TEMPLATES.find(t => t.id === id);
}

// Find template by model name (uses pattern matching)
export function getDeviceTemplateByModel(model: string): DeviceTemplate | undefined {
  const allTemplates = getAllDeviceTemplates();

  // First try exact match
  const exact = allTemplates.find(t =>
    t.model.toLowerCase() === model.toLowerCase()
  );
  if (exact) return exact;

  // Then try pattern matching (check custom templates first)
  for (const template of allTemplates) {
    if (template.modelPatterns) {
      for (const pattern of template.modelPatterns) {
        if (model.toLowerCase().includes(pattern.toLowerCase())) {
          return template;
        }
      }
    }
  }

  return undefined;
}

// Get best generic template for NIC count
export function getGenericDeviceTemplate(nicCount: number, deviceType: DeviceType = 'server'): DeviceTemplate {
  if (deviceType === 'nas') {
    if (nicCount <= 2) return GENERIC_NAS_2NIC;
    return GENERIC_NAS_4NIC;
  }

  if (deviceType === 'workstation') {
    if (nicCount <= 1) return GENERIC_WORKSTATION;
    return GENERIC_MINI_PC;
  }

  // Default to server templates
  if (nicCount <= 3) return GENERIC_1U_2NIC;
  return GENERIC_1U_4NIC;
}

// Get templates grouped by vendor
export function getDeviceTemplatesByVendor(): Record<string, DeviceTemplate[]> {
  const allTemplates = getAllDeviceTemplates();
  const grouped: Record<string, DeviceTemplate[]> = {};

  for (const template of allTemplates) {
    if (!grouped[template.vendor]) {
      grouped[template.vendor] = [];
    }
    grouped[template.vendor].push(template);
  }

  return grouped;
}

// Get templates grouped by device type
export function getDeviceTemplatesByType(): Record<DeviceType, DeviceTemplate[]> {
  const allTemplates = getAllDeviceTemplates();
  const grouped: Record<string, DeviceTemplate[]> = {};

  for (const template of allTemplates) {
    if (!grouped[template.deviceType]) {
      grouped[template.deviceType] = [];
    }
    grouped[template.deviceType].push(template);
  }

  return grouped as Record<DeviceType, DeviceTemplate[]>;
}
