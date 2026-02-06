import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingsApi, NetworkDeviceData } from '../api/client';

export type DeviceType = 'server' | 'ap' | 'camera' | 'printer' | 'workstation' | 'iot' | 'phone' | 'nas' | 'router' | 'other';

export interface NetworkDevice {
  id: string;
  hostname: string;
  ipAddress?: string;
  macAddress?: string;
  deviceType: DeviceType;
  description?: string;
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEVICE_TYPE_OPTIONS: { value: DeviceType; label: string; icon: string }[] = [
  { value: 'server', label: 'Server', icon: '🖥️' },
  { value: 'ap', label: 'Access Point', icon: '📡' },
  { value: 'camera', label: 'Camera', icon: '📷' },
  { value: 'printer', label: 'Printer', icon: '🖨️' },
  { value: 'workstation', label: 'Workstation', icon: '💻' },
  { value: 'iot', label: 'IoT Device', icon: '🔌' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'nas', label: 'NAS', icon: '💾' },
  { value: 'router', label: 'Router', icon: '🌐' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export function getDeviceTypeInfo(type: DeviceType) {
  return DEVICE_TYPE_OPTIONS.find(d => d.value === type) || DEVICE_TYPE_OPTIONS[DEVICE_TYPE_OPTIONS.length - 1];
}

interface DeviceState {
  devices: NetworkDevice[];
  _isLoaded: boolean;
  _isSyncing: boolean;

  // Actions
  addDevice: (device: Omit<NetworkDevice, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateDevice: (id: string, updates: Partial<Omit<NetworkDevice, 'id' | 'createdAt'>>) => void;
  removeDevice: (id: string) => void;
  loadFromServer: () => Promise<void>;
  _syncToServer: () => Promise<void>;

  // Queries
  getDevice: (id: string) => NetworkDevice | undefined;
  getDeviceByHostname: (hostname: string) => NetworkDevice | undefined;
  searchDevices: (query: string, typeFilter?: DeviceType) => NetworkDevice[];
}

function generateId(): string {
  return `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Debounce timer for sync
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      devices: [],
      _isLoaded: false,
      _isSyncing: false,

      loadFromServer: async () => {
        try {
          const serverDevices = await settingsApi.getNetworkDevices();
          if (serverDevices && serverDevices.length > 0) {
            // Server has data - use it and override local
            set({ devices: serverDevices as NetworkDevice[], _isLoaded: true });
          } else {
            // Server is empty - sync local data to server if we have any
            const { devices, _syncToServer } = get();
            if (devices.length > 0) {
              await _syncToServer();
            }
            set({ _isLoaded: true });
          }
        } catch (error) {
          console.error('[deviceStore] Failed to load from server:', error);
          // Keep local data on failure
          set({ _isLoaded: true });
        }
      },

      _syncToServer: async () => {
        const { devices, _isSyncing } = get();
        if (_isSyncing) return;

        set({ _isSyncing: true });
        try {
          await settingsApi.saveNetworkDevices(devices as NetworkDeviceData[]);
        } catch (error) {
          console.error('[deviceStore] Failed to sync to server:', error);
        } finally {
          set({ _isSyncing: false });
        }
      },

      addDevice: (device) => {
        const id = generateId();
        const now = new Date().toISOString();
        const newDevice: NetworkDevice = {
          ...device,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          devices: [...state.devices, newDevice],
        }));

        // Debounced sync to server
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
          get()._syncToServer();
        }, 500);

        return id;
      },

      updateDevice: (id, updates) => {
        set((state) => ({
          devices: state.devices.map((d) =>
            d.id === id
              ? { ...d, ...updates, updatedAt: new Date().toISOString() }
              : d
          ),
        }));

        // Debounced sync to server
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
          get()._syncToServer();
        }, 500);
      },

      removeDevice: (id) => {
        set((state) => ({
          devices: state.devices.filter((d) => d.id !== id),
        }));

        // Debounced sync to server
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
          get()._syncToServer();
        }, 500);
      },

      getDevice: (id) => {
        return get().devices.find((d) => d.id === id);
      },

      getDeviceByHostname: (hostname) => {
        const lower = hostname.toLowerCase();
        return get().devices.find((d) => d.hostname.toLowerCase() === lower);
      },

      searchDevices: (query, typeFilter) => {
        const lower = query.toLowerCase();
        return get().devices.filter((d) => {
          // Type filter
          if (typeFilter && d.deviceType !== typeFilter) return false;

          // Search query
          if (!query) return true;
          return (
            d.hostname.toLowerCase().includes(lower) ||
            d.ipAddress?.toLowerCase().includes(lower) ||
            d.description?.toLowerCase().includes(lower) ||
            d.macAddress?.toLowerCase().includes(lower)
          );
        });
      },
    }),
    {
      name: 'peek-network-devices',
      // Load from server after rehydration from localStorage
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Load from server on app start
          state.loadFromServer();
        }
      },
    }
  )
);
