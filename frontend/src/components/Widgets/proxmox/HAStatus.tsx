import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import { ProxmoxHAResource, ProxmoxHAStatus as HAStatusType } from '../../../types';
import { matchesFilter } from '../../../utils/filterUtils';

interface HAStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface HAData {
  resources: ProxmoxHAResource[];
  status: HAStatusType;
}

function getStateColor(state: string): string {
  switch (state) {
    case 'started':
      return 'text-green-600 dark:text-green-400';
    case 'stopped':
      return 'text-gray-600 dark:text-gray-400';
    case 'migrate':
    case 'relocate':
      return 'text-blue-600 dark:text-blue-400';
    case 'error':
    case 'fence':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-yellow-600 dark:text-yellow-400';
  }
}

function getStateBadge(state: string): string {
  switch (state) {
    case 'started':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'stopped':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    case 'migrate':
    case 'relocate':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    case 'error':
    case 'fence':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    default:
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  }
}

function parseResourceSid(sid: string): { type: string; id: string } {
  const parts = sid.split(':');
  return {
    type: parts[0] || 'unknown',
    id: parts[1] || sid,
  };
}

export function HAStatus({ integrationId, config, widgetId }: HAStatusProps) {
  const { data, loading, error } = useWidgetData<HAData>({
    integrationId,
    metric: (config.metric as string) || 'ha',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  // Configuration options with defaults
  const showManagerStatus = config.showManagerStatus !== false;
  const showQuorum = config.showQuorum !== false;
  const showResources = config.showResources !== false;
  const compactView = config.compactView === true;

  // Apply filters
  const filteredResources = data?.resources.filter(resource => {
    const resourceType = config.resourceType as string;
    if (resourceType) {
      const parsed = parseResourceSid(resource.sid);
      if (parsed.type !== resourceType) return false;
    }

    const stateFilter = config.state as string;
    if (stateFilter && resource.state !== stateFilter) return false;

    const nodeFilter = config.nodeFilter as string;
    if (nodeFilter && !matchesFilter(resource.node, nodeFilter)) return false;

    return true;
  }) || [];

  if (!data?.status && (!data?.resources || data.resources.length === 0)) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p>HA not configured or unavailable</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className={`space-y-${compactView ? '3' : '4'}`}>
        {/* Manager & Quorum Status */}
        {(showManagerStatus || showQuorum) && data?.status && (
          <div className="grid grid-cols-2 gap-3">
            {showQuorum && data.status.quorum && (
              <div className={`${compactView ? 'p-2' : 'p-3'} bg-gray-50 dark:bg-gray-700 rounded-lg`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Quorum</div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    data.status.quorum.quorate ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {data.status.quorum.quorate ? 'Quorate' : 'Not Quorate'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Node: {data.status.quorum.node}
                  {data.status.quorum.local && ' (local)'}
                </div>
              </div>
            )}
            {showManagerStatus && data.status.manager_status && (
              <div className={`${compactView ? 'p-2' : 'p-3'} bg-gray-50 dark:bg-gray-700 rounded-lg`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">HA Manager</div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    data.status.manager_status.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {data.status.manager_status.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Master: {data.status.manager_status.master_node}
                </div>
              </div>
            )}
          </div>
        )}

        {/* HA Resources */}
        {showResources && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              HA Resources ({filteredResources.length})
            </h4>
            {filteredResources.length > 0 ? (
              <div className={`space-y-${compactView ? '1' : '2'}`}>
                {filteredResources.map((resource) => {
                  const parsed = parseResourceSid(resource.sid);
                  return (
                    <div
                      key={resource.sid}
                      className={`${compactView ? 'p-2' : 'p-3'} border border-gray-200 dark:border-gray-700 rounded-lg`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded uppercase">
                              {parsed.type}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {parsed.id}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Node: {resource.node}
                            {resource.group && ` • Group: ${resource.group}`}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStateBadge(resource.state)}`}>
                          {resource.state}
                        </span>
                      </div>
                      {!compactView && (resource.request_state || resource.max_restart || resource.max_relocate) && (
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          {resource.request_state && resource.request_state !== resource.state && (
                            <span>Requested: {resource.request_state}</span>
                          )}
                          {resource.max_restart !== undefined && (
                            <span>Max restart: {resource.max_restart}</span>
                          )}
                          {resource.max_relocate !== undefined && (
                            <span>Max relocate: {resource.max_relocate}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                {data?.resources.length === 0 ? 'No HA resources configured' : 'No resources match filter'}
              </p>
            )}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
