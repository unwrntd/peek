import { useWidgetData } from '../../../hooks/useWidgetData';
import { BaseWidget } from '../BaseWidget';

interface PowerStatusProps {
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

export function PowerStatus({ integrationId, config, widgetId }: PowerStatusProps) {
  const { data, loading, error } = useWidgetData<AtxData>({
    integrationId,
    metric: 'atx',
    refreshInterval: (config.refreshInterval as number) || 5000,
    widgetId,
  });

  const showPowerLed = config.showPowerLed !== false;
  const showHddLed = config.showHddLed !== false;
  const showAtxStatus = config.showAtxStatus !== false;
  const hideLabels = config.hideLabels === true;

  const atx = data?.atx;
  const powerOn = atx?.leds?.power;
  const atxEnabled = atx?.enabled;

  return (
    <BaseWidget loading={loading} error={error}>
      {atx && (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          {/* Show notice if ATX is not enabled */}
          {!atxEnabled && (
            <div className="text-center px-4">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ATX Board Not Connected
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Power status requires the optional ATX power board
              </p>
            </div>
          )}

          {/* Show power status if ATX is enabled */}
          {atxEnabled && (
            <>
              {/* Main power indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    powerOn
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  <svg
                    className={`w-8 h-8 ${
                      powerOn
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                {!hideLabels && (
                  <span
                    className={`mt-2 text-lg font-semibold ${
                      powerOn
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {powerOn ? 'Power On' : 'Power Off'}
                  </span>
                )}
              </div>

              {/* LED indicators */}
              <div className="flex gap-6">
                {showPowerLed && (
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        atx.leds.power
                          ? 'bg-green-500 shadow-sm shadow-green-500/50'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                    {!hideLabels && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">PWR</span>
                    )}
                  </div>
                )}
                {showHddLed && (
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        atx.leds.hdd
                          ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                    {!hideLabels && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">HDD</span>
                    )}
                  </div>
                )}
              </div>

              {/* ATX status */}
              {showAtxStatus && !hideLabels && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ATX: {atx.enabled ? 'Enabled' : 'Disabled'}
                  {atx.busy && ' (Busy)'}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
