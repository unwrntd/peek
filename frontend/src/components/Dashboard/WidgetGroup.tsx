import React, { useState, useCallback, memo, useMemo } from 'react';
import GridLayout from 'react-grid-layout';
import { WidgetGroup as WidgetGroupType, WidgetWithLayout, Integration } from '../../types';
import { WidgetWrapper } from './WidgetWrapper';
import { groupsApi } from '../../api/client';
import { getWidgetMinSize } from '../../config/integrations';

interface WidgetGroupProps {
  group: WidgetGroupType;
  widgets: WidgetWithLayout[];
  integrations: Integration[];
  width: number;
  height: number;
  onRemoveGroup: () => void;
  onRemoveWidget: (widgetId: string) => void;
  onEditGroup: () => void;
  isEditMode?: boolean;
  isDragTarget?: boolean;
  onDropWidget?: () => void;
}

export const WidgetGroup = memo(function WidgetGroup({
  group,
  widgets,
  integrations,
  width,
  height,
  onRemoveGroup,
  onRemoveWidget,
  onEditGroup,
  isEditMode = true,
  isDragTarget = false,
  onDropWidget,
}: WidgetGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragTarget) {
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isDragTarget && onDropWidget) {
      onDropWidget();
    }
  };

  // Get display options from config
  const hideTitle = (group.config?.hideTitle as boolean) || false;
  const hideTitleText = (group.config?.hideTitleText as boolean) || false;
  const transparentBackground = (group.config?.transparentBackground as boolean) || false;
  const transparentHeader = (group.config?.transparentHeader as boolean) || false;
  const headerImageUrl = (group.config?.headerImageUrl as string) || '';
  const hideHeaderImage = (group.config?.hideHeaderImage as boolean) || false;
  const backgroundColor = (group.config?.backgroundColor as string) || '';
  const headerColor = (group.config?.headerColor as string) || '';
  const borderColor = (group.config?.borderColor as string) || '';
  const hideScrollbar = (group.config?.hideScrollbar as boolean) || false;
  const showHeaderImage = headerImageUrl && !hideHeaderImage;

  // Calculate inner dimensions (accounting for padding and header)
  const headerHeight = hideTitle ? 0 : 40;
  const padding = 16;
  const innerWidth = width - padding * 2;
  const innerHeight = height - headerHeight - padding * 2;

  // Number of columns for inner grid
  const cols = 12;
  const rowHeight = 30;

  // Create layout from group members with proper min sizes
  const layout = group.members.map((member) => {
    // Find the widget to get its type and integration
    const widget = widgets.find(w => w.id === member.widget_id);
    const integration = widget?.integration_id
      ? integrations.find(i => i.id === widget.integration_id)
      : undefined;
    const minSize = widget
      ? getWidgetMinSize(widget.widget_type, integration?.type)
      : { w: 1, h: 1 };

    return {
      i: member.widget_id,
      x: member.x,
      y: member.y,
      w: member.w,
      h: member.h,
      minW: minSize.w,
      minH: minSize.h,
    };
  });

  const handleLayoutChange = useCallback(
    async (newLayout: GridLayout.Layout[]) => {
      const layouts = newLayout.map((item) => ({
        widget_id: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      }));

      try {
        await groupsApi.updateMemberLayouts(group.id, layouts);
      } catch (error) {
        console.error('Failed to save group layouts:', error);
      }
    },
    [group.id]
  );

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveGroup();
    setShowConfirm(false);
  };

  const handleCancelRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(false);
  };

  const getIntegration = (integrationId: string | null) => {
    if (!integrationId) return undefined;
    return integrations.find((i) => i.id === integrationId);
  };

  // Build inline styles for custom colors
  const containerStyle: React.CSSProperties = {
    ...(backgroundColor && !transparentBackground ? { backgroundColor } : {}),
    ...(borderColor && !transparentBackground ? { borderColor } : {}),
  };

  const headerStyle: React.CSSProperties = {
    ...(headerColor ? { backgroundColor: headerColor } : {}),
    ...(borderColor ? { borderColor } : {}),
  };

  // Can only collapse if title bar is visible
  const canCollapse = !hideTitle;

  return (
    <div
      className={`flex flex-col rounded-lg overflow-hidden ${
        isCollapsed && canCollapse ? '' : 'h-full'
      } ${
        transparentBackground
          ? 'bg-transparent'
          : `shadow-md ${backgroundColor ? '' : 'bg-white dark:bg-gray-800'} ${borderColor ? 'border-2' : ''}`
      } group/group relative ${
        isDragOver ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900' : ''
      } ${isDragTarget ? 'transition-all duration-150' : ''}`}
      style={containerStyle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop indicator overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-indigo-500/10 z-20 flex items-center justify-center pointer-events-none rounded-lg">
          <div className="bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-medium">Drop to add to {group.title}</span>
          </div>
        </div>
      )}
      {/* Group Header */}
      {!hideTitle ? (
        <div
          className={`flex items-center justify-between px-3 py-2 ${
            transparentHeader
              ? ''
              : `border-b ${headerColor ? '' : 'bg-gray-50 dark:bg-gray-700'} ${borderColor ? '' : 'border-gray-200 dark:border-gray-600'}`
          }`}
          style={transparentHeader ? {} : headerStyle}
        >
          <div className="flex items-center gap-2 widget-no-drag">
            {canCollapse && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {showHeaderImage && (
              <img
                src={headerImageUrl}
                alt=""
                className="h-5 w-5 object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            {!hideTitleText && (
              <>
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {group.title}
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({group.members.length} widget{group.members.length !== 1 ? 's' : ''})
                </span>
              </>
            )}
          </div>

          {isEditMode && (
            <div className="flex items-center gap-1 widget-no-drag">
              {showConfirm ? (
                <>
                  <button
                    onClick={handleConfirmRemove}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    title="Confirm remove"
                  >
                    Remove
                  </button>
                  <button
                    onClick={handleCancelRemove}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditGroup(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Edit group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveClick(e); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1 text-gray-400 hover:text-red-500"
                    title="Remove group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Floating action buttons and drag handle when title is hidden (edit mode only) */
        isEditMode && (
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover/group:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 rounded-md p-1 shadow-sm">
              {/* Drag handle */}
              <div
                className="widget-drag-handle p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-move transition-colors"
                title="Drag to move"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>
              <div className="widget-no-drag flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditGroup(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title="Edit group"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveClick(e); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Remove group"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Group Content - only show when not collapsed */}
      {!(isCollapsed && canCollapse) && (
        <div className={`flex-1 p-2 overflow-auto widget-no-drag ${
          transparentBackground ? 'bg-transparent' : 'bg-gray-50 dark:bg-gray-900/50'
        } ${hideScrollbar ? 'scrollbar-hide' : ''}`}>
          {group.members.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
              <p>No widgets in this group</p>
            </div>
          ) : widgets.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
              <p>Loading widgets...</p>
            </div>
          ) : (
            <GridLayout
              className="layout"
              layout={layout}
              cols={cols}
              rowHeight={rowHeight}
              width={innerWidth > 0 ? innerWidth : 300}
              onLayoutChange={handleLayoutChange}
              draggableHandle=".group-widget-drag-handle"
              compactType="vertical"
              preventCollision={false}
              isResizable={isEditMode}
              isDraggable={isEditMode}
              margin={[8, 8]}
            >
              {widgets.map((widget) => {
                const integration = getIntegration(widget.integration_id);
                // Static widgets (null integration_id) don't need an integration
                // Integration-based widgets need a valid integration
                if (widget.integration_id && !integration) return null;

                return (
                  <div key={widget.id} className="group-widget-drag-handle">
                    <WidgetWrapper
                      widget={widget}
                      integration={integration}
                      onRemove={() => onRemoveWidget(widget.id)}
                      hideTitle={group.config.hideWidgetTitles as boolean}
                      isEditMode={isEditMode}
                      isInGroup={true}
                      onRemoveFromGroup={() => onRemoveWidget(widget.id)}
                    />
                  </div>
                );
              })}
            </GridLayout>
          )}
        </div>
      )}
    </div>
  );
});
