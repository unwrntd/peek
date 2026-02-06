import React from 'react';

interface SpacerWidgetProps {
  title: string;
  config: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
  isEditMode?: boolean;
  widgetId?: string;
}

interface SpacerConfig {
  style?: 'blank' | 'line' | 'dashed' | 'dotted' | 'double' | 'gradient' | 'shadow' | 'labeled';
  label?: string;
  color?: 'gray' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'custom';
  customColor?: string;
  thickness?: 'thin' | 'medium' | 'thick';
  alignment?: 'center' | 'top' | 'bottom';
  margin?: 'none' | 'small' | 'medium' | 'large';
}

export function SpacerWidget({ config, isEditMode }: SpacerWidgetProps) {
  const spacerConfig = config as SpacerConfig;

  // Parse config with defaults
  const style = spacerConfig.style || 'blank';
  const color = spacerConfig.color || 'gray';
  const thickness = spacerConfig.thickness || 'thin';
  const alignment = spacerConfig.alignment || 'center';
  const margin = spacerConfig.margin || 'medium';
  const label = spacerConfig.label || '';
  const customColor = spacerConfig.customColor || '#6b7280';

  // Get color classes based on selection
  const getColorClasses = () => {
    if (color === 'custom') {
      return { border: '', text: '', bg: '' };
    }
    const colorMap: Record<string, { border: string; text: string; bg: string }> = {
      gray: {
        border: 'border-gray-300 dark:border-gray-600',
        text: 'text-gray-500 dark:text-gray-400',
        bg: 'bg-gray-300 dark:bg-gray-600',
      },
      blue: {
        border: 'border-blue-400 dark:border-blue-500',
        text: 'text-blue-500 dark:text-blue-400',
        bg: 'bg-blue-400 dark:bg-blue-500',
      },
      green: {
        border: 'border-green-400 dark:border-green-500',
        text: 'text-green-500 dark:text-green-400',
        bg: 'bg-green-400 dark:bg-green-500',
      },
      purple: {
        border: 'border-purple-400 dark:border-purple-500',
        text: 'text-purple-500 dark:text-purple-400',
        bg: 'bg-purple-400 dark:bg-purple-500',
      },
      orange: {
        border: 'border-orange-400 dark:border-orange-500',
        text: 'text-orange-500 dark:text-orange-400',
        bg: 'bg-orange-400 dark:bg-orange-500',
      },
      red: {
        border: 'border-red-400 dark:border-red-500',
        text: 'text-red-500 dark:text-red-400',
        bg: 'bg-red-400 dark:bg-red-500',
      },
    };
    return colorMap[color] || colorMap.gray;
  };

  // Get thickness value
  const getThicknessClass = () => {
    const thicknessMap: Record<string, string> = {
      thin: 'border-t',
      medium: 'border-t-2',
      thick: 'border-t-4',
    };
    return thicknessMap[thickness] || thicknessMap.thin;
  };

  const getThicknessPx = () => {
    const thicknessMap: Record<string, number> = {
      thin: 1,
      medium: 2,
      thick: 4,
    };
    return thicknessMap[thickness] || 1;
  };

  // Get alignment class
  const getAlignmentClass = () => {
    const alignmentMap: Record<string, string> = {
      center: 'items-center',
      top: 'items-start',
      bottom: 'items-end',
    };
    return alignmentMap[alignment] || alignmentMap.center;
  };

  // Get margin class
  const getMarginClass = () => {
    const marginMap: Record<string, string> = {
      none: 'px-0',
      small: 'px-2',
      medium: 'px-4',
      large: 'px-8',
    };
    return marginMap[margin] || marginMap.medium;
  };

  const colorClasses = getColorClasses();
  const thicknessClass = getThicknessClass();
  const thicknessPx = getThicknessPx();
  const alignmentClass = getAlignmentClass();
  const marginClass = getMarginClass();

  // Custom color styles
  const customBorderStyle = color === 'custom' ? { borderColor: customColor } : {};
  const customBgStyle = color === 'custom' ? { backgroundColor: customColor } : {};
  const customTextStyle = color === 'custom' ? { color: customColor } : {};

  // Render different styles
  const renderDivider = () => {
    switch (style) {
      case 'blank':
        return null;

      case 'line':
        return (
          <hr
            className={`w-full border-0 ${thicknessClass} ${colorClasses.border}`}
            style={customBorderStyle}
          />
        );

      case 'dashed':
        return (
          <hr
            className={`w-full border-0 ${thicknessClass} border-dashed ${colorClasses.border}`}
            style={customBorderStyle}
          />
        );

      case 'dotted':
        return (
          <hr
            className={`w-full border-0 ${thicknessClass} border-dotted ${colorClasses.border}`}
            style={customBorderStyle}
          />
        );

      case 'double':
        return (
          <div className="w-full flex flex-col gap-1">
            <hr
              className={`w-full border-0 ${thicknessClass} ${colorClasses.border}`}
              style={customBorderStyle}
            />
            <hr
              className={`w-full border-0 ${thicknessClass} ${colorClasses.border}`}
              style={customBorderStyle}
            />
          </div>
        );

      case 'gradient':
        return (
          <div
            className="w-full"
            style={{
              height: `${thicknessPx}px`,
              background: color === 'custom'
                ? `linear-gradient(to right, transparent, ${customColor}, transparent)`
                : undefined,
            }}
          >
            {color !== 'custom' && (
              <div
                className={`w-full h-full ${colorClasses.text}`}
                style={{
                  background: 'linear-gradient(to right, transparent, currentColor, transparent)',
                }}
              />
            )}
          </div>
        );

      case 'shadow':
        return (
          <div
            className={`w-full ${colorClasses.bg} shadow-lg`}
            style={{
              height: `${thicknessPx}px`,
              boxShadow: color === 'custom'
                ? `0 0 8px 2px ${customColor}40`
                : undefined,
              ...customBgStyle,
            }}
          />
        );

      case 'labeled':
        return (
          <div className="w-full flex items-center gap-4">
            <hr
              className={`flex-1 border-0 ${thicknessClass} ${colorClasses.border}`}
              style={customBorderStyle}
            />
            <span
              className={`text-sm font-medium whitespace-nowrap ${colorClasses.text}`}
              style={customTextStyle}
            >
              {label || 'Section'}
            </span>
            <hr
              className={`flex-1 border-0 ${thicknessClass} ${colorClasses.border}`}
              style={customBorderStyle}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Show dashed outline in edit mode for blank spacers
  const editModeIndicator = isEditMode && style === 'blank' && (
    <div className="absolute inset-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded opacity-50 pointer-events-none flex items-center justify-center">
      <span className="text-xs text-gray-500 dark:text-gray-400">Spacer</span>
    </div>
  );

  return (
    <div className={`h-full w-full relative flex ${alignmentClass}`}>
      {editModeIndicator}
      <div className={`w-full ${marginClass}`}>
        {renderDivider()}
      </div>
    </div>
  );
}
