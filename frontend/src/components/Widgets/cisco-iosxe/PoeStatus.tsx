import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface PoeStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function PoeStatus({ integrationId, config, widgetId }: PoeStatusProps) {
  const { data, loading, error } = useWidgetData<Record<string, unknown>>({
    integrationId,
    metric: (config.metric as string) || 'poe',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = config.hideLabels === true;
  const showSummary = config.showSummary !== false;
  const showPorts = config.showPorts !== false;
  const portFilter = String(config.portFilter || '');

  // Safely extract poe array from data
  const poeData = data as { poe?: Array<{
    module?: number;
    availablePower?: number;
    usedPower?: number;
    remainingPower?: number;
    ports?: Array<{
      interface?: string;
      adminStatus?: string;
      operStatus?: string;
      power?: number;
      device?: string;
    }>;
  }> } | null;

  const modules = (poeData?.poe && Array.isArray(poeData.poe)) ? poeData.poe : [];

  // Calculate totals
  let totalBudget = 0;
  let usedPower = 0;
  let remainingPower = 0;

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m) {
      totalBudget += Number(m.availablePower) || 0;
      usedPower += Number(m.usedPower) || 0;
      remainingPower += Number(m.remainingPower) || 0;
    }
  }

  // Collect all ports
  const allPorts: Array<{
    interface?: string;
    adminStatus?: string;
    operStatus?: string;
    power?: number;
    device?: string;
  }> = [];

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m?.ports && Array.isArray(m.ports)) {
      for (let j = 0; j < m.ports.length; j++) {
        const p = m.ports[j];
        if (p) allPorts.push(p);
      }
    }
  }

  // Filter ports
  let filteredPorts = allPorts;
  if (portFilter === 'delivering') {
    filteredPorts = allPorts.filter(function(p) { return p.operStatus === 'on'; });
  } else if (portFilter === 'disabled') {
    filteredPorts = allPorts.filter(function(p) { return p.operStatus === 'off' || p.adminStatus === 'off'; });
  }

  const usagePercent = totalBudget > 0 ? (usedPower / totalBudget) * 100 : 0;
  const hasPoe = modules.length > 0;
  const hasPowerData = totalBudget > 0;

  function getStatusColor(operStatus?: string, adminStatus?: string): string {
    if (operStatus === 'on') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (operStatus === 'faulty') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    if (adminStatus === 'off') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }

  function getStatusLabel(operStatus?: string, adminStatus?: string): string {
    if (operStatus === 'on') return 'delivering';
    if (operStatus === 'faulty') return 'fault';
    if (adminStatus === 'off') return 'disabled';
    return 'searching';
  }

  function getUsageBarColor(percent: number): string {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data ? (
        <div className={compactView ? 'p-2' : 'p-3'}>
          {showSummary && hasPowerData ? (
            <div className="space-y-2 mb-4">
              {!hideLabels ? (
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Power Budget
                </div>
              ) : null}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {usedPower.toFixed(1)}W / {totalBudget.toFixed(1)}W
                </span>
                <span className={'font-medium ' + (
                  usagePercent >= 90 ? 'text-red-600 dark:text-red-400' :
                  usagePercent >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-green-600 dark:text-green-400'
                )}>
                  {usagePercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={'h-3 rounded-full transition-all ' + getUsageBarColor(usagePercent)}
                  style={{ width: Math.min(usagePercent, 100) + '%' }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Used: {usedPower.toFixed(1)}W</span>
                <span>Available: {remainingPower.toFixed(1)}W</span>
              </div>
            </div>
          ) : null}

          {showPorts ? (
            <div className="space-y-2">
              {!hideLabels ? (
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Port Status ({filteredPorts.length})
                </div>
              ) : null}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredPorts.map(function(port, idx) {
                  return (
                    <div
                      key={port.interface || 'port-' + idx}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {port.interface || 'Unknown'}
                        </span>
                        <span className={'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ' + getStatusColor(port.operStatus, port.adminStatus)}>
                          {getStatusLabel(port.operStatus, port.adminStatus)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {port.device ? (
                          <span className="text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
                            {port.device}
                          </span>
                        ) : null}
                        <span className={'font-medium ' + (
                          port.operStatus === 'on' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                        )}>
                          {(Number(port.power) || 0).toFixed(1)}W
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredPorts.length === 0 && hasPoe ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  No PoE ports found
                </div>
              ) : null}
            </div>
          ) : null}

          {!hasPoe ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              PoE not available on this device
            </div>
          ) : null}
        </div>
      ) : null}
    </BaseWidget>
  );
}
