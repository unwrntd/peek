import React, { useState, useMemo, useEffect } from 'react';
import { useConnectionStore, DeviceConnection, PortMapping } from '../../../stores/connectionStore';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { useDeviceStore, DEVICE_TYPE_OPTIONS, getDeviceTypeInfo, DeviceType } from '../../../stores/deviceStore';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { settingsApi } from '../../../api/client';

interface NetworkSwitch {
  id: string;
  name: string;
  model?: string;
  source: 'integration' | 'manual';
  integrationId?: string;
}

export function ConnectionsManager() {
  const deviceConnections = useConnectionStore((state) => state.deviceConnections);
  const addDeviceConnection = useConnectionStore((state) => state.addDeviceConnection);
  const removeDeviceConnection = useConnectionStore((state) => state.removeDeviceConnection);

  // Debug: log device connections from store
  console.log('[ConnectionsManager] deviceConnections from store:', deviceConnections);

  const portMappings = useConnectionStore((state) => state.portMappings);
  const addPortMapping = useConnectionStore((state) => state.addPortMapping);
  const removePortMapping = useConnectionStore((state) => state.removePortMapping);

  const devices = useDeviceStore((state) => state.devices);
  const addDevice = useDeviceStore((state) => state.addDevice);

  const widgets = useDashboardStore((state) => state.widgets);
  const integrations = useIntegrationStore((state) => state.integrations);
  const fetchIntegrations = useIntegrationStore((state) => state.fetchIntegrations);

  // Fetch integrations on mount
  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // All available switches (from integrations + manual)
  const [allSwitches, setAllSwitches] = useState<NetworkSwitch[]>([]);
  const [isLoadingSwitches, setIsLoadingSwitches] = useState(true);

  // Get UniFi integrations
  const unifiIntegrations = useMemo(() => {
    return integrations.filter((i) => i.type === 'unifi' && i.enabled);
  }, [integrations]);

  // Fetch switches from integrations and manual
  useEffect(() => {
    const fetchSwitches = async () => {
      setIsLoadingSwitches(true);
      const switches: NetworkSwitch[] = [];

      // Fetch from integrations
      for (const integration of unifiIntegrations) {
        try {
          const response = await fetch(`/api/data/${integration.id}/switch-ports`);
          const contentType = response.headers.get('content-type');
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[ConnectionsManager] API error for ${integration.name}:`, response.status, errorText.substring(0, 200));
            continue;
          }
          if (!contentType?.includes('application/json')) {
            console.error(`[ConnectionsManager] Unexpected content-type for ${integration.name}:`, contentType);
            continue;
          }
          const data = await response.json();
          if (data.devices && Array.isArray(data.devices)) {
            for (const device of data.devices) {
              // Include devices that are switches - either by port_table or by device type
              const hasPortTable = device.port_table && device.port_table.length > 0;
              const isSwitch = device.type === 'usw' || device.type === 'USW';
              const isUdm = device.type === 'udm' || device.type === 'UDM';

              if (hasPortTable || isSwitch || isUdm) {
                switches.push({
                  id: device._id || device.mac,
                  name: device.name || device.model || 'Unknown Switch',
                  model: device.model,
                  source: 'integration',
                  integrationId: integration.id,
                });
              }
            }
          }
        } catch (err) {
          console.error(`[ConnectionsManager] Failed to fetch switches from ${integration.name}:`, err);
        }
      }

      // Fetch manual switches
      try {
        const manual = await settingsApi.getManualSwitches();
        if (manual && Array.isArray(manual)) {
          for (const sw of manual) {
            switches.push({
              id: sw.id,
              name: sw.name,
              model: sw.model,
              source: 'manual',
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch manual switches:', err);
      }

      setAllSwitches(switches);
      setIsLoadingSwitches(false);
    };

    fetchSwitches();
  }, [unifiIntegrations]);

  const [selectedSwitchId, setSelectedSwitchId] = useState<string>('');

  // Update selected switch when switches load
  useEffect(() => {
    if (allSwitches.length > 0 && !selectedSwitchId) {
      setSelectedSwitchId(allSwitches[0].id);
    }
  }, [allSwitches, selectedSwitchId]);

  // Connection form state
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [connectionForm, setConnectionForm] = useState({
    localPort: 1,
    remoteSwitchId: '',
    remotePort: 1,
    label: '',
  });

  // Mapping form state
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [mappingForm, setMappingForm] = useState({
    port: 1,
    deviceId: '',
    createNewDevice: false,
    hostname: '',
    ipAddress: '',
    deviceType: 'other' as DeviceType,
    description: '',
  });

  const selectedSwitch = allSwitches.find((s) => s.id === selectedSwitchId);

  // Get switch name by ID
  const getSwitchName = (switchId: string) => {
    const sw = allSwitches.find((s) => s.id === switchId);
    return sw?.name || switchId;
  };

  // Set of switch IDs for filtering
  const switchIds = useMemo(() => {
    return new Set(allSwitches.map(s => s.id));
  }, [allSwitches]);

  // Get all connections for the selected switch (both directions)
  // Only show switch-to-switch connections (both endpoints must be switches)
  const switchConnections = useMemo(() => {
    if (!selectedSwitchId) return [];

    const result: Array<{
      connection: DeviceConnection;
      isReverse: boolean;
      localPort: number;
      remoteSwitchId: string;
      remoteSwitchName: string;
      remotePort: number;
      label?: string;
    }> = [];

    for (const conn of deviceConnections) {
      // Only include if BOTH devices are switches
      const localIsSwitch = switchIds.has(conn.localDeviceId);
      const remoteIsSwitch = switchIds.has(conn.remoteDeviceId);

      if (!localIsSwitch || !remoteIsSwitch) {
        continue; // Skip non-switch-to-switch connections
      }

      if (conn.localDeviceId === selectedSwitchId) {
        result.push({
          connection: conn,
          isReverse: false,
          localPort: conn.localPort,
          remoteSwitchId: conn.remoteDeviceId,
          remoteSwitchName: conn.remoteDeviceName,
          remotePort: conn.remotePort,
          label: conn.label,
        });
      } else if (conn.remoteDeviceId === selectedSwitchId) {
        result.push({
          connection: conn,
          isReverse: true,
          localPort: conn.remotePort,
          remoteSwitchId: conn.localDeviceId,
          remoteSwitchName: conn.localDeviceName,
          remotePort: conn.localPort,
          label: conn.label,
        });
      }
    }

    return result.sort((a, b) => a.localPort - b.localPort);
  }, [selectedSwitchId, deviceConnections]);

  // Get mappings for the selected switch (by finding widgets with this deviceId)
  const switchMappings = useMemo(() => {
    if (!selectedSwitchId) return [];

    // Find widgets that use this switch
    const switchWidgets = widgets.filter(
      (w) =>
        (w.widget_type === 'switch-port-overlay' || w.widget_type === 'cross-switch-port-overlay') &&
        w.config?.deviceId === selectedSwitchId
    );

    if (switchWidgets.length === 0) return [];

    // Get mappings for these widgets
    const mappings: PortMapping[] = [];
    for (const widget of switchWidgets) {
      const widgetMappings = portMappings.filter((m) => m.widgetId === widget.id);
      mappings.push(...widgetMappings);
    }

    return mappings.sort((a, b) => a.port - b.port);
  }, [selectedSwitchId, widgets, portMappings]);

  // Get device uplinks - connections where one end is this switch and the other is NOT a switch
  // These are typically APs, servers, etc. connected to this switch
  const deviceUplinks = useMemo(() => {
    if (!selectedSwitchId) return [];

    const result: Array<{
      connection: DeviceConnection;
      switchPort: number;
      deviceId: string;
      deviceName: string;
      devicePort: number;
      label?: string;
    }> = [];

    for (const conn of deviceConnections) {
      const localIsSwitch = switchIds.has(conn.localDeviceId);
      const remoteIsSwitch = switchIds.has(conn.remoteDeviceId);

      // Only include if one end is this switch and the other is NOT a switch
      if (conn.localDeviceId === selectedSwitchId && !remoteIsSwitch) {
        // This switch is local, device is remote
        result.push({
          connection: conn,
          switchPort: conn.localPort,
          deviceId: conn.remoteDeviceId,
          deviceName: conn.remoteDeviceName,
          devicePort: conn.remotePort,
          label: conn.label,
        });
      } else if (conn.remoteDeviceId === selectedSwitchId && !localIsSwitch) {
        // This switch is remote, device is local
        result.push({
          connection: conn,
          switchPort: conn.remotePort,
          deviceId: conn.localDeviceId,
          deviceName: conn.localDeviceName,
          devicePort: conn.localPort,
          label: conn.label,
        });
      }
    }

    return result.sort((a, b) => a.switchPort - b.switchPort);
  }, [selectedSwitchId, deviceConnections, switchIds]);

  // Handlers for connections
  const handleAddConnection = () => {
    if (!selectedSwitchId || !connectionForm.remoteSwitchId) return;

    const localSwitch = allSwitches.find((s) => s.id === selectedSwitchId);
    const remoteSwitch = allSwitches.find((s) => s.id === connectionForm.remoteSwitchId);

    addDeviceConnection({
      localDeviceId: selectedSwitchId,
      localDeviceName: localSwitch?.name || selectedSwitchId,
      localPort: connectionForm.localPort,
      remoteDeviceId: connectionForm.remoteSwitchId,
      remoteDeviceName: remoteSwitch?.name || connectionForm.remoteSwitchId,
      remotePort: connectionForm.remotePort,
      label: connectionForm.label || undefined,
      discoveryMethod: 'manual',
    });

    setConnectionForm({ localPort: 1, remoteSwitchId: '', remotePort: 1, label: '' });
    setIsAddingConnection(false);
  };

  const handleDeleteConnection = (conn: DeviceConnection) => {
    removeDeviceConnection(conn.localDeviceId, conn.localPort);
  };

  // Handlers for mappings (need a widget to map to)
  const handleAddMapping = () => {
    if (!selectedSwitchId) return;

    // Find a widget for this switch
    const switchWidget = widgets.find(
      (w) =>
        (w.widget_type === 'switch-port-overlay' || w.widget_type === 'cross-switch-port-overlay') &&
        w.config?.deviceId === selectedSwitchId
    );

    if (!switchWidget) {
      alert('No Switch Port Overlay widget found for this switch. Create a widget first to add device mappings.');
      return;
    }

    let hostname = '';
    let ipAddress: string | undefined;
    let deviceType: DeviceType = 'other';
    let description: string | undefined;

    if (mappingForm.createNewDevice) {
      if (!mappingForm.hostname.trim()) return;

      addDevice({
        hostname: mappingForm.hostname.trim(),
        ipAddress: mappingForm.ipAddress.trim() || undefined,
        deviceType: mappingForm.deviceType,
        description: mappingForm.description.trim() || undefined,
      });

      hostname = mappingForm.hostname.trim();
      ipAddress = mappingForm.ipAddress.trim() || undefined;
      deviceType = mappingForm.deviceType;
      description = mappingForm.description.trim() || undefined;
    } else {
      const device = devices.find((d) => d.id === mappingForm.deviceId);
      if (!device) return;

      hostname = device.hostname;
      ipAddress = device.ipAddress;
      deviceType = device.deviceType;
      description = device.description;
    }

    addPortMapping({
      widgetId: switchWidget.id,
      port: mappingForm.port,
      hostname,
      ipAddress,
      deviceType,
      description,
    });

    setMappingForm({
      port: 1,
      deviceId: '',
      createNewDevice: false,
      hostname: '',
      ipAddress: '',
      deviceType: 'other',
      description: '',
    });
    setIsAddingMapping(false);
  };

  const handleDeleteMapping = (mapping: PortMapping) => {
    removePortMapping(mapping.widgetId, mapping.port);
  };

  // Other switches for the connection dropdown
  const otherSwitches = allSwitches.filter((s) => s.id !== selectedSwitchId);

  if (isLoadingSwitches) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-6 w-6 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-gray-500 dark:text-gray-400">Loading switches...</span>
      </div>
    );
  }

  if (allSwitches.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">No switches found.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Go to the Switches tab to add switches from integrations or manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Switch Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Select Switch:
        </label>
        <select
          value={selectedSwitchId}
          onChange={(e) => setSelectedSwitchId(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {allSwitches.map((sw) => (
            <option key={sw.id} value={sw.id}>
              {sw.name} {sw.model ? `(${sw.model})` : ''} {sw.source === 'manual' ? '[Manual]' : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedSwitchId && (
        <>
          {/* Port Connections (Switch-to-Switch) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Port Connections (Switch-to-Switch)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Bidirectional connections - shown on both switches
                </p>
              </div>
              {!isAddingConnection && (
                <button
                  onClick={() => setIsAddingConnection(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Connection
                </button>
              )}
            </div>

            {switchConnections.length === 0 && !isAddingConnection ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                No switch connections configured.
              </p>
            ) : (
              <div className="space-y-2">
                {switchConnections.map(({ connection, localPort, remoteSwitchId, remoteSwitchName, remotePort, label }) => (
                  <div
                    key={`${connection.localDeviceId}-${connection.localPort}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">
                        Port {localPort}
                      </span>
                      <span className="text-cyan-500" title="Bidirectional connection">↔</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {remoteSwitchName || getSwitchName(remoteSwitchId)} Port {remotePort}
                      </span>
                      {label && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                          ({label})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteConnection(connection)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete connection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Connection Form */}
            {isAddingConnection && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Local Port
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={connectionForm.localPort}
                      onChange={(e) =>
                        setConnectionForm({ ...connectionForm, localPort: parseInt(e.target.value) || 1 })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Remote Switch
                    </label>
                    <select
                      value={connectionForm.remoteSwitchId}
                      onChange={(e) =>
                        setConnectionForm({ ...connectionForm, remoteSwitchId: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select a switch...</option>
                      {otherSwitches.map((sw) => (
                        <option key={sw.id} value={sw.id}>
                          {sw.name} {sw.model ? `(${sw.model})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Remote Port
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={connectionForm.remotePort}
                      onChange={(e) =>
                        setConnectionForm({ ...connectionForm, remotePort: parseInt(e.target.value) || 1 })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Label (optional)
                    </label>
                    <input
                      type="text"
                      value={connectionForm.label}
                      onChange={(e) => setConnectionForm({ ...connectionForm, label: e.target.value })}
                      placeholder="e.g., Uplink to Core"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsAddingConnection(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddConnection}
                    disabled={!connectionForm.remoteSwitchId}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Connection
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Device Uplinks (from Auto-Detect) */}
          {deviceUplinks.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Device Uplinks (Auto-Detected)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Devices connected to this switch (discovered from UniFi)
                </p>
              </div>

              <div className="space-y-2">
                {deviceUplinks.map(({ connection, switchPort, deviceName, devicePort, label }) => (
                  <div
                    key={`${connection.localDeviceId}-${connection.localPort}`}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">
                        Port {switchPort}
                      </span>
                      <span className="text-green-500">→</span>
                      <span className="text-lg" title="Device">📡</span>
                      <span className="text-gray-600 dark:text-gray-300 font-medium">
                        {deviceName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Port {devicePort}
                      </span>
                      {label && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                          ({label})
                        </span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                        UniFi
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteConnection(connection)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete uplink"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device Mappings (Manual) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Device Mappings (Manual)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Map ports to network devices (requires a Switch Port Overlay widget for this switch)
                </p>
              </div>
              {!isAddingMapping && (
                <button
                  onClick={() => setIsAddingMapping(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Map Device
                </button>
              )}
            </div>

            {switchMappings.length === 0 && !isAddingMapping ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                No manual device mappings configured. Create devices in the Devices tab, then map them here.
              </p>
            ) : (
              <div className="space-y-2">
                {switchMappings.map((mapping) => {
                  const typeInfo = getDeviceTypeInfo(mapping.deviceType || 'other');
                  return (
                    <div
                      key={`${mapping.widgetId}-${mapping.port}`}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">
                          Port {mapping.port}
                        </span>
                        <span className="text-purple-500">→</span>
                        <span className="text-lg" title={typeInfo.label}>{typeInfo.icon}</span>
                        <span className="text-gray-600 dark:text-gray-300 font-medium">
                          {mapping.hostname}
                        </span>
                        {mapping.ipAddress && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {mapping.ipAddress}
                          </span>
                        )}
                        {mapping.description && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                            ({mapping.description})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteMapping(mapping)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete mapping"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Mapping Form */}
            {isAddingMapping && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={mappingForm.port}
                      onChange={(e) =>
                        setMappingForm({ ...mappingForm, port: parseInt(e.target.value) || 1 })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Device
                    </label>
                    {!mappingForm.createNewDevice ? (
                      <select
                        value={mappingForm.deviceId}
                        onChange={(e) =>
                          setMappingForm({ ...mappingForm, deviceId: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select a device...</option>
                        {devices.map((d) => {
                          const typeInfo = getDeviceTypeInfo(d.deviceType);
                          return (
                            <option key={d.id} value={d.id}>
                              {typeInfo.icon} {d.hostname} {d.ipAddress ? `(${d.ipAddress})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={mappingForm.hostname}
                        onChange={(e) => setMappingForm({ ...mappingForm, hostname: e.target.value })}
                        placeholder="Hostname"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                      />
                    )}
                  </div>
                </div>

                {/* Toggle for new device creation */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMappingForm({ ...mappingForm, createNewDevice: !mappingForm.createNewDevice })
                    }
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {mappingForm.createNewDevice
                      ? '← Select existing device'
                      : '+ Create new device instead'}
                  </button>
                </div>

                {/* Additional fields for new device */}
                {mappingForm.createNewDevice && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        IP Address
                      </label>
                      <input
                        type="text"
                        value={mappingForm.ipAddress}
                        onChange={(e) => setMappingForm({ ...mappingForm, ipAddress: e.target.value })}
                        placeholder="192.168.1.10"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Device Type
                      </label>
                      <select
                        value={mappingForm.deviceType}
                        onChange={(e) =>
                          setMappingForm({ ...mappingForm, deviceType: e.target.value as DeviceType })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {DEVICE_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.icon} {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={mappingForm.description}
                        onChange={(e) => setMappingForm({ ...mappingForm, description: e.target.value })}
                        placeholder="Optional description"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setMappingForm({
                        port: 1,
                        deviceId: '',
                        createNewDevice: false,
                        hostname: '',
                        ipAddress: '',
                        deviceType: 'other',
                        description: '',
                      });
                      setIsAddingMapping(false);
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMapping}
                    disabled={
                      mappingForm.createNewDevice
                        ? !mappingForm.hostname.trim()
                        : !mappingForm.deviceId
                    }
                    className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Map Device
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
