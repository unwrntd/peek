import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../database/db';
import { queryOne, queryAll } from '../database/queryHelpers';
import { logger } from '../services/logger';
import { Dashboard } from '../types';

const router = Router();

function rowToDashboard(row: Record<string, unknown>): Dashboard {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    is_default: (row.is_default as number) === 1,
    kiosk_slug: (row.kiosk_slug as string) || '',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    widget_count: row.widget_count as number | undefined,
    group_count: row.group_count as number | undefined,
  };
}

// Get all dashboards
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = queryAll(`
      SELECT
        d.*,
        (
          SELECT COUNT(DISTINCT dl.widget_id)
          FROM dashboard_layouts dl
          WHERE dl.dashboard_id = d.id
        ) + (
          SELECT COUNT(DISTINCT gm.widget_id)
          FROM group_members gm
          WHERE gm.dashboard_id = d.id
        ) as widget_count,
        (
          SELECT COUNT(*)
          FROM widget_groups wg
          WHERE wg.dashboard_id = d.id
        ) as group_count
      FROM dashboards d
      ORDER BY d.is_default DESC, d.name ASC
    `);

    const dashboards = rows.map(rowToDashboard);
    res.json(dashboards);
  } catch (error) {
    logger.error('dashboards', 'Failed to fetch dashboards', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch dashboards' });
  }
});

// Get default dashboard
router.get('/default', (_req: Request, res: Response) => {
  try {
    const row = queryOne(`SELECT * FROM dashboards WHERE is_default = 1 LIMIT 1`);
    if (!row) {
      res.status(404).json({ error: 'No default dashboard found' });
      return;
    }
    res.json(rowToDashboard(row));
  } catch (error) {
    logger.error('dashboards', 'Failed to fetch default dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch default dashboard' });
  }
});

// Get dashboard by kiosk slug (must be before /:id to avoid route conflict)
router.get('/by-slug/:slug', (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const row = queryOne(`SELECT * FROM dashboards WHERE kiosk_slug = ?`, [slug.toLowerCase()]);

    if (!row) {
      res.status(404).json({ error: 'Dashboard not found' });
      return;
    }

    res.json(rowToDashboard(row));
  } catch (error) {
    logger.error('dashboards', 'Failed to fetch dashboard by slug', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Get single dashboard by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const row = queryOne(`SELECT * FROM dashboards WHERE id = ?`, [id]);

    if (!row) {
      res.status(404).json({ error: 'Dashboard not found' });
      return;
    }

    res.json(rowToDashboard(row));
  } catch (error) {
    logger.error('dashboards', 'Failed to fetch dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Create a new dashboard
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { name, description = '', kiosk_slug = '' } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // Validate kiosk_slug if provided
    const slugValue = (kiosk_slug || '').trim().toLowerCase();
    if (slugValue) {
      // Check for valid slug format (alphanumeric, hyphens, underscores)
      if (!/^[a-z0-9_-]+$/.test(slugValue)) {
        res.status(400).json({ error: 'Kiosk URL slug must contain only letters, numbers, hyphens, and underscores' });
        return;
      }
      // Check uniqueness
      const existingSlug = queryOne(`SELECT id FROM dashboards WHERE kiosk_slug = ?`, [slugValue]);
      if (existingSlug) {
        res.status(400).json({ error: 'This kiosk URL slug is already in use' });
        return;
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO dashboards (id, name, description, is_default, kiosk_slug, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
      [id, name.trim(), description, slugValue, now, now]
    );
    saveDatabase();

    logger.info('dashboards', 'Created dashboard', { id, name });

    const dashboard: Dashboard = {
      id,
      name: name.trim(),
      description,
      is_default: false,
      kiosk_slug: slugValue,
      created_at: now,
      updated_at: now,
    };

    res.status(201).json(dashboard);
  } catch (error) {
    logger.error('dashboards', 'Failed to create dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

// Update dashboard metadata
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, description, kiosk_slug } = req.body;

    const existing = queryOne(`SELECT * FROM dashboards WHERE id = ?`, [id]);
    if (!existing) {
      res.status(404).json({ error: 'Dashboard not found' });
      return;
    }

    const now = new Date().toISOString();
    const newName = name !== undefined ? name.trim() : existing.name;
    const newDescription = description !== undefined ? description : existing.description;

    // Handle kiosk_slug update
    let newKioskSlug = existing.kiosk_slug as string;
    if (kiosk_slug !== undefined) {
      newKioskSlug = (kiosk_slug || '').trim().toLowerCase();
      if (newKioskSlug) {
        // Check for valid slug format
        if (!/^[a-z0-9_-]+$/.test(newKioskSlug)) {
          res.status(400).json({ error: 'Kiosk URL slug must contain only letters, numbers, hyphens, and underscores' });
          return;
        }
        // Check uniqueness (exclude current dashboard)
        const existingSlug = queryOne(`SELECT id FROM dashboards WHERE kiosk_slug = ? AND id != ?`, [newKioskSlug, id]);
        if (existingSlug) {
          res.status(400).json({ error: 'This kiosk URL slug is already in use' });
          return;
        }
      }
    }

    if (!newName || newName === '') {
      res.status(400).json({ error: 'Name cannot be empty' });
      return;
    }

    db.run(
      `UPDATE dashboards SET name = ?, description = ?, kiosk_slug = ?, updated_at = ? WHERE id = ?`,
      [newName, newDescription, newKioskSlug, now, id]
    );
    saveDatabase();

    logger.info('dashboards', 'Updated dashboard', { id, name: newName });

    res.json({
      id,
      name: newName,
      description: newDescription,
      is_default: (existing.is_default as number) === 1,
      kiosk_slug: newKioskSlug,
      created_at: existing.created_at as string,
      updated_at: now,
    });
  } catch (error) {
    logger.error('dashboards', 'Failed to update dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to update dashboard' });
  }
});

// Delete a dashboard
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = queryOne(`SELECT * FROM dashboards WHERE id = ?`, [id]);
    if (!existing) {
      res.status(404).json({ error: 'Dashboard not found' });
      return;
    }

    if ((existing.is_default as number) === 1) {
      res.status(400).json({ error: 'Cannot delete the default dashboard' });
      return;
    }

    // Delete related data (cascade will handle most, but we'll be explicit)
    // Note: Widgets are NOT deleted - they can be reused in other dashboards
    db.run(`DELETE FROM group_members WHERE dashboard_id = ?`, [id]);
    db.run(`DELETE FROM group_layouts WHERE dashboard_id = ?`, [id]);
    db.run(`DELETE FROM widget_groups WHERE dashboard_id = ?`, [id]);
    db.run(`DELETE FROM dashboard_layouts WHERE dashboard_id = ?`, [id]);
    db.run(`DELETE FROM dashboards WHERE id = ?`, [id]);
    saveDatabase();

    logger.info('dashboards', 'Deleted dashboard', { id });

    res.json({ success: true });
  } catch (error) {
    logger.error('dashboards', 'Failed to delete dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to delete dashboard' });
  }
});

// Set dashboard as default
router.put('/:id/default', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = queryOne(`SELECT * FROM dashboards WHERE id = ?`, [id]);
    if (!existing) {
      res.status(404).json({ error: 'Dashboard not found' });
      return;
    }

    const now = new Date().toISOString();

    // Clear current default
    db.run(`UPDATE dashboards SET is_default = 0, updated_at = ? WHERE is_default = 1`, [now]);

    // Set new default
    db.run(`UPDATE dashboards SET is_default = 1, updated_at = ? WHERE id = ?`, [now, id]);
    saveDatabase();

    logger.info('dashboards', 'Set default dashboard', { id });

    res.json({
      ...rowToDashboard(existing),
      is_default: true,
      updated_at: now,
    });
  } catch (error) {
    logger.error('dashboards', 'Failed to set default dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to set default dashboard' });
  }
});

// Duplicate a dashboard
router.post('/:id/duplicate', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name } = req.body;

    const existing = queryOne(`SELECT * FROM dashboards WHERE id = ?`, [id]);
    if (!existing) {
      res.status(404).json({ error: 'Dashboard not found' });
      return;
    }

    const newId = uuidv4();
    const now = new Date().toISOString();
    const newName = name || `${existing.name} (Copy)`;

    // Create new dashboard
    db.run(
      `INSERT INTO dashboards (id, name, description, is_default, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [newId, newName, existing.description, now, now]
    );

    // Copy dashboard layouts
    const layouts = queryAll(`SELECT * FROM dashboard_layouts WHERE dashboard_id = ?`, [id]);
    for (const layout of layouts) {
      db.run(
        `INSERT INTO dashboard_layouts (dashboard_id, widget_id, x, y, w, h)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, layout.widget_id as string, layout.x as number, layout.y as number, layout.w as number, layout.h as number]
      );
    }

    // Copy widget groups
    const groups = queryAll(`SELECT * FROM widget_groups WHERE dashboard_id = ?`, [id]);
    const groupIdMap = new Map<string, string>();

    for (const group of groups) {
      const newGroupId = uuidv4();
      groupIdMap.set(group.id as string, newGroupId);

      db.run(
        `INSERT INTO widget_groups (id, dashboard_id, title, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newGroupId, newId, group.title as string, group.config as string, now, now]
      );
    }

    // Copy group layouts
    const groupLayouts = queryAll(`SELECT * FROM group_layouts WHERE dashboard_id = ?`, [id]);
    for (const layout of groupLayouts) {
      const newGroupId = groupIdMap.get(layout.group_id as string);
      if (newGroupId) {
        db.run(
          `INSERT INTO group_layouts (dashboard_id, group_id, x, y, w, h)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId, newGroupId, layout.x as number, layout.y as number, layout.w as number, layout.h as number]
        );
      }
    }

    // Copy group members
    const members = queryAll(`SELECT * FROM group_members WHERE dashboard_id = ?`, [id]);
    for (const member of members) {
      const newGroupId = groupIdMap.get(member.group_id as string);
      if (newGroupId) {
        db.run(
          `INSERT INTO group_members (id, dashboard_id, group_id, widget_id, x, y, w, h)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), newId, newGroupId, member.widget_id as string, member.x as number, member.y as number, member.w as number, member.h as number]
        );
      }
    }

    saveDatabase();

    logger.info('dashboards', 'Duplicated dashboard', { sourceId: id, newId });

    res.status(201).json({
      id: newId,
      name: newName,
      description: (existing.description as string) || '',
      is_default: false,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    logger.error('dashboards', 'Failed to duplicate dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to duplicate dashboard' });
  }
});

// Export a dashboard
router.get('/:id/export', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify dashboard exists
    const dashboard = queryOne(`SELECT * FROM dashboards WHERE id = ?`, [id]);
    if (!dashboard) {
      res.status(404).json({ error: 'Dashboard not found' });
      return;
    }

    // Get all widgets with their layouts for this dashboard
    const widgetRows = queryAll(`
      SELECT w.id, w.widget_type, w.title, w.config, w.integration_id,
             dl.x, dl.y, dl.w, dl.h,
             i.type as integration_type
      FROM dashboard_layouts dl
      JOIN widgets w ON dl.widget_id = w.id
      LEFT JOIN integrations i ON w.integration_id = i.id
      WHERE dl.dashboard_id = ?
    `, [id]);

    // Get all groups for this dashboard
    const groupRows = queryAll(`
      SELECT g.id, g.title, g.config, gl.x, gl.y, gl.w, gl.h
      FROM widget_groups g
      LEFT JOIN group_layouts gl ON g.id = gl.group_id AND gl.dashboard_id = ?
      WHERE g.dashboard_id = ?
    `, [id, id]);

    // Get group members with widget info
    const memberRows = queryAll(`
      SELECT gm.group_id, gm.widget_id, gm.x, gm.y, gm.w, gm.h,
             w.widget_type, w.title as widget_title, w.config as widget_config, w.integration_id,
             i.type as integration_type
      FROM group_members gm
      JOIN widgets w ON gm.widget_id = w.id
      LEFT JOIN integrations i ON w.integration_id = i.id
      WHERE gm.dashboard_id = ?
    `, [id]);

    // Build widget index map (for groups to reference)
    const allWidgets: Array<{
      widget_type: string;
      title: string;
      config: Record<string, unknown>;
      integration_type: string;
      layout: { x: number; y: number; w: number; h: number };
    }> = [];

    // Add standalone widgets
    widgetRows.forEach(row => {
      allWidgets.push({
        widget_type: row.widget_type as string,
        title: row.title as string,
        config: JSON.parse((row.config as string) || '{}'),
        integration_type: (row.integration_type as string) || 'static',
        layout: {
          x: row.x as number,
          y: row.y as number,
          w: row.w as number,
          h: row.h as number,
        },
      });
    });

    // Add grouped widgets
    memberRows.forEach(row => {
      allWidgets.push({
        widget_type: row.widget_type as string,
        title: row.widget_title as string,
        config: JSON.parse((row.widget_config as string) || '{}'),
        integration_type: (row.integration_type as string) || 'static',
        layout: {
          x: row.x as number,
          y: row.y as number,
          w: row.w as number,
          h: row.h as number,
        },
      });
    });

    // Create widget ID to index map
    const widgetIdToIndex = new Map<string, number>();
    let index = 0;
    widgetRows.forEach(row => {
      widgetIdToIndex.set(row.id as string, index++);
    });
    memberRows.forEach(row => {
      widgetIdToIndex.set(row.widget_id as string, index++);
    });

    // Build groups with member references
    const groups = groupRows.map(group => {
      const groupMembers = memberRows.filter(m => m.group_id === group.id);
      return {
        title: group.title as string,
        config: JSON.parse((group.config as string) || '{}'),
        layout: {
          x: (group.x as number) ?? 0,
          y: (group.y as number) ?? 0,
          w: (group.w as number) ?? 6,
          h: (group.h as number) ?? 4,
        },
        members: groupMembers.map(m => ({
          widget_index: widgetIdToIndex.get(m.widget_id as string)!,
          x: m.x as number,
          y: m.y as number,
          w: m.w as number,
          h: m.h as number,
        })),
      };
    });

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      dashboard: {
        name: dashboard.name as string,
        description: (dashboard.description as string) || '',
      },
      widgets: allWidgets,
      groups,
    };

    logger.info('dashboards', 'Exported dashboard', { id });

    res.json(exportData);
  } catch (error) {
    logger.error('dashboards', 'Failed to export dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to export dashboard' });
  }
});

// Import a dashboard
router.post('/import', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { data, mappings } = req.body;

    if (!data || !data.version || !data.dashboard || !Array.isArray(data.widgets)) {
      res.status(400).json({ error: 'Invalid import data format' });
      return;
    }

    if (!mappings || typeof mappings !== 'object') {
      res.status(400).json({ error: 'Integration mappings are required' });
      return;
    }

    const now = new Date().toISOString();
    const dashboardId = uuidv4();

    // Create the dashboard
    db.run(
      `INSERT INTO dashboards (id, name, description, is_default, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [dashboardId, data.dashboard.name, data.dashboard.description || '', now, now]
    );

    // Track created widget IDs for group member references
    const widgetIndexToId = new Map<number, string>();

    // Create widgets and their layouts
    for (let i = 0; i < data.widgets.length; i++) {
      const widget = data.widgets[i];
      const isStaticWidget = widget.integration_type === 'static';
      const integrationId = isStaticWidget ? null : mappings[widget.integration_type];

      if (!isStaticWidget && !integrationId) {
        // Skip widgets with unmapped integrations
        logger.warn('dashboards', `Skipping widget with unmapped integration type: ${widget.integration_type}`);
        continue;
      }

      // Verify integration exists (only for non-static widgets)
      if (!isStaticWidget && integrationId) {
        const integration = queryOne(`SELECT id FROM integrations WHERE id = ?`, [integrationId]);
        if (!integration) {
          logger.warn('dashboards', `Skipping widget with invalid integration ID: ${integrationId}`);
          continue;
        }
      }

      const widgetId = uuidv4();
      widgetIndexToId.set(i, widgetId);

      // Create the widget
      db.run(
        `INSERT INTO widgets (id, integration_id, widget_type, title, config)
         VALUES (?, ?, ?, ?, ?)`,
        [widgetId, integrationId, widget.widget_type, widget.title, JSON.stringify(widget.config || {})]
      );
    }

    // Determine which widgets are standalone (not in any group)
    const groupedWidgetIndices = new Set<number>();
    if (Array.isArray(data.groups)) {
      data.groups.forEach((group: { members?: Array<{ widget_index: number }> }) => {
        if (Array.isArray(group.members)) {
          group.members.forEach(m => groupedWidgetIndices.add(m.widget_index));
        }
      });
    }

    // Create dashboard layouts for standalone widgets
    for (let i = 0; i < data.widgets.length; i++) {
      if (groupedWidgetIndices.has(i)) continue;

      const widgetId = widgetIndexToId.get(i);
      if (!widgetId) continue;

      const widget = data.widgets[i];
      db.run(
        `INSERT INTO dashboard_layouts (dashboard_id, widget_id, x, y, w, h)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [dashboardId, widgetId, widget.layout.x, widget.layout.y, widget.layout.w, widget.layout.h]
      );
    }

    // Create groups and their members
    if (Array.isArray(data.groups)) {
      for (const group of data.groups) {
        const groupId = uuidv4();

        // Create group
        db.run(
          `INSERT INTO widget_groups (id, dashboard_id, title, config, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [groupId, dashboardId, group.title, JSON.stringify(group.config || {}), now, now]
        );

        // Create group layout
        if (group.layout) {
          db.run(
            `INSERT INTO group_layouts (dashboard_id, group_id, x, y, w, h)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [dashboardId, groupId, group.layout.x, group.layout.y, group.layout.w, group.layout.h]
          );
        }

        // Create group members
        if (Array.isArray(group.members)) {
          for (const member of group.members) {
            const widgetId = widgetIndexToId.get(member.widget_index);
            if (!widgetId) continue;

            db.run(
              `INSERT INTO group_members (id, dashboard_id, group_id, widget_id, x, y, w, h)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuidv4(), dashboardId, groupId, widgetId, member.x, member.y, member.w, member.h]
            );
          }
        }
      }
    }

    saveDatabase();

    logger.info('dashboards', 'Imported dashboard', { id: dashboardId, name: data.dashboard.name });

    res.status(201).json({
      id: dashboardId,
      name: data.dashboard.name,
      description: data.dashboard.description || '',
      is_default: false,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    logger.error('dashboards', 'Failed to import dashboard', { error: String(error) });
    res.status(500).json({ error: 'Failed to import dashboard' });
  }
});

export default router;
