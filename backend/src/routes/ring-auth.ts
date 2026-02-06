import { Router, Request, Response } from 'express';
import { logger } from '../services/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RingRestClient } = require('ring-client-api/rest-client');

const router = Router();

// Store pending 2FA sessions temporarily (in production, use Redis or similar)
const pendingSessions = new Map<string, { email: string; password: string; expires: number }>();

// Clean up expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingSessions.entries()) {
    if (now > session.expires) {
      pendingSessions.delete(key);
    }
  }
}, 60000);

// Step 1: Initiate authentication (will trigger 2FA)
router.post('/request-code', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const restClient = new RingRestClient({
      email,
      password,
    });

    // This will fail with 2FA required error, which is expected
    try {
      await restClient.getCurrentAuth();
      // If we get here without error, 2FA might be disabled (unlikely for Ring)
      const token = restClient.refreshToken;
      if (token) {
        res.json({ success: true, refreshToken: token, requires2fa: false });
        return;
      }
    } catch (authError: unknown) {
      const error = authError as Error & { response?: { status?: number } };
      // Check if this is a 2FA required error
      if (error.message?.includes('2fa') ||
          error.message?.includes('two factor') ||
          error.message?.includes('Verification Code') ||
          error.response?.status === 412) {

        // Store session for 2FA verification (5 minute expiry)
        const sessionId = Math.random().toString(36).substring(2, 15);
        pendingSessions.set(sessionId, {
          email,
          password,
          expires: Date.now() + 5 * 60 * 1000,
        });

        logger.info('ring-auth', '2FA code requested', { email });
        res.json({
          success: true,
          requires2fa: true,
          sessionId,
          message: 'A verification code has been sent to your phone or email'
        });
        return;
      }

      // Some other auth error
      throw authError;
    }

    res.status(400).json({ error: 'Unable to initiate authentication' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('ring-auth', 'Failed to request 2FA code', { error: errorMsg, email });

    if (errorMsg.includes('Invalid email or password') || errorMsg.includes('Unauthorized')) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    res.status(500).json({ error: `Authentication failed: ${errorMsg}` });
  }
});

// Step 2: Verify 2FA code and get refresh token
router.post('/verify-code', async (req: Request, res: Response) => {
  const { sessionId, code } = req.body;

  if (!sessionId || !code) {
    res.status(400).json({ error: 'Session ID and verification code are required' });
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
    const restClient = new RingRestClient({
      email: session.email,
      password: session.password,
    });

    // Provide the 2FA code
    await restClient.getAuth(code);

    const refreshToken = restClient.refreshToken;

    if (!refreshToken) {
      res.status(400).json({ error: 'Failed to obtain refresh token' });
      return;
    }

    // Clean up session
    pendingSessions.delete(sessionId);

    logger.info('ring-auth', 'Successfully generated refresh token', { email: session.email });
    res.json({
      success: true,
      refreshToken,
      message: 'Token generated successfully'
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('ring-auth', 'Failed to verify 2FA code', { error: errorMsg });

    if (errorMsg.includes('Verification Code') || errorMsg.includes('invalid') || errorMsg.includes('incorrect')) {
      res.status(400).json({ error: 'Invalid verification code. Please try again.' });
      return;
    }

    res.status(500).json({ error: `Verification failed: ${errorMsg}` });
  }
});

export default router;
