import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Error message
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter
 * For production with multiple instances, consider Redis-based solution
 */
class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  check(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    let entry = this.store.get(key);

    // If no entry or expired, create new one
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      this.store.set(key, entry);
      return { allowed: true, remaining: config.maxRequests - 1, resetTime: entry.resetTime };
    }

    // Increment count
    entry.count++;

    if (entry.count > config.maxRequests) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

const limiter = new RateLimiter();

/**
 * Get client identifier for rate limiting
 * Uses X-Forwarded-For if behind proxy, otherwise remote address
 */
function getClientId(req: Request): string {
  const forwarded = req.get('X-Forwarded-For');
  if (forwarded) {
    // Take the first IP (original client)
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create rate limit middleware with specified configuration
 */
export function createRateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = getClientId(req);
    const key = `${clientId}:${req.baseUrl}`;
    const result = limiter.check(key, config);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      logger.debug('rateLimit', 'Rate limit exceeded', {
        clientId,
        path: req.path,
        limit: config.maxRequests,
        windowMs: config.windowMs,
      });

      res.status(429).json({
        error: config.message || 'Too many requests, please try again later',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters for different use cases

/**
 * General API rate limiter
 * 500 requests per minute - allows for dashboard polling and health checks
 */
export const apiRateLimit = createRateLimit({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 500,
  message: 'Too many API requests, please try again later',
});

/**
 * Strict rate limiter for auth endpoints
 * 10 requests per minute
 */
export const authRateLimit = createRateLimit({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,
  message: 'Too many authentication attempts, please try again later',
});

/**
 * Very strict rate limiter for sensitive operations
 * 5 requests per minute
 */
export const sensitiveRateLimit = createRateLimit({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 5,
  message: 'Too many requests for this operation, please try again later',
});

/**
 * Lenient rate limiter for data fetching
 * 200 requests per minute
 */
export const dataRateLimit = createRateLimit({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 200,
  message: 'Too many data requests, please try again later',
});
