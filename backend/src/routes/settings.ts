import { Router, Request } from 'express';
import { SqlValue } from 'sql.js';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../database/db';
import { logger } from '../services/logger';

const router = Router();

// Setup uploads directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const name = file.fieldname + '-' + Date.now() + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, GIF, SVG, and ICO are allowed.'));
    }
  },
});

// Default branding settings
const defaultBranding: Record<string, string | boolean> = {
  siteName: 'Peek',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#6366f1', // Indigo-500
  accentColor: '#8b5cf6', // Violet-500
  hideNavTitle: true,
  iconStyle: 'emoji', // 'emoji', 'simple', or 'none'
};

// Keys that should be treated as booleans
const booleanKeys = ['hideNavTitle'];

// Get all branding settings
router.get('/branding', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT key, value FROM settings WHERE key LIKE 'branding.%'`);

    const branding: Record<string, string | boolean> = { ...defaultBranding };

    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach((row: SqlValue[]) => {
        const key = (row[0] as string).replace('branding.', '');
        const value = row[1] as string;
        if (key in branding) {
          // Convert boolean strings back to booleans
          if (booleanKeys.includes(key)) {
            branding[key] = value === 'true';
          } else {
            branding[key] = value;
          }
        }
      });
    }

    res.json(branding);
  } catch (error) {
    logger.error('settings', 'Failed to get branding settings', { error: String(error) });
    res.status(500).json({ error: 'Failed to get branding settings' });
  }
});

// Update branding settings
router.put('/branding', (req, res) => {
  try {
    const db = getDatabase();
    const updates = req.body as Record<string, string | boolean>;
    const now = new Date().toISOString();

    // Validate and update each setting
    const validKeys = Object.keys(defaultBranding);

    for (const [key, value] of Object.entries(updates)) {
      if (!validKeys.includes(key)) {
        continue; // Skip invalid keys
      }

      const dbKey = `branding.${key}`;
      // Convert booleans to strings for storage
      const dbValue = typeof value === 'boolean' ? String(value) : value;

      // Check if setting exists
      const existing = db.exec(`SELECT key FROM settings WHERE key = ?`, [dbKey]);

      if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = ?`, [dbValue, now, dbKey]);
      } else {
        db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`, [dbKey, dbValue, now]);
      }
    }

    saveDatabase();

    // Return updated branding
    const results = db.exec(`SELECT key, value FROM settings WHERE key LIKE 'branding.%'`);

    const branding: Record<string, string | boolean> = { ...defaultBranding };

    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach((row: SqlValue[]) => {
        const key = (row[0] as string).replace('branding.', '');
        const value = row[1] as string;
        if (key in branding) {
          // Convert boolean strings back to booleans
          if (booleanKeys.includes(key)) {
            branding[key] = value === 'true';
          } else {
            branding[key] = value;
          }
        }
      });
    }

    logger.info('settings', 'Branding settings updated');
    res.json(branding);
  } catch (error) {
    logger.error('settings', 'Failed to update branding settings', { error: String(error) });
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

// Upload logo
router.post('/branding/logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const url = `/uploads/${req.file.filename}`;
    logger.info('settings', 'Logo uploaded', { filename: req.file.filename });
    res.json({ url });
  } catch (error) {
    logger.error('settings', 'Failed to upload logo', { error: String(error) });
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Upload favicon
router.post('/branding/favicon', upload.single('favicon'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const url = `/uploads/${req.file.filename}`;
    logger.info('settings', 'Favicon uploaded', { filename: req.file.filename });
    res.json({ url });
  } catch (error) {
    logger.error('settings', 'Failed to upload favicon', { error: String(error) });
    res.status(500).json({ error: 'Failed to upload favicon' });
  }
});

// Get system status (CPU, memory, disk)
router.get('/system-status', async (_req, res) => {
  try {
    // CPU info
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || 'Unknown';

    // Calculate CPU usage from idle time
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpuCount;

    // Memory info
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    // Disk info for data directory
    let diskInfo = {
      total: 0,
      free: 0,
      used: 0,
      usagePercent: 0,
    };

    try {
      // Use df command to get disk info (works on Unix systems)
      // Using execFileSync with arguments array to prevent command injection
      const { execFileSync } = await import('child_process');
      const dfOutput = execFileSync('df', ['-k', DATA_DIR], { encoding: 'utf-8' });
      const lines = dfOutput.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 4) {
          diskInfo.total = parseInt(parts[1]) * 1024; // Convert from KB to bytes
          diskInfo.used = parseInt(parts[2]) * 1024;
          diskInfo.free = parseInt(parts[3]) * 1024;
          diskInfo.usagePercent = (diskInfo.used / diskInfo.total) * 100;
        }
      }
    } catch {
      // Fallback: try to get info from the current directory
      logger.debug('settings', 'df command failed, disk info unavailable');
    }

    // System info
    const uptime = os.uptime();
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();
    const nodeVersion = process.version;

    // Database size
    let databaseSize = 0;
    const dbPath = path.join(DATA_DIR, 'dash.db');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      databaseSize = stats.size;
    }

    // Uploads directory size
    let uploadsSize = 0;
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        try {
          const filePath = path.join(UPLOADS_DIR, file);
          const stats = fs.statSync(filePath);
          uploadsSize += stats.size;
        } catch {
          // Skip files we can't stat
        }
      }
    }

    res.json({
      cpu: {
        model: cpuModel,
        cores: cpuCount,
        usage: Math.round(cpuUsage * 10) / 10,
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: Math.round(memoryUsagePercent * 10) / 10,
      },
      disk: {
        total: diskInfo.total,
        used: diskInfo.used,
        free: diskInfo.free,
        usagePercent: Math.round(diskInfo.usagePercent * 10) / 10,
      },
      system: {
        hostname,
        platform,
        arch,
        uptime,
        nodeVersion,
      },
      storage: {
        databaseSize,
        uploadsSize,
        totalAppSize: databaseSize + uploadsSize,
      },
    });
  } catch (error) {
    logger.error('settings', 'Failed to get system status', { error: String(error) });
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// Export full configuration
router.get('/export', (_req, res) => {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();

    // 1. Export all dashboards with their widgets, layouts, and groups
    const dashboards: Record<string, unknown>[] = [];
    const dashboardRows = db.exec(`SELECT * FROM dashboards ORDER BY is_default DESC, name ASC`);

    if (dashboardRows.length > 0 && dashboardRows[0].values.length > 0) {
      const columns = dashboardRows[0].columns;
      for (const row of dashboardRows[0].values) {
        const dashboard: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          dashboard[col] = row[i];
        });

        const dashboardId = dashboard.id as string;

        // Get widgets with layouts for this dashboard
        const widgetRows = db.exec(`
          SELECT w.*, dl.x, dl.y, dl.w, dl.h
          FROM widgets w
          JOIN dashboard_layouts dl ON w.id = dl.widget_id
          WHERE dl.dashboard_id = ?
        `, [dashboardId]);

        const widgets: Record<string, unknown>[] = [];
        if (widgetRows.length > 0 && widgetRows[0].values.length > 0) {
          const wCols = widgetRows[0].columns;
          for (const wRow of widgetRows[0].values) {
            const widget: Record<string, unknown> = {};
            wCols.forEach((col, i) => {
              widget[col] = wRow[i];
            });
            widget.config = JSON.parse((widget.config as string) || '{}');
            widgets.push(widget);
          }
        }

        // Get groups with layouts and members
        const groupRows = db.exec(`
          SELECT g.*, gl.x, gl.y, gl.w, gl.h
          FROM widget_groups g
          LEFT JOIN group_layouts gl ON g.id = gl.group_id AND gl.dashboard_id = ?
          WHERE g.dashboard_id = ?
        `, [dashboardId, dashboardId]);

        const groups: Record<string, unknown>[] = [];
        if (groupRows.length > 0 && groupRows[0].values.length > 0) {
          const gCols = groupRows[0].columns;
          for (const gRow of groupRows[0].values) {
            const group: Record<string, unknown> = {};
            gCols.forEach((col, i) => {
              group[col] = gRow[i];
            });
            group.config = JSON.parse((group.config as string) || '{}');

            // Get group members
            const memberRows = db.exec(`
              SELECT gm.*, w.widget_type, w.title as widget_title, w.config as widget_config, w.integration_id
              FROM group_members gm
              JOIN widgets w ON gm.widget_id = w.id
              WHERE gm.group_id = ? AND gm.dashboard_id = ?
            `, [group.id as string, dashboardId]);

            const members: Record<string, unknown>[] = [];
            if (memberRows.length > 0 && memberRows[0].values.length > 0) {
              const mCols = memberRows[0].columns;
              for (const mRow of memberRows[0].values) {
                const member: Record<string, unknown> = {};
                mCols.forEach((col, i) => {
                  member[col] = mRow[i];
                });
                member.widget_config = JSON.parse((member.widget_config as string) || '{}');
                members.push(member);
              }
            }
            group.members = members;
            groups.push(group);
          }
        }

        dashboards.push({
          ...dashboard,
          is_default: dashboard.is_default === 1,
          widgets,
          groups,
        });
      }
    }

    // 2. Export integrations (sanitize passwords)
    const integrationRows = db.exec(`SELECT * FROM integrations ORDER BY name`);
    const integrations: Record<string, unknown>[] = [];
    if (integrationRows.length > 0 && integrationRows[0].values.length > 0) {
      const columns = integrationRows[0].columns;
      for (const row of integrationRows[0].values) {
        const integration: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          integration[col] = row[i];
        });

        // Parse and sanitize config - replace passwords with placeholder
        const config = JSON.parse((integration.config as string) || '{}');
        if (config.password) config.password = '***REDACTED***';
        if (config.tokenSecret) config.tokenSecret = '***REDACTED***';
        if (config.token) config.token = '***REDACTED***';
        if (config.apiKey) config.apiKey = '***REDACTED***';

        integration.config = config;
        integration.enabled = integration.enabled === 1;
        integrations.push(integration);
      }
    }

    // 3. Export branding settings
    const brandingRows = db.exec(`SELECT key, value FROM settings WHERE key LIKE 'branding.%'`);
    const branding: Record<string, string | boolean> = {
      siteName: 'Peek',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#6366f1',
      accentColor: '#8b5cf6',
      hideNavTitle: true,
      iconStyle: 'emoji',
    };
    if (brandingRows.length > 0 && brandingRows[0].values.length > 0) {
      brandingRows[0].values.forEach((row: SqlValue[]) => {
        const key = (row[0] as string).replace('branding.', '');
        const value = row[1] as string;
        if (key in branding) {
          if (key === 'hideNavTitle') {
            branding[key] = value === 'true';
          } else {
            branding[key] = value;
          }
        }
      });
    }

    // 4. Export switch templates
    let switchTemplates: unknown[] = [];
    const templateRows = db.exec(`SELECT value FROM settings WHERE key = 'switch-templates'`);
    if (templateRows.length > 0 && templateRows[0].values.length > 0) {
      try {
        switchTemplates = JSON.parse(templateRows[0].values[0][0] as string);
      } catch {
        switchTemplates = [];
      }
    }

    // 5. Export image libraries with metadata (not actual files)
    const libraryRows = db.exec(`
      SELECT l.*, COUNT(i.id) as image_count
      FROM image_libraries l
      LEFT JOIN library_images i ON l.id = i.library_id
      GROUP BY l.id
      ORDER BY l.name
    `);
    const libraries: Record<string, unknown>[] = [];
    if (libraryRows.length > 0 && libraryRows[0].values.length > 0) {
      const columns = libraryRows[0].columns;
      for (const row of libraryRows[0].values) {
        const library: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          library[col] = row[i];
        });

        // Get images metadata for this library
        const imageRows = db.exec(`
          SELECT id, filename, original_name, mime_type, size, width, height, url, alt_text, created_at
          FROM library_images WHERE library_id = ?
        `, [library.id as string]);

        const images: Record<string, unknown>[] = [];
        if (imageRows.length > 0 && imageRows[0].values.length > 0) {
          const iCols = imageRows[0].columns;
          for (const iRow of imageRows[0].values) {
            const image: Record<string, unknown> = {};
            iCols.forEach((col, i) => {
              image[col] = iRow[i];
            });
            images.push(image);
          }
        }
        library.images = images;
        libraries.push(library);
      }
    }

    const exportData = {
      version: '1.0',
      exported_at: now,
      dashboards,
      integrations,
      branding,
      switchTemplates,
      media: {
        libraries,
      },
    };

    logger.info('settings', 'Full configuration exported');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="peek-config-${now.split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    logger.error('settings', 'Failed to export configuration', { error: String(error) });
    res.status(500).json({ error: 'Failed to export configuration' });
  }
});

// Import configuration
router.post('/import', (req, res) => {
  try {
    const importData = req.body;
    const db = getDatabase();
    const now = new Date().toISOString();

    // Validate structure
    if (!importData || !importData.version) {
      return res.status(400).json({ error: 'Invalid import file format' });
    }

    const results = {
      integrations: { imported: 0, skipped: 0, errors: [] as string[] },
      dashboards: { imported: 0, skipped: 0, errors: [] as string[] },
      widgets: { imported: 0, errors: [] as string[] },
      groups: { imported: 0, errors: [] as string[] },
      branding: { imported: false },
    };

    // Map old integration IDs to new ones (for widgets that reference integrations)
    const integrationIdMap = new Map<string, string>();

    // 1. Import integrations
    if (Array.isArray(importData.integrations)) {
      for (const integration of importData.integrations) {
        try {
          // Check if integration with same name and type exists
          const existing = db.exec(
            `SELECT id FROM integrations WHERE name = ? AND type = ?`,
            [integration.name, integration.type]
          );

          if (existing.length > 0 && existing[0].values.length > 0) {
            // Map to existing integration
            integrationIdMap.set(integration.id, existing[0].values[0][0] as string);
            results.integrations.skipped++;
          } else {
            // Create new integration with new ID
            const newId = uuidv4();
            integrationIdMap.set(integration.id, newId);

            // Check for redacted credentials
            const config = integration.config || {};
            const hasRedacted =
              config.password === '***REDACTED***' ||
              config.tokenSecret === '***REDACTED***' ||
              config.token === '***REDACTED***' ||
              config.apiKey === '***REDACTED***';

            if (hasRedacted) {
              results.integrations.errors.push(
                `Integration "${integration.name}" has redacted credentials - you'll need to re-enter them`
              );
              // Clear redacted values
              if (config.password === '***REDACTED***') config.password = '';
              if (config.tokenSecret === '***REDACTED***') config.tokenSecret = '';
              if (config.token === '***REDACTED***') config.token = '';
              if (config.apiKey === '***REDACTED***') config.apiKey = '';
            }

            db.run(
              `INSERT INTO integrations (id, type, name, config, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                newId,
                integration.type,
                integration.name,
                JSON.stringify(config),
                integration.enabled ? 1 : 0,
                now,
                now,
              ]
            );
            results.integrations.imported++;
          }
        } catch (err) {
          results.integrations.errors.push(
            `Failed to import integration "${integration.name}": ${String(err)}`
          );
        }
      }
    }

    // 2. Import dashboards with widgets and groups
    if (Array.isArray(importData.dashboards)) {
      for (const dashboard of importData.dashboards) {
        try {
          // Check if dashboard with same name exists
          const existing = db.exec(
            `SELECT id FROM dashboards WHERE name = ?`,
            [dashboard.name]
          );

          let dashboardId: string;
          if (existing.length > 0 && existing[0].values.length > 0) {
            // Skip dashboard but continue to import widgets/groups into it
            dashboardId = existing[0].values[0][0] as string;
            results.dashboards.skipped++;
          } else {
            // Create new dashboard
            dashboardId = uuidv4();
            db.run(
              `INSERT INTO dashboards (id, name, description, is_default, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                dashboardId,
                dashboard.name,
                dashboard.description || '',
                dashboard.is_default ? 1 : 0,
                now,
                now,
              ]
            );
            results.dashboards.imported++;
          }

          // Import widgets for this dashboard
          const widgetIdMap = new Map<string, string>();
          if (Array.isArray(dashboard.widgets)) {
            for (const widget of dashboard.widgets) {
              try {
                const newWidgetId = uuidv4();
                widgetIdMap.set(widget.id, newWidgetId);

                // Map integration ID if it exists
                const mappedIntegrationId = widget.integration_id
                  ? integrationIdMap.get(widget.integration_id) || widget.integration_id
                  : null;

                db.run(
                  `INSERT INTO widgets (id, integration_id, widget_type, title, config)
                   VALUES (?, ?, ?, ?, ?)`,
                  [
                    newWidgetId,
                    mappedIntegrationId,
                    widget.widget_type,
                    widget.title,
                    JSON.stringify(widget.config || {}),
                  ]
                );

                // Add to dashboard layout
                db.run(
                  `INSERT INTO dashboard_layouts (dashboard_id, widget_id, x, y, w, h)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [dashboardId, newWidgetId, widget.x || 0, widget.y || 0, widget.w || 4, widget.h || 3]
                );

                results.widgets.imported++;
              } catch (err) {
                results.widgets.errors.push(
                  `Failed to import widget "${widget.title}": ${String(err)}`
                );
              }
            }
          }

          // Import groups for this dashboard
          if (Array.isArray(dashboard.groups)) {
            for (const group of dashboard.groups) {
              try {
                const newGroupId = uuidv4();

                db.run(
                  `INSERT INTO widget_groups (id, dashboard_id, title, config, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    newGroupId,
                    dashboardId,
                    group.title,
                    JSON.stringify(group.config || {}),
                    now,
                    now,
                  ]
                );

                // Add group layout
                if (group.x !== undefined && group.y !== undefined) {
                  db.run(
                    `INSERT INTO group_layouts (dashboard_id, group_id, x, y, w, h)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [dashboardId, newGroupId, group.x || 0, group.y || 0, group.w || 6, group.h || 4]
                  );
                }

                // Import group members
                if (Array.isArray(group.members)) {
                  for (const member of group.members) {
                    try {
                      // Create the widget if it doesn't exist already
                      let memberWidgetId = widgetIdMap.get(member.widget_id);

                      if (!memberWidgetId) {
                        // Widget was in a group, not standalone - create it
                        memberWidgetId = uuidv4();

                        const mappedIntegrationId = member.integration_id
                          ? integrationIdMap.get(member.integration_id) || member.integration_id
                          : null;

                        db.run(
                          `INSERT INTO widgets (id, integration_id, widget_type, title, config)
                           VALUES (?, ?, ?, ?, ?)`,
                          [
                            memberWidgetId,
                            mappedIntegrationId,
                            member.widget_type,
                            member.widget_title,
                            JSON.stringify(member.widget_config || {}),
                          ]
                        );
                        results.widgets.imported++;
                      } else {
                        // Widget exists but was standalone - remove from dashboard layout
                        db.run(
                          `DELETE FROM dashboard_layouts WHERE dashboard_id = ? AND widget_id = ?`,
                          [dashboardId, memberWidgetId]
                        );
                      }

                      // Add to group
                      db.run(
                        `INSERT INTO group_members (id, dashboard_id, group_id, widget_id, x, y, w, h)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          uuidv4(),
                          dashboardId,
                          newGroupId,
                          memberWidgetId,
                          member.x || 0,
                          member.y || 0,
                          member.w || 6,
                          member.h || 4,
                        ]
                      );
                    } catch (err) {
                      // Ignore individual member errors
                    }
                  }
                }

                results.groups.imported++;
              } catch (err) {
                results.groups.errors.push(
                  `Failed to import group "${group.title}": ${String(err)}`
                );
              }
            }
          }
        } catch (err) {
          results.dashboards.errors.push(
            `Failed to import dashboard "${dashboard.name}": ${String(err)}`
          );
        }
      }
    }

    // 3. Import branding settings
    if (importData.branding && typeof importData.branding === 'object') {
      const branding = importData.branding;
      const validKeys = ['siteName', 'logoUrl', 'faviconUrl', 'primaryColor', 'accentColor', 'hideNavTitle', 'iconStyle'];

      for (const [key, value] of Object.entries(branding)) {
        if (!validKeys.includes(key)) continue;

        const dbKey = `branding.${key}`;
        const dbValue = typeof value === 'boolean' ? String(value) : String(value);

        const existing = db.exec(`SELECT key FROM settings WHERE key = ?`, [dbKey]);
        if (existing.length > 0 && existing[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = ?`, [dbValue, now, dbKey]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`, [dbKey, dbValue, now]);
        }
      }
      results.branding.imported = true;
    }

    // 4. Import switch templates
    if (Array.isArray(importData.switchTemplates) && importData.switchTemplates.length > 0) {
      const templatesJson = JSON.stringify(importData.switchTemplates);
      const existing = db.exec(`SELECT key FROM settings WHERE key = 'switch-templates'`);

      if (existing.length > 0 && existing[0].values.length > 0) {
        // Merge with existing templates (avoid duplicates by ID)
        const existingTemplates = JSON.parse(
          (db.exec(`SELECT value FROM settings WHERE key = 'switch-templates'`)[0]?.values[0]?.[0] as string) || '[]'
        );
        const existingIds = new Set(existingTemplates.map((t: { id: string }) => t.id));
        const newTemplates = importData.switchTemplates.filter((t: { id: string }) => !existingIds.has(t.id));
        const mergedTemplates = [...existingTemplates, ...newTemplates];

        db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'switch-templates'`, [JSON.stringify(mergedTemplates), now]);
      } else {
        db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('switch-templates', ?, ?)`, [templatesJson, now]);
      }
    }

    // 5. Import port connections if provided
    // Note: These are stored in the export but need to be applied on the frontend
    // The frontend will read portConnections and networkDevices from the import response

    saveDatabase();

    logger.info('settings', 'Configuration imported', results);

    res.json({
      success: true,
      message: 'Configuration imported successfully',
      results,
    });
  } catch (error) {
    logger.error('settings', 'Failed to import configuration', { error: String(error) });
    res.status(500).json({ error: 'Failed to import configuration: ' + String(error) });
  }
});

// Get switch templates
router.get('/switch-templates', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'switch-templates'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const templates = JSON.parse(results[0].values[0][0] as string);
      res.json(templates);
    } else {
      res.json([]);
    }
  } catch (error) {
    logger.error('settings', 'Failed to get switch templates', { error: String(error) });
    res.status(500).json({ error: 'Failed to get switch templates' });
  }
});

// Save switch templates
router.put('/switch-templates', (req, res) => {
  try {
    const db = getDatabase();
    const templates = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(templates)) {
      return res.status(400).json({ error: 'Templates must be an array' });
    }

    const templatesJson = JSON.stringify(templates);

    // Check if setting exists
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'switch-templates'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'switch-templates'`, [templatesJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('switch-templates', ?, ?)`, [templatesJson, now]);
    }

    saveDatabase();
    logger.info('settings', 'Switch templates updated', { count: templates.length });
    res.json(templates);
  } catch (error) {
    logger.error('settings', 'Failed to save switch templates', { error: String(error) });
    res.status(500).json({ error: 'Failed to save switch templates' });
  }
});

// Get device templates
router.get('/device-templates', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'device-templates'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const templates = JSON.parse(results[0].values[0][0] as string);
      res.json(templates);
    } else {
      res.json([]);
    }
  } catch (error) {
    logger.error('settings', 'Failed to get device templates', { error: String(error) });
    res.status(500).json({ error: 'Failed to get device templates' });
  }
});

// Save device templates
router.put('/device-templates', (req, res) => {
  try {
    const db = getDatabase();
    const templates = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(templates)) {
      return res.status(400).json({ error: 'Templates must be an array' });
    }

    const templatesJson = JSON.stringify(templates);

    // Check if setting exists
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'device-templates'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'device-templates'`, [templatesJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('device-templates', ?, ?)`, [templatesJson, now]);
    }

    saveDatabase();
    logger.info('settings', 'Device templates updated', { count: templates.length });
    res.json(templates);
  } catch (error) {
    logger.error('settings', 'Failed to save device templates', { error: String(error) });
    res.status(500).json({ error: 'Failed to save device templates' });
  }
});

// Get device template editor settings
router.get('/device-template-editor', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'device-template-editor-settings'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const settings = JSON.parse(results[0].values[0][0] as string);
      res.json(settings);
    } else {
      // Return defaults
      res.json({ indicatorSize: 16, snapToGrid: false, gridSize: 5 });
    }
  } catch (error) {
    logger.error('settings', 'Failed to get device template editor settings', { error: String(error) });
    res.status(500).json({ error: 'Failed to get device template editor settings' });
  }
});

// Save device template editor settings
router.put('/device-template-editor', (req, res) => {
  try {
    const db = getDatabase();
    const settings = req.body;
    const now = new Date().toISOString();

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings must be an object' });
    }

    const settingsJson = JSON.stringify(settings);

    // Check if setting exists
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'device-template-editor-settings'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'device-template-editor-settings'`, [settingsJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('device-template-editor-settings', ?, ?)`, [settingsJson, now]);
    }

    saveDatabase();
    logger.debug('settings', 'Device template editor settings updated');
    res.json(settings);
  } catch (error) {
    logger.error('settings', 'Failed to save device template editor settings', { error: String(error) });
    res.status(500).json({ error: 'Failed to save device template editor settings' });
  }
});

// Get template editor settings
router.get('/template-editor', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'template-editor-settings'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const settings = JSON.parse(results[0].values[0][0] as string);
      res.json(settings);
    } else {
      // Return defaults
      res.json({ indicatorSize: 16, snapToGrid: false, gridSize: 5 });
    }
  } catch (error) {
    logger.error('settings', 'Failed to get template editor settings', { error: String(error) });
    res.status(500).json({ error: 'Failed to get template editor settings' });
  }
});

// Save template editor settings
router.put('/template-editor', (req, res) => {
  try {
    const db = getDatabase();
    const settings = req.body;
    const now = new Date().toISOString();

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings must be an object' });
    }

    const settingsJson = JSON.stringify(settings);

    // Check if setting exists
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'template-editor-settings'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'template-editor-settings'`, [settingsJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('template-editor-settings', ?, ?)`, [settingsJson, now]);
    }

    saveDatabase();
    logger.debug('settings', 'Template editor settings updated');
    res.json(settings);
  } catch (error) {
    logger.error('settings', 'Failed to save template editor settings', { error: String(error) });
    res.status(500).json({ error: 'Failed to save template editor settings' });
  }
});

// ==================== NETWORK CONFIGURATION ====================

// Get network devices
router.get('/network-devices', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'network-devices'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const devices = JSON.parse(results[0].values[0][0] as string);
      res.json(devices);
    } else {
      res.json([]);
    }
  } catch (error) {
    logger.error('settings', 'Failed to get network devices', { error: String(error) });
    res.status(500).json({ error: 'Failed to get network devices' });
  }
});

// Save network devices
router.put('/network-devices', (req, res) => {
  try {
    const db = getDatabase();
    const devices = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(devices)) {
      return res.status(400).json({ error: 'Devices must be an array' });
    }

    const devicesJson = JSON.stringify(devices);
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'network-devices'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-devices'`, [devicesJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-devices', ?, ?)`, [devicesJson, now]);
    }

    saveDatabase();
    logger.debug('settings', 'Network devices updated', { count: devices.length });
    res.json(devices);
  } catch (error) {
    logger.error('settings', 'Failed to save network devices', { error: String(error) });
    res.status(500).json({ error: 'Failed to save network devices' });
  }
});

// Get network connections
router.get('/network-connections', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'network-connections'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const connections = JSON.parse(results[0].values[0][0] as string);
      res.json(connections);
    } else {
      res.json([]);
    }
  } catch (error) {
    logger.error('settings', 'Failed to get network connections', { error: String(error) });
    res.status(500).json({ error: 'Failed to get network connections' });
  }
});

// Save network connections
router.put('/network-connections', (req, res) => {
  try {
    const db = getDatabase();
    const connections = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(connections)) {
      return res.status(400).json({ error: 'Connections must be an array' });
    }

    const connectionsJson = JSON.stringify(connections);
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'network-connections'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-connections'`, [connectionsJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-connections', ?, ?)`, [connectionsJson, now]);
    }

    saveDatabase();
    logger.debug('settings', 'Network connections updated', { count: connections.length });
    res.json(connections);
  } catch (error) {
    logger.error('settings', 'Failed to save network connections', { error: String(error) });
    res.status(500).json({ error: 'Failed to save network connections' });
  }
});

// Get port mappings
router.get('/network-port-mappings', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'network-port-mappings'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const mappings = JSON.parse(results[0].values[0][0] as string);
      res.json(mappings);
    } else {
      res.json([]);
    }
  } catch (error) {
    logger.error('settings', 'Failed to get port mappings', { error: String(error) });
    res.status(500).json({ error: 'Failed to get port mappings' });
  }
});

// Save port mappings
router.put('/network-port-mappings', (req, res) => {
  try {
    const db = getDatabase();
    const mappings = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(mappings)) {
      return res.status(400).json({ error: 'Port mappings must be an array' });
    }

    const mappingsJson = JSON.stringify(mappings);
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'network-port-mappings'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-port-mappings'`, [mappingsJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-port-mappings', ?, ?)`, [mappingsJson, now]);
    }

    saveDatabase();
    logger.debug('settings', 'Port mappings updated', { count: mappings.length });
    res.json(mappings);
  } catch (error) {
    logger.error('settings', 'Failed to save port mappings', { error: String(error) });
    res.status(500).json({ error: 'Failed to save port mappings' });
  }
});

// Get NIC mappings
router.get('/network-nic-mappings', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'network-nic-mappings'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const mappings = JSON.parse(results[0].values[0][0] as string);
      res.json(mappings);
    } else {
      res.json([]);
    }
  } catch (error) {
    logger.error('settings', 'Failed to get NIC mappings', { error: String(error) });
    res.status(500).json({ error: 'Failed to get NIC mappings' });
  }
});

// Save NIC mappings
router.put('/network-nic-mappings', (req, res) => {
  try {
    const db = getDatabase();
    const mappings = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(mappings)) {
      return res.status(400).json({ error: 'NIC mappings must be an array' });
    }

    const mappingsJson = JSON.stringify(mappings);
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'network-nic-mappings'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-nic-mappings'`, [mappingsJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-nic-mappings', ?, ?)`, [mappingsJson, now]);
    }

    saveDatabase();
    logger.debug('settings', 'NIC mappings updated', { count: mappings.length });
    res.json(mappings);
  } catch (error) {
    logger.error('settings', 'Failed to save NIC mappings', { error: String(error) });
    res.status(500).json({ error: 'Failed to save NIC mappings' });
  }
});

// Get device connections (stored by device ID, not widget ID)
router.get('/network-device-connections', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'network-device-connections'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const connections = JSON.parse(results[0].values[0][0] as string);
      res.json(connections);
    } else {
      res.json([]);
    }
  } catch (error) {
    logger.error('settings', 'Failed to get device connections', { error: String(error) });
    res.status(500).json({ error: 'Failed to get device connections' });
  }
});

// Save device connections
router.put('/network-device-connections', (req, res) => {
  try {
    const db = getDatabase();
    const connections = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(connections)) {
      return res.status(400).json({ error: 'Device connections must be an array' });
    }

    const connectionsJson = JSON.stringify(connections);
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'network-device-connections'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-device-connections'`, [connectionsJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-device-connections', ?, ?)`, [connectionsJson, now]);
    }

    saveDatabase();
    logger.debug('settings', 'Device connections updated', { count: connections.length });
    res.json(connections);
  } catch (error) {
    logger.error('settings', 'Failed to save device connections', { error: String(error) });
    res.status(500).json({ error: 'Failed to save device connections' });
  }
});

// Get manual switches
router.get('/manual-switches', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`SELECT value FROM settings WHERE key = 'manual-switches'`);

    if (results.length > 0 && results[0].values.length > 0) {
      const switches = JSON.parse(results[0].values[0][0] as string);
      res.json(switches);
    } else {
      res.json([]);
    }
  } catch (error) {
    logger.error('settings', 'Failed to get manual switches', { error: String(error) });
    res.status(500).json({ error: 'Failed to get manual switches' });
  }
});

// Save manual switches
router.put('/manual-switches', (req, res) => {
  try {
    const db = getDatabase();
    const switches = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(switches)) {
      return res.status(400).json({ error: 'Manual switches must be an array' });
    }

    const switchesJson = JSON.stringify(switches);
    const existing = db.exec(`SELECT key FROM settings WHERE key = 'manual-switches'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'manual-switches'`, [switchesJson, now]);
    } else {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('manual-switches', ?, ?)`, [switchesJson, now]);
    }

    saveDatabase();
    logger.debug('settings', 'Manual switches updated', { count: switches.length });
    res.json(switches);
  } catch (error) {
    logger.error('settings', 'Failed to save manual switches', { error: String(error) });
    res.status(500).json({ error: 'Failed to save manual switches' });
  }
});

// Factory reset - delete all data
router.post('/reset', (req, res) => {
  try {
    const { confirmation } = req.body;

    if (confirmation !== 'RESET EVERYTHING') {
      return res.status(400).json({ error: 'Invalid confirmation text' });
    }

    const db = getDatabase();

    // Delete all data from all tables (order matters for foreign keys)
    db.run(`DELETE FROM group_members`);
    db.run(`DELETE FROM group_layouts`);
    db.run(`DELETE FROM widget_groups`);
    db.run(`DELETE FROM dashboard_layouts`);
    db.run(`DELETE FROM widgets`);
    db.run(`DELETE FROM dashboards`);
    db.run(`DELETE FROM integrations`);
    db.run(`DELETE FROM settings`);
    db.run(`DELETE FROM logs`);

    // Delete library images from filesystem
    const imageRows = db.exec(`SELECT filename FROM library_images`);
    if (imageRows.length > 0 && imageRows[0].values.length > 0) {
      imageRows[0].values.forEach((row: SqlValue[]) => {
        const filename = row[0] as string;
        const filepath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      });
    }

    db.run(`DELETE FROM library_images`);
    db.run(`DELETE FROM image_libraries`);

    // Create default dashboard
    const defaultId = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO dashboards (id, name, description, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [defaultId, 'Main Dashboard', 'Default dashboard', 1, now, now]
    );

    saveDatabase();

    logger.info('settings', 'Factory reset completed');

    res.json({ success: true, message: 'All data has been reset' });
  } catch (error) {
    logger.error('settings', 'Factory reset failed', { error: String(error) });
    res.status(500).json({ error: 'Factory reset failed' });
  }
});

export default router;
