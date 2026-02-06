// Switch templates define port positions for overlay visualization
// Positions are percentages (0-100) from top-left corner

export interface PortDefinition {
  number: number;
  label?: string;
  x: number;  // X position as percentage
  y: number;  // Y position as percentage
  type: 'rj45' | 'sfp' | 'sfp+' | 'qsfp' | 'combo';
  row?: number;  // For dual-row layouts (1 = top, 2 = bottom)
}

// Switch name display configuration
export interface SwitchNameDisplay {
  show: boolean;
  x: number;  // X position as percentage
  y: number;  // Y position as percentage
  color: string;  // CSS color
  fontSize: number;  // Font size in pixels
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
}

export interface SwitchTemplate {
  id: string;
  vendor: 'unifi' | 'cisco' | 'mikrotik' | 'generic' | 'custom' | 'fortigate' | 'paloalto';
  model: string;
  displayName: string;
  // Switch name display settings (name pulled from API)
  switchNameDisplay?: SwitchNameDisplay;
  // Image configuration
  image: {
    url?: string;
    embedded?: string;
  };
  aspectRatio: number;  // width / height
  // Port definitions
  ports: PortDefinition[];
  // Model patterns for auto-detection
  modelPatterns?: string[];
}

// Custom templates - stored in database via API, cached locally
import { settingsApi } from '../../../../../api/client';

// Local cache for custom templates
let customTemplatesCache: SwitchTemplate[] = [];
let cacheLoaded = false;
let loadPromise: Promise<SwitchTemplate[]> | null = null;

// Load custom templates from API (async)
export async function fetchCustomTemplates(): Promise<SwitchTemplate[]> {
  try {
    const templates = await settingsApi.getSwitchTemplates();
    customTemplatesCache = templates as SwitchTemplate[];
    cacheLoaded = true;
    return customTemplatesCache;
  } catch (error) {
    console.error('Failed to fetch custom templates:', error);
    return [];
  }
}

// Initialize templates on app load
export function initCustomTemplates(): Promise<SwitchTemplate[]> {
  if (cacheLoaded) return Promise.resolve(customTemplatesCache);
  if (loadPromise) return loadPromise;
  loadPromise = fetchCustomTemplates();
  return loadPromise;
}

// Load custom templates (sync - returns cached data)
export function loadCustomTemplates(): SwitchTemplate[] {
  // Trigger async load if not loaded yet
  if (!cacheLoaded && !loadPromise) {
    initCustomTemplates();
  }
  return customTemplatesCache;
}

// Save custom templates to API
export async function saveCustomTemplates(templates: SwitchTemplate[]): Promise<void> {
  try {
    await settingsApi.saveSwitchTemplates(templates);
    customTemplatesCache = templates;
    cacheLoaded = true;
  } catch (error) {
    console.error('Failed to save custom templates:', error);
    throw error;
  }
}

// Save custom templates (sync wrapper for compatibility - saves async in background)
export function saveCustomTemplatesSync(templates: SwitchTemplate[]): void {
  customTemplatesCache = templates;
  saveCustomTemplates(templates).catch(console.error);
}

// Get all templates (built-in + custom)
export function getAllTemplates(): SwitchTemplate[] {
  return [...SWITCH_TEMPLATES, ...loadCustomTemplates()];
}

// Get all templates async (ensures custom templates are loaded)
export async function getAllTemplatesAsync(): Promise<SwitchTemplate[]> {
  await initCustomTemplates();
  return [...SWITCH_TEMPLATES, ...customTemplatesCache];
}

// Cache buster for switch images (increment to force reload)
const IMG_VERSION = 'v4';

// UniFi Dream Machine Pro: Gateway with 8 LAN ports + WAN + SFP+
export const UDM_PRO: SwitchTemplate = {
  id: 'unifi-udm-pro',
  vendor: 'unifi',
  model: 'UDM-Pro',
  displayName: 'UniFi Dream Machine Pro',
  image: {
    url: `/images/switches/udm-pro.png?${IMG_VERSION}`,
  },
  aspectRatio: 10.0,
  modelPatterns: ['UDM-Pro', 'UDM-PRO', 'UDMPRO', 'Dream Machine Pro'],
  ports: [
    // LAN ports 1-4 (top row)
    { number: 1, x: 71.33, y: 35.99, type: 'rj45', row: 1 },
    { number: 2, x: 75.01, y: 35.99, type: 'rj45', row: 1 },
    { number: 3, x: 78.6, y: 35.99, type: 'rj45', row: 1 },
    { number: 4, x: 82.04, y: 35.99, type: 'rj45', row: 1 },
    // LAN ports 5-8 (bottom row)
    { number: 5, x: 71.33, y: 64.41, type: 'rj45', row: 2 },
    { number: 6, x: 75.01, y: 64.41, type: 'rj45', row: 2 },
    { number: 7, x: 78.6, y: 64.41, type: 'rj45', row: 2 },
    { number: 8, x: 82.04, y: 64.41, type: 'rj45', row: 2 },
    // WAN RJ45 port
    { number: 9, label: 'WAN', x: 89.16, y: 63.68, type: 'rj45' },
    // SFP+ WAN port
    { number: 10, label: 'SFP+ WAN', x: 93.3, y: 33.58, type: 'sfp+' },
    // SFP+ LAN port
    { number: 11, label: 'SFP+ LAN', x: 93.3, y: 66.02, type: 'sfp+' },
  ],
};

// UniFi USW-24: 24-port switch with 2 SFP
export const USW_24: SwitchTemplate = {
  id: 'unifi-usw-24',
  vendor: 'unifi',
  model: 'USW-24',
  displayName: 'UniFi Switch 24',
  image: {
    url: `/images/switches/usw-24.png?${IMG_VERSION}`,
  },
  aspectRatio: 8.5,
  modelPatterns: ['USW-24', 'US-24'],
  ports: [
    // First module - ports 1-12 (odd top, even bottom)
    { number: 1, x: 50.47, y: 38.61, type: 'rj45', row: 1 },
    { number: 2, x: 50.47, y: 63.32, type: 'rj45', row: 2 },
    { number: 3, x: 53.66, y: 38.61, type: 'rj45', row: 1 },
    { number: 4, x: 53.66, y: 63.32, type: 'rj45', row: 2 },
    { number: 5, x: 56.69, y: 38.61, type: 'rj45', row: 1 },
    { number: 6, x: 56.75, y: 63.32, type: 'rj45', row: 2 },
    { number: 7, x: 59.93, y: 38.61, type: 'rj45', row: 1 },
    { number: 8, x: 59.99, y: 63.32, type: 'rj45', row: 2 },
    { number: 9, x: 63.02, y: 38.61, type: 'rj45', row: 1 },
    { number: 10, x: 63.02, y: 63.32, type: 'rj45', row: 2 },
    { number: 11, x: 66.2, y: 38.61, type: 'rj45', row: 1 },
    { number: 12, x: 66.12, y: 63.32, type: 'rj45', row: 2 },
    // Second module - ports 13-24 (odd top, even bottom)
    { number: 13, x: 70.19, y: 38.61, type: 'rj45', row: 1 },
    { number: 14, x: 70.12, y: 63.32, type: 'rj45', row: 2 },
    { number: 15, x: 73.31, y: 38.61, type: 'rj45', row: 1 },
    { number: 16, x: 73.34, y: 63.32, type: 'rj45', row: 2 },
    { number: 17, x: 76.49, y: 38.61, type: 'rj45', row: 1 },
    { number: 18, x: 76.54, y: 63.32, type: 'rj45', row: 2 },
    { number: 19, x: 79.65, y: 38.61, type: 'rj45', row: 1 },
    { number: 20, x: 79.66, y: 63.32, type: 'rj45', row: 2 },
    { number: 21, x: 82.81, y: 38.61, type: 'rj45', row: 1 },
    { number: 22, x: 82.99, y: 63.32, type: 'rj45', row: 2 },
    { number: 23, x: 86.1, y: 38.61, type: 'rj45', row: 1 },
    { number: 24, x: 85.95, y: 63.32, type: 'rj45', row: 2 },
    // SFP ports
    { number: 25, label: 'SFP 1', x: 94.74, y: 36.81, type: 'sfp' },
    { number: 26, label: 'SFP 2', x: 94.74, y: 64.84, type: 'sfp' },
  ],
};

// UniFi USW-16-POE: 16-port PoE switch with 2 SFP
export const USW_16_POE: SwitchTemplate = {
  id: 'unifi-usw-16-poe',
  vendor: 'unifi',
  model: 'USW-16-POE',
  displayName: 'UniFi Switch 16 PoE',
  image: {
    url: `/images/switches/usw-16-poe.png?${IMG_VERSION}`,
  },
  aspectRatio: 10.3,
  modelPatterns: ['USW-16-POE', 'USW-16-PoE', 'US-16-150W', 'USW-Lite-16-PoE'],
  ports: [
    // Ports 1-16 (odd top, even bottom)
    { number: 1, x: 61.11, y: 34.69, type: 'rj45', row: 1 },
    { number: 2, x: 61.11, y: 62.83, type: 'rj45', row: 2 },
    { number: 3, x: 64.71, y: 34.69, type: 'rj45', row: 1 },
    { number: 4, x: 64.71, y: 62.83, type: 'rj45', row: 2 },
    { number: 5, x: 68.18, y: 34.69, type: 'rj45', row: 1 },
    { number: 6, x: 68.18, y: 62.83, type: 'rj45', row: 2 },
    { number: 7, x: 71.7, y: 34.69, type: 'rj45', row: 1 },
    { number: 8, x: 71.7, y: 62.83, type: 'rj45', row: 2 },
    { number: 9, x: 75.34, y: 34.69, type: 'rj45', row: 1 },
    { number: 10, x: 75.34, y: 62.83, type: 'rj45', row: 2 },
    { number: 11, x: 78.82, y: 35.1, type: 'rj45', row: 1 },
    { number: 12, x: 78.82, y: 63.24, type: 'rj45', row: 2 },
    { number: 13, x: 82.46, y: 35.1, type: 'rj45', row: 1 },
    { number: 14, x: 82.46, y: 63.24, type: 'rj45', row: 2 },
    { number: 15, x: 86.01, y: 34.69, type: 'rj45', row: 1 },
    { number: 16, x: 86.01, y: 62.83, type: 'rj45', row: 2 },
    // SFP ports
    { number: 17, label: 'SFP 1', x: 94.55, y: 29.3, type: 'sfp' },
    { number: 18, label: 'SFP 2', x: 94.55, y: 66.56, type: 'sfp' },
  ],
};

// UniFi USW-Flex-Mini: 5-port compact switch (PoE powered)
export const USW_FLEX_MINI: SwitchTemplate = {
  id: 'unifi-usw-flex-mini',
  vendor: 'unifi',
  model: 'USW-Flex-Mini',
  displayName: 'UniFi Flex Mini',
  image: {
    url: `/images/switches/usw-flex-mini.png?${IMG_VERSION}`,
  },
  aspectRatio: 4.57,
  modelPatterns: ['USW-Flex-Mini', 'USW Flex Mini', 'Flex Mini', 'USW-FLEX-MINI'],
  ports: [
    // Single row of 5 ports - Port 1 is PoE input
    { number: 1, label: 'PoE IN', x: 19.91, y: 46.65, type: 'rj45' },
    { number: 2, x: 35.68, y: 46.65, type: 'rj45' },
    { number: 3, x: 50.32, y: 46.65, type: 'rj45' },
    { number: 4, x: 64.72, y: 46.65, type: 'rj45' },
    { number: 5, x: 79.45, y: 46.65, type: 'rj45' },
  ],
};

// Generic 8-port switch template
export const GENERIC_8_PORT: SwitchTemplate = {
  id: 'generic-8-port',
  vendor: 'generic',
  model: '8-Port Switch',
  displayName: 'Generic 8-Port Switch',
  image: {},
  aspectRatio: 4.0,
  ports: Array.from({ length: 8 }, (_, i) => ({
    number: i + 1,
    x: 10 + i * 10,
    y: 50,
    type: 'rj45' as const,
  })),
};

// Generic 16-port switch template
export const GENERIC_16_PORT: SwitchTemplate = {
  id: 'generic-16-port',
  vendor: 'generic',
  model: '16-Port Switch',
  displayName: 'Generic 16-Port Switch',
  image: {},
  aspectRatio: 6.0,
  ports: [
    // Top row (ports 1-8)
    ...Array.from({ length: 8 }, (_, i) => ({
      number: i + 1,
      x: 10 + i * 9,
      y: 35,
      type: 'rj45' as const,
      row: 1,
    })),
    // Bottom row (ports 9-16)
    ...Array.from({ length: 8 }, (_, i) => ({
      number: i + 9,
      x: 10 + i * 9,
      y: 65,
      type: 'rj45' as const,
      row: 2,
    })),
  ],
};

// Generic 24-port switch template
export const GENERIC_24_PORT: SwitchTemplate = {
  id: 'generic-24-port',
  vendor: 'generic',
  model: '24-Port Switch',
  displayName: 'Generic 24-Port Switch',
  image: {},
  aspectRatio: 8.0,
  ports: [
    // Top row (ports 1-12)
    ...Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      x: 8 + i * 6,
      y: 35,
      type: 'rj45' as const,
      row: 1,
    })),
    // Bottom row (ports 13-24)
    ...Array.from({ length: 12 }, (_, i) => ({
      number: i + 13,
      x: 8 + i * 6,
      y: 65,
      type: 'rj45' as const,
      row: 2,
    })),
  ],
};

// Generic 48-port switch template
export const GENERIC_48_PORT: SwitchTemplate = {
  id: 'generic-48-port',
  vendor: 'generic',
  model: '48-Port Switch',
  displayName: 'Generic 48-Port Switch',
  image: {},
  aspectRatio: 8.5,
  ports: [
    // Top row (ports 1-24)
    ...Array.from({ length: 24 }, (_, i) => ({
      number: i + 1,
      x: 4 + i * 3.5,
      y: 35,
      type: 'rj45' as const,
      row: 1,
    })),
    // Bottom row (ports 25-48)
    ...Array.from({ length: 24 }, (_, i) => ({
      number: i + 25,
      x: 4 + i * 3.5,
      y: 65,
      type: 'rj45' as const,
      row: 2,
    })),
  ],
};

// Cisco Catalyst 9300-24: 24-port mGig switch with network module
export const CISCO_9300_24: SwitchTemplate = {
  id: 'cisco-9300-24',
  vendor: 'cisco',
  model: 'C9300-24',
  displayName: 'Cisco Catalyst 9300-24',
  image: {
    url: `/images/switches/cisco-9300-24.png?${IMG_VERSION}`,
  },
  aspectRatio: 10.0,
  modelPatterns: ['C9300-24', '9300-24', 'C9300L-24', 'C9300-24U', 'C9300-24P', 'C9300-24T'],
  ports: [
    // Top row - odd ports (1,3,5,7,9,11,13,15,17,19,21,23)
    { number: 1, x: 43.97, y: 37.59, type: 'rj45', row: 1 },
    { number: 3, x: 47.1, y: 37.59, type: 'rj45', row: 1 },
    { number: 5, x: 50.19, y: 37.59, type: 'rj45', row: 1 },
    { number: 7, x: 53.36, y: 37.59, type: 'rj45', row: 1 },
    { number: 9, x: 56.53, y: 37.59, type: 'rj45', row: 1 },
    { number: 11, x: 59.66, y: 37.59, type: 'rj45', row: 1 },
    { number: 13, x: 64.2, y: 37.59, type: 'rj45', row: 1 },
    { number: 15, x: 67.24, y: 37.59, type: 'rj45', row: 1 },
    { number: 17, x: 70.37, y: 37.59, type: 'rj45', row: 1 },
    { number: 19, x: 73.58, y: 37.59, type: 'rj45', row: 1 },
    { number: 21, x: 76.7, y: 37.59, type: 'rj45', row: 1 },
    { number: 23, x: 79.83, y: 37.59, type: 'rj45', row: 1 },
    // Bottom row - even ports (2,4,6,8,10,12,14,16,18,20,22,24)
    { number: 2, x: 43.97, y: 66.04, type: 'rj45', row: 2 },
    { number: 4, x: 47.1, y: 66.04, type: 'rj45', row: 2 },
    { number: 6, x: 50.19, y: 66.04, type: 'rj45', row: 2 },
    { number: 8, x: 53.36, y: 66.04, type: 'rj45', row: 2 },
    { number: 10, x: 56.53, y: 66.04, type: 'rj45', row: 2 },
    { number: 12, x: 59.66, y: 66.04, type: 'rj45', row: 2 },
    { number: 14, x: 64.2, y: 66.04, type: 'rj45', row: 2 },
    { number: 16, x: 67.24, y: 66.04, type: 'rj45', row: 2 },
    { number: 18, x: 70.37, y: 66.04, type: 'rj45', row: 2 },
    { number: 20, x: 73.58, y: 66.04, type: 'rj45', row: 2 },
    { number: 22, x: 76.7, y: 66.04, type: 'rj45', row: 2 },
    { number: 24, x: 79.83, y: 66.04, type: 'rj45', row: 2 },
    // Network module uplink ports (SFP+)
    { number: 25, label: 'U1', x: 86.53, y: 62.35, type: 'sfp+' },
    { number: 26, label: 'U2', x: 89.52, y: 62.35, type: 'sfp+' },
    { number: 27, label: 'U3', x: 92.6, y: 63.05, type: 'sfp+' },
    { number: 28, label: 'U4', x: 95.64, y: 62.24, type: 'sfp+' },
  ],
};

// FortiGate 60F: Desktop firewall with 10 ports (2 WAN + 7 LAN + DMZ/HA)
export const FORTIGATE_60F: SwitchTemplate = {
  id: 'fortigate-60f',
  vendor: 'fortigate',
  model: 'FortiGate-60F',
  displayName: 'FortiGate 60F',
  image: {},
  aspectRatio: 5.0,
  modelPatterns: ['FGT60F', 'FG-60F', 'FortiGate-60F', 'FortiGate 60F', 'FGT-60F'],
  ports: [
    // WAN ports
    { number: 1, label: 'WAN1', x: 15, y: 50, type: 'rj45' },
    { number: 2, label: 'WAN2', x: 25, y: 50, type: 'rj45' },
    // LAN ports 1-7
    { number: 3, label: 'LAN1', x: 38, y: 50, type: 'rj45' },
    { number: 4, label: 'LAN2', x: 46, y: 50, type: 'rj45' },
    { number: 5, label: 'LAN3', x: 54, y: 50, type: 'rj45' },
    { number: 6, label: 'LAN4', x: 62, y: 50, type: 'rj45' },
    { number: 7, label: 'LAN5', x: 70, y: 50, type: 'rj45' },
    { number: 8, label: 'LAN6', x: 78, y: 50, type: 'rj45' },
    { number: 9, label: 'LAN7', x: 86, y: 50, type: 'rj45' },
    // DMZ/HA port
    { number: 10, label: 'DMZ', x: 94, y: 50, type: 'rj45' },
  ],
};

// FortiGate 100F: 1U rackmount with 18 ports
export const FORTIGATE_100F: SwitchTemplate = {
  id: 'fortigate-100f',
  vendor: 'fortigate',
  model: 'FortiGate-100F',
  displayName: 'FortiGate 100F',
  image: {},
  aspectRatio: 8.0,
  modelPatterns: ['FGT100F', 'FG-100F', 'FortiGate-100F', 'FortiGate 100F', 'FGT-100F'],
  ports: [
    // Management and HA ports (top row left)
    { number: 1, label: 'MGMT', x: 8, y: 35, type: 'rj45', row: 1 },
    { number: 2, label: 'HA', x: 14, y: 35, type: 'rj45', row: 1 },
    // SFP ports (top row)
    { number: 3, label: 'SFP1', x: 22, y: 35, type: 'sfp', row: 1 },
    { number: 4, label: 'SFP2', x: 28, y: 35, type: 'sfp', row: 1 },
    // RJ45 ports 1-7 (top row)
    { number: 5, x: 38, y: 35, type: 'rj45', row: 1 },
    { number: 6, x: 44, y: 35, type: 'rj45', row: 1 },
    { number: 7, x: 50, y: 35, type: 'rj45', row: 1 },
    { number: 8, x: 56, y: 35, type: 'rj45', row: 1 },
    { number: 9, x: 62, y: 35, type: 'rj45', row: 1 },
    { number: 10, x: 68, y: 35, type: 'rj45', row: 1 },
    { number: 11, x: 74, y: 35, type: 'rj45', row: 1 },
    // RJ45 ports 8-14 (bottom row)
    { number: 12, x: 38, y: 65, type: 'rj45', row: 2 },
    { number: 13, x: 44, y: 65, type: 'rj45', row: 2 },
    { number: 14, x: 50, y: 65, type: 'rj45', row: 2 },
    { number: 15, x: 56, y: 65, type: 'rj45', row: 2 },
    { number: 16, x: 62, y: 65, type: 'rj45', row: 2 },
    { number: 17, x: 68, y: 65, type: 'rj45', row: 2 },
    { number: 18, x: 74, y: 65, type: 'rj45', row: 2 },
  ],
};

// FortiGate 200F: 1U rackmount with 20 ports (4 SFP28 + 16 RJ45)
export const FORTIGATE_200F: SwitchTemplate = {
  id: 'fortigate-200f',
  vendor: 'fortigate',
  model: 'FortiGate-200F',
  displayName: 'FortiGate 200F',
  image: {},
  aspectRatio: 8.5,
  modelPatterns: ['FGT200F', 'FG-200F', 'FortiGate-200F', 'FortiGate 200F', 'FGT-200F'],
  ports: [
    // SFP28 ports (left side, stacked)
    { number: 1, label: 'SFP28-1', x: 8, y: 35, type: 'sfp+', row: 1 },
    { number: 2, label: 'SFP28-2', x: 14, y: 35, type: 'sfp+', row: 1 },
    { number: 3, label: 'SFP28-3', x: 8, y: 65, type: 'sfp+', row: 2 },
    { number: 4, label: 'SFP28-4', x: 14, y: 65, type: 'sfp+', row: 2 },
    // RJ45 ports 1-8 (top row)
    { number: 5, x: 26, y: 35, type: 'rj45', row: 1 },
    { number: 6, x: 32, y: 35, type: 'rj45', row: 1 },
    { number: 7, x: 38, y: 35, type: 'rj45', row: 1 },
    { number: 8, x: 44, y: 35, type: 'rj45', row: 1 },
    { number: 9, x: 50, y: 35, type: 'rj45', row: 1 },
    { number: 10, x: 56, y: 35, type: 'rj45', row: 1 },
    { number: 11, x: 62, y: 35, type: 'rj45', row: 1 },
    { number: 12, x: 68, y: 35, type: 'rj45', row: 1 },
    // RJ45 ports 9-16 (bottom row)
    { number: 13, x: 26, y: 65, type: 'rj45', row: 2 },
    { number: 14, x: 32, y: 65, type: 'rj45', row: 2 },
    { number: 15, x: 38, y: 65, type: 'rj45', row: 2 },
    { number: 16, x: 44, y: 65, type: 'rj45', row: 2 },
    { number: 17, x: 50, y: 65, type: 'rj45', row: 2 },
    { number: 18, x: 56, y: 65, type: 'rj45', row: 2 },
    { number: 19, x: 62, y: 65, type: 'rj45', row: 2 },
    { number: 20, x: 68, y: 65, type: 'rj45', row: 2 },
  ],
};

// Palo Alto PA-220: Entry-level desktop firewall with 10 ports
export const PALOALTO_PA220: SwitchTemplate = {
  id: 'paloalto-pa220',
  vendor: 'paloalto',
  model: 'PA-220',
  displayName: 'Palo Alto PA-220',
  image: {},
  aspectRatio: 5.0,
  modelPatterns: ['PA-220', 'PA220'],
  ports: [
    // MGT port
    { number: 1, label: 'MGT', x: 12, y: 50, type: 'rj45' },
    // Console (usually not shown, but included for completeness)
    { number: 2, label: 'CON', x: 22, y: 50, type: 'rj45' },
    // Data ports 1-8
    { number: 3, label: '1', x: 35, y: 50, type: 'rj45' },
    { number: 4, label: '2', x: 43, y: 50, type: 'rj45' },
    { number: 5, label: '3', x: 51, y: 50, type: 'rj45' },
    { number: 6, label: '4', x: 59, y: 50, type: 'rj45' },
    { number: 7, label: '5', x: 67, y: 50, type: 'rj45' },
    { number: 8, label: '6', x: 75, y: 50, type: 'rj45' },
    { number: 9, label: '7', x: 83, y: 50, type: 'rj45' },
    { number: 10, label: '8', x: 91, y: 50, type: 'rj45' },
  ],
};

// Palo Alto PA-440: Desktop firewall with 10 ports (8 RJ45 + 1 MGT + 1 SFP)
export const PALOALTO_PA440: SwitchTemplate = {
  id: 'paloalto-pa440',
  vendor: 'paloalto',
  model: 'PA-440',
  displayName: 'Palo Alto PA-440',
  image: {},
  aspectRatio: 5.0,
  modelPatterns: ['PA-440', 'PA440'],
  ports: [
    // MGT port
    { number: 1, label: 'MGT', x: 10, y: 50, type: 'rj45' },
    // Data ports 1-8
    { number: 2, label: '1', x: 22, y: 50, type: 'rj45' },
    { number: 3, label: '2', x: 30, y: 50, type: 'rj45' },
    { number: 4, label: '3', x: 38, y: 50, type: 'rj45' },
    { number: 5, label: '4', x: 46, y: 50, type: 'rj45' },
    { number: 6, label: '5', x: 54, y: 50, type: 'rj45' },
    { number: 7, label: '6', x: 62, y: 50, type: 'rj45' },
    { number: 8, label: '7', x: 70, y: 50, type: 'rj45' },
    { number: 9, label: '8', x: 78, y: 50, type: 'rj45' },
    // SFP port
    { number: 10, label: 'SFP', x: 90, y: 50, type: 'sfp' },
  ],
};

// Palo Alto PA-460: Desktop firewall with 13 ports (8 mGig + 4 SFP + MGT)
export const PALOALTO_PA460: SwitchTemplate = {
  id: 'paloalto-pa460',
  vendor: 'paloalto',
  model: 'PA-460',
  displayName: 'Palo Alto PA-460',
  image: {},
  aspectRatio: 6.0,
  modelPatterns: ['PA-460', 'PA460'],
  ports: [
    // MGT port
    { number: 1, label: 'MGT', x: 8, y: 50, type: 'rj45' },
    // mGig data ports 1-8
    { number: 2, label: '1', x: 18, y: 50, type: 'rj45' },
    { number: 3, label: '2', x: 25, y: 50, type: 'rj45' },
    { number: 4, label: '3', x: 32, y: 50, type: 'rj45' },
    { number: 5, label: '4', x: 39, y: 50, type: 'rj45' },
    { number: 6, label: '5', x: 46, y: 50, type: 'rj45' },
    { number: 7, label: '6', x: 53, y: 50, type: 'rj45' },
    { number: 8, label: '7', x: 60, y: 50, type: 'rj45' },
    { number: 9, label: '8', x: 67, y: 50, type: 'rj45' },
    // SFP ports
    { number: 10, label: 'SFP1', x: 78, y: 35, type: 'sfp', row: 1 },
    { number: 11, label: 'SFP2', x: 86, y: 35, type: 'sfp', row: 1 },
    { number: 12, label: 'SFP3', x: 78, y: 65, type: 'sfp', row: 2 },
    { number: 13, label: 'SFP4', x: 86, y: 65, type: 'sfp', row: 2 },
  ],
};

// Palo Alto PA-3220: 1U rackmount with 18 ports (12 RJ45 + 4 SFP+ + MGT + HA)
export const PALOALTO_PA3220: SwitchTemplate = {
  id: 'paloalto-pa3220',
  vendor: 'paloalto',
  model: 'PA-3220',
  displayName: 'Palo Alto PA-3220',
  image: {},
  aspectRatio: 8.5,
  modelPatterns: ['PA-3220', 'PA3220', 'PA-3200'],
  ports: [
    // MGT and HA ports
    { number: 1, label: 'MGT', x: 6, y: 35, type: 'rj45', row: 1 },
    { number: 2, label: 'HA1', x: 12, y: 35, type: 'rj45', row: 1 },
    // RJ45 data ports 1-6 (top row)
    { number: 3, label: '1', x: 22, y: 35, type: 'rj45', row: 1 },
    { number: 4, label: '2', x: 28, y: 35, type: 'rj45', row: 1 },
    { number: 5, label: '3', x: 34, y: 35, type: 'rj45', row: 1 },
    { number: 6, label: '4', x: 40, y: 35, type: 'rj45', row: 1 },
    { number: 7, label: '5', x: 46, y: 35, type: 'rj45', row: 1 },
    { number: 8, label: '6', x: 52, y: 35, type: 'rj45', row: 1 },
    // HA2 and RJ45 data ports 7-12 (bottom row)
    { number: 9, label: 'HA2', x: 12, y: 65, type: 'rj45', row: 2 },
    { number: 10, label: '7', x: 22, y: 65, type: 'rj45', row: 2 },
    { number: 11, label: '8', x: 28, y: 65, type: 'rj45', row: 2 },
    { number: 12, label: '9', x: 34, y: 65, type: 'rj45', row: 2 },
    { number: 13, label: '10', x: 40, y: 65, type: 'rj45', row: 2 },
    { number: 14, label: '11', x: 46, y: 65, type: 'rj45', row: 2 },
    { number: 15, label: '12', x: 52, y: 65, type: 'rj45', row: 2 },
    // SFP+ ports (right side, stacked)
    { number: 16, label: 'SFP+1', x: 62, y: 35, type: 'sfp+', row: 1 },
    { number: 17, label: 'SFP+2', x: 68, y: 35, type: 'sfp+', row: 1 },
    { number: 18, label: 'SFP+3', x: 62, y: 65, type: 'sfp+', row: 2 },
    { number: 19, label: 'SFP+4', x: 68, y: 65, type: 'sfp+', row: 2 },
  ],
};

// All templates registry
export const SWITCH_TEMPLATES: SwitchTemplate[] = [
  // UniFi
  UDM_PRO,
  USW_24,
  USW_16_POE,
  USW_FLEX_MINI,
  // Cisco
  CISCO_9300_24,
  // FortiGate
  FORTIGATE_60F,
  FORTIGATE_100F,
  FORTIGATE_200F,
  // Palo Alto
  PALOALTO_PA220,
  PALOALTO_PA440,
  PALOALTO_PA460,
  PALOALTO_PA3220,
  // Generic
  GENERIC_8_PORT,
  GENERIC_16_PORT,
  GENERIC_24_PORT,
  GENERIC_48_PORT,
];

// Find template by ID (checks custom templates first)
export function getTemplateById(id: string): SwitchTemplate | undefined {
  // Check custom templates first (allows overriding built-in)
  const customTemplates = loadCustomTemplates();
  const custom = customTemplates.find(t => t.id === id);
  if (custom) return custom;

  return SWITCH_TEMPLATES.find(t => t.id === id);
}

// Find template by model name (uses pattern matching)
export function getTemplateByModel(model: string): SwitchTemplate | undefined {
  const allTemplates = getAllTemplates();

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

// Get best generic template for port count
export function getGenericTemplate(portCount: number): SwitchTemplate {
  if (portCount <= 8) return GENERIC_8_PORT;
  if (portCount <= 16) return GENERIC_16_PORT;
  if (portCount <= 24) return GENERIC_24_PORT;
  return GENERIC_48_PORT;
}
