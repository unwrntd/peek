import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/logger';

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Add request ID to all requests for traceability
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Security headers middleware (lightweight alternative to helmet for specific needs)
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (restrict sensitive APIs)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Content Security Policy (relaxed for dashboard functionality)
  // Note: 'unsafe-inline' needed for Tailwind and inline styles
  // '*' for img-src to allow integration icons and external images
  // Google Fonts domains added for custom font support
  // api.iconify.design added for icon picker functionality
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.iconify.design",
    "frame-ancestors 'self'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);

  next();
}

/**
 * Request logging middleware for audit trail
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent')?.substring(0, 100),
    };

    // Only log API requests (skip static files in production)
    if (req.path.startsWith('/api/')) {
      if (res.statusCode >= 400) {
        logger.debug('request', 'API request failed', logData);
      } else {
        logger.debug('request', 'API request completed', logData);
      }
    }
  });

  next();
}
