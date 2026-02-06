import React, { useState, useRef } from 'react';
import { packageApi, PackagePreview, PackageImportResults, PackageImportResponse } from '../../api/client';

export function PackageExportImport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<PackagePreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<PackageImportResults | null>(null);
  const [credentialWarning, setCredentialWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export encryption state
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');

  // Import decryption state
  const [importPassword, setImportPassword] = useState('');

  // Replace all mode
  const [replaceAll, setReplaceAll] = useState(true);

  const handleExport = async () => {
    // Validate password confirmation if password is provided
    if (showExportPassword && exportPassword) {
      if (exportPassword !== exportPasswordConfirm) {
        setError('Passwords do not match');
        return;
      }
      if (exportPassword.length < 4) {
        setError('Password must be at least 4 characters');
        return;
      }
    }

    setIsExporting(true);
    setError(null);
    try {
      const password = showExportPassword && exportPassword ? exportPassword : undefined;
      const blob = await packageApi.exportPackage(password);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `peek-package-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      // Reset password fields after successful export
      setExportPassword('');
      setExportPasswordConfirm('');
    } catch (err) {
      setError('Failed to export package: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setPreview(null);
    setImportResults(null);
    setCredentialWarning(null);
    setImportPassword('');
    setIsPreviewing(true);

    try {
      const previewData = await packageApi.previewPackage(file);
      setPreview(previewData);
    } catch (err) {
      setError('Invalid package file: ' + (err instanceof Error ? err.message : String(err)));
      setSelectedFile(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setError(null);
    setCredentialWarning(null);
    try {
      const password = preview?.summary.hasEncryptedCredentials && importPassword ? importPassword : undefined;
      const response = await packageApi.importPackage(selectedFile, { password, replaceAll });
      setImportResults(response.results);
      if (response.credentialWarning) {
        setCredentialWarning(response.credentialWarning);
      }
      setPreview(null);
      setSelectedFile(null);
      setImportPassword('');
    } catch (err) {
      setError('Failed to import package: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setImportPassword('');
    setCredentialWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Export Full Package
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Download a complete backup including all configurations, dashboards,
          integrations, image libraries, and branding assets as a ZIP archive.
        </p>

        {/* Credential Encryption Option */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showExportPassword}
              onChange={(e) => {
                setShowExportPassword(e.target.checked);
                if (!e.target.checked) {
                  setExportPassword('');
                  setExportPasswordConfirm('');
                }
              }}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600
                       focus:ring-blue-500 dark:focus:ring-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Include encrypted credentials
            </span>
          </label>
          <p className="ml-6 text-xs text-gray-500 dark:text-gray-400 mt-1">
            Optionally encrypt integration passwords and API keys with a password for secure backup
          </p>
        </div>

        {showExportPassword && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Encryption Password
              </label>
              <input
                type="password"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder="Enter password to encrypt credentials"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={exportPasswordConfirm}
                onChange={(e) => setExportPasswordConfirm(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Remember this password - you'll need it to restore credentials during import
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            disabled={isExporting || (showExportPassword && (!exportPassword || exportPassword !== exportPasswordConfirm))}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export Package (.zip)
              </>
            )}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {showExportPassword && exportPassword
              ? 'Package will include encrypted credentials'
              : 'Credentials will be redacted (no password set)'}
          </span>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Import Package
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Restore from a previously exported package. This will import all
          configurations and assets including images and branding.
        </p>

        {error && (
          <div
            className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200
                      dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm"
          >
            {error}
          </div>
        )}

        {!preview && !importResults && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              className="hidden"
              id="package-file"
              disabled={isPreviewing}
            />
            <label
              htmlFor="package-file"
              className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300
                       dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50
                       dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300
                       ${isPreviewing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isPreviewing ? (
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading Preview...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Select Package File (.zip)
                </>
              )}
            </label>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Package Contents
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Dashboards:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {preview.summary.dashboards}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Widgets:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {preview.summary.widgets}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Integrations:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {preview.summary.integrations}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Image Libraries:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {preview.summary.imageLibraries}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Images:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {preview.summary.totalImages}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Branding Assets:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {[preview.summary.hasLogo && 'Logo', preview.summary.hasFavicon && 'Favicon']
                      .filter(Boolean)
                      .join(', ') || 'None'}
                  </span>
                </div>
                {(preview.summary.switchTemplates || preview.summary.deviceTemplates) ? (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Templates:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {[
                        preview.summary.switchTemplates && `${preview.summary.switchTemplates} switch`,
                        preview.summary.deviceTemplates && `${preview.summary.deviceTemplates} device`
                      ].filter(Boolean).join(', ')}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
                Created: {formatDate(preview.manifest.created_at)} | {preview.manifest.totalFiles}{' '}
                files | App v{preview.manifest.appVersion}
                {selectedFile && ` | ${formatFileSize(selectedFile.size)}`}
              </div>
            </div>

            {/* Encrypted Credentials Notice */}
            {preview.summary.hasEncryptedCredentials && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h5 className="font-medium text-blue-800 dark:text-blue-300">
                    Encrypted Credentials Detected
                  </h5>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                  This package contains encrypted integration credentials. Enter the password used during export to restore them.
                </p>
                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                    Decryption Password
                  </label>
                  <input
                    type="password"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    placeholder="Enter password to decrypt credentials"
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    Leave empty to import without credentials (you'll need to re-enter them manually)
                  </p>
                </div>
              </div>
            )}

            {/* Replace All Mode */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={(e) => setReplaceAll(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 dark:border-gray-600
                           focus:ring-amber-500 dark:focus:ring-amber-600"
                />
                <span className="font-medium text-amber-800 dark:text-amber-300">
                  Full Restore (Replace All)
                </span>
              </label>
              <p className="ml-6 text-sm text-amber-700 dark:text-amber-400 mt-1">
                {replaceAll
                  ? 'All existing dashboards, widgets, integrations, and image libraries will be deleted and replaced with the package contents.'
                  : 'Existing data will be preserved. Only new items will be imported (items with same name are skipped).'}
              </p>
            </div>

            {preview.warnings.length > 0 && (
              <div
                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200
                          dark:border-yellow-800 rounded-lg"
              >
                <h5 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Warnings</h5>
                <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                  {preview.warnings.map((warning, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="shrink-0">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isImporting ? (
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Importing...
                  </>
                ) : (
                  'Import Package'
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={isImporting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                         disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div
            className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200
                      dark:border-green-800 rounded-lg"
          >
            <h4 className="font-medium text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Import Complete
            </h4>
            <div className="space-y-1 text-sm text-green-700 dark:text-green-400">
              {importResults.dashboards.imported > 0 && (
                <p>• {importResults.dashboards.imported} dashboard(s) imported</p>
              )}
              {importResults.dashboards.skipped > 0 && (
                <p className="text-green-600 dark:text-green-500">
                  • {importResults.dashboards.skipped} dashboard(s) skipped (already exist)
                </p>
              )}
              {importResults.widgets.imported > 0 && (
                <p>• {importResults.widgets.imported} widget(s) imported</p>
              )}
              {importResults.integrations.imported > 0 && (
                <p>• {importResults.integrations.imported} integration(s) imported</p>
              )}
              {importResults.integrations.skipped > 0 && (
                <p className="text-green-600 dark:text-green-500">
                  • {importResults.integrations.skipped} integration(s) skipped (already exist)
                </p>
              )}
              {importResults.groups.imported > 0 && (
                <p>• {importResults.groups.imported} group(s) imported</p>
              )}
              {importResults.imageLibraries.imported > 0 && (
                <p>• {importResults.imageLibraries.imported} image library(s) imported</p>
              )}
              {importResults.imageLibraries.images > 0 && (
                <p>• {importResults.imageLibraries.images} image(s) imported</p>
              )}
              {importResults.assets.logo && <p>• Logo restored</p>}
              {importResults.assets.favicon && <p>• Favicon restored</p>}
              {importResults.branding.imported && <p>• Branding settings restored</p>}
              {importResults.credentials && importResults.credentials.restored > 0 && (
                <p className="text-green-700 dark:text-green-300 font-medium">
                  • {importResults.credentials.restored} credential(s) restored from encrypted backup
                </p>
              )}
              {importResults.templates && importResults.templates.switch > 0 && (
                <p>• {importResults.templates.switch} switch template(s) imported</p>
              )}
              {importResults.templates && importResults.templates.device > 0 && (
                <p>• {importResults.templates.device} device template(s) imported</p>
              )}
            </div>

            {/* Cleared Data Info */}
            {importResults.cleared && (importResults.cleared.integrations > 0 ||
              importResults.cleared.dashboards > 0 || importResults.cleared.widgets > 0) && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Previous data cleared:
                </p>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                  {importResults.cleared.dashboards > 0 && (
                    <li>• {importResults.cleared.dashboards} dashboard(s)</li>
                  )}
                  {importResults.cleared.widgets > 0 && (
                    <li>• {importResults.cleared.widgets} widget(s)</li>
                  )}
                  {importResults.cleared.groups > 0 && (
                    <li>• {importResults.cleared.groups} group(s)</li>
                  )}
                  {importResults.cleared.integrations > 0 && (
                    <li>• {importResults.cleared.integrations} integration(s)</li>
                  )}
                  {importResults.cleared.imageLibraries > 0 && (
                    <li>• {importResults.cleared.imageLibraries} image library(s)</li>
                  )}
                </ul>
              </div>
            )}

            {/* Credential Warning */}
            {credentialWarning && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm">{credentialWarning}</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 ml-6">
                  You may need to manually re-enter credentials in each integration's settings.
                </p>
              </div>
            )}

            {/* Show errors if any */}
            {(importResults.integrations.errors.length > 0 ||
              importResults.dashboards.errors.length > 0 ||
              importResults.widgets.errors.length > 0 ||
              importResults.imageLibraries.errors.length > 0) && (
              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                  Some items had errors:
                </p>
                <ul className="text-xs text-yellow-600 dark:text-yellow-500 space-y-0.5">
                  {[
                    ...importResults.integrations.errors,
                    ...importResults.dashboards.errors,
                    ...importResults.widgets.errors,
                    ...importResults.imageLibraries.errors,
                  ].map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              Reload Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
