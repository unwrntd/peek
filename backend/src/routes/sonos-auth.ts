import { Router, Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../services/logger';

const router = Router();

const AUTH_URL = 'https://api.sonos.com/login/v3/oauth';
const TOKEN_URL = 'https://api.sonos.com/login/v3/oauth/access';

// Store pending OAuth sessions
const pendingSessions = new Map<string, {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  expires: number;
  completed: boolean;
  refreshToken?: string;
  error?: string;
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

// Generate a random state string
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Step 1: Initialize OAuth flow and return authorization URL
router.post('/authorize', async (req: Request, res: Response) => {
  const { clientId, clientSecret, redirectUri } = req.body;

  if (!clientId || !clientSecret) {
    res.status(400).json({ error: 'Client ID and Client Secret are required' });
    return;
  }

  const effectiveRedirectUri = redirectUri || 'http://localhost:3001/api/sonos-auth/callback';

  // Generate state for CSRF protection
  const state = generateState();

  // Store session for callback
  pendingSessions.set(state, {
    clientId,
    clientSecret,
    redirectUri: effectiveRedirectUri,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    completed: false,
  });

  // Build authorization URL
  const authUrl = new URL(`${AUTH_URL}`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'playback-control-all');
  authUrl.searchParams.set('redirect_uri', effectiveRedirectUri);

  logger.info('sonos-auth', 'OAuth flow initiated', { clientId: clientId.substring(0, 8) + '...' });

  res.json({
    success: true,
    state,
    authUrl: authUrl.toString(),
  });
});

// Step 2: OAuth callback (Sonos redirects here after user authorizes)
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    logger.error('sonos-auth', 'OAuth error from Sonos', { error, error_description });

    // Update session with error
    if (state && typeof state === 'string') {
      const session = pendingSessions.get(state);
      if (session) {
        session.completed = true;
        session.error = String(error_description || error);
      }
    }

    // Return HTML that closes the popup and shows error
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Sonos Authorization Failed</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'sonos-auth-error', error: '${String(error_description || error).replace(/'/g, "\\'")}' }, '*');
            }
            window.close();
          </script>
          <p>Authorization failed: ${error_description || error}</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
    return;
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Sonos Authorization Failed</title></head>
        <body>
          <p>Invalid callback parameters.</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
    return;
  }

  const session = pendingSessions.get(state);
  if (!session) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Sonos Authorization Failed</title></head>
        <body>
          <p>Session expired or invalid. Please try again.</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
    return;
  }

  try {
    // Exchange code for tokens
    const credentials = Buffer.from(`${session.clientId}:${session.clientSecret}`).toString('base64');

    const tokenResponse = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: session.redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
      }
    );

    const { refresh_token, access_token, expires_in } = tokenResponse.data;

    // Update session with tokens
    session.completed = true;
    session.refreshToken = refresh_token;

    logger.info('sonos-auth', 'Successfully obtained tokens');

    // Return HTML that closes the popup
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Sonos Authorization Complete</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'sonos-auth-success' }, '*');
            }
            window.close();
          </script>
          <p>Authorization successful!</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
  } catch (tokenError) {
    const errorMsg = tokenError instanceof Error ? tokenError.message : String(tokenError);
    logger.error('sonos-auth', 'Failed to exchange code for tokens', { error: errorMsg });

    session.completed = true;
    let errorMessage = 'Failed to exchange authorization code';

    if (axios.isAxiosError(tokenError) && tokenError.response) {
      const data = tokenError.response.data;
      errorMessage = data?.error_description || data?.error || errorMessage;
    }

    session.error = errorMessage;

    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Sonos Authorization Failed</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'sonos-auth-error', error: '${errorMessage.replace(/'/g, "\\'")}' }, '*');
            }
            window.close();
          </script>
          <p>Authorization failed: ${errorMessage}</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
  }
});

// Step 3: Poll for completion (called by frontend while popup is open)
router.post('/poll', async (req: Request, res: Response) => {
  const { state } = req.body;

  if (!state) {
    res.status(400).json({ error: 'State is required' });
    return;
  }

  const session = pendingSessions.get(state);
  if (!session) {
    res.status(400).json({ error: 'Session expired or invalid. Please start over.' });
    return;
  }

  if (Date.now() > session.expires) {
    pendingSessions.delete(state);
    res.status(400).json({ error: 'Session expired. Please start over.' });
    return;
  }

  if (session.completed) {
    // Clean up completed session after returning result
    setTimeout(() => pendingSessions.delete(state), 5000);

    if (session.error) {
      res.json({
        success: false,
        completed: true,
        error: session.error,
      });
      return;
    }

    res.json({
      success: true,
      completed: true,
      refreshToken: session.refreshToken,
    });
    return;
  }

  // Still waiting
  res.json({
    success: true,
    completed: false,
    message: 'Waiting for authorization...',
  });
});

export default router;
