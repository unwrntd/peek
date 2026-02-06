import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Allowed documentation files (whitelist for security)
const ALLOWED_DOCS = [
  'GETTING_STARTED.md',
  'ADDING_INTEGRATIONS.md',
  'SECURITY.md',
  'WIDGETS.md',
  'API.md',
];

// Get list of available documentation files
router.get('/', (_req: Request, res: Response) => {
  const docsDir = path.join(__dirname, '../../../docs');

  try {
    const files = fs.readdirSync(docsDir)
      .filter(file => file.endsWith('.md') && ALLOWED_DOCS.includes(file));

    res.json({
      files: files.map(file => ({
        name: file,
        path: `/api/docs/${file}`,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list documentation files' });
  }
});

// Get specific documentation file
router.get('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;

  // Security: Only allow whitelisted files
  if (!ALLOWED_DOCS.includes(filename)) {
    return res.status(404).json({ error: 'Documentation file not found' });
  }

  // Security: Prevent path traversal
  const sanitizedFilename = path.basename(filename);
  if (sanitizedFilename !== filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const docsDir = path.join(__dirname, '../../../docs');
  const filePath = path.join(docsDir, sanitizedFilename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Documentation file not found' });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.type('text/markdown').send(content);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read documentation file' });
  }
});

export default router;
