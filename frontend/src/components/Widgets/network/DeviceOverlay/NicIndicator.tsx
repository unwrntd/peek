import React from 'react';
import { NicDefinition } from './templates';

export interface NicStatus {
  id: string;
  connected: boolean;
  speed?: number;
  hasSwitchMapping?: boolean;
}

interface NicIndicatorProps {
  nic: NicDefinition;
  status?: NicStatus;
  style: string;
  size: string;
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

// Get status color based on NIC status
function getStatusColor(
  nic: NicDefinition,
  status: NicStatus | undefined
): { bg: string; glow?: string; border?: string } {
  // IPMI/Management ports get a distinct color
  if (nic.type === 'mgmt' || nic.type === 'ipmi') {
    if (status?.connected) {
      return {
        bg: 'bg-amber-500',
        glow: 'shadow-amber-500/50',
        border: 'border-amber-600',
      };
    }
    return { bg: 'bg-amber-400/50', border: 'border-amber-500' };
  }

  // High-speed ports (SFP, SFP+, QSFP, 10GBase-T)
  const isHighSpeed = ['sfp', 'sfp+', 'qsfp', '10gbase-t'].includes(nic.type) ||
    (nic.speed && nic.speed >= 10000);

  if (!status?.connected) {
    return { bg: 'bg-gray-500/50', border: 'border-gray-400' };
  }

  if (isHighSpeed) {
    return {
      bg: 'bg-blue-500',
      glow: 'shadow-blue-500/50',
      border: 'border-blue-600',
    };
  }

  // Default connected
  return {
    bg: 'bg-green-500',
    glow: 'shadow-green-500/50',
    border: 'border-green-600',
  };
}

export function NicIndicator({
  nic,
  status,
  style,
  size,
  onHover,
  onLeave,
}: NicIndicatorProps) {
  // Guard against invalid NIC data
  if (!nic || typeof nic.x !== 'number' || typeof nic.y !== 'number') {
    return null;
  }

  const pixelSize = getSize(size);
  const colors = getStatusColor(nic, status);
  const isConnected = status?.connected ?? false;
  const isSfp = ['sfp', 'sfp+', 'qsfp'].includes(nic.type || '');

  // Base classes for all styles
  const baseClasses = `absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-150 hover:scale-125`;

  // Safe hover handler
  const safeHover = (e: React.MouseEvent) => {
    try {
      onHover(e);
    } catch (err) {
      console.warn('NicIndicator hover error:', err);
    }
  };

  // Safe leave handler
  const safeLeave = () => {
    try {
      onLeave();
    } catch (err) {
      console.warn('NicIndicator leave error:', err);
    }
  };

  // Switch mapping indicator - purple dot shows NIC has switch connection
  const SwitchMappingIndicator = () => {
    if (status?.hasSwitchMapping) {
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
            className={`${baseClasses} rounded-full ${colors.bg} ${isConnected ? `shadow-md ${colors.glow}` : ''} flex items-center justify-center`}
            style={{
              width: pixelSize,
              height: pixelSize,
              left: `${nic.x}%`,
              top: `${nic.y}%`,
            }}
            onMouseEnter={safeHover}
            onMouseLeave={safeLeave}
          >
            {isConnected && (
              <div
                className="absolute rounded-full bg-white/30"
                style={{
                  width: pixelSize * 0.4,
                  height: pixelSize * 0.4,
                }}
              />
            )}
            <SwitchMappingIndicator />
          </div>
        );

      case 'square':
        return (
          <div
            className={`${baseClasses} ${isSfp ? 'rounded-sm' : 'rounded-none'} ${colors.bg} ${isConnected ? `shadow-md ${colors.glow}` : ''} flex items-center justify-center`}
            style={{
              width: isSfp ? pixelSize * 1.5 : pixelSize,
              height: isSfp ? pixelSize * 0.8 : pixelSize,
              left: `${nic.x}%`,
              top: `${nic.y}%`,
            }}
            onMouseEnter={safeHover}
            onMouseLeave={safeLeave}
          >
            <SwitchMappingIndicator />
          </div>
        );

      case 'outline':
        return (
          <div
            className={`${baseClasses} rounded-full border-2 ${colors.border} ${isConnected ? colors.bg : 'bg-transparent'} flex items-center justify-center`}
            style={{
              width: pixelSize,
              height: pixelSize,
              left: `${nic.x}%`,
              top: `${nic.y}%`,
            }}
            onMouseEnter={safeHover}
            onMouseLeave={safeLeave}
          >
            <SwitchMappingIndicator />
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
              left: `${nic.x}%`,
              top: `${nic.y}%`,
            }}
            onMouseEnter={safeHover}
            onMouseLeave={safeLeave}
          >
            <SwitchMappingIndicator />
          </div>
        );
    }
  };

  return renderIndicator();
}
