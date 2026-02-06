import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { useConnectionStore, DeviceConnection } from '../../../stores/connectionStore';
import { useDeviceStore, DeviceType } from '../../../stores/deviceStore';
import { dataApi, widgetApi } from '../../../api/client';
import { Widget } from '../../../types';

interface TopologyLink {
  localDeviceId: string;
  localDeviceName: string;
  localDeviceMac: string;
  localPort: number;
  localPortName: string;
  remoteDeviceId: string;
  remoteDeviceName: string;
  remoteDeviceMac: string;
  remotePort: number;
  remotePortName: string;
  linkType: 'uplink' | 'downlink';
}

interface TopologyData {
  links: TopologyLink[];
}

interface UnifiDevice {
  _id: string;
  mac: string;
  name: string;
  model: string;
  type: string;
  state: number;
  adopted: boolean;
  num_sta?: number;
}

interface DevicesData {
  devices: UnifiDevice[];
}

interface DiscoveredConnection {
  link: TopologyLink;
  localWidgetId: string | null;
  localWidgetTitle: string | null;
  remoteWidgetId: string | null;
  remoteWidgetTitle: string | null;
  canImport: boolean;
  alreadyExists: boolean;
}

interface DiscoveredDevice {
  device: UnifiDevice;
  widgetId: string | null;
  widgetTitle: string | null;
  alreadyInStore: boolean;
  suggestedType: DeviceType;
}

export function AutoDetect() {
  const { integrations, fetchIntegrations } = useIntegrationStore();
  const { deviceConnections, addDeviceConnection } = useConnectionStore();
  const { addDevice, updateDevice, getDeviceByHostname } = useDeviceStore();

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topologyData, setTopologyData] = useState<TopologyData | null>(null);
  const [devicesData, setDevicesData] = useState<DevicesData | null>(null);
  const [switchWidgets, setSwitchWidgets] = useState<Widget[]>([]);

  // Tab state for Connections vs Devices
  const [activeTab, setActiveTab] = useState<'connections' | 'devices'>('connections');

  // Selection states
  const [selectedConnections, setSelectedConnections] = useState<Set<number>>(new Set());
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  // Filter for UniFi integrations
  const unifiIntegrations = useMemo(() =>
    integrations.filter(i => i.type === 'unifi' && i.enabled),
    [integrations]
  );

  // Fetch integrations and widgets on mount
  useEffect(() => {
    fetchIntegrations();

    // Fetch all widgets and filter for switch-port-overlay
    widgetApi.getAll().then(widgets => {
      const switchOverlayWidgets = widgets.filter(w =>
        w.widget_type === 'switch-port-overlay' && w.config.deviceId
      );
      setSwitchWidgets(switchOverlayWidgets);
    }).catch(err => {
      console.error('Failed to fetch widgets:', err);
    });
  }, [fetchIntegrations]);

  // Map of UniFi device ID to widget info
  const deviceToWidgetMap = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    for (const widget of switchWidgets) {
      const deviceId = widget.config.deviceId as string;
      if (deviceId) {
        map.set(deviceId, { id: widget.id, title: widget.title });
      }
    }
    return map;
  }, [switchWidgets]);

  // Discovered connections with widget mapping
  const discoveredConnections = useMemo((): DiscoveredConnection[] => {
    if (!topologyData) return [];

    return topologyData.links.map(link => {
      const localWidget = deviceToWidgetMap.get(link.localDeviceId);
      const remoteWidget = deviceToWidgetMap.get(link.remoteDeviceId);

      // Check if device connection already exists (by device ID, not widget ID)
      const alreadyExists = deviceConnections.some(c =>
        (c.localDeviceId === link.localDeviceId && c.localPort === link.localPort) ||
        (c.remoteDeviceId === link.localDeviceId && c.remotePort === link.localPort)
      );

      return {
        link,
        localWidgetId: localWidget?.id || null,
        localWidgetTitle: localWidget?.title || null,
        remoteWidgetId: remoteWidget?.id || null,
        remoteWidgetTitle: remoteWidget?.title || null,
        // Always allow import - widgets are not required for device connections
        canImport: true,
        alreadyExists,
      };
    });
  }, [topologyData, deviceToWidgetMap, deviceConnections]);

  // Discovered devices with mapping info
  const discoveredDevices = useMemo((): DiscoveredDevice[] => {
    if (!devicesData) return [];

    return devicesData.devices.map(device => {
      const widget = deviceToWidgetMap.get(device._id);
      const alreadyInStore = !!getDeviceByHostname(device.name);

      // Suggest device type based on UniFi device type
      let suggestedType: DeviceType = 'other';
      switch (device.type) {
        case 'uap':
          suggestedType = 'ap';
          break;
        case 'usw':
          suggestedType = 'router'; // switches are closest to router
          break;
        case 'ugw':
        case 'udm':
          suggestedType = 'router';
          break;
        default:
          suggestedType = 'other';
      }

      return {
        device,
        widgetId: widget?.id || null,
        widgetTitle: widget?.title || null,
        alreadyInStore,
        suggestedType,
      };
    });
  }, [devicesData, deviceToWidgetMap, getDeviceByHostname]);

  const handleScan = useCallback(async () => {
    if (!selectedIntegrationId) return;

    setLoading(true);
    setError(null);
    setTopologyData(null);
    setDevicesData(null);
    setSelectedConnections(new Set());
    setSelectedDevices(new Set());

    try {
      // Fetch topology and devices in parallel
      const [topology, devices] = await Promise.all([
        dataApi.getData<TopologyData>(selectedIntegrationId, 'topology'),
        dataApi.getData<DevicesData>(selectedIntegrationId, 'devices'),
      ]);

      setTopologyData(topology);
      setDevicesData(devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data from UniFi');
    } finally {
      setLoading(false);
    }
  }, [selectedIntegrationId]);

  const handleToggleConnection = useCallback((index: number) => {
    setSelectedConnections(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      return newSelected;
    });
  }, []);

  const handleToggleDevice = useCallback((deviceId: string) => {
    setSelectedDevices(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(deviceId)) {
        newSelected.delete(deviceId);
      } else {
        newSelected.add(deviceId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAllConnections = useCallback(() => {
    // All connections with canImport can be selected (including already existing ones for reimport)
    const importable = discoveredConnections
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.canImport);

    if (selectedConnections.size === importable.length) {
      setSelectedConnections(new Set());
    } else {
      setSelectedConnections(new Set(importable.map(({ i }) => i)));
    }
  }, [discoveredConnections, selectedConnections.size]);

  const handleSelectAllDevices = useCallback(() => {
    // All devices can be selected (including already existing ones for reimport)
    if (selectedDevices.size === discoveredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(discoveredDevices.map(d => d.device._id)));
    }
  }, [discoveredDevices, selectedDevices.size]);

  // Helper to check if a UniFi device is a switch
  const isSwitch = useCallback((deviceId: string): boolean => {
    if (!devicesData) return false;
    const device = devicesData.devices.find(d => d._id === deviceId);
    if (!device) return false;
    const type = device.type?.toLowerCase();
    return type === 'usw' || type === 'udm' || type === 'ugw';
  }, [devicesData]);

  // Helper to get device info from devicesData
  const getDeviceInfo = useCallback((deviceId: string): UnifiDevice | undefined => {
    if (!devicesData) return undefined;
    return devicesData.devices.find(d => d._id === deviceId);
  }, [devicesData]);

  // Helper to determine device type from UniFi device
  const getDeviceTypeFromUnifi = useCallback((device: UnifiDevice): DeviceType => {
    switch (device.type?.toLowerCase()) {
      case 'uap':
        return 'ap';
      case 'usw':
      case 'ugw':
      case 'udm':
        return 'router';
      default:
        return 'other';
    }
  }, []);

  const handleImportConnections = useCallback(() => {
    let imported = 0;
    let updated = 0;
    let devicesCreated = 0;

    for (const index of selectedConnections) {
      const discovered = discoveredConnections[index];
      if (discovered.canImport) {
        // Check if we need to create Device entries for non-switch devices
        const localDeviceInfo = getDeviceInfo(discovered.link.localDeviceId);
        const remoteDeviceInfo = getDeviceInfo(discovered.link.remoteDeviceId);

        // Auto-create Device entry for non-switch devices (APs, etc.)
        if (localDeviceInfo && !isSwitch(discovered.link.localDeviceId)) {
          // Check if device already exists in store
          const existingDevice = getDeviceByHostname(localDeviceInfo.name);
          if (!existingDevice) {
            addDevice({
              hostname: localDeviceInfo.name,
              macAddress: localDeviceInfo.mac,
              deviceType: getDeviceTypeFromUnifi(localDeviceInfo),
              description: `${localDeviceInfo.model} - Imported from UniFi`,
            });
            devicesCreated++;
          }
        }

        if (remoteDeviceInfo && !isSwitch(discovered.link.remoteDeviceId)) {
          // Check if device already exists in store
          const existingDevice = getDeviceByHostname(remoteDeviceInfo.name);
          if (!existingDevice) {
            addDevice({
              hostname: remoteDeviceInfo.name,
              macAddress: remoteDeviceInfo.mac,
              deviceType: getDeviceTypeFromUnifi(remoteDeviceInfo),
              description: `${remoteDeviceInfo.model} - Imported from UniFi`,
            });
            devicesCreated++;
          }
        }

        // Store by device ID so it works even without widgets
        // addDeviceConnection does upsert - updates if exists, inserts if not
        const connection: DeviceConnection = {
          localDeviceId: discovered.link.localDeviceId,
          localDeviceName: discovered.link.localDeviceName,
          localPort: discovered.link.localPort,
          remoteDeviceId: discovered.link.remoteDeviceId,
          remoteDeviceName: discovered.link.remoteDeviceName,
          remotePort: discovered.link.remotePort,
          label: `${discovered.link.localPortName} ↔ ${discovered.link.remotePortName}`,
          discoveryMethod: 'unifi',
        };
        addDeviceConnection(connection);

        if (discovered.alreadyExists) {
          updated++;
        } else {
          imported++;
        }
      }
    }

    setSelectedConnections(new Set());

    // Log results
    if (devicesCreated > 0) {
      console.log(`[AutoDetect] Auto-created ${devicesCreated} device(s) from imported connections`);
    }
    if (updated > 0) {
      console.log(`[AutoDetect] Updated ${updated} existing connection(s)`);
    }

    // Re-scan to update alreadyExists status
    if (imported > 0 || updated > 0) {
      handleScan();
    }
  }, [selectedConnections, discoveredConnections, addDeviceConnection, handleScan, isSwitch, getDeviceInfo, getDeviceByHostname, addDevice, getDeviceTypeFromUnifi]);

  const handleImportDevices = useCallback(() => {
    let imported = 0;
    let updated = 0;

    for (const deviceId of selectedDevices) {
      const discovered = discoveredDevices.find(d => d.device._id === deviceId);
      if (discovered) {
        const existingDevice = getDeviceByHostname(discovered.device.name);
        if (existingDevice) {
          // Update existing device
          updateDevice(existingDevice.id, {
            macAddress: discovered.device.mac,
            deviceType: discovered.suggestedType,
            description: `${discovered.device.model} - Imported from UniFi`,
          });
          updated++;
        } else {
          // Add new device
          addDevice({
            hostname: discovered.device.name,
            macAddress: discovered.device.mac,
            deviceType: discovered.suggestedType,
            description: `${discovered.device.model} - Imported from UniFi`,
          });
          imported++;
        }
      }
    }

    setSelectedDevices(new Set());

    // Log results
    if (updated > 0) {
      console.log(`[AutoDetect] Updated ${updated} existing device(s)`);
    }

    // Re-scan to update alreadyInStore status
    if (imported > 0 || updated > 0) {
      handleScan();
    }
  }, [selectedDevices, discoveredDevices, addDevice, updateDevice, getDeviceByHostname, handleScan]);

  const importableConnections = discoveredConnections.filter(c => c.canImport);
  const existingConnectionsCount = discoveredConnections.filter(c => c.alreadyExists).length;
  const existingDevicesCount = discoveredDevices.filter(d => d.alreadyInStore).length;

  return (
    <div className="space-y-6">
      {/* Integration Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          UniFi Auto-Detection
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Automatically discover switch-to-switch connections and network devices from your UniFi controller.
        </p>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select UniFi Integration
            </label>
            <select
              value={selectedIntegrationId}
              onChange={(e) => setSelectedIntegrationId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select an integration...</option>
              {unifiIntegrations.map(integration => (
                <option key={integration.id} value={integration.id}>
                  {integration.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleScan}
            disabled={!selectedIntegrationId || loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Scan Network
              </>
            )}
          </button>
        </div>

        {unifiIntegrations.length === 0 && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
            No UniFi integrations found. Add a UniFi integration in the Integrations tab first.
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {switchWidgets.length > 0 && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Found {switchWidgets.length} Switch Port Overlay widget(s) that can be matched.
          </p>
        )}
      </div>

      {/* Results */}
      {(topologyData || devicesData) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('connections')}
                className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'connections'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Switch Connections ({discoveredConnections.length})
              </button>
              <button
                onClick={() => setActiveTab('devices')}
                className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'devices'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Network Devices ({discoveredDevices.length})
              </button>
            </nav>
          </div>

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div className="p-6">
              {discoveredConnections.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No switch-to-switch connections discovered.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Found {discoveredConnections.length} connection(s){existingConnectionsCount > 0 ? ` (${existingConnectionsCount} already imported)` : ''}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAllConnections}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {selectedConnections.size === importableConnections.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        onClick={handleImportConnections}
                        disabled={selectedConnections.size === 0}
                        className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Import/Update Selected ({selectedConnections.size})
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {discoveredConnections.map((discovered, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          discovered.alreadyExists
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                            : discovered.canImport
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {discovered.canImport && (
                            <input
                              type="checkbox"
                              checked={selectedConnections.has(index)}
                              onChange={() => handleToggleConnection(index)}
                              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className={`font-medium ${discovered.localWidgetId ? 'text-gray-900 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                                {discovered.localWidgetTitle || discovered.link.localDeviceName}
                              </span>
                              <span className="text-gray-400">Port {discovered.link.localPort}</span>
                              <span className="text-gray-400">↔</span>
                              <span className="text-gray-400">Port {discovered.link.remotePort}</span>
                              <span className={`font-medium ${discovered.remoteWidgetId ? 'text-gray-900 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                                {discovered.remoteWidgetTitle || discovered.link.remoteDeviceName}
                              </span>
                              {discovered.alreadyExists && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                                  Imported
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {!discovered.localWidgetId && !discovered.remoteWidgetId && (
                                <span className="text-gray-500 dark:text-gray-400">
                                  Will be available when widgets are created for these devices
                                </span>
                              )}
                              {discovered.localWidgetId && !discovered.remoteWidgetId && (
                                <span className="text-gray-500 dark:text-gray-400">
                                  No widget yet for {discovered.link.remoteDeviceName}
                                </span>
                              )}
                              {!discovered.localWidgetId && discovered.remoteWidgetId && (
                                <span className="text-gray-500 dark:text-gray-400">
                                  No widget yet for {discovered.link.localDeviceName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Devices Tab */}
          {activeTab === 'devices' && (
            <div className="p-6">
              {discoveredDevices.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No network devices discovered.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Found {discoveredDevices.length} device(s){existingDevicesCount > 0 ? ` (${existingDevicesCount} already imported)` : ''}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAllDevices}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {selectedDevices.size === discoveredDevices.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        onClick={handleImportDevices}
                        disabled={selectedDevices.size === 0}
                        className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Import/Update Selected ({selectedDevices.size})
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {discoveredDevices.map((discovered) => (
                      <div
                        key={discovered.device._id}
                        className={`p-4 rounded-lg border ${
                          discovered.alreadyInStore
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedDevices.has(discovered.device._id)}
                            onChange={() => handleToggleDevice(discovered.device._id)}
                            className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {discovered.device.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                {discovered.device.model}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                discovered.device.state === 1
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                              }`}>
                                {discovered.device.state === 1 ? 'Online' : 'Offline'}
                              </span>
                              {discovered.alreadyInStore && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                                  Imported
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex gap-3">
                              <span>MAC: {discovered.device.mac}</span>
                              <span>Type: {discovered.suggestedType}</span>
                              {discovered.widgetTitle && (
                                <span className="text-primary-600 dark:text-primary-400">
                                  Widget: {discovered.widgetTitle}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions when no scan has been done */}
      {!topologyData && !devicesData && !loading && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">How it works</h4>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
            <li>Select a UniFi integration above and click "Scan Network"</li>
            <li>The system will discover switch-to-switch connections from your UniFi controller</li>
            <li>Select the connections you want to import and click "Import Selected"</li>
            <li>Connections are stored by device ID and will automatically appear on Switch Port Overlay widgets when you configure them with the matching device</li>
          </ol>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            <strong>Tip:</strong> You can import connections before creating widgets. When you add a Switch Port Overlay widget and select a device, it will automatically show the imported connections for that device.
          </p>
        </div>
      )}
    </div>
  );
}
