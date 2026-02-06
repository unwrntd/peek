import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface NodeStatusData {
  nodeId: string;
  version: string;
  upToDate: boolean;
  allowedVersion: string;
  wallet: string;
  lastPinged: string;
  startedAt: string;
  diskSpace: {
    used: number;
    available: number;
    trash: number;
    overused: number;
    percentUsed: number;
  };
  bandwidth: {
    used: number;
    available: number;
  };
  satelliteCount: number;
}

interface NodeStatusWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(startedAt: string): string {
  if (!startedAt) return 'Unknown';
  const start = new Date(startedAt);
  const now = new Date();
  const diff = now.getTime() - start.getTime();

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NodeStatus({ integrationId, config, widgetId }: NodeStatusWidgetProps) {
  const { data, loading, error } = useWidgetData<NodeStatusData>({
    integrationId,
    metric: 'node-status',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <p className="text-sm">Loading node status...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  const diskPercent = data.diskSpace.percentUsed;
  const diskColor = diskPercent > 90 ? 'bg-red-500' : diskPercent > 75 ? 'bg-yellow-500' : 'bg-green-500';

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${data.upToDate ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm text-white">v{data.version}</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{diskPercent}%</div>
          <div className="text-xs text-gray-500">Disk Used</div>
          <div className="w-full max-w-[100px] bg-gray-700 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${diskColor}`} style={{ width: `${diskPercent}%` }} />
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'detailed') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${data.upToDate ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm text-white font-medium">v{data.version}</span>
            </div>
            <span className="text-xs text-gray-500">Uptime: {formatUptime(data.startedAt)}</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400">Disk Space</span>
                <span className="text-white">{diskPercent}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className={`h-2 rounded-full ${diskColor}`} style={{ width: `${diskPercent}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{formatBytes(data.diskSpace.used)} used</span>
                <span>{formatBytes(data.diskSpace.available)} free</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-500">Satellites</div>
                <div className="text-white font-medium">{data.satelliteCount}</div>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-500">Last Ping</div>
                <div className="text-white font-medium">{formatTimeAgo(data.lastPinged)}</div>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-500">Trash</div>
                <div className="text-white font-medium">{formatBytes(data.diskSpace.trash)}</div>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-500">Bandwidth</div>
                <div className="text-white font-medium">{formatBytes(data.bandwidth.used)}</div>
              </div>
            </div>

            <div className="text-xs text-gray-500 truncate">
              Node: {data.nodeId.substring(0, 24)}...
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default card view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col p-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${data.upToDate ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm text-white">v{data.version}</span>
            {!data.upToDate && (
              <span className="text-xs text-yellow-400">(update available)</span>
            )}
          </div>
          <span className="text-xs text-gray-500">{data.satelliteCount} satellites</span>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">Disk Space</span>
              <span className="text-white">{formatBytes(data.diskSpace.used)} / {formatBytes(data.diskSpace.used + data.diskSpace.available)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div className={`h-2.5 rounded-full transition-all ${diskColor}`} style={{ width: `${diskPercent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Uptime</span>
              <div className="text-white">{formatUptime(data.startedAt)}</div>
            </div>
            <div>
              <span className="text-gray-500">Last Ping</span>
              <div className="text-white">{formatTimeAgo(data.lastPinged)}</div>
            </div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
