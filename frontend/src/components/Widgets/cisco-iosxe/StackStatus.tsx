import React from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface StackStatusProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface StackMember {
  switchNumber: number;
  role: 'active' | 'standby' | 'member';
  priority: number;
  state: 'ready' | 'provisioned' | 'syncing' | 'version-mismatch' | 'invalid';
  macAddress: string;
  model?: string;
}

interface StackData {
  members: StackMember[];
}

export function StackStatus({ integrationId, config, widgetId }: StackStatusProps) {
  const { data, loading, error } = useWidgetData<StackData>({
    integrationId,
    metric: (config.metric as string) || 'stack',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const compactView = config.compactView === true;
  const hideLabels = (config.hideLabels as boolean) || false;
  const showSwitchNumber = config.showSwitchNumber !== false;
  const showRole = config.showRole !== false;
  const showPriority = config.showPriority !== false;
  const showState = config.showState !== false;
  const showMac = config.showMac !== false;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'standby':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'member':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'ready':
        return 'text-green-600 dark:text-green-400';
      case 'syncing':
        return 'text-blue-600 dark:text-blue-400';
      case 'provisioned':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'version-mismatch':
      case 'invalid':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const sortedMembers = [...(data?.members || [])].sort((a, b) => {
    const roleOrder = { active: 0, standby: 1, member: 2 };
    const aOrder = roleOrder[a.role] ?? 3;
    const bOrder = roleOrder[b.role] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.switchNumber - b.switchNumber;
  });

  return (
    <BaseWidget loading={loading} error={error}>
      {data && (
        <div className={`${compactView ? 'p-1' : 'p-2'} overflow-auto h-full`}>
          {sortedMembers.length > 0 ? (
            <table className="w-full text-sm">
              <thead className={`${hideLabels ? 'hidden' : ''}`}>
                <tr className="text-gray-500 dark:text-gray-400 text-xs border-b border-gray-200 dark:border-gray-700">
                  {showSwitchNumber && (
                    <th className="text-left py-2 px-2">#</th>
                  )}
                  {showRole && (
                    <th className="text-left py-2 px-2">Role</th>
                  )}
                  {showPriority && (
                    <th className="text-center py-2 px-2">Priority</th>
                  )}
                  {showState && (
                    <th className="text-center py-2 px-2">State</th>
                  )}
                  {showMac && (
                    <th className="text-right py-2 px-2">MAC</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((member) => (
                  <tr
                    key={member.switchNumber}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    {showSwitchNumber && (
                      <td className="py-2 px-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {member.switchNumber}
                        </span>
                        {member.model && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            ({member.model})
                          </span>
                        )}
                      </td>
                    )}
                    {showRole && (
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                      </td>
                    )}
                    {showPriority && (
                      <td className="py-2 px-2 text-center text-gray-700 dark:text-gray-300">
                        {member.priority}
                      </td>
                    )}
                    {showState && (
                      <td className={`py-2 px-2 text-center ${getStateColor(member.state)}`}>
                        {member.state}
                      </td>
                    )}
                    {showMac && (
                      <td className="py-2 px-2 text-right font-mono text-xs text-gray-600 dark:text-gray-400">
                        {member.macAddress}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No stack members found (standalone switch)
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
