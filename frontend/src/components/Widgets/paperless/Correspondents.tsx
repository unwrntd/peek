import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Correspondent {
  id: number;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count: number;
  last_correspondence: string | null;
}

interface CorrespondentsData {
  correspondents: Correspondent[];
  total: number;
}

interface CorrespondentsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Correspondents({ integrationId, config, widgetId }: CorrespondentsWidgetProps) {
  const { data, loading, error } = useWidgetData<CorrespondentsData>({
    integrationId,
    metric: 'correspondents',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const correspondents = data?.correspondents || [];
  const sortedCorrespondents = [...correspondents].sort((a, b) => (b.document_count || 0) - (a.document_count || 0));

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-sm text-gray-400">{data?.total || 0} correspondents</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {sortedCorrespondents.map(correspondent => (
            <div
              key={correspondent.id}
              className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-white truncate">{correspondent.name}</span>
                <span className="text-sm text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                  {correspondent.document_count || 0} docs
                </span>
              </div>
              {correspondent.last_correspondence && (
                <div className="text-xs text-gray-500">
                  Last: {formatDate(correspondent.last_correspondence)}
                </div>
              )}
            </div>
          ))}

          {correspondents.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              No correspondents found
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
