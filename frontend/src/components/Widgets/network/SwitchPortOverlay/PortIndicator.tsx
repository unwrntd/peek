import React from 'react';
import { PortDefinition } from './templates';
import { PortStatus } from './SwitchPortOverlay';

interface PortIndicatorProps {
  port: PortDefinition;
  status?: PortStatus;
  style: string;
  size: string;
  highlightPoe: boolean;
  highlightSpeed: boolean;
  hasConnection?: boolean;
  hasMapping?: boolean;
  onHover: (e: React.MouseEvent) => void;
  onLeave: () => void;
}

// Get indicator size in pixels
function getSize(size: string): number {
  switch (size) {
    case 'small': return 8;
    case 'large': return 16;
    case 'medium':
    default: return 12;
  }
}

// Get status color
function getStatusColor(
  status: PortStatus | undefined,
  highlightPoe: boolean,
  highlightSpeed: boolean
): { bg: string; glow?: string; border?: string; isPoe?: boolean } {
  if (!status) {
    return { bg: 'bg-gray-600', border: 'border-gray-400' };
  }

  if (!status.enabled) {
    // Disabled port - dark with subtle border
    return { bg: 'bg-gray-700', border: 'border-gray-500' };
  }

  if (!status.linkUp) {
    // Offline/down port - visible red-ish color
    return { bg: 'bg-red-400/70', border: 'border-red-500' };
  }

  // Link is up - determine color based on status
  if (status.poe?.delivering && highlightPoe) {
    return {
      bg: 'bg-green-500',
      glow: 'shadow-green-500/50',
      border: 'border-green-600',
      isPoe: true,
    };
  }

  if (highlightSpeed && status.speed && status.speed >= 1000) {
    return {
      bg: 'bg-blue-500',
      glow: 'shadow-blue-500/50',
      border: 'border-blue-600',
    };
  }

  // Check for SFP/fiber
  if (status.media?.toLowerCase().includes('sfp') || ['sfp', 'sfp+', 'qsfp'].includes(status.media?.toLowerCase() || '')) {
    return {
      bg: 'bg-purple-500',
      glow: 'shadow-purple-500/50',
      border: 'border-purple-600',
    };
  }

  // Default connected
  return {
    bg: 'bg-green-500',
    glow: 'shadow-green-500/50',
    border: 'border-green-600',
  };
}

export function PortIndicator({
  port,
  status,
  style,
  size,
  highlightPoe,
  highlightSpeed,
  hasConnection,
  hasMapping,
  onHover,
  onLeave,
}: PortIndicatorProps) {
  // Guard against invalid port data
  if (!port || typeof port.x !== 'number' || typeof port.y !== 'number') {
    return null;
  }

  const pixelSize = getSize(size);
  const colors = getStatusColor(status, highlightPoe, highlightSpeed);
  const isUp = status?.linkUp ?? false;
  const isSfp = ['sfp', 'sfp+', 'qsfp', 'combo'].includes(port.type || '');

  // Base classes for all styles
  const baseClasses = `absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-150 hover:scale-125`;

  // Safe hover handler
  const safeHover = (e: React.MouseEvent) => {
    try {
      onHover(e);
    } catch (err) {
      console.warn('PortIndicator hover error:', err);
    }
  };

  // Safe leave handler
  const safeLeave = () => {
    try {
      onLeave();
    } catch (err) {
      console.warn('PortIndicator leave error:', err);
    }
  };

  // Lightning bolt icon for PoE
  const LightningBolt = ({ size }: { size: number }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-white drop-shadow-sm"
      style={{ width: size * 0.7, height: size * 0.7 }}
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );

  // Connection indicator - small cyan dot for connections, purple dot for mappings
  const ConnectionIndicator = () => {
    if (hasConnection) {
      return (
        <div
          className="absolute bg-cyan-400 rounded-full border border-cyan-300 shadow-sm"
          style={{
            width: Math.max(5, pixelSize * 0.46),
            height: Math.max(5, pixelSize * 0.46),
            top: -2,
            right: -2,
          }}
        />
      );
    }
    if (hasMapping) {
      return (
        <div
          className="absolute bg-purple-500 rounded-full border border-purple-400 shadow-sm"
          style={{
            width: Math.max(5, pixelSize * 0.46),
            height: Math.max(5, pixelSize * 0.46),
            top: -2,
            right: -2,
          }}
        />
      );
    }
    return null;
  };

  // Style-specific rendering
  const renderIndicator = () => {
    switch (style) {
      case 'led':
        return (
          <div
            className={`${baseClasses} rounded-full ${colors.bg} ${isUp ? `shadow-md ${colors.glow}` : ''} flex items-center justify-center`}
            style={{
              width: pixelSize,
              height: pixelSize,
              left: `${port.x}%`,
              top: `${port.y}%`,
            }}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
          >
            {/* Lightning bolt for PoE delivering */}
            {colors.isPoe ? (
              <LightningBolt size={pixelSize} />
            ) : isUp && (
              /* Inner glow for LED effect */
              <div
                className="absolute rounded-full bg-white/30"
                style={{
                  width: pixelSize * 0.4,
                  height: pixelSize * 0.4,
                }}
              />
            )}
            <ConnectionIndicator />
          </div>
        );

      case 'square':
        return (
          <div
            className={`${baseClasses} ${isSfp ? 'rounded-sm' : 'rounded-none'} ${colors.bg} ${isUp ? `shadow-md ${colors.glow}` : ''} flex items-center justify-center`}
            style={{
              width: isSfp ? pixelSize * 1.5 : pixelSize,
              height: isSfp ? pixelSize * 0.8 : pixelSize,
              left: `${port.x}%`,
              top: `${port.y}%`,
            }}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
          >
            {colors.isPoe && <LightningBolt size={pixelSize} />}
            <ConnectionIndicator />
          </div>
        );

      case 'outline':
        return (
          <div
            className={`${baseClasses} rounded-full border-2 ${colors.border} ${isUp ? colors.bg : 'bg-transparent'} flex items-center justify-center`}
            style={{
              width: pixelSize,
              height: pixelSize,
              left: `${port.x}%`,
              top: `${port.y}%`,
            }}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
          >
            {colors.isPoe && <LightningBolt size={pixelSize} />}
            <ConnectionIndicator />
          </div>
        );

      case 'dot':
      default:
        return (
          <div
            className={`${baseClasses} rounded-full ${colors.bg} flex items-center justify-center`}
            style={{
              width: pixelSize,
              height: pixelSize,
              left: `${port.x}%`,
              top: `${port.y}%`,
            }}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
          >
            {colors.isPoe && <LightningBolt size={pixelSize} />}
            <ConnectionIndicator />
          </div>
        );
    }
  };

  return renderIndicator();
}
