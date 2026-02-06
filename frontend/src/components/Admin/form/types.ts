/**
 * Form-specific types for IntegrationForm
 */

import { AuthMethod } from '../../../config/integrations/types';

/**
 * Main form state managed by useReducer
 */
export interface FormState {
  /** Integration type (proxmox, unifi, etc.) */
  type: string;
  /** Display name */
  name: string;
  /** Whether integration is enabled */
  enabled: boolean;
  /** Current auth method (api, basic, token) */
  authMethod: AuthMethod;
  /** All dynamic field values keyed by field key */
  fields: Record<string, string | number | boolean>;
  /** Whether form is submitting */
  saving: boolean;
  /** Error message if any */
  error: string | null;
  /** Token generator modals */
  showRingTokenGenerator: boolean;
  showHomeConnectTokenGenerator: boolean;
  showSonosTokenGenerator: boolean;
  showEcobeeTokenGenerator: boolean;
}

/**
 * Actions for form reducer
 */
export type FormAction =
  | { type: 'SET_TYPE'; value: string }
  | { type: 'SET_NAME'; value: string }
  | { type: 'SET_ENABLED'; value: boolean }
  | { type: 'SET_AUTH_METHOD'; value: AuthMethod }
  | { type: 'SET_FIELD'; key: string; value: string | number | boolean }
  | { type: 'SET_FIELDS'; fields: Record<string, string | number | boolean> }
  | { type: 'SET_SAVING'; value: boolean }
  | { type: 'SET_ERROR'; value: string | null }
  | { type: 'SHOW_RING_TOKEN_GENERATOR'; value: boolean }
  | { type: 'SHOW_HOMECONNECT_TOKEN_GENERATOR'; value: boolean }
  | { type: 'SHOW_SONOS_TOKEN_GENERATOR'; value: boolean }
  | { type: 'SHOW_ECOBEE_TOKEN_GENERATOR'; value: boolean }
  | { type: 'RESET'; state: FormState };

/**
 * Props for DynamicField component
 */
export interface DynamicFieldProps {
  fieldKey: string;
  label: string;
  type: 'text' | 'password' | 'number';
  value: string | number | boolean;
  onChange: (key: string, value: string | number | boolean) => void;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  colSpan?: 1 | 2;
  disabled?: boolean;
}

/**
 * Props for custom field renderers
 */
export interface CustomFieldRendererProps {
  fieldKey: string;
  value: string | number | boolean;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled?: boolean;
  /** Additional props for specific renderers */
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  onShowGenerator?: () => void;
  /** Integration type for context-aware renderers */
  integrationType?: string;
  /** Current form field values for accessing other fields */
  formFields?: Record<string, string | number | boolean>;
}

/**
 * Type for custom field renderer component
 */
export type CustomFieldRenderer = React.FC<CustomFieldRendererProps>;
