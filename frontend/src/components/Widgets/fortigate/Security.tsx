import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface SecurityData {
  ips: {
    detected: number;
    blocked: number;
    anomalies: number;
  };
  antivirus: {
    scanned: number;
    detected: number;
    blocked: number;
  };
  webfilter: {
    requests: number;
    blocked: number;
    categories: Record<string, number>;
  };
  summary: {
    threatsBlocked: number;
    malwareBlocked: number;
    intrusionsBlocked: number;
  };
}

interface SecurityWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function FortiGateSecurity({ integrationId, config, widgetId }: SecurityWidgetProps) {
  const { data, loading, error } = useWidgetData<SecurityData>({
    integrationId,
    metric: 'security',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'summary';

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Loading security data...</p>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'chart') {
    const categories = [
      { label: 'IPS', detected: data.ips.detected, blocked: data.ips.blocked, color: 'bg-red-500' },
      { label: 'Antivirus', detected: data.antivirus.detected, blocked: data.antivirus.blocked, color: 'bg-orange-500' },
      { label: 'Web Filter', detected: data.webfilter.requests, blocked: data.webfilter.blocked, color: 'bg-yellow-500' },
    ];

    const maxValue = Math.max(...categories.map(c => Math.max(c.detected, c.blocked)));

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-4 overflow-auto">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-red-400">{data.summary.threatsBlocked.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Total Threats Blocked</div>
          </div>

          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{cat.label}</span>
                  <span className="text-gray-500">
                    {cat.blocked.toLocaleString()} blocked
                  </span>
                </div>
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${cat.color} transition-all`}
                    style={{ width: `${maxValue > 0 ? (cat.blocked / maxValue) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'detailed') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full p-4 overflow-auto">
          <div className="space-y-4">
            {/* IPS Section */}
            <div className="bg-gray-700/30 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Intrusion Prevention
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold text-white">{data.ips.detected.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Detected</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-400">{data.ips.blocked.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Blocked</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-yellow-400">{data.ips.anomalies.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Anomalies</div>
                </div>
              </div>
            </div>

            {/* Antivirus Section */}
            <div className="bg-gray-700/30 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Antivirus
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold text-white">{data.antivirus.scanned.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Scanned</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-yellow-400">{data.antivirus.detected.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Detected</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-400">{data.antivirus.blocked.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Blocked</div>
                </div>
              </div>
            </div>

            {/* Web Filter Section */}
            <div className="bg-gray-700/30 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Web Filter
              </h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold text-white">{data.webfilter.requests.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Requests</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-400">{data.webfilter.blocked.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Blocked</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default summary visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full p-4 flex flex-col justify-center">
        <div className="text-center mb-6">
          <div className="text-4xl font-bold text-red-400">{data.summary.threatsBlocked.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Threats Blocked</div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-xl font-semibold text-white">{data.summary.intrusionsBlocked.toLocaleString()}</div>
            <div className="text-xs text-gray-500">IPS</div>
          </div>

          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="text-xl font-semibold text-white">{data.summary.malwareBlocked.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Malware</div>
          </div>

          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div className="text-xl font-semibold text-white">{data.webfilter.blocked.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Web Filter</div>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
