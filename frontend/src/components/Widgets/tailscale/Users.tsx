import React, { useMemo } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface UsersProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface TailscaleUser {
  id: string;
  loginName: string;
  displayName: string;
  profilePicURL: string;
  tailnetId: string;
  created: string;
  type: 'member' | 'shared' | 'tagged';
  role: 'owner' | 'admin' | 'it-admin' | 'network-admin' | 'billing-admin' | 'auditor' | 'member';
  status: 'active' | 'idle' | 'suspended';
  deviceCount: number;
  lastSeen?: string;
  currentlyConnected: boolean;
}

interface UsersData {
  users: TailscaleUser[];
}

function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
    case 'admin':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    case 'it-admin':
    case 'network-admin':
    case 'billing-admin':
      return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400';
    case 'auditor':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
  }
}

function formatRole(role: string): string {
  return role.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function Users({ integrationId, config, widgetId }: UsersProps) {
  const { data, loading, error } = useWidgetData<UsersData>({
    integrationId,
    metric: 'users',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const roleFilter = config.role as string;
  const searchFilter = config.search as string;
  const showRole = config.showRole !== false;
  const showStatus = config.showStatus !== false;
  const showDeviceCount = config.showDeviceCount !== false;
  const showLastSeen = config.showLastSeen !== false;
  const hideLabels = config.hideLabels as boolean;
  const visualizationType = (config.visualization as string) || 'table';

  const filteredUsers = useMemo(() => {
    let users = data?.users || [];

    // Filter by role
    if (roleFilter) {
      users = users.filter(u => u.role === roleFilter);
    }

    // Filter by search
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      users = users.filter(u =>
        u.loginName.toLowerCase().includes(search) ||
        u.displayName.toLowerCase().includes(search)
      );
    }

    return users;
  }, [data?.users, roleFilter, searchFilter]);

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 font-medium">User</th>
            {showRole && <th className="py-2 font-medium">Role</th>}
            {showStatus && <th className="py-2 font-medium">Status</th>}
            {showDeviceCount && <th className="py-2 font-medium">Devices</th>}
            {showLastSeen && <th className="py-2 font-medium">Last Seen</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredUsers.map(user => (
            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="py-2">
                <div className="flex items-center gap-2">
                  {user.profilePicURL && (
                    <img
                      src={user.profilePicURL}
                      alt=""
                      className="w-6 h-6 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{user.displayName || user.loginName}</div>
                    {user.displayName && user.displayName !== user.loginName && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{user.loginName}</div>
                    )}
                  </div>
                </div>
              </td>
              {showRole && (
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeClasses(user.role)}`}>
                    {formatRole(user.role)}
                  </span>
                </td>
              )}
              {showStatus && (
                <td className="py-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    user.currentlyConnected
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : user.status === 'active'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      user.currentlyConnected ? 'bg-green-500' : user.status === 'active' ? 'bg-gray-400' : 'bg-red-500'
                    }`} />
                    {user.currentlyConnected ? 'Connected' : user.status}
                  </span>
                </td>
              )}
              {showDeviceCount && (
                <td className="py-2 text-gray-600 dark:text-gray-300">{user.deviceCount || 0}</td>
              )}
              {showLastSeen && (
                <td className="py-2 text-gray-600 dark:text-gray-300">{formatRelativeTime(user.lastSeen)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCardsView = () => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {filteredUsers.map(user => (
        <div key={user.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-start gap-3 mb-2">
            {user.profilePicURL && (
              <img
                src={user.profilePicURL}
                alt=""
                className="w-10 h-10 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900 dark:text-white">{user.displayName || user.loginName}</div>
                {showRole && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeClasses(user.role)}`}>
                    {formatRole(user.role)}
                  </span>
                )}
              </div>
              {user.displayName && user.displayName !== user.loginName && (
                <div className="text-xs text-gray-500 dark:text-gray-400">{user.loginName}</div>
              )}
            </div>
          </div>

          <div className="space-y-1 text-sm">
            {showStatus && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span className={`inline-flex items-center gap-1 ${
                  user.currentlyConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${user.currentlyConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {user.currentlyConnected ? 'Connected' : user.status}
                </span>
              </div>
            )}
            {showDeviceCount && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Devices</span>
                <span className="text-gray-700 dark:text-gray-300">{user.deviceCount || 0}</span>
              </div>
            )}
            {showLastSeen && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Last Seen</span>
                <span className="text-gray-700 dark:text-gray-300">{formatRelativeTime(user.lastSeen)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (!data?.users?.length && !loading) {
    return (
      <BaseWidget loading={false} error={null}>
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <p className="text-sm">No users found</p>
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
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {filteredUsers.filter(u => u.currentlyConnected).length} connected
              </span>
            </div>
          )}
          {visualizationType === 'cards' ? renderCardsView() : renderTableView()}
        </div>
      )}
    </BaseWidget>
  );
}
