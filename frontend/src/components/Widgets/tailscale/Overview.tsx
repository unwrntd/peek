import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface OverviewProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TailscaleOverview {
  tailnetName: string;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalUsers: number;
  pendingApprovals: number;
  expiringKeys: number;
  subnetRouters: number;
  exitNodes: number;
  magicDNSEnabled: boolean;
}

interface OverviewData {
  overview: TailscaleOverview;
}

export function Overview({ integrationId, config, widgetId }: OverviewProps) {
  const { data, loading, error } = useWidgetData<OverviewData>({
    integrationId,
    metric: 'overview',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showDeviceCount = config.showDeviceCount !== false;
  const showOnlineStatus = config.showOnlineStatus !== false;
  const showUserCount = config.showUserCount !== false;
  const showPendingApprovals = config.showPendingApprovals !== false;
  const showSubnetRouters = config.showSubnetRouters !== false;
  const showExitNodes = config.showExitNodes !== false;
  const showMagicDNS = config.showMagicDNS !== false;
  const visualizationType = (config.visualization as string) || 'cards';
  const metricSize = (config.metricSize as string) || 'medium';

  const overview = data?.overview;

  const getMetricSizeClass = () => {
    switch (metricSize) {
      case 'small':
        return 'text-lg';
      case 'large':
        return 'text-3xl';
      default:
        return 'text-2xl';
    }
  };

  const renderCardsView = () => (
    <div className="grid grid-cols-2 gap-3">
      {showDeviceCount && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Devices</div>
          <div className={`${getMetricSizeClass()} font-bold text-gray-900 dark:text-white`}>
            {overview?.totalDevices || 0}
          </div>
        </div>
      )}

      {showOnlineStatus && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Online / Offline</div>
          <div className={`${getMetricSizeClass()} font-bold`}>
            <span className="text-green-600 dark:text-green-400">{overview?.onlineDevices || 0}</span>
            <span className="text-gray-400 dark:text-gray-500 mx-1">/</span>
            <span className="text-gray-600 dark:text-gray-400">{overview?.offlineDevices || 0}</span>
          </div>
        </div>
      )}

      {showUserCount && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Users</div>
          <div className={`${getMetricSizeClass()} font-bold text-gray-900 dark:text-white`}>
            {overview?.totalUsers || 0}
          </div>
        </div>
      )}

      {showPendingApprovals && overview?.pendingApprovals !== undefined && overview.pendingApprovals > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
          <div className="text-xs text-yellow-600 dark:text-yellow-400">Pending Approvals</div>
          <div className={`${getMetricSizeClass()} font-bold text-yellow-600 dark:text-yellow-400`}>
            {overview.pendingApprovals}
          </div>
        </div>
      )}

      {showSubnetRouters && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Subnet Routers</div>
          <div className={`${getMetricSizeClass()} font-bold text-blue-600 dark:text-blue-400`}>
            {overview?.subnetRouters || 0}
          </div>
        </div>
      )}

      {showExitNodes && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Exit Nodes</div>
          <div className={`${getMetricSizeClass()} font-bold text-purple-600 dark:text-purple-400`}>
            {overview?.exitNodes || 0}
          </div>
        </div>
      )}

      {showMagicDNS && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">MagicDNS</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              overview?.magicDNSEnabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {overview?.magicDNSEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const renderCompactView = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
        <span className="text-sm text-gray-600 dark:text-gray-300">Tailnet</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{overview?.tailnetName}</span>
      </div>

      {showDeviceCount && (
        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-300">Devices</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {overview?.totalDevices || 0}
            {showOnlineStatus && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                ({overview?.onlineDevices || 0} online)
              </span>
            )}
          </span>
        </div>
      )}

      {showUserCount && (
        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-300">Users</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{overview?.totalUsers || 0}</span>
        </div>
      )}

      {showSubnetRouters && (
        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-300">Subnet Routers</span>
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{overview?.subnetRouters || 0}</span>
        </div>
      )}

      {showExitNodes && (
        <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-300">Exit Nodes</span>
          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{overview?.exitNodes || 0}</span>
        </div>
      )}

      {showMagicDNS && (
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-gray-600 dark:text-gray-300">MagicDNS</span>
          <span className={`text-sm font-medium ${overview?.magicDNSEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {overview?.magicDNSEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <BaseWidget loading={loading} error={error}>
      {data && overview && (
        <>
          {visualizationType === 'compact' ? renderCompactView() : renderCardsView()}
        </>
      )}
    </BaseWidget>
  );
}
