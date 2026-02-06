import React, { useState, useMemo } from 'react';
import { useRedact } from '../../../../hooks/useRedact';
import { BaseWidget } from '../../BaseWidget';
import { NicIndicator, NicStatus } from './NicIndicator';
import { NicTooltip, NicSwitchMappingInfo } from './NicTooltip';
import { DeviceLegend } from './DeviceLegend';
import { useConnectionStore } from '../../../../stores/connectionStore';
import { useDashboardStore } from '../../../../stores/dashboardStore';
import {
  DeviceTemplate,
  NicDefinition,
  getDeviceTemplateById,
  DEVICE_TEMPLATES,
} from './templates';

interface DeviceOverlayProps {
  integrationId: string | null; // Not used - static widget
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function DeviceOverlay({ config, widgetId }: DeviceOverlayProps) {
  const [hoveredNic, setHoveredNic] = useState<NicDefinition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Redaction support
  const { rHost } = useRedact();

  // Connection store for NIC-to-switch mappings
  const getNicMapping = useConnectionStore((state) => state.getNicMapping);
  const getNicMappingsForDevice = useConnectionStore((state) => state.getNicMappingsForDevice);
  const widgets = useDashboardStore((state) => state.widgets);

  // Configuration
  const templateId = config.templateId as string;
  const deviceName = (config.deviceName as string) || '';
  const indicatorStyle = (config.indicatorStyle as string) || 'led';
  const indicatorSize = (config.indicatorSize as string) || 'medium';
  const showLegend = config.showLegend !== false;
  const showDeviceName = config.showDeviceName !== false;
  const showNicLabels = config.showNicLabels === true;

  // Device name display settings
  const deviceNamePosition = (config.deviceNamePosition as 'top' | 'bottom') || 'top';
  const deviceNameAlign = (config.deviceNameAlign as 'left' | 'center' | 'right') || 'center';
  const deviceNameFontSize = (config.deviceNameFontSize as number) || 14;

  // Get template
  const template = useMemo((): DeviceTemplate | null => {
    if (templateId) {
      return getDeviceTemplateById(templateId) || null;
    }
    return null;
  }, [templateId]);

  // Get NICs that have switch mappings
  const nicsWithMappings = useMemo(() => {
    if (!widgetId) return new Set<string>();
    const mappings = getNicMappingsForDevice(widgetId);
    return new Set(mappings.map(m => m.nicId));
  }, [widgetId, getNicMappingsForDevice]);

  // Build NIC statuses (for now, just track if they have mappings)
  const nicStatuses = useMemo((): Map<string, NicStatus> => {
    const map = new Map<string, NicStatus>();
    if (!template?.nics) return map;

    for (const nic of template.nics) {
      const hasMapping = nicsWithMappings.has(nic.id);
      map.set(nic.id, {
        id: nic.id,
        connected: hasMapping, // Consider "connected" if it has a switch mapping
        speed: nic.speed,
        hasSwitchMapping: hasMapping,
      });
    }

    return map;
  }, [template?.nics, nicsWithMappings]);

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!template?.nics) {
      return { total: 0, connected: 0, disconnected: 0, management: 0 };
    }

    const nics = template.nics;
    const mgmtTypes = ['mgmt', 'ipmi'];

    return {
      total: nics.length,
      connected: nics.filter(n => nicsWithMappings.has(n.id)).length,
      disconnected: nics.filter(n => !nicsWithMappings.has(n.id) && !mgmtTypes.includes(n.type)).length,
      management: nics.filter(n => mgmtTypes.includes(n.type)).length,
    };
  }, [template?.nics, nicsWithMappings]);

  // Get switch mapping info for the currently hovered NIC
  const hoveredNicMapping = useMemo((): NicSwitchMappingInfo | null => {
    if (!widgetId || !hoveredNic) return null;

    const mapping = getNicMapping(widgetId, hoveredNic.id);
    if (!mapping) return null;

    // Find the switch widget to get its name
    const switchWidget = widgets.find(w => w.id === mapping.switchWidgetId);
    if (!switchWidget) return null;

    return {
      switchWidgetId: mapping.switchWidgetId,
      switchWidgetName: switchWidget.title || switchWidget.widget_type,
      switchPort: mapping.switchPort,
      label: mapping.label,
      vlan: mapping.vlan,
    };
  }, [widgetId, hoveredNic, getNicMapping, widgets]);

  // Handle NIC hover
  const handleNicHover = (nic: NicDefinition | null, event?: React.MouseEvent) => {
    try {
      if (nic && event) {
        setHoveredNic(nic);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      } else {
        setHoveredNic(null);
        setTooltipPosition(null);
      }
    } catch (err) {
      console.warn('Error in handleNicHover:', err);
      setHoveredNic(null);
      setTooltipPosition(null);
    }
  };

  // No template selected
  if (!templateId) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <p className="text-sm">Select a device template in widget settings</p>
        </div>
      </BaseWidget>
    );
  }

  // Template not found
  if (!template) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">Template not found: {templateId}</p>
        </div>
      </BaseWidget>
    );
  }

  const displayName = deviceName || template.displayName;

  return (
    <BaseWidget loading={false} error={null}>
      <div className="h-full flex flex-col">
        {/* Device name - top position */}
        {showDeviceName && deviceNamePosition === 'top' && displayName && (
          <div
            className={`flex-shrink-0 text-gray-200 truncate leading-tight ${
              deviceNameAlign === 'center' ? 'text-center' :
              deviceNameAlign === 'right' ? 'text-right' : 'text-left'
            }`}
            style={{ fontSize: `${deviceNameFontSize}px` }}
          >
            {rHost(displayName)}
          </div>
        )}

        {/* Device visualization - fills available space */}
        <div className={`flex-1 min-h-0 flex justify-center ${
          showDeviceName && deviceNamePosition === 'top' ? 'items-start' :
          showDeviceName && deviceNamePosition === 'bottom' ? 'items-end' : 'items-center'
        }`}>
          <div className={`relative w-full h-full flex justify-center ${
            showDeviceName && deviceNamePosition === 'top' ? 'items-start' :
            showDeviceName && deviceNamePosition === 'bottom' ? 'items-end' : 'items-center'
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
                {/* NIC indicators overlay */}
                <div className="absolute inset-0">
                  {template.nics.map((nic) => {
                    const status = nicStatuses.get(nic.id);
                    return (
                      <NicIndicator
                        key={nic.id}
                        nic={nic}
                        status={status}
                        style={indicatorStyle}
                        size={indicatorSize}
                        onHover={(e) => handleNicHover(nic, e)}
                        onLeave={() => handleNicHover(null)}
                      />
                    );
                  })}
                  {/* NIC labels overlay */}
                  {showNicLabels && template.nics.map((nic) => (
                    <div
                      key={`label-${nic.id}`}
                      className="absolute text-[8px] text-white/80 pointer-events-none whitespace-nowrap"
                      style={{
                        left: `${nic.x}%`,
                        top: `${nic.y + 8}%`,
                        transform: 'translateX(-50%)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      }}
                    >
                      {nic.label}
                    </div>
                  ))}
                  {/* Device name overlay from template */}
                  {template.deviceNameDisplay?.show && displayName && (
                    <div
                      className="absolute pointer-events-none whitespace-nowrap"
                      style={{
                        left: `${template.deviceNameDisplay.x}%`,
                        top: `${template.deviceNameDisplay.y}%`,
                        transform: template.deviceNameDisplay.textAlign === 'center'
                          ? 'translate(-50%, -50%)'
                          : template.deviceNameDisplay.textAlign === 'right'
                            ? 'translate(-100%, -50%)'
                            : 'translate(0, -50%)',
                        color: template.deviceNameDisplay.color,
                        fontSize: `${template.deviceNameDisplay.fontSize}px`,
                        fontWeight: template.deviceNameDisplay.fontWeight,
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}
                    >
                      {rHost(displayName)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Generic device placeholder (no image)
              <div
                className="relative w-full max-h-full bg-gray-800 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                style={{ aspectRatio: template.aspectRatio }}
              >
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  {rHost(displayName)}
                </div>
                {template.nics.map((nic) => {
                  const status = nicStatuses.get(nic.id);
                  return (
                    <NicIndicator
                      key={nic.id}
                      nic={nic}
                      status={status}
                      style={indicatorStyle}
                      size={indicatorSize}
                      onHover={(e) => handleNicHover(nic, e)}
                      onLeave={() => handleNicHover(null)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Device name - bottom position */}
        {showDeviceName && deviceNamePosition === 'bottom' && displayName && (
          <div
            className={`flex-shrink-0 text-gray-200 truncate leading-tight ${
              deviceNameAlign === 'center' ? 'text-center' :
              deviceNameAlign === 'right' ? 'text-right' : 'text-left'
            }`}
            style={{ fontSize: `${deviceNameFontSize}px` }}
          >
            {rHost(displayName)}
          </div>
        )}

        {/* Legend - fixed at bottom */}
        {showLegend && (
          <div className="flex-shrink-0 pt-2">
            <DeviceLegend summary={summary} />
          </div>
        )}

        {/* Tooltip */}
        {hoveredNic && tooltipPosition && (
          <NicTooltip
            nic={hoveredNic}
            deviceName={displayName}
            position={tooltipPosition}
            switchMapping={hoveredNicMapping}
          />
        )}
      </div>
    </BaseWidget>
  );
}
