import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface VM {
  id: string;
  name: string;
  powerState: string;
  cpuCount: number;
  memoryMB: number;
  guestOS: string;
}

interface VMListData {
  vms: VM[];
  summary: {
    total: number;
    poweredOn: number;
    poweredOff: number;
    suspended: number;
  };
}

interface VMListWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

function getPowerStateColor(state: string): string {
  switch (state) {
    case 'POWERED_ON':
      return 'bg-green-500';
    case 'POWERED_OFF':
      return 'bg-gray-500';
    case 'SUSPENDED':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
}

function getPowerStateText(state: string): string {
  switch (state) {
    case 'POWERED_ON':
      return 'On';
    case 'POWERED_OFF':
      return 'Off';
    case 'SUSPENDED':
      return 'Suspended';
    default:
      return state;
  }
}

export function VMList({ integrationId, config, widgetId }: VMListWidgetProps) {
  const { data, loading, error } = useWidgetData<VMListData>({
    integrationId,
    metric: 'vms',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const powerStateFilter = (config.powerState as string) || '';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <p className="text-sm">Loading VMs...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  const filteredVMs = powerStateFilter
    ? data.vms.filter(vm => vm.powerState === powerStateFilter)
    : data.vms;

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-green-400">{data.summary.poweredOn} running</span>
            <span className="text-gray-400">{data.summary.total} total</span>
          </div>
          <div className="space-y-0.5">
            {filteredVMs.map((vm) => (
              <div key={vm.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800">
                <div className={`w-2 h-2 rounded-full ${getPowerStateColor(vm.powerState)}`} />
                <span className="text-xs text-gray-300 truncate flex-1">{vm.name}</span>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="flex items-center justify-between mb-2 px-1 text-xs">
            <span className="text-green-400">{data.summary.poweredOn} running</span>
            <span className="text-gray-400">{data.summary.total} total</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filteredVMs.map((vm) => (
              <div key={vm.id} className="p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${getPowerStateColor(vm.powerState)}`} />
                  <span className="text-sm font-medium text-white truncate">{vm.name}</span>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>{vm.cpuCount} vCPU · {formatMemory(vm.memoryMB)}</div>
                  <div className="truncate">{vm.guestOS}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <span className="text-green-400">{data.summary.poweredOn} running</span>
          <span className="text-gray-400">{data.summary.poweredOff} off · {data.summary.suspended} suspended</span>
        </div>
        <div className="space-y-1">
          {filteredVMs.map((vm) => (
            <div key={vm.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getPowerStateColor(vm.powerState)}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{vm.name}</div>
                <div className="text-xs text-gray-500 truncate">{vm.guestOS}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-400">{vm.cpuCount} vCPU</div>
                <div className="text-xs text-gray-500">{formatMemory(vm.memoryMB)}</div>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                vm.powerState === 'POWERED_ON' ? 'bg-green-900/30 text-green-400' :
                vm.powerState === 'SUSPENDED' ? 'bg-yellow-900/30 text-yellow-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {getPowerStateText(vm.powerState)}
              </span>
            </div>
          ))}
          {filteredVMs.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No VMs found</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
