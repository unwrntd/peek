import { Router, Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../services/logger';

const router = Router();

const AUTH_URL = 'https://api.home-connect.com/security/oauth';

// Store pending device flow sessions
const pendingSessions = new Map<string, {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expires: number;
}>();

// Clean up expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingSessions.entries()) {
    if (now > session.expires) {
      pendingSessions.delete(key);
    }
  }
}, 60000);

// Step 1: Request device code
router.post('/device-code', async (req: Request, res: Response) => {
  const { clientId, clientSecret } = req.body;

  if (!clientId || !clientSecret) {
    res.status(400).json({ error: 'Client ID and Client Secret are required' });
    return;
  }

  try {
    // Request device code from Home Connect
    const response = await axios.post(
      `${AUTH_URL}/device_authorization`,
      new URLSearchParams({
        client_id: clientId,
        scope: 'IdentifyAppliance Monitor Settings',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const data = response.data;

    // Store session for polling
    const sessionId = Math.random().toString(36).substring(2, 15);
    pendingSessions.set(sessionId, {
      clientId,
      clientSecret,
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri_complete || data.verification_uri,
      interval: data.interval || 5,
      expires: Date.now() + (data.expires_in || 600) * 1000,
    });

    logger.info('homeconnect-auth', 'Device code requested', { clientId: clientId.substring(0, 8) + '...' });

    res.json({
      success: true,
      sessionId,
      userCode: data.user_code,
      verificationUri: data.verification_uri_complete || data.verification_uri,
      expiresIn: data.expires_in || 600,
      interval: data.interval || 5,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('homeconnect-auth', 'Failed to request device code', { error: errorMsg });

    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401 || status === 400) {
        res.status(400).json({ error: 'Invalid Client ID or Client Secret' });
        return;
      }

      res.status(status).json({ error: data?.error_description || data?.error || 'Device authorization failed' });
      return;
    }

    res.status(500).json({ error: `Failed to request device code: ${errorMsg}` });
  }
});

// Step 2: Poll for token (called by frontend while user authorizes)
router.post('/poll-token', async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    res.status(400).json({ error: 'Session ID is required' });
    return;
  }

  const session = pendingSessions.get(sessionId);
  if (!session) {
    res.status(400).json({ error: 'Session expired or invalid. Please start over.' });
    return;
  }

  if (Date.now() > session.expires) {
    pendingSessions.delete(sessionId);
    res.status(400).json({ error: 'Session expired. Please start over.' });
    return;
  }

  try {
    // Poll for token
    const response = await axios.post(
      `${AUTH_URL}/token`,
      new URLSearchParams({
        grant_type: 'device_code',
        device_code: session.deviceCode,
        client_id: session.clientId,
        client_secret: session.clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const data = response.data;

    // Success! Clean up session and return tokens
    pendingSessions.delete(sessionId);

    logger.info('homeconnect-auth', 'Successfully obtained tokens');

    res.json({
      success: true,
      completed: true,
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data;
      const errorCode = data?.error;

      // authorization_pending means user hasn't authorized yet - keep polling
      if (errorCode === 'authorization_pending') {
        res.json({
          success: true,
          completed: false,
          message: 'Waiting for authorization...',
        });
        return;
      }

      // slow_down means we're polling too fast
      if (errorCode === 'slow_down') {
        res.json({
          success: true,
          completed: false,
          message: 'Waiting for authorization...',
          slowDown: true,
        });
        return;
      }

      // expired_token means the device code expired
      if (errorCode === 'expired_token') {
        pendingSessions.delete(sessionId);
        res.status(400).json({ error: 'Authorization expired. Please start over.' });
        return;
      }

      // access_denied means user rejected
      if (errorCode === 'access_denied') {
        pendingSessions.delete(sessionId);
        res.status(400).json({ error: 'Authorization was denied.' });
        return;
      }

      res.status(error.response.status).json({
        error: data?.error_description || data?.error || 'Token request failed'
      });
      return;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('homeconnect-auth', 'Failed to poll for token', { error: errorMsg });
    res.status(500).json({ error: `Failed to get token: ${errorMsg}` });
  }
});

export default router;
