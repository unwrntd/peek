import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SpanningTreeStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface SpanningTreePort {
  port: string;
  role: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
  state: 'forwarding' | 'blocking' | 'listening' | 'learning' | 'disabled';
  cost: number;
}

interface SpanningTreeInstance {
  vlanId: number;
  rootBridge: {
    priority: number;
    macAddress: string;
    cost: number;
    port: string;
  };
  localBridge: {
    priority: number;
    macAddress: string;
  };
  topologyChanges: number;
  lastTopologyChange: string;
  ports: SpanningTreePort[];
}

interface SpanningTreeData {
  instances: SpanningTreeInstance[];
}

export function SpanningTreeStatus({ integrationId, config, widgetId }: SpanningTreeStatusProps) {
  const { data, loading, error } = useWidgetData<SpanningTreeData>({
    integrationId,
    metric: (config.metric as string) || 'spanning-tree',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const instanceId = (config.instanceId as string) || '';
  const showRootBridge = config.showRootBridge !== false;
  const showLocalPriority = config.showLocalPriority !== false;
  const showPortStates = config.showPortStates !== false;
  const showTopologyChanges = config.showTopologyChanges !== false;

  const selectedInstance = instanceId
    ? data?.instances?.find(i => i.vlanId.toString() === instanceId)
    : data?.instances?.[0];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'root':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'designated':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'alternate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'backup':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'forwarding':
        return 'text-green-600 dark:text-green-400';
      case 'blocking':
        return 'text-red-600 dark:text-red-400';
      case 'learning':
      case 'listening':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const isRootBridge = selectedInstance?.rootBridge.macAddress === selectedInstance?.localBridge.macAddress;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && selectedInstance && (
        <div className={`${compactView ? 'p-2' : 'p-3'} space-y-3 overflow-auto h-full`}>
          {!hideLabels && data.instances.length > 1 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              VLAN {selectedInstance.vlanId}
            </div>
          )}

          {showRootBridge && (
            <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              {!hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Root Bridge</div>
              )}
              <div className="flex items-center gap-2">
                {isRootBridge && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    This Switch
                  </span>
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedInstance.rootBridge.macAddress}
                </span>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Priority: {selectedInstance.rootBridge.priority}</span>
                {!isRootBridge && (
                  <>
                    <span>Cost: {selectedInstance.rootBridge.cost}</span>
                    <span>Port: {selectedInstance.rootBridge.port}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {showLocalPriority && !isRootBridge && (
            <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              {!hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Local Bridge</div>
              )}
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedInstance.localBridge.macAddress}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Priority: {selectedInstance.localBridge.priority}
              </div>
            </div>
          )}

          {showTopologyChanges && (
            <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400">Topology Changes</span>
              <span className={`text-sm font-medium ${
                selectedInstance.topologyChanges > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'
              }`}>
                {selectedInstance.topologyChanges}
              </span>
            </div>
          )}

          {showPortStates && selectedInstance.ports.length > 0 && (
            <div className="space-y-1">
              {!hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Port States</div>
              )}
              <div className="grid gap-1">
                {selectedInstance.ports.map((port) => (
                  <div
                    key={port.port}
                    className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-800/50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {port.port}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getRoleColor(port.role)}`}>
                        {port.role}
                      </span>
                    </div>
                    <span className={`text-sm ${getStateColor(port.state)}`}>
                      {port.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {data && !selectedInstance && (
        <div className="p-3 text-center text-gray-500 dark:text-gray-400">
          No spanning tree instance found
        </div>
      )}
    </BaseWidget>
  );
}
