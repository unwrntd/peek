import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface KasmSession {
  kasm_id: string;
  operational_status: string;
}

interface SessionsData {
  sessions: KasmSession[];
}

interface SessionCountWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function SessionCount({ integrationId, config, widgetId }: SessionCountWidgetProps) {
  const { data, loading, error } = useWidgetData<SessionsData>({
    integrationId,
    metric: 'sessions',
    refreshInterval: (config.refreshInterval as number) || 15000,
    widgetId,
  });

  const sessions = data?.sessions || [];
  const runningCount = sessions.filter(s => s.operational_status === 'running').length;
  const isMetricSize = config.metricSize === true;

  if (isMetricSize) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <svg className="w-8 h-8 text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <div className="text-3xl font-bold text-white">{sessions.length}</div>
          <div className="text-sm text-gray-400">Active Sessions</div>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="text-4xl font-bold text-white mb-1">{sessions.length}</div>
        <div className="text-sm text-gray-400 mb-2">Active Sessions</div>
        {sessions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-500">{runningCount} running</span>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
