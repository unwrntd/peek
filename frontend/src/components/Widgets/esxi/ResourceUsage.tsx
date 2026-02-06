import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface ResourceUsageData {
  host: {
    name: string;
    connectionState: string;
    powerState: string;
    cpu: {
      model: string;
      cores: number;
      mhz: number;
    };
    memory: {
      totalBytes: number;
    };
  };
  vms: {
    total: number;
    poweredOn: number;
    poweredOff: number;
    suspended: number;
  };
  storage: {
    count: number;
    totalCapacity: number;
    totalFree: number;
    totalUsed: number;
    usedPercent: number;
  };
  allocation: {
    cpuAllocated: number;
    memoryAllocatedMB: number;
  };
}

interface ResourceUsageWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export function ResourceUsage({ integrationId, config, widgetId }: ResourceUsageWidgetProps) {
  const { data, loading, error } = useWidgetData<ResourceUsageData>({
    integrationId,
    metric: 'resource-usage',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'overview';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">Loading resources...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'detailed') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-1">
          <div className="space-y-3">
            {/* VMs */}
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 mb-2">Virtual Machines</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-white">{data.vms.total}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400">{data.vms.poweredOn}</div>
                  <div className="text-xs text-gray-500">On</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-400">{data.vms.poweredOff}</div>
                  <div className="text-xs text-gray-500">Off</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-400">{data.vms.suspended}</div>
                  <div className="text-xs text-gray-500">Susp</div>
                </div>
              </div>
            </div>

            {/* CPU */}
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">CPU Allocation</span>
                <span className="text-xs text-gray-400">{data.allocation.cpuAllocated} / {data.host.cpu.cores} cores</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    data.allocation.cpuAllocated > data.host.cpu.cores ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min((data.allocation.cpuAllocated / data.host.cpu.cores) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory */}
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Memory Allocation</span>
                <span className="text-xs text-gray-400">
                  {formatMemory(data.allocation.memoryAllocatedMB)} / {formatBytes(data.host.memory.totalBytes)}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    data.allocation.memoryAllocatedMB * 1024 * 1024 > data.host.memory.totalBytes ? 'bg-red-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min((data.allocation.memoryAllocatedMB * 1024 * 1024 / data.host.memory.totalBytes) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Storage */}
            <div className="p-2 bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Storage ({data.storage.count} datastores)</span>
                <span className="text-xs text-gray-400">{data.storage.usedPercent}% used</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    data.storage.usedPercent >= 90 ? 'bg-red-500' :
                    data.storage.usedPercent >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${data.storage.usedPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatBytes(data.storage.totalUsed)} / {formatBytes(data.storage.totalCapacity)}
              </div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default overview
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col p-2">
        <div className="text-xs text-gray-500 mb-2">{data.host.name}</div>

        <div className="grid grid-cols-2 gap-2 flex-1">
          <div className="p-2 bg-gray-800 rounded-lg flex flex-col justify-center items-center">
            <div className="text-2xl font-bold text-green-400">{data.vms.poweredOn}</div>
            <div className="text-xs text-gray-500">VMs Running</div>
            <div className="text-xs text-gray-600">{data.vms.total} total</div>
          </div>

          <div className="p-2 bg-gray-800 rounded-lg flex flex-col justify-center items-center">
            <div className="text-2xl font-bold text-blue-400">{data.allocation.cpuAllocated}</div>
            <div className="text-xs text-gray-500">vCPUs Used</div>
            <div className="text-xs text-gray-600">of {data.host.cpu.cores}</div>
          </div>

          <div className="p-2 bg-gray-800 rounded-lg flex flex-col justify-center items-center">
            <div className="text-2xl font-bold text-purple-400">{formatMemory(data.allocation.memoryAllocatedMB)}</div>
            <div className="text-xs text-gray-500">Memory Used</div>
            <div className="text-xs text-gray-600">of {formatBytes(data.host.memory.totalBytes)}</div>
          </div>

          <div className="p-2 bg-gray-800 rounded-lg flex flex-col justify-center items-center">
            <div className={`text-2xl font-bold ${
              data.storage.usedPercent >= 90 ? 'text-red-400' :
              data.storage.usedPercent >= 75 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {data.storage.usedPercent}%
            </div>
            <div className="text-xs text-gray-500">Storage Used</div>
            <div className="text-xs text-gray-600">{data.storage.count} datastores</div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
