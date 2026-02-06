import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { initDatabase, closeDatabase } from './database/db';
import { logger } from './services/logger';
import { requestIdMiddleware, securityHeaders, requestLogger } from './middleware/security';
import { apiRateLimit, authRateLimit, sensitiveRateLimit, dataRateLimit } from './middleware/rateLimit';
import integrationsRouter from './routes/integrations';
import widgetsRouter from './routes/widgets';
import dashboardRouter from './routes/dashboard';
import dashboardsRouter from './routes/dashboards';
import dataRouter from './routes/data';
import logsRouter from './routes/logs';
import groupsRouter from './routes/groups';
import settingsRouter from './routes/settings';
import networkRouter from './routes/network';
import mediaRouter from './routes/media';
import rssRouter from './routes/rss';
import weatherRouter from './routes/weather';
import serviceStatusRouter from './routes/service-status';
import ringAuthRouter from './routes/ring-auth';
import homeconnectAuthRouter from './routes/homeconnect-auth';
import homeconnectImageRouter from './routes/homeconnect-image';
import sonosAuthRouter from './routes/sonos-auth';
import sonosControlRouter from './routes/sonos-control';
import ecobeeAuthRouter from './routes/ecobee-auth';
import crossIntegrationRouter from './routes/cross-integration';
import packageRouter from './routes/package';
import docsRouter from './routes/docs';
import devRouter from './routes/dev';
import { integrationRegistry } from './integrations/registry';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
// In production, set ALLOWED_ORIGINS env var to restrict origins
// Example: ALLOWED_ORIGINS=https://dash.example.com,https://dashboard.local
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins && allowedOrigins.length > 0
    ? (origin, callback) => {
        // Allow requests with no origin (same-origin, Postman, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : true,  // Allow all origins if ALLOWED_ORIGINS not set (development)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

// Core middleware
app.use(cors(corsOptions));
app.use(compression()); // Enable gzip compression for responses
app.use(express.json({ limit: '10mb' })); // Limit JSON body size

// Security middleware
app.use(requestIdMiddleware);
app.use(securityHeaders);
app.use(requestLogger);

// Serve uploaded files with caching headers
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), {
  maxAge: '1d', // Cache static files for 1 day
  etag: true,
}));

// API Routes with rate limiting
// Data routes have higher limits as they're frequently polled
app.use('/api/data', dataRateLimit, dataRouter);
app.use('/api/cross-integration', dataRateLimit, crossIntegrationRouter);

// Auth routes have stricter limits
app.use('/api/ring-auth', authRateLimit, ringAuthRouter);
app.use('/api/homeconnect-auth', authRateLimit, homeconnectAuthRouter);
app.use('/api/sonos-auth', authRateLimit, sonosAuthRouter);
app.use('/api/sonos-control', apiRateLimit, sonosControlRouter);
app.use('/api/ecobee-auth', authRateLimit, ecobeeAuthRouter);

// Settings has sensitive operations
app.use('/api/settings', apiRateLimit, settingsRouter);

// Standard API routes
app.use('/api/integrations', apiRateLimit, integrationsRouter);
app.use('/api/widgets', apiRateLimit, widgetsRouter);
app.use('/api/dashboard', apiRateLimit, dashboardRouter);
app.use('/api/dashboards', apiRateLimit, dashboardsRouter);
app.use('/api/logs', apiRateLimit, logsRouter);
app.use('/api/groups', apiRateLimit, groupsRouter);
app.use('/api/network', apiRateLimit, networkRouter);
app.use('/api/media', apiRateLimit, mediaRouter);
app.use('/api/rss', apiRateLimit, rssRouter);
app.use('/api/weather', dataRateLimit, weatherRouter);
app.use('/api/service-status', dataRateLimit, serviceStatusRouter);
app.use('/api/homeconnect-image', apiRateLimit, homeconnectImageRouter);
app.use('/api/package', apiRateLimit, packageRouter);
app.use('/api/docs', apiRateLimit, docsRouter);
app.use('/api/dev', apiRateLimit, devRouter);

// Get available integration types
app.get('/api/integration-types', (_req, res) => {
  res.json(integrationRegistry.getTypes());
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');

  // Serve static assets with long cache times (1 year for hashed files)
  app.use(express.static(frontendPath, {
    maxAge: '1y',
    etag: true,
    setHeaders: (res, filePath) => {
      // Don't cache index.html - always serve fresh
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    logger.info('system', 'Database initialized');

    app.listen(PORT, () => {
      logger.info('system', `Server running on port ${PORT}`);
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('system', 'Shutting down...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('system', 'Shutting down...');
  closeDatabase();
  process.exit(0);
});
