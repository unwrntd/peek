import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { AdGuardStatus, AdGuardFilterStatus } from '../../../types';

interface ProtectionStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface StatusData {
  status: AdGuardStatus;
  filterStatus: AdGuardFilterStatus;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function ProtectionStatus({ integrationId, config, widgetId }: ProtectionStatusProps) {
  const { data, loading, error } = useWidgetData<StatusData>({
    integrationId,
    metric: 'status',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const metricSize = (config.metricSize as string) || 'md';

  // Display options (default to true if not set)
  const showDnsPort = config.showDnsPort !== false;
  const showHttpPort = config.showHttpPort !== false;
  const showRules = config.showRules !== false;
  const showFilterCount = config.showFilterCount !== false;
  const showFilters = config.showFilters !== false;

  const metricSizeClasses: Record<string, string> = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
    xxl: 'text-3xl',
    xxxl: 'text-4xl',
  };
  const metricClass = metricSizeClasses[metricSize] || 'text-lg';

  const status = data?.status;
  const filterStatus = data?.filterStatus;

  const totalRules = filterStatus?.filters?.reduce((acc, f) => acc + (f.enabled ? f.rules_count : 0), 0) || 0;
  const enabledFilters = filterStatus?.filters?.filter(f => f.enabled).length || 0;
  const totalFilters = filterStatus?.filters?.length || 0;

  const visibleStats = [showDnsPort, showHttpPort, showRules, showFilterCount].filter(Boolean).length;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`space-y-${compactView ? '3' : '4'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  status?.protection_enabled
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className={`font-medium ${compactView ? 'text-sm' : 'text-base'} text-gray-900 dark:text-white`}>
                Protection {status?.protection_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              v{status?.version}
            </span>
          </div>

          {visibleStats > 0 && (
            <div className={`grid grid-cols-${Math.min(visibleStats, 2)} gap-${compactView ? '2' : '3'}`}>
              {showDnsPort && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">DNS Port</div>
                  )}
                  <div className={`font-semibold ${metricClass} text-gray-900 dark:text-white`}>
                    {status?.dns_port}
                  </div>
                </div>
              )}
              {showHttpPort && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">HTTP Port</div>
                  )}
                  <div className={`font-semibold ${metricClass} text-gray-900 dark:text-white`}>
                    {status?.http_port}
                  </div>
                </div>
              )}
              {showRules && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Active Rules</div>
                  )}
                  <div className={`font-semibold ${metricClass} text-green-600 dark:text-green-400`}>
                    {formatNumber(totalRules)}
                  </div>
                </div>
              )}
              {showFilterCount && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  {!hideLabels && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Filters</div>
                  )}
                  <div className={`font-semibold ${metricClass} text-blue-600 dark:text-blue-400`}>
                    {enabledFilters}/{totalFilters}
                  </div>
                </div>
              )}
            </div>
          )}

          {showFilters && filterStatus?.filters && filterStatus.filters.length > 0 && (
            <div>
              {!hideLabels && (
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Filter Lists
                </div>
              )}
              <div className="space-y-1">
                {filterStatus.filters.slice(0, compactView ? 3 : 5).map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate flex-1 mr-2">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          filter.enabled ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      />
                      <span className="truncate text-gray-700 dark:text-gray-300">
                        {filter.name}
                      </span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {formatNumber(filter.rules_count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
