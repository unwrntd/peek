import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  WidgetWithLayout,
  DashboardLayout,
  Widget,
  WidgetGroup,
  GroupLayout,
  Dashboard,
  DashboardMode,
  DashboardExport,
  IntegrationMapping,
} from '../types';
import { dashboardApi, widgetApi, groupsApi, dashboardsApi } from '../api/client';

interface DashboardState {
  // Dashboard list
  dashboards: Dashboard[];
  currentDashboardId: string | null;
  mode: DashboardMode;

  // Current dashboard content
  widgets: WidgetWithLayout[];
  groups: WidgetGroup[];
  loading: boolean;
  error: string | null;

  // Dashboard management actions
  fetchDashboards: () => Promise<void>;
  setCurrentDashboard: (id: string) => Promise<void>;
  createDashboard: (data: { name: string; description?: string }) => Promise<Dashboard>;
  updateDashboard: (id: string, data: { name?: string; description?: string; kiosk_slug?: string }) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  duplicateDashboard: (id: string, name?: string) => Promise<Dashboard>;
  setDefaultDashboard: (id: string) => Promise<void>;

  // Mode management
  setMode: (mode: DashboardMode) => void;

  // Export/Import
  exportDashboard: (id: string) => Promise<DashboardExport>;
  importDashboard: (data: DashboardExport, mappings: IntegrationMapping) => Promise<Dashboard>;

  // Widget actions (existing, now scoped to current dashboard)
  fetchDashboard: () => Promise<void>;
  addWidget: (widget: Omit<Widget, 'id'>, layout?: Partial<DashboardLayout>) => Promise<void>;
  addWidgets: (widgets: Array<{ widget: Omit<Widget, 'id'>; layout?: Partial<DashboardLayout> }>) => Promise<void>;
  updateWidget: (widgetId: string, updates: Partial<Widget>) => Promise<void>;
  removeWidget: (widgetId: string) => Promise<void>;
  updateLayout: (widgetId: string, layout: Omit<DashboardLayout, 'widget_id'>) => void;
  saveLayouts: () => Promise<void>;

  // Group actions (existing, now scoped to current dashboard)
  fetchGroups: () => Promise<void>;
  createGroup: (data: { title: string; config?: Record<string, unknown>; widgetIds: string[] }) => Promise<void>;
  updateGroup: (groupId: string, data: { title?: string; config?: Record<string, unknown>; widgetIds?: string[] }) => Promise<void>;
  removeGroup: (groupId: string) => Promise<void>;
  updateGroupLayout: (groupId: string, layout: GroupLayout) => void;
  saveGroupLayouts: () => Promise<void>;

  // Move/Copy widgets between dashboards
  copyWidgetToDashboard: (widgetId: string, targetDashboardId: string) => Promise<void>;
  moveWidgetToDashboard: (widgetId: string, targetDashboardId: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // Initial state
      dashboards: [],
      currentDashboardId: null,
      mode: 'edit',
      widgets: [],
      groups: [],
      loading: false,
      error: null,

      // Dashboard management
      fetchDashboards: async () => {
        try {
          const dashboards = await dashboardsApi.getAll();
          set({ dashboards });

          // If no current dashboard, select the default one
          const currentId = get().currentDashboardId;
          if (!currentId || !dashboards.find(d => d.id === currentId)) {
            const defaultDashboard = dashboards.find(d => d.is_default) || dashboards[0];
            if (defaultDashboard) {
              set({ currentDashboardId: defaultDashboard.id });
            }
          }
        } catch (error) {
          console.error('Failed to fetch dashboards:', error);
        }
      },

      setCurrentDashboard: async (id: string) => {
        const currentId = get().currentDashboardId;
        const hasWidgets = get().widgets.length > 0;

        // Save current dashboard's layouts in background (non-blocking)
        if (currentId && currentId !== id && hasWidgets) {
          Promise.all([
            get().saveLayouts(),
            get().saveGroupLayouts(),
          ]).catch(error => {
            console.error('Failed to save layouts before switching:', error);
          });
        }

        // Immediately switch dashboard - clear old data and show loading
        set({ currentDashboardId: id, widgets: [], groups: [], loading: true, error: null });

        try {
          const [widgets, groups] = await Promise.all([
            dashboardApi.getLayout(id),
            groupsApi.getAll(id),
          ]);
          set({ widgets, groups, loading: false });
        } catch (error) {
          set({ error: String(error), loading: false });
        }
      },

      createDashboard: async (data) => {
        const dashboard = await dashboardsApi.create(data);
        set({ dashboards: [...get().dashboards, dashboard] });
        return dashboard;
      },

      updateDashboard: async (id, data) => {
        const dashboard = await dashboardsApi.update(id, data);
        set({
          dashboards: get().dashboards.map(d => (d.id === id ? dashboard : d)),
        });
      },

      deleteDashboard: async (id) => {
        const wasCurrentDashboard = get().currentDashboardId === id;

        await dashboardsApi.delete(id);
        const dashboards = get().dashboards.filter(d => d.id !== id);
        set({ dashboards });

        // If we deleted the current dashboard, switch to default without saving old layouts
        if (wasCurrentDashboard) {
          const defaultDashboard = dashboards.find(d => d.is_default) || dashboards[0];
          if (defaultDashboard) {
            // Clear current state and switch directly (don't save layouts for deleted dashboard)
            set({ currentDashboardId: defaultDashboard.id, widgets: [], groups: [], loading: true, error: null });
            try {
              const [widgets, groups] = await Promise.all([
                dashboardApi.getLayout(defaultDashboard.id),
                groupsApi.getAll(defaultDashboard.id),
              ]);
              set({ widgets, groups, loading: false });
            } catch (error) {
              set({ error: String(error), loading: false });
            }
          } else {
            // No dashboards left
            set({ currentDashboardId: null, widgets: [], groups: [] });
          }
        }
      },

      duplicateDashboard: async (id, name) => {
        const dashboard = await dashboardsApi.duplicate(id, name);
        set({ dashboards: [...get().dashboards, dashboard] });
        return dashboard;
      },

      setDefaultDashboard: async (id) => {
        const dashboard = await dashboardsApi.setDefault(id);
        set({
          dashboards: get().dashboards.map(d => ({
            ...d,
            is_default: d.id === id,
          })),
        });
      },

      // Mode management
      setMode: (mode) => {
        set({ mode });
      },

      // Export/Import
      exportDashboard: async (id) => {
        return await dashboardsApi.export(id);
      },

      importDashboard: async (data, mappings) => {
        const dashboard = await dashboardsApi.import(data, mappings);
        set({ dashboards: [...get().dashboards, dashboard] });
        return dashboard;
      },

      // Fetch current dashboard content
      fetchDashboard: async () => {
        const currentId = get().currentDashboardId;
        if (!currentId) return;

        set({ loading: true, error: null });
        try {
          const [widgets, groups] = await Promise.all([
            dashboardApi.getLayout(currentId),
            groupsApi.getAll(currentId),
          ]);
          set({ widgets, groups, loading: false });
        } catch (error) {
          set({ error: String(error), loading: false });
        }
      },

      addWidget: async (widgetData, layout) => {
        const dashboardId = get().currentDashboardId;
        try {
          const widget = await widgetApi.create(widgetData);

          // Calculate the next y position based on existing widgets
          const existingWidgets = get().widgets;
          let maxY = 0;
          for (const w of existingWidgets) {
            const bottomY = w.layout.y + w.layout.h;
            if (bottomY > maxY) maxY = bottomY;
          }

          const defaultLayout: DashboardLayout = {
            widget_id: widget.id,
            x: 0,
            y: maxY,
            w: layout?.w ?? 4,
            h: layout?.h ?? 3,
          };

          await dashboardApi.updateWidgetLayout(
            widget.id,
            {
              x: defaultLayout.x,
              y: defaultLayout.y,
              w: defaultLayout.w,
              h: defaultLayout.h,
            },
            dashboardId || undefined
          );

          const widgetWithLayout: WidgetWithLayout = {
            ...widget,
            layout: defaultLayout,
          };

          set({ widgets: [...get().widgets, widgetWithLayout] });
        } catch (error) {
          console.error('Failed to add widget:', error);
          throw error;
        }
      },

      addWidgets: async (widgetsData) => {
        const dashboardId = get().currentDashboardId;
        try {
          // Calculate the starting y position
          const existingWidgets = get().widgets;
          let maxY = 0;
          for (const w of existingWidgets) {
            const bottomY = w.layout.y + w.layout.h;
            if (bottomY > maxY) maxY = bottomY;
          }

          // Grid layout configuration
          const COLS_PER_ROW = 3;
          const DEFAULT_WIDTH = 4;
          const DEFAULT_HEIGHT = 3;

          const newWidgets: WidgetWithLayout[] = [];

          for (let i = 0; i < widgetsData.length; i++) {
            const { widget: widgetData, layout } = widgetsData[i];
            const widget = await widgetApi.create(widgetData);

            // Calculate grid position
            const col = i % COLS_PER_ROW;
            const row = Math.floor(i / COLS_PER_ROW);
            const widgetWidth = layout?.w ?? DEFAULT_WIDTH;
            const widgetHeight = layout?.h ?? DEFAULT_HEIGHT;

            const defaultLayout: DashboardLayout = {
              widget_id: widget.id,
              x: col * DEFAULT_WIDTH,
              y: maxY + (row * DEFAULT_HEIGHT),
              w: widgetWidth,
              h: widgetHeight,
            };

            await dashboardApi.updateWidgetLayout(
              widget.id,
              {
                x: defaultLayout.x,
                y: defaultLayout.y,
                w: defaultLayout.w,
                h: defaultLayout.h,
              },
              dashboardId || undefined
            );

            newWidgets.push({
              ...widget,
              layout: defaultLayout,
            });
          }

          set({ widgets: [...get().widgets, ...newWidgets] });
        } catch (error) {
          console.error('Failed to add widgets:', error);
          throw error;
        }
      },

      updateWidget: async (widgetId, updates) => {
        try {
          const updatedWidget = await widgetApi.update(widgetId, updates);
          set({
            widgets: get().widgets.map(w =>
              w.id === widgetId
                ? { ...w, ...updatedWidget, layout: w.layout } // Preserve layout
                : w
            ),
          });
        } catch (error) {
          console.error('Failed to update widget:', error);
          throw error;
        }
      },

      removeWidget: async (widgetId) => {
        try {
          await widgetApi.delete(widgetId);
          set({
            widgets: get().widgets.filter(w => w.id !== widgetId),
          });
        } catch (error) {
          console.error('Failed to remove widget:', error);
          throw error;
        }
      },

      updateLayout: (widgetId, layout) => {
        set({
          widgets: get().widgets.map(w =>
            w.id === widgetId
              ? { ...w, layout: { ...w.layout, ...layout, widget_id: widgetId } }
              : w
          ),
        });
      },

      saveLayouts: async () => {
        const dashboardId = get().currentDashboardId;
        try {
          const layouts = get().widgets.map(w => w.layout);
          await dashboardApi.updateLayouts(layouts, dashboardId || undefined);
        } catch (error) {
          console.error('Failed to save layouts:', error);
          throw error;
        }
      },

      // Group actions
      fetchGroups: async () => {
        const dashboardId = get().currentDashboardId;
        try {
          const groups = await groupsApi.getAll(dashboardId || undefined);
          set({ groups });
        } catch (error) {
          console.error('Failed to fetch groups:', error);
        }
      },

      createGroup: async (data) => {
        const dashboardId = get().currentDashboardId;
        try {
          // Calculate the next y position based on existing widgets and groups
          const existingWidgets = get().widgets;
          const existingGroups = get().groups;
          let maxY = 0;

          for (const w of existingWidgets) {
            const bottomY = w.layout.y + w.layout.h;
            if (bottomY > maxY) maxY = bottomY;
          }

          for (const g of existingGroups) {
            if (g.layout) {
              const bottomY = g.layout.y + g.layout.h;
              if (bottomY > maxY) maxY = bottomY;
            }
          }

          const defaultLayout: GroupLayout = {
            x: 0,
            y: maxY,
            w: 6,
            h: 4,
          };

          // Prepare member layouts
          const members = data.widgetIds.map((widgetId, i) => ({
            widget_id: widgetId,
            x: (i % 2) * 6,
            y: Math.floor(i / 2) * 4,
            w: 6,
            h: 4,
          }));

          // Create the group with all members in a single batch request
          await groupsApi.createWithMembers({
            title: data.title,
            config: data.config,
            layout: defaultLayout,
            members,
            dashboardId: dashboardId || undefined,
          });

          // Refetch dashboard to get updated state (widgets stay in store for group lookup)
          await get().fetchDashboard();
        } catch (error) {
          console.error('Failed to create group:', error);
          throw error;
        }
      },

      updateGroup: async (groupId, data) => {
        const dashboardId = get().currentDashboardId;
        try {
          // Update group title/config
          if (data.title || data.config) {
            await groupsApi.update(groupId, {
              title: data.title,
              config: data.config,
            });
          }

          // Handle widget membership changes if widgetIds provided
          if (data.widgetIds !== undefined) {
            const group = get().groups.find(g => g.id === groupId);
            if (group) {
              const currentWidgetIds = new Set(group.members.map(m => m.widget_id));
              const newWidgetIds = new Set(data.widgetIds);

              // Remove widgets no longer in group
              for (const member of group.members) {
                if (!newWidgetIds.has(member.widget_id)) {
                  await groupsApi.removeMember(groupId, member.widget_id, dashboardId || undefined);
                }
              }

              // Add new widgets to group
              let newIndex = group.members.length;
              for (const widgetId of data.widgetIds) {
                if (!currentWidgetIds.has(widgetId)) {
                  await groupsApi.addMember(groupId, {
                    widget_id: widgetId,
                    x: (newIndex % 2) * 6,
                    y: Math.floor(newIndex / 2) * 4,
                    w: 6,
                    h: 4,
                    dashboardId: dashboardId || undefined,
                  });
                  newIndex++;
                }
              }
            }
          }

          // Refetch everything to get updated state
          await get().fetchDashboard();
        } catch (error) {
          console.error('Failed to update group:', error);
          throw error;
        }
      },

      removeGroup: async (groupId) => {
        const dashboardId = get().currentDashboardId;
        try {
          await groupsApi.delete(groupId, dashboardId || undefined);
          set({
            groups: get().groups.filter(g => g.id !== groupId),
          });
          // Refetch dashboard to get widgets back
          await get().fetchDashboard();
        } catch (error) {
          console.error('Failed to remove group:', error);
          throw error;
        }
      },

      updateGroupLayout: (groupId, layout) => {
        set({
          groups: get().groups.map(g =>
            g.id === groupId ? { ...g, layout } : g
          ),
        });
      },

      saveGroupLayouts: async () => {
        const dashboardId = get().currentDashboardId;
        try {
          const groups = get().groups;
          await Promise.all(
            groups
              .filter(g => g.layout)
              .map(g => groupsApi.updateLayout(g.id, g.layout!, dashboardId || undefined))
          );
        } catch (error) {
          console.error('Failed to save group layouts:', error);
          throw error;
        }
      },

      // Copy widget to another dashboard
      copyWidgetToDashboard: async (widgetId: string, targetDashboardId: string) => {
        try {
          // Get the widget's current layout to preserve size
          const widget = get().widgets.find(w => w.id === widgetId);
          const layout = widget?.layout || { w: 4, h: 3 };

          // Add the existing widget to the target dashboard
          await dashboardApi.addWidgetToDashboard(
            widgetId,
            { x: 0, y: 0, w: layout.w, h: layout.h },
            targetDashboardId
          );
        } catch (error) {
          console.error('Failed to copy widget to dashboard:', error);
          throw error;
        }
      },

      // Move widget to another dashboard (copy + remove from current)
      moveWidgetToDashboard: async (widgetId: string, targetDashboardId: string) => {
        const currentDashboardId = get().currentDashboardId;
        if (!currentDashboardId) {
          throw new Error('No current dashboard');
        }

        try {
          // Get the widget's current layout to preserve size
          const widget = get().widgets.find(w => w.id === widgetId);
          const layout = widget?.layout || { w: 4, h: 3 };

          // Add the existing widget to the target dashboard
          await dashboardApi.addWidgetToDashboard(
            widgetId,
            { x: 0, y: 0, w: layout.w, h: layout.h },
            targetDashboardId
          );

          // Remove from current dashboard
          await dashboardApi.removeWidgetFromDashboard(widgetId, currentDashboardId);

          // Update local state
          set({
            widgets: get().widgets.filter(w => w.id !== widgetId),
          });
        } catch (error) {
          console.error('Failed to move widget to dashboard:', error);
          throw error;
        }
      },
    }),
    {
      name: 'dashboard-store',
      partialize: (state) => ({
        currentDashboardId: state.currentDashboardId,
        mode: state.mode,
      }),
    }
  )
);
