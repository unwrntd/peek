import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingsApi, NetworkConnectionData, PortMappingData, NicMappingData, DeviceConnectionData } from '../api/client';

export interface PortConnection {
  localWidgetId: string;
  localPort: number;
  remoteWidgetId: string;
  remotePort: number;
  label?: string;
  discoveryMethod?: 'manual' | 'unifi' | 'lldp' | 'cdp';
}

// Device-based connections (stored by device ID, not widget ID)
// These can be imported without widgets existing
export interface DeviceConnection {
  localDeviceId: string;       // UniFi device ID
  localDeviceName: string;     // Device name for display
  localPort: number;
  remoteDeviceId: string;      // UniFi device ID
  remoteDeviceName: string;    // Device name for display
  remotePort: number;
  label?: string;
  discoveryMethod?: 'manual' | 'unifi' | 'lldp' | 'cdp';
}

export interface PortMapping {
  widgetId: string;
  port: number;
  hostname: string;
  description?: string;
  deviceType?: 'server' | 'ap' | 'camera' | 'printer' | 'workstation' | 'iot' | 'phone' | 'nas' | 'router' | 'other';
  ipAddress?: string;
}

// NIC-to-Switch mapping for Device Overlay widgets
export interface NicMapping {
  deviceWidgetId: string;    // Device Overlay widget ID
  nicId: string;             // NIC identifier from template (e.g., 'eth0', 'nic1')
  switchWidgetId: string;    // Switch Port Overlay widget ID
  switchPort: number;        // Port number on switch
  label?: string;            // Optional connection label
  vlan?: string;             // VLAN tag if applicable
  linkSpeed?: number;        // Negotiated speed in Mbps
  bondGroup?: string;        // For LACP/bonding groups
}

interface ConnectionState {
  // All connections (stored by local widget ID)
  connections: PortConnection[];

  // Device-based connections (stored by device ID, can exist without widgets)
  deviceConnections: DeviceConnection[];

  // Port-to-hostname mappings
  portMappings: PortMapping[];

  // NIC Mapping state (Device Overlay)
  nicMappings: NicMapping[];

  // Internal state
  _isLoaded: boolean;
  _isSyncing: boolean;

  // Server sync
  loadFromServer: () => Promise<void>;
  _syncConnectionsToServer: () => Promise<void>;
  _syncDeviceConnectionsToServer: () => Promise<void>;
  _syncPortMappingsToServer: () => Promise<void>;
  _syncNicMappingsToServer: () => Promise<void>;

  // Connection Actions
  addConnection: (connection: Omit<PortConnection, 'discoveryMethod'> & { discoveryMethod?: PortConnection['discoveryMethod'] }) => void;
  removeConnection: (localWidgetId: string, localPort: number) => void;
  updateConnection: (localWidgetId: string, localPort: number, updates: Partial<PortConnection>) => void;
  clearWidgetConnections: (widgetId: string) => void;
  importConnections: (connections: PortConnection[], replace?: boolean) => void;

  // Device Connection Actions
  addDeviceConnection: (connection: Omit<DeviceConnection, 'discoveryMethod'> & { discoveryMethod?: DeviceConnection['discoveryMethod'] }) => void;
  removeDeviceConnection: (localDeviceId: string, localPort: number) => void;
  clearDeviceConnections: (deviceId: string) => void;

  // Device Connection Queries
  getDeviceConnectionsForDevice: (deviceId: string) => DeviceConnection[];
  getDeviceConnectionForPort: (deviceId: string, port: number) => DeviceConnection | null;
  getRemoteDeviceConnection: (deviceId: string, port: number) => { deviceId: string; deviceName: string; port: number; label?: string } | null;

  // Connection Queries
  getConnectionsForWidget: (widgetId: string) => PortConnection[];
  getConnectionForPort: (widgetId: string, port: number) => PortConnection | null;
  getRemoteConnection: (widgetId: string, port: number) => { widgetId: string; port: number; label?: string } | null;

  // Port Mapping Actions
  addPortMapping: (mapping: PortMapping) => void;
  removePortMapping: (widgetId: string, port: number) => void;
  updatePortMapping: (widgetId: string, port: number, updates: Partial<PortMapping>) => void;
  clearWidgetMappings: (widgetId: string) => void;

  // Port Mapping Queries
  getMappingsForWidget: (widgetId: string) => PortMapping[];
  getPortMapping: (widgetId: string, port: number) => PortMapping | null;

  // NIC Mapping Actions
  addNicMapping: (mapping: NicMapping) => void;
  removeNicMapping: (deviceWidgetId: string, nicId: string) => void;
  updateNicMapping: (deviceWidgetId: string, nicId: string, updates: Partial<NicMapping>) => void;
  clearDeviceNicMappings: (deviceWidgetId: string) => void;

  // NIC Mapping Queries
  getNicMappingsForDevice: (deviceWidgetId: string) => NicMapping[];
  getNicMapping: (deviceWidgetId: string, nicId: string) => NicMapping | null;
  getNicMappingsForSwitch: (switchWidgetId: string, switchPort?: number) => NicMapping[];
}

// Debounce timers for sync
let connectionsSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let deviceConnectionsSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let portMappingsSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let nicMappingsSyncTimeout: ReturnType<typeof setTimeout> | null = null;

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      deviceConnections: [],
      portMappings: [],
      nicMappings: [],
      _isLoaded: false,
      _isSyncing: false,

      loadFromServer: async () => {
        try {
          console.log('[connectionStore] Loading from server...');
          const [serverConnections, serverDeviceConnections, serverPortMappings, serverNicMappings] = await Promise.all([
            settingsApi.getNetworkConnections(),
            settingsApi.getNetworkDeviceConnections(),
            settingsApi.getNetworkPortMappings(),
            settingsApi.getNetworkNicMappings(),
          ]);

          console.log('[connectionStore] Server device connections:', serverDeviceConnections);

          const updates: Partial<ConnectionState> = { _isLoaded: true };

          // If server has data, use it
          if (serverConnections && serverConnections.length > 0) {
            updates.connections = serverConnections as PortConnection[];
          }
          if (serverDeviceConnections && serverDeviceConnections.length > 0) {
            updates.deviceConnections = serverDeviceConnections as DeviceConnection[];
            console.log('[connectionStore] Loaded', serverDeviceConnections.length, 'device connections from server');
          }
          if (serverPortMappings && serverPortMappings.length > 0) {
            updates.portMappings = serverPortMappings as PortMapping[];
          }
          if (serverNicMappings && serverNicMappings.length > 0) {
            updates.nicMappings = serverNicMappings as NicMapping[];
          }

          set(updates);

          // If server was empty but we have local data, sync it
          const { connections, deviceConnections, portMappings, nicMappings, _syncConnectionsToServer, _syncDeviceConnectionsToServer, _syncPortMappingsToServer, _syncNicMappingsToServer } = get();

          if ((!serverConnections || serverConnections.length === 0) && connections.length > 0) {
            await _syncConnectionsToServer();
          }
          if ((!serverDeviceConnections || serverDeviceConnections.length === 0) && deviceConnections.length > 0) {
            await _syncDeviceConnectionsToServer();
          }
          if ((!serverPortMappings || serverPortMappings.length === 0) && portMappings.length > 0) {
            await _syncPortMappingsToServer();
          }
          if ((!serverNicMappings || serverNicMappings.length === 0) && nicMappings.length > 0) {
            await _syncNicMappingsToServer();
          }
        } catch (error) {
          console.error('[connectionStore] Failed to load from server:', error);
          set({ _isLoaded: true });
        }
      },

      _syncConnectionsToServer: async () => {
        const { connections, _isSyncing } = get();
        if (_isSyncing) return;

        set({ _isSyncing: true });
        try {
          await settingsApi.saveNetworkConnections(connections as NetworkConnectionData[]);
        } catch (error) {
          console.error('[connectionStore] Failed to sync connections to server:', error);
        } finally {
          set({ _isSyncing: false });
        }
      },

      _syncDeviceConnectionsToServer: async () => {
        const { deviceConnections, _isSyncing } = get();
        if (_isSyncing) return;

        set({ _isSyncing: true });
        try {
          await settingsApi.saveNetworkDeviceConnections(deviceConnections as DeviceConnectionData[]);
        } catch (error) {
          console.error('[connectionStore] Failed to sync device connections to server:', error);
        } finally {
          set({ _isSyncing: false });
        }
      },

      _syncPortMappingsToServer: async () => {
        const { portMappings, _isSyncing } = get();
        if (_isSyncing) return;

        set({ _isSyncing: true });
        try {
          await settingsApi.saveNetworkPortMappings(portMappings as PortMappingData[]);
        } catch (error) {
          console.error('[connectionStore] Failed to sync port mappings to server:', error);
        } finally {
          set({ _isSyncing: false });
        }
      },

      _syncNicMappingsToServer: async () => {
        const { nicMappings, _isSyncing } = get();
        if (_isSyncing) return;

        set({ _isSyncing: true });
        try {
          await settingsApi.saveNetworkNicMappings(nicMappings as NicMappingData[]);
        } catch (error) {
          console.error('[connectionStore] Failed to sync NIC mappings to server:', error);
        } finally {
          set({ _isSyncing: false });
        }
      },

      addConnection: (connection) => {
        set((state) => {
          // Check if connection already exists
          const existing = state.connections.find(
            c => c.localWidgetId === connection.localWidgetId && c.localPort === connection.localPort
          );
          if (existing) {
            // Update existing
            return {
              connections: state.connections.map(c =>
                c.localWidgetId === connection.localWidgetId && c.localPort === connection.localPort
                  ? { ...c, ...connection, discoveryMethod: connection.discoveryMethod || 'manual' }
                  : c
              ),
            };
          }
          // Add new
          return {
            connections: [...state.connections, { ...connection, discoveryMethod: connection.discoveryMethod || 'manual' }],
          };
        });

        // Debounced sync to server
        if (connectionsSyncTimeout) clearTimeout(connectionsSyncTimeout);
        connectionsSyncTimeout = setTimeout(() => {
          get()._syncConnectionsToServer();
        }, 500);
      },

      removeConnection: (localWidgetId, localPort) => {
        set((state) => ({
          connections: state.connections.filter(
            c => !(c.localWidgetId === localWidgetId && c.localPort === localPort)
          ),
        }));

        // Debounced sync to server
        if (connectionsSyncTimeout) clearTimeout(connectionsSyncTimeout);
        connectionsSyncTimeout = setTimeout(() => {
          get()._syncConnectionsToServer();
        }, 500);
      },

      updateConnection: (localWidgetId, localPort, updates) => {
        set((state) => ({
          connections: state.connections.map(c =>
            c.localWidgetId === localWidgetId && c.localPort === localPort
              ? { ...c, ...updates }
              : c
          ),
        }));

        // Debounced sync to server
        if (connectionsSyncTimeout) clearTimeout(connectionsSyncTimeout);
        connectionsSyncTimeout = setTimeout(() => {
          get()._syncConnectionsToServer();
        }, 500);
      },

      clearWidgetConnections: (widgetId) => {
        set((state) => ({
          connections: state.connections.filter(
            c => c.localWidgetId !== widgetId && c.remoteWidgetId !== widgetId
          ),
        }));

        // Debounced sync to server
        if (connectionsSyncTimeout) clearTimeout(connectionsSyncTimeout);
        connectionsSyncTimeout = setTimeout(() => {
          get()._syncConnectionsToServer();
        }, 500);
      },

      importConnections: (connections, replace = false) => {
        set((state) => {
          if (replace) {
            return { connections };
          }
          // Merge, preferring new connections
          const merged = [...state.connections];
          for (const conn of connections) {
            const idx = merged.findIndex(
              c => c.localWidgetId === conn.localWidgetId && c.localPort === conn.localPort
            );
            if (idx >= 0) {
              merged[idx] = conn;
            } else {
              merged.push(conn);
            }
          }
          return { connections: merged };
        });

        // Debounced sync to server
        if (connectionsSyncTimeout) clearTimeout(connectionsSyncTimeout);
        connectionsSyncTimeout = setTimeout(() => {
          get()._syncConnectionsToServer();
        }, 500);
      },

      getConnectionsForWidget: (widgetId) => {
        return get().connections.filter(c => c.localWidgetId === widgetId);
      },

      getConnectionForPort: (widgetId, port) => {
        return get().connections.find(
          c => c.localWidgetId === widgetId && c.localPort === port
        ) || null;
      },

      getRemoteConnection: (widgetId, port) => {
        // First check if this widget/port has a direct connection defined
        const direct = get().connections.find(
          c => c.localWidgetId === widgetId && c.localPort === port
        );
        if (direct) {
          return { widgetId: direct.remoteWidgetId, port: direct.remotePort, label: direct.label };
        }

        // Check reverse - if another widget connects TO this port
        const reverse = get().connections.find(
          c => c.remoteWidgetId === widgetId && c.remotePort === port
        );
        if (reverse) {
          return { widgetId: reverse.localWidgetId, port: reverse.localPort, label: reverse.label };
        }

        return null;
      },

      // Device Connection Actions (stored by device ID, not widget ID)
      addDeviceConnection: (connection) => {
        set((state) => {
          // Check if connection already exists
          const existing = state.deviceConnections.find(
            c => c.localDeviceId === connection.localDeviceId && c.localPort === connection.localPort
          );
          if (existing) {
            // Update existing
            return {
              deviceConnections: state.deviceConnections.map(c =>
                c.localDeviceId === connection.localDeviceId && c.localPort === connection.localPort
                  ? { ...c, ...connection, discoveryMethod: connection.discoveryMethod || 'manual' }
                  : c
              ),
            };
          }
          // Add new
          return {
            deviceConnections: [...state.deviceConnections, { ...connection, discoveryMethod: connection.discoveryMethod || 'manual' }],
          };
        });

        // Debounced sync to server
        if (deviceConnectionsSyncTimeout) clearTimeout(deviceConnectionsSyncTimeout);
        deviceConnectionsSyncTimeout = setTimeout(() => {
          get()._syncDeviceConnectionsToServer();
        }, 500);
      },

      removeDeviceConnection: (localDeviceId, localPort) => {
        set((state) => ({
          deviceConnections: state.deviceConnections.filter(
            c => !(c.localDeviceId === localDeviceId && c.localPort === localPort)
          ),
        }));

        // Debounced sync to server
        if (deviceConnectionsSyncTimeout) clearTimeout(deviceConnectionsSyncTimeout);
        deviceConnectionsSyncTimeout = setTimeout(() => {
          get()._syncDeviceConnectionsToServer();
        }, 500);
      },

      clearDeviceConnections: (deviceId) => {
        set((state) => ({
          deviceConnections: state.deviceConnections.filter(
            c => c.localDeviceId !== deviceId && c.remoteDeviceId !== deviceId
          ),
        }));

        // Debounced sync to server
        if (deviceConnectionsSyncTimeout) clearTimeout(deviceConnectionsSyncTimeout);
        deviceConnectionsSyncTimeout = setTimeout(() => {
          get()._syncDeviceConnectionsToServer();
        }, 500);
      },

      // Device Connection Queries
      getDeviceConnectionsForDevice: (deviceId) => {
        return get().deviceConnections.filter(c => c.localDeviceId === deviceId || c.remoteDeviceId === deviceId);
      },

      getDeviceConnectionForPort: (deviceId, port) => {
        return get().deviceConnections.find(
          c => (c.localDeviceId === deviceId && c.localPort === port) ||
               (c.remoteDeviceId === deviceId && c.remotePort === port)
        ) || null;
      },

      getRemoteDeviceConnection: (deviceId, port) => {
        // First check if this device/port has a direct connection defined
        const direct = get().deviceConnections.find(
          c => c.localDeviceId === deviceId && c.localPort === port
        );
        if (direct) {
          return { deviceId: direct.remoteDeviceId, deviceName: direct.remoteDeviceName, port: direct.remotePort, label: direct.label };
        }

        // Check reverse - if another device connects TO this port
        const reverse = get().deviceConnections.find(
          c => c.remoteDeviceId === deviceId && c.remotePort === port
        );
        if (reverse) {
          return { deviceId: reverse.localDeviceId, deviceName: reverse.localDeviceName, port: reverse.localPort, label: reverse.label };
        }

        return null;
      },

      // Port Mapping Actions
      addPortMapping: (mapping) => {
        set((state) => {
          // Check if mapping already exists for this port
          const existing = state.portMappings.find(
            m => m.widgetId === mapping.widgetId && m.port === mapping.port
          );
          if (existing) {
            // Update existing
            return {
              portMappings: state.portMappings.map(m =>
                m.widgetId === mapping.widgetId && m.port === mapping.port
                  ? { ...m, ...mapping }
                  : m
              ),
            };
          }
          // Add new
          return {
            portMappings: [...state.portMappings, mapping],
          };
        });

        // Debounced sync to server
        if (portMappingsSyncTimeout) clearTimeout(portMappingsSyncTimeout);
        portMappingsSyncTimeout = setTimeout(() => {
          get()._syncPortMappingsToServer();
        }, 500);
      },

      removePortMapping: (widgetId, port) => {
        set((state) => ({
          portMappings: state.portMappings.filter(
            m => !(m.widgetId === widgetId && m.port === port)
          ),
        }));

        // Debounced sync to server
        if (portMappingsSyncTimeout) clearTimeout(portMappingsSyncTimeout);
        portMappingsSyncTimeout = setTimeout(() => {
          get()._syncPortMappingsToServer();
        }, 500);
      },

      updatePortMapping: (widgetId, port, updates) => {
        set((state) => ({
          portMappings: state.portMappings.map(m =>
            m.widgetId === widgetId && m.port === port
              ? { ...m, ...updates }
              : m
          ),
        }));

        // Debounced sync to server
        if (portMappingsSyncTimeout) clearTimeout(portMappingsSyncTimeout);
        portMappingsSyncTimeout = setTimeout(() => {
          get()._syncPortMappingsToServer();
        }, 500);
      },

      clearWidgetMappings: (widgetId) => {
        set((state) => ({
          portMappings: state.portMappings.filter(m => m.widgetId !== widgetId),
        }));

        // Debounced sync to server
        if (portMappingsSyncTimeout) clearTimeout(portMappingsSyncTimeout);
        portMappingsSyncTimeout = setTimeout(() => {
          get()._syncPortMappingsToServer();
        }, 500);
      },

      // Port Mapping Queries
      getMappingsForWidget: (widgetId) => {
        return get().portMappings.filter(m => m.widgetId === widgetId);
      },

      getPortMapping: (widgetId, port) => {
        return get().portMappings.find(
          m => m.widgetId === widgetId && m.port === port
        ) || null;
      },

      // NIC Mapping Actions (Device Overlay)
      addNicMapping: (mapping) => {
        set((state) => {
          // Check if mapping already exists for this NIC
          const existing = state.nicMappings.find(
            m => m.deviceWidgetId === mapping.deviceWidgetId && m.nicId === mapping.nicId
          );
          if (existing) {
            // Update existing
            return {
              nicMappings: state.nicMappings.map(m =>
                m.deviceWidgetId === mapping.deviceWidgetId && m.nicId === mapping.nicId
                  ? { ...m, ...mapping }
                  : m
              ),
            };
          }
          // Add new
          return {
            nicMappings: [...state.nicMappings, mapping],
          };
        });

        // Debounced sync to server
        if (nicMappingsSyncTimeout) clearTimeout(nicMappingsSyncTimeout);
        nicMappingsSyncTimeout = setTimeout(() => {
          get()._syncNicMappingsToServer();
        }, 500);
      },

      removeNicMapping: (deviceWidgetId, nicId) => {
        set((state) => ({
          nicMappings: state.nicMappings.filter(
            m => !(m.deviceWidgetId === deviceWidgetId && m.nicId === nicId)
          ),
        }));

        // Debounced sync to server
        if (nicMappingsSyncTimeout) clearTimeout(nicMappingsSyncTimeout);
        nicMappingsSyncTimeout = setTimeout(() => {
          get()._syncNicMappingsToServer();
        }, 500);
      },

      updateNicMapping: (deviceWidgetId, nicId, updates) => {
        set((state) => ({
          nicMappings: state.nicMappings.map(m =>
            m.deviceWidgetId === deviceWidgetId && m.nicId === nicId
              ? { ...m, ...updates }
              : m
          ),
        }));

        // Debounced sync to server
        if (nicMappingsSyncTimeout) clearTimeout(nicMappingsSyncTimeout);
        nicMappingsSyncTimeout = setTimeout(() => {
          get()._syncNicMappingsToServer();
        }, 500);
      },

      clearDeviceNicMappings: (deviceWidgetId) => {
        set((state) => ({
          nicMappings: state.nicMappings.filter(m => m.deviceWidgetId !== deviceWidgetId),
        }));

        // Debounced sync to server
        if (nicMappingsSyncTimeout) clearTimeout(nicMappingsSyncTimeout);
        nicMappingsSyncTimeout = setTimeout(() => {
          get()._syncNicMappingsToServer();
        }, 500);
      },

      // NIC Mapping Queries
      getNicMappingsForDevice: (deviceWidgetId) => {
        return get().nicMappings.filter(m => m.deviceWidgetId === deviceWidgetId);
      },

      getNicMapping: (deviceWidgetId, nicId) => {
        return get().nicMappings.find(
          m => m.deviceWidgetId === deviceWidgetId && m.nicId === nicId
        ) || null;
      },

      getNicMappingsForSwitch: (switchWidgetId, switchPort) => {
        const mappings = get().nicMappings.filter(m => m.switchWidgetId === switchWidgetId);
        if (switchPort !== undefined) {
          return mappings.filter(m => m.switchPort === switchPort);
        }
        return mappings;
      },
    }),
    {
      name: 'peek-port-connections',
      // Clean up invalid connections and mappings on rehydration (port 0 or negative values)
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Clean invalid connections
          const validConnections = state.connections.filter(
            c => c.localPort > 0 && c.remotePort > 0
          );
          if (validConnections.length !== state.connections.length) {
            console.log(`[connectionStore] Cleaned up ${state.connections.length - validConnections.length} invalid connections (port 0 or negative)`);
            state.connections = validConnections;
          }

          // Clean invalid device connections
          const validDeviceConnections = (state.deviceConnections || []).filter(
            c => c.localPort > 0 && c.remotePort > 0 && c.localDeviceId && c.remoteDeviceId
          );
          if (validDeviceConnections.length !== (state.deviceConnections || []).length) {
            console.log(`[connectionStore] Cleaned up ${(state.deviceConnections || []).length - validDeviceConnections.length} invalid device connections`);
            state.deviceConnections = validDeviceConnections;
          }

          // Clean invalid port mappings
          const validMappings = (state.portMappings || []).filter(
            m => m.port > 0 && m.hostname?.trim()
          );
          if (validMappings.length !== (state.portMappings || []).length) {
            console.log(`[connectionStore] Cleaned up ${(state.portMappings || []).length - validMappings.length} invalid port mappings`);
            state.portMappings = validMappings;
          }

          // Clean invalid NIC mappings
          const validNicMappings = (state.nicMappings || []).filter(
            m => m.deviceWidgetId && m.nicId && m.switchWidgetId && m.switchPort > 0
          );
          if (validNicMappings.length !== (state.nicMappings || []).length) {
            console.log(`[connectionStore] Cleaned up ${(state.nicMappings || []).length - validNicMappings.length} invalid NIC mappings`);
            state.nicMappings = validNicMappings;
          }

          // Load from server after cleanup
          state.loadFromServer();
        }
      },
    }
  )
);
