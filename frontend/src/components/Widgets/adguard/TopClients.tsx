import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';
import { BaseWidget } from '../BaseWidget';
import { AdGuardStats } from '../../../types';

interface TopClientsProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface StatsData {
  stats: AdGuardStats;
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

export function TopClients({ integrationId, config, widgetId }: TopClientsProps) {
  const { rIP } = useRedact();
  const { data, loading, error } = useWidgetData<StatsData>({
    integrationId,
    metric: 'stats',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const limit = (config.limit as number) || 10;
  const compactView = config.compactView === true;

  const clients = data?.stats?.top_clients || [];
  const displayClients = clients.slice(0, limit);

  // Find max for progress bar scaling
  const maxQueries = displayClients.length > 0
    ? Math.max(...displayClients.map(c => Object.values(c)[0]))
    : 1;

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`space-y-${compactView ? '1' : '2'}`}>
          {displayClients.map((clientObj, index) => {
            const [client, queries] = Object.entries(clientObj)[0];
            const percent = (queries / maxQueries) * 100;

            return (
              <div key={index} className="relative">
                <div
                  className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded"
                  style={{ width: `${percent}%` }}
                />
                <div className={`relative flex items-center justify-between ${compactView ? 'px-2 py-1' : 'px-3 py-2'}`}>
                  <span className={`font-mono ${compactView ? 'text-xs' : 'text-sm'} text-gray-900 dark:text-gray-100 truncate flex-1 mr-2`}>
                    {rIP(client)}
                  </span>
                  <span className={`${compactView ? 'text-xs' : 'text-sm'} font-medium text-gray-600 dark:text-gray-400`}>
                    {formatNumber(queries)}
                  </span>
                </div>
              </div>
            );
          })}
          {displayClients.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
              No client data available
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
