import React, { useState } from 'react';
import { Dashboard } from '../../types';
import { useDashboardStore } from '../../stores/dashboardStore';

interface DashboardSettingsModalProps {
  dashboard: Dashboard;
  onClose: () => void;
}

export function DashboardSettingsModal({ dashboard, onClose }: DashboardSettingsModalProps) {
  const {
    updateDashboard,
    deleteDashboard,
    duplicateDashboard,
    setDefaultDashboard,
    exportDashboard,
    setCurrentDashboard,
    fetchDashboards,
  } = useDashboardStore();

  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description);
  const [kioskSlug, setKioskSlug] = useState(dashboard.kiosk_slug || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate kiosk slug format
    const slugValue = kioskSlug.trim().toLowerCase();
    if (slugValue && !/^[a-z0-9_-]+$/.test(slugValue)) {
      setError('Kiosk URL slug must contain only letters, numbers, hyphens, and underscores');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateDashboard(dashboard.id, {
        name: name.trim(),
        description: description.trim(),
        kiosk_slug: slugValue,
      });
      await fetchDashboards();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);

    try {
      await deleteDashboard(dashboard.id);
      await fetchDashboards();
      onClose();
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    setSaving(true);
    setError(null);

    try {
      const newDashboard = await duplicateDashboard(dashboard.id, `${dashboard.name} (Copy)`);
      await fetchDashboards();
      await setCurrentDashboard(newDashboard.id);
      onClose();
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  };

  const handleSetDefault = async () => {
    setSaving(true);
    setError(null);

    try {
      await setDefaultDashboard(dashboard.id);
      await fetchDashboards();
      onClose();
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const exportData = await exportDashboard(dashboard.id) as unknown as Record<string, unknown>;

      // Get widget IDs from the export
      const widgetIds = new Set<string>();
      if (Array.isArray(exportData.widgets)) {
        // The export format includes widgets with layout info, extract widget IDs from context
        // Since export doesn't include widget IDs directly, we need to include all connections
        // for widgets of the same type/title combinations
      }

      // Add port connections for widgets in this dashboard from localStorage
      const portConnectionsRaw = localStorage.getItem('peek-port-connections');
      if (portConnectionsRaw) {
        try {
          const portData = JSON.parse(portConnectionsRaw);
          exportData.portConnections = portData.state?.connections || [];
          exportData.portMappings = portData.state?.portMappings || [];
        } catch {
          // Ignore parse errors
        }
      }

      // Add network devices from localStorage
      const networkDevicesRaw = localStorage.getItem('peek-network-devices');
      if (networkDevicesRaw) {
        try {
          const deviceData = JSON.parse(networkDevicesRaw);
          exportData.networkDevices = deviceData.state?.devices || [];
        } catch {
          // Ignore parse errors
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboard.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-dashboard.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dashboard Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Dashboard name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional description"
            />
          </div>

          {/* Kiosk URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Kiosk URL Slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">/k/</span>
              <input
                type="text"
                value={kioskSlug}
                onChange={(e) => setKioskSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="my-dashboard"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Create a custom kiosk URL for display mode (no navigation, view-only).
              {kioskSlug && (
                <span className="block mt-1 text-primary-600 dark:text-primary-400">
                  URL: {window.location.origin}/k/{kioskSlug.toLowerCase()}
                </span>
              )}
            </p>
          </div>

          {/* Default dashboard toggle */}
          {!dashboard.is_default && (
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Default Dashboard</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Set as the default dashboard on load</p>
              </div>
              <button
                onClick={handleSetDefault}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/50 disabled:opacity-50"
              >
                Set as Default
              </button>
            </div>
          )}

          {dashboard.is_default && (
            <div className="flex items-center gap-2 py-2 px-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm text-yellow-700 dark:text-yellow-400">This is the default dashboard</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleDuplicate}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicate
            </button>
            <button
              onClick={handleExport}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            {!dashboard.is_default && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                Are you sure you want to delete this dashboard? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Deleting...' : 'Delete Dashboard'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
