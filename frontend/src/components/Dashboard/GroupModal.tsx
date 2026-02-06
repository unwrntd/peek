import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WidgetGroup, WidgetWithLayout } from '../../types';
import { settingsApi } from '../../api/client';
import { ImagePicker } from '../common/ImagePicker';

interface GroupModalProps {
  group?: WidgetGroup | null;
  availableWidgets: WidgetWithLayout[];
  preselectedWidgetId?: string | null;
  onClose: () => void;
  onSave: (data: { title: string; config: Record<string, unknown>; widgetIds: string[] }) => void;
}

type TabId = 'general' | 'appearance' | 'widgets';

export function GroupModal({ group, availableWidgets, preselectedWidgetId, onClose, onSave }: GroupModalProps) {
  const [title, setTitle] = useState(group?.title || '');
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(() => {
    if (group?.members) {
      return group.members.map((m) => m.widget_id);
    }
    // Pre-select the widget if creating a new group from a widget
    if (preselectedWidgetId) {
      return [preselectedWidgetId];
    }
    return [];
  });
  const [hideWidgetTitles, setHideWidgetTitles] = useState(
    (group?.config?.hideWidgetTitles as boolean) || false
  );
  const [hideTitle, setHideTitle] = useState(
    (group?.config?.hideTitle as boolean) || false
  );
  const [hideTitleText, setHideTitleText] = useState(
    (group?.config?.hideTitleText as boolean) || false
  );
  const [transparentBackground, setTransparentBackground] = useState(
    (group?.config?.transparentBackground as boolean) || false
  );
  const [transparentHeader, setTransparentHeader] = useState(
    (group?.config?.transparentHeader as boolean) || false
  );
  const [headerImageUrl, setHeaderImageUrl] = useState(
    (group?.config?.headerImageUrl as string) || ''
  );
  const [hideHeaderImage, setHideHeaderImage] = useState(
    (group?.config?.hideHeaderImage as boolean) || false
  );
  const [backgroundColor, setBackgroundColor] = useState(
    (group?.config?.backgroundColor as string) || ''
  );
  const [headerColor, setHeaderColor] = useState(
    (group?.config?.headerColor as string) || ''
  );
  const [borderColor, setBorderColor] = useState(
    (group?.config?.borderColor as string) || ''
  );
  const [hideScrollbar, setHideScrollbar] = useState(
    (group?.config?.hideScrollbar as boolean) || false
  );
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const headerImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (group) {
      setTitle(group.title);
      setSelectedWidgets(group.members.map((m) => m.widget_id));
      setHideWidgetTitles((group.config?.hideWidgetTitles as boolean) || false);
      setHideTitle((group.config?.hideTitle as boolean) || false);
      setHideTitleText((group.config?.hideTitleText as boolean) || false);
      setTransparentBackground((group.config?.transparentBackground as boolean) || false);
      setTransparentHeader((group.config?.transparentHeader as boolean) || false);
      setHeaderImageUrl((group.config?.headerImageUrl as string) || '');
      setHideHeaderImage((group.config?.hideHeaderImage as boolean) || false);
      setBackgroundColor((group.config?.backgroundColor as string) || '');
      setHeaderColor((group.config?.headerColor as string) || '');
      setBorderColor((group.config?.borderColor as string) || '');
      setHideScrollbar((group.config?.hideScrollbar as boolean) || false);
    }
  }, [group]);

  const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { url } = await settingsApi.uploadLogo(file);
      setHeaderImageUrl(url);
    } catch (err) {
      console.error('Failed to upload header image:', err);
    } finally {
      setUploadingImage(false);
      if (headerImageInputRef.current) {
        headerImageInputRef.current.value = '';
      }
    }
  };

  const handleToggleWidget = (widgetId: string) => {
    setSelectedWidgets((prev) =>
      prev.includes(widgetId)
        ? prev.filter((id) => id !== widgetId)
        : [...prev, widgetId]
    );
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    onSave({
      title: title.trim(),
      config: {
        ...(group?.config || {}),
        hideWidgetTitles,
        hideTitle,
        hideTitleText,
        transparentBackground,
        transparentHeader,
        headerImageUrl,
        hideHeaderImage,
        backgroundColor,
        headerColor,
        borderColor,
        hideScrollbar,
      },
      widgetIds: selectedWidgets,
    });
  };

  // Get all widgets that can be added (available widgets + widgets already in this group)
  const allWidgets = [
    ...availableWidgets,
    ...(group?.members
      .filter((m) => !availableWidgets.some((w) => w.id === m.widget_id))
      .map((m) => ({
        id: m.widget_id,
        title: m.widget_title || 'Unknown Widget',
        widget_type: m.widget_type || 'unknown',
        integration_id: m.integration_id || '',
        config: {},
        layout: { widget_id: m.widget_id, x: 0, y: 0, w: 4, h: 3 },
      })) || []),
  ];

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {group ? 'Edit Group' : 'Create Group'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'appearance'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('widgets')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'widgets'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Widgets
              {selectedWidgets.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
                  {selectedWidgets.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Title input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Widget Group"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Display options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Options
                </label>
                <div className="space-y-1">
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideTitle}
                      onChange={(e) => setHideTitle(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Hide group title bar
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideTitleText}
                      onChange={(e) => setHideTitleText(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Hide group title text
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideWidgetTitles}
                      onChange={(e) => setHideWidgetTitles(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Hide widget titles
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transparentBackground}
                      onChange={(e) => setTransparentBackground(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Transparent background
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transparentHeader}
                      onChange={(e) => setTransparentHeader(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Transparent header
                    </span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideScrollbar}
                      onChange={(e) => setHideScrollbar(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Hide scrollbar
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Header Icon/Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Header Icon
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={headerImageUrl}
                    onChange={(e) => setHeaderImageUrl(e.target.value)}
                    placeholder="URL or select from library"
                    className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImagePicker(true)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                  >
                    Browse
                  </button>
                  <input
                    ref={headerImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml"
                    onChange={handleHeaderImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => headerImageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50 text-sm"
                  >
                    {uploadingImage ? '...' : 'Upload'}
                  </button>
                  {headerImageUrl && (
                    <button
                      type="button"
                      onClick={() => setHeaderImageUrl('')}
                      className="px-2 py-2 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {headerImageUrl && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                    <img
                      src={headerImageUrl}
                      alt="Header preview"
                      className="h-8 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <label className="flex items-center gap-3 mt-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideHeaderImage}
                    onChange={(e) => setHideHeaderImage(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Hide header icon
                  </span>
                </label>
              </div>

              {/* Colors */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Colors
                </label>

                {/* Background Color */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={backgroundColor || '#ffffff'}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="Default"
                      className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1 text-sm font-mono"
                    />
                    {backgroundColor && (
                      <button
                        type="button"
                        onClick={() => setBackgroundColor('')}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Header Color */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Header</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={headerColor || '#eef2ff'}
                      onChange={(e) => setHeaderColor(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={headerColor}
                      onChange={(e) => setHeaderColor(e.target.value)}
                      placeholder="Default"
                      className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1 text-sm font-mono"
                    />
                    {headerColor && (
                      <button
                        type="button"
                        onClick={() => setHeaderColor('')}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Border Color */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Border</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={borderColor || '#c7d2fe'}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      placeholder="Default"
                      className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1 text-sm font-mono"
                    />
                    {borderColor && (
                      <button
                        type="button"
                        onClick={() => setBorderColor('')}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Leave empty for default theme colors
                </p>
              </div>
            </div>
          )}

          {/* Widgets Tab */}
          {activeTab === 'widgets' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Widgets in Group
              </label>
              {allWidgets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No widgets available. Create some widgets first.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2">
                  {allWidgets.map((widget) => (
                    <label
                      key={widget.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWidgets.includes(widget.id)}
                        onChange={() => handleToggleWidget(widget.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {widget.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {widget.widget_type}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {selectedWidgets.length} widget{selectedWidgets.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            {group ? 'Save Changes' : 'Create Group'}
          </button>
        </div>

        {/* Image Picker Modal */}
        {showImagePicker && (
          <ImagePicker
            value={headerImageUrl}
            onChange={(url) => {
              setHeaderImageUrl(url || '');
              setShowImagePicker(false);
            }}
            onClose={() => setShowImagePicker(false)}
            allowUpload={true}
            allowUrl={true}
            allowIcons={true}
            title="Select Header Icon"
          />
        )}
      </div>
    </div>,
    document.body
  );
}
