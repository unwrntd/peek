# Security Guide

This document describes the security features and configuration options in Peek.

## Overview

Peek includes several layers of security protection:

1. **CORS Configuration** - Control which origins can access the API
2. **Rate Limiting** - Prevent API abuse and DoS attacks
3. **Security Headers** - Protect against common web vulnerabilities
4. **Input Validation** - Sanitize and validate all user input
5. **Error Sanitization** - Prevent credential leakage in logs
6. **Request Tracing** - Audit trail with unique request IDs

## CORS Configuration

By default, Peek allows requests from any origin (for development convenience). For production deployments, restrict CORS using the `ALLOWED_ORIGINS` environment variable:

```bash
# Single origin
ALLOWED_ORIGINS=https://dash.example.com

# Multiple origins (comma-separated)
ALLOWED_ORIGINS=https://dash.example.com,https://dashboard.local,http://192.168.1.100:8080
```

When `ALLOWED_ORIGINS` is not set, all origins are allowed.

## Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API (`/api/*`) | 100 requests | 15 minutes |
| Authentication (`/api/ring-auth`, `/api/homeconnect-auth`) | 10 requests | 1 minute |
| Data Fetching (`/api/data/*`, `/api/weather/*`) | 200 requests | 1 minute |

### Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706745600
```

When rate limited, the API returns a `429 Too Many Requests` response:

```json
{
  "error": "Too many API requests, please try again later",
  "retryAfter": 300
}
```

## Security Headers

The following security headers are set on all responses:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking protection |
| `X-XSS-Protection` | `1; mode=block` | XSS filter (legacy browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer info |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Restrict browser APIs |
| `Content-Security-Policy` | See below | XSS and injection protection |

### Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https: http:;
font-src 'self' data:;
connect-src 'self';
frame-ancestors 'self';
```

Note: `'unsafe-inline'` is required for Tailwind CSS styles. Image sources allow external URLs to support integration icons.

## Request Tracing

Every request is assigned a unique ID for tracing and debugging:

```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

This ID is logged with all related operations, making it easy to trace issues across the system.

## Input Validation

### Search Parameters

Search parameters are validated and limited:
- Maximum length: 255 characters
- Trimmed of whitespace
- Used in parameterized SQL queries (SQL injection safe)

### File Uploads

File uploads are restricted:
- Allowed types: PNG, JPEG, GIF, SVG, WebP, ICO
- Maximum file size: 10 MB per file
- Maximum files per upload: 100

### SQL Injection Prevention

All database queries use parameterized statements:

```typescript
// Safe - parameterized query
db.exec('SELECT * FROM integrations WHERE id = ?', [id]);

// Never done - string interpolation
// db.exec(`SELECT * FROM integrations WHERE id = '${id}'`);
```

## Error Handling

### Credential Sanitization

Error messages are sanitized before logging to prevent credential leakage:

```typescript
// Patterns redacted in logs:
// - token=xxx, token: xxx
// - password=xxx, password: xxx
// - api_key=xxx, apikey=xxx
// - Bearer xxx, Basic xxx
// - secret=xxx, authorization=xxx
```

### Generic Error Responses

Internal error details are not exposed to clients. Instead, generic error messages are returned:

```json
{
  "error": "Failed to fetch integration data"
}
```

Detailed error information is logged server-side with the request ID for debugging.

## Integration Security

### SSL/TLS Verification

Integration connections support SSL verification configuration:

```typescript
{
  host: '192.168.1.100',
  port: 443,
  verifySSL: true  // Set to false only for self-signed certificates
}
```

### Credential Storage

Integration credentials are stored in the SQLite database. For production deployments with sensitive data, consider:

1. Using API tokens instead of passwords where possible
2. Rotating credentials regularly
3. Restricting database file permissions
4. Backing up the database securely

## Deployment Recommendations

### Production Checklist

- [ ] Set `ALLOWED_ORIGINS` to restrict CORS
- [ ] Use HTTPS with a valid certificate
- [ ] Run behind a reverse proxy (nginx, Traefik, Caddy)
- [ ] Restrict network access to the dashboard
- [ ] Use strong passwords/tokens for integrations
- [ ] Keep the Docker image updated
- [ ] Monitor logs for suspicious activity

### Reverse Proxy Configuration

Example nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name dash.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by opening a private issue or contacting the maintainers directly. Do not disclose security issues publicly until they have been addressed.
