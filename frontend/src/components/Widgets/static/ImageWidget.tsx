import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ImagePicker } from '../../common/ImagePicker';

interface ImageWidgetProps {
  title: string;
  config: {
    // Single image mode
    imageData?: string;
    imageUrl?: string;
    fit?: 'contain' | 'cover' | 'fill' | 'contain-blur'; // contain-blur kept for backwards compatibility
    backgroundBlur?: boolean;
    alt?: string;
    linkUrl?: string;
    // Slideshow mode
    slideshowEnabled?: boolean;
    slideshowImages?: string[];
    slideshowInterval?: number;
    slideshowTransition?: 'fade' | 'slide' | 'none';
    slideshowAutoPlay?: boolean;
    slideshowShowControls?: boolean;
  };
  onConfigChange?: (config: Record<string, unknown>) => void;
  isEditMode?: boolean;
}

export function ImageWidget({ title, config, onConfigChange, isEditMode }: ImageWidgetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const {
    imageData,
    imageUrl,
    fit = 'contain',
    backgroundBlur = false,
    alt = '',
    linkUrl,
    slideshowEnabled = false,
    slideshowImages = [],
    slideshowInterval = 5000,
    slideshowTransition = 'fade',
    slideshowAutoPlay = true,
    slideshowShowControls = true,
  } = config || {};

  // Fit mode handling - support legacy 'contain-blur' value for backwards compatibility
  const isContainBlur = backgroundBlur || fit === 'contain-blur';
  // Map fit value to valid CSS object-fit value
  const getCssFit = (): 'contain' | 'cover' | 'fill' => {
    if (fit === 'contain-blur' || fit === 'contain') return 'contain';
    if (fit === 'cover') return 'cover';
    if (fit === 'fill') return 'fill';
    return 'contain';
  };
  const actualFit = getCssFit();

  // Helper to wrap content in a link if linkUrl is set
  const wrapWithLink = (content: React.ReactNode) => {
    if (linkUrl && !isEditMode) {
      return (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-full"
        >
          {content}
        </a>
      );
    }
    return content;
  };

  // Single image source (for non-slideshow mode)
  const singleImageSrc = imageData || imageUrl;

  // Slideshow images
  const images = slideshowEnabled && slideshowImages.length > 0 ? slideshowImages : [];
  const hasSlideshow = slideshowEnabled && images.length > 1;

  // Initialize auto-play state
  useEffect(() => {
    setIsPlaying(slideshowAutoPlay);
  }, [slideshowAutoPlay]);

  // Reset index when images change
  useEffect(() => {
    if (currentIndex >= images.length) {
      setCurrentIndex(0);
    }
  }, [images.length, currentIndex]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!hasSlideshow || !isPlaying) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setTimeout(() => setIsTransitioning(false), 50);
      }, slideshowTransition === 'none' ? 0 : 300);
    }, slideshowInterval);

    return () => clearInterval(interval);
  }, [hasSlideshow, isPlaying, slideshowInterval, slideshowTransition, images.length]);

  const goToSlide = useCallback((index: number) => {
    if (index === currentIndex) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 50);
    }, slideshowTransition === 'none' ? 0 : 300);
  }, [currentIndex, slideshowTransition]);

  const goToPrevious = useCallback(() => {
    goToSlide((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, goToSlide]);

  const goToNext = useCallback(() => {
    goToSlide((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, goToSlide]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onConfigChange) return;

    e.target.value = '';

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      await onConfigChange({
        ...config,
        imageData: base64,
        imageUrl: undefined,
      });
    } catch (err) {
      setError('Failed to upload image');
      console.error('Image upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (onConfigChange) {
      await onConfigChange({
        ...config,
        imageData: undefined,
        imageUrl: undefined,
      });
    }
  };

  const handleImagePickerSelect = async (url: string | undefined) => {
    if (onConfigChange && url) {
      await onConfigChange({
        ...config,
        imageUrl: url,
        imageData: undefined,
      });
    }
  };

  // Get transition classes
  const getTransitionClasses = () => {
    if (slideshowTransition === 'none') return '';
    if (slideshowTransition === 'fade') {
      return isTransitioning ? 'opacity-0' : 'opacity-100 transition-opacity duration-300';
    }
    if (slideshowTransition === 'slide') {
      return isTransitioning
        ? 'translate-x-full opacity-0'
        : 'translate-x-0 opacity-100 transition-all duration-300';
    }
    return '';
  };

  // Slideshow mode with images
  if (hasSlideshow) {
    const currentImage = images[currentIndex];

    return (
      <div
        className="h-full w-full relative group"
        onMouseEnter={() => slideshowAutoPlay && setIsPlaying(false)}
        onMouseLeave={() => slideshowAutoPlay && setIsPlaying(true)}
      >
        {/* Main image */}
        <div className={`w-full h-full ${getTransitionClasses()}`}>
          {isContainBlur ? (
            <div className="w-full h-full relative overflow-hidden">
              <img
                src={currentImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full scale-110 blur-xl opacity-60"
                style={{ objectFit: 'cover' }}
                loading="lazy"
              />
              <img
                src={currentImage}
                alt={`${alt || title} - Slide ${currentIndex + 1}`}
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: 'contain' }}
                loading="lazy"
              />
            </div>
          ) : (
            <img
              src={currentImage}
              alt={`${alt || title} - Slide ${currentIndex + 1}`}
              className="w-full h-full block"
              style={{ objectFit: actualFit, objectPosition: 'center' }}
              loading="lazy"
            />
          )}
        </div>

        {/* Controls overlay */}
        {slideshowShowControls && (
          <>
            {/* Navigation arrows */}
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous slide"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next slide"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-white scale-110'
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Play/Pause indicator */}
            {slideshowAutoPlay && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1.5 bg-black/30 hover:bg-black/50 text-white rounded"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Slide counter */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/30 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    );
  }

  // Slideshow enabled but only one or no images - show single image or placeholder
  if (slideshowEnabled && images.length === 1) {
    return wrapWithLink(
      <div className="h-full w-full">
        {isContainBlur ? (
          <div className="w-full h-full relative overflow-hidden">
            <img
              src={images[0]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full scale-110 blur-xl opacity-60"
              style={{ objectFit: 'cover' }}
              loading="lazy"
            />
            <img
              src={images[0]}
              alt={alt || title}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'contain' }}
              loading="lazy"
            />
          </div>
        ) : (
          <img
            src={images[0]}
            alt={alt || title}
            className="w-full h-full block"
            style={{ objectFit: actualFit, objectPosition: 'center' }}
            loading="lazy"
          />
        )}
      </div>
    );
  }

  // Slideshow enabled but no images
  if (slideshowEnabled && images.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">No slideshow images</p>
        <p className="text-xs mt-1">Add images in widget settings</p>
      </div>
    );
  }

  // Single image mode - no image
  if (!singleImageSrc) {
    return (
      <>
        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
          {isUploading ? (
            <>
              <svg className="w-8 h-8 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm">Uploading...</p>
            </>
          ) : (
            <>
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm mb-3">No image set</p>
              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
              {isEditMode && (
                <div className="flex flex-col items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowImagePicker(true)}
                      className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Library
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {showImagePicker && createPortal(
          <ImagePicker
            onChange={handleImagePickerSelect}
            onClose={() => setShowImagePicker(false)}
            title="Select Image"
          />,
          document.body
        )}
      </>
    );
  }

  // Single image mode - has image
  const imageContent = isContainBlur ? (
    <div className="w-full h-full relative overflow-hidden">
      {/* Blurred background */}
      <img
        src={singleImageSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full scale-110 blur-xl opacity-60"
        style={{ objectFit: 'cover' }}
        loading="lazy"
      />
      {/* Main image */}
      <img
        src={singleImageSrc}
        alt={alt || title}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'contain' }}
        loading="lazy"
      />
    </div>
  ) : (
    <img
      src={singleImageSrc}
      alt={alt || title}
      className="w-full h-full block"
      style={{
        objectFit: actualFit,
        objectPosition: 'center',
      }}
      loading="lazy"
    />
  );

  return (
    <div className="h-full w-full relative group">
      {linkUrl && !isEditMode ? (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-full"
        >
          {imageContent}
        </a>
      ) : (
        imageContent
      )}
      {isEditMode && (
        <>
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-1">
              <button
                onClick={() => setShowImagePicker(true)}
                disabled={isUploading}
                className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded shadow text-gray-600 dark:text-gray-300 hover:text-primary-600 disabled:opacity-50"
                title="Select from library"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded shadow text-gray-600 dark:text-gray-300 hover:text-primary-600 disabled:opacity-50"
                title="Upload new image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              <button
                onClick={handleRemoveImage}
                disabled={isUploading}
                className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded shadow text-gray-600 dark:text-gray-300 hover:text-red-500 disabled:opacity-50"
                title="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          {showImagePicker && createPortal(
            <ImagePicker
              value={singleImageSrc}
              onChange={handleImagePickerSelect}
              onClose={() => setShowImagePicker(false)}
              title="Select Image"
            />,
            document.body
          )}
        </>
      )}
    </div>
  );
}
