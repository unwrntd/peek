import React, { useState, useMemo, useEffect } from 'react';
import {
  useDeviceStore,
  NetworkDevice,
  DeviceType,
  DEVICE_TYPE_OPTIONS,
  getDeviceTypeInfo,
} from '../../../stores/deviceStore';
import { useConnectionStore, DeviceConnection } from '../../../stores/connectionStore';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { useIntegrationStore } from '../../../stores/integrationStore';
import { settingsApi } from '../../../api/client';

interface DeviceFormData {
  hostname: string;
  ipAddress: string;
  macAddress: string;
  deviceType: DeviceType;
  description: string;
}

const emptyForm: DeviceFormData = {
  hostname: '',
  ipAddress: '',
  macAddress: '',
  deviceType: 'other',
  description: '',
};

export function DevicesManager() {
  const devices = useDeviceStore((state) => state.devices);
  const addDevice = useDeviceStore((state) => state.addDevice);
  const updateDevice = useDeviceStore((state) => state.updateDevice);
  const removeDevice = useDeviceStore((state) => state.removeDevice);

  const portMappings = useConnectionStore((state) => state.portMappings);
  const deviceConnections = useConnectionStore((state) => state.deviceConnections);
  const widgets = useDashboardStore((state) => state.widgets);
  const integrations = useIntegrationStore((state) => state.integrations);
  const fetchIntegrations = useIntegrationStore((state) => state.fetchIntegrations);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<DeviceType | ''>('');
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null);
  const [formData, setFormData] = useState<DeviceFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  // Track switch IDs to filter them out of the devices list
  const [switchIds, setSwitchIds] = useState<Set<string>>(new Set());

  // Get UniFi integrations
  const unifiIntegrations = useMemo(() => {
    return integrations.filter((i) => i.type === 'unifi' && i.enabled);
  }, [integrations]);

  // Fetch integrations and switch IDs on mount
  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Fetch switches to know which devices are switches (shouldn't be shown here)
  useEffect(() => {
    const fetchSwitchIds = async () => {
      const ids = new Set<string>();

      // Fetch from integrations
      for (const integration of unifiIntegrations) {
        try {
          const response = await fetch(`/api/data/${integration.id}/switch-ports`);
          if (!response.ok) continue;
          const contentType = response.headers.get('content-type');
          if (!contentType?.includes('application/json')) continue;
          const data = await response.json();
          if (data.devices && Array.isArray(data.devices)) {
            for (const device of data.devices) {
              const hasPortTable = device.port_table && device.port_table.length > 0;
              const isSwitch = device.type === 'usw' || device.type === 'USW';
              const isUdm = device.type === 'udm' || device.type === 'UDM';
              const isUgw = device.type === 'ugw' || device.type === 'UGW';
              if (hasPortTable || isSwitch || isUdm || isUgw) {
                // Add both device ID and device name to identify switches
                if (device._id) ids.add(device._id);
                if (device.name) ids.add(device.name.toLowerCase());
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch switches from ${integration.name}:`, err);
        }
      }

      // Also get manual switches
      try {
        const manual = await settingsApi.getManualSwitches();
        if (manual && Array.isArray(manual)) {
          for (const sw of manual) {
            if (sw.id) ids.add(sw.id);
            if (sw.name) ids.add(sw.name.toLowerCase());
          }
        }
      } catch (err) {
        console.error('Failed to fetch manual switches:', err);
      }

      setSwitchIds(ids);
    };

    fetchSwitchIds();
  }, [unifiIntegrations]);

  // Filter devices based on search and type, excluding switches
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      // Exclude switches - they belong in the Switches tab
      // Check by hostname (case-insensitive) and by device type
      if (switchIds.has(device.hostname.toLowerCase())) return false;
      if (device.deviceType === 'router') {
        // Check if this "router" is actually a switch by name match
        if (switchIds.has(device.hostname.toLowerCase())) return false;
      }

      // Type filter
      if (typeFilter && device.deviceType !== typeFilter) return false;

      // Search query
      if (!searchQuery) return true;
      const lower = searchQuery.toLowerCase();
      return (
        device.hostname.toLowerCase().includes(lower) ||
        device.ipAddress?.toLowerCase().includes(lower) ||
        device.description?.toLowerCase().includes(lower) ||
        device.macAddress?.toLowerCase().includes(lower)
      );
    });
  }, [devices, searchQuery, typeFilter, switchIds]);

  // Get port mappings for a device (by matching hostname - for legacy data)
  const getDeviceMappings = (device: NetworkDevice) => {
    // Check for manual port mappings that match this device's hostname
    return portMappings.filter(
      (m) => m.hostname.toLowerCase() === device.hostname.toLowerCase()
    );
  };

  // Get device uplinks from deviceConnections (auto-detected from UniFi)
  const getDeviceUplinks = (device: NetworkDevice): DeviceConnection[] => {
    // Match by hostname (device name)
    const hostnameLower = device.hostname.toLowerCase();
    return deviceConnections.filter((conn) => {
      // Check if this device is the local or remote end (non-switch side)
      const localMatch = conn.localDeviceName.toLowerCase() === hostnameLower;
      const remoteMatch = conn.remoteDeviceName.toLowerCase() === hostnameLower;
      return localMatch || remoteMatch;
    });
  };

  // Get the switch info for a device uplink
  const getUplinkSwitchInfo = (conn: DeviceConnection, deviceHostname: string) => {
    const hostnameLower = deviceHostname.toLowerCase();
    if (conn.localDeviceName.toLowerCase() === hostnameLower) {
      // Device is local, switch is remote
      return {
        switchName: conn.remoteDeviceName,
        switchPort: conn.remotePort,
        devicePort: conn.localPort,
      };
    } else {
      // Device is remote, switch is local
      return {
        switchName: conn.localDeviceName,
        switchPort: conn.localPort,
        devicePort: conn.remotePort,
      };
    }
  };

  // Get widget name by ID
  const getWidgetName = (widgetId: string) => {
    const widget = widgets.find((w) => w.id === widgetId);
    return widget?.title || widget?.widget_type || 'Unknown Switch';
  };

  const handleOpenAdd = () => {
    setFormData(emptyForm);
    setFormError(null);
    setEditingDevice(null);
    setIsAddingDevice(true);
  };

  const handleOpenEdit = (device: NetworkDevice) => {
    setFormData({
      hostname: device.hostname,
      ipAddress: device.ipAddress || '',
      macAddress: device.macAddress || '',
      deviceType: device.deviceType,
      description: device.description || '',
    });
    setFormError(null);
    setEditingDevice(device);
    setIsAddingDevice(true);
  };

  const handleClose = () => {
    setIsAddingDevice(false);
    setEditingDevice(null);
    setFormData(emptyForm);
    setFormError(null);
  };

  const handleSubmit = () => {
    // Validate
    if (!formData.hostname.trim()) {
      setFormError('Hostname is required');
      return;
    }

    // Check for duplicate hostname (excluding current device if editing)
    const duplicate = devices.find(
      (d) =>
        d.hostname.toLowerCase() === formData.hostname.trim().toLowerCase() &&
        d.id !== editingDevice?.id
    );
    if (duplicate) {
      setFormError('A device with this hostname already exists');
      return;
    }

    if (editingDevice) {
      // Update existing
      updateDevice(editingDevice.id, {
        hostname: formData.hostname.trim(),
        ipAddress: formData.ipAddress.trim() || undefined,
        macAddress: formData.macAddress.trim() || undefined,
        deviceType: formData.deviceType,
        description: formData.description.trim() || undefined,
      });
    } else {
      // Add new
      addDevice({
        hostname: formData.hostname.trim(),
        ipAddress: formData.ipAddress.trim() || undefined,
        macAddress: formData.macAddress.trim() || undefined,
        deviceType: formData.deviceType,
        description: formData.description.trim() || undefined,
      });
    }

    handleClose();
  };

  const handleDelete = (device: NetworkDevice) => {
    if (confirm(`Delete device "${device.hostname}"? This cannot be undone.`)) {
      removeDevice(device.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DeviceType | '')}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            {DEVICE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Device
        </button>
      </div>

      {/* Device List */}
      {filteredDevices.length === 0 ? (
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
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            {devices.length === 0
              ? 'No devices yet. Add your first network device to get started.'
              : 'No devices match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDevices.map((device) => {
            const typeInfo = getDeviceTypeInfo(device.deviceType);
            const mappings = getDeviceMappings(device);
            const uplinks = getDeviceUplinks(device);
            const hasConnection = mappings.length > 0 || uplinks.length > 0;

            return (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-4">
                  {/* Device Icon */}
                  <div className="text-2xl" title={typeInfo.label}>
                    {typeInfo.icon}
                  </div>

                  {/* Device Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {device.hostname}
                      </span>
                      {device.ipAddress && (
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {device.ipAddress}
                        </span>
                      )}
                    </div>
                    {device.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {device.description}
                      </p>
                    )}
                    {/* Show manual port mappings */}
                    {mappings.length > 0 && (
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                        Manual: {mappings.map((m) => `${getWidgetName(m.widgetId)} Port ${m.port}`).join(', ')}
                      </p>
                    )}
                    {/* Show auto-detected uplinks */}
                    {uplinks.length > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Uplink: {uplinks.map((conn) => {
                          const info = getUplinkSwitchInfo(conn, device.hostname);
                          return `${info.switchName} Port ${info.switchPort}`;
                        }).join(', ')}
                      </p>
                    )}
                    {!hasConnection && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                        Not mapped to any port
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(device)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Edit device"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(device)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete device"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Device Modal */}
      {isAddingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingDevice ? 'Edit Device' : 'Add Network Device'}
              </h3>
              <button
                onClick={handleClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  {formError}
                </div>
              )}

              {/* Hostname */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hostname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.hostname}
                  onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                  placeholder="e.g., server-01"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* IP Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  IP Address
                </label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="e.g., 192.168.1.10"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Device Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Device Type
                </label>
                <select
                  value={formData.deviceType}
                  onChange={(e) => setFormData({ ...formData, deviceType: e.target.value as DeviceType })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {DEVICE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Main web server"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* MAC Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  MAC Address
                </label>
                <input
                  type="text"
                  value={formData.macAddress}
                  onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                  placeholder="e.g., 00:1A:2B:3C:4D:5E"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                {editingDevice ? 'Save Changes' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
