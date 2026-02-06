// Widget scaling utilities for responsive content sizing

export interface ScaleFactors {
  textScale: number;      // Multiplier for text sizes
  iconScale: number;      // Multiplier for icon sizes
  spacingScale: number;   // Multiplier for padding/margins
  gaugeScale: number;     // Multiplier for gauge/chart dimensions
}

// Reference widget size (3x2 is a common "medium" widget)
const BASE_UNIT = { w: 3, h: 2 };
// Reference pixel dimensions for base sizing
const BASE_PIXELS = { w: 300, h: 200 };

/**
 * Calculate scale factors based on widget grid dimensions
 */
export function calculateScaleFactors(gridWidth: number, gridHeight: number): ScaleFactors {
  const widthRatio = gridWidth / BASE_UNIT.w;
  const heightRatio = gridHeight / BASE_UNIT.h;
  const avgRatio = (widthRatio + heightRatio) / 2;

  return {
    textScale: Math.min(Math.max(avgRatio, 0.75), 3.0),
    iconScale: Math.min(Math.max(avgRatio, 0.75), 2.5),
    spacingScale: Math.min(Math.max(avgRatio, 0.8), 2.0),
    gaugeScale: Math.min(Math.max(avgRatio, 0.5), 3.5),
  };
}

/**
 * Calculate scale factors based on pixel dimensions
 * This provides more accurate scaling for filling available space
 */
export function calculatePixelScaleFactors(pixelWidth: number, pixelHeight: number): ScaleFactors {
  const widthRatio = pixelWidth / BASE_PIXELS.w;
  const heightRatio = pixelHeight / BASE_PIXELS.h;
  // Use the smaller ratio to ensure content fits
  const minRatio = Math.min(widthRatio, heightRatio);

  return {
    textScale: Math.min(Math.max(minRatio, 0.5), 4.0),
    iconScale: Math.min(Math.max(minRatio, 0.5), 3.0),
    spacingScale: Math.min(Math.max(minRatio, 0.6), 2.5),
    gaugeScale: Math.min(Math.max(minRatio, 0.5), 4.0),
  };
}

/**
 * Get Tailwind text size class based on scale
 */
export function getScaledTextClass(
  baseSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl',
  scale: number
): string {
  const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];
  const baseIndex = sizes.indexOf(baseSize);

  // Calculate new index based on scale
  let newIndex: number;
  if (scale <= 0.75) {
    newIndex = Math.max(0, baseIndex - 2);
  } else if (scale <= 0.9) {
    newIndex = Math.max(0, baseIndex - 1);
  } else if (scale >= 2) {
    newIndex = Math.min(sizes.length - 1, baseIndex + 3);
  } else if (scale >= 1.5) {
    newIndex = Math.min(sizes.length - 1, baseIndex + 2);
  } else if (scale >= 1.25) {
    newIndex = Math.min(sizes.length - 1, baseIndex + 1);
  } else {
    newIndex = baseIndex;
  }

  return `text-${sizes[newIndex]}`;
}

/**
 * Get pixel size for icons based on scale
 */
export function getScaledIconSize(baseSize: number, scale: number): number {
  return Math.round(baseSize * scale);
}

/**
 * Get scaled padding/margin value
 */
export function getScaledSpacing(baseSpacing: number, scale: number): number {
  return Math.round(baseSpacing * scale);
}

/**
 * Content scale options for user selection
 */
export const CONTENT_SCALE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '0.75', label: 'Small (75%)' },
  { value: '1', label: 'Normal (100%)' },
  { value: '1.25', label: 'Large (125%)' },
  { value: '1.5', label: 'X-Large (150%)' },
  { value: '2', label: 'XX-Large (200%)' },
];

/**
 * Calculate final scale considering user preference and auto-scaling
 */
export function getFinalScale(
  userScale: string | undefined,
  autoScale: number
): number {
  if (!userScale || userScale === 'auto') {
    return autoScale;
  }
  return parseFloat(userScale);
}
