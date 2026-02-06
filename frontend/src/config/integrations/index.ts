/**
 * Integration Configuration Registry
 *
 * This file provides a centralized registry for all integration configurations.
 * To add a new integration, create a config file in this directory and register it here.
 */

import { IntegrationConfig, WidgetConfig, StaticWidgetConfig, AuthConfig } from './types';
import { proxmoxConfig } from './proxmox';
import { unifiConfig } from './unifi';
import { unifiProtectConfig } from './unifi-protect';
import { beszelConfig } from './beszel';
import { adguardConfig } from './adguard';
import { qnapConfig } from './qnap';
import { plexConfig } from './plex';
import { ciscoIosxeConfig } from './cisco-iosxe';
import { pikvmConfig } from './pikvm';
import { glkvmConfig } from './glkvm';
import { tautulliConfig } from './tautulli';
import { tapoConfig } from './tapo';
import { kasaConfig } from './kasa';
import { overseerrConfig } from './overseerr';
import { homeConnectConfig } from './homeconnect';
import { sonarrConfig } from './sonarr';
import { radarrConfig } from './radarr';
import { tdarrConfig } from './tdarr';
import { bazarrConfig } from './bazarr';
import { prowlarrConfig } from './prowlarr';
import { sabnzbdConfig } from './sabnzbd';
import { qbittorrentConfig } from './qbittorrent';
import { ringConfig } from './ring';
import { immichConfig } from './immich';
import { weatherConfig } from './weather';
import { homebridgeConfig } from './homebridge';
import { homeAssistantConfig } from './homeassistant';
import { netalertxConfig } from './netalertx';
import { actualbudgetConfig } from './actualbudget';
import { nodeRedConfig } from './nodered';
import { ollamaConfig } from './ollama';
import { kasmConfig } from './kasm';
import { wazuhConfig } from './wazuh';
import { paperlessConfig } from './paperless';
import { sonosConfig } from './sonos';
import { mikrotikConfig } from './mikrotik';
import { controldConfig } from './controld';
import { notionConfig } from './notion';
import { slackConfig } from './slack';
import { onePasswordConfig } from './onepassword';
import { discordConfig } from './discord';
import { geSmartHQConfig } from './ge-smarthq';
import { lgThinQConfig } from './lg-thinq';
import { plantitConfig } from './plantit';
import { homekitConfig } from './homekit';
import { microsoft365Config } from './microsoft365';
import { googleWorkspaceConfig } from './google-workspace';
import { storjConfig } from './storj';
import { kitchenowlConfig } from './kitchenowl';
import { esxiConfig } from './esxi';
import { panosConfig } from './panos';
import { fortigateConfig } from './fortigate';
import { githubConfig } from './github';
import { giteaConfig } from './gitea';
import { dockerConfig } from './docker';
import { tailscaleConfig } from './tailscale';
import { opnsenseConfig } from './opnsense';
// import { ecobeeConfig } from './ecobee'; // Disabled: Ecobee closed developer program
import { staticWidgets, refreshIntervalFilter } from './static';
import { crossIntegrationWidgets, getCrossIntegrationWidgetConfig, isCrossIntegrationWidget, crossIntegrationRequirements } from './cross-integration';

// Re-export types for convenience
export * from './types';

// Re-export categories
export * from './categories';

// ============================================================================
// Integration Registry
// ============================================================================

/**
 * All registered integration configurations
 */
export const integrationConfigs: IntegrationConfig[] = [
  proxmoxConfig,
  unifiConfig,
  unifiProtectConfig,
  beszelConfig,
  adguardConfig,
  qnapConfig,
  plexConfig,
  ciscoIosxeConfig,
  pikvmConfig,
  glkvmConfig,
  tautulliConfig,
  tapoConfig,
  kasaConfig,
  overseerrConfig,
  homeConnectConfig,
  sonarrConfig,
  radarrConfig,
  tdarrConfig,
  bazarrConfig,
  prowlarrConfig,
  sabnzbdConfig,
  qbittorrentConfig,
  ringConfig,
  immichConfig,
  weatherConfig,
  homebridgeConfig,
  homeAssistantConfig,
  netalertxConfig,
  actualbudgetConfig,
  nodeRedConfig,
  ollamaConfig,
  kasmConfig,
  wazuhConfig,
  paperlessConfig,
  sonosConfig,
  mikrotikConfig,
  controldConfig,
  notionConfig,
  slackConfig,
  onePasswordConfig,
  discordConfig,
  geSmartHQConfig,
  lgThinQConfig,
  plantitConfig,
  homekitConfig,
  microsoft365Config,
  googleWorkspaceConfig,
  storjConfig,
  kitchenowlConfig,
  esxiConfig,
  panosConfig,
  fortigateConfig,
  githubConfig,
  giteaConfig,
  dockerConfig,
  tailscaleConfig,
  opnsenseConfig,
  // ecobeeConfig, // Disabled: Ecobee closed developer program
];

/**
 * Integration configs indexed by type for O(1) lookup
 */
export const integrationConfigMap: Record<string, IntegrationConfig> = Object.fromEntries(
  integrationConfigs.map(config => [config.type, config])
);

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get integration config by type
 */
export function getIntegrationConfig(type: string): IntegrationConfig | undefined {
  return integrationConfigMap[type];
}

/**
 * Get authentication config for an integration type
 */
export function getAuthConfig(integrationType: string): AuthConfig | undefined {
  return integrationConfigMap[integrationType]?.auth;
}

/**
 * Get all widget configs for an integration type
 */
export function getWidgetsForIntegration(integrationType: string): WidgetConfig[] {
  return integrationConfigMap[integrationType]?.widgets || [];
}

/**
 * Get a specific widget config by integration type and widget type
 */
export function getWidgetConfig(
  integrationType: string,
  widgetType: string
): WidgetConfig | undefined {
  const integration = integrationConfigMap[integrationType];
  return integration?.widgets.find(w => w.type === widgetType);
}

/**
 * Get display name for an integration type
 */
export function getIntegrationDisplayName(type: string): string {
  return integrationConfigMap[type]?.displayName || type;
}

/**
 * Get sample name for an integration type
 */
export function getIntegrationSampleName(type: string): string {
  return integrationConfigMap[type]?.sampleName || `My ${type}`;
}

/**
 * Get default port for an integration type
 */
export function getIntegrationDefaultPort(type: string): number {
  return integrationConfigMap[type]?.defaultPort || 443;
}

/**
 * Get sample host for an integration type
 */
export function getIntegrationSampleHost(type: string): string {
  return integrationConfigMap[type]?.sampleHost || '192.168.1.1';
}

// ============================================================================
// Static Widgets
// ============================================================================

/**
 * Static widgets that don't require an integration
 */
export { staticWidgets };

/**
 * Reusable refresh interval filter for widget configs
 */
export { refreshIntervalFilter };

/**
 * Cross-integration widgets
 */
export { crossIntegrationWidgets, getCrossIntegrationWidgetConfig, isCrossIntegrationWidget, crossIntegrationRequirements };

/**
 * All static-like widgets (static + cross-integration)
 */
export const allStaticWidgets: StaticWidgetConfig[] = [
  ...staticWidgets,
  ...crossIntegrationWidgets,
];

/**
 * Static widget configs indexed by type (includes cross-integration)
 */
export const staticWidgetMap: Record<string, StaticWidgetConfig> = Object.fromEntries(
  allStaticWidgets.map(config => [config.type, config])
);

/**
 * Get static widget config by type (includes cross-integration)
 */
export function getStaticWidgetConfig(type: string): StaticWidgetConfig | undefined {
  return staticWidgetMap[type];
}

// ============================================================================
// Combined Widget Lookup
// ============================================================================

/**
 * Get any widget config (integration or static) by type
 * Searches integration widgets first, then static widgets
 */
export function getAnyWidgetConfig(
  widgetType: string,
  integrationType?: string
): WidgetConfig | StaticWidgetConfig | undefined {
  // If integration type provided, search that integration first
  if (integrationType) {
    const integrationWidget = getWidgetConfig(integrationType, widgetType);
    if (integrationWidget) return integrationWidget;
  }

  // Search all integrations
  for (const config of integrationConfigs) {
    const widget = config.widgets.find(w => w.type === widgetType);
    if (widget) return widget;
  }

  // Check static widgets (includes cross-integration)
  return getStaticWidgetConfig(widgetType);
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if an integration type is valid
 */
export function isValidIntegrationType(type: string): boolean {
  return type in integrationConfigMap;
}

/**
 * Check if a widget type is valid for an integration
 */
export function isValidWidgetType(integrationType: string, widgetType: string): boolean {
  const integration = integrationConfigMap[integrationType];
  return integration?.widgets.some(w => w.type === widgetType) || false;
}

/**
 * Get all valid integration types
 */
export function getAllIntegrationTypes(): string[] {
  return integrationConfigs.map(c => c.type);
}

/**
 * Get all valid widget types for an integration
 */
export function getAllWidgetTypes(integrationType: string): string[] {
  const integration = integrationConfigMap[integrationType];
  return integration?.widgets.map(w => w.type) || [];
}

/**
 * Get minimum size for a widget type
 * Returns { w: 1, h: 1 } as default if not specified
 */
export function getWidgetMinSize(
  widgetType: string,
  integrationType?: string
): { w: number; h: number } {
  const config = getAnyWidgetConfig(widgetType, integrationType);
  return config?.minSize || { w: 1, h: 1 };
}
