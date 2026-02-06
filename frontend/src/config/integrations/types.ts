/**
 * Centralized Integration & Widget Configuration Types
 *
 * This file defines the structure for all integration and widget configurations.
 * When adding a new integration, create a new config file following this structure.
 */

// ============================================================================
// Auth Configuration Types
// ============================================================================

export type AuthMethod = 'api' | 'basic' | 'token';

export interface AuthFieldConfig {
  /** Field key used in form state and config object */
  key: string;
  /** Display label */
  label: string;
  /** Input type (text, password, number) */
  type: 'text' | 'password' | 'number';
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Default value */
  defaultValue?: string | number;
  /** Help text shown below the field */
  helpText?: string;
  /** Grid column span (1 or 2, default 1) */
  colSpan?: 1 | 2;
  /** Special field type for custom rendering (token-generator, ip-list) */
  specialType?: 'token-generator' | 'ip-list';
  /** Whether field should be rendered standalone (outside grid) */
  standalone?: boolean;
}

export interface AuthMethodConfig {
  /** Auth method identifier */
  method: AuthMethod;
  /** Display label for the auth method button */
  label: string;
  /** Fields shown when this auth method is selected */
  fields: AuthFieldConfig[];
}

export interface AuthConfig {
  /** Available authentication methods (api, basic). Empty array means no auth selector shown. */
  methods: AuthMethodConfig[];
  /** Default auth method */
  defaultMethod: AuthMethod;
  /** Additional fields shown regardless of auth method (e.g., host, port) */
  commonFields: AuthFieldConfig[];
  /** Help text shown at the bottom of auth section */
  helpText?: string;
}

// ============================================================================
// Widget Configuration Types
// ============================================================================

export interface FilterOption {
  value: string;
  label: string;
}

export interface CheckboxGroupItem {
  label: string;
  key: string;
}

export interface FilterConfig {
  /** Display label */
  label: string;
  /** Config key */
  key: string;
  /** Filter type */
  type: 'select' | 'text' | 'number' | 'checkbox' | 'checkbox-group' | 'switch-select' | 'switch-select-single' | 'button-group' | 'camera-select' | 'ring-camera-select' | 'tapo-device-select' | 'tapo-sensor-select' | 'kasa-device-select' | 'homeconnect-fridge-select' | 'color' | 'timezone-multi-select' | 'weather-location-search' | 'integration-select' | 'template-select' | 'device-template-select' | 'ap-select' | 'image-select' | 'beszel-host-select' | 'beszel-host-order' | 'beszel-temp-select' | 'beszel-host-icons' | 'service-status-selector';
  /** For integration-select: filter integrations by these types */
  integrationTypes?: string[];
  /** Options for select or button-group type */
  options?: FilterOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Items for checkbox-group type */
  items?: CheckboxGroupItem[];
  /** Default enabled state for checkbox-group items */
  defaultEnabled?: boolean;
  /** Minimum value for number type */
  min?: number;
  /** Maximum value for number type */
  max?: number;
  /** Default value */
  defaultValue?: string | number | boolean;
  /** Conditional display based on another config value */
  dependsOn?: { key: string; value: unknown };
  /** Group name for organizing filters into collapsible sections */
  group?: string;
  /** Whether the group should be collapsed by default (only applies to first filter in group) */
  groupCollapsedByDefault?: boolean;
}

export interface VisualizationOption {
  value: string;
  label: string;
}

export interface WidgetConfig {
  /** Unique widget type identifier */
  type: string;
  /** Display name */
  name: string;
  /** Description shown in widget picker */
  description: string;
  /** Metric endpoint to fetch data from */
  metric: string;
  /** Default grid size */
  defaultSize: { w: number; h: number };
  /** Minimum grid size */
  minSize?: { w: number; h: number };
  /** Available visualization options (shown in Appearance tab) */
  visualizations?: VisualizationOption[];
  /** Filter configurations (shown in Filters tab) */
  filters?: FilterConfig[];
  /** Whether this widget supports hideLabels option */
  supportsHideLabels?: boolean;
  /** Whether this widget supports metricSize option */
  supportsMetricSize?: boolean;
}

// ============================================================================
// Integration Category Types
// ============================================================================

export type IntegrationCategory =
  | 'infrastructure'
  | 'networking'
  | 'media-servers'
  | 'media-management'
  | 'download-clients'
  | 'smart-home'
  | 'storage'
  | 'monitoring'
  | 'security'
  | 'utilities';

export interface IntegrationDependencies {
  /** External APIs used by this integration */
  apis?: string[];
  /** Notable npm packages required */
  packages?: string[];
  /** Special requirements or notes */
  notes?: string;
}

// ============================================================================
// Integration Configuration Type
// ============================================================================

export interface IntegrationConfig {
  /** Unique integration type identifier (e.g., 'proxmox', 'unifi') */
  type: string;
  /** Display name (e.g., 'Proxmox VE', 'UniFi Controller') */
  displayName: string;
  /** Category for grouping integrations */
  category: IntegrationCategory;
  /** Brief description of what this integration does */
  description: string;
  /** Link to official documentation */
  documentationUrl?: string;
  /** External dependencies and APIs used */
  dependencies?: IntegrationDependencies;
  /** Custom icon identifier (optional) */
  icon?: string;
  /** Sample name shown as placeholder in name field */
  sampleName: string;
  /** Default port */
  defaultPort: number;
  /** Sample host placeholder */
  sampleHost: string;
  /** Authentication configuration */
  auth: AuthConfig;
  /** Widget definitions for this integration */
  widgets: WidgetConfig[];
}

// ============================================================================
// Static Widget Configuration (no integration required)
// ============================================================================

export interface StaticWidgetConfig extends Omit<WidgetConfig, 'metric'> {
  /** Metric is optional for static widgets */
  metric?: string;
}
