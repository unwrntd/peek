import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TextWidgetProps {
  title: string;
  config: {
    content?: string;
    fontSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
    textAlign?: 'left' | 'center' | 'right';
    fontFamily?: string;
    textColor?: string;
  };
  onConfigChange?: (config: Record<string, unknown>) => void;
  isEditMode?: boolean;
}

// Font options
const FONT_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'open-sans', label: 'Open Sans' },
  { value: 'lato', label: 'Lato' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'playfair', label: 'Playfair' },
  { value: 'merriweather', label: 'Merriweather' },
  { value: 'mono', label: 'Mono' },
];

const SIZE_OPTIONS = [
  { value: 'sm', label: 'S' },
  { value: 'base', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
  { value: '2xl', label: '2XL' },
];

export function TextWidget({ title, config, onConfigChange, isEditMode }: TextWidgetProps) {
  const {
    content = '',
    fontSize = 'base',
    textAlign = 'left',
    fontFamily = 'system',
    textColor = '',
  } = config;

  // Font family mapping
  const fontFamilyStyles: Record<string, string> = {
    system: 'ui-sans-serif, system-ui, sans-serif',
    inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
    roboto: '"Roboto", ui-sans-serif, system-ui, sans-serif',
    'open-sans': '"Open Sans", ui-sans-serif, system-ui, sans-serif',
    lato: '"Lato", ui-sans-serif, system-ui, sans-serif',
    montserrat: '"Montserrat", ui-sans-serif, system-ui, sans-serif',
    poppins: '"Poppins", ui-sans-serif, system-ui, sans-serif',
    georgia: 'Georgia, "Times New Roman", serif',
    playfair: '"Playfair Display", Georgia, serif',
    merriweather: '"Merriweather", Georgia, serif',
    mono: 'ui-monospace, "Fira Code", "Roboto Mono", monospace',
  };

  const [isEditing, setIsEditing] = useState(false);
  const [localFontFamily, setLocalFontFamily] = useState(fontFamily);
  const [localFontSize, setLocalFontSize] = useState(fontSize);
  const [localTextColor, setLocalTextColor] = useState(textColor);
  const [localTextAlign, setLocalTextAlign] = useState(textAlign);
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current && !isEditing) {
      editorRef.current.innerHTML = content;
    }
  }, [content, isEditing]);

  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]);

  // Reset local state when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setLocalFontFamily(fontFamily);
      setLocalFontSize(fontSize);
      setLocalTextColor(textColor);
      setLocalTextAlign(textAlign);
    }
  }, [isEditing, fontFamily, fontSize, textColor, textAlign]);

  const handleSave = useCallback(() => {
    if (onConfigChange && editorRef.current) {
      onConfigChange({
        ...config,
        content: editorRef.current.innerHTML,
        fontFamily: localFontFamily,
        fontSize: localFontSize,
        textColor: localTextColor,
        textAlign: localTextAlign,
      });
    }
    setIsEditing(false);
  }, [config, onConfigChange, localFontFamily, localFontSize, localTextColor, localTextAlign]);

  const handleCancel = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
    }
    setIsEditing(false);
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleCreateLink = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      alert('Please select some text first');
      return;
    }
    const url = prompt('Enter URL:', 'https://');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSave();
    }
  };

  const fontSizeClasses: Record<string, string> = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
  };

  const textAlignClasses: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const ToolbarButton = ({
    onClick,
    active = false,
    title: buttonTitle,
    children
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title={buttonTitle}
    >
      {children}
    </button>
  );

  if (isEditing && isEditMode) {
    return (
      <div className="h-full flex flex-col">
        {/* Formatting Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-wrap">
          <ToolbarButton onClick={() => execCommand('bold')} title="Bold (Cmd+B)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
              <path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
            </svg>
          </ToolbarButton>

          <ToolbarButton onClick={() => execCommand('italic')} title="Italic (Cmd+I)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0l-4 16m0 0h4" />
            </svg>
          </ToolbarButton>

          <ToolbarButton onClick={() => execCommand('underline')} title="Underline (Cmd+U)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v7a5 5 0 0010 0V4M5 20h14" />
            </svg>
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

          <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <circle cx="4" cy="6" r="2" fill="currentColor" />
              <circle cx="4" cy="12" r="2" fill="currentColor" />
              <circle cx="4" cy="18" r="2" fill="currentColor" />
              <line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </ToolbarButton>

          <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Numbered List">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <text x="2" y="8" fontSize="8" fontFamily="system-ui">1</text>
              <text x="2" y="14" fontSize="8" fontFamily="system-ui">2</text>
              <text x="2" y="20" fontSize="8" fontFamily="system-ui">3</text>
              <line x1="10" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </ToolbarButton>

          <ToolbarButton onClick={handleCreateLink} title="Insert Link">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Alignment buttons */}
          <ToolbarButton
            onClick={() => { setLocalTextAlign('left'); execCommand('justifyLeft'); }}
            active={localTextAlign === 'left'}
            title="Align Left"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h18" />
            </svg>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => { setLocalTextAlign('center'); execCommand('justifyCenter'); }}
            active={localTextAlign === 'center'}
            title="Align Center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M3 18h18" />
            </svg>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => { setLocalTextAlign('right'); execCommand('justifyRight'); }}
            active={localTextAlign === 'right'}
            title="Align Right"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 12h12M3 18h18" />
            </svg>
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Color picker */}
          <div className="relative">
            <input
              ref={colorInputRef}
              type="color"
              value={localTextColor || '#000000'}
              onChange={(e) => setLocalTextColor(e.target.value)}
              className="absolute opacity-0 w-0 h-0"
            />
            <ToolbarButton
              onClick={() => colorInputRef.current?.click()}
              title="Text Color"
            >
              <div className="w-4 h-4 flex flex-col items-center justify-center">
                <span className="text-xs font-bold" style={{ color: localTextColor || 'currentColor' }}>A</span>
                <div
                  className="w-4 h-1 rounded-sm"
                  style={{ backgroundColor: localTextColor || '#6b7280' }}
                />
              </div>
            </ToolbarButton>
          </div>
          {localTextColor && (
            <button
              onClick={() => setLocalTextColor('')}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
              title="Reset color"
            >
              ✕
            </button>
          )}
        </div>

        {/* Second toolbar row for font/size */}
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {/* Font family */}
          <select
            value={localFontFamily}
            onChange={(e) => setLocalFontFamily(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-1.5 py-1 focus:ring-1 focus:ring-primary-500"
            title="Font Family"
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Font size */}
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
            {SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLocalFontSize(opt.value as typeof fontSize)}
                className={`px-2 py-1 text-xs transition-colors ${
                  localFontSize === opt.value
                    ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
                title={`Size: ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <span className="text-xs text-gray-400 hidden sm:inline">⌘+Enter to save</span>
        </div>

        {/* Editable Content Area */}
        <div
          ref={editorRef}
          contentEditable
          onKeyDown={handleKeyDown}
          className={`flex-1 p-3 overflow-auto focus:outline-none ${fontSizeClasses[localFontSize]} ${!localTextColor ? 'text-gray-800 dark:text-gray-200' : ''} prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_a]:text-primary-600 [&_a]:underline`}
          style={{
            minHeight: '100px',
            fontFamily: fontFamilyStyles[localFontFamily] || fontFamilyStyles.system,
            ...(localTextColor ? { color: localTextColor } : {}),
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        <p className="text-sm mb-3">No text content</p>
        {isEditMode && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Add Text
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-auto p-3 ${fontSizeClasses[fontSize]} ${textAlignClasses[textAlign]}`}
      style={{
        fontFamily: fontFamilyStyles[fontFamily] || fontFamilyStyles.system,
      }}
      onClick={() => isEditMode && setIsEditing(true)}
    >
      <div
        className={`${!textColor ? 'text-gray-800 dark:text-gray-200' : ''} ${isEditMode ? 'cursor-text' : ''} [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_a]:text-primary-600 [&_a]:underline`}
        style={textColor ? { color: textColor } : undefined}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
