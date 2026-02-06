import { useState } from 'react';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';
import apiClient from '../../../api/client';

interface PowerControlProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

interface PiKVMAtx {
  enabled: boolean;
  busy: boolean;
  leds: {
    power: boolean;
    hdd: boolean;
  };
}

interface AtxData {
  atx: PiKVMAtx;
}

export function PowerControl({ integrationId, config, widgetId }: PowerControlProps) {
  const { data, loading, error, refetch } = useWidgetData<AtxData>({
    integrationId,
    metric: 'atx',
    refreshInterval: (config.refreshInterval as number) || 5000,
    widgetId,
  });

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const showPowerOn = config.showPowerOn !== false;
  const showPowerOff = config.showPowerOff !== false;
  const showForceOff = config.showForceOff !== false;
  const showReset = config.showReset !== false;
  const requireConfirmation = config.requireConfirmation !== false;
  const hideLabels = config.hideLabels === true;

  const atx = data?.atx;
  const powerOn = atx?.leds?.power;

  const executeAction = async (action: string) => {
    if (requireConfirmation && !confirmAction) {
      setConfirmAction(action);
      return;
    }

    setActionLoading(action);
    setConfirmAction(null);

    try {
      await apiClient.post(`/api/integrations/${integrationId}/action`, {
        action,
      });
      // Refetch data after action
      setTimeout(() => refetch(), 1000);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const cancelConfirm = () => {
    setConfirmAction(null);
  };

  const actionButtons = [
    {
      id: 'power_on',
      label: 'Power On',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'green',
      show: showPowerOn,
      disabled: powerOn,
    },
    {
      id: 'power_off',
      label: 'Power Off',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      color: 'amber',
      show: showPowerOff,
      disabled: !powerOn,
    },
    {
      id: 'power_off_hard',
      label: 'Force Off',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      color: 'red',
      show: showForceOff,
      disabled: !powerOn,
    },
    {
      id: 'reset_hard',
      label: 'Reset',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: 'blue',
      show: showReset,
      disabled: !powerOn,
    },
  ];

  const getButtonClasses = (color: string, disabled: boolean) => {
    if (disabled) {
      return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed';
    }
    const colors: Record<string, string> = {
      green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50',
      amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50',
      red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50',
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50',
    };
    return colors[color] || colors.blue;
  };

  return (
    <BaseWidget loading={loading} error={error}>
      {atx && (
        <div className="flex flex-col h-full">
          {/* Power status indicator */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className={`w-4 h-4 rounded-full ${
                powerOn
                  ? 'bg-green-500 shadow-sm shadow-green-500/50'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
            <span
              className={`text-lg font-semibold ${
                powerOn
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {powerOn ? 'Power On' : 'Power Off'}
            </span>
          </div>

          {/* Confirmation dialog */}
          {confirmAction && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                Confirm {actionButtons.find(b => b.id === confirmAction)?.label}?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => executeAction(confirmAction)}
                  className="px-3 py-1 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded"
                >
                  Confirm
                </button>
                <button
                  onClick={cancelConfirm}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 flex-1">
            {actionButtons
              .filter(btn => btn.show)
              .map(btn => (
                <button
                  key={btn.id}
                  onClick={() => executeAction(btn.id)}
                  disabled={btn.disabled || actionLoading !== null || atx.busy}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${getButtonClasses(
                    btn.color,
                    btn.disabled || false
                  )}`}
                >
                  {actionLoading === btn.id ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    btn.icon
                  )}
                  {!hideLabels && (
                    <span className="mt-1 text-xs font-medium">{btn.label}</span>
                  )}
                </button>
              ))}
          </div>

          {/* ATX busy indicator */}
          {atx.busy && (
            <div className="mt-2 text-xs text-center text-amber-600 dark:text-amber-400">
              ATX is busy...
            </div>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
