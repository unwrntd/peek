import React, { useState, useEffect, useRef } from 'react';
import { ImageLibrary, LibraryImage } from '../../../types';
import { LoadingSpinner } from '../../common/LoadingSpinner';

type PreviewSize = 'xs' | 'small' | 'medium' | 'large' | 'xl';

export function MediaTab() {
  const [libraries, setLibraries] = useState<ImageLibrary[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<ImageLibrary | null>(null);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showNewLibrary, setShowNewLibrary] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [editingLibrary, setEditingLibrary] = useState<ImageLibrary | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewSize, setPreviewSize] = useState<PreviewSize>('medium');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLimits, setUploadLimits] = useState({ maxFilesPerUpload: 100, maxFileSizeMB: 10 });
  const [editingImage, setEditingImage] = useState<LibraryImage | null>(null);
  const [editingImageName, setEditingImageName] = useState('');
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter images based on search query
  const filteredImages = images.filter((image) => {
    if (!imageSearchQuery.trim()) return true;
    const query = imageSearchQuery.toLowerCase();
    return (
      image.original_name.toLowerCase().includes(query) ||
      (image.alt_text && image.alt_text.toLowerCase().includes(query))
    );
  });

  // Preview size grid classes (smaller thumbnails = more columns)
  // Note: Tailwind default grid only goes to 12 cols
  const gridClasses: Record<PreviewSize, string> = {
    xs: 'grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-12 gap-1',
    small: 'grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-10 gap-2',
    medium: 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-8 gap-3',
    large: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4',
    xl: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4',
  };

  // Display labels for preview sizes
  const sizeLabels: Record<PreviewSize, string> = {
    xs: 'XS',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    xl: 'XL',
  };

  // Fetch libraries and limits on mount
  useEffect(() => {
    fetchLibraries();
    fetchUploadLimits();
  }, []);

  const fetchUploadLimits = async () => {
    try {
      const { mediaApi } = await import('../../../api/client');
      const limits = await mediaApi.getUploadLimits();
      setUploadLimits(limits);
    } catch (err) {
      console.error('Failed to fetch upload limits:', err);
    }
  };

  // Fetch images when selected library changes
  useEffect(() => {
    if (selectedLibrary) {
      fetchImages(selectedLibrary.id);
    } else {
      setImages([]);
    }
    setSelectedImages(new Set());
    setImageSearchQuery('');
  }, [selectedLibrary]);

  const fetchLibraries = async () => {
    try {
      const { mediaApi } = await import('../../../api/client');
      const libs = await mediaApi.getLibraries();
      setLibraries(libs);
      if (libs.length > 0 && !selectedLibrary) {
        setSelectedLibrary(libs[0]);
      }
    } catch (err) {
      console.error('Failed to fetch libraries:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async (libraryId: string) => {
    try {
      const { mediaApi } = await import('../../../api/client');
      const imgs = await mediaApi.getLibraryImages(libraryId);
      setImages(imgs);
    } catch (err) {
      console.error('Failed to fetch images:', err);
    }
  };

  const handleCreateLibrary = async () => {
    if (!newLibraryName.trim()) return;
    try {
      const { mediaApi } = await import('../../../api/client');
      const newLib = await mediaApi.createLibrary({ name: newLibraryName.trim() });
      setLibraries([...libraries, newLib]);
      setSelectedLibrary(newLib);
      setNewLibraryName('');
      setShowNewLibrary(false);
    } catch (err) {
      console.error('Failed to create library:', err);
    }
  };

  const handleUpdateLibrary = async () => {
    if (!editingLibrary || !editingLibrary.name.trim()) return;
    try {
      const { mediaApi } = await import('../../../api/client');
      const updated = await mediaApi.updateLibrary(editingLibrary.id, { name: editingLibrary.name });
      setLibraries(libraries.map(l => l.id === updated.id ? updated : l));
      if (selectedLibrary?.id === updated.id) {
        setSelectedLibrary(updated);
      }
      setEditingLibrary(null);
    } catch (err) {
      console.error('Failed to update library:', err);
    }
  };

  const handleDeleteLibrary = async (id: string) => {
    if (!confirm('Delete this library and all its images?')) return;
    try {
      const { mediaApi } = await import('../../../api/client');
      await mediaApi.deleteLibrary(id);
      const newLibs = libraries.filter(l => l.id !== id);
      setLibraries(newLibs);
      if (selectedLibrary?.id === id) {
        setSelectedLibrary(newLibs[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete library:', err);
    }
  };

  const handleUpload = async (files: FileList | File[]) => {
    if (!selectedLibrary || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploadError(null);

    // Check file count limit
    if (fileArray.length > uploadLimits.maxFilesPerUpload) {
      setUploadError(`Maximum ${uploadLimits.maxFilesPerUpload} files can be uploaded at once. You selected ${fileArray.length} files.`);
      return;
    }

    // Check file sizes
    const oversizedFiles = fileArray.filter(f => f.size > uploadLimits.maxFileSizeMB * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setUploadError(`${oversizedFiles.length} file(s) exceed the ${uploadLimits.maxFileSizeMB}MB size limit.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const { mediaApi } = await import('../../../api/client');
      const newImages = await mediaApi.uploadImages(selectedLibrary.id, fileArray, setUploadProgress);
      setImages([...images, ...newImages]);
      // Update library image count
      setLibraries(libraries.map(l =>
        l.id === selectedLibrary.id
          ? { ...l, image_count: (l.image_count || 0) + newImages.length }
          : l
      ));
    } catch (err) {
      console.error('Failed to upload images:', err);
      setUploadError('Failed to upload images. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const { mediaApi } = await import('../../../api/client');
      await mediaApi.deleteImage(imageId);
      setImages(images.filter(i => i.id !== imageId));
      setSelectedImages(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
      // Update library image count
      if (selectedLibrary) {
        setLibraries(libraries.map(l =>
          l.id === selectedLibrary.id
            ? { ...l, image_count: Math.max(0, (l.image_count || 0) - 1) }
            : l
        ));
      }
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedImages.size === 0) return;
    if (!confirm(`Delete ${selectedImages.size} selected images?`)) return;
    try {
      const { mediaApi } = await import('../../../api/client');
      await mediaApi.bulkDeleteImages(Array.from(selectedImages));
      setImages(images.filter(i => !selectedImages.has(i.id)));
      // Update library image count
      if (selectedLibrary) {
        setLibraries(libraries.map(l =>
          l.id === selectedLibrary.id
            ? { ...l, image_count: Math.max(0, (l.image_count || 0) - selectedImages.size) }
            : l
        ));
      }
      setSelectedImages(new Set());
    } catch (err) {
      console.error('Failed to delete images:', err);
    }
  };

  const handleStartRename = (image: LibraryImage) => {
    setEditingImage(image);
    setEditingImageName(image.original_name);
  };

  const handleSaveRename = async () => {
    if (!editingImage || !editingImageName.trim()) return;
    try {
      const { mediaApi } = await import('../../../api/client');
      const updated = await mediaApi.updateImage(editingImage.id, { original_name: editingImageName.trim() });
      setImages(images.map(i => i.id === updated.id ? updated : i));
      setEditingImage(null);
      setEditingImageName('');
    } catch (err) {
      console.error('Failed to rename image:', err);
    }
  };

  const handleCancelRename = () => {
    setEditingImage(null);
    setEditingImageName('');
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

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedImages(new Set(images.map(i => i.id)));
  };

  const deselectAll = () => {
    setSelectedImages(new Set());
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[400px]">
      {/* Library Sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">Libraries</h3>
            <button
              onClick={() => setShowNewLibrary(true)}
              className="p-1 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
              title="New Library"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {showNewLibrary && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={newLibraryName}
                onChange={(e) => setNewLibraryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateLibrary();
                  if (e.key === 'Escape') { setShowNewLibrary(false); setNewLibraryName(''); }
                }}
                placeholder="Library name"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onClick={handleCreateLibrary}
                  className="flex-1 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewLibrary(false); setNewLibraryName(''); }}
                  className="flex-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {libraries.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No libraries yet
            </p>
          ) : (
            libraries.map((lib) => (
              <div
                key={lib.id}
                className={`group flex items-center justify-between p-2 rounded cursor-pointer ${
                  selectedLibrary?.id === lib.id
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
                onClick={() => setSelectedLibrary(lib)}
              >
                {editingLibrary?.id === lib.id ? (
                  <input
                    type="text"
                    value={editingLibrary.name}
                    onChange={(e) => setEditingLibrary({ ...editingLibrary, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateLibrary();
                      if (e.key === 'Escape') setEditingLibrary(null);
                    }}
                    onBlur={handleUpdateLibrary}
                    className="flex-1 px-1 text-sm border border-primary-500 rounded bg-white dark:bg-gray-700"
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{lib.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {lib.image_count || 0} images
                      </div>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingLibrary(lib); }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        title="Rename"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteLibrary(lib.id); }}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {selectedLibrary ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{selectedLibrary.name}</h3>
                  {/* Search Box */}
                  {images.length > 0 && (
                    <div className="relative">
                      <input
                        type="text"
                        value={imageSearchQuery}
                        onChange={(e) => setImageSearchQuery(e.target.value)}
                        placeholder="Search images..."
                        className="w-48 pl-8 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <svg
                        className="absolute left-2.5 top-2 w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {imageSearchQuery && (
                        <button
                          onClick={() => setImageSearchQuery('')}
                          className="absolute right-2 top-2 text-gray-400 hover:text-gray-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  {imageSearchQuery && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {filteredImages.length} of {images.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedImages.size > 0 && (
                    <>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedImages.size} selected
                      </span>
                      <button
                        onClick={deselectAll}
                        className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        Deselect
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete Selected
                      </button>
                    </>
                  )}
                  {images.length > 0 && selectedImages.size === 0 && (
                    <button
                      onClick={selectAll}
                      className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      Select All
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => e.target.files && handleUpload(e.target.files)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload
                  </button>
                </div>
              </div>

              {/* Preview size and info row */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Preview:</span>
                  <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
                    {(['xs', 'small', 'medium', 'large', 'xl'] as PreviewSize[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => setPreviewSize(size)}
                        className={`px-2 py-1 text-xs ${
                          previewSize === size
                            ? 'bg-primary-600 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        {sizeLabels[size]}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Max {uploadLimits.maxFilesPerUpload} files, {uploadLimits.maxFileSizeMB}MB each
                </span>
              </div>

              {/* Upload error message */}
              {uploadError && (
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md flex items-center justify-between">
                  <span className="text-sm text-red-700 dark:text-red-400">{uploadError}</span>
                  <button
                    onClick={() => setUploadError(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
                <div className="flex items-center gap-3">
                  <LoadingSpinner size="sm" />
                  <div className="flex-1">
                    <div className="h-2 bg-primary-200 dark:bg-primary-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-primary-700 dark:text-primary-300">{uploadProgress}%</span>
                </div>
              </div>
            )}

            {/* Image Grid / Drop Zone */}
            <div
              className={`flex-1 overflow-y-auto p-4 ${
                isDragOver ? 'bg-primary-50 dark:bg-primary-900/20' : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {images.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 mb-2">No images in this library</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Drag & drop images here or click Upload
                  </p>
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 mb-2">No images match "{imageSearchQuery}"</p>
                  <button
                    onClick={() => setImageSearchQuery('')}
                    className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className={`grid ${gridClasses[previewSize]}`}>
                  {filteredImages.map((image) => (
                    <div
                      key={image.id}
                      className={`group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all bg-gray-100 dark:bg-gray-900 ${
                        selectedImages.has(image.id)
                          ? 'border-primary-500 ring-2 ring-primary-500/30'
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => toggleImageSelection(image.id)}
                    >
                      <img
                        src={image.url}
                        alt={image.alt_text || image.original_name}
                        className="w-full h-full object-contain"
                      />
                      {/* Selection checkbox */}
                      <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        selectedImages.has(image.id)
                          ? 'bg-primary-500 border-primary-500'
                          : 'bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100'
                      }`}>
                        {selectedImages.has(image.id) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      {/* Action buttons */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartRename(image); }}
                          className="p-1 bg-gray-700 text-white rounded hover:bg-gray-600"
                          title="Rename"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteImage(image.id); }}
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {/* Image info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white truncate">{image.original_name}</p>
                        <p className="text-xs text-gray-300">{formatFileSize(image.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Drag overlay */}
              {isDragOver && (
                <div className="absolute inset-0 bg-primary-500/10 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-primary-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-primary-600 dark:text-primary-400 font-medium">Drop images to upload</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 mb-2">No library selected</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create a library to start organizing your images
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {editingImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rename Image</h3>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={editingImage.url}
                  alt={editingImage.original_name}
                  className="w-16 h-16 object-contain bg-gray-100 dark:bg-gray-900 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    Current: {editingImage.original_name}
                  </p>
                </div>
              </div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Name
              </label>
              <input
                type="text"
                value={editingImageName}
                onChange={(e) => setEditingImageName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={handleCancelRename}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRename}
                disabled={!editingImageName.trim()}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
