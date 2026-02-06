import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../database/db';
import { queryOne, queryAll } from '../database/queryHelpers';
import { logger } from '../services/logger';
import { Widget } from '../types';

const router = Router();

function parseWidget(row: Record<string, unknown>): Widget {
  return {
    id: row.id as string,
    integration_id: row.integration_id as string,
    widget_type: row.widget_type as string,
    title: row.title as string,
    config: JSON.parse((row.config as string) || '{}'),
  };
}

// Get all widgets
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = queryAll('SELECT * FROM widgets ORDER BY title');
    const widgets = rows.map(parseWidget);
    res.json(widgets);
  } catch (error) {
    logger.error('widgets', 'Failed to fetch widgets', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

// Get widgets by integration
router.get('/integration/:integrationId', (req: Request, res: Response) => {
  try {
    const rows = queryAll('SELECT * FROM widgets WHERE integration_id = ?', [req.params.integrationId]);
    const widgets = rows.map(parseWidget);
    res.json(widgets);
  } catch (error) {
    logger.error('widgets', 'Failed to fetch widgets by integration', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

// Get single widget
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = queryOne('SELECT * FROM widgets WHERE id = ?', [req.params.id]);

    if (!row) {
      res.status(404).json({ error: 'Widget not found' });
      return;
    }

    res.json(parseWidget(row));
  } catch (error) {
    logger.error('widgets', 'Failed to fetch widget', { error: String(error), id: req.params.id });
    res.status(500).json({ error: 'Failed to fetch widget' });
  }
});

// Static widget types that don't require an integration
const STATIC_WIDGET_TYPES = ['image', 'text', 'network-tools', 'rss', 'world-time', 'service-status', 'spacer'];

// Cross-integration widget types that aggregate data from multiple integrations
const CROSS_INTEGRATION_WIDGET_TYPES = [
  'cross-media-pipeline',
  'cross-subtitle-health',
  'cross-download-activity',
  'cross-transcoding-resources',
  'cross-service-mapping',
  'cross-client-correlation',
  'cross-switch-port-overlay',
];

// Create widget
router.post('/', (req: Request, res: Response) => {
  try {
    const { integration_id, widget_type, title, config = {} } = req.body;

    if (!widget_type || !title) {
      res.status(400).json({ error: 'Missing required fields: widget_type, title' });
      return;
    }

    const isStaticWidget = STATIC_WIDGET_TYPES.includes(widget_type);
    const isCrossIntegrationWidget = CROSS_INTEGRATION_WIDGET_TYPES.includes(widget_type);

    // Verify integration exists (only for non-static and non-cross-integration widgets)
    if (!isStaticWidget && !isCrossIntegrationWidget) {
      if (!integration_id) {
        res.status(400).json({ error: 'Missing required field: integration_id' });
        return;
      }

      const integration = queryOne('SELECT id FROM integrations WHERE id = ?', [integration_id]);

      if (!integration) {
        res.status(400).json({ error: 'Integration not found' });
        return;
      }
    }

    const id = uuidv4();
    const db = getDatabase();

    const effectiveIntegrationId = (isStaticWidget || isCrossIntegrationWidget) ? null : integration_id;

    db.run(
      `INSERT INTO widgets (id, integration_id, widget_type, title, config) VALUES (?, ?, ?, ?, ?)`,
      [id, effectiveIntegrationId, widget_type, title, JSON.stringify(config)]
    );
    saveDatabase();

    logger.info('widgets', `Created widget: ${title}`, { id, widget_type, integration_id: effectiveIntegrationId });

    const row = queryOne('SELECT * FROM widgets WHERE id = ?', [id]);
    res.status(201).json(parseWidget(row!));
  } catch (error) {
    logger.error('widgets', 'Failed to create widget', { error: String(error) });
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

// Update widget
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = queryOne('SELECT * FROM widgets WHERE id = ?', [req.params.id]);

    if (!existing) {
      res.status(404).json({ error: 'Widget not found' });
      return;
    }

    const { integration_id, widget_type, title, config } = req.body;

    // If changing integration, verify it exists
    if (integration_id && integration_id !== existing.integration_id) {
      const integration = queryOne('SELECT id FROM integrations WHERE id = ?', [integration_id]);
      if (!integration) {
        res.status(400).json({ error: 'Integration not found' });
        return;
      }
    }

    const db = getDatabase();
    db.run(
      `UPDATE widgets SET integration_id = ?, widget_type = ?, title = ?, config = ? WHERE id = ?`,
      [
        integration_id ?? existing.integration_id,
        widget_type ?? existing.widget_type,
        title ?? existing.title,
        config ? JSON.stringify(config) : existing.config,
        req.params.id,
      ]
    );
    saveDatabase();

    logger.info('widgets', `Updated widget: ${title ?? existing.title}`, { id: req.params.id });

    const row = queryOne('SELECT * FROM widgets WHERE id = ?', [req.params.id]);
    res.json(parseWidget(row!));
  } catch (error) {
    logger.error('widgets', 'Failed to update widget', { error: String(error), id: req.params.id });
    res.status(500).json({ error: 'Failed to update widget' });
  }
});

// Delete widget
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = queryOne('SELECT * FROM widgets WHERE id = ?', [req.params.id]);

    if (!existing) {
      res.status(404).json({ error: 'Widget not found' });
      return;
    }

    const db = getDatabase();
    // Clean up all related records
    db.run('DELETE FROM group_members WHERE widget_id = ?', [req.params.id]);
    db.run('DELETE FROM dashboard_layouts WHERE widget_id = ?', [req.params.id]);
    db.run('DELETE FROM widgets WHERE id = ?', [req.params.id]);
    saveDatabase();

    logger.info('widgets', `Deleted widget: ${existing.title}`, { id: req.params.id });

    res.status(204).send();
  } catch (error) {
    logger.error('widgets', 'Failed to delete widget', { error: String(error), id: req.params.id });
    res.status(500).json({ error: 'Failed to delete widget' });
  }
});

export default router;
