import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface VulnerabilityItem {
  cve?: string;
  name?: string;
  severity?: string;
  cvss3_score?: number;
  agentName?: string;
  agentId?: string;
}

interface VulnerabilitiesData {
  vulnerabilities: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    agentsScanned: number;
    items: VulnerabilityItem[];
  };
}

interface VulnerabilitiesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function getSeverityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-red-600 text-red-100';
    case 'high':
      return 'bg-orange-500 text-orange-100';
    case 'medium':
      return 'bg-yellow-500 text-yellow-100';
    case 'low':
      return 'bg-blue-500 text-blue-100';
    default:
      return 'bg-gray-500 text-gray-100';
  }
}

export function Vulnerabilities({ integrationId, config, widgetId }: VulnerabilitiesWidgetProps) {
  const { data, loading, error } = useWidgetData<VulnerabilitiesData>({
    integrationId,
    metric: 'vulnerabilities',
    refreshInterval: (config.refreshInterval as number) || 300000, // 5 min default
    widgetId,
  });

  const vulnerabilities = data?.vulnerabilities;
  const severityFilter = (config.severityFilter as string) || '';

  const filteredItems = useMemo(() => {
    if (!vulnerabilities?.items) return [];
    if (!severityFilter) return vulnerabilities.items.slice(0, 20);
    return vulnerabilities.items
      .filter(item => item.severity?.toLowerCase() === severityFilter.toLowerCase())
      .slice(0, 20);
  }, [vulnerabilities?.items, severityFilter]);

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        {/* Summary */}
        {vulnerabilities && (
          <div className="mb-4">
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="bg-red-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-red-400">{vulnerabilities.bySeverity.critical}</div>
                <div className="text-xs text-red-300">Critical</div>
              </div>
              <div className="bg-orange-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-orange-400">{vulnerabilities.bySeverity.high}</div>
                <div className="text-xs text-orange-300">High</div>
              </div>
              <div className="bg-yellow-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-yellow-400">{vulnerabilities.bySeverity.medium}</div>
                <div className="text-xs text-yellow-300">Medium</div>
              </div>
              <div className="bg-blue-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-blue-400">{vulnerabilities.bySeverity.low}</div>
                <div className="text-xs text-blue-300">Low</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Total: {vulnerabilities.total}</span>
              <span>Agents scanned: {vulnerabilities.agentsScanned}</span>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredItems.map((vuln, idx) => (
            <div
              key={`${vuln.cve || idx}-${vuln.agentId}`}
              className="bg-gray-800/50 rounded-lg p-2 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-white text-sm truncate">
                  {vuln.cve || vuln.name || 'Unknown'}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(vuln.severity || '')}`}>
                  {vuln.severity || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Agent: {vuln.agentName || 'N/A'}</span>
                {vuln.cvss3_score !== undefined && (
                  <span>CVSS: {vuln.cvss3_score.toFixed(1)}</span>
                )}
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              {severityFilter ? 'No vulnerabilities match filter' : 'No vulnerabilities found'}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
