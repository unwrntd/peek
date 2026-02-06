import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { ImageLibrary, LibraryImage } from '../../types';
import { mediaApi } from '../../api/client';
import { LoadingSpinner } from './LoadingSpinner';

interface ImagePickerProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  onClose: () => void;
  allowUpload?: boolean;
  allowUrl?: boolean;
  allowIcons?: boolean;
  title?: string;
}

type PickerTab = 'library' | 'icons' | 'url' | 'upload';
type IconSource = 'simpleicons' | 'iconoir';

interface IconifyIcon {
  name: string;
  category?: string;
}

// Cache for icon data
let simpleIconsCache: IconifyIcon[] | null = null;
let iconoirCache: IconifyIcon[] | null = null;

// Icon button component with error handling
function IconButton({
  iconUrl,
  title,
  onClick
}: {
  iconUrl: string;
  title: string;
  onClick: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) return null;

  return (
    <button
      onClick={onClick}
      className="group aspect-square rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors p-2 flex flex-col items-center justify-center"
      title={title}
    >
      <img
        src={iconUrl}
        alt={title}
        className={`w-6 h-6 object-contain transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded && !failed && (
        <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      )}
      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center opacity-0 group-hover:opacity-100 transition-opacity">
        {title}
      </span>
    </button>
  );
}

export function ImagePicker({
  value,
  onChange,
  onClose,
  allowUpload = true,
  allowUrl = true,
  allowIcons = true,
  title = 'Select Image',
}: ImagePickerProps) {
  const [activeTab, setActiveTab] = useState<PickerTab>('library');
  const [libraries, setLibraries] = useState<ImageLibrary[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<ImageLibrary | null>(null);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchInput, setSearchInput] = useState(''); // Immediate input value
  const [searchQuery, setSearchQuery] = useState(''); // Debounced search value
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Icon picker state
  const [iconSource, setIconSource] = useState<IconSource>('simpleicons');
  const [simpleIcons, setSimpleIcons] = useState<IconifyIcon[]>([]);
  const [iconoirIcons, setIconoirIcons] = useState<IconifyIcon[]>([]);
  const [loadingIcons, setLoadingIcons] = useState(false);
  const [iconSearchInput, setIconSearchInput] = useState('');
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [iconColor, setIconColor] = useState('#ffffff'); // Default white for dark backgrounds

  // Debounced search update for performance
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setSearchQuery(value), 200),
    []
  );

  // Debounced icon search
  const debouncedSetIconSearch = useMemo(
    () => debounce((value: string) => setIconSearchQuery(value), 200),
    []
  );

  // Update debounced search when input changes
  useEffect(() => {
    debouncedSetSearch(searchInput);
    return () => debouncedSetSearch.cancel();
  }, [searchInput, debouncedSetSearch]);

  // Update debounced icon search when input changes
  useEffect(() => {
    debouncedSetIconSearch(iconSearchInput);
    return () => debouncedSetIconSearch.cancel();
  }, [iconSearchInput, debouncedSetIconSearch]);

  // Fetch icons from Iconify API
  const fetchIconsFromIconify = useCallback(async (prefix: string): Promise<IconifyIcon[]> => {
    const response = await fetch(`https://api.iconify.design/collection?prefix=${prefix}`);
    const data = await response.json();
    const icons: IconifyIcon[] = [];

    // Add categorized icons
    if (data.categories) {
      for (const [category, iconNames] of Object.entries(data.categories)) {
        for (const name of iconNames as string[]) {
          icons.push({ name, category });
        }
      }
    }

    // Add uncategorized icons
    if (data.uncategorized) {
      for (const name of data.uncategorized as string[]) {
        icons.push({ name, category: 'general' });
      }
    }

    return icons;
  }, []);

  // Fetch Simple Icons data
  const fetchSimpleIcons = useCallback(async () => {
    if (simpleIconsCache) {
      setSimpleIcons(simpleIconsCache);
      return;
    }
    setLoadingIcons(true);
    try {
      const icons = await fetchIconsFromIconify('simple-icons');
      simpleIconsCache = icons;
      setSimpleIcons(icons);
    } catch (err) {
      console.error('Failed to fetch Simple Icons:', err);
    } finally {
      setLoadingIcons(false);
    }
  }, [fetchIconsFromIconify]);

  // Fetch Iconoir data
  const fetchIconoirIcons = useCallback(async () => {
    if (iconoirCache) {
      setIconoirIcons(iconoirCache);
      return;
    }
    setLoadingIcons(true);
    try {
      const icons = await fetchIconsFromIconify('iconoir');
      iconoirCache = icons;
      setIconoirIcons(icons);
    } catch (err) {
      console.error('Failed to fetch Iconoir icons:', err);
    } finally {
      setLoadingIcons(false);
    }
  }, [fetchIconsFromIconify]);

  // Load icons when switching to icons tab or changing source
  useEffect(() => {
    if (activeTab === 'icons') {
      if (iconSource === 'simpleicons' && simpleIcons.length === 0) {
        fetchSimpleIcons();
      } else if (iconSource === 'iconoir' && iconoirIcons.length === 0) {
        fetchIconoirIcons();
      }
    }
  }, [activeTab, iconSource, simpleIcons.length, iconoirIcons.length, fetchSimpleIcons, fetchIconoirIcons]);

  // Filter icons based on search
  const filteredSimpleIcons = useMemo(() => {
    if (!iconSearchQuery.trim()) return simpleIcons.slice(0, 200); // Limit initial display
    const query = iconSearchQuery.toLowerCase();
    return simpleIcons.filter(icon =>
      icon.name.toLowerCase().includes(query) ||
      (icon.category && icon.category.toLowerCase().includes(query))
    ).slice(0, 200);
  }, [simpleIcons, iconSearchQuery]);

  const filteredIconoirIcons = useMemo(() => {
    if (!iconSearchQuery.trim()) return iconoirIcons.slice(0, 200); // Limit initial display
    const query = iconSearchQuery.toLowerCase();
    return iconoirIcons.filter(icon =>
      icon.name.toLowerCase().includes(query) ||
      (icon.category && icon.category.toLowerCase().includes(query))
    ).slice(0, 200);
  }, [iconoirIcons, iconSearchQuery]);

  // Generate icon URL (using Iconify API for reliable color support)
  const getIconUrl = (prefix: string, name: string, color: string) => {
    const colorHex = color.replace('#', '');
    return `https://api.iconify.design/${prefix}/${name}.svg?color=%23${colorHex}`;
  };

  const handleIconSelect = (url: string) => {
    onChange(url);
    onClose();
  };

  // Filter images by search query
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const query = searchQuery.toLowerCase();
    return images.filter(
      img =>
        img.filename.toLowerCase().includes(query) ||
        img.original_name.toLowerCase().includes(query) ||
        (img.alt_text && img.alt_text.toLowerCase().includes(query))
    );
  }, [images, searchQuery]);

  useEffect(() => {
    fetchLibraries();
  }, []);

  useEffect(() => {
    if (selectedLibrary) {
      fetchImages(selectedLibrary.id);
    } else {
      setImages([]);
    }
    // Clear search when changing library
    setSearchInput('');
    setSearchQuery('');
  }, [selectedLibrary]);

  const fetchLibraries = async () => {
    try {
      const libs = await mediaApi.getLibraries();
      setLibraries(libs);
      if (libs.length > 0) {
        setSelectedLibrary(libs[0]);
      }
    } catch (err) {
      console.error('Failed to fetch libraries:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async (libraryId: string) => {
    setLoadingImages(true);
    try {
      const imgs = await mediaApi.getLibraryImages(libraryId);
      setImages(imgs);
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleImageSelect = (image: LibraryImage) => {
    onChange(image.url);
    onClose();
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      onClose();
    }
  };

  const handleUpload = async (files: FileList | File[]) => {
    if (!selectedLibrary || files.length === 0) return;

    const fileArray = Array.from(files);
    setUploading(true);
    setUploadProgress(0);

    try {
      const newImages = await mediaApi.uploadImages(selectedLibrary.id, fileArray, setUploadProgress);
      if (newImages.length > 0) {
        // Select the first uploaded image
        onChange(newImages[0].url);
        onClose();
      }
    } catch (err) {
      console.error('Failed to upload images:', err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleClear = () => {
    onChange(undefined);
    onClose();
  };

  const tabs = [
    { id: 'library' as PickerTab, label: 'Library' },
    ...(allowIcons ? [{ id: 'icons' as PickerTab, label: 'Icons' }] : []),
    ...(allowUrl ? [{ id: 'url' as PickerTab, label: 'URL' }] : []),
    ...(allowUpload ? [{ id: 'upload' as PickerTab, label: 'Upload' }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Library Tab */}
          {activeTab === 'library' && (
            <>
              {/* Library sidebar */}
              <div className="w-48 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : libraries.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">
                    No libraries
                  </p>
                ) : (
                  <div className="p-2 space-y-1">
                    {libraries.map((lib) => (
                      <button
                        key={lib.id}
                        onClick={() => setSelectedLibrary(lib)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedLibrary?.id === lib.id
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="font-medium truncate">{lib.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {lib.image_count || 0} images
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Image grid section */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Search input with debouncing */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search images..."
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md pl-9 pr-8 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchInput && (
                      <button
                        onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {searchInput && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {filteredImages.length} of {images.length} images
                    </p>
                  )}
                </div>

                {/* Image grid */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {loadingImages ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner size="md" />
                    </div>
                  ) : filteredImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-400">
                        {searchInput ? 'No matching images' : 'No images in this library'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {filteredImages.map((image) => (
                        <button
                          key={image.id}
                          onClick={() => handleImageSelect(image)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 hover:border-primary-400 dark:hover:border-primary-500 transition-colors ${
                            value === image.url
                              ? 'border-primary-500 ring-2 ring-primary-500/30'
                              : 'border-transparent'
                          }`}
                        >
                          <img
                            src={image.url}
                            alt={image.alt_text || image.original_name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Icons Tab */}
          {activeTab === 'icons' && (
            <>
              {/* Icon source selector sidebar */}
              <div className="w-48 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => { setIconSource('simpleicons'); setIconSearchInput(''); setIconSearchQuery(''); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      iconSource === 'simpleicons'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-medium">Simple Icons</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Brand & logo icons
                    </div>
                  </button>
                  <button
                    onClick={() => { setIconSource('iconoir'); setIconSearchInput(''); setIconSearchQuery(''); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      iconSource === 'iconoir'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-medium">Iconoir</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      UI & interface icons
                    </div>
                  </button>
                </div>

                {/* Color picker */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Icon Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={iconColor}
                      onChange={(e) => setIconColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                    />
                    <input
                      type="text"
                      value={iconColor}
                      onChange={(e) => setIconColor(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="#ffffff"
                    />
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {['#ffffff', '#000000', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setIconColor(color)}
                        className={`w-5 h-5 rounded border ${iconColor === color ? 'ring-2 ring-primary-500 ring-offset-1' : 'border-gray-300 dark:border-gray-600'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Icon grid section */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Search input */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <input
                      type="text"
                      value={iconSearchInput}
                      onChange={(e) => setIconSearchInput(e.target.value)}
                      placeholder={iconSource === 'simpleicons' ? 'Search brands (e.g., github, docker)...' : 'Search icons (e.g., home, user)...'}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md pl-9 pr-8 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {iconSearchInput && (
                      <button
                        onClick={() => { setIconSearchInput(''); setIconSearchQuery(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {iconSource === 'simpleicons'
                      ? `${filteredSimpleIcons.length} icons${iconSearchQuery ? ' found' : ' (search for more)'}`
                      : `${filteredIconoirIcons.length} icons${iconSearchQuery ? ' found' : ' (search for more)'}`
                    }
                  </p>
                </div>

                {/* Icon grid */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {loadingIcons ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner size="md" />
                    </div>
                  ) : iconSource === 'simpleicons' ? (
                    filteredSimpleIcons.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                          {iconSearchInput ? 'No matching icons' : 'Search for brand icons'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {filteredSimpleIcons.map((icon) => {
                          const iconUrl = getIconUrl('simple-icons', icon.name, iconColor);
                          return (
                            <IconButton
                              key={icon.name}
                              iconUrl={iconUrl}
                              title={icon.name}
                              onClick={() => handleIconSelect(iconUrl)}
                            />
                          );
                        })}
                      </div>
                    )
                  ) : (
                    filteredIconoirIcons.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                          {iconSearchInput ? 'No matching icons' : 'Search for UI icons'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {filteredIconoirIcons.map((icon) => {
                          const iconUrl = getIconUrl('iconoir', icon.name, iconColor);
                          return (
                            <IconButton
                              key={icon.name}
                              iconUrl={iconUrl}
                              title={icon.name}
                              onClick={() => handleIconSelect(iconUrl)}
                            />
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          {/* URL Tab */}
          {activeTab === 'url' && (
            <div className="p-6 overflow-y-auto flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Image URL
              </label>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                />
                <button
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Use URL
                </button>
              </div>
              {urlInput && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Preview:</p>
                  <img
                    src={urlInput}
                    alt="Preview"
                    className="max-w-full max-h-48 object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="p-6 overflow-y-auto flex-1">
              {libraries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No libraries available
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Create a library in the Media tab first
                  </p>
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Upload to library
                  </label>
                  <select
                    value={selectedLibrary?.id || ''}
                    onChange={(e) => {
                      const lib = libraries.find((l) => l.id === e.target.value);
                      setSelectedLibrary(lib || null);
                    }}
                    className="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {libraries.map((lib) => (
                      <option key={lib.id} value={lib.id}>
                        {lib.name}
                      </option>
                    ))}
                  </select>

                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragOver
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {uploading ? (
                      <div className="space-y-3">
                        <LoadingSpinner size="md" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Uploading... {uploadProgress}%
                        </p>
                        <div className="w-48 mx-auto h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-600 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-gray-600 dark:text-gray-300 mb-2">
                          Drag & drop an image here
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">or</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files && handleUpload(e.target.files)}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                        >
                          Choose File
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            {value && (
              <button
                onClick={handleClear}
                className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Clear Selection
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
