import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { initializeSchema, migrateToMultiDashboard, migrateWidgetsNullableIntegration, migrateAddKioskSlug } from './schema';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'dash.db');

let db: Database | null = null;
let SQL: initSqlJs.SqlJsStatic | null = null;

// Debounced async save state
let saveTimeout: NodeJS.Timeout | null = null;
let saveInProgress = false;
let pendingSave = false;
const SAVE_DEBOUNCE_MS = 100;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  // Load existing database or create new one
  const isExistingDb = fs.existsSync(DB_PATH);
  if (isExistingDb) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    // Run migrations for existing databases
    migrateToMultiDashboard(db);
    migrateWidgetsNullableIntegration(db);
    migrateAddKioskSlug(db);
  } else {
    db = new SQL.Database();
  }

  initializeSchema(db);

  // For new databases, also run migration to create default dashboard
  if (!isExistingDb) {
    migrateToMultiDashboard(db);
  }

  // Use sync save at startup to ensure initial state is persisted
  saveDatabaseSync();

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Queue a database save with debouncing.
 * Multiple rapid calls will be batched into a single write.
 * Uses async file I/O to avoid blocking the event loop.
 */
export function saveDatabase(): void {
  if (!db) return;

  // Clear existing timeout to debounce
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // Schedule the save
  saveTimeout = setTimeout(() => {
    saveDatabaseAsync();
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Perform the actual async database save.
 * Handles concurrent save requests by queuing them.
 */
async function saveDatabaseAsync(): Promise<void> {
  if (!db) return;

  // If a save is already in progress, mark that we need another save after
  if (saveInProgress) {
    pendingSave = true;
    return;
  }

  saveInProgress = true;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    await fs.promises.writeFile(DB_PATH, buffer);
  } catch (error) {
    console.error('Failed to save database:', error);
  } finally {
    saveInProgress = false;

    // If another save was requested while we were saving, do it now
    if (pendingSave) {
      pendingSave = false;
      saveDatabaseAsync();
    }
  }
}

/**
 * Synchronous save for shutdown scenarios.
 * Only use this during process exit when async isn't possible.
 */
export function saveDatabaseSync(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

export function closeDatabase(): void {
  if (db) {
    // Cancel any pending debounced save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    // Use sync save for shutdown to ensure data is written
    saveDatabaseSync();
    db.close();
    db = null;
  }
}
