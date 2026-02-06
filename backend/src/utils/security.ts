/**
 * Security utilities for the application
 */

/**
 * Sanitize error messages to prevent credential leakage in logs
 */
export function sanitizeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg
    .replace(/token[=:]\s*[^\s&"']+/gi, 'token=[REDACTED]')
    .replace(/password[=:]\s*[^\s&"']+/gi, 'password=[REDACTED]')
    .replace(/api[_-]?key[=:]\s*[^\s&"']+/gi, 'apikey=[REDACTED]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/Basic\s+[^\s"']+/gi, 'Basic [REDACTED]')
    .replace(/secret[=:]\s*[^\s&"']+/gi, 'secret=[REDACTED]')
    .replace(/authorization[=:]\s*[^\s&"']+/gi, 'authorization=[REDACTED]');
}

/**
 * Validate and sanitize search parameters
 */
export function sanitizeSearchParam(search: unknown, maxLength = 255): string | null {
  if (!search || typeof search !== 'string') {
    return null;
  }
  // Trim and limit length
  return search.trim().substring(0, maxLength);
}

