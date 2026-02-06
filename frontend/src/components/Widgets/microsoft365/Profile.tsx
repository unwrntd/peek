import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface ProfileData {
  user: {
    id: string;
    displayName: string;
    mail: string;
    jobTitle?: string;
    department?: string;
    officeLocation?: string;
    mobilePhone?: string;
    photo?: string;
  };
  presence: {
    availability: string;
    activity: string;
  };
  manager?: {
    displayName: string;
    mail: string;
  };
}

interface ProfileWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getPresenceColor(availability: string): string {
  switch (availability.toLowerCase()) {
    case 'available': return 'bg-green-500';
    case 'busy': return 'bg-red-500';
    case 'donotdisturb': return 'bg-red-600';
    case 'berightback':
    case 'away': return 'bg-yellow-500';
    case 'offline': return 'bg-gray-500';
    default: return 'bg-gray-400';
  }
}

function getPresenceLabel(availability: string): string {
  switch (availability.toLowerCase()) {
    case 'available': return 'Available';
    case 'busy': return 'Busy';
    case 'donotdisturb': return 'Do Not Disturb';
    case 'berightback': return 'Be Right Back';
    case 'away': return 'Away';
    case 'offline': return 'Offline';
    default: return availability;
  }
}

export function Profile({ integrationId, config, widgetId }: ProfileWidgetProps) {
  const { data, loading, error } = useWidgetData<ProfileData>({
    integrationId,
    metric: 'profile',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'card';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-sm">Loading profile...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'presence') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="relative mb-3">
            {data.user.photo ? (
              <img
                src={data.user.photo}
                alt={data.user.displayName}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-2xl text-blue-400 font-medium">
                  {data.user.displayName.charAt(0)}
                </span>
              </div>
            )}
            <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-gray-900 ${getPresenceColor(data.presence.availability)}`} />
          </div>
          <div className="text-lg font-medium text-white">{data.user.displayName}</div>
          <div className="text-sm text-gray-400 flex items-center gap-1.5 mt-1">
            <div className={`w-2 h-2 rounded-full ${getPresenceColor(data.presence.availability)}`} />
            {getPresenceLabel(data.presence.availability)}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'detailed') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-shrink-0">
              {data.user.photo ? (
                <img
                  src={data.user.photo}
                  alt={data.user.displayName}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-xl text-blue-400 font-medium">
                    {data.user.displayName.charAt(0)}
                  </span>
                </div>
              )}
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${getPresenceColor(data.presence.availability)}`} />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{data.user.displayName}</div>
              <div className="text-xs text-gray-400">{data.user.mail}</div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-gray-400">
              <div className={`w-2 h-2 rounded-full ${getPresenceColor(data.presence.availability)}`} />
              <span>{getPresenceLabel(data.presence.availability)}</span>
              {data.presence.activity && data.presence.activity !== data.presence.availability && (
                <span className="text-gray-500">({data.presence.activity})</span>
              )}
            </div>

            {data.user.jobTitle && (
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{data.user.jobTitle}</span>
              </div>
            )}

            {data.user.department && (
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{data.user.department}</span>
              </div>
            )}

            {data.user.officeLocation && (
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{data.user.officeLocation}</span>
              </div>
            )}

            {data.manager && (
              <div className="flex items-center gap-2 text-gray-400 pt-2 border-t border-gray-700">
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Reports to: {data.manager.displayName}</span>
              </div>
            )}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default card view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="relative mb-2">
          {data.user.photo ? (
            <img
              src={data.user.photo}
              alt={data.user.displayName}
              className="w-14 h-14 rounded-full"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-xl text-blue-400 font-medium">
                {data.user.displayName.charAt(0)}
              </span>
            </div>
          )}
          <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${getPresenceColor(data.presence.availability)}`} />
        </div>
        <div className="text-sm font-medium text-white text-center">{data.user.displayName}</div>
        {data.user.jobTitle && (
          <div className="text-xs text-gray-500 text-center">{data.user.jobTitle}</div>
        )}
        <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-2">
          <div className={`w-2 h-2 rounded-full ${getPresenceColor(data.presence.availability)}`} />
          {getPresenceLabel(data.presence.availability)}
        </div>
      </div>
    </BaseWidget>
  );
}
