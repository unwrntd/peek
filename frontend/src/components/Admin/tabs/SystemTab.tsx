import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { PackageExportImport } from '../PackageExportImport';
import { ImportConfigModal } from '../modals/ImportConfigModal';
import { ResetModal } from '../modals/ResetModal';
import { formatBytes, formatUptime } from '../../../utils/formatting';
import { getProgressColor } from '../../../utils/colors';

interface SystemStatus {
  cpu: {
    model: string;
    cores: number;
    usage: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  system: {
    hostname: string;
    platform: string;
    arch: string;
    uptime: number;
    nodeVersion: string;
  };
  storage: {
    databaseSize: number;
    uploadsSize: number;
    totalAppSize: number;
  };
}

export function SystemTab() {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Fetch system status
  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const { settingsApi } = await import('../../../api/client');
        const status = await settingsApi.getSystemStatus();
        setSystemStatus(status);
      } catch (err) {
        console.error('Failed to fetch system status:', err);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchSystemStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleExportConfig = async () => {
    setExporting(true);
    try {
      const { settingsApi } = await import('../../../api/client');
      const exportData = await settingsApi.exportConfig();

      // Add port connections from localStorage
      const portConnectionsRaw = localStorage.getItem('peek-port-connections');
      if (portConnectionsRaw) {
        try {
          const portConnections = JSON.parse(portConnectionsRaw);
          exportData.portConnections = portConnections.state?.connections || [];
          exportData.portMappings = portConnections.state?.portMappings || [];
        } catch {
          // Ignore parse errors
        }
      }

      // Add network devices from localStorage
      const networkDevicesRaw = localStorage.getItem('peek-network-devices');
      if (networkDevicesRaw) {
        try {
          const networkDevices = JSON.parse(networkDevicesRaw);
          exportData.networkDevices = networkDevices.state?.devices || [];
        } catch {
          // Ignore parse errors
        }
      }

      // Create and download the combined export
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `peek-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export configuration:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* System Resources Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          System Resources
        </h2>
        {loadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : systemStatus ? (
          <div className="space-y-6">
            {/* Resource Gauges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CPU */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CPU</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {systemStatus.cpu.usage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${getProgressColor(systemStatus.cpu.usage)}`}
                    style={{ width: `${Math.min(systemStatus.cpu.usage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {systemStatus.cpu.cores} cores
                </p>
              </div>

              {/* Memory */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Memory</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {systemStatus.memory.usagePercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${getProgressColor(systemStatus.memory.usagePercent)}`}
                    style={{ width: `${Math.min(systemStatus.memory.usagePercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {formatBytes(systemStatus.memory.used)} / {formatBytes(systemStatus.memory.total)}
                </p>
              </div>

              {/* Disk */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Disk</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {systemStatus.disk.usagePercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${getProgressColor(systemStatus.disk.usagePercent)}`}
                    style={{ width: `${Math.min(systemStatus.disk.usagePercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {systemStatus.disk.total > 0 ? (
                    <>
                      {formatBytes(systemStatus.disk.used)} / {formatBytes(systemStatus.disk.total)}
                    </>
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
            </div>

            {/* System Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Hostname</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {systemStatus.system.hostname}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Platform</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {systemStatus.system.platform} ({systemStatus.system.arch})
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Uptime</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatUptime(systemStatus.system.uptime)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Node.js</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {systemStatus.system.nodeVersion}
                </p>
              </div>
            </div>

            {/* App Storage */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Application Storage</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatBytes(systemStatus.storage.databaseSize)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Database</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatBytes(systemStatus.storage.uploadsSize)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Uploads</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatBytes(systemStatus.storage.totalAppSize)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Unable to fetch system status
          </p>
        )}
      </div>

      {/* Config Export/Import Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Configuration Backup
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Export or import your dashboard configuration as a JSON file. This includes dashboards, widgets,
          integrations (with redacted credentials), and branding settings. Does not include uploaded images.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportConfig}
            disabled={exporting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Export Config (.json)
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Config
          </button>
        </div>
      </div>

      {/* Package Export/Import Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Full Package Backup
        </h2>
        <PackageExportImport />
      </div>

      {/* Factory Reset Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900/50 p-6">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
          Danger Zone
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Factory reset will permanently delete all dashboards, widgets, integrations, images, and settings.
          This action cannot be undone.
        </p>
        <button
          onClick={() => setShowResetModal(true)}
          className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Factory Reset
        </button>
      </div>

      {/* Modals */}
      {showImportModal && <ImportConfigModal onClose={() => setShowImportModal(false)} />}
      {showResetModal && <ResetModal onClose={() => setShowResetModal(false)} />}
    </div>
  );
}
