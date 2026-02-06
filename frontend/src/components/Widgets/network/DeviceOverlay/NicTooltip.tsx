import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NicDefinition } from './templates';
import { useRedact } from '../../../../hooks/useRedact';

export interface NicSwitchMappingInfo {
  switchWidgetId: string;
  switchWidgetName: string;
  switchPort: number;
  switchPortName?: string;
  label?: string;
  vlan?: string;
}

interface NicTooltipProps {
  nic: NicDefinition;
  deviceName?: string;
  position: { x: number; y: number };
  switchMapping?: NicSwitchMappingInfo | null;
}

const NIC_TYPE_LABELS: Record<string, string> = {
  rj45: 'RJ45',
  sfp: 'SFP',
  'sfp+': 'SFP+',
  qsfp: 'QSFP',
  '10gbase-t': '10GBase-T',
  mgmt: 'Management',
  ipmi: 'IPMI/iLO/iDRAC',
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
    console.warn('NicTooltip error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
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

function formatSpeed(speed: number | undefined): string {
  if (!speed || !isFinite(speed)) return '?';
  if (speed >= 100000) return '100G';
  if (speed >= 40000) return '40G';
  if (speed >= 25000) return '25G';
  if (speed >= 10000) return '10G';
  if (speed >= 2500) return '2.5G';
  if (speed >= 1000) return '1G';
  if (speed >= 100) return '100M';
  return `${speed}M`;
}

export function NicTooltip({ nic, deviceName, position, switchMapping }: NicTooltipProps) {
  const { rSwitch } = useRedact();

  // Guard against malformed data
  if (!nic || !position) {
    return null;
  }

  // Calculate position to keep tooltip on screen
  const tooltipWidth = 240;
  const tooltipHeight = 160;
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
        maxWidth: 280,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-gray-900 dark:text-white break-all leading-tight">
          {nic.label || nic.id}
        </span>
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          {NIC_TYPE_LABELS[nic.type] || nic.type.toUpperCase()}
        </span>
      </div>

      {/* Details */}
      <div className="mt-2 space-y-1.5 text-sm">
        {/* NIC ID */}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Interface</span>
          <span className="text-gray-900 dark:text-white font-mono text-xs">
            {nic.id}
          </span>
        </div>

        {/* Max Speed */}
        {nic.speed && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Max Speed</span>
            <span className="text-gray-900 dark:text-white">
              {formatSpeed(nic.speed)}
            </span>
          </div>
        )}

        {/* Switch connection info */}
        {switchMapping && (
          <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="font-medium">Connected to Switch:</span>
            </div>
            <div className="mt-1 ml-5 text-sm">
              <div className="text-gray-900 dark:text-white font-medium">
                {rSwitch(switchMapping.switchWidgetName)}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                {switchMapping.switchPortName || `Port ${switchMapping.switchPort}`}
              </div>
              {switchMapping.vlan && (
                <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                  VLAN: {switchMapping.vlan}
                </div>
              )}
              {switchMapping.label && (
                <div className="text-gray-500 dark:text-gray-400 text-xs italic mt-0.5">
                  {switchMapping.label}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No mapping message */}
        {!switchMapping && (
          <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">
              No switch connection configured
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
