import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../database/db';
import { queryOne, queryAll } from '../database/queryHelpers';
import { logger } from '../services/logger';

const router = Router();

interface WidgetGroup {
  id: string;
  dashboard_id: string;
  title: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface GroupMember {
  id: string;
  dashboard_id: string;
  group_id: string;
  widget_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  widget_title?: string;
  widget_type?: string;
  integration_id?: string;
}

interface GroupLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getDefaultDashboardId(): string | null {
  const row = queryOne(`SELECT id FROM dashboards WHERE is_default = 1 LIMIT 1`);
  return row ? (row.id as string) : null;
}

// Get all groups with their layouts and members for a dashboard
router.get('/', (req: Request, res: Response) => {
  try {
    const dashboardId = req.query.dashboardId as string || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    // Get all groups with layouts for this dashboard (single query)
    const groups = queryAll(`
      SELECT g.*, gl.x, gl.y, gl.w, gl.h
      FROM widget_groups g
      LEFT JOIN group_layouts gl ON g.id = gl.group_id AND gl.dashboard_id = ?
      WHERE g.dashboard_id = ?
      ORDER BY g.created_at DESC
    `, [dashboardId, dashboardId]);

    // Get all members for all groups in this dashboard in a single query
    const allMembers = queryAll(`
      SELECT gm.*, w.title as widget_title, w.widget_type, w.integration_id
      FROM group_members gm
      JOIN widgets w ON gm.widget_id = w.id
      WHERE gm.dashboard_id = ?
      ORDER BY gm.group_id, gm.y, gm.x
    `, [dashboardId]);

    // Group members by group_id for efficient lookup
    const membersByGroup = new Map<string, GroupMember[]>();
    for (const m of allMembers) {
      const groupId = m.group_id as string;
      if (!membersByGroup.has(groupId)) {
        membersByGroup.set(groupId, []);
      }
      membersByGroup.get(groupId)!.push({
        id: m.id as string,
        dashboard_id: m.dashboard_id as string,
        group_id: groupId,
        widget_id: m.widget_id as string,
        x: m.x as number,
        y: m.y as number,
        w: m.w as number,
        h: m.h as number,
        widget_title: m.widget_title as string | undefined,
        widget_type: m.widget_type as string | undefined,
        integration_id: m.integration_id as string | undefined,
      });
    }

    const result = groups.map((group) => {
      const groupId = group.id as string;

      const layout: GroupLayout | null = group.x !== null ? {
        x: group.x as number,
        y: group.y as number,
        w: group.w as number,
        h: group.h as number,
      } : null;

      return {
        id: groupId,
        dashboard_id: group.dashboard_id as string,
        title: group.title as string,
        config: JSON.parse((group.config as string) || '{}'),
        created_at: group.created_at as string,
        updated_at: group.updated_at as string,
        layout,
        members: membersByGroup.get(groupId) || [],
      };
    });

    res.json(result);
  } catch (error) {
    logger.error('groups', 'Failed to fetch groups', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Create a new group
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { title, config, layout, dashboardId: bodyDashboardId } = req.body;
    const dashboardId = bodyDashboardId || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO widget_groups (id, dashboard_id, title, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, dashboardId, title, JSON.stringify(config || {}), now, now]
    );

    // Create layout if provided
    if (layout) {
      db.run(
        `INSERT INTO group_layouts (dashboard_id, group_id, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?)`,
        [dashboardId, id, layout.x || 0, layout.y || 0, layout.w || 6, layout.h || 6]
      );
    }

    saveDatabase();
    logger.info('groups', 'Created group', { id, title, dashboardId });

    res.status(201).json({
      id,
      dashboard_id: dashboardId,
      title,
      config: config || {},
      created_at: now,
      updated_at: now,
      layout: layout || null,
      members: [],
    });
  } catch (error) {
    logger.error('groups', 'Failed to create group', { error: String(error) });
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Create a group with members in a single request (batch operation)
router.post('/batch', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { title, config, layout, members, dashboardId: bodyDashboardId } = req.body;
    const dashboardId = bodyDashboardId || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const groupId = uuidv4();
    const now = new Date().toISOString();

    // Create the group
    db.run(
      `INSERT INTO widget_groups (id, dashboard_id, title, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [groupId, dashboardId, title, JSON.stringify(config || {}), now, now]
    );

    // Create layout if provided
    if (layout) {
      db.run(
        `INSERT INTO group_layouts (dashboard_id, group_id, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?)`,
        [dashboardId, groupId, layout.x || 0, layout.y || 0, layout.w || 6, layout.h || 6]
      );
    }

    // Add all members in a batch
    const createdMembers: GroupMember[] = [];
    if (Array.isArray(members) && members.length > 0) {
      for (const member of members) {
        const { widget_id, x, y, w, h } = member;
        if (!widget_id) continue;

        // Check if widget exists
        const widget = queryOne(`SELECT id, title, widget_type, integration_id FROM widgets WHERE id = ?`, [widget_id]);
        if (!widget) continue;

        // Remove from any existing group in this dashboard
        db.run(`DELETE FROM group_members WHERE widget_id = ? AND dashboard_id = ?`, [widget_id, dashboardId]);

        // Remove from dashboard layout (it's now in a group)
        db.run(`DELETE FROM dashboard_layouts WHERE widget_id = ? AND dashboard_id = ?`, [widget_id, dashboardId]);

        const memberId = uuidv4();

        db.run(
          `INSERT INTO group_members (id, dashboard_id, group_id, widget_id, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [memberId, dashboardId, groupId, widget_id, x || 0, y || 0, w || 6, h || 4]
        );

        createdMembers.push({
          id: memberId,
          dashboard_id: dashboardId,
          group_id: groupId,
          widget_id,
          x: x || 0,
          y: y || 0,
          w: w || 6,
          h: h || 4,
          widget_title: widget.title as string,
          widget_type: widget.widget_type as string,
          integration_id: widget.integration_id as string | undefined,
        });
      }
    }

    saveDatabase();
    logger.info('groups', 'Created group with members (batch)', { groupId, title, memberCount: createdMembers.length, dashboardId });

    res.status(201).json({
      id: groupId,
      dashboard_id: dashboardId,
      title,
      config: config || {},
      created_at: now,
      updated_at: now,
      layout: layout || null,
      members: createdMembers,
    });
  } catch (error) {
    logger.error('groups', 'Failed to create group with members', { error: String(error) });
    res.status(500).json({ error: 'Failed to create group with members' });
  }
});

// Update a group
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, config } = req.body;

    const now = new Date().toISOString();

    db.run(
      `UPDATE widget_groups SET title = ?, config = ?, updated_at = ? WHERE id = ?`,
      [title, JSON.stringify(config || {}), now, id]
    );

    saveDatabase();
    logger.info('groups', 'Updated group', { id, title });

    res.json({ success: true });
  } catch (error) {
    logger.error('groups', 'Failed to update group', { error: String(error) });
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete a group
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const dashboardId = req.query.dashboardId as string || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    // Remove all members first (they go back to being standalone widgets)
    db.run(`DELETE FROM group_members WHERE group_id = ? AND dashboard_id = ?`, [id, dashboardId]);

    // Delete layout
    db.run(`DELETE FROM group_layouts WHERE group_id = ? AND dashboard_id = ?`, [id, dashboardId]);

    // Delete group
    db.run(`DELETE FROM widget_groups WHERE id = ?`, [id]);

    saveDatabase();
    logger.info('groups', 'Deleted group', { id, dashboardId });

    res.json({ success: true });
  } catch (error) {
    logger.error('groups', 'Failed to delete group', { error: String(error) });
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Add a widget to a group
router.post('/:id/members', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id: groupId } = req.params;
    const { widget_id, x, y, w, h, dashboardId: bodyDashboardId } = req.body;
    const dashboardId = bodyDashboardId || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    if (!widget_id) {
      res.status(400).json({ error: 'widget_id is required' });
      return;
    }

    // Check if widget exists
    const widget = queryOne(`SELECT id FROM widgets WHERE id = ?`, [widget_id]);
    if (!widget) {
      res.status(404).json({ error: 'Widget not found' });
      return;
    }

    // Remove from any existing group in this dashboard
    db.run(`DELETE FROM group_members WHERE widget_id = ? AND dashboard_id = ?`, [widget_id, dashboardId]);

    // Remove from dashboard layout (it's now in a group)
    db.run(`DELETE FROM dashboard_layouts WHERE widget_id = ? AND dashboard_id = ?`, [widget_id, dashboardId]);

    const memberId = uuidv4();

    db.run(
      `INSERT INTO group_members (id, dashboard_id, group_id, widget_id, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, dashboardId, groupId, widget_id, x || 0, y || 0, w || 6, h || 4]
    );

    saveDatabase();
    logger.info('groups', 'Added widget to group', { groupId, widget_id, dashboardId });

    res.status(201).json({
      id: memberId,
      dashboard_id: dashboardId,
      group_id: groupId,
      widget_id,
      x: x || 0,
      y: y || 0,
      w: w || 6,
      h: h || 4,
    });
  } catch (error) {
    logger.error('groups', 'Failed to add widget to group', { error: String(error) });
    res.status(500).json({ error: 'Failed to add widget to group' });
  }
});

// Remove a widget from a group
router.delete('/:id/members/:widgetId', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id: groupId, widgetId } = req.params;
    const dashboardId = req.query.dashboardId as string || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    db.run(`DELETE FROM group_members WHERE group_id = ? AND widget_id = ? AND dashboard_id = ?`, [groupId, widgetId, dashboardId]);

    // Calculate the bottom position based on existing widgets and groups
    let maxY = 0;

    // Get max Y from standalone widgets
    const widgetLayouts = queryAll(
      `SELECT y, h FROM dashboard_layouts WHERE dashboard_id = ?`,
      [dashboardId]
    );
    for (const layout of widgetLayouts) {
      const bottomY = ((layout.y as number) || 0) + ((layout.h as number) || 3);
      if (bottomY > maxY) maxY = bottomY;
    }

    // Get max Y from groups
    const groupLayouts = queryAll(
      `SELECT y, h FROM group_layouts WHERE dashboard_id = ?`,
      [dashboardId]
    );
    for (const layout of groupLayouts) {
      const bottomY = ((layout.y as number) || 0) + ((layout.h as number) || 4);
      if (bottomY > maxY) maxY = bottomY;
    }

    // Add back to dashboard layout at the bottom
    db.run(
      `INSERT OR REPLACE INTO dashboard_layouts (dashboard_id, widget_id, x, y, w, h) VALUES (?, ?, 0, ?, 4, 3)`,
      [dashboardId, widgetId, maxY]
    );

    saveDatabase();
    logger.info('groups', 'Removed widget from group', { groupId, widgetId, dashboardId, newY: maxY });

    res.json({ success: true });
  } catch (error) {
    logger.error('groups', 'Failed to remove widget from group', { error: String(error) });
    res.status(500).json({ error: 'Failed to remove widget from group' });
  }
});

// Update member layouts within a group
router.put('/:id/layouts', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id: groupId } = req.params;
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

    for (const layout of layouts) {
      db.run(
        `UPDATE group_members SET x = ?, y = ?, w = ?, h = ? WHERE group_id = ? AND widget_id = ? AND dashboard_id = ?`,
        [layout.x, layout.y, layout.w, layout.h, groupId, layout.widget_id, dashboardId]
      );
    }

    saveDatabase();
    logger.info('groups', 'Updated group member layouts', { groupId, count: layouts.length, dashboardId });

    res.json({ success: true });
  } catch (error) {
    logger.error('groups', 'Failed to update member layouts', { error: String(error) });
    res.status(500).json({ error: 'Failed to update member layouts' });
  }
});

// Update group's dashboard layout
router.put('/:id/layout', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id: groupId } = req.params;
    const { x, y, w, h, dashboardId: bodyDashboardId } = req.body;
    const dashboardId = bodyDashboardId || getDefaultDashboardId();

    if (!dashboardId) {
      res.status(400).json({ error: 'No dashboard ID provided and no default dashboard exists' });
      return;
    }

    // Use INSERT OR REPLACE to handle both insert and update in a single statement
    db.run(
      `INSERT OR REPLACE INTO group_layouts (dashboard_id, group_id, x, y, w, h) VALUES (?, ?, ?, ?, ?, ?)`,
      [dashboardId, groupId, x, y, w, h]
    );

    saveDatabase();
    logger.info('groups', 'Updated group layout', { groupId, dashboardId, x, y, w, h });

    res.json({ success: true });
  } catch (error) {
    logger.error('groups', 'Failed to update group layout', { error: String(error) });
    res.status(500).json({ error: 'Failed to update group layout' });
  }
});

export default router;
