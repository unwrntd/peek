import { create } from 'zustand';
import { BrandingSettings } from '../types';
import { settingsApi } from '../api/client';

interface BrandingState {
  branding: BrandingSettings;
  loading: boolean;
  error: string | null;
  fetchBranding: () => Promise<void>;
  updateBranding: (data: Partial<BrandingSettings>) => Promise<void>;
}

const defaultBranding: BrandingSettings = {
  siteName: 'Peek',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#6366f1',
  accentColor: '#8b5cf6',
  hideNavTitle: true,
  iconStyle: 'emoji',
};

export const useBrandingStore = create<BrandingState>((set, get) => ({
  branding: defaultBranding,
  loading: false,
  error: null,

  fetchBranding: async () => {
    set({ loading: true, error: null });
    try {
      const branding = await settingsApi.getBranding();
      set({ branding, loading: false });

      // Apply branding to document
      applyBranding(branding);
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  updateBranding: async (data) => {
    set({ loading: true, error: null });
    try {
      const branding = await settingsApi.updateBranding(data);
      set({ branding, loading: false });

      // Apply branding to document
      applyBranding(branding);
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },
}));

// Helper function to apply branding to the document
function applyBranding(branding: BrandingSettings) {
  // Update document title
  document.title = branding.siteName || 'Peek';

  // Update favicon
  if (branding.faviconUrl) {
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = branding.faviconUrl;
  }

  // Apply custom colors to CSS variables
  const root = document.documentElement;
  if (branding.primaryColor) {
    // Convert hex to RGB for CSS variable usage
    const primaryRgb = hexToRgb(branding.primaryColor);
    if (primaryRgb) {
      root.style.setProperty('--color-primary-500', branding.primaryColor);
      root.style.setProperty('--color-primary-600', darkenColor(branding.primaryColor, 10));
      root.style.setProperty('--color-primary-700', darkenColor(branding.primaryColor, 20));
      root.style.setProperty('--color-primary-400', lightenColor(branding.primaryColor, 10));
      root.style.setProperty('--color-primary-300', lightenColor(branding.primaryColor, 20));
    }
  }
}

// Helper functions for color manipulation
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - percent / 100;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = percent / 100;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}
