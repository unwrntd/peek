import React from 'react';

interface ResizeOverlayProps {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  position: { x: number; y: number };
}

export function ResizeOverlay({ width, height, minWidth = 1, minHeight = 1, position }: ResizeOverlayProps) {
  const isAtMinWidth = width <= minWidth;
  const isAtMinHeight = height <= minHeight;
  const isAtMin = isAtMinWidth || isAtMinHeight;
  const isBelowRecommended = width < minWidth || height < minHeight;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-8px)',
      }}
    >
      <div
        className={`px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          isBelowRecommended
            ? 'bg-red-600 text-white'
            : isAtMin
            ? 'bg-yellow-500 text-yellow-900'
            : 'bg-gray-900 text-white'
        }`}
      >
        {/* Dimensions */}
        <span className="font-mono">
          {width} × {height}
        </span>

        {/* Warning indicator */}
        {isBelowRecommended && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs">Content may be cut off</span>
          </span>
        )}
        {isAtMin && !isBelowRecommended && (
          <span className="text-xs opacity-80">Min size</span>
        )}
      </div>

      {/* Recommended size hint */}
      {isBelowRecommended && (
        <div className="mt-1 text-xs text-center text-gray-400 bg-gray-800/90 px-2 py-0.5 rounded">
          Recommended: {minWidth} × {minHeight}+
        </div>
      )}
    </div>
  );
}
