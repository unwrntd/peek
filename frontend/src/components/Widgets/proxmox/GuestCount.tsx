import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useWidgetDimensions } from '../../../contexts/WidgetDimensionsContext';
import { BaseWidget } from '../BaseWidget';
import { ProxmoxVM } from '../../../types';

interface GuestCountProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface GuestData {
  guests: ProxmoxVM[];
}

interface GuestItem extends ProxmoxVM {
  type: 'qemu' | 'lxc';
}

export function GuestCount({ integrationId, config, widgetId }: GuestCountProps) {
  // Get actual pixel dimensions from context (works in both dashboard and groups)
  const dimensions = useWidgetDimensions();
  // Configuration
  const showType = (config.showType as string) || 'both'; // 'vms', 'lxcs', or 'both'
  const showStopped = config.showStopped === true;

  // Fetch guests data
  const { data, loading, error } = useWidgetData<GuestData>({
    integrationId,
    metric: 'guests',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Count running/stopped guests
  const guests = (data?.guests || []) as GuestItem[];
  const vms = guests.filter(g => g.type === 'qemu');
  const containers = guests.filter(g => g.type === 'lxc');

  const runningVMs = vms.filter(v => v.status === 'running').length;
  const stoppedVMs = vms.filter(v => v.status !== 'running').length;
  const runningLXCs = containers.filter(c => c.status === 'running').length;
  const stoppedLXCs = containers.filter(c => c.status !== 'running').length;

  // Calculate totals based on showType
  let runningTotal = 0;
  let stoppedTotal = 0;

  if (showType === 'vms' || showType === 'both') {
    runningTotal += runningVMs;
    stoppedTotal += stoppedVMs;
  }
  if (showType === 'lxcs' || showType === 'both') {
    runningTotal += runningLXCs;
    stoppedTotal += stoppedLXCs;
  }

  // Determine text size based on actual pixel dimensions
  // This works correctly both on dashboard and inside groups
  const pixelWidth = dimensions?.pixelWidth || 200;
  const pixelHeight = dimensions?.pixelHeight || 150;

  // Size categories based on pixel thresholds
  // Use OR logic so if either dimension is small, we use the compact layout
  const isTiny = pixelWidth <= 100 || pixelHeight <= 80;
  const isCompact = pixelWidth <= 180 || pixelHeight <= 120;
  const isMedium = pixelWidth <= 280 || pixelHeight <= 200;

  // Dynamic sizing classes
  const mainNumberSize = isTiny
    ? 'text-2xl'
    : isCompact
      ? 'text-3xl'
      : isMedium
        ? 'text-4xl'
        : 'text-5xl';

  const labelSize = isTiny
    ? 'text-[10px]'
    : isCompact
      ? 'text-xs'
      : isMedium
        ? 'text-sm'
        : 'text-base';

  const secondarySize = isCompact
    ? 'text-xs'
    : 'text-sm';

  // Get label based on showType
  const getLabel = () => {
    switch (showType) {
      case 'vms': return 'VMs Running';
      case 'lxcs': return 'LXCs Running';
      default: return 'Guests Running';
    }
  };

  // Get icon based on showType
  const getIcon = () => {
    if (showType === 'lxcs') {
      // Container icon
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    }
    if (showType === 'vms') {
      // VM/Server icon
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      );
    }
    // Both - combined icon
    return (
      <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    );
  };

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col items-center justify-center h-full py-1">
          {/* Icon - hidden at tiny size */}
          {!isTiny && (
            <div className={`${isCompact ? 'w-5 h-5' : isMedium ? 'w-8 h-8' : 'w-10 h-10'} text-gray-500 dark:text-gray-400 mb-1`}>
              {getIcon()}
            </div>
          )}

          {/* Tiny mode: show count and type inline */}
          {isTiny ? (
            <div className="text-center">
              <span className={`${mainNumberSize} font-bold text-green-600 dark:text-green-400`}>
                {runningTotal}
              </span>
              <span className={`${labelSize} text-gray-600 dark:text-gray-400 ml-1`}>
                {showType === 'vms' ? 'VMs' : showType === 'lxcs' ? 'LXCs' : 'Guests'}
              </span>
            </div>
          ) : (
            <>
              {/* Main running count */}
              <div className={`${mainNumberSize} font-bold text-green-600 dark:text-green-400 leading-none`}>
                {runningTotal}
              </div>

              {/* Label */}
              <div className={`${labelSize} text-gray-600 dark:text-gray-400 mt-1 text-center`}>
                {getLabel()}
              </div>
            </>
          )}

          {/* Stopped count (optional) - hidden at tiny size */}
          {showStopped && stoppedTotal > 0 && !isTiny && (
            <div className={`${secondarySize} text-gray-500 dark:text-gray-400 mt-1`}>
              {stoppedTotal} stopped
            </div>
          )}

          {/* Breakdown when showing both - hidden at compact sizes */}
          {showType === 'both' && !isCompact && (
            <div className={`${secondarySize} text-gray-500 dark:text-gray-400 mt-2 flex gap-3`}>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {runningVMs} VMs
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                {runningLXCs} LXCs
              </span>
            </div>
          )}
        </div>
    </BaseWidget>
  );
}
