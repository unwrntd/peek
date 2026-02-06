/**
 * Form utilities for IntegrationForm
 */

import { Integration } from '../../../types';
import {
  getIntegrationConfig,
  getIntegrationDefaultPort,
  AuthConfig,
  AuthMethod,
  AuthFieldConfig,
} from '../../../config/integrations';
import { FormState, FormAction } from './types';

/**
 * Get the initial auth method for an integration type
 */
export function getInitialAuthMethod(
  integration: Integration | null | undefined,
  integrationType: string
): AuthMethod {
  const config = getIntegrationConfig(integrationType);
  if (!config?.auth) return 'api';

  // If editing, detect auth method from existing config
  if (integration?.config) {
    const existingConfig = integration.config as Record<string, unknown>;
    const availableMethods = config.auth.methods.map(m => m.method);

    // Check which method's fields are present in the existing config
    for (const methodConfig of config.auth.methods) {
      const hasMethodFields = methodConfig.fields.some(field =>
        existingConfig[field.key] !== undefined && existingConfig[field.key] !== null
      );
      if (hasMethodFields) {
        return methodConfig.method;
      }
    }

    // Fallback detection for common patterns
    // Check for API token-based auth (Proxmox style)
    if (existingConfig.tokenId || existingConfig.tokenSecret) {
      if (availableMethods.includes('api')) return 'api';
    }
    // Check for apiKey
    if (existingConfig.apiKey) {
      if (availableMethods.includes('api')) return 'api';
    }
    // Check for token (generic) - but only if 'token' method exists
    if (existingConfig.token && availableMethods.includes('token')) {
      return 'token';
    }
    // Check for refreshToken (Ring, HomeConnect style)
    if (existingConfig.refreshToken && !existingConfig.username) {
      if (availableMethods.includes('token')) return 'token';
    }
    // Check for basic auth
    if (existingConfig.username || existingConfig.password) {
      if (availableMethods.includes('basic')) return 'basic';
    }
  }

  return config.auth.defaultMethod;
}

/**
 * Extract field values from an existing integration config
 */
export function extractFieldValues(
  integration: Integration | null | undefined,
  authConfig: AuthConfig | undefined,
  authMethod: AuthMethod
): Record<string, string | number | boolean> {
  const fields: Record<string, string | number | boolean> = {};

  if (!integration?.config || !authConfig) return fields;

  const existingConfig = integration.config as Record<string, unknown>;

  // Extract common fields
  for (const field of authConfig.commonFields) {
    const value = existingConfig[field.key];
    if (value !== undefined && value !== null) {
      fields[field.key] = value as string | number | boolean;
    } else if (field.defaultValue !== undefined) {
      fields[field.key] = field.defaultValue;
    }
  }

  // Extract method-specific fields
  const methodConfig = authConfig.methods.find((m) => m.method === authMethod);
  if (methodConfig) {
    for (const field of methodConfig.fields) {
      const value = existingConfig[field.key];
      if (value !== undefined && value !== null) {
        // Handle array fields (deviceIps, hubIps)
        if (Array.isArray(value)) {
          fields[field.key] = (value as string[]).join(', ');
        } else {
          fields[field.key] = value as string | number | boolean;
        }
      } else if (field.defaultValue !== undefined) {
        fields[field.key] = field.defaultValue;
      }
    }
  }

  // Also extract host and port which are common across many integrations
  // but may not be in auth config fields (handled separately by the form)
  if (existingConfig.host !== undefined && existingConfig.host !== null) {
    fields.host = existingConfig.host as string;
  }
  if (existingConfig.port !== undefined && existingConfig.port !== null) {
    fields.port = existingConfig.port as number;
  }

  // Also extract verifySSL which is common across many integrations
  if (existingConfig.verifySSL !== undefined) {
    fields.verifySSL = existingConfig.verifySSL as boolean;
  }

  return fields;
}

/**
 * Initialize form state from an existing integration or defaults
 */
export function initializeFormState(
  integration: Integration | null | undefined,
  defaultType: string = ''
): FormState {
  const type = integration?.type || defaultType;
  const config = getIntegrationConfig(type);
  const authMethod = getInitialAuthMethod(integration, type);
  const fields = extractFieldValues(integration, config?.auth, authMethod);

  // Set default port if not present
  if (config?.auth?.commonFields.some((f) => f.key === 'port') && !fields.port) {
    fields.port = getIntegrationDefaultPort(type);
  }

  // Set verifySSL default
  if (fields.verifySSL === undefined) {
    fields.verifySSL = false;
  }

  return {
    type,
    name: integration?.name || '',
    enabled: integration?.enabled ?? true,
    authMethod,
    fields,
    saving: false,
    error: null,
    showRingTokenGenerator: false,
    showHomeConnectTokenGenerator: false,
    showSonosTokenGenerator: false,
    showEcobeeTokenGenerator: false,
  };
}

/**
 * Form state reducer
 */
export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_TYPE':
      return { ...state, type: action.value };
    case 'SET_NAME':
      return { ...state, name: action.value };
    case 'SET_ENABLED':
      return { ...state, enabled: action.value };
    case 'SET_AUTH_METHOD':
      return { ...state, authMethod: action.value };
    case 'SET_FIELD':
      return {
        ...state,
        fields: { ...state.fields, [action.key]: action.value },
      };
    case 'SET_FIELDS':
      return { ...state, fields: action.fields };
    case 'SET_SAVING':
      return { ...state, saving: action.value };
    case 'SET_ERROR':
      return { ...state, error: action.value };
    case 'SHOW_RING_TOKEN_GENERATOR':
      return { ...state, showRingTokenGenerator: action.value };
    case 'SHOW_HOMECONNECT_TOKEN_GENERATOR':
      return { ...state, showHomeConnectTokenGenerator: action.value };
    case 'SHOW_SONOS_TOKEN_GENERATOR':
      return { ...state, showSonosTokenGenerator: action.value };
    case 'SHOW_ECOBEE_TOKEN_GENERATOR':
      return { ...state, showEcobeeTokenGenerator: action.value };
    case 'RESET':
      return action.state;
    default:
      return state;
  }
}

/**
 * Get all field configs for an auth config and method
 */
export function getAllFieldConfigs(
  authConfig: AuthConfig | undefined,
  authMethod: AuthMethod
): AuthFieldConfig[] {
  if (!authConfig) return [];

  const fields: AuthFieldConfig[] = [...authConfig.commonFields];

  const methodConfig = authConfig.methods.find((m) => m.method === authMethod);
  if (methodConfig) {
    fields.push(...methodConfig.fields);
  }

  return fields;
}

/**
 * Build integration config object from form state
 * This single function replaces the 25+ if/else blocks in the original code
 */
export function buildIntegrationConfig(
  integrationType: string,
  authMethod: AuthMethod,
  fields: Record<string, string | number | boolean>
): Record<string, unknown> {
  const integrationConfig = getIntegrationConfig(integrationType);
  const authConfig = integrationConfig?.auth;
  const config: Record<string, unknown> = {};

  if (!authConfig) {
    // No auth config means just return fields as-is
    return { ...fields };
  }

  // Add common fields
  for (const field of authConfig.commonFields) {
    const value = fields[field.key];
    if (value !== undefined && value !== '') {
      config[field.key] = field.type === 'number' ? Number(value) : value;
    }
  }

  // Add method-specific fields
  const methodConfig = authConfig.methods.find((m) => m.method === authMethod);
  if (methodConfig) {
    for (const field of methodConfig.fields) {
      const value = fields[field.key];
      if (value !== undefined && value !== '') {
        // Handle comma-separated IP lists
        if (
          field.key === 'deviceIps' ||
          field.key === 'hubIps'
        ) {
          // Keep as string for now, backend can parse
          config[field.key] = String(value).trim() || undefined;
        } else if (field.type === 'number') {
          config[field.key] = Number(value);
        } else {
          config[field.key] = value;
        }
      }
    }
  }

  // Add verifySSL if present and the integration supports it
  if (fields.verifySSL !== undefined && hasVerifySSL(integrationType)) {
    config.verifySSL = Boolean(fields.verifySSL);
  }

  return config;
}

/**
 * Check if an integration supports verifySSL option
 */
function hasVerifySSL(integrationType: string): boolean {
  // These integrations don't support verifySSL
  const noSSLIntegrations = [
    'tapo',
    'kasa',
    'ring',
    'weather',
    'homeconnect',
    'sonos',
  ];
  return !noSSLIntegrations.includes(integrationType);
}

/**
 * Get default field values for a new integration type
 */
export function getDefaultFieldValues(
  integrationType: string,
  authMethod: AuthMethod
): Record<string, string | number | boolean> {
  const config = getIntegrationConfig(integrationType);
  const fields: Record<string, string | number | boolean> = {};

  if (!config?.auth) return fields;

  // Set defaults for common fields
  for (const field of config.auth.commonFields) {
    if (field.defaultValue !== undefined) {
      fields[field.key] = field.defaultValue;
    } else if (field.key === 'port') {
      fields.port = getIntegrationDefaultPort(integrationType);
    }
  }

  // Set defaults for method-specific fields
  const methodConfig = config.auth.methods.find((m) => m.method === authMethod);
  if (methodConfig) {
    for (const field of methodConfig.fields) {
      if (field.defaultValue !== undefined) {
        fields[field.key] = field.defaultValue;
      }
    }
  }

  // Default verifySSL
  if (hasVerifySSL(integrationType)) {
    fields.verifySSL = false;
  }

  return fields;
}

/**
 * Validate required fields for submission
 */
export function validateRequiredFields(
  authConfig: AuthConfig | undefined,
  authMethod: AuthMethod,
  fields: Record<string, string | number | boolean>
): string | null {
  if (!authConfig) return null;

  // Check common fields
  for (const field of authConfig.commonFields) {
    if (field.required && !fields[field.key]) {
      return `${field.label} is required`;
    }
  }

  // Check method-specific fields
  const methodConfig = authConfig.methods.find((m) => m.method === authMethod);
  if (methodConfig) {
    for (const field of methodConfig.fields) {
      if (field.required && !fields[field.key]) {
        return `${field.label} is required`;
      }
    }
  }

  return null;
}
