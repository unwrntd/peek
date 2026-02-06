import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface KasmZone {
  zone_id: string;
  zone_name: string;
  upstream_auth_address: string;
  proxy_hostname: string;
  proxy_port: number;
  allow_origin_domain: string;
  search_dns: boolean;
  num_agents: number;
  num_sessions: number;
}

interface ZonesData {
  zones: KasmZone[];
}

interface ZonesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function ZoneIcon({ numAgents }: { numAgents: number }) {
  if (numAgents === 0) {
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    </div>
  );
}

export function Zones({ integrationId, config, widgetId }: ZonesWidgetProps) {
  const { data, loading, error } = useWidgetData<ZonesData>({
    integrationId,
    metric: 'zones',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const zones = data?.zones || [];
  const search = (config.search as string) || '';

  const filteredZones = useMemo(() => {
    if (!search) return zones;
    const searchLower = search.toLowerCase();
    return zones.filter(z =>
      z.zone_name?.toLowerCase().includes(searchLower) ||
      z.proxy_hostname?.toLowerCase().includes(searchLower)
    );
  }, [zones, search]);

  const totalAgents = zones.reduce((sum, z) => sum + (z.num_agents || 0), 0);
  const totalSessions = zones.reduce((sum, z) => sum + (z.num_sessions || 0), 0);

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary header */}
        <div className="px-3 py-2 border-b border-gray-700/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {zones.length} {zones.length === 1 ? 'zone' : 'zones'}
            </span>
            <div className="flex gap-3">
              <span className="text-xs text-blue-400">
                {totalAgents} agents
              </span>
              <span className="text-xs text-green-400">
                {totalSessions} sessions
              </span>
            </div>
          </div>
        </div>

        {/* Zones list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-800/30">
            {filteredZones.map((zone) => (
              <div
                key={zone.zone_id}
                className="px-3 py-3 hover:bg-gray-800/20"
              >
                <div className="flex items-start gap-3">
                  <ZoneIcon numAgents={zone.num_agents} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {zone.zone_name}
                      </span>
                      {zone.num_agents === 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                          No agents
                        </span>
                      )}
                    </div>
                    {zone.proxy_hostname && (
                      <div className="text-xs text-gray-500 mt-1">
                        {zone.proxy_hostname}:{zone.proxy_port}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                        {zone.num_agents} {zone.num_agents === 1 ? 'agent' : 'agents'}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                        {zone.num_sessions} {zone.num_sessions === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredZones.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                {search ? 'No zones match your search' : 'No zones found'}
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
