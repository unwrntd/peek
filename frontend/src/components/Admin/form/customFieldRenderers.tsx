import React, { useState, useCallback, useEffect } from 'react';
import { CustomFieldRendererProps } from './types';

// Types for TP-Link discovery API response
interface DiscoveredTPLinkDevice {
  ip: string;
  mac: string;
  hostname: string | null;
  name: string | null;
  type: 'kasa' | 'tapo' | 'tapo-hub' | 'unknown';
  model: string | null;
  connectionType: 'wired' | 'wireless';
}

interface DiscoverTPLinkResponse {
  hasUnifi: boolean;
  kasaDevices: DiscoveredTPLinkDevice[];
  tapoDevices: DiscoveredTPLinkDevice[];
  tapoHubs: DiscoveredTPLinkDevice[];
  unknownDevices: DiscoveredTPLinkDevice[];
  totalFound: number;
}

/**
 * Ring refresh token field with "Generate Token" button
 */
export function RingTokenField({
  fieldKey,
  value,
  onChange,
  disabled,
  onShowGenerator,
}: CustomFieldRendererProps) {
  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Refresh Token
        <span className="text-red-500 ml-1">*</span>
      </label>
      <div className="flex gap-2">
        <input
          type="password"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          required
          placeholder="Your Ring refresh token"
          disabled={disabled}
          className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          type="button"
          onClick={onShowGenerator}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
        >
          Generate Token
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Click "Generate Token" to authenticate with your Ring account and generate a refresh token.
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Alternatively, run: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">npx -p ring-client-api ring-auth-cli</code>
      </p>
    </div>
  );
}

/**
 * Home Connect refresh token field with "Generate Token" button
 */
export function HomeConnectTokenField({
  fieldKey,
  value,
  onChange,
  disabled,
  clientId,
  clientSecret,
  onShowGenerator,
}: CustomFieldRendererProps) {
  const canGenerate = !!(clientId && clientSecret);

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Refresh Token
        <span className="text-red-500 ml-1">*</span>
      </label>
      <div className="flex gap-2">
        <input
          type="password"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          required
          placeholder="Generated via Device Flow"
          disabled={disabled}
          className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          type="button"
          onClick={onShowGenerator}
          disabled={!canGenerate}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
        >
          Generate Token
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Click "Generate Token" to authorize with your Home Connect account.
      </p>
    </div>
  );
}

/**
 * Sonos refresh token field with "Generate Token" button
 */
export function SonosTokenField({
  fieldKey,
  value,
  onChange,
  disabled,
  clientId,
  clientSecret,
  onShowGenerator,
}: CustomFieldRendererProps) {
  const canGenerate = !!(clientId && clientSecret);

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Refresh Token
        <span className="text-red-500 ml-1">*</span>
      </label>
      <div className="flex gap-2">
        <input
          type="password"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          required
          placeholder="Generated via OAuth"
          disabled={disabled}
          className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          type="button"
          onClick={onShowGenerator}
          disabled={!canGenerate}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
        >
          Generate Token
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Click "Generate Token" to authorize with your Sonos account.
      </p>
    </div>
  );
}

/**
 * TP-Link Device IPs field with "Discover from UniFi" button
 * Works for both Kasa and Tapo integrations
 */
export function TPLinkDeviceIpsField({
  fieldKey,
  value,
  onChange,
  disabled,
  integrationType,
}: CustomFieldRendererProps) {
  const [hasUnifi, setHasUnifi] = useState<boolean | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoverTPLinkResponse | null>(null);
  const [showDiscoveryPanel, setShowDiscoveryPanel] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isKasa = integrationType === 'kasa';
  const isTapo = integrationType === 'tapo';

  // Check if UniFi integration is configured on mount
  useEffect(() => {
    let cancelled = false;
    async function checkUnifi() {
      try {
        const response = await fetch('/api/cross-integration/discover-tplink');
        if (!response.ok) {
          setHasUnifi(false);
          return;
        }
        const data: DiscoverTPLinkResponse = await response.json();
        if (!cancelled) {
          setHasUnifi(data.hasUnifi);
        }
      } catch {
        if (!cancelled) {
          setHasUnifi(false);
        }
      }
    }
    checkUnifi();
    return () => { cancelled = true; };
  }, []);

  const handleDiscover = useCallback(async () => {
    setIsDiscovering(true);
    setError(null);
    setDiscoveryResult(null);

    try {
      const response = await fetch('/api/cross-integration/discover-tplink');
      if (!response.ok) {
        throw new Error('Failed to fetch TP-Link devices');
      }
      const data: DiscoverTPLinkResponse = await response.json();
      setDiscoveryResult(data);
      setShowDiscoveryPanel(true);

      // Pre-select devices that match the integration type, plus unknowns
      const preSelected = new Set<string>();
      if (isKasa) {
        data.kasaDevices.forEach(d => preSelected.add(d.ip));
        data.unknownDevices.forEach(d => preSelected.add(d.ip));
      } else if (isTapo) {
        data.tapoDevices.forEach(d => preSelected.add(d.ip));
        data.unknownDevices.forEach(d => preSelected.add(d.ip));
      }
      setSelectedDevices(preSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  }, [isKasa, isTapo]);

  const toggleDevice = (ip: string) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ip)) {
        newSet.delete(ip);
      } else {
        newSet.add(ip);
      }
      return newSet;
    });
  };

  const applySelection = () => {
    const ips = Array.from(selectedDevices).join(', ');
    onChange(fieldKey, ips);
    setShowDiscoveryPanel(false);
  };

  // Show all TP-Link devices and let users select - categorization may not be accurate
  const getAllDevices = (): DiscoveredTPLinkDevice[] => {
    if (!discoveryResult) return [];
    return [
      ...discoveryResult.kasaDevices,
      ...discoveryResult.tapoDevices,
      ...discoveryResult.unknownDevices,
    ];
  };

  const relevantDevices = getAllDevices();

  const helpText = isKasa
    ? 'Comma-separated IP addresses. Leave empty to auto-discover devices on your network.'
    : 'IP addresses for plugs and bulbs (comma-separated). Enables live on/off status and energy monitoring.';

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Device IPs (Optional)
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          placeholder="192.168.1.100, 192.168.1.101"
          disabled={disabled}
          className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {hasUnifi && (
          <button
            type="button"
            onClick={handleDiscover}
            disabled={disabled || isDiscovering}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-2"
          >
            {isDiscovering ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Discovering...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Discover from UniFi
              </>
            )}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helpText}</p>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {showDiscoveryPanel && discoveryResult && (
        <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Discovered TP-Link Devices
            </h4>
            <button
              type="button"
              onClick={() => setShowDiscoveryPanel(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {relevantDevices.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No TP-Link devices found on your network. Devices must have a TP-Link MAC address prefix to be detected.
            </p>
          ) : (
            <>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {relevantDevices.map((device) => (
                  <label
                    key={device.ip}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDevices.has(device.ip)}
                      onChange={() => toggleDevice(device.ip)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {device.ip}
                        </span>
                        {device.model && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                            {device.model}
                          </span>
                        )}
                        {device.type === 'kasa' && !device.model && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                            Kasa
                          </span>
                        )}
                        {device.type === 'tapo' && !device.model && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                            Tapo
                          </span>
                        )}
                        {device.type === 'unknown' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
                            TP-Link
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {device.name || device.hostname || device.mac} • {device.connectionType}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => setShowDiscoveryPanel(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applySelection}
                  disabled={selectedDevices.size === 0}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                >
                  Apply ({selectedDevices.size} selected)
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TP-Link Hub IPs field with "Discover from UniFi" button
 * Specifically for Tapo Hubs (H100/H200)
 */
export function TPLinkHubIpsField({
  fieldKey,
  value,
  onChange,
  disabled,
}: CustomFieldRendererProps) {
  const [hasUnifi, setHasUnifi] = useState<boolean | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoverTPLinkResponse | null>(null);
  const [showDiscoveryPanel, setShowDiscoveryPanel] = useState(false);
  const [selectedHubs, setSelectedHubs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Check if UniFi integration is configured on mount
  useEffect(() => {
    let cancelled = false;
    async function checkUnifi() {
      try {
        const response = await fetch('/api/cross-integration/discover-tplink');
        if (!response.ok) {
          setHasUnifi(false);
          return;
        }
        const data: DiscoverTPLinkResponse = await response.json();
        if (!cancelled) {
          setHasUnifi(data.hasUnifi);
        }
      } catch {
        if (!cancelled) {
          setHasUnifi(false);
        }
      }
    }
    checkUnifi();
    return () => { cancelled = true; };
  }, []);

  const handleDiscover = useCallback(async () => {
    setIsDiscovering(true);
    setError(null);
    setDiscoveryResult(null);

    try {
      const response = await fetch('/api/cross-integration/discover-tplink');
      if (!response.ok) {
        throw new Error('Failed to fetch TP-Link devices');
      }
      const data: DiscoverTPLinkResponse = await response.json();
      setDiscoveryResult(data);
      setShowDiscoveryPanel(true);

      // Pre-select all discovered hubs
      const preSelected = new Set<string>();
      data.tapoHubs.forEach(d => preSelected.add(d.ip));
      setSelectedHubs(preSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  const toggleHub = (ip: string) => {
    setSelectedHubs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ip)) {
        newSet.delete(ip);
      } else {
        newSet.add(ip);
      }
      return newSet;
    });
  };

  const applySelection = () => {
    const ips = Array.from(selectedHubs).join(', ');
    onChange(fieldKey, ips);
    setShowDiscoveryPanel(false);
  };

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Hub IPs (Optional)
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          placeholder="192.168.1.50"
          disabled={disabled}
          className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {hasUnifi && (
          <button
            type="button"
            onClick={handleDiscover}
            disabled={disabled || isDiscovering}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-2"
          >
            {isDiscovering ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Discovering...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Discover from UniFi
              </>
            )}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        IP addresses for Tapo Hubs H100/H200 (comma-separated). Required to fetch temperature sensor data.
      </p>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {showDiscoveryPanel && discoveryResult && (
        <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Discovered Tapo Hubs
            </h4>
            <button
              type="button"
              onClick={() => setShowDiscoveryPanel(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {discoveryResult.tapoHubs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No Tapo Hubs (H100/H200) found on your network.
            </p>
          ) : (
            <>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {discoveryResult.tapoHubs.map((device) => (
                  <label
                    key={device.ip}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedHubs.has(device.ip)}
                      onChange={() => toggleHub(device.ip)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {device.ip}
                        </span>
                        {device.model && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                            {device.model}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {device.name || device.hostname || device.mac} • {device.connectionType}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => setShowDiscoveryPanel(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applySelection}
                  disabled={selectedHubs.size === 0}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                >
                  Apply ({selectedHubs.size} selected)
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Ecobee refresh token field with "Generate Token" button (PIN-based auth)
 */
export function EcobeeTokenField({
  fieldKey,
  value,
  onChange,
  disabled,
  apiKey,
  onShowGenerator,
}: CustomFieldRendererProps) {
  const canGenerate = !!apiKey;

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Refresh Token
        <span className="text-red-500 ml-1">*</span>
      </label>
      <div className="flex gap-2">
        <input
          type="password"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          required
          placeholder="Generated via PIN authorization"
          disabled={disabled}
          className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          type="button"
          onClick={onShowGenerator}
          disabled={!canGenerate}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
        >
          Generate Token
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Click "Generate Token" to get a PIN code that you'll enter in the Ecobee portal.
      </p>
    </div>
  );
}

/**
 * Type for the custom field registry
 */
type FieldRendererRegistry = Record<string, Record<string, React.FC<CustomFieldRendererProps>>>;

/**
 * Registry of custom field renderers by integration type and field key
 */
export const customFieldRegistry: FieldRendererRegistry = {
  ring: {
    refreshToken: RingTokenField,
  },
  homeconnect: {
    refreshToken: HomeConnectTokenField,
  },
  sonos: {
    refreshToken: SonosTokenField,
  },
  ecobee: {
    refreshToken: EcobeeTokenField,
  },
  kasa: {
    deviceIps: TPLinkDeviceIpsField,
  },
  tapo: {
    deviceIps: TPLinkDeviceIpsField,
    hubIps: TPLinkHubIpsField,
  },
};

/**
 * Get a custom field renderer if one exists
 */
export function getCustomFieldRenderer(
  integrationType: string,
  fieldKey: string
): React.FC<CustomFieldRendererProps> | null {
  return customFieldRegistry[integrationType]?.[fieldKey] || null;
}

/**
 * Check if a field has a custom renderer
 */
export function hasCustomRenderer(
  integrationType: string,
  fieldKey: string
): boolean {
  return !!customFieldRegistry[integrationType]?.[fieldKey];
}
