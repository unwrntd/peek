import { Router, Request, Response } from 'express';
import { getDatabase } from '../database/db';
import { integrationRegistry } from '../integrations/registry';
import { logger } from '../services/logger';

const router = Router();

// Helper to get integration config
function getIntegrationConfig(integrationId: string) {
  const db = getDatabase();
  const results = db.exec('SELECT config, type FROM integrations WHERE id = ?', [integrationId]);

  if (results.length === 0 || results[0].values.length === 0) {
    throw new Error('Integration not found');
  }

  const columns = results[0].columns;
  const row = results[0].values[0];
  const configIndex = columns.indexOf('config');
  const typeIndex = columns.indexOf('type');

  const integrationType = row[typeIndex] as string;
  if (integrationType !== 'sonos') {
    throw new Error('Invalid integration type');
  }

  return JSON.parse(row[configIndex] as string);
}

// Play
router.post('/:integrationId/play', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'play', { groupId });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Play failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// Pause
router.post('/:integrationId/pause', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'pause', { groupId });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Pause failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// Toggle play/pause
router.post('/:integrationId/toggle', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'toggle', { groupId });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Toggle failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// Next track
router.post('/:integrationId/next', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'next', { groupId });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Next failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// Previous track
router.post('/:integrationId/previous', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'previous', { groupId });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Previous failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// Set volume
router.post('/:integrationId/volume', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId, volume } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    if (volume === undefined || volume < 0 || volume > 100) {
      res.status(400).json({ error: 'Volume must be between 0 and 100' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'setVolume', { groupId, volume });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Set volume failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// Set mute
router.post('/:integrationId/mute', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId, muted } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    if (muted === undefined) {
      res.status(400).json({ error: 'Muted state is required' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'setMute', { groupId, muted });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Set mute failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// Load favorite
router.post('/:integrationId/favorite', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId, favoriteId, playOnCompletion = true } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    if (!favoriteId) {
      res.status(400).json({ error: 'Favorite ID is required' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'loadFavorite', { groupId, favoriteId, playOnCompletion });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Load favorite failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

// Load playlist
router.post('/:integrationId/playlist', async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { groupId, playlistId, playOnCompletion = true } = req.body;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    if (!playlistId) {
      res.status(400).json({ error: 'Playlist ID is required' });
      return;
    }

    const config = await getIntegrationConfig(integrationId);
    const handler = integrationRegistry.get('sonos');

    if (!handler || !('performAction' in handler)) {
      res.status(400).json({ error: 'Sonos integration not found' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handler as any).performAction(config, 'loadPlaylist', { groupId, playlistId, playOnCompletion });
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('sonos-control', 'Load playlist failed', { error: errorMsg });
    res.status(500).json({ error: errorMsg });
  }
});

export default router;
