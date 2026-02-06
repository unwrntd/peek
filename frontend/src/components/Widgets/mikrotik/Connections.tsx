import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';
import { useRedact } from '../../../hooks/useRedact';

interface Connection {
  id: string;
  protocol: string;
  srcAddress: string;
  dstAddress: string;
  replySrcAddress: string;
  replyDstAddress: string;
  tcpState: string | null;
  timeout: string;
  origBytes: number;
  replBytes: number;
  origPackets: number;
  replPackets: number;
}

interface ConnectionsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getProtocolColor(protocol: string): string {
  switch (protocol.toLowerCase()) {
    case 'tcp':
      return 'bg-blue-500/20 text-blue-400';
    case 'udp':
      return 'bg-green-500/20 text-green-400';
    case 'icmp':
      return 'bg-purple-500/20 text-purple-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export function Connections({ integrationId, config, widgetId }: ConnectionsWidgetProps) {
  const { rIP } = useRedact();
  const { data, loading, error } = useWidgetData<{ connections: Connection[]; totalConnections: number }>({
    integrationId,
    metric: 'connections',
    refreshInterval: (config.refreshInterval as number) || 30000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'table';
  const filters = (config.filters as Record<string, string>) || {};
  const maxItems = parseInt(filters.maxItems || '100', 10);

  const filteredConnections = useMemo(() => {
    if (!data?.connections) return [];

    let result = data.connections;

    if (filters.protocol) {
      result = result.filter(c => c.protocol.toLowerCase() === filters.protocol.toLowerCase());
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(c =>
        c.srcAddress.toLowerCase().includes(search) ||
        c.dstAddress.toLowerCase().includes(search)
      );
    }

    return result.slice(0, maxItems);
  }, [data, filters, maxItems]);

  if (!data?.connections?.length) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-sm">No active connections</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'summary') {
    const byProtocol = useMemo(() => {
      const groups: Record<string, { count: number; bytes: number }> = {};
      data.connections.forEach(conn => {
        const proto = conn.protocol.toUpperCase();
        if (!groups[proto]) {
          groups[proto] = { count: 0, bytes: 0 };
        }
        groups[proto].count++;
        groups[proto].bytes += conn.origBytes + conn.replBytes;
      });
      return groups;
    }, [data.connections]);

    const total = data.totalConnections;

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto p-4">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-white">{total.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Total Connections</div>
          </div>

          <div className="space-y-3">
            {Object.entries(byProtocol)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([protocol, stats]) => {
                const percentage = (stats.count / total) * 100;

                return (
                  <div key={protocol} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-0.5 rounded ${getProtocolColor(protocol)}`}>
                        {protocol}
                      </span>
                      <span className="text-white">{stats.count.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${protocol === 'TCP' ? 'bg-blue-500' : protocol === 'UDP' ? 'bg-green-500' : 'bg-purple-500'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 text-right">{formatBytes(stats.bytes)}</div>
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
        <div className="sticky top-0 bg-gray-800 p-2 text-xs text-gray-400 border-b border-gray-700">
          Showing {filteredConnections.length} of {data.totalConnections} connections
        </div>
        <table className="w-full text-sm">
          <thead className="sticky top-8 bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left p-2 font-medium">Protocol</th>
              <th className="text-left p-2 font-medium">Source</th>
              <th className="text-center p-2 font-medium"></th>
              <th className="text-left p-2 font-medium">Destination</th>
              <th className="text-left p-2 font-medium">State</th>
              <th className="text-right p-2 font-medium">Traffic</th>
            </tr>
          </thead>
          <tbody>
            {filteredConnections.map(conn => (
              <tr key={conn.id} className="border-t border-gray-700/50 hover:bg-gray-800/50">
                <td className="p-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getProtocolColor(conn.protocol)}`}>
                    {conn.protocol.toUpperCase()}
                  </span>
                </td>
                <td className="p-2 font-mono text-xs text-white">{rIP(conn.srcAddress)}</td>
                <td className="p-2 text-center text-gray-500">→</td>
                <td className="p-2 font-mono text-xs text-white">{rIP(conn.dstAddress)}</td>
                <td className="p-2 text-xs text-gray-400">{conn.tcpState || '-'}</td>
                <td className="p-2 text-right">
                  <div className="text-xs">
                    <span className="text-blue-400">{formatBytes(conn.origBytes)}</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="text-green-400">{formatBytes(conn.replBytes)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseWidget>
  );
}
