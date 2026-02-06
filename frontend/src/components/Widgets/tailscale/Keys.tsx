import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface KeysProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TailscaleAuthKey {
  id: string;
  key?: string;
  created: string;
  expires: string;
  revoked?: string;
  capabilities: {
    devices: {
      create: {
        reusable: boolean;
        ephemeral: boolean;
        preauthorized: boolean;
        tags: string[];
      };
    };
  };
  description?: string;
}

interface KeysData {
  keys: TailscaleAuthKey[];
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getKeyStatus(key: TailscaleAuthKey): { status: 'valid' | 'expired' | 'revoked' | 'expiring'; label: string } {
  if (key.revoked) {
    return { status: 'revoked', label: 'Revoked' };
  }

  const now = Date.now();
  const expires = new Date(key.expires).getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (expires < now) {
    return { status: 'expired', label: 'Expired' };
  }

  if (expires < now + oneDay) {
    return { status: 'expiring', label: 'Expiring Soon' };
  }

  return { status: 'valid', label: 'Valid' };
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'valid':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'expired':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    case 'revoked':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    case 'expiring':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
  }
}

export function Keys({ integrationId, config, widgetId }: KeysProps) {
  const { data, loading, error } = useWidgetData<KeysData>({
    integrationId,
    metric: 'auth-keys',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const statusFilter = config.status as string;
  const showKeyId = config.showKeyId !== false;
  const showDescription = config.showDescription !== false;
  const showCreated = config.showCreated !== false;
  const showExpires = config.showExpires !== false;
  const showCapabilities = config.showCapabilities !== false;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'table';

  const filteredKeys = useMemo(() => {
    let keys = data?.keys || [];

    // Filter by status
    if (statusFilter) {
      keys = keys.filter(k => {
        const { status } = getKeyStatus(k);
        return status === statusFilter;
      });
    }

    return keys;
  }, [data?.keys, statusFilter]);

  const validCount = filteredKeys.filter(k => getKeyStatus(k).status === 'valid').length;
  const expiringCount = filteredKeys.filter(k => getKeyStatus(k).status === 'expiring').length;

  const renderCapabilities = (key: TailscaleAuthKey) => {
    const caps = key.capabilities?.devices?.create;
    if (!caps) return null;

    const badges: string[] = [];
    if (caps.reusable) badges.push('Reusable');
    if (caps.ephemeral) badges.push('Ephemeral');
    if (caps.preauthorized) badges.push('Pre-auth');

    return (
      <div className="flex flex-wrap gap-1">
        {badges.map(badge => (
          <span key={badge} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            {badge}
          </span>
        ))}
        {caps.tags && caps.tags.length > 0 && caps.tags.map(tag => (
          <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {tag}
          </span>
        ))}
      </div>
    );
  };

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            {showKeyId && <th className="py-2 font-medium">Key</th>}
            {showDescription && <th className="py-2 font-medium">Description</th>}
            <th className="py-2 font-medium">Status</th>
            {showCreated && <th className="py-2 font-medium">Created</th>}
            {showExpires && <th className="py-2 font-medium">Expires</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredKeys.map(key => {
            const { status, label } = getKeyStatus(key);
            return (
              <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {showKeyId && (
                  <td className="py-2">
                    <div className="font-mono text-sm text-gray-900 dark:text-white">
                      {key.id.substring(0, 12)}...
                    </div>
                    {showCapabilities && renderCapabilities(key)}
                  </td>
                )}
                {showDescription && (
                  <td className="py-2 text-gray-600 dark:text-gray-300">
                    {key.description || '-'}
                  </td>
                )}
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClasses(status)}`}>
                    {label}
                  </span>
                </td>
                {showCreated && (
                  <td className="py-2 text-gray-600 dark:text-gray-300">{formatDate(key.created)}</td>
                )}
                {showExpires && (
                  <td className="py-2 text-gray-600 dark:text-gray-300">{formatDate(key.expires)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderCardsView = () => (
    <div className="grid gap-3 grid-cols-1">
      {filteredKeys.map(key => {
        const { status, label } = getKeyStatus(key);
        return (
          <div key={key.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                {showKeyId && (
                  <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                    {key.id.substring(0, 16)}...
                  </div>
                )}
                {showDescription && key.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{key.description}</div>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClasses(status)}`}>
                {label}
              </span>
            </div>

            <div className="space-y-1 text-sm">
              {showCreated && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Created</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatDate(key.created)}</span>
                </div>
              )}
              {showExpires && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Expires</span>
                  <span className={`${status === 'expiring' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {formatDate(key.expires)}
                  </span>
                </div>
              )}
              {showCapabilities && (
                <div className="pt-2">
                  {renderCapabilities(key)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!data?.keys?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-sm">No auth keys found</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className="flex flex-col h-full">
          {!hideLabels && (
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {filteredKeys.length} key{filteredKeys.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600 dark:text-green-400">{validCount} valid</span>
                {expiringCount > 0 && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span className="text-yellow-600 dark:text-yellow-400">{expiringCount} expiring</span>
                  </>
                )}
              </div>
            </div>
          )}
          {visualizationType === 'cards' ? renderCardsView() : renderTableView()}
        </div>
      )}
    </BaseWidget>
  );
}
