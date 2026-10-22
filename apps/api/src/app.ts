import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { securityHeaders, corsMiddleware } from './middleware/security.middleware.js';
import { authenticate, csrfProtection } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { documentRoutes } from './modules/documents/document.routes.js';
import { sharingRoutes } from './modules/sharing/sharing.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { getDb } from './db/index.js';
import { config } from './config/index.js';

export function createApp() {
  const app = express();

  // 1. Security Headers (Helmet, CSP, nosniff, etc.)
  app.use(securityHeaders);

  // 2. CORS allowlist
  app.use(corsMiddleware);

  // 3. Body parsers with strict size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Cookie parser for HttpOnly session cookies
  app.use(cookieParser());

  // 5. Authenticate session if cookie is present
  app.use(authenticate);

  // 6. CSRF Protection for state-changing requests
  app.use(csrfProtection);

  // 6. Health & Readiness Observability
  app.get('/api/health', async (_req, res) => {
    try {
      const db = await getDb();
      await db.query('SELECT 1');
      res.status(200).json({
        status: 'UP',
        database: 'CONNECTED',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'DOWN',
        database: 'DISCONNECTED',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 7. Route Mounts
  app.use('/api/auth', authRoutes);
  app.use('/api/documents', sharingRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/admin/audit', auditRoutes);

  // 8. Explicitly block direct access to internal and storage paths
  app.use(['/storage', '/uploads', '/database', '/scripts', '/tests'], (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    });
  });

  // 9. Serve Frontend in Production if built and in production environment
  const webDistPath = path.resolve('apps/web/dist');
  if (config.env === 'production' && fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(webDistPath, 'index.html'));
    });
  }

  // 9. 404 Handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    });
  });

  // 10. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
