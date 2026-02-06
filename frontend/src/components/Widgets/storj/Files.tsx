import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface StorjFile {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
  storageClass: string;
}

interface FilesData {
  files: StorjFile[];
  bucket: string;
}

interface FilesWidgetProps {
  integrationId: string;
  title: string;
  config: Record<string, unknown>;
  widgetId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getFileIcon(key: string): React.ReactNode {
  const ext = key.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return (
      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return (
      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
    return (
      <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return (
      <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    );
  }
  if (['pdf'].includes(ext)) {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) {
    return (
      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function getFileName(key: string): string {
  return key.split('/').pop() || key;
}

export function Files({ integrationId, config, widgetId }: FilesWidgetProps) {
  const { data, loading, error } = useWidgetData<FilesData>({
    integrationId,
    metric: 'files',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'list';
  const maxItems = (config.maxItems as number) || 20;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm">Loading files...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  const files = data.files.slice(0, maxItems);

  if (visualization === 'compact') {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          {data.bucket && (
            <div className="text-xs text-gray-500 mb-2 px-1">Bucket: {data.bucket}</div>
          )}
          <div className="space-y-0.5">
            {files.map((file) => (
              <div key={file.key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800">
                {getFileIcon(file.key)}
                <span className="text-xs text-gray-300 truncate flex-1">{getFileName(file.key)}</span>
                <span className="text-xs text-gray-500">{formatBytes(file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default list view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        {data.bucket && (
          <div className="text-xs text-gray-500 mb-2 px-1">
            Bucket: <span className="text-green-400">{data.bucket}</span>
          </div>
        )}
        <div className="space-y-1">
          {files.map((file) => (
            <div key={file.key} className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
              {getFileIcon(file.key)}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{getFileName(file.key)}</div>
                <div className="text-xs text-gray-500">
                  {file.key !== getFileName(file.key) && (
                    <span className="truncate">{file.key.replace(getFileName(file.key), '')}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-400">{formatBytes(file.size)}</div>
                <div className="text-xs text-gray-500">{formatTimeAgo(file.lastModified)}</div>
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No files found</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
