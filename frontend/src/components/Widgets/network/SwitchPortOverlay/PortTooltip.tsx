import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PortStatus } from './SwitchPortOverlay';
import { PortMapping } from '../../../../stores/connectionStore';
import { useRedact } from '../../../../hooks/useRedact';

export interface PortConnectionInfo {
  remoteWidgetId: string;
  remoteWidgetName: string;
  remotePort: number;
  remotePortName?: string;
  label?: string;
}

export interface PortMappingInfo {
  hostname: string;
  description?: string;
  deviceType?: PortMapping['deviceType'];
  ipAddress?: string;
}

interface PortTooltipProps {
  port: PortStatus;
  position: { x: number; y: number };
  connection?: PortConnectionInfo | null;
  mapping?: PortMappingInfo | null;
}

const DEVICE_TYPE_ICONS: Record<string, string> = {
  server: '🖥️',
  ap: '📡',
  camera: '📷',
  printer: '🖨️',
  workstation: '💻',
  iot: '🔌',
  phone: '📞',
  nas: '💾',
  router: '🌐',
  other: '📦',
};

// Error boundary to catch rendering errors in the tooltip
interface ErrorBoundaryState {
  hasError: boolean;
}

class TooltipErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('PortTooltip error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Just don't render the tooltip if there's an error
    }
    return this.props.children;
  }
}

// Safe portal wrapper to avoid SSR and mounting issues
function SafePortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  try {
    return createPortal(children, document.body);
  } catch (err) {
    console.warn('SafePortal error:', err);
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0 || !isFinite(bytes)) return '0 B';
  try {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0 || i >= sizes.length) return '0 B';
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  } catch {
    return '0 B';
  }
}

function formatSpeed(speed: number): string {
  if (!speed || !isFinite(speed)) return '?';
  if (speed >= 10000) return '10G';
  if (speed >= 2500) return '2.5G';
  if (speed >= 1000) return '1G';
  if (speed >= 100) return '100M';
  if (speed >= 10) return '10M';
  return `${speed}M`;
}

export function PortTooltip({ port, position, connection, mapping }: PortTooltipProps) {
  const { rSwitch, rHost, rIP } = useRedact();

  // Guard against malformed port data
  if (!port || !position) {
    return null;
  }

  // Calculate position to keep tooltip on screen
  // Use wider tooltip for long port names (e.g., Cisco GigabitEthernet1/0/1)
  const portName = port.name || `Port ${port.number}`;
  const hasLongName = portName.length > 15;
  const tooltipWidth = hasLongName ? 280 : 200;
  const tooltipHeight = 180;
  const padding = 10;

  let x = position.x + padding;
  let y = position.y + padding;

  // Adjust if tooltip would go off right edge
  if (x + tooltipWidth > window.innerWidth - padding) {
    x = position.x - tooltipWidth - padding;
  }

  // Adjust if tooltip would go off bottom edge
  if (y + tooltipHeight > window.innerHeight - padding) {
    y = position.y - tooltipHeight - padding;
  }

  const tooltip = (
    <div
      className="fixed z-[100] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 pointer-events-none"
      style={{
        left: x,
        top: y,
        minWidth: 200,
        maxWidth: 320,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-gray-900 dark:text-white break-all leading-tight">
          {portName}
        </span>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${
            port.linkUp
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : port.enabled
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}
        >
          {port.linkUp ? 'Up' : port.enabled ? 'Down' : 'Disabled'}
        </span>
      </div>

      {/* Details */}
      <div className="mt-2 space-y-1.5 text-sm">
        {/* Speed & Duplex */}
        {port.linkUp && port.speed !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Speed</span>
            <span className="text-gray-900 dark:text-white">
              {formatSpeed(port.speed)} {port.duplex === 'full' ? 'FDX' : 'HDX'}
            </span>
          </div>
        )}

        {/* PoE */}
        {port.poe && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">PoE</span>
            <span className={port.poe.delivering ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}>
              {port.poe.delivering
                ? `${typeof port.poe.powerWatts === 'number' ? port.poe.powerWatts.toFixed(1) : (parseFloat(String(port.poe.powerWatts)) || 0).toFixed(1)}W`
                : port.poe.enabled
                ? 'Ready'
                : 'Off'}
            </span>
          </div>
        )}

        {/* Media type */}
        {port.media && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Media</span>
            <span className="text-gray-900 dark:text-white">{port.media}</span>
          </div>
        )}

        {/* Traffic */}
        {port.linkUp && (port.rxBytes !== undefined || port.txBytes !== undefined) && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 mt-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">RX</span>
              <span className="text-gray-600 dark:text-gray-400">
                {formatBytes(port.rxBytes || 0)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">TX</span>
              <span className="text-gray-600 dark:text-gray-400">
                {formatBytes(port.txBytes || 0)}
              </span>
            </div>
          </div>
        )}

        {/* Uplink indicator */}
        {port.isUplink && (
          <div className="pt-1">
            <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Uplink Port
            </span>
          </div>
        )}

        {/* Connection info */}
        {connection && (
          <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="font-medium">Connected to:</span>
            </div>
            <div className="mt-1 ml-5 text-sm">
              <div className="text-gray-900 dark:text-white font-medium">
                {rSwitch(connection.remoteWidgetName)}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                {connection.remotePortName || `Port ${connection.remotePort}`}
              </div>
              {connection.label && (
                <div className="text-gray-500 dark:text-gray-400 text-xs italic mt-0.5">
                  {connection.label}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Device mapping info (only show if no connection) */}
        {!connection && mapping && (
          <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
              <span className="text-base">{DEVICE_TYPE_ICONS[mapping.deviceType || 'other']}</span>
              <span className="font-medium">Connected Device:</span>
            </div>
            <div className="mt-1 ml-6 text-sm">
              <div className="text-gray-900 dark:text-white font-medium">
                {rHost(mapping.hostname)}
              </div>
              {mapping.description && (
                <div className="text-gray-500 dark:text-gray-400 text-xs">
                  {mapping.description}
                </div>
              )}
              {mapping.ipAddress && (
                <div className="text-gray-500 dark:text-gray-400 text-xs font-mono mt-0.5">
                  {rIP(mapping.ipAddress)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipErrorBoundary>
      <SafePortal>{tooltip}</SafePortal>
    </TooltipErrorBoundary>
  );
}
