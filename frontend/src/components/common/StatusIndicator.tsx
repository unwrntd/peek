import React from 'react';

type StatusType = 'online' | 'offline' | 'warning' | 'unknown' | 'running' | 'stopped' | 'paused';

interface StatusIndicatorProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  running: 'bg-green-500',
  ok: 'bg-green-500',
  offline: 'bg-red-500',
  stopped: 'bg-red-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  paused: 'bg-yellow-500',
  unknown: 'bg-gray-400',
};

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function StatusIndicator({ status, label, size = 'md' }: StatusIndicatorProps) {
  const colorClass = statusColors[status.toLowerCase()] || statusColors.unknown;
  const sizeClass = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      <span className={`${sizeClass} ${colorClass} rounded-full inline-block`} />
      {label && <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>}
    </div>
  );
}
