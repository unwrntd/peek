import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface NodeRedStatusData {
  status: {
    version: string;
    httpNodeRoot: string;
    state: string;
    flowCount: number;
    nodeCount: number;
    contextStores: string[];
    functionExternalModules: boolean;
  };
}

interface StatusWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function StateIcon({ state }: { state: string }) {
  if (state === 'start' || state === 'running') {
    return (
      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (state === 'stop' || state === 'stopped') {
    return (
      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (state === 'safe') {
    return (
      <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function getStateLabel(state: string): string {
  switch (state) {
    case 'start':
    case 'running':
      return 'Running';
    case 'stop':
    case 'stopped':
      return 'Stopped';
    case 'safe':
      return 'Safe Mode';
    default:
      return 'Unknown';
  }
}

function getStateColor(state: string): string {
  switch (state) {
    case 'start':
    case 'running':
      return 'text-green-400';
    case 'stop':
    case 'stopped':
      return 'text-red-400';
    case 'safe':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
}

export function Status({ integrationId, config, widgetId }: StatusWidgetProps) {
  const { data, loading, error } = useWidgetData<NodeRedStatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const status = data?.status;
  const metricSize = (config.metricSize as 'small' | 'medium' | 'large') || 'medium';

  if (metricSize === 'large' && status) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="flex items-center gap-3 mb-2">
            <StateIcon state={status.state} />
            <span className={`text-3xl font-bold ${getStateColor(status.state)}`}>
              {getStateLabel(status.state)}
            </span>
          </div>
          <div className="text-lg text-gray-400">Node-RED v{status.version}</div>
          <div className="text-sm text-gray-500 mt-1">
            {status.flowCount} flows • {status.nodeCount} nodes
          </div>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full p-3">
        {/* Header with version and state */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-500/20 rounded">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-200">Node-RED</div>
              <div className="text-xs text-gray-500">v{status?.version || '...'}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <StateIcon state={status?.state || 'unknown'} />
            <span className={`text-sm font-medium ${getStateColor(status?.state || 'unknown')}`}>
              {getStateLabel(status?.state || 'unknown')}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 flex-1">
          <div className="bg-gray-800/30 rounded p-2 text-center">
            <div className="text-xl font-semibold text-blue-400">{status?.flowCount || 0}</div>
            <div className="text-xs text-gray-500">Flows</div>
          </div>
          <div className="bg-gray-800/30 rounded p-2 text-center">
            <div className="text-xl font-semibold text-purple-400">{status?.nodeCount || 0}</div>
            <div className="text-xs text-gray-500">Nodes</div>
          </div>
        </div>

        {/* HTTP Node Root */}
        {status?.httpNodeRoot && status.httpNodeRoot !== '/' && (
          <div className="mt-2 text-xs text-gray-500 truncate">
            HTTP Root: {status.httpNodeRoot}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
