import React from 'react';
import { BaseWidget } from '../BaseWidget';
import { useWidgetData } from '../../../hooks/useWidgetData';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime: string;
  viewedByMeTime?: string;
  webViewLink?: string;
  iconLink?: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
  shared: boolean;
}

interface DriveData {
  user: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
  quota: {
    limit: number;
    usage: number;
    usageInDrive: number;
    usageInDriveTrash: number;
    percentUsed: number;
  };
  recentFiles: DriveFile[];
}

interface DriveWidgetProps {
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
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getFileIcon(mimeType: string): React.ReactNode {
  if (mimeType === 'application/vnd.google-apps.folder') {
    return (
      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>
    );
  }
  if (mimeType.includes('image') || mimeType === 'application/vnd.google-apps.photo') {
    return (
      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mimeType.includes('video')) {
    return (
      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mimeType === 'application/vnd.google-apps.document' || mimeType.includes('document') || mimeType.includes('word')) {
    return (
      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return (
      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mimeType === 'application/vnd.google-apps.presentation' || mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return (
      <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    );
  }
  if (mimeType === 'application/pdf') {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

export function Drive({ integrationId, config, widgetId }: DriveWidgetProps) {
  const { data, loading, error } = useWidgetData<DriveData>({
    integrationId,
    metric: 'drive',
    refreshInterval: (config.refreshInterval as number) || 120000,
    widgetId,
  });

  const visualization = (config.visualization as string) || 'files';
  const maxItems = (config.maxItems as number) || 10;

  if (!data) {
    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <p className="text-sm">Loading Drive...</p>
          </div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'storage') {
    const usedPercent = data.quota.percentUsed;
    const barColor = usedPercent > 90 ? 'bg-red-500' : usedPercent > 75 ? 'bg-yellow-500' : 'bg-blue-500';

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="text-4xl font-bold text-white mb-1">{usedPercent}%</div>
          <div className="text-xs text-gray-500 mb-4">Storage Used</div>
          <div className="w-full max-w-xs bg-gray-700 rounded-full h-2 mb-4">
            <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${usedPercent}%` }} />
          </div>
          <div className="text-xs text-gray-400 text-center">
            {formatBytes(data.quota.usage)} of {formatBytes(data.quota.limit)}
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.user.emailAddress}</div>
        </div>
      </BaseWidget>
    );
  }

  if (visualization === 'combined') {
    const usedPercent = data.quota.percentUsed;
    const barColor = usedPercent > 90 ? 'bg-red-500' : usedPercent > 75 ? 'bg-yellow-500' : 'bg-blue-500';

    return (
      <BaseWidget loading={loading} error={error}>
        <div className="h-full overflow-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">Storage</span>
              <span className="text-white">{usedPercent}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${usedPercent}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatBytes(data.quota.usage)} / {formatBytes(data.quota.limit)}
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-2">Recent Files</div>
          <div className="space-y-1">
            {data.recentFiles.slice(0, 5).map((file) => (
              <a
                key={file.id}
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-800 transition-colors"
              >
                {getFileIcon(file.mimeType)}
                <span className="text-xs text-gray-300 truncate flex-1">{file.name}</span>
              </a>
            ))}
          </div>
        </div>
      </BaseWidget>
    );
  }

  // Default files view
  return (
    <BaseWidget loading={loading} error={error}>
      <div className="h-full overflow-auto">
        <div className="text-xs text-gray-500 mb-2 px-1">Recent Files</div>
        <div className="space-y-1">
          {data.recentFiles.slice(0, maxItems).map((file) => (
            <a
              key={file.id}
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              {getFileIcon(file.mimeType)}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{file.name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span>{formatTimeAgo(file.modifiedTime)}</span>
                  {file.size && <span>{formatBytes(file.size)}</span>}
                  {file.shared && (
                    <span className="text-blue-400">Shared</span>
                  )}
                </div>
              </div>
            </a>
          ))}
          {data.recentFiles.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">No recent files</p>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
