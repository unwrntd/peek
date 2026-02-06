import { Router, Request, Response } from 'express';
import { logger } from '../services/logger';

const router = Router();

// Get logs with optional filtering
router.get('/', (req: Request, res: Response) => {
  try {
    const { level, source, limit, offset } = req.query;

    const logs = logger.getLogs({
      level: level as 'debug' | 'info' | 'warn' | 'error' | undefined,
      source: source as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Clear logs
router.delete('/', (req: Request, res: Response) => {
  try {
    const { olderThanDays } = req.query;
    logger.clearLogs(olderThanDays ? parseInt(olderThanDays as string, 10) : undefined);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

export default router;
