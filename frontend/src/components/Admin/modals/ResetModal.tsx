import React, { useState } from 'react';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface ResetModalProps {
  onClose: () => void;
}

export function ResetModal({ onClose }: ResetModalProps) {
  const [confirmation, setConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmation === 'RESET EVERYTHING';

  const handleReset = async () => {
    if (!isConfirmed) return;

    setResetting(true);
    setError(null);

    try {
      const { settingsApi } = await import('../../../api/client');
      await settingsApi.resetEverything(confirmation);
      // Reload the page to reset all state
      window.location.href = '/';
    } catch (err) {
      setError('Failed to reset. Please try again.');
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reset Everything</h3>
              <p className="text-sm text-red-600 dark:text-red-400">This action cannot be undone</p>
            </div>
          </div>

          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">This will permanently delete:</p>
            <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
              <li>All dashboards and widgets</li>
              <li>All integrations and their settings</li>
              <li>All branding customizations</li>
              <li>All uploaded media files</li>
              <li>All logs</li>
            </ul>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">RESET EVERYTHING</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="RESET EVERYTHING"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={resetting}
            />
          </div>

          {error && (
            <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={resetting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleReset}
            disabled={!isConfirmed || resetting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {resetting ? (
              <>
                <LoadingSpinner size="sm" />
                Resetting...
              </>
            ) : (
              'Reset Everything'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
