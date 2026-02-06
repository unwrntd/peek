import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface ACLProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TailscaleACL {
  acls: Array<{
    action: 'accept';
    src: string[];
    dst: string[];
  }>;
  groups?: Record<string, string[]>;
  tagOwners?: Record<string, string[]>;
  autoApprovers?: {
    routes?: Record<string, string[]>;
    exitNode?: string[];
  };
  ssh?: Array<{
    action: 'accept' | 'check';
    src: string[];
    dst: string[];
    users: string[];
  }>;
  tests?: Array<{
    src: string;
    accept?: string[];
    deny?: string[];
  }>;
}

interface ACLSummary {
  aclRules: number;
  groups: number;
  tagOwners: number;
  sshRules: number;
  tests: number;
  hasAutoApprovers: boolean;
}

interface ACLData {
  acl: TailscaleACL | null;
  summary: ACLSummary;
}

export function ACL({ integrationId, config, widgetId }: ACLProps) {
  const { data, loading, error } = useWidgetData<ACLData>({
    integrationId,
    metric: 'acl',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const showRules = config.showRules !== false;
  const showGroups = config.showGroups !== false;
  const showTagOwners = config.showTagOwners !== false;
  const showSSHRules = config.showSSHRules !== false;
  const showAutoApprovers = config.showAutoApprovers !== false;
  const visualizationType = (config.visualization as string) || 'cards';
  const metricSize = (config.metricSize as string) || 'medium';

  const summary = data?.summary;
  const acl = data?.acl;

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
      {showRules && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">ACL Rules</div>
          <div className={`${getMetricSizeClass()} font-bold text-blue-600 dark:text-blue-400`}>
            {summary?.aclRules || 0}
          </div>
        </div>
      )}

      {showGroups && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Groups</div>
          <div className={`${getMetricSizeClass()} font-bold text-purple-600 dark:text-purple-400`}>
            {summary?.groups || 0}
          </div>
        </div>
      )}

      {showTagOwners && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Tag Owners</div>
          <div className={`${getMetricSizeClass()} font-bold text-green-600 dark:text-green-400`}>
            {summary?.tagOwners || 0}
          </div>
        </div>
      )}

      {showSSHRules && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">SSH Rules</div>
          <div className={`${getMetricSizeClass()} font-bold text-orange-600 dark:text-orange-400`}>
            {summary?.sshRules || 0}
          </div>
        </div>
      )}

      {showAutoApprovers && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Auto-approvers</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              summary?.hasAutoApprovers
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {summary?.hasAutoApprovers ? 'Configured' : 'Not Configured'}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const renderDetailedView = () => (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {showRules && (
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary?.aclRules || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Rules</div>
          </div>
        )}
        {showGroups && (
          <div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{summary?.groups || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Groups</div>
          </div>
        )}
        {showSSHRules && (
          <div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{summary?.sshRules || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">SSH Rules</div>
          </div>
        )}
      </div>

      {/* Groups list */}
      {showGroups && acl?.groups && Object.keys(acl.groups).length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Groups</div>
          <div className="space-y-1">
            {Object.entries(acl.groups).slice(0, 5).map(([group, members]) => (
              <div key={group} className="flex items-center justify-between text-sm">
                <span className="font-mono text-gray-700 dark:text-gray-300">{group}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{members.length} members</span>
              </div>
            ))}
            {Object.keys(acl.groups).length > 5 && (
              <div className="text-xs text-gray-400">
                +{Object.keys(acl.groups).length - 5} more groups
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tag owners list */}
      {showTagOwners && acl?.tagOwners && Object.keys(acl.tagOwners).length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Tag Owners</div>
          <div className="flex flex-wrap gap-1">
            {Object.keys(acl.tagOwners).slice(0, 8).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-mono">
                {tag}
              </span>
            ))}
            {Object.keys(acl.tagOwners).length > 8 && (
              <span className="text-xs text-gray-400">+{Object.keys(acl.tagOwners).length - 8} more</span>
            )}
          </div>
        </div>
      )}

      {/* SSH rules preview */}
      {showSSHRules && acl?.ssh && acl.ssh.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">SSH Rules</div>
          <div className="space-y-1">
            {acl.ssh.slice(0, 3).map((rule, index) => (
              <div key={index} className="text-xs bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                <span className={`font-medium ${rule.action === 'accept' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {rule.action.toUpperCase()}
                </span>
                <span className="text-gray-500 dark:text-gray-400"> from </span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{rule.src.join(', ')}</span>
                <span className="text-gray-500 dark:text-gray-400"> to </span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{rule.dst.join(', ')}</span>
              </div>
            ))}
            {acl.ssh.length > 3 && (
              <div className="text-xs text-gray-400">+{acl.ssh.length - 3} more SSH rules</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (!data && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm">ACL policy not available</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <>
          {visualizationType === 'detailed' ? renderDetailedView() : renderCardsView()}
        </>
      )}
    </BaseWidget>
  );
}
