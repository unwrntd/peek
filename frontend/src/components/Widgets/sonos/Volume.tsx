import React, { useState, useCallback } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface SonosVolume {
  volume: number;
  muted: boolean;
  fixed: boolean;
}

interface GroupVolume {
  groupId: string;
  groupName: string;
  volume: SonosVolume;
}

interface VolumeData {
  volumes: GroupVolume[];
}

interface VolumeProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Volume({ integrationId, config, widgetId }: VolumeProps) {
  const [isControlling, setIsControlling] = useState<string | null>(null);

  const { data, loading, error, refetch } = useWidgetData<VolumeData>({
    integrationId,
    metric: 'volume',
    refreshInterval: (config.refreshInterval as number) || 10000,
    widgetId,
  });

  const selectedGroup = config.selectedGroup as string | undefined;
  const showGroupName = config.showGroupName !== false;
  const showMuteButton = config.showMuteButton !== false;
  const compactView = config.compactView === true;

  const handleVolumeChange = useCallback(async (groupId: string, volume: number) => {
    if (isControlling) return;
    setIsControlling(groupId);
    try {
      const response = await fetch(`/api/sonos-control/${integrationId}/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, volume }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 200);
      }
    } catch (err) {
      console.error('Failed to set volume:', err);
    } finally {
      setIsControlling(null);
    }
  }, [integrationId, isControlling, refetch]);

  const handleMuteToggle = useCallback(async (groupId: string, muted: boolean) => {
    if (isControlling) return;
    setIsControlling(groupId);
    try {
      const response = await fetch(`/api/sonos-control/${integrationId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, muted }),
      });
      if (response.ok) {
        setTimeout(() => refetch(), 200);
      }
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    } finally {
      setIsControlling(null);
    }
  }, [integrationId, isControlling, refetch]);

  // Filter volumes
  let volumes = data?.volumes || [];
  if (selectedGroup) {
    volumes = volumes.filter(v =>
      v.groupName.toLowerCase().includes(selectedGroup.toLowerCase()) ||
      v.groupId === selectedGroup
    );
  }

  // Filter out fixed volume groups (like soundbars in certain modes)
  volumes = volumes.filter(v => !v.volume.fixed);

  return (
    <BaseWidget loading={loading} error={error}>
      {volumes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <p className="text-sm">No adjustable volumes</p>
        </div>
      ) : (
        <div className={compactView ? 'space-y-3' : 'space-y-4'}>
          {volumes.map((groupVol) => {
            const isThisControlling = isControlling === groupVol.groupId;

            return (
              <div key={groupVol.groupId} className="space-y-1">
                {showGroupName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {groupVol.groupName}
                    </span>
                    <span className={`text-xs tabular-nums ${groupVol.volume.muted ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      {groupVol.volume.muted ? 'Muted' : `${groupVol.volume.volume}%`}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {showMuteButton && (
                    <button
                      onClick={() => handleMuteToggle(groupVol.groupId, !groupVol.volume.muted)}
                      disabled={isThisControlling}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        groupVol.volume.muted
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {groupVol.volume.muted ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        )}
                      </svg>
                    </button>
                  )}

                  <div className="flex-1 relative">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={groupVol.volume.volume}
                      onChange={(e) => handleVolumeChange(groupVol.groupId, parseInt(e.target.value))}
                      disabled={isThisControlling || groupVol.volume.muted}
                      className={`w-full h-2 rounded-full appearance-none cursor-pointer transition-opacity
                        ${groupVol.volume.muted ? 'opacity-50' : ''}
                        bg-gray-200 dark:bg-gray-700
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-4
                        [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:bg-primary-500
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:shadow-md
                        [&::-webkit-slider-thumb]:hover:bg-primary-600
                        [&::-moz-range-thumb]:w-4
                        [&::-moz-range-thumb]:h-4
                        [&::-moz-range-thumb]:bg-primary-500
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:border-none
                        disabled:cursor-not-allowed
                      `}
                      style={{
                        background: groupVol.volume.muted
                          ? undefined
                          : `linear-gradient(to right, rgb(var(--color-primary-500)) ${groupVol.volume.volume}%, rgb(var(--color-gray-200)) ${groupVol.volume.volume}%)`,
                      }}
                    />
                  </div>

                  {!showGroupName && (
                    <span className={`text-xs tabular-nums w-10 text-right ${groupVol.volume.muted ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      {groupVol.volume.muted ? 'Muted' : `${groupVol.volume.volume}%`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BaseWidget>
  );
}
