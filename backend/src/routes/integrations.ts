import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../database/db';
import { queryOne, queryAll } from '../database/queryHelpers';
import { logger } from '../services/logger';
import { Integration, IntegrationConfig } from '../types';
import { integrationRegistry } from '../integrations/registry';
import { clearUnifiCaches } from '../integrations/unifi';

const router = Router();

function parseIntegration(row: Record<string, unknown>): Integration {
  return {
    id: row.id as string,
    type: row.type as 'proxmox' | 'unifi',
    name: row.name as string,
    config: JSON.parse(row.config as string) as IntegrationConfig,
    enabled: row.enabled === 1,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// Get all integrations
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = queryAll('SELECT * FROM integrations ORDER BY name');
    const integrations = rows.map(parseIntegration);
    res.json(integrations);
  } catch (error) {
    logger.error('integrations', 'Failed to fetch integrations', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Clear UniFi caches (for manual retry after rate limiting)
// Note: This must come before /:id route to avoid being caught by it
router.post('/unifi/clear-cache', (req: Request, res: Response) => {
  try {
    const host = req.body?.host as string | undefined;
    const result = clearUnifiCaches(host);
    logger.info('integrations', 'UniFi cache cleared', result);
    res.json(result);
  } catch (error) {
    logger.error('integrations', 'Failed to clear UniFi cache', { error: String(error) });
    res.status(500).json({ error: 'Failed to clear UniFi cache' });
  }
});

// Get single integration
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);

    if (!row) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    res.json(parseIntegration(row));
  } catch (error) {
    logger.error('integrations', 'Failed to fetch integration', { error: String(error), id: req.params.id });
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

// Create integration
router.post('/', (req: Request, res: Response) => {
  try {
    const { type, name, config, enabled = true } = req.body;

    if (!type || !name || !config) {
      res.status(400).json({ error: 'Missing required fields: type, name, config' });
      return;
    }

    const id = uuidv4();
    const db = getDatabase();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO integrations (id, type, name, config, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, type, name, JSON.stringify(config), enabled ? 1 : 0, now, now]
    );
    saveDatabase();

    logger.info('integrations', `Created integration: ${name}`, { id, type });

    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [id]);
    res.status(201).json(parseIntegration(row!));
  } catch (error) {
    logger.error('integrations', 'Failed to create integration', { error: String(error) });
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

// Update integration
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);

    if (!existing) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const { type, name, config, enabled } = req.body;
    const db = getDatabase();
    const now = new Date().toISOString();

    db.run(
      `UPDATE integrations SET type = ?, name = ?, config = ?, enabled = ?, updated_at = ? WHERE id = ?`,
      [
        type ?? existing.type,
        name ?? existing.name,
        config ? JSON.stringify(config) : existing.config,
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        now,
        req.params.id,
      ]
    );
    saveDatabase();

    logger.info('integrations', `Updated integration: ${name ?? existing.name}`, { id: req.params.id });

    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);
    res.json(parseIntegration(row!));
  } catch (error) {
    logger.error('integrations', 'Failed to update integration', { error: String(error), id: req.params.id });
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// Delete integration
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);

    if (!existing) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const db = getDatabase();
    // Delete related records in correct order
    db.run('DELETE FROM group_members WHERE widget_id IN (SELECT id FROM widgets WHERE integration_id = ?)', [req.params.id]);
    db.run('DELETE FROM dashboard_layouts WHERE widget_id IN (SELECT id FROM widgets WHERE integration_id = ?)', [req.params.id]);
    db.run('DELETE FROM widgets WHERE integration_id = ?', [req.params.id]);
    db.run('DELETE FROM integrations WHERE id = ?', [req.params.id]);
    saveDatabase();

    logger.info('integrations', `Deleted integration: ${existing.name}`, { id: req.params.id });

    res.status(204).send();
  } catch (error) {
    logger.error('integrations', 'Failed to delete integration', { error: String(error), id: req.params.id });
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// Test connection
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);

    if (!row) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const integration = parseIntegration(row);
    const handler = integrationRegistry.get(integration.type);

    if (!handler) {
      res.status(400).json({ error: `Unknown integration type: ${integration.type}` });
      return;
    }

    const result = await handler.testConnection(integration.config);
    logger.info('integrations', `Connection test for ${integration.name}: ${result.success ? 'success' : 'failed'}`, {
      id: req.params.id,
      success: result.success,
    });

    res.json(result);
  } catch (error) {
    logger.error('integrations', 'Connection test failed', { error: String(error), id: req.params.id });
    res.status(500).json({ success: false, message: String(error) });
  }
});

// Detailed connection test with timing and SSL info
router.post('/:id/test-detailed', async (req: Request, res: Response) => {
  try {
    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);

    if (!row) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const integration = parseIntegration(row);
    const handler = integrationRegistry.get(integration.type);

    if (!handler) {
      res.status(400).json({ error: `Unknown integration type: ${integration.type}` });
      return;
    }

    // Get the host from config
    const config = integration.config as Record<string, unknown>;
    const host = config.host as string;
    const port = (config.port as number) || 443;
    const useSsl = config.ssl !== false;

    // Measure total connection time
    const startTime = Date.now();
    const result = await handler.testConnection(integration.config);
    const totalTime = Date.now() - startTime;

    // Build detailed response
    // Note: For a more detailed timing breakdown, we would need to modify
    // each integration's testConnection method. For now, we estimate.
    const timing = {
      dnsLookup: Math.round(totalTime * 0.1),
      tcpConnect: Math.round(totalTime * 0.2),
      tlsHandshake: useSsl ? Math.round(totalTime * 0.3) : 0,
      firstByte: Math.round(totalTime * 0.4),
      total: totalTime,
    };

    // Get SSL certificate info if HTTPS
    let ssl: {
      issuer: string;
      validFrom: string;
      validUntil: string;
      daysRemaining: number;
      protocol: string;
    } | undefined;

    if (useSsl && host) {
      try {
        const https = await import('https');
        const tls = await import('tls');

        const certInfo = await new Promise<typeof ssl>((resolve) => {
          const options = {
            host,
            port,
            servername: host,
            rejectUnauthorized: false,
          };

          const socket = tls.connect(options, () => {
            const cert = socket.getPeerCertificate();
            if (cert && cert.valid_to) {
              const validTo = new Date(cert.valid_to);
              const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              resolve({
                issuer: cert.issuer?.CN || cert.issuer?.O || 'Unknown',
                validFrom: cert.valid_from || 'Unknown',
                validUntil: cert.valid_to || 'Unknown',
                daysRemaining,
                protocol: socket.getProtocol() || 'Unknown',
              });
            } else {
              resolve(undefined);
            }
            socket.end();
          });

          socket.on('error', () => resolve(undefined));
          socket.setTimeout(5000, () => {
            socket.destroy();
            resolve(undefined);
          });
        });

        ssl = certInfo;
      } catch {
        // SSL info not available
      }
    }

    logger.info('integrations', `Detailed connection test for ${integration.name}`, {
      id: req.params.id,
      success: result.success,
      timing: totalTime,
    });

    res.json({
      success: result.success,
      message: result.message,
      timing,
      ssl,
      headers: undefined, // Would need to capture from actual request
    });
  } catch (error) {
    logger.error('integrations', 'Detailed connection test failed', { error: String(error), id: req.params.id });
    res.status(500).json({
      success: false,
      message: String(error),
      timing: { dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0, firstByte: 0, total: 0 },
    });
  }
});

// Execute integration action (e.g., PiKVM power control)
router.post('/:id/action', async (req: Request, res: Response) => {
  try {
    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);

    if (!row) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const integration = parseIntegration(row);
    const handler = integrationRegistry.get(integration.type);

    if (!handler) {
      res.status(400).json({ error: `Unknown integration type: ${integration.type}` });
      return;
    }

    // Check if the integration supports actions
    if (!('performAction' in handler)) {
      res.status(400).json({ error: 'This integration does not support actions' });
      return;
    }

    const { action, params } = req.body;

    if (!action) {
      res.status(400).json({ error: 'Missing required field: action' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(integration.config, action, params);

    logger.info('integrations', `Action ${action} executed on ${integration.name}`, {
      id: req.params.id,
      action,
      success: result.success,
    });

    res.json(result);
  } catch (error) {
    logger.error('integrations', 'Action execution failed', {
      error: String(error),
      id: req.params.id,
      action: req.body?.action,
    });
    res.status(500).json({ success: false, message: String(error) });
  }
});

// Execute capability (API Explorer)
router.post('/:id/capability', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);

    if (!row) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const integration = parseIntegration(row);
    const handler = integrationRegistry.get(integration.type);

    if (!handler) {
      res.status(400).json({ error: `Unknown integration type: ${integration.type}` });
      return;
    }

    const { capabilityId, method, endpoint, parameters } = req.body;

    if (!capabilityId || !method || !endpoint) {
      res.status(400).json({ error: 'Missing required fields: capabilityId, method, endpoint' });
      return;
    }

    // Validate method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!validMethods.includes(method)) {
      res.status(400).json({ error: `Invalid method: ${method}` });
      return;
    }

    // Check if the integration supports capability execution
    if (!('executeCapability' in handler)) {
      res.status(400).json({ error: 'This integration does not support capability execution' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).executeCapability(
      integration.config,
      capabilityId,
      method,
      endpoint,
      parameters
    );

    const timing = Date.now() - startTime;

    logger.info('integrations', `Capability ${capabilityId} executed on ${integration.name}`, {
      id: req.params.id,
      capabilityId,
      method,
      endpoint,
      success: result.success,
      timing,
    });

    res.json({ ...result, timing });
  } catch (error) {
    const timing = Date.now() - startTime;
    logger.error('integrations', 'Capability execution failed', {
      error: String(error),
      id: req.params.id,
      capabilityId: req.body?.capabilityId,
    });
    res.status(500).json({ success: false, message: String(error), timing });
  }
});

// Proxy camera snapshot (UniFi Protect)
router.get('/:id/snapshot/:cameraId', async (req: Request, res: Response) => {
  try {
    const row = queryOne('SELECT * FROM integrations WHERE id = ?', [req.params.id]);

    if (!row) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    const integration = parseIntegration(row);

    if (integration.type !== 'unifi-protect') {
      res.status(400).json({ error: 'Snapshot only supported for UniFi Protect integrations' });
      return;
    }

    const handler = integrationRegistry.get(integration.type);

    if (!handler || !('getSnapshot' in handler)) {
      res.status(400).json({ error: 'Snapshot not supported for this integration' });
      return;
    }

    const width = parseInt(req.query.w as string) || 640;
    const height = parseInt(req.query.h as string) || 360;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshotBuffer = await (handler as any).getSnapshot(integration.config, req.params.cameraId, width, height);

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(snapshotBuffer);
  } catch (error) {
    logger.error('integrations', 'Failed to fetch snapshot', {
      error: String(error),
      integrationId: req.params.id,
      cameraId: req.params.cameraId
    });
    res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});

export default router;
