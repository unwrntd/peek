import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { Readable } from 'stream';

/**
 * Calculate SHA256 checksum of a buffer
 */
export function calculateChecksum(buffer: Buffer): string {
  return 'sha256:' + crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronous file exists check
 */
export function fileExistsSync(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Extract a ZIP buffer to a destination directory
 */
export async function extractZip(buffer: Buffer, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    readable
      .pipe(unzipper.Extract({ path: destDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}

/**
 * Validate checksums for extracted package files
 */
export async function validateChecksums(
  dir: string,
  checksums: Record<string, string>
): Promise<string[]> {
  const errors: string[] = [];

  for (const [filePath, expectedChecksum] of Object.entries(checksums)) {
    const fullPath = path.join(dir, filePath);
    if (await fileExists(fullPath)) {
      const buffer = await fs.promises.readFile(fullPath);
      const actualChecksum = calculateChecksum(buffer);
      if (actualChecksum !== expectedChecksum) {
        errors.push(`Checksum mismatch for ${filePath}`);
      }
    } else {
      errors.push(`Missing file: ${filePath}`);
    }
  }

  return errors;
}

/**
 * Generate warnings for import based on config content
 */
export function generateImportWarnings(
  config: Record<string, unknown>,
  manifest: { appVersion?: string }
): string[] {
  const warnings: string[] = [];
  const currentVersion = process.env.APP_VERSION || '1.0.0';

  // Check for redacted credentials
  const integrations = config.integrations as Array<{
    name: string;
    config: Record<string, unknown>;
  }> | undefined;

  if (integrations) {
    for (const integration of integrations) {
      const configObj = typeof integration.config === 'string'
        ? JSON.parse(integration.config)
        : integration.config;

      if (configObj) {
        for (const [key, value] of Object.entries(configObj)) {
          if (value === '***REDACTED***') {
            warnings.push(
              `Integration "${integration.name}" has redacted ${key} - you'll need to re-enter this`
            );
          }
        }
      }
    }
  }

  // Check version compatibility
  if (manifest.appVersion && manifest.appVersion !== currentVersion) {
    warnings.push(
      `Package was created with app version ${manifest.appVersion}, current version is ${currentVersion}`
    );
  }

  return warnings;
}

/**
 * Recursively get all files in a directory
 */
export async function getFilesRecursively(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getFilesRecursively(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * Remove a directory and all its contents
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.promises.rm(dirPath, { recursive: true, force: true });
}

/**
 * Copy a file from source to destination
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await fs.promises.copyFile(src, dest);
}

/**
 * Read a file as a buffer
 */
export async function readFileBuffer(filePath: string): Promise<Buffer> {
  return fs.promises.readFile(filePath);
}

/**
 * Read a file as JSON
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}
