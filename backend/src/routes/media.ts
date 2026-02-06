import { Router, Request } from 'express';
import { SqlValue } from 'sql.js';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../database/db';
import { logger } from '../services/logger';
import { sanitizeSearchParam } from '../utils/security';

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
    const name = 'media-' + Date.now() + '-' + Math.random().toString(36).substring(7) + ext;
    cb(null, name);
  },
});

// Maximum files per upload batch
const MAX_FILES_PER_UPLOAD = 100;

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: MAX_FILES_PER_UPLOAD,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/svg+xml',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, GIF, SVG, WebP, and ICO are allowed.'));
    }
  },
});

// Types
interface ImageLibrary {
  id: string;
  name: string;
  description: string;
  image_count?: number;
  created_at: string;
  updated_at: string;
}

interface LibraryImage {
  id: string;
  library_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  alt_text: string;
  created_at: string;
}

// ==================== LIBRARY ENDPOINTS ====================

// Get all libraries with image counts
router.get('/libraries', (_req, res) => {
  try {
    const db = getDatabase();
    const results = db.exec(`
      SELECT
        l.id, l.name, l.description, l.created_at, l.updated_at,
        COUNT(i.id) as image_count
      FROM image_libraries l
      LEFT JOIN library_images i ON l.id = i.library_id
      GROUP BY l.id
      ORDER BY l.name ASC
    `);

    const libraries: ImageLibrary[] = [];
    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach((row: SqlValue[]) => {
        libraries.push({
          id: row[0] as string,
          name: row[1] as string,
          description: row[2] as string,
          created_at: row[3] as string,
          updated_at: row[4] as string,
          image_count: row[5] as number,
        });
      });
    }

    res.json(libraries);
  } catch (error) {
    logger.error('media', 'Failed to get libraries', { error: String(error) });
    res.status(500).json({ error: 'Failed to get libraries' });
  }
});

// Create a library
router.post('/libraries', (req, res) => {
  try {
    const { name, description = '' } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Library name is required' });
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO image_libraries (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, name.trim(), description.trim(), now, now]
    );

    saveDatabase();

    const library: ImageLibrary = {
      id,
      name: name.trim(),
      description: description.trim(),
      image_count: 0,
      created_at: now,
      updated_at: now,
    };

    logger.info('media', 'Library created', { id, name });
    res.status(201).json(library);
  } catch (error) {
    logger.error('media', 'Failed to create library', { error: String(error) });
    res.status(500).json({ error: 'Failed to create library' });
  }
});

// Update a library
router.put('/libraries/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const db = getDatabase();

    // Check if library exists
    const existing = db.exec(`SELECT id FROM image_libraries WHERE id = ?`, [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description.trim());
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      db.run(`UPDATE image_libraries SET ${updates.join(', ')} WHERE id = ?`, params);
      saveDatabase();
    }

    // Get updated library with image count
    const results = db.exec(
      `
      SELECT
        l.id, l.name, l.description, l.created_at, l.updated_at,
        COUNT(i.id) as image_count
      FROM image_libraries l
      LEFT JOIN library_images i ON l.id = i.library_id
      WHERE l.id = ?
      GROUP BY l.id
    `,
      [id]
    );

    if (results.length > 0 && results[0].values.length > 0) {
      const row = results[0].values[0];
      const library: ImageLibrary = {
        id: row[0] as string,
        name: row[1] as string,
        description: row[2] as string,
        created_at: row[3] as string,
        updated_at: row[4] as string,
        image_count: row[5] as number,
      };
      logger.info('media', 'Library updated', { id });
      res.json(library);
    } else {
      res.status(404).json({ error: 'Library not found' });
    }
  } catch (error) {
    logger.error('media', 'Failed to update library', { error: String(error) });
    res.status(500).json({ error: 'Failed to update library' });
  }
});

// Delete a library (cascade deletes images)
router.delete('/libraries/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Get all images in the library to delete files
    const images = db.exec(`SELECT filename FROM library_images WHERE library_id = ?`, [id]);
    if (images.length > 0 && images[0].values.length > 0) {
      images[0].values.forEach((row: SqlValue[]) => {
        const filename = row[0] as string;
        const filepath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      });
    }

    // Delete library (cascade will delete images from DB)
    db.run(`DELETE FROM image_libraries WHERE id = ?`, [id]);
    saveDatabase();

    logger.info('media', 'Library deleted', { id });
    res.status(204).send();
  } catch (error) {
    logger.error('media', 'Failed to delete library', { error: String(error) });
    res.status(500).json({ error: 'Failed to delete library' });
  }
});

// ==================== IMAGE ENDPOINTS ====================

// Get images in a library
router.get('/libraries/:libraryId/images', (req, res) => {
  try {
    const { libraryId } = req.params;
    const db = getDatabase();

    const results = db.exec(
      `
      SELECT id, library_id, filename, original_name, mime_type, size, width, height, url, alt_text, created_at
      FROM library_images
      WHERE library_id = ?
      ORDER BY created_at DESC
    `,
      [libraryId]
    );

    const images: LibraryImage[] = [];
    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach((row: SqlValue[]) => {
        images.push({
          id: row[0] as string,
          library_id: row[1] as string,
          filename: row[2] as string,
          original_name: row[3] as string,
          mime_type: row[4] as string,
          size: row[5] as number,
          width: row[6] as number | null,
          height: row[7] as number | null,
          url: row[8] as string,
          alt_text: row[9] as string,
          created_at: row[10] as string,
        });
      });
    }

    res.json(images);
  } catch (error) {
    logger.error('media', 'Failed to get images', { error: String(error) });
    res.status(500).json({ error: 'Failed to get images' });
  }
});

// Get all images (with optional library filter)
router.get('/images', (req, res) => {
  try {
    const { library_id, search } = req.query;
    const db = getDatabase();

    let query = `
      SELECT id, library_id, filename, original_name, mime_type, size, width, height, url, alt_text, created_at
      FROM library_images
    `;
    const params: string[] = [];
    const conditions: string[] = [];

    if (library_id && typeof library_id === 'string') {
      conditions.push('library_id = ?');
      params.push(library_id);
    }

    const sanitizedSearch = sanitizeSearchParam(search);
    if (sanitizedSearch) {
      conditions.push('(original_name LIKE ? OR alt_text LIKE ?)');
      params.push(`%${sanitizedSearch}%`, `%${sanitizedSearch}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const results = db.exec(query, params);

    const images: LibraryImage[] = [];
    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach((row: SqlValue[]) => {
        images.push({
          id: row[0] as string,
          library_id: row[1] as string,
          filename: row[2] as string,
          original_name: row[3] as string,
          mime_type: row[4] as string,
          size: row[5] as number,
          width: row[6] as number | null,
          height: row[7] as number | null,
          url: row[8] as string,
          alt_text: row[9] as string,
          created_at: row[10] as string,
        });
      });
    }

    res.json(images);
  } catch (error) {
    logger.error('media', 'Failed to get images', { error: String(error) });
    res.status(500).json({ error: 'Failed to get images' });
  }
});

// Get upload limits
router.get('/limits', (_req, res) => {
  res.json({
    maxFilesPerUpload: MAX_FILES_PER_UPLOAD,
    maxFileSizeMB: 10,
  });
});

// Upload images to a library (supports multiple files)
router.post('/libraries/:libraryId/images', upload.array('images', MAX_FILES_PER_UPLOAD), (req, res) => {
  try {
    const { libraryId } = req.params;
    const files = (req as Express.Request & { files: Express.Multer.File[] }).files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const db = getDatabase();

    // Check if library exists
    const libraryExists = db.exec(`SELECT id FROM image_libraries WHERE id = ?`, [libraryId]);
    if (libraryExists.length === 0 || libraryExists[0].values.length === 0) {
      // Clean up uploaded files
      files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(404).json({ error: 'Library not found' });
    }

    const now = new Date().toISOString();
    const uploadedImages: LibraryImage[] = [];

    files.forEach((file) => {
      const id = uuidv4();
      const url = `/uploads/${file.filename}`;

      db.run(
        `INSERT INTO library_images (id, library_id, filename, original_name, mime_type, size, url, alt_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, libraryId, file.filename, file.originalname, file.mimetype, file.size, url, '', now]
      );

      uploadedImages.push({
        id,
        library_id: libraryId,
        filename: file.filename,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        width: null,
        height: null,
        url,
        alt_text: '',
        created_at: now,
      });
    });

    saveDatabase();

    logger.info('media', 'Images uploaded', { libraryId, count: files.length });
    res.status(201).json(uploadedImages);
  } catch (error) {
    logger.error('media', 'Failed to upload images', { error: String(error) });
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Update image metadata (alt text, original name)
router.put('/images/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { alt_text, original_name } = req.body;

    const db = getDatabase();

    // Check if image exists
    const existing = db.exec(`SELECT id FROM library_images WHERE id = ?`, [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (alt_text !== undefined) {
      db.run(`UPDATE library_images SET alt_text = ? WHERE id = ?`, [alt_text, id]);
    }

    if (original_name !== undefined && original_name.trim()) {
      db.run(`UPDATE library_images SET original_name = ? WHERE id = ?`, [original_name.trim(), id]);
    }

    saveDatabase();

    // Get updated image
    const results = db.exec(
      `SELECT id, library_id, filename, original_name, mime_type, size, width, height, url, alt_text, created_at
       FROM library_images WHERE id = ?`,
      [id]
    );

    if (results.length > 0 && results[0].values.length > 0) {
      const row = results[0].values[0];
      const image: LibraryImage = {
        id: row[0] as string,
        library_id: row[1] as string,
        filename: row[2] as string,
        original_name: row[3] as string,
        mime_type: row[4] as string,
        size: row[5] as number,
        width: row[6] as number | null,
        height: row[7] as number | null,
        url: row[8] as string,
        alt_text: row[9] as string,
        created_at: row[10] as string,
      };
      logger.info('media', 'Image updated', { id });
      res.json(image);
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    logger.error('media', 'Failed to update image', { error: String(error) });
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// Delete an image
router.delete('/images/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Get image filename to delete file
    const results = db.exec(`SELECT filename FROM library_images WHERE id = ?`, [id]);
    if (results.length === 0 || results[0].values.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const filename = results[0].values[0][0] as string;
    const filepath = path.join(UPLOADS_DIR, filename);

    // Delete from database
    db.run(`DELETE FROM library_images WHERE id = ?`, [id]);
    saveDatabase();

    // Delete file
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    logger.info('media', 'Image deleted', { id });
    res.status(204).send();
  } catch (error) {
    logger.error('media', 'Failed to delete image', { error: String(error) });
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Bulk delete images
router.post('/images/bulk-delete', (req, res) => {
  try {
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'Image IDs array is required' });
    }

    const ids = imageIds;

    const db = getDatabase();

    // Get filenames for all images to delete
    const placeholders = ids.map(() => '?').join(',');
    const results = db.exec(`SELECT id, filename FROM library_images WHERE id IN (${placeholders})`, ids);

    if (results.length > 0 && results[0].values.length > 0) {
      // Delete files
      results[0].values.forEach((row: SqlValue[]) => {
        const filename = row[1] as string;
        const filepath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      });

      // Delete from database
      db.run(`DELETE FROM library_images WHERE id IN (${placeholders})`, ids);
      saveDatabase();
    }

    logger.info('media', 'Images bulk deleted', { count: ids.length });
    res.status(204).send();
  } catch (error) {
    logger.error('media', 'Failed to bulk delete images', { error: String(error) });
    res.status(500).json({ error: 'Failed to bulk delete images' });
  }
});

export default router;
