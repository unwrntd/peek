import { Router, Request } from 'express';
import { SqlValue } from 'sql.js';
import multer, { FileFilterCallback } from 'multer';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../database/db';
import { logger } from '../services/logger';
import {
  calculateChecksum,
  fileExists,
  extractZip,
  validateChecksums,
  generateImportWarnings,
  ensureDir,
  removeDir,
  readJsonFile,
  copyFile,
  readFileBuffer,
} from '../utils/package-helpers';
import {
  encryptCredentials,
  decryptCredentials,
  isValidEncryptedPayload,
  SENSITIVE_FIELDS,
  CredentialsData,
  EncryptedPayload,
} from '../utils/crypto-helpers';

const router = Router();

// Directories
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const TEMP_DIR = path.join(DATA_DIR, 'temp');

// Configure multer for ZIP file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for packages
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only ZIP files are allowed.'));
    }
  },
});

// Types
interface PackageManifest {
  version: string;
  appVersion: string;
  created_at: string;
  created_by: string;
  contents: {
    config: boolean;
    assets: {
      logo: string | null;
      favicon: string | null;
    };
    imageLibraries: Array<{
      id: string;
      name: string;
      imageCount: number;
      path: string;
    }>;
  };
  checksums: Record<string, string>;
  totalFiles: number;
}

interface ExportConfig {
  version: string;
  exported_at: string;
  dashboards: Record<string, unknown>[];
  integrations: Record<string, unknown>[];
  branding: Record<string, string | boolean>;
  templates?: {
    switch?: unknown[];
    device?: unknown[];
    switchEditorSettings?: unknown;
    deviceEditorSettings?: unknown;
  };
  network?: {
    devices?: unknown[];
    connections?: unknown[];
    deviceConnections?: unknown[];
    portMappings?: unknown[];
    nicMappings?: unknown[];
  };
  media: {
    libraries: Record<string, unknown>[];
  };
}

// Helper to get branding settings
function getBrandingSettings(): Record<string, string | boolean> {
  const db = getDatabase();
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

  return branding;
}

// Helper to generate export config (reuses logic from settings.ts)
function generateExportConfig(): ExportConfig {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Export dashboards with widgets, layouts, and groups
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

      // Get widgets with layouts
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

  // Export integrations (sanitize passwords)
  const integrationRows = db.exec(`SELECT * FROM integrations ORDER BY name`);
  const integrations: Record<string, unknown>[] = [];
  if (integrationRows.length > 0 && integrationRows[0].values.length > 0) {
    const columns = integrationRows[0].columns;
    for (const row of integrationRows[0].values) {
      const integration: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        integration[col] = row[i];
      });

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

  // Export branding
  const branding = getBrandingSettings();

  // Export switch templates
  const switchTemplateRows = db.exec(`SELECT value FROM settings WHERE key = 'switch-templates'`);
  let switchTemplates: unknown[] = [];
  if (switchTemplateRows.length > 0 && switchTemplateRows[0].values.length > 0) {
    try {
      switchTemplates = JSON.parse(switchTemplateRows[0].values[0][0] as string);
    } catch {
      switchTemplates = [];
    }
  }

  // Export device templates
  const deviceTemplateRows = db.exec(`SELECT value FROM settings WHERE key = 'device-templates'`);
  let deviceTemplates: unknown[] = [];
  if (deviceTemplateRows.length > 0 && deviceTemplateRows[0].values.length > 0) {
    try {
      deviceTemplates = JSON.parse(deviceTemplateRows[0].values[0][0] as string);
    } catch {
      deviceTemplates = [];
    }
  }

  // Export template editor settings
  const switchEditorRows = db.exec(`SELECT value FROM settings WHERE key = 'template-editor-settings'`);
  let switchEditorSettings: unknown = null;
  if (switchEditorRows.length > 0 && switchEditorRows[0].values.length > 0) {
    try {
      switchEditorSettings = JSON.parse(switchEditorRows[0].values[0][0] as string);
    } catch {
      switchEditorSettings = null;
    }
  }

  const deviceEditorRows = db.exec(`SELECT value FROM settings WHERE key = 'device-template-editor-settings'`);
  let deviceEditorSettings: unknown = null;
  if (deviceEditorRows.length > 0 && deviceEditorRows[0].values.length > 0) {
    try {
      deviceEditorSettings = JSON.parse(deviceEditorRows[0].values[0][0] as string);
    } catch {
      deviceEditorSettings = null;
    }
  }

  // Export network configuration (devices, connections, mappings)
  const networkDevicesRows = db.exec(`SELECT value FROM settings WHERE key = 'network-devices'`);
  let networkDevices: unknown[] = [];
  if (networkDevicesRows.length > 0 && networkDevicesRows[0].values.length > 0) {
    try {
      networkDevices = JSON.parse(networkDevicesRows[0].values[0][0] as string);
    } catch {
      networkDevices = [];
    }
  }

  const networkConnectionsRows = db.exec(`SELECT value FROM settings WHERE key = 'network-connections'`);
  let networkConnections: unknown[] = [];
  if (networkConnectionsRows.length > 0 && networkConnectionsRows[0].values.length > 0) {
    try {
      networkConnections = JSON.parse(networkConnectionsRows[0].values[0][0] as string);
    } catch {
      networkConnections = [];
    }
  }

  const portMappingsRows = db.exec(`SELECT value FROM settings WHERE key = 'network-port-mappings'`);
  let portMappings: unknown[] = [];
  if (portMappingsRows.length > 0 && portMappingsRows[0].values.length > 0) {
    try {
      portMappings = JSON.parse(portMappingsRows[0].values[0][0] as string);
    } catch {
      portMappings = [];
    }
  }

  const nicMappingsRows = db.exec(`SELECT value FROM settings WHERE key = 'network-nic-mappings'`);
  let nicMappings: unknown[] = [];
  if (nicMappingsRows.length > 0 && nicMappingsRows[0].values.length > 0) {
    try {
      nicMappings = JSON.parse(nicMappingsRows[0].values[0][0] as string);
    } catch {
      nicMappings = [];
    }
  }

  const deviceConnectionsRows = db.exec(`SELECT value FROM settings WHERE key = 'network-device-connections'`);
  let deviceConnections: unknown[] = [];
  if (deviceConnectionsRows.length > 0 && deviceConnectionsRows[0].values.length > 0) {
    try {
      deviceConnections = JSON.parse(deviceConnectionsRows[0].values[0][0] as string);
    } catch {
      deviceConnections = [];
    }
  }

  // Export image libraries with metadata
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

  return {
    version: '1.0',
    exported_at: now,
    dashboards,
    integrations,
    branding,
    templates: {
      switch: switchTemplates,
      device: deviceTemplates,
      switchEditorSettings,
      deviceEditorSettings,
    },
    network: {
      devices: networkDevices,
      connections: networkConnections,
      deviceConnections,
      portMappings,
      nicMappings,
    },
    media: {
      libraries,
    },
  };
}

// ==================== EXPORT ENDPOINT ====================

router.get('/export', async (req, res) => {
  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const checksums: Record<string, string> = {};

    // Set response headers
    const filename = `peek-package-${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    archive.on('error', (err) => {
      logger.error('package', 'Archive error', { error: String(err) });
      throw err;
    });

    archive.pipe(res);

    // 1. Generate and add config.json
    const config = generateExportConfig();
    const configBuffer = Buffer.from(JSON.stringify(config, null, 2));
    checksums['config.json'] = calculateChecksum(configBuffer);
    archive.append(configBuffer, { name: 'config.json' });

    // 2. Add branding assets
    const branding = getBrandingSettings();
    let logoPath: string | null = null;
    let faviconPath: string | null = null;

    if (branding.logoUrl && typeof branding.logoUrl === 'string' && branding.logoUrl.startsWith('/uploads/')) {
      const logoFilename = path.basename(branding.logoUrl);
      const logoFullPath = path.join(UPLOADS_DIR, logoFilename);
      if (await fileExists(logoFullPath)) {
        const buffer = await readFileBuffer(logoFullPath);
        const ext = path.extname(logoFullPath);
        logoPath = `assets/logo${ext}`;
        checksums[logoPath] = calculateChecksum(buffer);
        archive.file(logoFullPath, { name: logoPath });
      }
    }

    if (branding.faviconUrl && typeof branding.faviconUrl === 'string' && branding.faviconUrl.startsWith('/uploads/')) {
      const faviconFilename = path.basename(branding.faviconUrl);
      const faviconFullPath = path.join(UPLOADS_DIR, faviconFilename);
      if (await fileExists(faviconFullPath)) {
        const buffer = await readFileBuffer(faviconFullPath);
        const ext = path.extname(faviconFullPath);
        faviconPath = `assets/favicon${ext}`;
        checksums[faviconPath] = calculateChecksum(buffer);
        archive.file(faviconFullPath, { name: faviconPath });
      }
    }

    // 3. Add library images
    const db = getDatabase();
    const libraries = db.exec('SELECT * FROM image_libraries');
    const imageLibraryInfo: Array<{
      id: string;
      name: string;
      imageCount: number;
      path: string;
    }> = [];

    if (libraries.length > 0 && libraries[0].values.length > 0) {
      const columns = libraries[0].columns;

      for (const row of libraries[0].values) {
        const library: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          library[col] = row[i];
        });

        const libraryId = library.id as string;
        const libraryName = library.name as string;

        const images = db.exec(
          'SELECT * FROM library_images WHERE library_id = ?',
          [libraryId]
        );

        const libraryPath = `images/library-${libraryId}/`;
        let imageCount = 0;

        if (images.length > 0 && images[0].values.length > 0) {
          const imgColumns = images[0].columns;

          for (const imgRow of images[0].values) {
            const image: Record<string, unknown> = {};
            imgColumns.forEach((col, i) => {
              image[col] = imgRow[i];
            });

            const imageFilename = image.filename as string;
            const imagePath = path.join(UPLOADS_DIR, imageFilename);

            if (await fileExists(imagePath)) {
              const buffer = await readFileBuffer(imagePath);
              const archivePath = `${libraryPath}${imageFilename}`;
              checksums[archivePath] = calculateChecksum(buffer);
              archive.file(imagePath, { name: archivePath });
              imageCount++;
            }
          }
        }

        if (imageCount > 0 || libraries[0].values.length === 1) {
          imageLibraryInfo.push({
            id: libraryId,
            name: libraryName,
            imageCount,
            path: libraryPath,
          });
        }
      }
    }

    // 4. Generate and add manifest.json
    const manifest: PackageManifest = {
      version: '1.0',
      appVersion: process.env.APP_VERSION || '1.0.0',
      created_at: new Date().toISOString(),
      created_by: 'peek-export',
      contents: {
        config: true,
        assets: {
          logo: logoPath,
          favicon: faviconPath,
        },
        imageLibraries: imageLibraryInfo,
      },
      checksums,
      totalFiles: Object.keys(checksums).length + 1, // +1 for manifest itself
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    await archive.finalize();

    logger.info('package', 'Package exported', {
      totalFiles: manifest.totalFiles,
      imageLibraries: imageLibraryInfo.length,
    });
  } catch (error) {
    logger.error('package', 'Package export error', { error: String(error) });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export package' });
    }
  }
});

// Helper to collect all sensitive credentials from integrations
function collectCredentials(db: ReturnType<typeof getDatabase>): CredentialsData {
  const credentials: CredentialsData = { integrations: {} };

  const integrationRows = db.exec(`SELECT id, config FROM integrations`);
  if (integrationRows.length > 0 && integrationRows[0].values.length > 0) {
    for (const row of integrationRows[0].values) {
      const integrationId = row[0] as string;
      const configStr = row[1] as string;
      const config = JSON.parse(configStr || '{}');

      const sensitiveData: Record<string, string> = {};
      let hasSensitive = false;

      for (const field of SENSITIVE_FIELDS) {
        if (config[field] && typeof config[field] === 'string' && config[field].length > 0) {
          sensitiveData[field] = config[field];
          hasSensitive = true;
        }
      }

      if (hasSensitive) {
        credentials.integrations[integrationId] = sensitiveData;
      }
    }
  }

  return credentials;
}

// ==================== EXPORT WITH CREDENTIALS (POST) ====================

router.post('/export', async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    const archive = archiver('zip', { zlib: { level: 9 } });
    const checksums: Record<string, string> = {};

    // Set response headers
    const filename = `peek-package-${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    archive.on('error', (err) => {
      logger.error('package', 'Archive error', { error: String(err) });
      throw err;
    });

    archive.pipe(res);

    // 1. Generate and add config.json
    const config = generateExportConfig();
    const configBuffer = Buffer.from(JSON.stringify(config, null, 2));
    checksums['config.json'] = calculateChecksum(configBuffer);
    archive.append(configBuffer, { name: 'config.json' });

    // 2. If password provided, encrypt and add credentials.enc
    let hasEncryptedCredentials = false;
    if (password && password.length > 0) {
      const db = getDatabase();
      const credentials = collectCredentials(db);

      // Only create credentials.enc if there are actual credentials
      if (Object.keys(credentials.integrations).length > 0) {
        const encryptedPayload = encryptCredentials(credentials, password);
        const credentialsBuffer = Buffer.from(JSON.stringify(encryptedPayload, null, 2));
        checksums['credentials.enc'] = calculateChecksum(credentialsBuffer);
        archive.append(credentialsBuffer, { name: 'credentials.enc' });
        hasEncryptedCredentials = true;

        logger.info('package', 'Encrypted credentials included', {
          integrationCount: Object.keys(credentials.integrations).length,
        });
      }
    }

    // 3. Add branding assets
    const branding = getBrandingSettings();
    let logoPath: string | null = null;
    let faviconPath: string | null = null;

    if (branding.logoUrl && typeof branding.logoUrl === 'string' && branding.logoUrl.startsWith('/uploads/')) {
      const logoFilename = path.basename(branding.logoUrl);
      const logoFullPath = path.join(UPLOADS_DIR, logoFilename);
      if (await fileExists(logoFullPath)) {
        const buffer = await readFileBuffer(logoFullPath);
        const ext = path.extname(logoFullPath);
        logoPath = `assets/logo${ext}`;
        checksums[logoPath] = calculateChecksum(buffer);
        archive.file(logoFullPath, { name: logoPath });
      }
    }

    if (branding.faviconUrl && typeof branding.faviconUrl === 'string' && branding.faviconUrl.startsWith('/uploads/')) {
      const faviconFilename = path.basename(branding.faviconUrl);
      const faviconFullPath = path.join(UPLOADS_DIR, faviconFilename);
      if (await fileExists(faviconFullPath)) {
        const buffer = await readFileBuffer(faviconFullPath);
        const ext = path.extname(faviconFullPath);
        faviconPath = `assets/favicon${ext}`;
        checksums[faviconPath] = calculateChecksum(buffer);
        archive.file(faviconFullPath, { name: faviconPath });
      }
    }

    // 4. Add library images
    const db = getDatabase();
    const libraries = db.exec('SELECT * FROM image_libraries');
    const imageLibraryInfo: Array<{
      id: string;
      name: string;
      imageCount: number;
      path: string;
    }> = [];

    if (libraries.length > 0 && libraries[0].values.length > 0) {
      const columns = libraries[0].columns;

      for (const row of libraries[0].values) {
        const library: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          library[col] = row[i];
        });

        const libraryId = library.id as string;
        const libraryName = library.name as string;

        const images = db.exec(
          'SELECT * FROM library_images WHERE library_id = ?',
          [libraryId]
        );

        const libraryPath = `images/library-${libraryId}/`;
        let imageCount = 0;

        if (images.length > 0 && images[0].values.length > 0) {
          const imgColumns = images[0].columns;

          for (const imgRow of images[0].values) {
            const image: Record<string, unknown> = {};
            imgColumns.forEach((col, i) => {
              image[col] = imgRow[i];
            });

            const imageFilename = image.filename as string;
            const imagePath = path.join(UPLOADS_DIR, imageFilename);

            if (await fileExists(imagePath)) {
              const buffer = await readFileBuffer(imagePath);
              const archivePath = `${libraryPath}${imageFilename}`;
              checksums[archivePath] = calculateChecksum(buffer);
              archive.file(imagePath, { name: archivePath });
              imageCount++;
            }
          }
        }

        if (imageCount > 0 || libraries[0].values.length === 1) {
          imageLibraryInfo.push({
            id: libraryId,
            name: libraryName,
            imageCount,
            path: libraryPath,
          });
        }
      }
    }

    // 5. Generate and add manifest.json
    const manifest: PackageManifest = {
      version: '1.0',
      appVersion: process.env.APP_VERSION || '1.0.0',
      created_at: new Date().toISOString(),
      created_by: 'peek-export',
      contents: {
        config: true,
        assets: {
          logo: logoPath,
          favicon: faviconPath,
        },
        imageLibraries: imageLibraryInfo,
      },
      checksums,
      totalFiles: Object.keys(checksums).length + 1, // +1 for manifest itself
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    await archive.finalize();

    logger.info('package', 'Package exported', {
      totalFiles: manifest.totalFiles,
      imageLibraries: imageLibraryInfo.length,
      hasEncryptedCredentials,
    });
  } catch (error) {
    logger.error('package', 'Package export error', { error: String(error) });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export package' });
    }
  }
});

// ==================== PREVIEW ENDPOINT ====================

router.post('/preview', upload.single('package'), async (req, res) => {
  const tempDir = path.join(TEMP_DIR, `preview-${Date.now()}`);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await ensureDir(tempDir);
    await extractZip(req.file.buffer, tempDir);

    // Read manifest
    const manifestPath = path.join(tempDir, 'manifest.json');
    if (!await fileExists(manifestPath)) {
      throw new Error('Invalid package: missing manifest.json');
    }
    const manifest = await readJsonFile<PackageManifest>(manifestPath);

    // Read config
    const configPath = path.join(tempDir, 'config.json');
    if (!await fileExists(configPath)) {
      throw new Error('Invalid package: missing config.json');
    }
    const config = await readJsonFile<ExportConfig>(configPath);

    // Check for encrypted credentials file
    const credentialsPath = path.join(tempDir, 'credentials.enc');
    const hasEncryptedCredentials = await fileExists(credentialsPath);

    // Cleanup
    await removeDir(tempDir);

    // Generate warnings
    const warnings = generateImportWarnings(config as unknown as Record<string, unknown>, manifest);

    // If encrypted credentials exist, modify the warnings to indicate credentials can be restored
    if (hasEncryptedCredentials) {
      // Remove warnings about redacted credentials since they can be restored
      const filteredWarnings = warnings.filter(w => !w.includes('redacted'));
      warnings.length = 0;
      warnings.push(...filteredWarnings);
    }

    // Calculate totals
    const totalWidgets = config.dashboards?.reduce(
      (sum, d) => sum + ((d.widgets as unknown[])?.length || 0),
      0
    ) || 0;

    const totalImages = manifest.contents.imageLibraries?.reduce(
      (sum, l) => sum + l.imageCount,
      0
    ) || 0;

    res.json({
      manifest: {
        version: manifest.version,
        appVersion: manifest.appVersion,
        created_at: manifest.created_at,
        totalFiles: manifest.totalFiles,
      },
      summary: {
        dashboards: config.dashboards?.length || 0,
        widgets: totalWidgets,
        integrations: config.integrations?.length || 0,
        imageLibraries: manifest.contents.imageLibraries?.length || 0,
        totalImages,
        hasLogo: !!manifest.contents.assets?.logo,
        hasFavicon: !!manifest.contents.assets?.favicon,
        hasBranding: !!config.branding,
        hasEncryptedCredentials,
        switchTemplates: (config.templates?.switch as unknown[])?.length || 0,
        deviceTemplates: (config.templates?.device as unknown[])?.length || 0,
      },
      warnings,
    });

    logger.info('package', 'Package previewed');
  } catch (error) {
    await removeDir(tempDir).catch(() => {});
    logger.error('package', 'Package preview error', { error: String(error) });
    res.status(400).json({ error: 'Invalid package file: ' + String(error) });
  }
});

// ==================== IMPORT ENDPOINT ====================

router.post('/import', upload.single('package'), async (req, res) => {
  const tempDir = path.join(TEMP_DIR, `import-${Date.now()}`);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 1. Extract ZIP to temp directory
    await ensureDir(tempDir);
    await extractZip(req.file.buffer, tempDir);

    // 2. Read and validate manifest
    const manifestPath = path.join(tempDir, 'manifest.json');
    if (!await fileExists(manifestPath)) {
      throw new Error('Invalid package: missing manifest.json');
    }
    const manifest = await readJsonFile<PackageManifest>(manifestPath);

    // 3. Validate checksums (optional but recommended)
    const skipValidation = req.query.skipValidation === 'true';
    if (!skipValidation && manifest.checksums) {
      const validationErrors = await validateChecksums(tempDir, manifest.checksums);
      if (validationErrors.length > 0) {
        await removeDir(tempDir);
        return res.status(400).json({
          error: 'Package validation failed',
          details: validationErrors,
        });
      }
    }

    // 4. Read config
    const configPath = path.join(tempDir, 'config.json');
    const config = await readJsonFile<ExportConfig>(configPath);

    // 4.5 Check for encrypted credentials and decrypt if password provided
    const credentialsPath = path.join(tempDir, 'credentials.enc');
    const hasEncryptedCredentials = await fileExists(credentialsPath);
    let decryptedCredentials: CredentialsData | null = null;
    let credentialDecryptionError: string | null = null;

    // Get password from form data (multipart field)
    const password = req.body?.password as string | undefined;

    if (hasEncryptedCredentials && password) {
      try {
        const encryptedPayload = await readJsonFile<EncryptedPayload>(credentialsPath);
        if (isValidEncryptedPayload(encryptedPayload)) {
          decryptedCredentials = decryptCredentials(encryptedPayload, password);
          logger.info('package', 'Credentials decrypted successfully', {
            integrationCount: Object.keys(decryptedCredentials.integrations).length,
          });
        } else {
          credentialDecryptionError = 'Invalid credentials file format';
        }
      } catch (err) {
        credentialDecryptionError = 'Failed to decrypt credentials - wrong password or corrupted file';
        logger.warn('package', 'Failed to decrypt credentials', { error: String(err) });
      }
    }

    // 5. Import configuration using existing logic
    const db = getDatabase();
    const now = new Date().toISOString();

    // Check for replaceAll mode - clears existing data before import
    const replaceAll = req.query.replaceAll === 'true' || req.body?.replaceAll === 'true';

    const results = {
      integrations: { imported: 0, skipped: 0, errors: [] as string[] },
      dashboards: { imported: 0, skipped: 0, errors: [] as string[] },
      widgets: { imported: 0, errors: [] as string[] },
      groups: { imported: 0, errors: [] as string[] },
      branding: { imported: false },
      assets: { logo: false, favicon: false },
      imageLibraries: { imported: 0, images: 0, errors: [] as string[] },
      credentials: { restored: 0, failed: 0 },
      templates: { switch: 0, device: 0 },
      cleared: { integrations: 0, dashboards: 0, widgets: 0, groups: 0, imageLibraries: 0 },
    };

    // If replaceAll mode, clear existing data first
    if (replaceAll) {
      logger.info('package', 'Replace all mode enabled - clearing existing data');

      // Count existing data before clearing
      const countIntegrations = db.exec('SELECT COUNT(*) FROM integrations');
      const countDashboards = db.exec('SELECT COUNT(*) FROM dashboards');
      const countWidgets = db.exec('SELECT COUNT(*) FROM widgets');
      const countGroups = db.exec('SELECT COUNT(*) FROM widget_groups');
      const countLibraries = db.exec('SELECT COUNT(*) FROM image_libraries');

      results.cleared.integrations = (countIntegrations[0]?.values[0]?.[0] as number) || 0;
      results.cleared.dashboards = (countDashboards[0]?.values[0]?.[0] as number) || 0;
      results.cleared.widgets = (countWidgets[0]?.values[0]?.[0] as number) || 0;
      results.cleared.groups = (countGroups[0]?.values[0]?.[0] as number) || 0;
      results.cleared.imageLibraries = (countLibraries[0]?.values[0]?.[0] as number) || 0;

      // Clear in order to respect foreign key constraints
      db.run('DELETE FROM group_members');
      db.run('DELETE FROM group_layouts');
      db.run('DELETE FROM widget_groups');
      db.run('DELETE FROM dashboard_layouts');
      db.run('DELETE FROM widgets');
      db.run('DELETE FROM dashboards');
      db.run('DELETE FROM integrations');
      db.run('DELETE FROM library_images');
      db.run('DELETE FROM image_libraries');

      logger.info('package', 'Existing data cleared', results.cleared);
    }

    // Map old integration IDs to new ones
    const integrationIdMap = new Map<string, string>();

    // Import integrations
    if (Array.isArray(config.integrations)) {
      for (const integration of config.integrations) {
        try {
          const oldIntegrationId = integration.id as string;
          const existing = db.exec(
            `SELECT id FROM integrations WHERE name = ? AND type = ?`,
            [integration.name as string, integration.type as string]
          );

          if (existing.length > 0 && existing[0].values.length > 0) {
            integrationIdMap.set(oldIntegrationId, existing[0].values[0][0] as string);
            results.integrations.skipped++;
          } else {
            const newId = uuidv4();
            integrationIdMap.set(oldIntegrationId, newId);

            const integrationConfig = integration.config as Record<string, unknown> || {};

            // Restore credentials from decrypted data if available
            const savedCreds = decryptedCredentials?.integrations[oldIntegrationId];
            if (savedCreds) {
              // Restore each sensitive field
              for (const field of SENSITIVE_FIELDS) {
                if (savedCreds[field]) {
                  integrationConfig[field] = savedCreds[field];
                  results.credentials.restored++;
                }
              }
            } else {
              // Clear redacted values if no decrypted credentials available
              if (integrationConfig.password === '***REDACTED***') integrationConfig.password = '';
              if (integrationConfig.tokenSecret === '***REDACTED***') integrationConfig.tokenSecret = '';
              if (integrationConfig.token === '***REDACTED***') integrationConfig.token = '';
              if (integrationConfig.apiKey === '***REDACTED***') integrationConfig.apiKey = '';
            }

            db.run(
              `INSERT INTO integrations (id, type, name, config, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                newId,
                integration.type as string,
                integration.name as string,
                JSON.stringify(integrationConfig),
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

    // Import dashboards with widgets and groups
    if (Array.isArray(config.dashboards)) {
      for (const dashboard of config.dashboards) {
        try {
          const existing = db.exec(
            `SELECT id FROM dashboards WHERE name = ?`,
            [dashboard.name as string]
          );

          let dashboardId: string;
          if (existing.length > 0 && existing[0].values.length > 0) {
            dashboardId = existing[0].values[0][0] as string;
            results.dashboards.skipped++;
          } else {
            dashboardId = uuidv4();
            db.run(
              `INSERT INTO dashboards (id, name, description, is_default, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                dashboardId,
                dashboard.name as string,
                (dashboard.description as string) || '',
                dashboard.is_default ? 1 : 0,
                now,
                now,
              ]
            );
            results.dashboards.imported++;
          }

          // Import widgets
          const widgetIdMap = new Map<string, string>();
          const widgets = dashboard.widgets as Record<string, unknown>[];
          if (Array.isArray(widgets)) {
            for (const widget of widgets) {
              try {
                const newWidgetId = uuidv4();
                widgetIdMap.set(widget.id as string, newWidgetId);

                // Use mapped integration ID or null if not found (don't use invalid original ID)
                const mappedIntegrationId = widget.integration_id
                  ? integrationIdMap.get(widget.integration_id as string) || null
                  : null;

                // Update config.integrationId if present (for cross-integration widgets like SwitchPortOverlay)
                const widgetConfig = (widget.config || {}) as Record<string, unknown>;
                if (widgetConfig.integrationId && typeof widgetConfig.integrationId === 'string') {
                  const mappedConfigIntegrationId = integrationIdMap.get(widgetConfig.integrationId);
                  if (mappedConfigIntegrationId) {
                    widgetConfig.integrationId = mappedConfigIntegrationId;
                  }
                }

                db.run(
                  `INSERT INTO widgets (id, integration_id, widget_type, title, config)
                   VALUES (?, ?, ?, ?, ?)`,
                  [
                    newWidgetId,
                    mappedIntegrationId,
                    widget.widget_type as string,
                    widget.title as string,
                    JSON.stringify(widgetConfig),
                  ]
                );

                db.run(
                  `INSERT INTO dashboard_layouts (dashboard_id, widget_id, x, y, w, h)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    dashboardId,
                    newWidgetId,
                    (widget.x as number) || 0,
                    (widget.y as number) || 0,
                    (widget.w as number) || 4,
                    (widget.h as number) || 3,
                  ]
                );

                results.widgets.imported++;
              } catch (err) {
                results.widgets.errors.push(
                  `Failed to import widget "${widget.title}": ${String(err)}`
                );
              }
            }
          }

          // Import groups
          const groups = dashboard.groups as Record<string, unknown>[];
          if (Array.isArray(groups)) {
            for (const group of groups) {
              try {
                const newGroupId = uuidv4();

                db.run(
                  `INSERT INTO widget_groups (id, dashboard_id, title, config, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    newGroupId,
                    dashboardId,
                    group.title as string,
                    JSON.stringify(group.config || {}),
                    now,
                    now,
                  ]
                );

                if (group.x !== undefined && group.y !== undefined) {
                  db.run(
                    `INSERT INTO group_layouts (dashboard_id, group_id, x, y, w, h)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                      dashboardId,
                      newGroupId,
                      (group.x as number) || 0,
                      (group.y as number) || 0,
                      (group.w as number) || 6,
                      (group.h as number) || 4,
                    ]
                  );
                }

                // Import group members
                const members = group.members as Record<string, unknown>[];
                if (Array.isArray(members)) {
                  for (const member of members) {
                    try {
                      let memberWidgetId = widgetIdMap.get(member.widget_id as string);

                      if (!memberWidgetId) {
                        memberWidgetId = uuidv4();

                        // Use mapped integration ID or null if not found (don't use invalid original ID)
                        const mappedIntegrationId = member.integration_id
                          ? integrationIdMap.get(member.integration_id as string) || null
                          : null;

                        // Update config.integrationId if present (for cross-integration widgets like SwitchPortOverlay)
                        const memberConfig = (member.widget_config || {}) as Record<string, unknown>;
                        if (memberConfig.integrationId && typeof memberConfig.integrationId === 'string') {
                          const mappedConfigIntegrationId = integrationIdMap.get(memberConfig.integrationId);
                          if (mappedConfigIntegrationId) {
                            memberConfig.integrationId = mappedConfigIntegrationId;
                          }
                        }

                        db.run(
                          `INSERT INTO widgets (id, integration_id, widget_type, title, config)
                           VALUES (?, ?, ?, ?, ?)`,
                          [
                            memberWidgetId,
                            mappedIntegrationId,
                            member.widget_type as string,
                            member.widget_title as string,
                            JSON.stringify(memberConfig),
                          ]
                        );
                        results.widgets.imported++;
                      }
                      // Note: Don't delete dashboard_layouts when widget exists in both
                      // standalone position AND in a group - it can exist in both places

                      db.run(
                        `INSERT INTO group_members (id, dashboard_id, group_id, widget_id, x, y, w, h)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          uuidv4(),
                          dashboardId,
                          newGroupId,
                          memberWidgetId,
                          (member.x as number) || 0,
                          (member.y as number) || 0,
                          (member.w as number) || 6,
                          (member.h as number) || 4,
                        ]
                      );
                    } catch {
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

    // Import branding settings
    if (config.branding && typeof config.branding === 'object') {
      const validKeys = ['siteName', 'logoUrl', 'faviconUrl', 'primaryColor', 'accentColor', 'hideNavTitle', 'iconStyle'];

      for (const [key, value] of Object.entries(config.branding)) {
        if (!validKeys.includes(key)) continue;
        // Skip logoUrl and faviconUrl - we'll set them after copying assets
        if (key === 'logoUrl' || key === 'faviconUrl') continue;

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

    // Import switch templates
    if (config.templates?.switch && Array.isArray(config.templates.switch)) {
      try {
        const existingRows = db.exec(`SELECT value FROM settings WHERE key = 'switch-templates'`);
        let existingTemplates: Array<{ id: string }> = [];
        if (existingRows.length > 0 && existingRows[0].values.length > 0) {
          try {
            existingTemplates = JSON.parse(existingRows[0].values[0][0] as string);
          } catch {
            existingTemplates = [];
          }
        }

        // Merge templates by ID to avoid duplicates
        const existingIds = new Set(existingTemplates.map(t => t.id));
        const importedTemplates = config.templates.switch as Array<{ id: string }>;
        const newTemplates = importedTemplates.filter(t => !existingIds.has(t.id));
        const mergedTemplates = [...existingTemplates, ...newTemplates];

        const json = JSON.stringify(mergedTemplates);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'switch-templates'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'switch-templates'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('switch-templates', ?, ?)`, [json, now]);
        }
        results.templates.switch = newTemplates.length;
      } catch (err) {
        logger.warn('package', 'Failed to import switch templates', { error: String(err) });
      }
    }

    // Import device templates
    if (config.templates?.device && Array.isArray(config.templates.device)) {
      try {
        const existingRows = db.exec(`SELECT value FROM settings WHERE key = 'device-templates'`);
        let existingTemplates: Array<{ id: string }> = [];
        if (existingRows.length > 0 && existingRows[0].values.length > 0) {
          try {
            existingTemplates = JSON.parse(existingRows[0].values[0][0] as string);
          } catch {
            existingTemplates = [];
          }
        }

        // Merge templates by ID to avoid duplicates
        const existingIds = new Set(existingTemplates.map(t => t.id));
        const importedTemplates = config.templates.device as Array<{ id: string }>;
        const newTemplates = importedTemplates.filter(t => !existingIds.has(t.id));
        const mergedTemplates = [...existingTemplates, ...newTemplates];

        const json = JSON.stringify(mergedTemplates);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'device-templates'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'device-templates'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('device-templates', ?, ?)`, [json, now]);
        }
        results.templates.device = newTemplates.length;
      } catch (err) {
        logger.warn('package', 'Failed to import device templates', { error: String(err) });
      }
    }

    // Import switch template editor settings (replace, not merge)
    if (config.templates?.switchEditorSettings) {
      try {
        const json = JSON.stringify(config.templates.switchEditorSettings);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'template-editor-settings'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'template-editor-settings'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('template-editor-settings', ?, ?)`, [json, now]);
        }
      } catch (err) {
        logger.warn('package', 'Failed to import switch template editor settings', { error: String(err) });
      }
    }

    // Import device template editor settings (replace, not merge)
    if (config.templates?.deviceEditorSettings) {
      try {
        const json = JSON.stringify(config.templates.deviceEditorSettings);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'device-template-editor-settings'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'device-template-editor-settings'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('device-template-editor-settings', ?, ?)`, [json, now]);
        }
      } catch (err) {
        logger.warn('package', 'Failed to import device template editor settings', { error: String(err) });
      }
    }

    // Import network configuration (devices, connections, mappings)
    if (config.network?.devices && Array.isArray(config.network.devices)) {
      try {
        const json = JSON.stringify(config.network.devices);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'network-devices'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-devices'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-devices', ?, ?)`, [json, now]);
        }
        logger.info('package', `Imported ${config.network.devices.length} network devices`);
      } catch (err) {
        logger.warn('package', 'Failed to import network devices', { error: String(err) });
      }
    }

    if (config.network?.connections && Array.isArray(config.network.connections)) {
      try {
        const json = JSON.stringify(config.network.connections);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'network-connections'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-connections'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-connections', ?, ?)`, [json, now]);
        }
        logger.info('package', `Imported ${config.network.connections.length} network connections`);
      } catch (err) {
        logger.warn('package', 'Failed to import network connections', { error: String(err) });
      }
    }

    if (config.network?.portMappings && Array.isArray(config.network.portMappings)) {
      try {
        const json = JSON.stringify(config.network.portMappings);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'network-port-mappings'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-port-mappings'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-port-mappings', ?, ?)`, [json, now]);
        }
        logger.info('package', `Imported ${config.network.portMappings.length} port mappings`);
      } catch (err) {
        logger.warn('package', 'Failed to import port mappings', { error: String(err) });
      }
    }

    if (config.network?.nicMappings && Array.isArray(config.network.nicMappings)) {
      try {
        const json = JSON.stringify(config.network.nicMappings);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'network-nic-mappings'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-nic-mappings'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-nic-mappings', ?, ?)`, [json, now]);
        }
        logger.info('package', `Imported ${config.network.nicMappings.length} NIC mappings`);
      } catch (err) {
        logger.warn('package', 'Failed to import NIC mappings', { error: String(err) });
      }
    }

    if (config.network?.deviceConnections && Array.isArray(config.network.deviceConnections)) {
      try {
        const json = JSON.stringify(config.network.deviceConnections);
        const exists = db.exec(`SELECT key FROM settings WHERE key = 'network-device-connections'`);
        if (exists.length > 0 && exists[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'network-device-connections'`, [json, now]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('network-device-connections', ?, ?)`, [json, now]);
        }
        logger.info('package', `Imported ${config.network.deviceConnections.length} device connections`);
      } catch (err) {
        logger.warn('package', 'Failed to import device connections', { error: String(err) });
      }
    }

    // 6. Copy branding assets
    if (manifest.contents.assets.logo) {
      const logoSrc = path.join(tempDir, manifest.contents.assets.logo);
      if (await fileExists(logoSrc)) {
        const logoFilename = `logo-${Date.now()}${path.extname(logoSrc)}`;
        const logoDest = path.join(UPLOADS_DIR, logoFilename);
        await ensureDir(UPLOADS_DIR);
        await copyFile(logoSrc, logoDest);

        const dbKey = 'branding.logoUrl';
        const dbValue = `/uploads/${logoFilename}`;
        const existing = db.exec(`SELECT key FROM settings WHERE key = ?`, [dbKey]);
        if (existing.length > 0 && existing[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = ?`, [dbValue, now, dbKey]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`, [dbKey, dbValue, now]);
        }
        results.assets.logo = true;
      }
    }

    if (manifest.contents.assets.favicon) {
      const faviconSrc = path.join(tempDir, manifest.contents.assets.favicon);
      if (await fileExists(faviconSrc)) {
        const faviconFilename = `favicon-${Date.now()}${path.extname(faviconSrc)}`;
        const faviconDest = path.join(UPLOADS_DIR, faviconFilename);
        await ensureDir(UPLOADS_DIR);
        await copyFile(faviconSrc, faviconDest);

        const dbKey = 'branding.faviconUrl';
        const dbValue = `/uploads/${faviconFilename}`;
        const existing = db.exec(`SELECT key FROM settings WHERE key = ?`, [dbKey]);
        if (existing.length > 0 && existing[0].values.length > 0) {
          db.run(`UPDATE settings SET value = ?, updated_at = ? WHERE key = ?`, [dbValue, now, dbKey]);
        } else {
          db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`, [dbKey, dbValue, now]);
        }
        results.assets.favicon = true;
      }
    }

    // 7. Import library images
    const libraryIdMap = new Map<string, string>();
    // Map old image URLs to new image URLs for updating widget configs
    const imageUrlMap = new Map<string, string>();

    for (const libraryInfo of manifest.contents.imageLibraries || []) {
      try {
        const libraryDir = path.join(tempDir, libraryInfo.path);

        // Check if library with same name exists
        const existingLibrary = db.exec(
          'SELECT id FROM image_libraries WHERE name = ?',
          [libraryInfo.name]
        );

        let libraryId: string;
        if (existingLibrary.length > 0 && existingLibrary[0].values.length > 0) {
          libraryId = existingLibrary[0].values[0][0] as string;
        } else {
          libraryId = uuidv4();
          db.run(
            'INSERT INTO image_libraries (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            [libraryId, libraryInfo.name, '', now, now]
          );
          results.imageLibraries.imported++;
        }

        libraryIdMap.set(libraryInfo.id, libraryId);

        // Copy images
        if (await fileExists(libraryDir)) {
          const files = await fs.promises.readdir(libraryDir);

          // Get original image metadata from config
          const originalLibrary = config.media.libraries.find(
            (l) => l.id === libraryInfo.id
          );
          const originalImages = (originalLibrary?.images as Record<string, unknown>[]) || [];

          for (const filename of files) {
            const srcPath = path.join(libraryDir, filename);
            const newFilename = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(filename)}`;
            const destPath = path.join(UPLOADS_DIR, newFilename);

            await copyFile(srcPath, destPath);

            // Get image metadata from original config
            const originalImage = originalImages.find((i) => i.filename === filename);

            const newUrl = `/uploads/${newFilename}`;
            const oldUrl = (originalImage?.url as string) || `/uploads/${filename}`;

            // Track old URL -> new URL mapping for widget config updates
            imageUrlMap.set(oldUrl, newUrl);

            db.run(
              `INSERT INTO library_images
              (id, library_id, filename, original_name, mime_type, size, width, height, url, alt_text, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                libraryId,
                newFilename,
                (originalImage?.original_name as string) || filename,
                (originalImage?.mime_type as string) || 'image/png',
                (originalImage?.size as number) || 0,
                (originalImage?.width as number) || null,
                (originalImage?.height as number) || null,
                newUrl,
                (originalImage?.alt_text as string) || '',
                now,
              ]
            );

            results.imageLibraries.images++;
          }
        }
      } catch (err) {
        results.imageLibraries.errors.push(
          `Failed to import library "${libraryInfo.name}": ${String(err)}`
        );
      }
    }

    // 7.5 Update widget configs to use new image URLs
    if (imageUrlMap.size > 0) {
      logger.info('package', 'Updating widget configs with new image URLs', { mappings: imageUrlMap.size });

      // Get all widgets and update their configs
      const widgetRows = db.exec('SELECT id, config FROM widgets');
      if (widgetRows.length > 0 && widgetRows[0].values.length > 0) {
        for (const row of widgetRows[0].values) {
          const widgetId = row[0] as string;
          const configStr = row[1] as string;

          let configUpdated = false;
          let newConfigStr = configStr;

          // Replace all old image URLs with new ones
          for (const [oldUrl, newUrl] of imageUrlMap) {
            if (newConfigStr.includes(oldUrl)) {
              newConfigStr = newConfigStr.split(oldUrl).join(newUrl);
              configUpdated = true;
            }
          }

          if (configUpdated) {
            db.run('UPDATE widgets SET config = ? WHERE id = ?', [newConfigStr, widgetId]);
            logger.debug('package', `Updated image URLs in widget ${widgetId}`);
          }
        }
      }

      // Also update group configs
      const groupRows = db.exec('SELECT id, config FROM widget_groups');
      if (groupRows.length > 0 && groupRows[0].values.length > 0) {
        for (const row of groupRows[0].values) {
          const groupId = row[0] as string;
          const configStr = row[1] as string;

          let configUpdated = false;
          let newConfigStr = configStr;

          for (const [oldUrl, newUrl] of imageUrlMap) {
            if (newConfigStr.includes(oldUrl)) {
              newConfigStr = newConfigStr.split(oldUrl).join(newUrl);
              configUpdated = true;
            }
          }

          if (configUpdated) {
            db.run('UPDATE widget_groups SET config = ? WHERE id = ?', [newConfigStr, groupId]);
            logger.debug('package', `Updated image URLs in group ${groupId}`);
          }
        }
      }
    }

    saveDatabase();

    // 8. Cleanup temp directory
    await removeDir(tempDir);

    logger.info('package', 'Package imported', results);

    // Build response with credential restoration info
    const response: {
      success: boolean;
      results: typeof results;
      credentialWarning?: string;
    } = {
      success: true,
      results,
    };

    // Add warning if credentials couldn't be decrypted
    if (hasEncryptedCredentials && credentialDecryptionError) {
      response.credentialWarning = credentialDecryptionError;
    } else if (hasEncryptedCredentials && !password) {
      response.credentialWarning = 'Package contains encrypted credentials but no password was provided';
    }

    res.json(response);
  } catch (error) {
    await removeDir(tempDir).catch(() => {});
    logger.error('package', 'Package import error', { error: String(error) });
    res.status(500).json({ error: String(error) });
  }
});

export default router;
