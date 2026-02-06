import React, { useMemo } from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface Document {
  id: number;
  title: string;
  created: string;
  added: string;
  correspondent: number | null;
  correspondentName: string | null;
  document_type: number | null;
  documentTypeName: string | null;
  archive_serial_number: string | null;
  tagDetails: Array<{ name: string; color: string }>;
}

interface DocumentsData {
  documents: Document[];
  total: number;
}

interface RecentDocumentsWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function RecentDocuments({ integrationId, config, widgetId }: RecentDocumentsWidgetProps) {
  const { data, loading, error } = useWidgetData<DocumentsData>({
    integrationId,
    metric: 'documents',
    refreshInterval: (config.refreshInterval as number) || 60000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const hideLabels = (config.hideLabels as boolean) || false;
  const searchFilter = (config.search as string) || '';

  const filteredDocuments = useMemo(() => {
    if (!data?.documents) return [];

    return data.documents.filter(doc => {
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const matchesSearch =
          doc.title?.toLowerCase().includes(search) ||
          doc.correspondentName?.toLowerCase().includes(search) ||
          doc.documentTypeName?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [data?.documents, searchFilter]);

  // Compact visualization
  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="space-y-1 overflow-y-auto h-full">
          {filteredDocuments.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-gray-200">{doc.title}</span>
              <span className="text-xs text-gray-500">{formatDate(doc.added)}</span>
            </div>
          ))}
          {filteredDocuments.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">No documents found</div>
          )}
        </div>
      </BaseWidget>
    );
  }

  // Cards visualization
  if (visualization === 'cards') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto h-full">
          {filteredDocuments.map(doc => (
            <div
              key={doc.id}
              className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
            >
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.title}</div>
              {!hideLabels && (
                <div className="text-xs text-gray-500 mt-1">
                  {formatDate(doc.added)}
                  {doc.correspondentName && ` • ${doc.correspondentName}`}
                </div>
              )}
            </div>
          ))}
        </div>
      </BaseWidget>
    );
  }

  // Default: List visualization
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
            {searchFilter && ' (filtered)'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredDocuments.map(doc => (
            <div
              key={doc.id}
              className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate" title={doc.title}>
                    {doc.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Added {formatDate(doc.added)}
                  </div>
                </div>
                {doc.archive_serial_number && (
                  <span className="text-xs text-gray-500 ml-2">
                    #{doc.archive_serial_number}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {doc.correspondentName && (
                  <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">
                    {doc.correspondentName}
                  </span>
                )}
                {doc.documentTypeName && (
                  <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">
                    {doc.documentTypeName}
                  </span>
                )}
              </div>

              {doc.tagDetails && doc.tagDetails.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {doc.tagDetails.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}30` : 'rgba(75, 85, 99, 0.5)',
                        color: tag.color || '#9ca3af',
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {doc.tagDetails.length > 3 && (
                    <span className="text-xs text-gray-500">+{doc.tagDetails.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          ))}

          {filteredDocuments.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              {searchFilter ? 'No documents match filter' : 'No documents found'}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
