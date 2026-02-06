import { Router, Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../services/logger';

const router = Router();

const AUTHORIZE_URL = 'https://api.ecobee.com/authorize';
const TOKEN_URL = 'https://api.ecobee.com/token';

// Store pending authorization sessions
interface PendingSession {
  apiKey: string;
  code: string;
  expires: number;
  completed: boolean;
  refreshToken?: string;
  error?: string;
  interval: number; // Poll interval in seconds
}

const pendingSessions = new Map<string, PendingSession>();

// Clean up expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingSessions.entries()) {
    if (now > session.expires) {
      pendingSessions.delete(key);
    }
  }
}, 60000);

// Step 1: Request a PIN from Ecobee
router.post('/request-pin', async (req: Request, res: Response) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    res.status(400).json({ error: 'API Key is required' });
    return;
  }

  try {
    // Request authorization code and PIN
    const response = await axios.get(AUTHORIZE_URL, {
      params: {
        response_type: 'ecobeePin',
        client_id: apiKey,
        scope: 'smartRead,smartWrite',
      },
    });

    const data = response.data;

    if (!data.ecobeePin || !data.code) {
      logger.error('ecobee-auth', 'Invalid PIN response from Ecobee', { data });
      res.status(500).json({ error: 'Invalid response from Ecobee' });
      return;
    }

    // Store session for polling
    const sessionId = `${apiKey}_${data.code.substring(0, 10)}`;
    pendingSessions.set(sessionId, {
      apiKey,
      code: data.code,
      expires: Date.now() + (data.expires_in || 840) * 1000, // Usually 14 minutes
      completed: false,
      interval: data.interval || 30, // Poll interval
    });

    logger.info('ecobee-auth', 'PIN requested successfully', {
      apiKey: apiKey.substring(0, 8) + '...',
      pin: data.ecobeePin,
    });

    res.json({
      success: true,
      pin: data.ecobeePin,
      code: data.code,
      expiresIn: data.expires_in || 840,
      interval: data.interval || 30,
      sessionId,
      instructions: [
        '1. Go to ecobee.com and log in',
        '2. Navigate to "My Apps" in the menu',
        '3. Click "Add Application"',
        '4. Enter the PIN shown above',
        '5. Click "Validate" and then "Add Application"',
        '6. Return here and click "Complete Authorization"',
      ],
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('ecobee-auth', 'Failed to request PIN', { error: errorMsg });

    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data;
      res.status(error.response.status).json({
        error: data?.status?.message || data?.error || 'Failed to request PIN from Ecobee',
      });
      return;
    }

    res.status(500).json({ error: `Failed to request PIN: ${errorMsg}` });
  }
});

// Step 2: Exchange authorization code for tokens (after user enters PIN)
router.post('/exchange', async (req: Request, res: Response) => {
  const { apiKey, code, sessionId } = req.body;

  if (!apiKey || !code) {
    res.status(400).json({ error: 'API Key and authorization code are required' });
    return;
  }

  // Check session if provided
  if (sessionId) {
    const session = pendingSessions.get(sessionId);
    if (!session) {
      res.status(400).json({ error: 'Session expired or invalid. Please request a new PIN.' });
      return;
    }
    if (Date.now() > session.expires) {
      pendingSessions.delete(sessionId);
      res.status(400).json({ error: 'Authorization expired. Please request a new PIN.' });
      return;
    }
  }

  try {
    // Exchange code for tokens
    const response = await axios.post(TOKEN_URL, new URLSearchParams({
      grant_type: 'ecobeePin',
      code,
      client_id: apiKey,
      ecobee_type: 'jwt',
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;

    if (!data.access_token || !data.refresh_token) {
      // This often means the user hasn't registered the PIN yet
      logger.debug('ecobee-auth', 'Token exchange returned no tokens (PIN not yet registered)');
      res.json({
        success: false,
        completed: false,
        message: 'Waiting for PIN registration. Please complete the authorization in Ecobee.',
      });
      return;
    }

    // Update session if exists
    if (sessionId) {
      const session = pendingSessions.get(sessionId);
      if (session) {
        session.completed = true;
        session.refreshToken = data.refresh_token;
        // Clean up after a short delay
        setTimeout(() => pendingSessions.delete(sessionId), 30000);
      }
    }

    logger.info('ecobee-auth', 'Token exchange successful');

    res.json({
      success: true,
      completed: true,
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
      scope: data.scope,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('ecobee-auth', 'Token exchange failed', { error: errorMsg });

    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data;
      const status = data?.status;

      // Check for specific Ecobee error codes
      if (status?.code === 16) {
        // Authorization pending - user hasn't entered PIN yet
        res.json({
          success: false,
          completed: false,
          message: 'Authorization pending. Please enter the PIN in Ecobee.',
        });
        return;
      }

      if (status?.code === 2) {
        // Authorization expired
        if (sessionId) {
          pendingSessions.delete(sessionId);
        }
        res.status(400).json({
          error: 'Authorization expired. Please request a new PIN.',
        });
        return;
      }

      res.status(error.response.status).json({
        error: status?.message || data?.error || 'Token exchange failed',
      });
      return;
    }

    res.status(500).json({ error: `Token exchange failed: ${errorMsg}` });
  }
});

// Step 3: Poll for completion (alternative to exchange endpoint)
router.post('/poll', async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    res.status(400).json({ error: 'Session ID is required' });
    return;
  }

  const session = pendingSessions.get(sessionId);
  if (!session) {
    res.status(400).json({ error: 'Session expired or invalid. Please request a new PIN.' });
    return;
  }

  if (Date.now() > session.expires) {
    pendingSessions.delete(sessionId);
    res.status(400).json({ error: 'Authorization expired. Please request a new PIN.' });
    return;
  }

  // If already completed, return the token
  if (session.completed && session.refreshToken) {
    res.json({
      success: true,
      completed: true,
      refreshToken: session.refreshToken,
    });
    return;
  }

  if (session.error) {
    res.json({
      success: false,
      completed: true,
      error: session.error,
    });
    return;
  }

  // Try to exchange the code
  try {
    const response = await axios.post(TOKEN_URL, new URLSearchParams({
      grant_type: 'ecobeePin',
      code: session.code,
      client_id: session.apiKey,
      ecobee_type: 'jwt',
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;

    if (data.access_token && data.refresh_token) {
      session.completed = true;
      session.refreshToken = data.refresh_token;

      res.json({
        success: true,
        completed: true,
        refreshToken: data.refresh_token,
      });
      return;
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.status?.code === 16) {
      // Still waiting for user to enter PIN
      res.json({
        success: true,
        completed: false,
        message: 'Waiting for PIN registration...',
        interval: session.interval,
      });
      return;
    }

    if (axios.isAxiosError(error) && error.response?.data?.status?.code === 2) {
      // Authorization expired
      session.completed = true;
      session.error = 'Authorization expired';
      res.json({
        success: false,
        completed: true,
        error: 'Authorization expired. Please request a new PIN.',
      });
      return;
    }

    // Other error
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.debug('ecobee-auth', 'Poll check failed', { error: errorMsg });
  }

  // Still waiting
  res.json({
    success: true,
    completed: false,
    message: 'Waiting for PIN registration...',
    interval: session.interval,
  });
});

// Get session status without attempting exchange
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = pendingSessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const remainingSeconds = Math.max(0, Math.floor((session.expires - Date.now()) / 1000));

  res.json({
    exists: true,
    completed: session.completed,
    hasToken: !!session.refreshToken,
    hasError: !!session.error,
    error: session.error,
    remainingSeconds,
    expired: Date.now() > session.expires,
  });
});

export default router;
