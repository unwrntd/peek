import { Router, Request, Response } from 'express';
import { getDatabase, saveDatabase } from '../database/db';
import { queryOne, queryAll } from '../database/queryHelpers';
import { logger } from '../services/logger';
import { DashboardLayout, Widget } from '../types';

const router = Router();

function getDefaultDashboardId(): string | null {
  const row = queryOne(`SELECT id FROM dashboards WHERE is_default = 1 LIMIT 1`);
  return row ? (row.id as string) : null;
}

interface WidgetWithLayout extends Widget {
  layout: DashboardLayout;
}

// Get dashboard layout (widgets with positions)
router.get('/', (req: Request, res: Response) => {
  try {
    const dashboardId = req.query.dashboardId as string || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    // Get standalone widgets (with layouts in dashboard_layouts)
    const standaloneRows = queryAll(`
      SELECT w.id, w.integration_id, w.widget_type, w.title, w.config,
             dl.x, dl.y, dl.w, dl.h
      FROM widgets w
      INNER JOIN dashboard_layouts dl ON w.id = dl.widget_id
      WHERE dl.dashboard_id = ?
      ORDER BY w.title
    `, [dashboardId]);

    // Get grouped widgets (in group_members but not dashboard_layouts)
    // These need a placeholder layout since their real layout is managed by group_members
    const groupedRows = queryAll(`
      SELECT DISTINCT w.id, w.integration_id, w.widget_type, w.title, w.config
      FROM widgets w
      INNER JOIN group_members gm ON w.id = gm.widget_id
      WHERE gm.dashboard_id = ?
      ORDER BY w.title
    `, [dashboardId]);

    const standaloneWidgets: WidgetWithLayout[] = standaloneRows.map(row => ({
      id: row.id as string,
      integration_id: row.integration_id as string,
      widget_type: row.widget_type as string,
      title: row.title as string,
      config: JSON.parse((row.config as string) || '{}'),
      layout: {
        widget_id: row.id as string,
        x: (row.x as number) ?? 0,
        y: (row.y as number) ?? 0,
        w: (row.w as number) ?? 4,
        h: (row.h as number) ?? 3,
      },
    }));

    // Create set of standalone widget IDs for deduplication
    const standaloneIds = new Set(standaloneWidgets.map(w => w.id));

    // Add grouped widgets with placeholder layout (actual layout comes from group members)
    const groupedWidgets: WidgetWithLayout[] = groupedRows
      .filter(row => !standaloneIds.has(row.id as string))
      .map(row => ({
        id: row.id as string,
        integration_id: row.integration_id as string,
        widget_type: row.widget_type as string,
        title: row.title as string,
        config: JSON.parse((row.config as string) || '{}'),
        layout: {
          widget_id: row.id as string,
          x: 0,
          y: 0,
          w: 4,
          h: 3,
        },
      }));

    res.json([...standaloneWidgets, ...groupedWidgets]);
  } catch (error) {
    logger.error('dashboard', 'Failed to fetch dashboard layout', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch dashboard layout' });
  }
});

// Update single widget layout
router.put('/layout/:widgetId', (req: Request, res: Response) => {
  try {
    const { x, y, w, h, dashboardId: bodyDashboardId } = req.body;
    const { widgetId } = req.params;
    const dashboardId = bodyDashboardId || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    if (x === undefined || y === undefined || w === undefined || h === undefined) {
      res.status(400).json({ error: 'Missing required fields: x, y, w, h' });
      return;
    }

    // Verify widget exists
    const widget = queryOne('SELECT id FROM widgets WHERE id = ?', [widgetId]);
    if (!widget) {
      res.status(404).json({ error: 'Widget not found' });
      return;
    }

    const db = getDatabase();

    // Check if layout exists for this dashboard
    const existingLayout = queryOne(
      'SELECT widget_id FROM dashboard_layouts WHERE dashboard_id = ? AND widget_id = ?',
      [dashboardId, widgetId]
    );

    if (existingLayout) {
      db.run(
        `UPDATE dashboard_layouts SET x = ?, y = ?, w = ?, h = ? WHERE dashboard_id = ? AND widget_id = ?`,
        [x, y, w, h, dashboardId, widgetId]
      );
    } else {
      db.run(
        `INSERT INTO dashboard_layouts (dashboard_id, widget_id, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?)`,
        [dashboardId, widgetId, x, y, w, h]
      );
    }
    saveDatabase();

    logger.debug('dashboard', `Updated layout for widget ${widgetId}`, { dashboardId, x, y, w, h });

    res.json({ widget_id: widgetId, x, y, w, h });
  } catch (error) {
    logger.error('dashboard', 'Failed to update widget layout', { error: String(error) });
    res.status(500).json({ error: 'Failed to update widget layout' });
  }
});

// Batch update layouts
router.put('/layouts', (req: Request, res: Response) => {
  try {
    const { layouts, dashboardId: bodyDashboardId } = req.body;
    const dashboardId = bodyDashboardId || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    if (!Array.isArray(layouts)) {
      res.status(400).json({ error: 'layouts must be an array' });
      return;
    }

    const db = getDatabase();

    // Use INSERT OR REPLACE to handle both insert and update in a single statement
    // This eliminates the N+1 query pattern (no need to SELECT before INSERT/UPDATE)
    for (const layout of layouts as DashboardLayout[]) {
      db.run(
        `INSERT OR REPLACE INTO dashboard_layouts (dashboard_id, widget_id, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?)`,
        [dashboardId, layout.widget_id, layout.x, layout.y, layout.w, layout.h]
      );
    }
    saveDatabase();

    logger.info('dashboard', `Updated ${layouts.length} widget layouts`, { dashboardId });

    res.json({ updated: layouts.length });
  } catch (error) {
    logger.error('dashboard', 'Failed to batch update layouts', { error: String(error) });
    res.status(500).json({ error: 'Failed to update layouts' });
  }
});

// Add widget to dashboard
router.post('/widgets', (req: Request, res: Response) => {
  try {
    const { widgetId, x, y, w, h, dashboardId: bodyDashboardId } = req.body;
    const dashboardId = bodyDashboardId || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    if (!widgetId) {
      res.status(400).json({ error: 'widgetId is required' });
      return;
    }

    // Verify widget exists
    const widget = queryOne('SELECT id FROM widgets WHERE id = ?', [widgetId]);
    if (!widget) {
      res.status(404).json({ error: 'Widget not found' });
      return;
    }

    const db = getDatabase();

    // Check if widget is already on this dashboard
    const existingLayout = queryOne(
      'SELECT widget_id FROM dashboard_layouts WHERE dashboard_id = ? AND widget_id = ?',
      [dashboardId, widgetId]
    );

    if (existingLayout) {
      res.status(400).json({ error: 'Widget is already on this dashboard' });
      return;
    }

    db.run(
      `INSERT INTO dashboard_layouts (dashboard_id, widget_id, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?)`,
      [dashboardId, widgetId, x ?? 0, y ?? 0, w ?? 4, h ?? 3]
    );
    saveDatabase();

    logger.info('dashboard', `Added widget ${widgetId} to dashboard`, { dashboardId });

    res.status(201).json({ widget_id: widgetId, x: x ?? 0, y: y ?? 0, w: w ?? 4, h: h ?? 3 });
  } catch (error) {
    logger.error('dashboard', 'Failed to add widget to dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to add widget to dashboard' });
  }
});

// Remove widget from dashboard (does NOT delete the widget)
router.delete('/widgets/:widgetId', (req: Request, res: Response) => {
  try {
    const { widgetId } = req.params;
    const dashboardId = req.query.dashboardId as string || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    const db = getDatabase();

    // Also remove from any groups on this dashboard
    db.run(`DELETE FROM group_members WHERE dashboard_id = ? AND widget_id = ?`, [dashboardId, widgetId]);
    db.run(`DELETE FROM dashboard_layouts WHERE dashboard_id = ? AND widget_id = ?`, [dashboardId, widgetId]);
    saveDatabase();

    logger.info('dashboard', `Removed widget ${widgetId} from dashboard`, { dashboardId });

    res.json({ success: true });
  } catch (error) {
    logger.error('dashboard', 'Failed to remove widget from dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to remove widget from dashboard' });
  }
});

export default router;
