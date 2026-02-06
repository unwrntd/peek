import React, { useState, useMemo } from 'react';
import { useConnectionStore, PortMapping } from '../../../../stores/connectionStore';
import { useDashboardStore } from '../../../../stores/dashboardStore';

const DEVICE_TYPES: { value: PortMapping['deviceType']; label: string; icon: string }[] = [
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

interface PortConnectionEditorProps {
  widgetId: string;
  widgetTitle: string;
  portCount: number;
  integrationId?: string;
  deviceId?: string;
}

export function PortConnectionEditor({ widgetId, widgetTitle, portCount }: PortConnectionEditorProps) {
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [newConnection, setNewConnection] = useState({
    localPort: 1,
    remoteWidgetId: '',
    remotePort: 1,
    label: '',
  });
  const [newMapping, setNewMapping] = useState<{
    port: number;
    hostname: string;
    description: string;
    deviceType: PortMapping['deviceType'];
    ipAddress: string;
  }>({
    port: 1,
    hostname: '',
    description: '',
    deviceType: 'other',
    ipAddress: '',
  });

  const connections = useConnectionStore((state) => state.connections);
  const addConnection = useConnectionStore((state) => state.addConnection);
  const removeConnection = useConnectionStore((state) => state.removeConnection);

  const portMappings = useConnectionStore((state) => state.portMappings);
  const addPortMapping = useConnectionStore((state) => state.addPortMapping);
  const removePortMapping = useConnectionStore((state) => state.removePortMapping);

  const widgets = useDashboardStore((state) => state.widgets);

  // Get connections for this widget (as source)
  const widgetConnections = useMemo(() => {
    return connections.filter(c => c.localWidgetId === widgetId);
  }, [connections, widgetId]);

  // Get mappings for this widget
  const widgetMappings = useMemo(() => {
    return portMappings.filter(m => m.widgetId === widgetId);
  }, [portMappings, widgetId]);

  // Get other switch port overlay widgets for the dropdown
  const otherSwitchWidgets = useMemo(() => {
    return widgets.filter(w =>
      w.id !== widgetId &&
      (w.widget_type === 'switch-port-overlay' || w.widget_type === 'cross-switch-port-overlay')
    );
  }, [widgets, widgetId]);

  const handleAddConnection = () => {
    if (!newConnection.remoteWidgetId) return;

    addConnection({
      localWidgetId: widgetId,
      localPort: newConnection.localPort,
      remoteWidgetId: newConnection.remoteWidgetId,
      remotePort: newConnection.remotePort,
      label: newConnection.label || undefined,
      discoveryMethod: 'manual',
    });

    setNewConnection({
      localPort: 1,
      remoteWidgetId: '',
      remotePort: 1,
      label: '',
    });
    setIsAddingConnection(false);
  };

  const handleAddMapping = () => {
    if (!newMapping.hostname.trim()) return;

    addPortMapping({
      widgetId,
      port: newMapping.port,
      hostname: newMapping.hostname.trim(),
      description: newMapping.description.trim() || undefined,
      deviceType: newMapping.deviceType,
      ipAddress: newMapping.ipAddress.trim() || undefined,
    });

    setNewMapping({
      port: 1,
      hostname: '',
      description: '',
      deviceType: 'other',
      ipAddress: '',
    });
    setIsAddingMapping(false);
  };

  const getWidgetName = (wId: string) => {
    const widget = widgets.find(w => w.id === wId);
    return widget?.title || widget?.widget_type || 'Unknown';
  };

  const getDeviceTypeInfo = (type: PortMapping['deviceType']) => {
    return DEVICE_TYPES.find(d => d.value === type) || DEVICE_TYPES[DEVICE_TYPES.length - 1];
  };

  return (
    <div className="space-y-6">
      {/* Port Connections Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Port Connections (Switch-to-Switch)
          </h4>
          <div className="flex items-center gap-2">
            {!isAddingConnection && (
              <button
                onClick={() => setIsAddingConnection(true)}
                className="text-xs px-2 py-1 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
              >
                + Add Connection
              </button>
            )}
          </div>
        </div>

        {/* Existing connections */}
        {widgetConnections.length > 0 ? (
          <div className="space-y-2">
            {widgetConnections.map((conn) => (
              <div
                key={`conn-${conn.localPort}`}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">
                    Port {conn.localPort}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-300">
                    {getWidgetName(conn.remoteWidgetId)} {conn.remotePort > 0 ? `Port ${conn.remotePort}` : ''}
                  </span>
                  {conn.label && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                      ({conn.label})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeConnection(widgetId, conn.localPort)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove connection"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No switch connections configured.
          </p>
        )}

        {/* Add new connection form */}
        {isAddingConnection && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Local port */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Local Port
                </label>
                <select
                  value={newConnection.localPort}
                  onChange={(e) => setNewConnection({ ...newConnection, localPort: parseInt(e.target.value) })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {Array.from({ length: portCount }, (_, i) => i + 1).map((port) => (
                    <option key={port} value={port}>
                      Port {port}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remote widget */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Remote Switch
                </label>
                <select
                  value={newConnection.remoteWidgetId}
                  onChange={(e) => setNewConnection({ ...newConnection, remoteWidgetId: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Select a switch...</option>
                  {otherSwitchWidgets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title || w.widget_type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remote port */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Remote Port
                </label>
                <input
                  type="number"
                  min="1"
                  value={newConnection.remotePort}
                  onChange={(e) => setNewConnection({ ...newConnection, remotePort: parseInt(e.target.value) || 1 })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={newConnection.label}
                  onChange={(e) => setNewConnection({ ...newConnection, label: e.target.value })}
                  placeholder="e.g., Uplink to Core"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
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
                disabled={!newConnection.remoteWidgetId}
                className="px-3 py-1.5 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Connection
              </button>
            </div>
          </div>
        )}

        {otherSwitchWidgets.length === 0 && !isAddingConnection && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Add more Switch Port Overlay widgets to create connections between them.
          </p>
        )}
      </div>

      {/* Divider */}
      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Port Mappings Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Port Mappings (Devices)
          </h4>
          <div className="flex items-center gap-2">
            {!isAddingMapping && (
              <button
                onClick={() => setIsAddingMapping(true)}
                className="text-xs px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
              >
                + Add Mapping
              </button>
            )}
          </div>
        </div>

        {/* Existing mappings */}
        {widgetMappings.length > 0 ? (
          <div className="space-y-2">
            {widgetMappings.map((mapping) => {
              const deviceInfo = getDeviceTypeInfo(mapping.deviceType);
              return (
                <div
                  key={`mapping-${mapping.port}`}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">
                      Port {mapping.port}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="text-lg" title={deviceInfo.label}>{deviceInfo.icon}</span>
                    <span className="text-gray-600 dark:text-gray-300 font-medium">
                      {mapping.hostname}
                    </span>
                    {mapping.description && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                        ({mapping.description})
                      </span>
                    )}
                    {mapping.ipAddress && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {mapping.ipAddress}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removePortMapping(widgetId, mapping.port)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove mapping"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No device mappings configured. Map ports to hostnames for end devices (servers, APs, cameras, etc.)
          </p>
        )}

        {/* Add new mapping form */}
        {isAddingMapping && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Port */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Port
                </label>
                <select
                  value={newMapping.port}
                  onChange={(e) => setNewMapping({ ...newMapping, port: parseInt(e.target.value) })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {Array.from({ length: portCount }, (_, i) => i + 1).map((port) => (
                    <option key={port} value={port}>
                      Port {port}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hostname */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Hostname
                </label>
                <input
                  type="text"
                  value={newMapping.hostname}
                  onChange={(e) => setNewMapping({ ...newMapping, hostname: e.target.value })}
                  placeholder="e.g., server-01"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>

              {/* Device Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Device Type
                </label>
                <select
                  value={newMapping.deviceType}
                  onChange={(e) => setNewMapping({ ...newMapping, deviceType: e.target.value as PortMapping['deviceType'] })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {DEVICE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newMapping.description}
                  onChange={(e) => setNewMapping({ ...newMapping, description: e.target.value })}
                  placeholder="e.g., Main web server"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>

              {/* IP Address */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  IP Address (optional)
                </label>
                <input
                  type="text"
                  value={newMapping.ipAddress}
                  onChange={(e) => setNewMapping({ ...newMapping, ipAddress: e.target.value })}
                  placeholder="e.g., 192.168.1.50"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAddingMapping(false)}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMapping}
                disabled={!newMapping.hostname.trim()}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Mapping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
