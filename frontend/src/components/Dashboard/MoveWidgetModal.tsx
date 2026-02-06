import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Dashboard } from '../../types';

interface MoveWidgetModalProps {
  widgetTitle: string;
  dashboards: Dashboard[];
  currentDashboardId: string;
  onMove: (targetDashboardId: string) => Promise<void>;
  onCopy: (targetDashboardId: string) => Promise<void>;
  onClose: () => void;
}

export function MoveWidgetModal({
  widgetTitle,
  dashboards,
  currentDashboardId,
  onMove,
  onCopy,
  onClose,
}: MoveWidgetModalProps) {
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>('');
  const [action, setAction] = useState<'move' | 'copy'>('copy');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out current dashboard
  const availableDashboards = dashboards.filter(d => d.id !== currentDashboardId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDashboardId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (action === 'move') {
        await onMove(selectedDashboardId);
      } else {
        await onCopy(selectedDashboardId);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform action');
    } finally {
      setIsLoading(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Move or Copy Widget
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {widgetTitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {availableDashboards.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No other dashboards available. Create another dashboard first.
            </div>
          ) : (
            <>
              {/* Action selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Action
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      value="copy"
                      checked={action === 'copy'}
                      onChange={() => setAction('copy')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Copy
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      (keep on both dashboards)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      value="move"
                      checked={action === 'move'}
                      onChange={() => setAction('move')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Move
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      (remove from current)
                    </span>
                  </label>
                </div>
              </div>

              {/* Dashboard selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Dashboard
                </label>
                <select
                  value={selectedDashboardId}
                  onChange={e => setSelectedDashboardId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select a dashboard...</option>
                  {availableDashboards.map(dashboard => (
                    <option key={dashboard.id} value={dashboard.id}>
                      {dashboard.name}
                      {dashboard.is_default && ' (Default)'}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            {availableDashboards.length > 0 && (
              <button
                type="submit"
                disabled={!selectedDashboardId || isLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    {action === 'move' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                    {action === 'move' ? 'Move Widget' : 'Copy Widget'}
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
