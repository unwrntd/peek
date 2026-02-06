import React, { useState, useEffect } from 'react';
import { ImageLibrary, LibraryImage } from '../../types';
import { mediaApi } from '../../api/client';
import { LoadingSpinner } from './LoadingSpinner';

interface MultiImagePickerProps {
  value: string[];
  onChange: (urls: string[]) => void;
  onClose: () => void;
  title?: string;
}

export function MultiImagePicker({
  value,
  onChange,
  onClose,
  title = 'Select Images',
}: MultiImagePickerProps) {
  const [libraries, setLibraries] = useState<ImageLibrary[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<ImageLibrary | null>(null);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<string[]>(value);

  useEffect(() => {
    fetchLibraries();
  }, []);

  useEffect(() => {
    if (selectedLibrary) {
      fetchImages(selectedLibrary.id);
    } else {
      setImages([]);
    }
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

  const toggleImage = (url: string) => {
    setSelectedUrls((prev) => {
      if (prev.includes(url)) {
        return prev.filter((u) => u !== url);
      }
      return [...prev, url];
    });
  };

  const handleSave = () => {
    onChange(selectedUrls);
    onClose();
  };

  const handleSelectAll = () => {
    const allUrls = images.map((img) => img.url);
    const newSelected = [...selectedUrls];
    allUrls.forEach((url) => {
      if (!newSelected.includes(url)) {
        newSelected.push(url);
      }
    });
    setSelectedUrls(newSelected);
  };

  const handleDeselectAll = () => {
    const allUrls = images.map((img) => img.url);
    setSelectedUrls(selectedUrls.filter((url) => !allUrls.includes(url)));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newUrls = [...selectedUrls];
    [newUrls[index - 1], newUrls[index]] = [newUrls[index], newUrls[index - 1]];
    setSelectedUrls(newUrls);
  };

  const moveDown = (index: number) => {
    if (index === selectedUrls.length - 1) return;
    const newUrls = [...selectedUrls];
    [newUrls[index], newUrls[index + 1]] = [newUrls[index + 1], newUrls[index]];
    setSelectedUrls(newUrls);
  };

  const removeFromSelection = (url: string) => {
    setSelectedUrls(selectedUrls.filter((u) => u !== url));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
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

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left side: Library browser */}
          <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700 min-h-0">
            {/* Library selector */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Library</label>
                {images.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                    >
                      Deselect all
                    </button>
                  </div>
                )}
              </div>
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <select
                  value={selectedLibrary?.id || ''}
                  onChange={(e) => {
                    const lib = libraries.find((l) => l.id === e.target.value);
                    setSelectedLibrary(lib || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {libraries.length === 0 ? (
                    <option value="">No libraries</option>
                  ) : (
                    libraries.map((lib) => (
                      <option key={lib.id} value={lib.id}>
                        {lib.name} ({lib.image_count || 0} images)
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Image grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingImages ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : images.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No images in this library</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((image) => {
                    const isSelected = selectedUrls.includes(image.url);
                    const selectionIndex = selectedUrls.indexOf(image.url);
                    return (
                      <button
                        key={image.id}
                        onClick={() => toggleImage(image.url)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-primary-500 ring-2 ring-primary-500/30'
                            : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={image.alt_text || image.original_name}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-1 left-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {selectionIndex + 1}
                          </div>
                        )}
                        <div className={`absolute inset-0 bg-primary-500/20 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right side: Selected images */}
          <div className="w-64 flex flex-col bg-gray-50 dark:bg-gray-900/50">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Selected ({selectedUrls.length})
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Drag or use arrows to reorder
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {selectedUrls.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Click images to select
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedUrls.map((url, index) => (
                    <div
                      key={url}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <img
                        src={url}
                        alt={`Selection ${index + 1}`}
                        className="w-10 h-10 object-cover rounded"
                      />
                      <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                        {index + 1}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveDown(index)}
                          disabled={index === selectedUrls.length - 1}
                          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromSelection(url)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedUrls.length} images selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Save Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
