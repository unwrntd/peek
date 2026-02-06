import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';

interface WirelessClient {
  id: string;
  interface: string;
  macAddress: string;
  ap: boolean;
  uptime: string;
  lastActivity: string;
  signalStrength: string;
  signalToNoise: string;
  txRate: string;
  rxRate: string;
  packets: string;
  bytes: string;
}

interface WirelessClientsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getSignalColor(signal: string): string {
  const value = parseInt(signal?.replace('dBm', '') || '-100', 10);
  if (value >= -50) return 'text-green-400';
  if (value >= -60) return 'text-green-400';
  if (value >= -70) return 'text-yellow-400';
  if (value >= -80) return 'text-orange-400';
  return 'text-red-400';
}

function getSignalBars(signal: string): number {
  const value = parseInt(signal?.replace('dBm', '') || '-100', 10);
  if (value >= -50) return 4;
  if (value >= -60) return 3;
  if (value >= -70) return 2;
  if (value >= -80) return 1;
  return 0;
}

function SignalBars({ signal }: { signal: string }) {
  const bars = getSignalBars(signal);

  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={`w-1 rounded-sm ${i <= bars ? 'bg-green-400' : 'bg-gray-600'}`}
          style={{ height: `${i * 25}%` }}
        />
      ))}
    </div>
  );
}

export function WirelessClients({ integrationId, config, widgetId }: WirelessClientsWidgetProps) {
  const { rMAC } = useRedact();
  const { data, loading, error } = useWidgetData<{ wirelessClients: WirelessClient[]; message?: string }>({
    integrationId,
    metric: 'wireless-clients',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredClients = useMemo(() => {
    if (!data?.wirelessClients) return [];

    return data.wirelessClients.filter(client => {
      if (filters.interface && client.interface !== filters.interface) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!client.macAddress.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  if (!data?.wirelessClients?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            <p className="text-sm">{data?.message || 'No wireless clients connected'}</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredClients.map(client => (
              <div key={client.id} className="p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-white">{rMAC(client.macAddress)}</span>
                  <SignalBars signal={client.signalStrength} />
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Interface</span>
                    <span className="text-gray-300">{client.interface}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Signal</span>
                    <span className={getSignalColor(client.signalStrength)}>
                      {client.signalStrength}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>TX Rate</span>
                    <span className="text-gray-300">{client.txRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uptime</span>
                    <span className="text-gray-300">{client.uptime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'signal') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="space-y-2">
            {filteredClients
              .sort((a, b) => {
                const sigA = parseInt(a.signalStrength?.replace('dBm', '') || '-100', 10);
                const sigB = parseInt(b.signalStrength?.replace('dBm', '') || '-100', 10);
                return sigB - sigA;
              })
              .map(client => {
                const signal = parseInt(client.signalStrength?.replace('dBm', '') || '-100', 10);
                const barWidth = Math.max(0, Math.min(100, (signal + 100) * 2));

                return (
                  <div key={client.id} className="p-2 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-white">{rMAC(client.macAddress)}</span>
                      <span className={`text-xs font-medium ${getSignalColor(client.signalStrength)}`}>
                        {client.signalStrength}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default table view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left p-2 font-medium">MAC Address</th>
              <th className="text-left p-2 font-medium">Interface</th>
              <th className="text-center p-2 font-medium">Signal</th>
              <th className="text-left p-2 font-medium">Rates</th>
              <th className="text-left p-2 font-medium">Uptime</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(client => (
              <tr key={client.id} className="border-t border-gray-700/50 hover:bg-gray-800/50">
                <td className="p-2 font-mono text-xs text-white">{rMAC(client.macAddress)}</td>
                <td className="p-2 text-gray-300">{client.interface}</td>
                <td className="p-2">
                  <div className="flex items-center justify-center gap-2">
                    <SignalBars signal={client.signalStrength} />
                    <span className={`text-xs ${getSignalColor(client.signalStrength)}`}>
                      {client.signalStrength}
                    </span>
                  </div>
                </td>
                <td className="p-2">
                  <div className="text-xs space-y-0.5">
                    <div className="text-blue-400">TX: {client.txRate}</div>
                    <div className="text-green-400">RX: {client.rxRate}</div>
                  </div>
                </td>
                <td className="p-2 text-xs text-gray-400">{client.uptime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
