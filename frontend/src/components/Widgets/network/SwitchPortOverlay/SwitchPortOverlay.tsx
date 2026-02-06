import React, { useState, useMemo, useCallback } from 'react';
import { useWidgetData } from '../../../../hooks/useWidgetData';
import { useRedact } from '../../../../hooks/useRedact';
import { BaseWidget } from '../../BaseWidget';
import { PortIndicator } from './PortIndicator';
import { PortTooltip, PortConnectionInfo, PortMappingInfo } from './PortTooltip';
import { SwitchLegend } from './SwitchLegend';
import { useConnectionStore } from '../../../../stores/connectionStore';
import { useDashboardStore } from '../../../../stores/dashboardStore';
import {
  SwitchTemplate,
  PortDefinition,
  getTemplateById,
  getTemplateByModel,
  getGenericTemplate,
  SWITCH_TEMPLATES,
} from './templates';

interface SwitchPortOverlayProps {
  integrationId: string | null; // null for cross-integration widgets
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

// Port status from various integrations
export interface PortStatus {
  number: number;
  name: string;
  enabled: boolean;
  linkUp: boolean;
  speed?: number;
  duplex?: 'full' | 'half';
  poe?: {
    enabled: boolean;
    delivering: boolean;
    powerWatts?: number;
  };
  rxBytes?: number;
  txBytes?: number;
  isUplink?: boolean;
  media?: string;
}

// Device data structure from UniFi
interface UnifiDevice {
  _id: string;
  mac: string;
  model: string;
  name: string;
  type: string;
  state: number;
  port_table?: Array<{
    port_idx: number;
    name: string;
    up: boolean;
    enable: boolean;
    speed: number;
    full_duplex: boolean;
    poe_enable?: boolean;
    poe_power?: number;
    rx_bytes: number;
    tx_bytes: number;
    media?: string;
    port_poe?: boolean;
    is_uplink?: boolean;
  }>;
}

interface DevicesData {
  devices: UnifiDevice[];
}

export function SwitchPortOverlay({ integrationId: propIntegrationId, config, widgetId }: SwitchPortOverlayProps) {
  const [hoveredPort, setHoveredPort] = useState<PortStatus | null>(null);
  const [hoveredPortNumber, setHoveredPortNumber] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Redaction support
  const { rSwitch } = useRedact();

  // For cross-integration widgets, get integrationId from config
  const integrationId = propIntegrationId || (config.integrationId as string);

  // Connection store for port correlations
  const getRemoteConnection = useConnectionStore((state) => state.getRemoteConnection);
  const getConnectionsForWidget = useConnectionStore((state) => state.getConnectionsForWidget);
  const allConnections = useConnectionStore((state) => state.connections);
  const getRemoteDeviceConnection = useConnectionStore((state) => state.getRemoteDeviceConnection);
  const getDeviceConnectionsForDevice = useConnectionStore((state) => state.getDeviceConnectionsForDevice);
  const allDeviceConnections = useConnectionStore((state) => state.deviceConnections);
  const getPortMapping = useConnectionStore((state) => state.getPortMapping);
  const getMappingsForWidget = useConnectionStore((state) => state.getMappingsForWidget);
  const widgets = useDashboardStore((state) => state.widgets);

  // Get ports that have connections (either as source or destination)
  // Checks both widget-based connections AND device-based connections
  const portsWithConnections = useMemo(() => {
    const ports = new Set<number>();

    // Widget-based connections (by widget ID)
    if (widgetId) {
      // Ports where this widget is the source
      const sourceConnections = getConnectionsForWidget(widgetId);
      sourceConnections.forEach(c => ports.add(c.localPort));

      // Ports where this widget is the destination
      allConnections
        .filter(c => c.remoteWidgetId === widgetId)
        .forEach(c => ports.add(c.remotePort));
    }

    // Device-based connections (by device ID)
    const currentDeviceId = config.deviceId as string;
    if (currentDeviceId) {
      // Ports where this device is the source or destination
      const deviceConns = getDeviceConnectionsForDevice(currentDeviceId);
      deviceConns.forEach(c => {
        if (c.localDeviceId === currentDeviceId) {
          ports.add(c.localPort);
        }
        if (c.remoteDeviceId === currentDeviceId) {
          ports.add(c.remotePort);
        }
      });
    }

    return ports;
  }, [widgetId, config.deviceId, getConnectionsForWidget, allConnections, getDeviceConnectionsForDevice]);

  // Get ports that have device mappings
  const portsWithMappings = useMemo(() => {
    if (!widgetId) return new Set<number>();
    const mappings = getMappingsForWidget(widgetId);
    return new Set(mappings.map(m => m.port));
  }, [widgetId, getMappingsForWidget]);

  // Configuration
  const deviceId = config.deviceId as string;
  const templateId = config.templateId as string;
  const indicatorStyle = (config.indicatorStyle as string) || 'led';
  const indicatorSize = (config.indicatorSize as string) || 'medium';
  const showLegend = config.showLegend !== false;
  const highlightPoe = config.highlightPoe !== false;
  const highlightSpeed = config.highlightSpeed === true;

  // Switch name display settings (widget-level, overrides template if set)
  const showSwitchName = config.showSwitchName === true;
  const switchNamePosition = (config.switchNamePosition as 'top' | 'bottom') || 'top';
  const switchNameAlign = (config.switchNameAlign as 'left' | 'center' | 'right') || 'center';
  const switchNameFontSize = (config.switchNameFontSize as number) || 14;

  // Fetch device data - only when integrationId is available
  const { data, loading, error } = useWidgetData<DevicesData>({
    integrationId: integrationId || '',
    metric: 'switch-ports',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
    enabled: !!integrationId,
  });

  // Find the selected device
  const device = useMemo(() => {
    if (!data?.devices || !deviceId) return null;
    return data.devices.find(d =>
      d._id === deviceId ||
      d.mac === deviceId ||
      d.name?.toLowerCase() === deviceId.toLowerCase()
    );
  }, [data?.devices, deviceId]);

  // Get or detect template
  const template = useMemo((): SwitchTemplate | null => {
    // Use specified template
    if (templateId) {
      const specified = getTemplateById(templateId);
      if (specified) return specified;
    }

    // Auto-detect from device model
    if (device?.model) {
      const detected = getTemplateByModel(device.model);
      if (detected) return detected;
    }

    // Fall back to generic based on port count
    if (device?.port_table) {
      return getGenericTemplate(device.port_table.length);
    }

    return null;
  }, [templateId, device?.model, device?.port_table]);

  // Map device ports to status
  const portStatuses = useMemo((): Map<number, PortStatus> => {
    const map = new Map<number, PortStatus>();
    if (!device?.port_table) return map;

    for (const port of device.port_table) {
      map.set(port.port_idx, {
        number: port.port_idx,
        name: port.name || `Port ${port.port_idx}`,
        enabled: port.enable,
        linkUp: port.up,
        speed: port.speed,
        duplex: port.full_duplex ? 'full' : 'half',
        poe: port.port_poe ? {
          enabled: port.poe_enable || false,
          delivering: (port.poe_power || 0) > 0,
          powerWatts: port.poe_power,
        } : undefined,
        rxBytes: port.rx_bytes,
        txBytes: port.tx_bytes,
        isUplink: port.is_uplink,
        media: port.media,
      });
    }

    return map;
  }, [device?.port_table]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const ports = Array.from(portStatuses.values());
    return {
      total: ports.length,
      up: ports.filter(p => p.linkUp).length,
      down: ports.filter(p => !p.linkUp && p.enabled).length,
      disabled: ports.filter(p => !p.enabled).length,
      poeActive: ports.filter(p => p.poe?.delivering).length,
    };
  }, [portStatuses]);

  // Get connection info for the currently hovered port
  // Checks both widget-based connections AND device-based connections
  const hoveredPortConnection = useMemo((): PortConnectionInfo | null => {
    if (hoveredPortNumber === null) return null;

    // First try widget-based connection
    if (widgetId) {
      const conn = getRemoteConnection(widgetId, hoveredPortNumber);
      if (conn) {
        // Find the remote widget to get its name
        const remoteWidget = widgets.find(w => w.id === conn.widgetId);
        if (remoteWidget) {
          return {
            remoteWidgetId: conn.widgetId,
            remoteWidgetName: remoteWidget.title || remoteWidget.widget_type,
            remotePort: conn.port,
            label: conn.label,
          };
        }
      }
    }

    // Try device-based connection
    const currentDeviceId = config.deviceId as string;
    if (currentDeviceId) {
      const deviceConn = getRemoteDeviceConnection(currentDeviceId, hoveredPortNumber);
      if (deviceConn) {
        // For device connections, show the device name instead of widget name
        // Check if there's a widget for the remote device
        const remoteWidget = widgets.find(w =>
          w.widget_type === 'switch-port-overlay' &&
          w.config.deviceId === deviceConn.deviceId
        );

        return {
          remoteWidgetId: remoteWidget?.id || deviceConn.deviceId,
          remoteWidgetName: remoteWidget?.title || deviceConn.deviceName,
          remotePort: deviceConn.port,
          label: deviceConn.label,
        };
      }
    }

    return null;
  }, [widgetId, hoveredPortNumber, config.deviceId, getRemoteConnection, getRemoteDeviceConnection, widgets]);

  // Get mapping info for the currently hovered port
  const hoveredPortMapping = useMemo((): PortMappingInfo | null => {
    if (!widgetId || hoveredPortNumber === null) return null;

    const mapping = getPortMapping(widgetId, hoveredPortNumber);
    if (!mapping) return null;

    return {
      hostname: mapping.hostname,
      description: mapping.description,
      deviceType: mapping.deviceType,
      ipAddress: mapping.ipAddress,
    };
  }, [widgetId, hoveredPortNumber, getPortMapping]);

  // Handle port hover - wrapped in try-catch to prevent crashes
  const handlePortHover = (port: PortDefinition | null, event?: React.MouseEvent) => {
    try {
      if (port && event) {
        const status = portStatuses.get(port.number);
        if (status) {
          // Ensure the status has valid data
          setHoveredPort({
            ...status,
            number: status.number ?? port.number,
            name: status.name || port.label || `Port ${port.number}`,
            enabled: status.enabled ?? false,
            linkUp: status.linkUp ?? false,
          });
        } else {
          // Create a minimal status object for ports without status data
          setHoveredPort({
            number: port.number,
            name: port.label || `Port ${port.number}`,
            enabled: false,
            linkUp: false,
          });
        }
        setHoveredPortNumber(port.number);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      } else {
        setHoveredPort(null);
        setHoveredPortNumber(null);
        setTooltipPosition(null);
      }
    } catch (err) {
      // If anything goes wrong, just clear the hover state
      console.warn('Error in handlePortHover:', err);
      setHoveredPort(null);
      setHoveredPortNumber(null);
      setTooltipPosition(null);
    }
  };

  // No integration selected (for cross-integration widgets)
  if (!integrationId) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <p className="text-sm">Select an integration in widget settings</p>
        </div>
      </BaseWidget>
    );
  }

  // No device selected
  if (!deviceId) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <p className="text-sm">Select a switch device in widget settings</p>
        </div>
      </BaseWidget>
    );
  }

  // Device not found - only show error if we have data but device isn't in it
  // During initial load or if data is empty, show loading instead
  if (!device) {
    const hasLoadedData = data?.devices && data.devices.length > 0;
    if (loading || !hasLoadedData) {
      return (
        <BaseWidget loading={true} error={null}>
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p className="text-sm">Loading switch data...</p>
          </div>
        </BaseWidget>
      );
    }
    return (
      <BaseWidget loading={false} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">Device not found: {deviceId}</p>
        </div>
      </BaseWidget>
    );
  }

  // No template available
  if (!template) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <p className="text-sm">No template for model: {device.model}</p>
          <p className="text-xs mt-1">Select a template in widget settings</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col">
        {/* Switch name - top position */}
        {showSwitchName && switchNamePosition === 'top' && device?.name && (
          <div
            className={`flex-shrink-0 text-gray-700 dark:text-gray-200 truncate leading-tight ${
              switchNameAlign === 'center' ? 'text-center' :
              switchNameAlign === 'right' ? 'text-right' : 'text-left'
            }`}
            style={{ fontSize: `${switchNameFontSize}px` }}
          >
            {rSwitch(device.name)}
          </div>
        )}

        {/* Switch visualization - fills available space */}
        <div className={`flex-1 min-h-0 flex justify-center ${
          showSwitchName && switchNamePosition === 'top' ? 'items-start' :
          showSwitchName && switchNamePosition === 'bottom' ? 'items-end' : 'items-center'
        }`}>
          <div className={`relative w-full h-full flex justify-center ${
            showSwitchName && switchNamePosition === 'top' ? 'items-start' :
            showSwitchName && switchNamePosition === 'bottom' ? 'items-end' : 'items-center'
          }`}>
            {template.image.url ? (
              <div className="relative max-w-full max-h-full" style={{ aspectRatio: template.aspectRatio }}>
                <img
                  src={template.image.url}
                  alt={template.displayName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* Port indicators overlay */}
                <div className="absolute inset-0">
                  {template.ports.map((port) => {
                    const status = portStatuses.get(port.number);
                    return (
                      <PortIndicator
                        key={port.number}
                        port={port}
                        status={status}
                        style={indicatorStyle}
                        size={indicatorSize}
                        highlightPoe={highlightPoe}
                        highlightSpeed={highlightSpeed}
                        hasConnection={portsWithConnections.has(port.number)}
                        hasMapping={portsWithMappings.has(port.number)}
                        onHover={(e) => handlePortHover(port, e)}
                        onLeave={() => handlePortHover(null)}
                      />
                    );
                  })}
                  {/* Switch name overlay */}
                  {template.switchNameDisplay?.show && device?.name && (
                    <div
                      className="absolute pointer-events-none whitespace-nowrap"
                      style={{
                        left: `${template.switchNameDisplay.x}%`,
                        top: `${template.switchNameDisplay.y}%`,
                        transform: template.switchNameDisplay.textAlign === 'center'
                          ? 'translate(-50%, -50%)'
                          : template.switchNameDisplay.textAlign === 'right'
                            ? 'translate(-100%, -50%)'
                            : 'translate(0, -50%)',
                        color: template.switchNameDisplay.color,
                        fontSize: `${template.switchNameDisplay.fontSize}px`,
                        fontWeight: template.switchNameDisplay.fontWeight,
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}
                    >
                      {rSwitch(device.name)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Generic switch placeholder
              <div
                className="relative w-full max-h-full bg-gray-800 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                style={{ aspectRatio: template.aspectRatio }}
              >
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  {rSwitch(device.name || device.model)}
                </div>
                {template.ports.map((port) => {
                  const status = portStatuses.get(port.number);
                  return (
                    <PortIndicator
                      key={port.number}
                      port={port}
                      status={status}
                      style={indicatorStyle}
                      size={indicatorSize}
                      highlightPoe={highlightPoe}
                      highlightSpeed={highlightSpeed}
                      hasConnection={portsWithConnections.has(port.number)}
                      hasMapping={portsWithMappings.has(port.number)}
                      onHover={(e) => handlePortHover(port, e)}
                      onLeave={() => handlePortHover(null)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Switch name - bottom position */}
        {showSwitchName && switchNamePosition === 'bottom' && device?.name && (
          <div
            className={`flex-shrink-0 text-gray-700 dark:text-gray-200 truncate leading-tight ${
              switchNameAlign === 'center' ? 'text-center' :
              switchNameAlign === 'right' ? 'text-right' : 'text-left'
            }`}
            style={{ fontSize: `${switchNameFontSize}px` }}
          >
            {rSwitch(device.name)}
          </div>
        )}

        {/* Legend - fixed at bottom */}
        {showLegend && (
          <div className="flex-shrink-0 pt-2">
            <SwitchLegend
              summary={summary}
              showPoe={highlightPoe && summary.poeActive > 0}
            />
          </div>
        )}

        {/* Tooltip - only render if we have valid port data */}
        {hoveredPort && tooltipPosition && typeof hoveredPort.number === 'number' && (
          <PortTooltip
            port={hoveredPort}
            position={tooltipPosition}
            connection={hoveredPortConnection}
            mapping={hoveredPortMapping}
          />
        )}
      </div>
    </BaseWidget>
  );
}
