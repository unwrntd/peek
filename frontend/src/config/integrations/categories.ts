/**
 * Integration Categories Configuration
 *
 * Defines all integration categories with metadata and provides
 * helper functions for grouping integrations by category.
 */

import { IntegrationCategory, IntegrationConfig } from './types';
import { integrationConfigs } from './index';

export interface CategoryConfig {
  /** Category identifier */
  id: IntegrationCategory;
  /** Display name */
  name: string;
  /** Category description */
  description: string;
  /** Display order (lower = first) */
  order: number;
}

/**
 * Category definitions with display metadata
 */
export const categories: CategoryConfig[] = [
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    description: 'Virtualization and server management',
    order: 1,
  },
  {
    id: 'networking',
    name: 'Networking',
    description: 'Network devices and security',
    order: 2,
  },
  {
    id: 'media-servers',
    name: 'Media Servers',
    description: 'Media streaming and playback',
    order: 3,
  },
  {
    id: 'media-management',
    name: 'Media Management',
    description: 'Content automation and requests',
    order: 4,
  },
  {
    id: 'download-clients',
    name: 'Download Clients',
    description: 'File downloads and transcoding',
    order: 5,
  },
  {
    id: 'smart-home',
    name: 'Smart Home',
    description: 'Home automation and IoT devices',
    order: 6,
  },
  {
    id: 'storage',
    name: 'Storage & NAS',
    description: 'File storage and photo management',
    order: 7,
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    description: 'System monitoring and remote access',
    order: 8,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Network security and firewalls',
    order: 9,
  },
  {
    id: 'utilities',
    name: 'Utilities',
    description: 'Weather and other utilities',
    order: 10,
  },
];

/**
 * Get category configuration by ID
 */
export function getCategoryConfig(categoryId: IntegrationCategory): CategoryConfig | undefined {
  return categories.find((c) => c.id === categoryId);
}

/**
 * Get all categories sorted by order
 */
export function getSortedCategories(): CategoryConfig[] {
  return [...categories].sort((a, b) => a.order - b.order);
}

/**
 * Group integrations by category
 */
export function getIntegrationsByCategory(): Map<IntegrationCategory, IntegrationConfig[]> {
  const grouped = new Map<IntegrationCategory, IntegrationConfig[]>();

  // Initialize all categories with empty arrays
  for (const category of categories) {
    grouped.set(category.id, []);
  }

  // Group integrations
  for (const config of Object.values(integrationConfigs)) {
    const categoryList = grouped.get(config.category);
    if (categoryList) {
      categoryList.push(config);
    }
  }

  // Sort integrations within each category by display name
  for (const [, configs] of grouped) {
    configs.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return grouped;
}

/**
 * Get integrations for a specific category
 */
export function getIntegrationsForCategory(categoryId: IntegrationCategory): IntegrationConfig[] {
  return Object.values(integrationConfigs)
    .filter((config) => config.category === categoryId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Get total widget count for an integration
 */
export function getWidgetCount(config: IntegrationConfig): number {
  return config.widgets.length;
}

/**
 * Search integrations by name or description
 */
export function searchIntegrations(query: string): IntegrationConfig[] {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) {
    return Object.values(integrationConfigs);
  }

  return Object.values(integrationConfigs).filter(
    (config) =>
      config.displayName.toLowerCase().includes(queryLower) ||
      config.description.toLowerCase().includes(queryLower) ||
      config.type.toLowerCase().includes(queryLower)
  );
}
