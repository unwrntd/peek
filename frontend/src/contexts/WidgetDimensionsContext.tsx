import React, { createContext, useContext } from 'react';
import { ScaleFactors } from '../utils/widgetScaling';

export interface WidgetDimensions {
  gridWidth: number;      // Grid units (w)
  gridHeight: number;     // Grid units (h)
  pixelWidth: number;     // Actual pixels
  pixelHeight: number;    // Actual pixels
  scaleFactors: ScaleFactors;
  contentScale: string;   // User-selected scale ('auto', '0.75', '1', etc.)
}

export const WidgetDimensionsContext = createContext<WidgetDimensions | null>(null);

/**
 * Hook to access widget dimensions and scale factors
 */
export function useWidgetDimensions(): WidgetDimensions | null {
  return useContext(WidgetDimensionsContext);
}

/**
 * Hook to get the effective scale factor (considering user preference)
 */
export function useEffectiveScale(): number {
  const dims = useContext(WidgetDimensionsContext);
  if (!dims) return 1;

  if (!dims.contentScale || dims.contentScale === 'auto') {
    return dims.scaleFactors.textScale;
  }
  return parseFloat(dims.contentScale);
}

interface WidgetDimensionsProviderProps {
  children: React.ReactNode;
  dimensions: WidgetDimensions;
}

export function WidgetDimensionsProvider({ children, dimensions }: WidgetDimensionsProviderProps) {
  return (
    <WidgetDimensionsContext.Provider value={dimensions}>
      {children}
    </WidgetDimensionsContext.Provider>
  );
}
