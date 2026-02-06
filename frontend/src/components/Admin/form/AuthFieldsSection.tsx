import React from 'react';
import { AuthConfig, AuthMethod } from '../../../config/integrations/types';
import { DynamicField } from './DynamicField';
import { getCustomFieldRenderer } from './customFieldRenderers';

interface AuthFieldsSectionProps {
  authConfig: AuthConfig;
  selectedMethod: AuthMethod;
  fields: Record<string, string | number | boolean>;
  onFieldChange: (key: string, value: string | number | boolean) => void;
  integrationType: string;
  disabled?: boolean;
  /** For token generators that need client ID/secret */
  onShowRingTokenGenerator?: () => void;
  onShowHomeConnectTokenGenerator?: () => void;
  onShowSonosTokenGenerator?: () => void;
  onShowEcobeeTokenGenerator?: () => void;
}

/**
 * Renders the authentication fields section for an integration
 * Shows common fields (host, port) and method-specific fields
 */
export function AuthFieldsSection({
  authConfig,
  selectedMethod,
  fields,
  onFieldChange,
  integrationType,
  disabled = false,
  onShowRingTokenGenerator,
  onShowHomeConnectTokenGenerator,
  onShowSonosTokenGenerator,
  onShowEcobeeTokenGenerator,
}: AuthFieldsSectionProps) {
  const methodConfig = authConfig.methods.find((m) => m.method === selectedMethod);

  // Check if we have a 2-column grid situation (host/port, username/password)
  const hasCommonFields = authConfig.commonFields.length > 0;
  const methodFields = methodConfig?.fields || [];

  // Determine if we should use a grid layout
  const useGrid = hasCommonFields || methodFields.some((f) => f.colSpan !== 2);

  return (
    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      {/* Common fields (host, port, site, etc.) */}
      {hasCommonFields && (
        <div className="grid grid-cols-2 gap-4">
          {authConfig.commonFields.map((field) => (
            <DynamicField
              key={field.key}
              fieldKey={field.key}
              label={field.label}
              type={field.type}
              value={fields[field.key] ?? field.defaultValue ?? ''}
              onChange={onFieldChange}
              required={field.required}
              placeholder={field.placeholder}
              helpText={field.helpText}
              colSpan={field.colSpan}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Method-specific fields */}
      {methodFields.length > 0 && (
        <div className={useGrid ? 'grid grid-cols-2 gap-4' : 'space-y-3'}>
          {methodFields.map((field) => {
            // Check for custom renderer
            const CustomRenderer = getCustomFieldRenderer(integrationType, field.key);

            if (CustomRenderer) {
              return (
                <CustomRenderer
                  key={field.key}
                  fieldKey={field.key}
                  value={fields[field.key] ?? ''}
                  onChange={onFieldChange}
                  disabled={disabled}
                  integrationType={integrationType}
                  formFields={fields}
                  clientId={String(fields.clientId ?? '')}
                  clientSecret={String(fields.clientSecret ?? '')}
                  apiKey={String(fields.apiKey ?? '')}
                  onShowGenerator={
                    integrationType === 'ring'
                      ? onShowRingTokenGenerator
                      : integrationType === 'homeconnect'
                      ? onShowHomeConnectTokenGenerator
                      : integrationType === 'sonos'
                      ? onShowSonosTokenGenerator
                      : integrationType === 'ecobee'
                      ? onShowEcobeeTokenGenerator
                      : undefined
                  }
                />
              );
            }

            return (
              <DynamicField
                key={field.key}
                fieldKey={field.key}
                label={field.label}
                type={field.type}
                value={fields[field.key] ?? field.defaultValue ?? ''}
                onChange={onFieldChange}
                required={field.required}
                placeholder={field.placeholder}
                helpText={field.helpText}
                colSpan={field.colSpan}
                disabled={disabled}
              />
            );
          })}
        </div>
      )}

      {/* Help text at bottom of section */}
      {authConfig.helpText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{authConfig.helpText}</p>
      )}
    </div>
  );
}
