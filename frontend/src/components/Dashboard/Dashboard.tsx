import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import debounce from 'lodash/debounce';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useIntegrations } from '../../hooks/useIntegrations';
import { WidgetWrapper } from './WidgetWrapper';
import { AddWidgetModal } from './AddWidgetModal';
import { GroupModal } from './GroupModal';
import { WidgetGroup } from './WidgetGroup';
import { ResizeOverlay } from './ResizeOverlay';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { WidgetGroup as WidgetGroupType, WidgetWithLayout } from '../../types';
import { getWidgetMinSize } from '../../config/integrations';

interface DashboardProps {
  isKioskMode?: boolean;
}

export function Dashboard({ isKioskMode = false }: DashboardProps) {
  const { dashboardId: urlDashboardId } = useParams<{ dashboardId: string }>();
  const navigate = useNavigate();
  const {
    widgets,
    groups,
    loading,
    error,
    mode,
    dashboards,
    currentDashboardId,
    fetchDashboards,
    setCurrentDashboard,
    fetchDashboard,
    updateLayout,
    saveLayouts,
    removeWidget,
    createGroup,
    updateGroup,
    removeGroup,
    updateGroupLayout,
    saveGroupLayouts,
  } = useDashboardStore();
  const { integrations } = useIntegrations();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WidgetGroupType | null>(null);
  const [preselectedWidgetId, setPreselectedWidgetId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [resizingItem, setResizingItem] = useState<{
    id: string;
    w: number;
    h: number;
    minW: number;
    minH: number;
    position: { x: number; y: number };
  } | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  // Track which dashboard we've fetched to prevent infinite loops on empty dashboards
  const fetchedDashboardRef = useRef<string | null>(null);

  // In kiosk mode, use the store's currentDashboardId (set by KioskPage after slug resolution)
  // In normal mode, use the URL param
  const dashboardId = isKioskMode ? currentDashboardId : urlDashboardId;

  // In kiosk mode, always treat as view mode
  const isEditMode = !isKioskMode && mode === 'edit';

  // Load dashboards list if not loaded
  useEffect(() => {
    if (dashboards.length === 0) {
      fetchDashboards();
    }
  }, [dashboards.length, fetchDashboards]);

  // Sync URL with store and load dashboard content (skip URL handling in kiosk mode)
  useEffect(() => {
    if (!dashboardId || dashboards.length === 0) return;

    // In kiosk mode, currentDashboardId is already set by KioskPage, just fetch content if needed
    if (isKioskMode) {
      if (widgets.length === 0 && groups.length === 0 && !loading && fetchedDashboardRef.current !== dashboardId) {
        fetchedDashboardRef.current = dashboardId;
        fetchDashboard();
      }
      return;
    }

    // Check if the dashboard exists
    const dashboardExists = dashboards.some(d => d.id === dashboardId);
    if (!dashboardExists) {
      // Dashboard doesn't exist, redirect to default
      const defaultDashboard = dashboards.find(d => d.is_default) || dashboards[0];
      if (defaultDashboard) {
        navigate(`/d/${defaultDashboard.id}`, { replace: true });
      }
      return;
    }

    // If URL dashboard differs from current, switch to it
    // setCurrentDashboard handles fetching the dashboard content
    if (dashboardId !== currentDashboardId) {
      fetchedDashboardRef.current = dashboardId;
      setCurrentDashboard(dashboardId);
    } else if (widgets.length === 0 && groups.length === 0 && !loading && fetchedDashboardRef.current !== dashboardId) {
      // Dashboard ID matches but content is empty and we haven't fetched yet (e.g., page refresh)
      // Widgets/groups aren't persisted, so we need to fetch them
      fetchedDashboardRef.current = dashboardId;
      fetchDashboard();
    }
  }, [dashboardId, dashboards, currentDashboardId, setCurrentDashboard, navigate, widgets.length, groups.length, loading, fetchDashboard, isKioskMode]);

  // Close add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };

    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAddMenu]);

  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('dashboard-container');
      if (container) {
        setContainerWidth(container.offsetWidth);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debounced save function to batch rapid layout changes
  const debouncedSave = useMemo(
    () => debounce(() => {
      saveLayouts();
      saveGroupLayouts();
    }, 500),
    [saveLayouts, saveGroupLayouts]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleLayoutChange = useCallback((layout: GridLayout.Layout[]) => {
    if (!isEditMode) return;

    layout.forEach(item => {
      // Check if it's a group or widget
      if (item.i.startsWith('group-')) {
        const groupId = item.i.replace('group-', '');
        updateGroupLayout(groupId, { x: item.x, y: item.y, w: item.w, h: item.h });
      } else {
        updateLayout(item.i, { x: item.x, y: item.y, w: item.w, h: item.h });
      }
    });
  }, [isEditMode, updateGroupLayout, updateLayout]);

  const handleDragStop = useCallback(() => {
    if (!isEditMode) return;
    debouncedSave();
  }, [isEditMode, debouncedSave]);

  // Track resize in progress to show overlay with dimensions
  const handleResize = useCallback((
    _layout: GridLayout.Layout[],
    _oldItem: GridLayout.Layout,
    newItem: GridLayout.Layout,
    _placeholder: GridLayout.Layout,
    event: MouseEvent
  ) => {
    if (!isEditMode) return;

    // Get the widget to find its type and min size
    const isGroup = newItem.i.startsWith('group-');
    let minW = 1;
    let minH = 1;

    if (isGroup) {
      minW = 2;
      minH = 2;
    } else {
      const widget = widgets.find(w => w.id === newItem.i);
      if (widget) {
        const integration = integrations.find(i => i.id === widget.integration_id);
        const minSize = getWidgetMinSize(widget.widget_type, integration?.type);
        minW = minSize.w;
        minH = minSize.h;
      }
    }

    setResizingItem({
      id: newItem.i,
      w: newItem.w,
      h: newItem.h,
      minW,
      minH,
      position: { x: event.clientX, y: event.clientY },
    });
  }, [isEditMode, widgets, integrations]);

  const handleResizeStop = useCallback(() => {
    if (!isEditMode) return;
    setResizingItem(null);
    debouncedSave();
  }, [isEditMode, debouncedSave]);

  const handleRemoveWidget = useCallback(async (widgetId: string) => {
    await removeWidget(widgetId);
  }, [removeWidget]);

  const handleCreateGroup = useCallback((widgetId?: string) => {
    setEditingGroup(null);
    setPreselectedWidgetId(widgetId || null);
    setShowGroupModal(true);
  }, []);

  const handleEditGroup = useCallback((group: WidgetGroupType) => {
    setEditingGroup(group);
    setShowGroupModal(true);
  }, []);

  const handleSaveGroup = useCallback(async (data: { title: string; config: Record<string, unknown>; widgetIds: string[] }) => {
    if (editingGroup) {
      await updateGroup(editingGroup.id, data);
    } else {
      await createGroup(data);
    }
    setShowGroupModal(false);
    setEditingGroup(null);
    setPreselectedWidgetId(null);
  }, [editingGroup, updateGroup, createGroup]);

  const handleRemoveGroup = useCallback(async (groupId: string) => {
    await removeGroup(groupId);
  }, [removeGroup]);

  // Handle adding a widget to a group
  const handleAddWidgetToGroup = useCallback(async (widgetId: string, groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      const newWidgetIds = [...group.members.map(m => m.widget_id), widgetId];
      await updateGroup(groupId, { widgetIds: newWidgetIds });
    }
  }, [groups, updateGroup]);

  // Handle removing a widget from a group - reads latest state to avoid stale closures
  const handleRemoveWidgetFromGroup = useCallback(async (widgetId: string, groupId: string) => {
    // Get the latest group state from the store to avoid stale closure issues
    const currentGroups = useDashboardStore.getState().groups;
    const group = currentGroups.find(g => g.id === groupId);
    if (group) {
      const newWidgetIds = group.members
        .filter(m => m.widget_id !== widgetId)
        .map(m => m.widget_id);
      await updateGroup(groupId, { widgetIds: newWidgetIds });
    }
  }, [updateGroup]);

  // Drag handlers for widget-to-group
  const handleWidgetDragStart = useCallback((widgetId: string) => {
    setDraggedWidgetId(widgetId);
  }, []);

  const handleWidgetDragEnd = useCallback(() => {
    setDraggedWidgetId(null);
  }, []);

  const handleDropOnGroup = useCallback(async (groupId: string) => {
    if (draggedWidgetId) {
      await handleAddWidgetToGroup(draggedWidgetId, groupId);
      setDraggedWidgetId(null);
    }
  }, [draggedWidgetId, handleAddWidgetToGroup]);

  // Memoized computed values to prevent recalculation on every render
  const groupedWidgetIds = useMemo(
    () => new Set(groups.flatMap(g => g.members.map(m => m.widget_id))),
    [groups]
  );

  const standaloneWidgets = useMemo(
    () => widgets.filter(w => !groupedWidgetIds.has(w.id)),
    [widgets, groupedWidgetIds]
  );

  const availableWidgetsForGroup = standaloneWidgets;

  const enabledIntegrations = useMemo(
    () => integrations.filter(i => i.enabled),
    [integrations]
  );

  // Memoized helper to get widgets for a specific group
  const getGroupWidgets = useCallback((group: WidgetGroupType): WidgetWithLayout[] => {
    return group.members
      .map(member => {
        const widget = widgets.find(w => w.id === member.widget_id);
        if (widget) {
          return {
            ...widget,
            layout: {
              widget_id: widget.id,
              x: member.x,
              y: member.y,
              w: member.w,
              h: member.h,
            },
          };
        }
        return null;
      })
      .filter((w): w is WidgetWithLayout => w !== null);
  }, [widgets]);

  if (loading && widgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div id="dashboard-container" className="min-h-[calc(100vh-12rem)] relative">
      {/* Floating Add Button - Bottom Left */}
      {isEditMode && (
        <div className="fixed bottom-6 left-6 z-50" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-14 h-14 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-700 shadow-lg text-xl font-bold transition-all hover:scale-105"
            title="Add"
          >
            <svg className={`w-7 h-7 transition-transform ${showAddMenu ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {showAddMenu && (
            <div className="absolute left-0 bottom-16 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1">
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setShowAddMenu(false);
                }}
                disabled={enabledIntegrations.length === 0}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                Widget
              </button>
              <button
                onClick={() => {
                  handleCreateGroup();
                  setShowAddMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Group
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {enabledIntegrations.length === 0 ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-8 rounded text-center">
          <p className="font-medium">No integrations configured</p>
          {!isKioskMode && <p className="text-sm mt-1">Go to Admin to add an integration first.</p>}
        </div>
      ) : standaloneWidgets.length === 0 && groups.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-4 py-8 rounded text-center">
          <p className="font-medium">No widgets yet</p>
          {!isKioskMode && (
            <p className="text-sm mt-1">
              {isEditMode
                ? 'Click the + button to add a widget.'
                : 'Switch to Edit mode to add widgets.'}
            </p>
          )}
        </div>
      ) : (
        <GridLayout
          className="layout"
          layout={[
            // Standalone widgets
            ...standaloneWidgets.map(w => ({
              i: w.id,
              x: w.layout.x,
              y: w.layout.y,
              w: w.layout.w,
              h: w.layout.h,
              minW: 1,
              minH: 1,
              static: !isEditMode,
            })),
            // Groups
            ...groups.map(g => ({
              i: `group-${g.id}`,
              x: g.layout?.x ?? 0,
              y: g.layout?.y ?? 0,
              w: g.layout?.w ?? 6,
              h: g.layout?.h ?? 4,
              minW: 2,
              minH: 2,
              static: !isEditMode,
            })),
          ]}
          cols={12}
          rowHeight={40}
          width={containerWidth}
          onLayoutChange={handleLayoutChange}
          onDragStop={handleDragStop}
          onResize={handleResize}
          onResizeStop={handleResizeStop}
          draggableHandle=".widget-drag-handle"
          draggableCancel=".widget-no-drag"
          isDraggable={isEditMode}
          isResizable={isEditMode}
        >
          {/* Render standalone widgets */}
          {standaloneWidgets.map(widget => {
            const integration = integrations.find(i => i.id === widget.integration_id);
            return (
              <div key={widget.id}>
                <WidgetWrapper
                  widget={widget}
                  integration={integration}
                  onRemove={() => handleRemoveWidget(widget.id)}
                  isEditMode={isEditMode}
                  availableGroups={groups.map(g => ({ id: g.id, title: g.title }))}
                  onAddToGroup={(groupId) => handleAddWidgetToGroup(widget.id, groupId)}
                  onCreateGroup={handleCreateGroup}
                  onDragStart={() => handleWidgetDragStart(widget.id)}
                  onDragEnd={handleWidgetDragEnd}
                />
              </div>
            );
          })}
          {/* Render groups */}
          {groups.map(group => (
            <div key={`group-${group.id}`} className={isEditMode ? 'widget-drag-handle' : ''}>
              <WidgetGroup
                group={group}
                widgets={getGroupWidgets(group)}
                integrations={integrations}
                width={((group.layout?.w ?? 6) / 12) * containerWidth}
                height={(group.layout?.h ?? 4) * 40}
                onRemoveGroup={() => handleRemoveGroup(group.id)}
                onRemoveWidget={(widgetId) => handleRemoveWidgetFromGroup(widgetId, group.id)}
                onEditGroup={() => handleEditGroup(group)}
                isEditMode={isEditMode}
                isDragTarget={!!draggedWidgetId}
                onDropWidget={() => handleDropOnGroup(group.id)}
              />
            </div>
          ))}
        </GridLayout>
      )}

      {showAddModal && (
        <AddWidgetModal
          integrations={enabledIntegrations}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showGroupModal && (
        <GroupModal
          group={editingGroup}
          availableWidgets={editingGroup
            ? [...availableWidgetsForGroup, ...getGroupWidgets(editingGroup)]
            : availableWidgetsForGroup
          }
          preselectedWidgetId={preselectedWidgetId}
          onClose={() => {
            setShowGroupModal(false);
            setEditingGroup(null);
            setPreselectedWidgetId(null);
          }}
          onSave={handleSaveGroup}
        />
      )}

      {/* Resize overlay showing dimensions */}
      {resizingItem && (
        <ResizeOverlay
          width={resizingItem.w}
          height={resizingItem.h}
          minWidth={resizingItem.minW}
          minHeight={resizingItem.minH}
          position={resizingItem.position}
        />
      )}
    </div>
  );
}
