import React, { useReducer, useRef, useEffect, useMemo, useCallback } from 'react';
import { Integration, IntegrationConfig } from '../../types';
import { useIntegrationStore } from '../../stores/integrationStore';

type IntegrationType = Integration['type'];
import {
  getIntegrationConfig,
  getIntegrationSampleName,
  getIntegrationDefaultPort,
  getIntegrationSampleHost,
  AuthMethod,
} from '../../config/integrations';
import { RingTokenGenerator } from './RingTokenGenerator';
import { HomeConnectTokenGenerator } from './HomeConnectTokenGenerator';
import { SonosTokenGenerator } from './SonosTokenGenerator';
import { EcobeeTokenGenerator } from './EcobeeTokenGenerator';
import {
  FormState,
  FormAction,
  initializeFormState,
  formReducer,
  buildIntegrationConfig,
  getInitialAuthMethod,
  getDefaultFieldValues,
} from './form';
import { AuthMethodSelector } from './form/AuthMethodSelector';
import { AuthFieldsSection } from './form/AuthFieldsSection';

interface IntegrationFormProps {
  integration?: Integration | null;
  defaultType?: string;
  onClose: () => void;
  onSaved: () => void;
}

// Cloud-only integrations that don't need host/port fields
const CLOUD_ONLY_INTEGRATIONS = ['ring', 'weather', 'homeconnect', 'sonos', 'ecobee', 'slack', 'notion', 'controld', 'discord', 'ge-smarthq', 'lg-thinq'];

// Integrations that render their own host/port in auth fields (to avoid duplicates)
const INTEGRATIONS_WITH_INLINE_HOST_PORT = ['tapo', 'kasa'];

/**
 * Check if an integration needs host/port fields
 * Returns false if host/port are already defined in auth config (commonFields or any method's fields)
 */
function needsHostPort(integrationType: string): boolean {
  if (CLOUD_ONLY_INTEGRATIONS.includes(integrationType)) return false;
  if (INTEGRATIONS_WITH_INLINE_HOST_PORT.includes(integrationType)) return false;

  const config = getIntegrationConfig(integrationType);
  if (!config?.auth) return true;

  // Check if host is in commonFields
  if (config.auth.commonFields.some((f) => f.key === 'host')) return false;

  // Check if host is in any auth method's fields (for integrations with conditional host/port)
  const hasHostInMethods = config.auth.methods.some((method) =>
    method.fields.some((f) => f.key === 'host')
  );
  if (hasHostInMethods) return false;

  return true;
}

/**
 * Check if an integration supports verifySSL
 */
function supportsVerifySSL(integrationType: string): boolean {
  // Cloud-only and local network integrations that don't use HTTPS with configurable SSL
  const noSSLIntegrations = ['tapo', 'kasa', 'ring', 'weather', 'homeconnect', 'sonos', 'ecobee', 'slack', 'notion', 'controld', 'discord'];
  return !noSSLIntegrations.includes(integrationType);
}

export function IntegrationForm({ integration, defaultType, onClose, onSaved }: IntegrationFormProps) {
  const { createIntegration, updateIntegration, integrationTypes, checkConnection } = useIntegrationStore();
  const isEditing = !!integration;

  // Initialize form state from existing integration or defaults
  const [state, dispatch] = useReducer(formReducer, integration, (int) => initializeFormState(int, defaultType));

  // Type selector dropdown state
  const [typeDropdownOpen, setTypeDropdownOpen] = React.useState(false);
  const [typeSearch, setTypeSearch] = React.useState('');
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const typeInputRef = useRef<HTMLInputElement>(null);

  // Get integration config
  const integrationConfig = useMemo(() => getIntegrationConfig(state.type), [state.type]);
  const authConfig = integrationConfig?.auth;

  // Filter and sort integration types alphabetically by name
  const filteredTypes = useMemo(() => {
    let types = [...integrationTypes];
    if (typeSearch.trim()) {
      const query = typeSearch.toLowerCase();
      types = types.filter((t) =>
        t.name.toLowerCase().includes(query) || t.type.toLowerCase().includes(query)
      );
    }
    return types.sort((a, b) => a.name.localeCompare(b.name));
  }, [integrationTypes, typeSearch]);

  // Get selected type display name
  const selectedTypeName = useMemo(() => {
    if (!state.type) return '';
    const found = integrationTypes.find((t) => t.type === state.type);
    return found?.name || state.type;
  }, [integrationTypes, state.type]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setTypeDropdownOpen(false);
        setTypeSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (typeDropdownOpen && typeInputRef.current) {
      typeInputRef.current.focus();
    }
  }, [typeDropdownOpen]);

  // Handle type selection
  const handleTypeSelect = useCallback((newType: string) => {
    const newAuthMethod = getInitialAuthMethod(null, newType);
    const newFields = getDefaultFieldValues(newType, newAuthMethod);

    // Set default port for the new type
    if (needsHostPort(newType)) {
      newFields.port = getIntegrationDefaultPort(newType);
    }

    dispatch({ type: 'SET_TYPE', value: newType });
    dispatch({ type: 'SET_AUTH_METHOD', value: newAuthMethod });
    dispatch({ type: 'SET_FIELDS', fields: newFields });
    setTypeDropdownOpen(false);
    setTypeSearch('');
  }, []);

  // Handle field changes
  const handleFieldChange = useCallback((key: string, value: string | number | boolean) => {
    dispatch({ type: 'SET_FIELD', key, value });
  }, []);

  // Handle auth method changes
  const handleAuthMethodChange = useCallback((method: AuthMethod) => {
    dispatch({ type: 'SET_AUTH_METHOD', value: method });
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'SET_ERROR', value: null });
    dispatch({ type: 'SET_SAVING', value: true });

    try {
      // Build config object from form state
      let config = buildIntegrationConfig(state.type, state.authMethod, state.fields);

      // Add host/port if not already in the config (for integrations that need it)
      if (needsHostPort(state.type)) {
        config = {
          host: state.fields.host,
          port: Number(state.fields.port),
          ...config,
        };
      }

      // Add verifySSL for applicable integrations
      if (supportsVerifySSL(state.type) && state.fields.verifySSL !== undefined) {
        config.verifySSL = Boolean(state.fields.verifySSL);
      }

      if (isEditing) {
        await updateIntegration(integration.id, {
          type: state.type as IntegrationType,
          name: state.name,
          config: config as IntegrationConfig,
          enabled: state.enabled,
        });
      } else {
        const newIntegration = await createIntegration({
          type: state.type as IntegrationType,
          name: state.name,
          config: config as IntegrationConfig,
          enabled: state.enabled,
        });
        // Automatically test connection after creating a new integration
        checkConnection(newIntegration.id);
      }

      onSaved();
    } catch (err) {
      dispatch({ type: 'SET_ERROR', value: err instanceof Error ? err.message : String(err) });
    } finally {
      dispatch({ type: 'SET_SAVING', value: false });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Integration' : 'Add Integration'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error display */}
          {state.error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
              {state.error}
            </div>
          )}

          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            {isEditing ? (
              <div className="w-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white rounded-md px-3 py-2">
                {selectedTypeName}
              </div>
            ) : (
              <div className="relative" ref={typeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <span className={`truncate ${!selectedTypeName ? 'text-gray-400' : ''}`}>
                    {selectedTypeName || 'Select an integration...'}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {typeDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                      <div className="relative">
                        <input
                          ref={typeInputRef}
                          type="text"
                          value={typeSearch}
                          onChange={(e) => setTypeSearch(e.target.value)}
                          placeholder="Search integrations..."
                          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md pl-8 pr-3 py-1.5 text-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                        <svg
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                      {filteredTypes.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          No integrations found
                        </div>
                      ) : (
                        filteredTypes.map((t) => (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => handleTypeSelect(t.type)}
                            className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                              t.type === state.type
                                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                              </svg>
                              <span>{t.name}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Name field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => dispatch({ type: 'SET_NAME', value: e.target.value })}
              required
              placeholder={getIntegrationSampleName(state.type)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Host & Port for server-based integrations */}
          {needsHostPort(state.type) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Host
                </label>
                <input
                  type="text"
                  value={String(state.fields.host ?? '')}
                  onChange={(e) => handleFieldChange('host', e.target.value)}
                  required
                  placeholder={getIntegrationSampleHost(state.type)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={typeof state.fields.port === 'number' ? state.fields.port : ''}
                  onChange={(e) => handleFieldChange('port', e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          )}

          {/* Auth method selector (only if multiple methods) */}
          {authConfig && authConfig.methods.length > 1 && (
            <AuthMethodSelector
              methods={authConfig.methods}
              selectedMethod={state.authMethod}
              onMethodChange={handleAuthMethodChange}
            />
          )}

          {/* Auth fields section */}
          {authConfig && (
            <AuthFieldsSection
              authConfig={authConfig}
              selectedMethod={state.authMethod}
              fields={state.fields}
              onFieldChange={handleFieldChange}
              integrationType={state.type}
              onShowRingTokenGenerator={() => dispatch({ type: 'SHOW_RING_TOKEN_GENERATOR', value: true })}
              onShowHomeConnectTokenGenerator={() => dispatch({ type: 'SHOW_HOMECONNECT_TOKEN_GENERATOR', value: true })}
              onShowSonosTokenGenerator={() => dispatch({ type: 'SHOW_SONOS_TOKEN_GENERATOR', value: true })}
              onShowEcobeeTokenGenerator={() => dispatch({ type: 'SHOW_ECOBEE_TOKEN_GENERATOR', value: true })}
            />
          )}

          {/* Verify SSL checkbox */}
          {supportsVerifySSL(state.type) && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="verifySSL"
                checked={Boolean(state.fields.verifySSL)}
                onChange={(e) => handleFieldChange('verifySSL', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="verifySSL" className="text-sm text-gray-700 dark:text-gray-300">
                Verify SSL Certificate
              </label>
            </div>
          )}

          {/* Enabled checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={state.enabled}
              onChange={(e) => dispatch({ type: 'SET_ENABLED', value: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
              Enabled
            </label>
          </div>

          {/* Form buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={state.saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {state.saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>

      {/* Ring Token Generator Modal */}
      {state.showRingTokenGenerator && (
        <RingTokenGenerator
          onTokenGenerated={(token) => {
            handleFieldChange('refreshToken', token);
            dispatch({ type: 'SHOW_RING_TOKEN_GENERATOR', value: false });
          }}
          onClose={() => dispatch({ type: 'SHOW_RING_TOKEN_GENERATOR', value: false })}
        />
      )}

      {/* Home Connect Token Generator Modal */}
      {state.showHomeConnectTokenGenerator && (
        <HomeConnectTokenGenerator
          clientId={String(state.fields.clientId || '')}
          clientSecret={String(state.fields.clientSecret || '')}
          onTokenGenerated={(token) => {
            handleFieldChange('refreshToken', token);
            dispatch({ type: 'SHOW_HOMECONNECT_TOKEN_GENERATOR', value: false });
          }}
          onClose={() => dispatch({ type: 'SHOW_HOMECONNECT_TOKEN_GENERATOR', value: false })}
        />
      )}

      {/* Sonos Token Generator Modal */}
      {state.showSonosTokenGenerator && (
        <SonosTokenGenerator
          clientId={String(state.fields.clientId || '')}
          clientSecret={String(state.fields.clientSecret || '')}
          redirectUri={String(state.fields.redirectUri || '')}
          onTokenGenerated={(token) => {
            handleFieldChange('refreshToken', token);
            dispatch({ type: 'SHOW_SONOS_TOKEN_GENERATOR', value: false });
          }}
          onClose={() => dispatch({ type: 'SHOW_SONOS_TOKEN_GENERATOR', value: false })}
        />
      )}

      {/* Ecobee Token Generator Modal */}
      {state.showEcobeeTokenGenerator && (
        <EcobeeTokenGenerator
          apiKey={String(state.fields.apiKey || '')}
          onTokenGenerated={(token) => {
            handleFieldChange('refreshToken', token);
            dispatch({ type: 'SHOW_ECOBEE_TOKEN_GENERATOR', value: false });
          }}
          onClose={() => dispatch({ type: 'SHOW_ECOBEE_TOKEN_GENERATOR', value: false })}
        />
      )}
    </div>
  );
}
