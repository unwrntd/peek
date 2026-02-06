import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface DocumentType {
  id: number;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  document_count: number;
}

interface DocumentTypesData {
  documentTypes: DocumentType[];
  total: number;
}

interface DocumentTypesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

export function DocumentTypes({ integrationId, config, widgetId }: DocumentTypesWidgetProps) {
  const { data, loading, error } = useWidgetData<DocumentTypesData>({
    integrationId,
    metric: 'document-types',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const documentTypes = data?.documentTypes || [];
  const sortedTypes = [...documentTypes].sort((a, b) => (b.document_count || 0) - (a.document_count || 0));
  const totalDocs = sortedTypes.reduce((sum, dt) => sum + (dt.document_count || 0), 0);

  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-sm text-gray-400">{data?.total || 0} document types</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {sortedTypes.map(docType => {
            const percentage = totalDocs > 0 ? ((docType.document_count || 0) / totalDocs) * 100 : 0;
            return (
              <div
                key={docType.id}
                className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white truncate">{docType.name}</span>
                  <span className="text-sm text-gray-400">
                    {docType.document_count || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}

          {documentTypes.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              No document types found
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
