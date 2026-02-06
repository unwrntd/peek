import React, { useState, useEffect, useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useBrandingStore } from '../../../stores/brandingStore';
import { SunIcon, MoonIcon } from '../../../utils/icons';

interface TimeZoneEntry {
  id: string;
  label?: string;
}

interface WorldTimeConfig {
  timeZones?: TimeZoneEntry[];
  timeZonesText?: string; // comma-separated timezone IDs
  use24Hour?: boolean;
  showSeconds?: boolean;
  showDate?: boolean;
  showTimeZoneOffset?: boolean;
  layout?: 'grid' | 'list' | 'auto';
}

interface WorldTimeWidgetProps {
  title: string;
  config: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
  isEditMode?: boolean;
  widgetId?: string;
}

const POPULAR_TIMEZONES = [
  { id: 'America/New_York', label: 'New York' },
  { id: 'America/Los_Angeles', label: 'Los Angeles' },
  { id: 'America/Chicago', label: 'Chicago' },
  { id: 'America/Denver', label: 'Denver' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Paris', label: 'Paris' },
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Asia/Shanghai', label: 'Shanghai' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Asia/Jerusalem', label: 'Jerusalem' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Kolkata', label: 'Mumbai' },
  { id: 'Australia/Sydney', label: 'Sydney' },
  { id: 'Pacific/Auckland', label: 'Auckland' },
  { id: 'UTC', label: 'UTC' },
];

const DEFAULT_TIMEZONES: TimeZoneEntry[] = [
  { id: 'America/New_York', label: 'New York' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
];

function getTimeInZone(timeZone: string, use24Hour: boolean, showSeconds: boolean): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: !use24Hour,
    }).format(new Date());
  } catch {
    return '--:--';
  }
}

function getDateInZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  } catch {
    return '';
  }
}

function getUtcOffset(timeZone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    return offsetPart?.value || '';
  } catch {
    return '';
  }
}

function isDaytime(timeZone: string): boolean {
  try {
    const hour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        hour12: false,
      }).format(new Date())
    );
    return hour >= 6 && hour < 18;
  } catch {
    return true;
  }
}

export function WorldTimeWidget({ config }: WorldTimeWidgetProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const iconStyle = useBrandingStore((state) => state.branding.iconStyle);

  const worldTimeConfig = config as WorldTimeConfig;

  // Parse time zones from either array or comma-separated text
  const timeZones = useMemo(() => {
    if (worldTimeConfig.timeZones?.length) {
      return worldTimeConfig.timeZones;
    }
    if (worldTimeConfig.timeZonesText) {
      return worldTimeConfig.timeZonesText
        .split(',')
        .map(tz => tz.trim())
        .filter(tz => tz.length > 0)
        .map(tz => {
          const preset = POPULAR_TIMEZONES.find(p => p.id === tz);
          return { id: tz, label: preset?.label };
        });
    }
    return DEFAULT_TIMEZONES;
  }, [worldTimeConfig.timeZones, worldTimeConfig.timeZonesText]);
  const use24Hour = worldTimeConfig.use24Hour ?? false;
  const showSeconds = worldTimeConfig.showSeconds ?? false;
  const showDate = worldTimeConfig.showDate ?? false;
  const showTimeZoneOffset = worldTimeConfig.showTimeZoneOffset ?? true;
  // Check both visualization (from style selector) and layout (from filter)
  const layout = (worldTimeConfig as Record<string, unknown>).visualization as string || worldTimeConfig.layout || 'auto';

  // Update time every second if showing seconds, otherwise every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, showSeconds ? 1000 : 60000);

    return () => clearInterval(interval);
  }, [showSeconds]);

  // Determine layout based on number of zones
  const effectiveLayout = useMemo(() => {
    if (layout !== 'auto') return layout;
    return timeZones.length <= 3 ? 'list' : 'grid';
  }, [layout, timeZones.length]);

  const gridCols = useMemo(() => {
    if (effectiveLayout === 'list') return 1;
    if (timeZones.length <= 2) return 2;
    if (timeZones.length <= 4) return 2;
    return 3;
  }, [effectiveLayout, timeZones.length]);

  return (
    <BaseWidget loading={false} error={null}>
      <div className={`h-full ${effectiveLayout === 'grid' ? `grid gap-3` : 'space-y-2'}`}
        style={effectiveLayout === 'grid' ? { gridTemplateColumns: `repeat(${gridCols}, 1fr)` } : undefined}
      >
        {timeZones.map((tz) => {
          const label = tz.label || POPULAR_TIMEZONES.find(p => p.id === tz.id)?.label || tz.id.split('/').pop()?.replace(/_/g, ' ');
          const time = getTimeInZone(tz.id, use24Hour, showSeconds);
          const date = showDate ? getDateInZone(tz.id) : null;
          const offset = showTimeZoneOffset ? getUtcOffset(tz.id) : null;
          const isDay = isDaytime(tz.id);

          if (effectiveLayout === 'list') {
            return (
              <div
                key={tz.id}
                className="flex items-center justify-between py-1.5 px-2 rounded-md bg-gray-50 dark:bg-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base text-gray-600 dark:text-gray-300">
                    {iconStyle === 'none' ? null : iconStyle === 'simple' ? (
                      isDay ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />
                    ) : (
                      isDay ? '☀️' : '🌙'
                    )}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {date && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {date}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {time}
                  </span>
                  {offset && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-14 text-right">
                      {offset}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // Grid layout
          return (
            <div
              key={tz.id}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {iconStyle === 'none' ? null : iconStyle === 'simple' ? (
                    isDay ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />
                  ) : (
                    isDay ? '☀️' : '🌙'
                  )}
                </span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate max-w-[80px]">
                  {label}
                </span>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {time}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {date && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {date}
                  </span>
                )}
                {offset && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {offset}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </BaseWidget>
  );
}

// Export timezone list for use in configuration
export { POPULAR_TIMEZONES };
