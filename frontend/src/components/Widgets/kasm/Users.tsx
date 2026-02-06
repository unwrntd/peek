import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface KasmUser {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  locked: boolean;
  disabled: boolean;
  last_session: string;
  groups: Array<{ name: string }>;
}

interface UsersData {
  users: KasmUser[];
}

interface UsersWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatLastSeen(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 5) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function UserIcon({ disabled, locked }: { disabled: boolean; locked: boolean }) {
  if (locked) {
    return (
      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
    );
  }
  if (disabled) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}

export function Users({ integrationId, config, widgetId }: UsersWidgetProps) {
  const { data, loading, error } = useWidgetData<UsersData>({
    integrationId,
    metric: 'users',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const users = data?.users || [];
  const search = (config.search as string) || '';
  const showDisabled = config.showDisabled !== false;
  const showGroups = config.showGroups !== false;

  const filteredUsers = useMemo(() => {
    let result = users;

    if (!showDisabled) {
      result = result.filter(u => !u.disabled);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(u =>
        u.username?.toLowerCase().includes(searchLower) ||
        u.first_name?.toLowerCase().includes(searchLower) ||
        u.last_name?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [users, search, showDisabled]);

  const activeCount = users.filter(u => !u.disabled && !u.locked).length;

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary header */}
        <div className="px-3 py-2 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {users.length} users
            </span>
            <span className="text-xs text-green-400">
              {activeCount} active
            </span>
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-800/30">
            {filteredUsers.map((user) => (
              <div
                key={user.user_id}
                className={`px-3 py-2 hover:bg-gray-800/20 ${user.disabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <UserIcon disabled={user.disabled} locked={user.locked} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {user.username}
                      </span>
                      {user.locked && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                          Locked
                        </span>
                      )}
                      {user.disabled && !user.locked && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    {(user.first_name || user.last_name) && (
                      <div className="text-xs text-gray-500">
                        {user.first_name} {user.last_name}
                      </div>
                    )}
                    {showGroups && user.groups && user.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.groups.slice(0, 3).map((group, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-700/50 text-gray-400 rounded">
                            {group.name}
                          </span>
                        ))}
                        {user.groups.length > 3 && (
                          <span className="text-xs text-gray-500">+{user.groups.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatLastSeen(user.last_session)}
                  </div>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                {search ? 'No users match your search' : 'No users found'}
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
