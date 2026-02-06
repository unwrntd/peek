import { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

export function initializeSchema(db: Database): void {
  db.run(`
    -- Integration configurations (Proxmox, UniFi, etc.)
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    -- Dashboards (multiple dashboards support)
    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      kiosk_slug TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    -- Widget instances on dashboard
    CREATE TABLE IF NOT EXISTS widgets (
      id TEXT PRIMARY KEY,
      integration_id TEXT,
      widget_type TEXT NOT NULL,
      title TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    -- Dashboard layout (grid positions) - now with dashboard_id
    CREATE TABLE IF NOT EXISTS dashboard_layouts (
      dashboard_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      w INTEGER NOT NULL,
      h INTEGER NOT NULL,
      PRIMARY KEY (dashboard_id, widget_id),
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    -- Widget groups (container widgets) - now with dashboard_id
    CREATE TABLE IF NOT EXISTS widget_groups (
      id TEXT PRIMARY KEY,
      dashboard_id TEXT NOT NULL,
      title TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    -- Group layouts on dashboard - now with dashboard_id
    CREATE TABLE IF NOT EXISTS group_layouts (
      dashboard_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      w INTEGER NOT NULL,
      h INTEGER NOT NULL,
      PRIMARY KEY (dashboard_id, group_id),
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES widget_groups(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    -- Widget membership in groups with position within group - now with dashboard_id
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      dashboard_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      x INTEGER NOT NULL DEFAULT 0,
      y INTEGER NOT NULL DEFAULT 0,
      w INTEGER NOT NULL DEFAULT 6,
      h INTEGER NOT NULL DEFAULT 4,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES widget_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE,
      UNIQUE(dashboard_id, widget_id)
    )
  `);

  db.run(`
    -- Debug/error logs
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    -- App settings (branding, etc.)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    -- Image libraries for organizing uploaded images
    CREATE TABLE IF NOT EXISTS image_libraries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    -- Images stored in libraries
    CREATE TABLE IF NOT EXISTS library_images (
      id TEXT PRIMARY KEY,
      library_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      url TEXT NOT NULL,
      alt_text TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (library_id) REFERENCES image_libraries(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for query optimization
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_widgets_integration ON widgets(integration_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_widgets_type ON widgets(widget_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_members_widget ON group_members(widget_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_dashboards_default ON dashboards(is_default)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboards_kiosk_slug ON dashboards(kiosk_slug) WHERE kiosk_slug != ''`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_dashboard ON dashboard_layouts(dashboard_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_widget ON dashboard_layouts(widget_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_widget_groups_dashboard ON widget_groups(dashboard_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_layouts_dashboard ON group_layouts(dashboard_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_layouts_group ON group_layouts(group_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_members_dashboard ON group_members(dashboard_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_library_images_library ON library_images(library_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_image_libraries_name ON image_libraries(name)`);

  // Composite indexes for common multi-column queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_dashboard_widget ON dashboard_layouts(dashboard_id, widget_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_members_group_widget ON group_members(group_id, widget_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_members_dashboard_widget ON group_members(dashboard_id, widget_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_widgets_integration_type ON widgets(integration_id, widget_type)`);

  // Additional composite indexes for performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_library_images_library_created ON library_images(library_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_integrations_type_enabled ON integrations(type, enabled)`);

}

// Migration function to handle existing databases without multi-dashboard support
export function migrateToMultiDashboard(db: Database): void {
  // Check if dashboard_layouts table exists (it's an existing database with old schema)
  const layoutsTableExists = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_layouts'`);

  if (layoutsTableExists.length === 0 || layoutsTableExists[0].values.length === 0) {
    // No dashboard_layouts table = fresh new database, will be created with new schema
    // Just need to create the dashboards table and default dashboard
    const dashboardsExist = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='dashboards'`);
    if (dashboardsExist.length === 0 || dashboardsExist[0].values.length === 0) {
      // Truly new database, nothing to do yet - schema will create tables
      return;
    }
    // Dashboards table exists but is empty - create default dashboard
    const defaultDashboard = db.exec(`SELECT id FROM dashboards WHERE is_default = 1 LIMIT 1`);
    if (defaultDashboard.length === 0 || defaultDashboard[0].values.length === 0) {
      const defaultId = uuidv4();
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO dashboards (id, name, description, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [defaultId, 'Main Dashboard', 'Default dashboard', 1, now, now]
      );
    }
    return;
  }

  // Check if dashboard_layouts has dashboard_id column
  const layoutColumns = db.exec(`PRAGMA table_info(dashboard_layouts)`);
  const hasDashboardId = layoutColumns.length > 0 &&
    layoutColumns[0].values.some((row) => row[1] === 'dashboard_id');

  if (hasDashboardId) {
    // New schema already in place, just need to ensure default dashboard exists
    const dashboardsExist = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='dashboards'`);
    if (dashboardsExist.length === 0 || dashboardsExist[0].values.length === 0) {
      return; // Will be created by schema
    }
    const defaultDashboard = db.exec(`SELECT id FROM dashboards WHERE is_default = 1 LIMIT 1`);
    if (defaultDashboard.length === 0 || defaultDashboard[0].values.length === 0) {
      // Create default dashboard
      const defaultId = uuidv4();
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO dashboards (id, name, description, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [defaultId, 'Main Dashboard', 'Default dashboard', 1, now, now]
      );
    }
    return;
  }

  // Old schema detected - need to migrate
  console.log('Migrating database to multi-dashboard support...');

  // First, create the dashboards table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default dashboard
  const defaultId = uuidv4();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO dashboards (id, name, description, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [defaultId, 'Main Dashboard', 'Default dashboard', 1, now, now]
  );

  // Migrate dashboard_layouts (old schema has widget_id as PRIMARY KEY)
  db.run(`
    CREATE TABLE IF NOT EXISTS dashboard_layouts_new (
      dashboard_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      w INTEGER NOT NULL,
      h INTEGER NOT NULL,
      PRIMARY KEY (dashboard_id, widget_id),
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    INSERT INTO dashboard_layouts_new (dashboard_id, widget_id, x, y, w, h)
    SELECT ?, widget_id, x, y, w, h FROM dashboard_layouts
  `, [defaultId]);

  db.run(`DROP TABLE dashboard_layouts`);
  db.run(`ALTER TABLE dashboard_layouts_new RENAME TO dashboard_layouts`);

  // Migrate widget_groups - add dashboard_id column
  db.run(`
    CREATE TABLE IF NOT EXISTS widget_groups_new (
      id TEXT PRIMARY KEY,
      dashboard_id TEXT NOT NULL,
      title TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    INSERT INTO widget_groups_new (id, dashboard_id, title, config, created_at, updated_at)
    SELECT id, ?, title, config, created_at, updated_at FROM widget_groups
  `, [defaultId]);

  db.run(`DROP TABLE widget_groups`);
  db.run(`ALTER TABLE widget_groups_new RENAME TO widget_groups`);

  // Migrate group_layouts (old schema has group_id as PRIMARY KEY)
  db.run(`
    CREATE TABLE IF NOT EXISTS group_layouts_new (
      dashboard_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      w INTEGER NOT NULL,
      h INTEGER NOT NULL,
      PRIMARY KEY (dashboard_id, group_id),
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES widget_groups(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    INSERT INTO group_layouts_new (dashboard_id, group_id, x, y, w, h)
    SELECT ?, group_id, x, y, w, h FROM group_layouts
  `, [defaultId]);

  db.run(`DROP TABLE group_layouts`);
  db.run(`ALTER TABLE group_layouts_new RENAME TO group_layouts`);

  // Migrate group_members - add dashboard_id column
  db.run(`
    CREATE TABLE IF NOT EXISTS group_members_new (
      id TEXT PRIMARY KEY,
      dashboard_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      x INTEGER NOT NULL DEFAULT 0,
      y INTEGER NOT NULL DEFAULT 0,
      w INTEGER NOT NULL DEFAULT 6,
      h INTEGER NOT NULL DEFAULT 4,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES widget_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE,
      UNIQUE(dashboard_id, widget_id)
    )
  `);

  db.run(`
    INSERT INTO group_members_new (id, dashboard_id, group_id, widget_id, x, y, w, h)
    SELECT id, ?, group_id, widget_id, x, y, w, h FROM group_members
  `, [defaultId]);

  db.run(`DROP TABLE group_members`);
  db.run(`ALTER TABLE group_members_new RENAME TO group_members`);

  // Recreate indexes for migrated tables
  db.run(`CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_dashboard ON dashboard_layouts(dashboard_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_widget_groups_dashboard ON widget_groups(dashboard_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_layouts_dashboard ON group_layouts(dashboard_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_members_dashboard ON group_members(dashboard_id)`);

  console.log('Migration to multi-dashboard support complete.');
}

// Migration function to add kiosk_slug column to dashboards table
export function migrateAddKioskSlug(db: Database): void {
  // Check if dashboards table exists
  const tableExists = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='dashboards'`);
  if (tableExists.length === 0 || tableExists[0].values.length === 0) {
    return; // No dashboards table yet
  }

  // Check if kiosk_slug column already exists
  const tableInfo = db.exec(`PRAGMA table_info(dashboards)`);
  if (tableInfo.length === 0 || tableInfo[0].values.length === 0) {
    return;
  }

  const hasKioskSlug = tableInfo[0].values.some(row => row[1] === 'kiosk_slug');
  if (hasKioskSlug) {
    return; // Column already exists
  }

  console.log('Adding kiosk_slug column to dashboards table...');
  db.run(`ALTER TABLE dashboards ADD COLUMN kiosk_slug TEXT DEFAULT ''`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboards_kiosk_slug ON dashboards(kiosk_slug) WHERE kiosk_slug != ''`);
  console.log('Migration complete: kiosk_slug column added.');
}

// Migration function to make integration_id nullable in widgets table
export function migrateWidgetsNullableIntegration(db: Database): void {
  // Check if widgets table exists and has NOT NULL constraint on integration_id
  const tableInfo = db.exec(`PRAGMA table_info(widgets)`);
  if (tableInfo.length === 0 || tableInfo[0].values.length === 0) {
    return; // No widgets table
  }

  // Find the integration_id column and check if it's NOT NULL
  const integrationIdCol = tableInfo[0].values.find(row => row[1] === 'integration_id');
  if (!integrationIdCol) {
    return; // No integration_id column
  }

  // Check if notnull flag is set (column index 3 is notnull)
  const isNotNull = integrationIdCol[3] === 1;
  if (!isNotNull) {
    return; // Already nullable
  }

  console.log('Migrating widgets table to allow nullable integration_id...');

  // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
  db.run(`
    CREATE TABLE IF NOT EXISTS widgets_new (
      id TEXT PRIMARY KEY,
      integration_id TEXT,
      widget_type TEXT NOT NULL,
      title TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    INSERT INTO widgets_new (id, integration_id, widget_type, title, config)
    SELECT id, integration_id, widget_type, title, config FROM widgets
  `);

  db.run(`DROP TABLE widgets`);
  db.run(`ALTER TABLE widgets_new RENAME TO widgets`);

  // Recreate the index
  db.run(`CREATE INDEX IF NOT EXISTS idx_widgets_integration ON widgets(integration_id)`);

  console.log('Migration to nullable integration_id complete.');
}

