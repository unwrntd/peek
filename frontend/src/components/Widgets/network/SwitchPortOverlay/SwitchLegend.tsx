import React from 'react';

interface SwitchLegendProps {
  summary: {
    total: number;
    up: number;
    down: number;
    disabled: number;
    poeActive: number;
  };
  showPoe: boolean;
}

export function SwitchLegend({ summary, showPoe }: SwitchLegendProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-2">
      {/* Connected */}
      <div className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
        <span>Up: {summary.up}</span>
      </div>

      {/* Down */}
      <div className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
        <span>Down: {summary.down}</span>
      </div>

      {/* Disabled */}
      {summary.disabled > 0 && (
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
          <span>Disabled: {summary.disabled}</span>
        </div>
      )}

      {/* PoE Active */}
      {showPoe && (
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-1.5 h-1.5 text-white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
          <span>PoE: {summary.poeActive}</span>
        </div>
      )}
    </div>
  );
}
