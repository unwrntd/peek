import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';

interface ArpEntry {
  id: string;
  address: string;
  macAddress: string;
  interface: string;
  dynamic: boolean;
  complete: boolean;
  disabled: boolean;
  published: boolean;
}

interface ArpWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function Arp({ integrationId, config, widgetId }: ArpWidgetProps) {
  const { rIP, rMAC } = useRedact();
  const { data, loading, error } = useWidgetData<{ arpTable: ArpEntry[] }>({
    integrationId,
    metric: 'arp',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};

  const filteredEntries = useMemo(() => {
    if (!data?.arpTable) return [];

    return data.arpTable.filter(entry => {
      if (filters.interface && entry.interface !== filters.interface) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!entry.address.toLowerCase().includes(search) &&
            !entry.macAddress.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  if (!data?.arpTable?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <p className="text-sm">No ARP entries found</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredEntries.map(entry => (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border ${
                  entry.complete ? 'border-green-500/30' : 'border-yellow-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-medium text-white">{rIP(entry.address)}</span>
                  <div className={`w-2 h-2 rounded-full ${entry.complete ? 'bg-green-400' : 'bg-yellow-400'}`} />
                </div>

                <p className="text-xs font-mono text-gray-500 mb-2">{rMAC(entry.macAddress)}</p>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{entry.interface}</span>
                  <span className={`px-1.5 py-0.5 rounded ${
                    entry.dynamic
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {entry.dynamic ? 'Dynamic' : 'Static'}
                  </span>
                </div>
              </div>
            ))}
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
              <th className="text-left p-2 font-medium">IP Address</th>
              <th className="text-left p-2 font-medium">MAC Address</th>
              <th className="text-left p-2 font-medium">Interface</th>
              <th className="text-center p-2 font-medium">Type</th>
              <th className="text-center p-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(entry => (
              <tr
                key={entry.id}
                className={`border-t border-gray-700/50 hover:bg-gray-800/50 ${entry.disabled ? 'opacity-50' : ''}`}
              >
                <td className="p-2 font-mono text-white">{rIP(entry.address)}</td>
                <td className="p-2 font-mono text-xs text-gray-400">{rMAC(entry.macAddress)}</td>
                <td className="p-2 text-xs text-gray-400">{entry.interface}</td>
                <td className="p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    entry.dynamic
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {entry.dynamic ? 'Dynamic' : 'Static'}
                  </span>
                </td>
                <td className="p-2 text-center">
                  {entry.complete ? (
                    <span className="text-xs text-green-400">Complete</span>
                  ) : (
                    <span className="text-xs text-yellow-400">Incomplete</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
