import React from 'react';

interface DeviceLegendProps {
  summary: {
    total: number;
    connected: number;
    disconnected: number;
    management: number;
  };
}

export function DeviceLegend({ summary }: DeviceLegendProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      {/* Connected NICs */}
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span>Connected: {summary.connected}</span>
      </div>

      {/* Disconnected NICs */}
      {summary.disconnected > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-500/50" />
          <span>Disconnected: {summary.disconnected}</span>
        </div>
      )}

      {/* Management ports */}
      {summary.management > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Management: {summary.management}</span>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <span>Total: {summary.total}</span>
      </div>
    </div>
  );
}
